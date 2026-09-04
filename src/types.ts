/**
 * AI Fleet Disruption & Voyage Recovery Orchestrator Types
 * Source of Truth: fleet-PRD_V1.md, PRD Sections 4, 5, 6, 7, 9, 10, 13
 */

export enum Role {
  MASTER = "Bridge Team / Master",
  FLEET_OPS = "Fleet Operations Centre",
  AUDIT_OBSERVER = "Audit Observer",
}

export enum ConnectivityState {
  ONLINE = "ONLINE",
  OFFLINE = "OFFLINE",
  DEGRADED = "DEGRADED",
}

export interface ConstraintSnapshot {
  source: string;
  timestamp: string; // ISO 8601
  data: Record<string, any>;
  latency_minutes: number;
  is_stale: boolean;
}

export interface VesselEvent {
  event_id: string;
  source_system: string;
  original_timestamp: string;
  telemetry_payload: Record<string, any>;
  dedup_key: string;
  status: "PENDING" | "DEDUPLICATED" | "PROCESSED";
  vessel_id?: string;
  vessel_name?: string;
  disruption_type?: string;
  severity?: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
}

export interface ImpactAssessment {
  assessment_id: string;
  event_id: string;
  context_sources: ConstraintSnapshot[];
  summary: string;
  freshness_timestamp: string;
  eta_delay_hours?: number;
  fuel_impact_tons?: number;
  safety_risk_level?: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
  affected_cargo_value_usd?: number;
}

export interface RecoveryOptionMetrics {
  cost_delta_usd: number;
  fuel_delta_mt: number;
  eta_delta_hours: number;
  co2_delta_mt: number;
  risk_score: number; // 0-100
}

export interface RecoveryOption {
  option_id: string;
  assessment_id: string;
  title: string;
  description: string;
  route_strategy: "SPEED_INCREASE" | "WEATHER_REROUTE" | "ALTERNATE_PORT_DISCHARGE" | "DRIFT_HOLD" | "CANAL_EXPEDITE" | "MANUAL_NAV";
  constraints_used: ConstraintSnapshot[];
  missing_data_flags: string[]; // BR-04: Unavailable constraints exposed explicitly
  safety_constraint_override: boolean; // BR-03: Safety rules override commercial incentives
  freshness_timestamp: string;
  metrics: RecoveryOptionMetrics;
  recommended: boolean;
  ai_rationale?: string;
  alternate_waypoints?: Array<{ lat: number; lon: number; name: string }>;
}

export interface ApprovalRecord {
  record_id: string;
  option_id: string;
  role: string;
  user: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  timestamp: string;
  notes?: string;
}

export interface AuditEvent {
  audit_id: string;
  timestamp: string;
  actor: string;
  role: string;
  action: string;
  target: string;
  before_state: Record<string, any>;
  after_state: Record<string, any>;
  connectivity_state: string;
  material_versions: {
    app: string;
    policy: string;
    model: string;
  };
}

export interface Waypoint {
  lat: number;
  lon: number;
  name: string;
  status: "passed" | "current" | "upcoming" | "alternate";
}

export interface Vessel {
  id: string;
  name: string;
  imo: string;
  type: string;
  origin: string;
  destination: string;
  current_position: { lat: number; lon: number; name: string };
  speed_knots: number;
  heading: number;
  fuel_remaining_mt: number;
  cargo_summary: string;
  waypoints: Waypoint[];
  active_disruption?: string;
}

export interface Stage7TestResult {
  id: string;
  name: string;
  fr_ref: string;
  status: "PASSED" | "FAILED" | "RUNNING" | "PENDING";
  description: string;
  assertion: string;
  logs: string[];
  duration_ms: number;
}

export interface OrchestratorExportPayload {
  export_timestamp: string;
  material_versions: {
    app: string;
    policy: string;
    model: string;
  };
  events: Record<string, VesselEvent>;
  assessments: Record<string, ImpactAssessment>;
  options: Record<string, RecoveryOption>;
  executed_actions: string[];
  audit_log: AuditEvent[];
  connectivity: string;
}
