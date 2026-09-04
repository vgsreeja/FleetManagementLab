import React, { useState } from "react";
import {
  AlertTriangle,
  Radio,
  CheckCircle2,
  XCircle,
  Clock,
  Sparkles,
  Zap,
  ShieldCheck,
  ShieldAlert,
  ArrowRight,
  RefreshCw,
  Hash,
  Database,
  Gauge,
  Flame,
  DollarSign,
  TrendingDown,
  TrendingUp,
  FileWarning,
  Copy,
  Info,
  Ship,
  Check,
  Lock,
} from "lucide-react";
import {
  Role,
  ConnectivityState,
  Vessel,
  VesselEvent,
  ImpactAssessment,
  RecoveryOption,
  ApprovalRecord,
  ConstraintSnapshot,
} from "../types";

interface DisruptionConsoleProps {
  currentRole: Role;
  connectivity: ConnectivityState;
  selectedVessel: Vessel;
  events: VesselEvent[];
  assessments: ImpactAssessment[];
  options: RecoveryOption[];
  approvals: ApprovalRecord[];
  executedActionIds: string[];
  onIngestEvent: (event: Partial<VesselEvent>) => void;
  onReplayEvent: (event: VesselEvent) => void;
  onAssessImpact: (eventId: string, contextSources: ConstraintSnapshot[], useAi: boolean) => void;
  onGenerateOptions: (assessmentId: string, missingFlags: string[], useAi: boolean) => void;
  onApproveAndExecute: (optionId: string, notes?: string) => void;
  onOpenIngestModal: () => void;
  isProcessing: boolean;
}

