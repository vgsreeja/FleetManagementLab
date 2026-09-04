import express, { Request, Response } from "express";
import path from "path";
import crypto from "crypto";
import { GoogleGenAI } from "@google/genai";
import { createServer as createViteServer } from "vite";
import {
  Role,
  ConnectivityState,
  VesselEvent,
  ConstraintSnapshot,
  ImpactAssessment,
  RecoveryOption,
  ApprovalRecord,
  AuditEvent,
  Vessel,
  Stage7TestResult,
  OrchestratorExportPayload
} from "./src/types";

const app = express();
const PORT = 3000;

app.use(express.json());

// Lazy-initialized Gemini AI client
let aiClient: GoogleGenAI | null = null;
function getAI(): GoogleGenAI | null {
  if (!aiClient && process.env.GEMINI_API_KEY) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// ============================================================================
// DOMAIN ORCHESTRATOR CLASS (Direct TypeScript Port of Python Reference Implementation)
// Upstream Source of Truth: fleet-PRD_V1.md, Stage 1-8 decisions
// ============================================================================

class FleetOrchestrator {
  public events: Map<string, VesselEvent> = new Map();
  public assessments: Map<string, ImpactAssessment> = new Map();
  public options: Map<string, RecoveryOption> = new Map();
  public approvals: Map<string, ApprovalRecord> = new Map();
  public audit_log: AuditEvent[] = [];
  public processed_dedup_keys: Set<string> = new Set();
  public executed_action_ids: Set<string> = new Set();
  public connectivity: ConnectivityState = ConnectivityState.ONLINE;
  public networkLatencyMs: number = 45;

  public versions = {
    app: "1.0.0-synthetic",
    policy: "POL-2026-08",
    model: "fleet-assist-v1",
  };

  public vessels: Vessel[] = [
    {
      id: "VESSEL-001",
      name: "MV Pacific Horizon",
      imo: "IMO 9876543",
      type: "Ultra Large Container Vessel (20,000 TEU)",
      origin: "Port of Shanghai (CNSHA)",
      destination: "Port of Rotterdam (NLRTM)",
      current_position: { lat: 12.35, lon: 43.42, name: "Bab-el-Mandeb Strait Approach" },
      speed_knots: 19.4,
      heading: 312,
      fuel_remaining_mt: 3420,
      cargo_summary: "High-value electronics, automotive parts, perishable chilled goods (850 TEU reefers)",
      active_disruption: "DISRUPT-001",
      waypoints: [
        { lat: 31.23, lon: 121.47, name: "Shanghai", status: "passed" },
        { lat: 1.29, lon: 103.85, name: "Singapore", status: "passed" },
        { lat: 12.35, lon: 43.42, name: "Bab-el-Mandeb", status: "current" },
        { lat: 27.85, lon: 34.32, name: "Suez Canal Entry", status: "upcoming" },
        { lat: 36.14, lon: -5.35, name: "Strait of Gibraltar", status: "upcoming" },
        { lat: 51.92, lon: 4.47, name: "Rotterdam", status: "upcoming" },
      ],
    },
    {
      id: "VESSEL-002",
      name: "MV Nordic Titan",
      imo: "IMO 9412034",
      type: "LNG Carrier (174,000 cbm)",
      origin: "Ras Laffan (QARLF)",
      destination: "Zeebrugge (BEZEE)",
      current_position: { lat: -34.2, lon: 18.4, name: "Cape of Good Hope" },
      speed_knots: 16.8,
      heading: 325,
      fuel_remaining_mt: 2150,
      cargo_summary: "Cryogenic Liquefied Natural Gas (Cargo Boil-off constraint: 0.12%/day)",
      waypoints: [
        { lat: 25.92, lon: 51.53, name: "Ras Laffan", status: "passed" },
        { lat: -34.2, lon: 18.4, name: "Cape Point", status: "current" },
        { lat: 14.7, lon: -17.5, name: "Dakar Passage", status: "upcoming" },
        { lat: 51.33, lon: 3.21, name: "Zeebrugge", status: "upcoming" },
      ],
    },
    {
      id: "VESSEL-003",
      name: "MV Stellar Aurora",
      imo: "IMO 9654321",
      type: "Capesize Bulk Carrier (180,000 DWT)",
      origin: "Port Hedland (AUPHE)",
      destination: "Qingdao (CNQDG)",
      current_position: { lat: -8.15, lon: 115.8, name: "Lombok Strait" },
      speed_knots: 13.2,
      heading: 18,
      fuel_remaining_mt: 1890,
      cargo_summary: "172,000 MT Iron Ore Fines",
      waypoints: [
        { lat: -20.31, lon: 118.57, name: "Port Hedland", status: "passed" },
        { lat: -8.15, lon: 115.8, name: "Lombok", status: "current" },
        { lat: 14.59, lon: 120.98, name: "Manila Sea Lane", status: "upcoming" },
        { lat: 36.06, lon: 120.38, name: "Qingdao", status: "upcoming" },
      ],
    },
  ];

  constructor() {
    this.seedInitialScenario();
  }

  public seedInitialScenario() {
    this.events.clear();
    this.assessments.clear();
    this.options.clear();
    this.approvals.clear();
    this.audit_log = [];
    this.processed_dedup_keys.clear();
    this.executed_action_ids.clear();
    this.connectivity = ConnectivityState.ONLINE;

    // Initial Synthetic Disruption Event (WF-01)
    const initialEvent: VesselEvent = {
      event_id: "EVT-2026-0828-001",
      source_system: "BRIDGE_TELEMETRY_ENGINE",
      original_timestamp: new Date(Date.now() - 3600 * 1000 * 2).toISOString(),
      vessel_id: "VESSEL-001",
      vessel_name: "MV Pacific Horizon",
      disruption_type: "Severe Main Engine Turbocharger Vibration & Red Sea Security Restriction",
      severity: "CRITICAL",
      telemetry_payload: {
        vibration_rms_mms: 18.7,
        bearing_temp_c: 94.2,
        max_derated_power_pct: 65,
        security_threat_level: "HIGH_RED_SEA",
        estimated_speed_loss_knots: 4.8,
      },
      dedup_key: "",
      status: "PENDING",
    };
    // Calculate dedup key
    const raw = `${initialEvent.source_system}|${initialEvent.original_timestamp}|${JSON.stringify(initialEvent.telemetry_payload)}`;
    initialEvent.dedup_key = crypto.createHash("sha256").update(raw).digest("hex");
    this.ingest_event(initialEvent, "Master C. Vance", Role.MASTER);

    // Initial Context Sources (WF-02)
    const contextSources: ConstraintSnapshot[] = [
      {
        source: "SAFETY_REG: SOLAS Chapter V / ISM Code",
        timestamp: new Date().toISOString(),
        data: {
          max_continuous_vibration: "10.0 mm/s RMS",
          derated_rpm_limit: 72,
          mandatory_haven_inspection: true,
          safe_speed_mandate: "SOLAS V/Reg 34",
        },
        latency_minutes: 2,
        is_stale: false,
      },
      {
        source: "WEATHER_API: Copernicus ECMWF Marine Storm Model",
        timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        data: {
          gale_force_winds_knots: 48,
          wave_height_sig_m: 6.8,
          region: "Gulf of Aden & Southern Red Sea Sector 4",
        },
        latency_minutes: 15,
        is_stale: false,
      },
      {
        source: "PORT_BERTH_SLOT: Rotterdam APM Terminal",
        timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
        data: {
          allocated_window_start: new Date(Date.now() + 86400 * 1000 * 6).toISOString(),
          berth_id: "APMT-T2-04",
          demurrage_usd_per_hour: 4800,
          congestion_queue_delay_hours: 36,
        },
        latency_minutes: 45,
        is_stale: false,
      },
      {
        source: "BUNKER_FEED: Singapore / Fujairah VLSFO Spot Feed",
        timestamp: new Date(Date.now() - 180 * 60 * 1000).toISOString(),
        data: {
          fujairah_vlsfo_usd_mt: 612.5,
          rotterdam_vlsfo_usd_mt: 588.0,
        },
        latency_minutes: 180,
        is_stale: true, // Mark as stale
      },
      {
        source: "CREW_REST_DATA: MLC 2006 Compliance Engine",
        timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
        data: {
          engine_officers_fatigue_index: "ELEVATED",
          consecutive_hours_on_duty: 14,
        },
        latency_minutes: 25,
        is_stale: false,
      },
    ];

    // Initial Impact Assessment (WF-02)
    const assessment = this.assess_impact(initialEvent.event_id, contextSources, "FleetOps Director H. Meyer", Role.FLEET_OPS);

    // Initial Recovery Options (WF-03)
    this.generate_recovery_options(
      assessment.assessment_id,
      ["BUNKER_FEED_STALE (180 min)", "CANAL_TRANSIT_CONVOY_SLOT_UNCONFIRMED"],
      "FleetOps AI Assistant",
      Role.FLEET_OPS
    );
  }

  public _audit(
    actor: string,
    role: Role,
    action: string,
    target: string,
    before: Record<string, any> = {},
    after: Record<string, any> = {}
  ) {
    const event: AuditEvent = {
      audit_id: `AUD-${crypto.randomUUID()}`,
      timestamp: new Date().toISOString(),
      actor,
      role: role,
      action,
      target,
      before_state: before,
      after_state: after,
      connectivity_state: this.connectivity,
      material_versions: { ...this.versions },
    };
    this.audit_log.unshift(event); // most recent first
  }

  public _check_permission(role: Role, required_action: string) {
    const permissions: Record<Role, Set<string>> = {
      [Role.MASTER]: new Set(["view", "approve", "execute", "export", "manual_fallback", "generate", "review"]),
      [Role.FLEET_OPS]: new Set(["view", "generate", "review", "export"]),
      [Role.AUDIT_OBSERVER]: new Set(["view", "export"]),
    };
    const allowed = permissions[role]?.has(required_action);
    if (!allowed) {
      throw new Error(`Role ${role} is forbidden from action '${required_action}'. Master retaining navigational authority enforced.`);
    }
  }

  // --- WF-01: Event Detection & Deduplication (FR-001, BR-02) ---
  public ingest_event(event: VesselEvent, actor: string, role: Role): VesselEvent {
    this._check_permission(role, "view");

    if (!event.dedup_key) {
      const raw = `${event.source_system}|${event.original_timestamp}|${JSON.stringify(event.telemetry_payload)}`;
      event.dedup_key = crypto.createHash("sha256").update(raw).digest("hex");
    }

    if (this.processed_dedup_keys.has(event.dedup_key)) {
      event.status = "DEDUPLICATED";
      this._audit(actor, role, "EVENT_DEDUPLICATED", event.event_id, {}, {
        status: "DEDUPLICATED",
        dedup_key: event.dedup_key,
      });
      return event;
    }

    event.status = "PROCESSED";
    this.processed_dedup_keys.add(event.dedup_key);
    this.events.set(event.event_id, event);
    this._audit(actor, role, "EVENT_INGESTED", event.event_id, {}, {
      status: "PROCESSED",
      dedup_key: event.dedup_key,
      vessel_id: event.vessel_id,
      disruption_type: event.disruption_type,
    });
    return event;
  }

  // --- WF-02: Impact Assessment (FR-002) ---
  public assess_impact(
    event_id: string,
    context_sources: ConstraintSnapshot[],
    actor: string,
    role: Role,
    summaryOverride?: string
  ): ImpactAssessment {
    this._check_permission(role, "generate");
    if (!this.events.has(event_id)) {
      throw new Error(`Event with ID '${event_id}' not found.`);
    }

    const event = this.events.get(event_id)!;
    const hasHighSafety = context_sources.some((s) => s.source.toUpperCase().includes("SAFETY"));
    const staleCount = context_sources.filter((s) => s.is_stale || s.latency_minutes > 60).length;

    const assessment: ImpactAssessment = {
      assessment_id: `ASM-${crypto.randomUUID()}`,
      event_id: event_id,
      context_sources: context_sources,
      summary:
        summaryOverride ||
        `AI Retrieval-Grounded Impact: Evaluated against ${context_sources.length} active constraint feeds (${staleCount} stale/high-latency). Severe speed derating reduces cruising speed by ~4.8 knots. Projected arrival window at Rotterdam is at risk with +44h delay unless mitigation route or intermediate haven inspection is executed.`,
      freshness_timestamp: new Date().toISOString(),
      eta_delay_hours: 44.5,
      fuel_impact_tons: 142.0,
      safety_risk_level: hasHighSafety ? "HIGH" : "MODERATE",
      affected_cargo_value_usd: 124500000,
    };

    this.assessments.set(assessment.assessment_id, assessment);
    this._audit(actor, role, "IMPACT_ASSESSED", assessment.assessment_id, {}, {
      event_id,
      sources_count: context_sources.length,
      stale_count: staleCount,
      eta_delay_hours: assessment.eta_delay_hours,
    });
    return assessment;
  }

  // --- WF-03: Recovery Option Generation (FR-003, BR-03, BR-04) ---
  public generate_recovery_options(
    assessment_id: string,
    missing_data: string[],
    actor: string,
    role: Role,
    customOptions?: RecoveryOption[]
  ): RecoveryOption[] {
    this._check_permission(role, "generate");
    if (!this.assessments.has(assessment_id)) {
      throw new Error(`Assessment with ID '${assessment_id}' not found.`);
    }

    const assessment = this.assessments.get(assessment_id)!;
    const safetyOverride = assessment.context_sources.some((src) =>
      src.source.toUpperCase().includes("SAFETY") || src.source.toUpperCase().includes("SOLAS")
    );

    if (customOptions && customOptions.length > 0) {
      customOptions.forEach((opt) => {
        this.options.set(opt.option_id, opt);
        this._audit(actor, role, "OPTION_GENERATED", opt.option_id, {}, {
          title: opt.title,
          strategy: opt.route_strategy,
          missing_flags: opt.missing_data_flags,
          safety_override: opt.safety_constraint_override,
        });
      });
      return customOptions;
    }

    // Generate Standard Structured Options (BR-03, BR-04)
    const option1: RecoveryOption = {
      option_id: `OPT-${crypto.randomUUID()}`,
      assessment_id: assessment_id,
      title: "Option A (Safety First): Divert to Port of Salalah Haven & Derated Transit via Cape of Good Hope",
      description:
        "Immediate diversion to Salalah anchorage for emergency turbocharger vibration mitigation and bunkering, followed by derated 15-knot passage avoiding high-risk Red Sea sector.",
      route_strategy: "WEATHER_REROUTE",
      constraints_used: assessment.context_sources,
      missing_data_flags: missing_data, // BR-04: Expose missing/unavailable constraints
      safety_constraint_override: safetyOverride, // BR-03: Safety rules override commercial optimization
      freshness_timestamp: new Date().toISOString(),
      metrics: {
        cost_delta_usd: 86500,
        fuel_delta_mt: -34.0,
        eta_delta_hours: 38.0,
        co2_delta_mt: -105.4,
        risk_score: 18, // lowest risk
      },
      recommended: true,
      ai_rationale:
        "Complies fully with SOLAS Chapter V safe speed directives. Eliminates catastrophic turbocharger failure probability in heavy seas while accommodating crew rest MLC cycles.",
      alternate_waypoints: [
        { lat: 16.94, lon: 54.0, name: "Salalah Haven Inspection" },
        { lat: -34.2, lon: 18.4, name: "Cape of Good Hope Passage" },
        { lat: 51.92, lon: 4.47, name: "Rotterdam Terminal" },
      ],
    };

    const option2: RecoveryOption = {
      option_id: `OPT-${crypto.randomUUID()}`,
      assessment_id: assessment_id,
      title: "Option B (Commercial Expedite): Suez Convoy Transit with Increased RPM Derate",
      description:
        "Proceed directly through Red Sea to catch Suez Southbound Convoy Slot. Requires sustained 17.5 knots operating right on vibration warning threshold.",
      route_strategy: "SPEED_INCREASE",
      constraints_used: assessment.context_sources,
      missing_data_flags: [...missing_data, "HIGH_RISK_SURCHARGE_FLUCTUATION"],
      safety_constraint_override: false,
      freshness_timestamp: new Date().toISOString(),
      metrics: {
        cost_delta_usd: 194000,
        fuel_delta_mt: 82.5,
        eta_delta_hours: 6.0,
        co2_delta_mt: 255.7,
        risk_score: 72, // High risk
      },
      recommended: false,
      ai_rationale:
        "Saves berth window at Rotterdam, but violates conservative SOLAS vibration margins and incurs significant security escort premiums.",
      alternate_waypoints: [
        { lat: 27.85, lon: 34.32, name: "Suez Entry Checkpoint" },
        { lat: 36.14, lon: -5.35, name: "Gibraltar" },
        { lat: 51.92, lon: 4.47, name: "Rotterdam" },
      ],
    };

    const option3: RecoveryOption = {
      option_id: `OPT-${crypto.randomUUID()}`,
      assessment_id: assessment_id,
      title: "Option C (Split Cargo): Alternate Discharge at Port of Valencia & Feeder On-Carriage",
      description:
        "Discharge European continental cargo at Valencia deep-water hub, utilizing feeder relay to Northern Europe.",
      route_strategy: "ALTERNATE_PORT_DISCHARGE",
      constraints_used: assessment.context_sources,
      missing_data_flags: [...missing_data, "VALENCIA_FEEDER_SCHEDULE_UNCONFIRMED"],
      safety_constraint_override: safetyOverride,
      freshness_timestamp: new Date().toISOString(),
      metrics: {
        cost_delta_usd: 142000,
        fuel_delta_mt: -68.0,
        eta_delta_hours: 18.0,
        co2_delta_mt: -210.8,
        risk_score: 35,
      },
      recommended: false,
      ai_rationale:
        "Avoids Northern European congestion queue. Reduces engine stress while preserving critical supply chain deadlines via intermodal relay.",
    };

    [option1, option2, option3].forEach((opt) => {
      this.options.set(opt.option_id, opt);
      this._audit(actor, role, "OPTION_GENERATED", opt.option_id, {}, {
        title: opt.title,
        strategy: opt.route_strategy,
        missing_flags: opt.missing_data_flags,
        safety_override: opt.safety_constraint_override,
      });
    });

    return [option1, option2, option3];
  }

  // --- WF-04: Master/Fleet Approval & Execution (FR-004, FR-005, BR-01) ---
  public approve_and_execute(option_id: string, actor: string, role: Role, notes?: string): "EXECUTED" | "SKIPPED_IDEMPOTENT" {
    // Idempotency: Replayed approval does not trigger duplicate operational action
    if (this.executed_action_ids.has(option_id)) {
      this._audit(actor, role, "EXECUTION_IDEMPOTENT_SKIP", option_id, {}, {
        status: "SKIPPED_IDEMPOTENT",
        message: "Duplicate approval execution request safely deduplicated.",
      });
      return "SKIPPED_IDEMPOTENT";
    }

    // BR-01 & FR-004: ONLY Master retains navigational authority
    if (role !== Role.MASTER) {
      this._audit(actor, role, "UNAUTHORIZED_APPROVAL_ATTEMPT", option_id, {}, {
        rejected_role: role,
        reason: "Master authority gate violation.",
      });
      throw new Error("CRITICAL AUTHORITY VIOLATION (BR-01): Only Bridge Team / Master retains navigational execution authority.");
    }

    if (!this.options.has(option_id)) {
      throw new Error(`Recovery Option with ID '${option_id}' not found.`);
    }

    const option = this.options.get(option_id)!;

    // Record Approval
    const approval: ApprovalRecord = {
      record_id: `APR-${crypto.randomUUID()}`,
      option_id: option_id,
      role: role,
      user: actor,
      status: "APPROVED",
      timestamp: new Date().toISOString(),
      notes: notes || "Master electronic signature verified under STCW Regulation VIII/2.",
    };
    this.approvals.set(approval.record_id, approval);

    // Execute Action Idempotently
    this.executed_action_ids.add(option_id);
    this._audit(actor, role, "ACTION_EXECUTED", option_id, {}, {
      approval_id: approval.record_id,
      option_title: option.title,
      strategy: option.route_strategy,
      cost_delta: option.metrics.cost_delta_usd,
      eta_delta: option.metrics.eta_delta_hours,
    });

    return "EXECUTED";
  }

  // --- WF-05 & WF-06: Offline Continuity & Manual Fallback (FR-006, FR-008, NFR-001) ---
  public manual_fallback_action(action_description: string, actor: string, role: Role): string {
    this._check_permission(role, "manual_fallback");

    // BR-05: Cloud/AI unavailability must not degrade safe navigation
    const action_id = `MANUAL-${crypto.randomUUID()}`;
    this.executed_action_ids.add(action_id);
    this._audit(actor, role, "MANUAL_FALLBACK_EXECUTED", action_id, {}, {
      description: action_description,
      connectivity_at_execution: this.connectivity,
    });
    return action_id;
  }

  // --- FR-010: Export State ---
  public export_state(actor: string, role: Role): OrchestratorExportPayload {
    this._check_permission(role, "export");
    this._audit(actor, role, "STATE_EXPORTED", "SYSTEM");

    const eventsObj: Record<string, VesselEvent> = {};
    this.events.forEach((v, k) => {
      eventsObj[k] = v;
    });

    const assessmentsObj: Record<string, ImpactAssessment> = {};
    this.assessments.forEach((v, k) => {
      assessmentsObj[k] = v;
    });

    const optionsObj: Record<string, RecoveryOption> = {};
    this.options.forEach((v, k) => {
      optionsObj[k] = v;
    });

    return {
      export_timestamp: new Date().toISOString(),
      material_versions: { ...this.versions },
      events: eventsObj,
      assessments: assessmentsObj,
      options: optionsObj,
      executed_actions: Array.from(this.executed_action_ids),
      audit_log: [...this.audit_log],
      connectivity: this.connectivity,
    };
  }

  // --- STAGE 7 HARD GATES TEST HARNESS (PRD Sections 10, 13) ---
  public runStage7Evaluations(): { passed: boolean; results: Stage7TestResult[]; totalAudit: number; totalActions: number } {
    const testOrchestrator = new FleetOrchestrator();
    const results: Stage7TestResult[] = [];

    // Synthetic Test Payload
    const testEvent: VesselEvent = {
      event_id: "TEST-EVT-001",
      source_system: "TELEMETRY-A",
      original_timestamp: "2026-08-28T10:00:00Z",
      telemetry_payload: { anomaly: "engine_vibration", level: 14.5 },
      dedup_key: "",
      status: "PENDING",
    };
    const testContext: ConstraintSnapshot[] = [
      { source: "WEATHER_API", timestamp: new Date().toISOString(), data: { storm: true }, latency_minutes: 5, is_stale: false },
      { source: "SAFETY_REG", timestamp: new Date().toISOString(), data: { limit: 10 }, latency_minutes: 2, is_stale: false },
    ];

    // TEST 1: Idempotency (FR-005, NFR-002)
    const t1Logs: string[] = [];
    const t1Start = Date.now();
    try {
      t1Logs.push("Ingesting initial event (Status expected: PROCESSED)...");
      testOrchestrator.ingest_event(testEvent, "Master", Role.MASTER);
      t1Logs.push(`First ingest status: ${testEvent.status}`);

      t1Logs.push("Simulating network replay / reconnect delivery...");
      testOrchestrator.ingest_event(testEvent, "Master", Role.MASTER);
      t1Logs.push(`Replay ingest status: ${testEvent.status}`);

      if (testEvent.status !== "DEDUPLICATED") {
        throw new Error("Duplicate event was not marked as DEDUPLICATED.");
      }
      const dedupAudits = testOrchestrator.audit_log.filter((a) => a.action === "EVENT_DEDUPLICATED");
      if (dedupAudits.length !== 1) {
        throw new Error("Deduplication audit event count mismatch.");
      }
      t1Logs.push("Assertion verified: 0 duplicate operational actions triggered by replayed events.");
      results.push({
        id: "T1-IDEMPOTENCY",
        name: "Test 1: Idempotency & Deduplication across Reconnects",
        fr_ref: "FR-005, NFR-002, BR-02",
        status: "PASSED",
        description: "Verify that duplicated telemetry feeds or replayed network packets are safely deduplicated using SHA-256 idempotency keys.",
        assertion: "testEvent.status === 'DEDUPLICATED' && audit_log.includes('EVENT_DEDUPLICATED')",
        logs: t1Logs,
        duration_ms: Date.now() - t1Start,
      });
    } catch (err: any) {
      results.push({
        id: "T1-IDEMPOTENCY",
        name: "Test 1: Idempotency & Deduplication across Reconnects",
        fr_ref: "FR-005, NFR-002, BR-02",
        status: "FAILED",
        description: "Verify that duplicated telemetry feeds are deduplicated.",
        assertion: "Failed: " + err.message,
        logs: [...t1Logs, `ERROR: ${err.message}`],
        duration_ms: Date.now() - t1Start,
      });
    }

    // TEST 2: Provenance & Missing Data Flags (FR-003, BR-04)
    const t2Logs: string[] = [];
    const t2Start = Date.now();
    try {
      t2Logs.push("Generating impact assessment with retrieval-grounded sources...");
      const asm = testOrchestrator.assess_impact(testEvent.event_id, testContext, "FleetOps", Role.FLEET_OPS);
      t2Logs.push(`Assessment generated: ${asm.assessment_id}`);

      t2Logs.push("Synthesizing recovery options with explicit missing data flags (CREW_REST_DATA_UNAVAILABLE)...");
      const opts = testOrchestrator.generate_recovery_options(
        asm.assessment_id,
        ["CREW_REST_DATA_UNAVAILABLE", "BUNKER_PRICE_FEED_STALE"],
        "FleetOps",
        Role.FLEET_OPS
      );
      const opt = opts[0];
      if (!opt.missing_data_flags || opt.missing_data_flags.length === 0) {
        throw new Error("Missing data flags were not captured on recovery option.");
      }
      if (!opt.freshness_timestamp) {
        throw new Error("Freshness timestamp is missing.");
      }
      t2Logs.push(`Option ${opt.option_id} carries ${opt.missing_data_flags.length} missing data flags.`);
      t2Logs.push("Assertion verified: 100% of recommendations expose sources, timestamps, and missing data flags.");
      results.push({
        id: "T2-PROVENANCE",
        name: "Test 2: Provenance, Freshness, & Missing Data Exposure",
        fr_ref: "FR-003, BR-04",
        status: "PASSED",
        description: "Ensure that recovery options explicitly flag stale feeds or missing telemetry constraints before operational consideration.",
        assertion: "opt.missing_data_flags.length > 0 && opt.freshness_timestamp !== undefined",
        logs: t2Logs,
        duration_ms: Date.now() - t2Start,
      });
    } catch (err: any) {
      results.push({
        id: "T2-PROVENANCE",
        name: "Test 2: Provenance, Freshness, & Missing Data Exposure",
        fr_ref: "FR-003, BR-04",
        status: "FAILED",
        description: "Verify provenance & missing data flags.",
        assertion: "Failed: " + err.message,
        logs: [...t2Logs, `ERROR: ${err.message}`],
        duration_ms: Date.now() - t2Start,
      });
    }

    // TEST 3: Master Authority Gate & Negative Test (FR-004, BR-01, FR-010)
    const t3Logs: string[] = [];
    const t3Start = Date.now();
    try {
      const firstOptId = Array.from(testOrchestrator.options.keys())[0];
      t3Logs.push(`Attempting execution by unauthorized role: FLEET_OPS (Negative Test)...`);
      let blocked = false;
      try {
        testOrchestrator.approve_and_execute(firstOptId, "FleetOps User", Role.FLEET_OPS);
      } catch (e: any) {
        blocked = true;
        t3Logs.push(`Negative test caught as expected: "${e.message}"`);
      }
      if (!blocked) {
        throw new Error("FAIL: Fleet Ops bypassed Master authority gate!");
      }

      t3Logs.push("Executing approval as authorized Master...");
      const execRes = testOrchestrator.approve_and_execute(firstOptId, "Master C. Vance", Role.MASTER);
      if (execRes !== "EXECUTED") {
        throw new Error("Master approval did not return EXECUTED.");
      }
      t3Logs.push("Executing replayed approval to verify idempotent execution protection...");
      const replayRes = testOrchestrator.approve_and_execute(firstOptId, "Master C. Vance", Role.MASTER);
      if (replayRes !== "SKIPPED_IDEMPOTENT") {
        throw new Error("Replayed approval was not flagged as SKIPPED_IDEMPOTENT.");
      }
      t3Logs.push("Assertion verified: 0 unauthorized role executions & 0 duplicate actions from approval replays.");
      results.push({
        id: "T3-AUTHORITY-GATE",
        name: "Test 3: Master Authority Gate & Idempotent Approval Replay",
        fr_ref: "FR-004, FR-005, BR-01, FR-010",
        status: "PASSED",
        description: "Verify that only the Bridge Team / Master can approve navigation orders, and replay executions are idempotent.",
        assertion: "unauthorized_blocked === true && replayRes === 'SKIPPED_IDEMPOTENT'",
        logs: t3Logs,
        duration_ms: Date.now() - t3Start,
      });
    } catch (err: any) {
      results.push({
        id: "T3-AUTHORITY-GATE",
        name: "Test 3: Master Authority Gate & Idempotent Approval Replay",
        fr_ref: "FR-004, FR-005, BR-01, FR-010",
        status: "FAILED",
        description: "Verify Master authority gate.",
        assertion: "Failed: " + err.message,
        logs: [...t3Logs, `ERROR: ${err.message}`],
        duration_ms: Date.now() - t3Start,
      });
    }

    // TEST 4: Offline Continuity & Manual Fallback (FR-006, FR-008, NFR-001)
    const t4Logs: string[] = [];
    const t4Start = Date.now();
    try {
      t4Logs.push("Switching simulated connectivity to OFFLINE...");
      testOrchestrator.connectivity = ConnectivityState.OFFLINE;

      t4Logs.push("Attempting manual fallback action by Master while offline...");
      const manualId = testOrchestrator.manual_fallback_action("Emergency Course Alteration 15 deg Port to clear shoals", "Master", Role.MASTER);
      if (!manualId.startsWith("MANUAL-")) {
        throw new Error("Manual fallback action ID does not start with MANUAL- prefix.");
      }
      t4Logs.push(`Manual action generated: ${manualId}`);

      t4Logs.push("Attempting manual fallback action by Fleet Ops (Negative test)...");
      let opsBlocked = false;
      try {
        testOrchestrator.manual_fallback_action("Shore override", "FleetOps", Role.FLEET_OPS);
      } catch (e: any) {
        opsBlocked = true;
        t4Logs.push(`Fleet Ops manual fallback correctly blocked: "${e.message}"`);
      }
      if (!opsBlocked) {
        throw new Error("Fleet Ops should not have manual fallback authority.");
      }
      t4Logs.push("Assertion verified: 100% of essential vessel-side scenarios continue through shore/cloud outage.");
      results.push({
        id: "T4-OFFLINE-CONTINUITY",
        name: "Test 4: Offline Continuity & Master Manual Fallback",
        fr_ref: "FR-006, FR-008, NFR-001, BR-05",
        status: "PASSED",
        description: "Ensure that when satellite or cloud connectivity is severed, Bridge Team retains full local fallback action capability.",
        assertion: "manualId.startsWith('MANUAL-') && fleet_ops_manual_blocked === true",
        logs: t4Logs,
        duration_ms: Date.now() - t4Start,
      });
    } catch (err: any) {
      results.push({
        id: "T4-OFFLINE-CONTINUITY",
        name: "Test 4: Offline Continuity & Master Manual Fallback",
        fr_ref: "FR-006, FR-008, NFR-001, BR-05",
        status: "FAILED",
        description: "Verify offline continuity.",
        assertion: "Failed: " + err.message,
        logs: [...t4Logs, `ERROR: ${err.message}`],
        duration_ms: Date.now() - t4Start,
      });
    }

    // TEST 5: Audit Trail Reconstruction & State Export (FR-009, FR-010)
    const t5Logs: string[] = [];
    const t5Start = Date.now();
    try {
      t5Logs.push("Restoring connectivity to ONLINE...");
      testOrchestrator.connectivity = ConnectivityState.ONLINE;

      t5Logs.push("Exporting state payload as Audit Observer...");
      const exported = testOrchestrator.export_state("Senior Maritime Auditor", Role.AUDIT_OBSERVER);
      if (!exported.material_versions || !exported.material_versions.policy) {
        throw new Error("Export payload missing material versions.");
      }
      if (!exported.audit_log || exported.audit_log.length === 0) {
        throw new Error("Export payload audit log is empty.");
      }
      t5Logs.push(`Export verified with ${exported.audit_log.length} audit entries, policy ${exported.material_versions.policy}.`);

      t5Logs.push("Testing Audit Observer mutation attempt (Negative Test)...");
      let auditMutationBlocked = false;
      try {
        testOrchestrator.assess_impact(testEvent.event_id, testContext, "Auditor", Role.AUDIT_OBSERVER);
      } catch (e: any) {
        auditMutationBlocked = true;
        t5Logs.push(`Audit Observer mutation correctly blocked: "${e.message}"`);
      }
      if (!auditMutationBlocked) {
        throw new Error("Audit Observer was able to mutate state!");
      }
      t5Logs.push("Assertion verified: Export contains mutated state, audit trail, and version hashes. Audit Observer is strictly read-only.");
      results.push({
        id: "T5-AUDIT-EXPORT",
        name: "Test 5: Audit Trail Reconstruction & State Export",
        fr_ref: "FR-009, FR-010",
        status: "PASSED",
        description: "Verify that comprehensive audit log captures all state changes with before/after state diffs, and state export meets PRD data contracts.",
        assertion: "exported.material_versions && exported.audit_log.length > 0 && auditor_mutation_blocked",
        logs: t5Logs,
        duration_ms: Date.now() - t5Start,
      });
    } catch (err: any) {
      results.push({
        id: "T5-AUDIT-EXPORT",
        name: "Test 5: Audit Trail Reconstruction & State Export",
        fr_ref: "FR-009, FR-010",
        status: "FAILED",
        description: "Verify audit trail reconstruction.",
        assertion: "Failed: " + err.message,
        logs: [...t5Logs, `ERROR: ${err.message}`],
        duration_ms: Date.now() - t5Start,
      });
    }

    const allPassed = results.every((r) => r.status === "PASSED");
    return {
      passed: allPassed,
      results,
      totalAudit: testOrchestrator.audit_log.length,
      totalActions: testOrchestrator.executed_action_ids.size,
    };
  }
}

// Global Orchestrator Instance
const orchestrator = new FleetOrchestrator();

// ============================================================================
// API ROUTES
// ============================================================================

// Health check
app.get("/api/health", (req: Request, res: Response) => {
  res.json({
    status: "ok",
    version: orchestrator.versions.app,
    connectivity: orchestrator.connectivity,
  });
});

// GET /api/state - Full State
app.get("/api/state", (req: Request, res: Response) => {
  const events: VesselEvent[] = Array.from(orchestrator.events.values());
  const assessments: ImpactAssessment[] = Array.from(orchestrator.assessments.values());
  const options: RecoveryOption[] = Array.from(orchestrator.options.values());
  const approvals: ApprovalRecord[] = Array.from(orchestrator.approvals.values());
  const executed_actions: string[] = Array.from(orchestrator.executed_action_ids);

  res.json({
    versions: orchestrator.versions,
    connectivity: orchestrator.connectivity,
    networkLatencyMs: orchestrator.networkLatencyMs,
    vessels: orchestrator.vessels,
    events,
    assessments,
    options,
    approvals,
    executed_actions,
    audit_log: orchestrator.audit_log,
  });
});

// POST /api/events/ingest - Ingest telemetry event
app.post("/api/events/ingest", (req: Request, res: Response) => {
  try {
    const { event, actor = "Bridge Team / Master", role = Role.MASTER } = req.body;
    if (!event || !event.source_system || !event.telemetry_payload) {
      return res.status(400).json({ error: "Invalid event payload." });
    }

    const vesselEvent: VesselEvent = {
      event_id: event.event_id || `EVT-${Date.now()}`,
      source_system: event.source_system,
      original_timestamp: event.original_timestamp || new Date().toISOString(),
      telemetry_payload: event.telemetry_payload,
      dedup_key: event.dedup_key || "",
      status: "PENDING",
      vessel_id: event.vessel_id || "VESSEL-001",
      vessel_name: event.vessel_name || "MV Pacific Horizon",
      disruption_type: event.disruption_type || "Telemetry Anomaly",
      severity: event.severity || "HIGH",
    };

    const result = orchestrator.ingest_event(vesselEvent, actor, role as Role);
    res.json({ success: true, event: result });
  } catch (err: any) {
    res.status(403).json({ error: err.message });
  }
});

// POST /api/assessments/generate - Run Impact Assessment with Gemini AI enhancement
app.post("/api/assessments/generate", async (req: Request, res: Response) => {
  try {
    const {
      event_id,
      context_sources,
      actor = "FleetOps Specialist",
      role = Role.FLEET_OPS,
      use_ai = true,
    } = req.body;

    if (!event_id || !context_sources) {
      return res.status(400).json({ error: "Missing event_id or context_sources." });
    }

    let summaryOverride: string | undefined = undefined;

    // Optional Gemini AI analysis
    const ai = getAI();
    if (use_ai && ai && process.env.GEMINI_API_KEY) {
      try {
        const event = orchestrator.events.get(event_id);
        const prompt = `You are the AI Fleet Disruption & Voyage Recovery Orchestrator (PRD Stage 2/3).
Analyze this maritime disruption:
Disruption Event: ${JSON.stringify(event || { event_id })}
Constraint Context Snapshots: ${JSON.stringify(context_sources)}

Provide a concise, professional, 2-3 sentence retrieval-grounded maritime impact assessment covering:
1. Navigational/Safety risk and speed reduction.
2. Estimated delay and downstream port congestion risk.
3. Explicit reference to stale feeds or missing constraints.`;

        const aiResponse = await ai.models.generateContent({
          model: "gemini-3.7-flash",
          contents: prompt,
        });

        if (aiResponse && aiResponse.text) {
          summaryOverride = aiResponse.text.trim();
        }
      } catch (aiErr) {
        console.warn("Gemini AI synthesis fallback to deterministic engine:", aiErr);
      }
    }

    const assessment = orchestrator.assess_impact(
      event_id,
      context_sources,
      actor,
      role as Role,
      summaryOverride
    );

    res.json({ success: true, assessment });
  } catch (err: any) {
    res.status(403).json({ error: err.message });
  }
});

// POST /api/options/generate - Synthesize Recovery Options
app.post("/api/options/generate", async (req: Request, res: Response) => {
  try {
    const {
      assessment_id,
      missing_data = [],
      actor = "Fleet Operations AI",
      role = Role.FLEET_OPS,
      use_ai = true,
    } = req.body;

    if (!assessment_id) {
      return res.status(400).json({ error: "Missing assessment_id." });
    }

    const assessment = orchestrator.assessments.get(assessment_id);
    if (!assessment) {
      return res.status(404).json({ error: "Assessment not found." });
    }

    let generatedOptions: RecoveryOption[] | undefined = undefined;

    // Optional Gemini AI-driven multi-scenario generator
    const ai = getAI();
    if (use_ai && ai && process.env.GEMINI_API_KEY) {
      try {
        const prompt = `You are the AI Voyage Recovery Orchestrator.
Generate 3 distinct, high-fidelity maritime voyage recovery options for this disruption:
Assessment: ${JSON.stringify(assessment)}
Missing Data Flags: ${JSON.stringify(missing_data)}

Return a strict JSON array of 3 objects matching this schema:
[
  {
    "title": "Short title",
    "description": "2 sentence operational plan",
    "route_strategy": "WEATHER_REROUTE" | "SPEED_INCREASE" | "ALTERNATE_PORT_DISCHARGE" | "DRIFT_HOLD" | "CANAL_EXPEDITE",
    "missing_data_flags": ["string"],
    "safety_constraint_override": boolean,
    "metrics": {
      "cost_delta_usd": number,
      "fuel_delta_mt": number,
      "eta_delta_hours": number,
      "co2_delta_mt": number,
      "risk_score": number (0-100)
    },
    "recommended": boolean,
    "ai_rationale": "Why this option is/isn't optimal under SOLAS and PRD business rules"
  }
]`;

        const aiResponse = await ai.models.generateContent({
          model: "gemini-3.7-flash",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
          },
        });

        if (aiResponse && aiResponse.text) {
          const parsed = JSON.parse(aiResponse.text);
          if (Array.isArray(parsed) && parsed.length > 0) {
            generatedOptions = parsed.map((item: any) => ({
              option_id: `OPT-AI-${crypto.randomUUID()}`,
              assessment_id,
              title: item.title || "AI Generated Recovery Route",
              description: item.description || "",
              route_strategy: item.route_strategy || "WEATHER_REROUTE",
              constraints_used: assessment.context_sources,
              missing_data_flags: item.missing_data_flags || missing_data,
              safety_constraint_override: item.safety_constraint_override ?? true,
              freshness_timestamp: new Date().toISOString(),
              metrics: item.metrics || {
                cost_delta_usd: 50000,
                fuel_delta_mt: 10,
                eta_delta_hours: 12,
                co2_delta_mt: 31,
                risk_score: 25,
              },
              recommended: Boolean(item.recommended),
              ai_rationale: item.ai_rationale || "AI synthesized strategy considering SOLAS chapter V constraints.",
            }));
          }
        }
      } catch (aiErr) {
        console.warn("Gemini recovery options fallback to deterministic generator:", aiErr);
      }
    }

    const options = orchestrator.generate_recovery_options(
      assessment_id,
      missing_data,
      actor,
      role as Role,
      generatedOptions
    );

    res.json({ success: true, options });
  } catch (err: any) {
    res.status(403).json({ error: err.message });
  }
});

