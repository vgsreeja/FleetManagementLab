import React, { useState, useEffect, useCallback } from "react";
import {
  Role,
  ConnectivityState,
  Vessel,
  VesselEvent,
  ImpactAssessment,
  RecoveryOption,
  ApprovalRecord,
  AuditEvent,
  Stage7TestResult,
} from "./types";
import { Header } from "./components/Header";
import { DisruptionConsole } from "./components/DisruptionConsole";
import { NauticalMap } from "./components/NauticalMap";
import { OfflineStation } from "./components/OfflineStation";
import { Stage7Harness } from "./components/Stage7Harness";
import { AuditLedger } from "./components/AuditLedger";
import { IngestEventModal } from "./components/IngestEventModal";
import { ConnectivityModal } from "./components/ConnectivityModal";
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Info,
  ShieldAlert,
  WifiOff,
} from "lucide-react";

export default function App() {
  // State
  const [currentRole, setCurrentRole] = useState<Role>(Role.MASTER);
  const [activeTab, setActiveTab] = useState<"console" | "map" | "offline" | "stage7" | "audit">("console");
  const [selectedVesselId, setSelectedVesselId] = useState<string>("VESSEL-001");

  const [connectivity, setConnectivity] = useState<ConnectivityState>(ConnectivityState.ONLINE);
  const [networkLatencyMs, setNetworkLatencyMs] = useState<number>(45);

  const [vessels, setVessels] = useState<Vessel[]>([]);
  const [events, setEvents] = useState<VesselEvent[]>([]);
  const [assessments, setAssessments] = useState<ImpactAssessment[]>([]);
  const [options, setOptions] = useState<RecoveryOption[]>([]);
  const [approvals, setApprovals] = useState<ApprovalRecord[]>([]);
  const [executedActionIds, setExecutedActionIds] = useState<string[]>([]);
  const [auditLog, setAuditLog] = useState<AuditEvent[]>([]);
  const [versions, setVersions] = useState({
    app: "1.0.0-synthetic",
    policy: "POL-2026-08",
    model: "fleet-assist-v1",
  });

  // Stage 7 state
  const [stage7Results, setStage7Results] = useState<Stage7TestResult[]>([]);
  const [isRunningStage7, setIsRunningStage7] = useState<boolean>(false);
  const [stage7Passed, setStage7Passed] = useState<boolean | undefined>(undefined);
  const [totalAudit, setTotalAudit] = useState<number>(0);
  const [totalActions, setTotalActions] = useState<number>(0);

  // Modals
  const [isIngestModalOpen, setIsIngestModalOpen] = useState<boolean>(false);
  const [isConnModalOpen, setIsConnModalOpen] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);

  // Toast Notification
  const [toast, setToast] = useState<{
    message: string;
    type: "success" | "error" | "info" | "warning";
  } | null>(null);

  const showToast = (message: string, type: "success" | "error" | "info" | "warning" = "info") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4500);
  };

  // Fetch Full State from Backend
  const fetchState = useCallback(async () => {
    try {
      const res = await fetch("/api/state");
      if (!res.ok) throw new Error("Failed to fetch backend state");
      const data = await res.json();
      setVessels(data.vessels || []);
      setEvents(data.events || []);
      setAssessments(data.assessments || []);
      setOptions(data.options || []);
      setApprovals(data.approvals || []);
      setExecutedActionIds(data.executed_actions || []);
      setAuditLog(data.audit_log || []);
      setConnectivity(data.connectivity || ConnectivityState.ONLINE);
      setNetworkLatencyMs(data.networkLatencyMs || 45);
      if (data.versions) setVersions(data.versions);
    } catch (err: any) {
      console.error("Error fetching state:", err);
    }
  }, []);

  useEffect(() => {
    fetchState();
  }, [fetchState]);

  // Selected Vessel
  const selectedVessel = vessels.find((v) => v.id === selectedVesselId) || vessels[0] || {
    id: "VESSEL-001",
    name: "MV Pacific Horizon",
    imo: "IMO 9876543",
    type: "Ultra Large Container Vessel",
    origin: "Shanghai",
    destination: "Rotterdam",
    current_position: { lat: 12.35, lon: 43.42, name: "Bab-el-Mandeb" },
    speed_knots: 19.4,
    heading: 312,
    fuel_remaining_mt: 3420,
    cargo_summary: "High-value containerized goods",
    waypoints: [],
  };

  // 1. Ingest Event (WF-01, FR-001, BR-02)
  const handleIngestEvent = async (eventPayload: Partial<VesselEvent>) => {
    setIsProcessing(true);
    try {
      const res = await fetch("/api/events/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: eventPayload,
          actor: currentRole === Role.MASTER ? "Master C. Vance" : "FleetOps Specialist",
          role: currentRole,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to ingest event");

      await fetchState();
      showToast(
        `Event ${data.event.event_id} status: ${data.event.status} (SHA256: ${data.event.dedup_key.slice(0, 10)}...)`,
        data.event.status === "DEDUPLICATED" ? "warning" : "success"
      );
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setIsProcessing(false);
    }
  };

  // Replay Event to test BR-02 Idempotency
  const handleReplayEvent = async (event: VesselEvent) => {
    setIsProcessing(true);
    try {
      const res = await fetch("/api/events/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: {
            event_id: event.event_id,
            source_system: event.source_system,
            original_timestamp: event.original_timestamp,
            telemetry_payload: event.telemetry_payload,
            dedup_key: event.dedup_key,
            vessel_id: event.vessel_id,
            vessel_name: event.vessel_name,
            disruption_type: event.disruption_type,
            severity: event.severity,
          },
          actor: currentRole === Role.MASTER ? "Master C. Vance" : "Network Replay Simulator",
          role: currentRole,
        }),
      });
      const data = await res.json();
      await fetchState();

      if (data.event?.status === "DEDUPLICATED") {
        showToast(
          `BR-02 Idempotency Verified: Duplicate event ${event.event_id} safely deduplicated! 0 duplicate actions triggered.`,
          "success"
        );
      } else {
        showToast(`Event re-ingested status: ${data.event?.status}`, "info");
      }
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setIsProcessing(false);
    }
  };

  // 2. Assess Impact (WF-02, FR-002)
  const handleAssessImpact = async (eventId: string, contextSources: any[], useAi: boolean) => {
    setIsProcessing(true);
    try {
      const res = await fetch("/api/assessments/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_id: eventId,
          context_sources: contextSources,
          actor: currentRole === Role.MASTER ? "Master C. Vance" : "FleetOps Specialist",
          role: currentRole,
          use_ai: useAi,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to assess impact");

      await fetchState();
      showToast("Voyage Impact Assessment generated with retrieval-grounded sources.", "success");
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setIsProcessing(false);
    }
  };

  // 3. Generate Recovery Options (WF-03, FR-003, BR-03, BR-04)
  const handleGenerateOptions = async (assessmentId: string, missingFlags: string[], useAi: boolean) => {
    setIsProcessing(true);
    try {
      const res = await fetch("/api/options/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assessment_id: assessmentId,
          missing_data: missingFlags,
          actor: currentRole === Role.MASTER ? "Master C. Vance" : "Fleet Operations AI",
          role: currentRole,
          use_ai: useAi,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate options");

      await fetchState();
      showToast("Recovery options synthesized with BR-03 safety overrides & BR-04 missing constraint flags.", "success");
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setIsProcessing(false);
    }
  };

  // 4. Master Approve & Execute (WF-04, FR-004, FR-005, BR-01)
  const handleApproveAndExecute = async (optionId: string, notes?: string) => {
    setIsProcessing(true);
    try {
      const res = await fetch("/api/approvals/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          option_id: optionId,
          actor: currentRole === Role.MASTER ? "Master C. Vance" : "Unauthorized Actor",
          role: currentRole,
          notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Execution failed");

      await fetchState();
      if (data.status === "SKIPPED_IDEMPOTENT") {
        showToast(
          "FR-005 Idempotency: Replayed approval skipped. Duplicate action prevented.",
          "info"
        );
      } else {
        showToast(
          "Navigational execution approved & dispatched under Master Authority (BR-01 / FR-004).",
          "success"
        );
      }
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setIsProcessing(false);
    }
  };

  // 5. Manual Fallback Navigation (WF-05/06, FR-006, FR-008, NFR-001, BR-05)
  const handleExecuteFallback = async (description: string) => {
    setIsProcessing(true);
    try {
      const res = await fetch("/api/fallback/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action_description: description,
          actor: currentRole === Role.MASTER ? "Master C. Vance" : "FleetOps Specialist",
          role: currentRole,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Fallback execution rejected");

      await fetchState();
      showToast(`Autonomous local fallback action executed: ${data.action_id}`, "success");
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setIsProcessing(false);
    }
  };

  // Update Connectivity Simulation
  const handleUpdateConnectivity = async (state: ConnectivityState, latencyMs: number) => {
    try {
      const res = await fetch("/api/connectivity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          state,
          latencyMs,
          actor: currentRole === Role.MASTER ? "Master C. Vance" : "FleetOps Communications",
          role: currentRole,
        }),
      });
      const data = await res.json();
      setConnectivity(data.connectivity);
      setNetworkLatencyMs(data.networkLatencyMs);
      await fetchState();
      showToast(`Connectivity switched to ${data.connectivity} (${data.networkLatencyMs}ms)`, "info");
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  // Run Stage 7 Hard Gates Suite (PRD Sec 10, 13)
  const handleRunStage7 = async () => {
    setIsRunningStage7(true);
    try {
      const res = await fetch("/api/evaluations/run", {
        method: "POST",
      });
      const data = await res.json();
      setStage7Results(data.results || []);
      setStage7Passed(data.passed);
      setTotalAudit(data.totalAudit || 0);
      setTotalActions(data.totalActions || 0);
      await fetchState();

      if (data.passed) {
        showToast("Stage 7 Hard Gates: ALL 5 TEST GATES PASSED (100% compliant)!", "success");
      } else {
        showToast("Stage 7 Hard Gates encountered test failures.", "error");
      }
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setIsRunningStage7(false);
    }
  };

  // Export State (FR-010)
  const handleExportState = () => {
    window.open(`/api/export?actor=Auditor&role=${currentRole}`, "_blank");
    showToast("Exporting comprehensive state payload (FR-010)...", "info");
  };

  // Reset Scenario
  const handleResetScenario = async () => {
    try {
      await fetch("/api/reset", { method: "POST" });
      await fetchState();
      setStage7Results([]);
      setStage7Passed(undefined);
      showToast("Scenario reset to reference baseline.", "info");
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
      {/* Toast Notification Banner */}
      {toast && (
        <div className="fixed top-14 right-4 z-50 animate-in fade-in slide-in-from-top-4 duration-200">
          <div
            className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl shadow-2xl border text-xs font-semibold backdrop-blur-md ${
              toast.type === "success"
                ? "bg-emerald-950/90 border-emerald-500/50 text-emerald-200"
                : toast.type === "error"
                ? "bg-rose-950/90 border-rose-500/50 text-rose-200"
                : toast.type === "warning"
                ? "bg-amber-950/90 border-amber-500/50 text-amber-200"
                : "bg-blue-950/90 border-blue-500/50 text-blue-200"
            }`}
          >
            {toast.type === "success" && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />}
            {toast.type === "error" && <XCircle className="w-4 h-4 text-rose-400 shrink-0" />}
            {toast.type === "warning" && <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />}
            {toast.type === "info" && <Info className="w-4 h-4 text-blue-400 shrink-0" />}
            <span>{toast.message}</span>
          </div>
        </div>
      )}

      {/* Main Header */}
      <Header
        currentRole={currentRole}
        onRoleChange={setCurrentRole}
        connectivity={connectivity}
        networkLatencyMs={networkLatencyMs}
        onOpenConnectivityModal={() => setIsConnModalOpen(true)}
        vessels={vessels}
        selectedVesselId={selectedVesselId}
        onSelectVessel={setSelectedVesselId}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        onRunStage7={handleRunStage7}
        onExportState={handleExportState}
        onResetScenario={handleResetScenario}
        isRunningStage7={isRunningStage7}
        stage7Passed={stage7Passed}
      />

      {/* Main Content Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {activeTab === "console" && (
          <DisruptionConsole
            currentRole={currentRole}
            connectivity={connectivity}
            selectedVessel={selectedVessel}
            events={events}
            assessments={assessments}
            options={options}
            approvals={approvals}
            executedActionIds={executedActionIds}
            onIngestEvent={handleIngestEvent}
            onReplayEvent={handleReplayEvent}
            onAssessImpact={handleAssessImpact}
            onGenerateOptions={handleGenerateOptions}
            onApproveAndExecute={handleApproveAndExecute}
            onOpenIngestModal={() => setIsIngestModalOpen(true)}
            isProcessing={isProcessing}
          />
        )}

        {activeTab === "map" && (
          <NauticalMap
            vessel={selectedVessel}
            options={options}
            executedActionIds={executedActionIds}
          />
        )}

        {activeTab === "offline" && (
          <OfflineStation
            currentRole={currentRole}
            connectivity={connectivity}
            onExecuteFallback={handleExecuteFallback}
            auditLog={auditLog}
            executedActionIds={executedActionIds}
            isProcessing={isProcessing}
          />
        )}

        {activeTab === "stage7" && (
          <Stage7Harness
            results={stage7Results}
            isRunning={isRunningStage7}
            onRunTests={handleRunStage7}
            passed={stage7Passed}
            totalAudit={totalAudit}
            totalActions={totalActions}
          />
        )}

        {activeTab === "audit" && (
          <AuditLedger
            auditLog={auditLog}
            versions={versions}
            onExport={handleExportState}
          />
        )}
      </main>

      {/* Modals */}
      <IngestEventModal
        isOpen={isIngestModalOpen}
        onClose={() => setIsIngestModalOpen(false)}
        selectedVessel={selectedVessel}
        onIngest={handleIngestEvent}
      />

      <ConnectivityModal
        isOpen={isConnModalOpen}
        onClose={() => setIsConnModalOpen(false)}
        currentConnectivity={connectivity}
        networkLatencyMs={networkLatencyMs}
        onUpdateConnectivity={handleUpdateConnectivity}
        currentRole={currentRole}
      />

      {/* Footer Status Bar */}
      <footer className="bg-slate-900/90 border-t border-slate-800/80 py-3 text-[11px] text-slate-500 text-center font-mono">
        <div className="max-w-7xl mx-auto px-4 flex flex-wrap justify-between items-center gap-2">
          <span>
            Upstream PRD: <strong className="text-slate-400">fleet-PRD_V1.md (Stages 1-8)</strong> &bull; Maritime Authority Engine
          </span>
          <span className="text-slate-400">
            SOLAS V/Reg 34 &bull; STCW VIII/2 &bull; MLC 2006 &bull; SHA-256 Idempotency
          </span>
        </div>
      </footer>
    </div>
  );
}