export const DisruptionConsole: React.FC<DisruptionConsoleProps> = ({
  currentRole,
  connectivity,
  selectedVessel,
  events,
  assessments,
  options,
  approvals,
  executedActionIds,
  onIngestEvent,
  onReplayEvent,
  onAssessImpact,
  onGenerateOptions,
  onApproveAndExecute,
  onOpenIngestModal,
  isProcessing,
}) => {
  const [selectedEventId, setSelectedEventId] = useState<string>(
    events[0]?.event_id || ""
  );
  const [selectedAssessmentId, setSelectedAssessmentId] = useState<string>(
    assessments[0]?.assessment_id || ""
  );
  const [useAiForAssessment, setUseAiForAssessment] = useState<boolean>(true);
  const [useAiForOptions, setUseAiForOptions] = useState<boolean>(true);
  const [executionNote, setExecutionNote] = useState<string>("");
  const [copiedHash, setCopiedHash] = useState<string | null>(null);

  // Active event & assessment
  const activeEvent = events.find((e) => e.event_id === selectedEventId) || events[0];
  const activeAssessment = assessments.find(
    (a) => a.assessment_id === selectedAssessmentId || a.event_id === activeEvent?.event_id
  ) || assessments[0];

  const relevantOptions = options.filter(
    (o) => !activeAssessment || o.assessment_id === activeAssessment.assessment_id
  );

  const isMaster = currentRole === Role.MASTER;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(text);
    setTimeout(() => setCopiedHash(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Vessel Quick Telemetry Ribbon */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Ship className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  {selectedVessel.name}
                </h2>
                <span className="px-2 py-0.5 text-xs font-mono rounded bg-slate-800 text-slate-300 border border-slate-700">
                  {selectedVessel.imo}
                </span>
                <span className="px-2 py-0.5 text-xs rounded bg-blue-500/10 text-blue-300 border border-blue-500/20">
                  {selectedVessel.type}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Route: <span className="text-slate-200 font-medium">{selectedVessel.origin}</span> &rarr;{" "}
                <span className="text-slate-200 font-medium">{selectedVessel.destination}</span> | Current Position:{" "}
                <span className="text-blue-300 font-medium">{selectedVessel.current_position.name}</span> (
                {selectedVessel.current_position.lat.toFixed(2)}&deg;N, {selectedVessel.current_position.lon.toFixed(2)}&deg;E)
              </p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 text-xs">
            <div className="bg-slate-800/80 border border-slate-700/60 rounded-lg px-3 py-1.5">
              <span className="text-slate-400 block text-[11px]">Speed / Heading</span>
              <span className="font-semibold text-slate-200">
                {selectedVessel.speed_knots} kts / {selectedVessel.heading}&deg;
              </span>
            </div>
            <div className="bg-slate-800/80 border border-slate-700/60 rounded-lg px-3 py-1.5">
              <span className="text-slate-400 block text-[11px]">Fuel Remaining</span>
              <span className="font-semibold text-emerald-300">
                {selectedVessel.fuel_remaining_mt.toLocaleString()} MT
              </span>
            </div>
            <div className="bg-slate-800/80 border border-slate-700/60 rounded-lg px-3 py-1.5">
              <span className="text-slate-400 block text-[11px]">Disruption Status</span>
              <span className="font-semibold text-amber-300 flex items-center gap-1">
                <AlertTriangle className="w-3 h-3 text-amber-400" /> Active Alert
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Left Column (Events & Constraints) | Right Column (Impact & Recovery Actions) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Side: WF-01 Telemetry Ingestion & WF-02 Context Feeds */}
        <div className="lg:col-span-5 space-y-6">
          {/* WF-01: Disruption Event Detection & Idempotency */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                <h3 className="text-sm font-bold text-white tracking-wide flex items-center gap-1.5">
                  <span>WF-01: Disruption Feed & Ingestion</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                    FR-001 / BR-02
                  </span>
                </h3>
              </div>

              <div className="flex items-center gap-2">
                <button
                  id="simulate-disruption-btn"
                  onClick={onOpenIngestModal}
                  disabled={isProcessing}
                  className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white shadow-sm transition-colors"
                >
                  <Zap className="w-3 h-3" />
                  <span>Simulate Disruption</span>
                </button>
              </div>
            </div>

            {/* Event List / Selector */}
            <div className="space-y-2">
              {events.map((evt) => {
                const isSelected = evt.event_id === activeEvent?.event_id;
                return (
                  <div
                    key={evt.event_id}
                    onClick={() => setSelectedEventId(evt.event_id)}
                    className={`p-3 rounded-lg border transition-all cursor-pointer ${
                      isSelected
                        ? "bg-slate-800/90 border-blue-500/50 shadow-sm"
                        : "bg-slate-800/40 border-slate-800 hover:bg-slate-800/60"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={`px-1.5 py-0.5 text-[10px] font-bold rounded ${
                              evt.severity === "CRITICAL"
                                ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                                : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                            }`}
                          >
                            {evt.severity || "HIGH"}
                          </span>
                          <span className="text-xs font-bold text-slate-200">
                            {evt.disruption_type || "Vessel Sensor Anomaly"}
                          </span>
                          <span
                            className={`px-1.5 py-0.5 text-[10px] font-mono font-semibold rounded ${
                              evt.status === "PROCESSED"
                                ? "bg-emerald-500/10 text-emerald-300 border border-emerald-500/20"
                                : "bg-purple-500/10 text-purple-300 border border-purple-500/20"
                            }`}
                          >
                            {evt.status}
                          </span>
                        </div>
                        <p className="text-xs text-slate-400">
                          Source: <span className="text-slate-300 font-medium">{evt.source_system}</span> |{" "}
                          {new Date(evt.original_timestamp).toLocaleTimeString()}
                        </p>
                      </div>

                      {/* Replay button to test BR-02 Idempotency */}
                      <button
                        id={`replay-event-${evt.event_id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onReplayEvent(evt);
                        }}
                        title="Simulate At-Least-Once Delivery Replay (Tests Idempotency BR-02)"
                        className="flex items-center gap-1 px-2 py-1 text-[11px] font-mono rounded bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 transition-colors"
                      >
                        <RefreshCw className="w-3 h-3 text-amber-400" />
                        <span>Replay</span>
                      </button>
                    </div>

                    {/* Idempotency SHA-256 Key Badge */}
                    <div className="mt-2.5 pt-2 border-t border-slate-700/50 flex items-center justify-between text-[11px] font-mono text-slate-400">
                      <div className="flex items-center gap-1 truncate max-w-[280px]">
                        <Hash className="w-3 h-3 text-slate-500 shrink-0" />
                        <span className="text-slate-500">SHA256:</span>
                        <span className="text-slate-300 truncate">{evt.dedup_key}</span>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopy(evt.dedup_key);
                        }}
                        className="hover:text-blue-300 text-slate-400 shrink-0 ml-1"
                        title="Copy SHA-256 Key"
                      >
                        {copiedHash === evt.dedup_key ? (
                          <Check className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <Copy className="w-3 h-3" />
                        )}
                      </button>
                    </div>

                    {/* Telemetry Payload Breakdown */}
                    {isSelected && (
                      <div className="mt-2.5 p-2 bg-slate-950/60 rounded border border-slate-800 text-[11px] font-mono text-slate-300 space-y-1">
                        <div className="text-[10px] uppercase text-slate-500 font-semibold">
                          Decoded Telemetry Payload:
                        </div>
                        {Object.entries(evt.telemetry_payload).map(([k, v]) => (
                          <div key={k} className="flex justify-between">
                            <span className="text-slate-400">{k}:</span>
                            <span className="text-blue-300 font-semibold">{String(v)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* WF-02: Data & Provenance Context Snapshots */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-bold text-white tracking-wide flex items-center gap-1.5">
                  <span>WF-02: Context Feeds & Provenance</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                    PRD Sec 9
                  </span>
                </h3>
              </div>
            </div>

            <p className="text-xs text-slate-400">
              Retrieval-grounded constraints used for voyage impact scoring. Stale feeds (&gt;60m latency) are flagged before AI optimization.
            </p>

            <div className="space-y-2">
              {activeAssessment?.context_sources?.map((src, idx) => (
                <div
                  key={idx}
                  className={`p-2.5 rounded-lg border text-xs ${
                    src.is_stale || src.latency_minutes > 60
                      ? "bg-amber-950/20 border-amber-500/40 text-amber-200"
                      : "bg-slate-800/60 border-slate-700/60 text-slate-300"
                  }`}
                >
                  <div className="flex items-center justify-between font-semibold">
                    <span className="text-slate-100 flex items-center gap-1.5">
                      {src.source.includes("SAFETY") || src.source.includes("SOLAS") ? (
                        <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                      ) : src.source.includes("WEATHER") ? (
                        <Radio className="w-3.5 h-3.5 text-sky-400" />
                      ) : (
                        <Database className="w-3.5 h-3.5 text-slate-400" />
                      )}
                      {src.source}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 text-[10px] font-mono rounded font-medium ${
                        src.is_stale || src.latency_minutes > 60
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          : "bg-emerald-500/15 text-emerald-300 border border-emerald-500/20"
                      }`}
                    >
                      {src.latency_minutes}m latency {src.is_stale ? "(STALE)" : "(FRESH)"}
                    </span>
                  </div>

                  <div className="mt-1.5 text-[11px] font-mono bg-slate-950/40 p-1.5 rounded border border-slate-800/80 text-slate-400">
                    {Object.entries(src.data).map(([k, v]) => (
                      <span key={k} className="mr-3 inline-block">
                        <span className="text-slate-500">{k}:</span>{" "}
                        <span className="text-slate-300 font-medium">{String(v)}</span>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Impact Assessment Trigger */}
            <div className="pt-2 flex items-center justify-between gap-3">
              <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={useAiForAssessment}
                  onChange={(e) => setUseAiForAssessment(e.target.checked)}
                  className="rounded bg-slate-800 border-slate-700 text-blue-600 focus:ring-0"
                />
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                <span>AI Gemini 3.7 Grounding</span>
              </label>

              <button
                id="reassess-impact-btn"
                onClick={() => {
                  if (activeEvent) {
                    onAssessImpact(activeEvent.event_id, activeAssessment?.context_sources || [], useAiForAssessment);
                  }
                }}
                disabled={isProcessing || !activeEvent}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isProcessing ? "animate-spin" : ""}`} />
                <span>Re-Evaluate Impact</span>
              </button>
            </div>
          </div>
        </div>

        {/* Right Side: WF-02 Impact Assessment Card + WF-03 Recovery Options + WF-04 Master Approval */}
        <div className="lg:col-span-7 space-y-6">
          {/* WF-02: Impact Assessment Summary & Metrics */}
          {activeAssessment && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Gauge className="w-4 h-4 text-amber-400" />
                  <h3 className="text-sm font-bold text-white tracking-wide flex items-center gap-1.5">
                    <span>WF-02: Voyage Impact Assessment</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                      FR-002
                    </span>
                  </h3>
                </div>
                <span className="text-xs font-mono text-slate-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  Freshness: {new Date(activeAssessment.freshness_timestamp).toLocaleTimeString()}
                </span>
              </div>

              {/* Summary Text Box */}
              <div className="p-3.5 bg-slate-800/60 border border-slate-700/60 rounded-lg text-xs leading-relaxed text-slate-200">
                <p>{activeAssessment.summary}</p>
              </div>

              {/* Impact KPI Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-slate-800/80 border border-slate-700/70 rounded-lg p-2.5">
                  <span className="text-slate-400 text-[11px] block flex items-center gap-1">
                    <Clock className="w-3 h-3 text-amber-400" /> Projected ETA Delta
                  </span>
                  <span className="text-base font-bold text-amber-300 mt-0.5 block">
                    +{activeAssessment.eta_delay_hours || 44.5} hrs
                  </span>
                </div>

                <div className="bg-slate-800/80 border border-slate-700/70 rounded-lg p-2.5">
                  <span className="text-slate-400 text-[11px] block flex items-center gap-1">
                    <Flame className="w-3 h-3 text-rose-400" /> Fuel Burn Impact
                  </span>
                  <span className="text-base font-bold text-rose-300 mt-0.5 block">
                    +{activeAssessment.fuel_impact_tons || 142} MT
                  </span>
                </div>

                <div className="bg-slate-800/80 border border-slate-700/70 rounded-lg p-2.5">
                  <span className="text-slate-400 text-[11px] block flex items-center gap-1">
                    <ShieldAlert className="w-3 h-3 text-rose-400" /> Safety Risk
                  </span>
                  <span className="text-base font-bold text-rose-300 mt-0.5 block">
                    {activeAssessment.safety_risk_level || "HIGH"}
                  </span>
                </div>

                <div className="bg-slate-800/80 border border-slate-700/70 rounded-lg p-2.5">
                  <span className="text-slate-400 text-[11px] block flex items-center gap-1">
                    <DollarSign className="w-3 h-3 text-emerald-400" /> Cargo at Risk
                  </span>
                  <span className="text-base font-bold text-slate-100 mt-0.5 block">
                    ${((activeAssessment.affected_cargo_value_usd || 124500000) / 1e6).toFixed(1)}M
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* WF-03: Recovery Options Generator & Selection */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-bold text-white tracking-wide flex items-center gap-1.5">
                  <span>WF-03: Recovery Strategy Generation</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                    FR-003 / BR-03 / BR-04
                  </span>
                </h3>
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={useAiForOptions}
                    onChange={(e) => setUseAiForOptions(e.target.checked)}
                    className="rounded bg-slate-800 border-slate-700 text-blue-600 focus:ring-0"
                  />
                  <span>AI Gemini Multi-Scenario</span>
                </label>

                <button
                  id="generate-recovery-options-btn"
                  onClick={() => {
                    if (activeAssessment) {
                      onGenerateOptions(
                        activeAssessment.assessment_id,
                        ["BUNKER_FEED_STALE (180 min)", "CANAL_SLOT_UNCONFIRMED"],
                        useAiForOptions
                      );
                    }
                  }}
                  disabled={isProcessing || !activeAssessment}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isProcessing ? "animate-spin" : ""}`} />
                  <span>Synthesize Recovery Plans</span>
                </button>
              </div>
            </div>

            {/* List of Recovery Option Cards */}
            <div className="space-y-4">
              {relevantOptions.map((opt, idx) => {
                const isExecuted = executedActionIds.includes(opt.option_id);
                const approval = approvals.find((a) => a.option_id === opt.option_id);

                return (
                  <div
                    key={opt.option_id}
                    id={`recovery-option-card-${opt.option_id}`}
                    className={`rounded-xl border p-4.5 transition-all ${
                      isExecuted
                        ? "bg-emerald-950/20 border-emerald-500/40 shadow-sm"
                        : opt.recommended
                        ? "bg-slate-800/90 border-blue-500/50 shadow-md"
                        : "bg-slate-800/40 border-slate-700/60"
                    }`}
                  >
                    {/* Header Row of Option */}
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1 max-w-[75%]">
                        <div className="flex items-center gap-2 flex-wrap">
                          {opt.recommended && (
                            <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/40 flex items-center gap-1">
                              <Sparkles className="w-2.5 h-2.5" /> RECOMMENDED
                            </span>
                          )}
                          <span className="px-1.5 py-0.5 text-[10px] font-mono rounded bg-slate-900 text-slate-300 border border-slate-700">
                            {opt.route_strategy}
                          </span>
                          {/* BR-03: Safety Rule Override Indicator */}
                          {opt.safety_constraint_override && (
                            <span
                              title="BR-03: Safety constraints override commercial optimization."
                              className="px-2 py-0.5 text-[10px] font-bold rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1"
                            >
                              <ShieldCheck className="w-3 h-3 text-amber-400" />
                              BR-03 SAFETY OVERRIDE
                            </span>
                          )}
                        </div>

                        <h4 className="text-sm font-bold text-white">{opt.title}</h4>
                        <p className="text-xs text-slate-300 leading-relaxed">{opt.description}</p>
                      </div>

                      {/* Status / Execution Tag */}
                      <div>
                        {isExecuted ? (
                          <div className="flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-xs font-bold font-mono">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span>EXECUTED</span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 font-mono">
                            Risk Score: <span className="font-bold text-slate-200">{opt.metrics.risk_score}/100</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* BR-04: Missing Data & Unavailable Constraint Flags */}
                    {opt.missing_data_flags && opt.missing_data_flags.length > 0 && (
                      <div className="mt-3 p-2.5 bg-rose-950/30 border border-rose-500/30 rounded-lg flex items-start gap-2 text-xs text-rose-200">
                        <FileWarning className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                        <div>
                          <span className="font-semibold text-rose-300">
                            BR-04 Unavailable Constraint Flags:
                          </span>{" "}
                          {opt.missing_data_flags.map((flag, i) => (
                            <span
                              key={i}
                              className="inline-block font-mono text-[10px] px-1.5 py-0.5 rounded bg-rose-900/60 border border-rose-500/30 text-rose-200 mr-1.5 mt-0.5"
                            >
                              {flag}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Metric Comparison Badges */}
                    <div className="mt-3.5 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div className="bg-slate-900/80 p-2 rounded border border-slate-700/60">
                        <span className="text-slate-400 text-[10px] block">Cost Delta</span>
                        <span
                          className={`font-mono font-bold ${
                            opt.metrics.cost_delta_usd > 100000 ? "text-rose-300" : "text-emerald-300"
                          }`}
                        >
                          {opt.metrics.cost_delta_usd >= 0 ? "+" : ""}$
                          {opt.metrics.cost_delta_usd.toLocaleString()}
                        </span>
                      </div>

                      <div className="bg-slate-900/80 p-2 rounded border border-slate-700/60">
                        <span className="text-slate-400 text-[10px] block">Fuel Burn Delta</span>
                        <span className="font-mono font-bold text-slate-200">
                          {opt.metrics.fuel_delta_mt >= 0 ? "+" : ""}
                          {opt.metrics.fuel_delta_mt} MT
                        </span>
                      </div>

                      <div className="bg-slate-900/80 p-2 rounded border border-slate-700/60">
                        <span className="text-slate-400 text-[10px] block">ETA Delta</span>
                        <span className="font-mono font-bold text-amber-300">
                          {opt.metrics.eta_delta_hours >= 0 ? "+" : ""}
                          {opt.metrics.eta_delta_hours}h
                        </span>
                      </div>

                      <div className="bg-slate-900/80 p-2 rounded border border-slate-700/60">
                        <span className="text-slate-400 text-[10px] block">CO2 Emissions</span>
                        <span className="font-mono font-bold text-slate-300">
                          {opt.metrics.co2_delta_mt >= 0 ? "+" : ""}
                          {opt.metrics.co2_delta_mt} MT
                        </span>
                      </div>
                    </div>

                    {/* AI Rationale */}
                    {opt.ai_rationale && (
                      <div className="mt-3 text-xs text-slate-300 bg-slate-950/50 p-2.5 rounded border border-slate-800/80">
                        <span className="text-blue-400 font-semibold">AI Operational Rationale: </span>
                        {opt.ai_rationale}
                      </div>
                    )}

                    {/* WF-04 Master Approval Execution Gate (BR-01, FR-004, FR-005) */}
                    <div className="mt-4 pt-3 border-t border-slate-700/50 flex flex-wrap items-center justify-between gap-3">
                      <div className="text-xs text-slate-400 flex items-center gap-1.5">
                        <ShieldAlert className="w-3.5 h-3.5 text-blue-400" />
                        <span>
                          Authority Gate:{" "}
                          <span className="text-slate-200 font-semibold">
                            {isMaster ? "Authorized (Master)" : "Restricted (Requires Master Role)"}
                          </span>
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {isExecuted ? (
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-emerald-400">
                              Approved by {approval?.user || "Master"}
                            </span>
                            <button
                              id={`replay-approval-${opt.option_id}`}
                              onClick={() => onApproveAndExecute(opt.option_id, "Replay test")}
                              title="Tests Idempotency (FR-005) on replayed approval"
                              className="px-2.5 py-1 text-xs font-mono rounded bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
                            >
                              Test Replay Approval
                            </button>
                          </div>
                        ) : (
                          <button
                            id={`approve-execute-btn-${opt.option_id}`}
                            onClick={() => onApproveAndExecute(opt.option_id, executionNote)}
                            disabled={isProcessing}
                            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold shadow-md transition-all ${
                              isMaster
                                ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                                : "bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700 cursor-not-allowed"
                            }`}
                          >
                            {isMaster ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                                <span>Master Approve & Execute Order</span>
                              </>
                            ) : (
                              <>
                                <Lock className="w-3.5 h-3.5" />
                                <span>Master Authority Required to Execute</span>
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