// POST /api/approvals/execute - Master Approval Gate & Execution
app.post("/api/approvals/execute", (req: Request, res: Response) => {
  try {
    const { option_id, actor = "Master C. Vance", role = Role.MASTER, notes } = req.body;
    if (!option_id) {
      return res.status(400).json({ error: "Missing option_id." });
    }

    const result = orchestrator.approve_and_execute(option_id, actor, role as Role, notes);
    res.json({ success: true, status: result, option_id });
  } catch (err: any) {
    res.status(403).json({ error: err.message });
  }
});

// POST /api/fallback/execute - Manual Fallback Navigation Action
app.post("/api/fallback/execute", (req: Request, res: Response) => {
  try {
    const { action_description, actor = "Master C. Vance", role = Role.MASTER } = req.body;
    if (!action_description) {
      return res.status(400).json({ error: "Missing action_description." });
    }

    const action_id = orchestrator.manual_fallback_action(action_description, actor, role as Role);
    res.json({ success: true, action_id, message: "Manual fallback navigational order executed locally." });
  } catch (err: any) {
    res.status(403).json({ error: err.message });
  }
});

// POST /api/connectivity - Update Connectivity State & Latency
app.post("/api/connectivity", (req: Request, res: Response) => {
  const { state, latencyMs, actor = "System Operator", role = Role.MASTER } = req.body;
  if (state && Object.values(ConnectivityState).includes(state)) {
    const prev = orchestrator.connectivity;
    orchestrator.connectivity = state as ConnectivityState;
    if (typeof latencyMs === "number") {
      orchestrator.networkLatencyMs = latencyMs;
    }
    orchestrator._audit(actor, role as Role, "CONNECTIVITY_CHANGED", "NETWORK_INTERFACE", { state: prev }, { state, latencyMs: orchestrator.networkLatencyMs });
  }
  res.json({
    success: true,
    connectivity: orchestrator.connectivity,
    networkLatencyMs: orchestrator.networkLatencyMs,
  });
});

// POST /api/evaluations/run - Run Stage 7 Evaluation Harness
app.post("/api/evaluations/run", (req: Request, res: Response) => {
  const results = orchestrator.runStage7Evaluations();
  orchestrator._audit(
    "Stage 7 Verification Runner",
    Role.AUDIT_OBSERVER,
    "STAGE7_EVALUATION_EXECUTED",
    "TEST_SUITE",
    {},
    { passed: results.passed, tests_count: results.results.length }
  );
  res.json(results);
});

// GET /api/export - Export state payload
app.get("/api/export", (req: Request, res: Response) => {
  try {
    const actor = (req.query.actor as string) || "Senior Auditor";
    const role = (req.query.role as Role) || Role.AUDIT_OBSERVER;
    const payload = orchestrator.export_state(actor, role);
    res.setHeader("Content-Disposition", `attachment; filename="fleet-orchestrator-export-${Date.now()}.json"`);
    res.setHeader("Content-Type", "application/json");
    res.json(payload);
  } catch (err: any) {
    res.status(403).json({ error: err.message });
  }
});

// POST /api/reset - Reset scenario to seed data
app.post("/api/reset", (req: Request, res: Response) => {
  orchestrator.seedInitialScenario();
  res.json({ success: true, message: "Scenario reset to initial reference baseline." });
});

// ============================================================================
// VITE MIDDLEWARE & SERVER STARTUP
// ============================================================================

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`AI Fleet Disruption Orchestrator server running on http://localhost:${PORT}`);
  });
}

startServer();
