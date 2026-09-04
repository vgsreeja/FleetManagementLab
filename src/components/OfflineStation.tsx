import React, { useState } from "react";
import {
  HardDrive,
  WifiOff,
  Radio,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  Send,
  CheckCircle2,
  Lock,
  RotateCw,
  FileCode,
  Clock,
} from "lucide-react";
import { Role, ConnectivityState, AuditEvent } from "../types";

interface OfflineStationProps {
  currentRole: Role;
  connectivity: ConnectivityState;
  onExecuteFallback: (description: string) => void;
  auditLog: AuditEvent[];
  executedActionIds: string[];
  isProcessing: boolean;
  onReplayEvent?: (event: any) => void;
}

export const OfflineStation: React.FC<OfflineStationProps> = ({
  currentRole,
  connectivity,
  onExecuteFallback,
  auditLog,
  executedActionIds,
  isProcessing,
}) => {
  const [customActionDesc, setCustomActionDesc] = useState<string>("");
  const [lastSyncTime, setLastSyncTime] = useState<string>(new Date().toLocaleTimeString());
  const [isManualSyncing, setIsManualSyncing] = useState<boolean>(false);

  const isMaster = currentRole === Role.MASTER;
  const isOffline = connectivity === ConnectivityState.OFFLINE;

  const predefinedActions = [
    "Emergency Course Alteration 20° Port to clear localized gale system & navigate clear of shoals (SOLAS V/Reg 34)",
    "Immediate Engine Derating to 55% MCR (72 RPM) to suppress critical turbocharger bearing vibration",
    "Independent Master Haven Entry Order into Port of Salalah Anchorage for emergency bunker & class inspection",
    "Ballast Water Sequence Alteration to counter adverse 6.5m swell moments in Sector 4",
  ];

  const manualActions = auditLog.filter(
    (a) => a.action === "MANUAL_FALLBACK_EXECUTED" || a.target.startsWith("MANUAL-")
  );

  const triggerSync = () => {
    setIsManualSyncing(true);
    setTimeout(() => {
      setLastSyncTime(new Date().toLocaleTimeString());
      setIsManualSyncing(false);
    }, 600);
  };

  return (
    <div className="space-y-6">
      {/* Offline Continuity Status Banner */}
      <div
        className={`rounded-xl border p-5 transition-all ${
          isOffline
            ? "bg-rose-950/20 border-rose-500/40 text-rose-200"
            : "bg-slate-900 border-slate-800 text-slate-200"
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div
              className={`w-11 h-11 rounded-lg flex items-center justify-center border shadow-inner ${
                isOffline
                  ? "bg-rose-600/20 border-rose-500/40 text-rose-400"
                  : "bg-amber-600/20 border-amber-500/40 text-amber-400"
              }`}
            >
              {isOffline ? <WifiOff className="w-6 h-6" /> : <HardDrive className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">
                  WF-05 / WF-06: Vessel-Side Autonomous Offline Continuity
                </h3>
                <span className="px-2 py-0.5 text-xs font-mono font-bold rounded bg-slate-800 text-slate-300 border border-slate-700">
                  FR-006 / FR-008 / BR-05
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                Business Rule 05 (BR-05): Cloud/AI or satellite link unavailability must never degrade safe navigation. Bridge Team retains sovereign local fallback execution authority.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="text-slate-400">Current Satellite Status:</span>
            <span
              className={`px-2.5 py-1 rounded font-bold border ${
                isOffline
                  ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                  : connectivity === ConnectivityState.DEGRADED
                  ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                  : "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
              }`}
            >
              {connectivity}
            </span>
          </div>
        </div>
      </div>

      {/* Manual Fallback Command Console */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Action Dispatcher */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <h4 className="text-sm font-bold text-white tracking-wide">
                  Master Fallback Navigational Order
                </h4>
              </div>
              <span className="text-xs font-mono text-slate-400">
                STCW Master Authority Gate
              </span>
            </div>

            {/* Predefined Quick Actions */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-300 block">
                Quick Safe Navigation Actions:
              </label>
              {predefinedActions.map((act, i) => (
                <button
                  key={i}
                  id={`quick-fallback-btn-${i}`}
                  onClick={() => onExecuteFallback(act)}
                  disabled={isProcessing}
                  className="w-full text-left p-3 rounded-lg bg-slate-800/70 hover:bg-slate-800 border border-slate-700/60 text-xs text-slate-200 transition-colors flex items-center justify-between gap-3 group"
                >
                  <span className="leading-relaxed">{act}</span>
                  <span className="shrink-0 px-2 py-1 rounded text-[11px] font-mono font-semibold bg-emerald-600/20 border border-emerald-500/30 text-emerald-300 group-hover:bg-emerald-600 group-hover:text-white transition-all">
                    Execute
                  </span>
                </button>
              ))}
            </div>

            {/* Custom Manual Directive */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <label className="text-xs font-semibold text-slate-300 block">
                Custom Local Navigational Directive:
              </label>
              <div className="flex gap-2">
                <textarea
                  id="custom-fallback-input"
                  rows={2}
                  value={customActionDesc}
                  onChange={(e) => setCustomActionDesc(e.target.value)}
                  placeholder="Enter bespoke navigational order, engine restriction, or safe harbor diversion..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-between items-center pt-1">
                <div className="text-[11px] text-slate-400 flex items-center gap-1">
                  {isMaster ? (
                    <span className="text-emerald-400 flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" /> Logged under Master Authority
                    </span>
                  ) : (
                    <span className="text-amber-400 flex items-center gap-1">
                      <Lock className="w-3.5 h-3.5" /> Master Role Required (Negative tests enforced)
                    </span>
                  )}
                </div>

                <button
                  id="submit-custom-fallback-btn"
                  onClick={() => {
                    if (customActionDesc.trim()) {
                      onExecuteFallback(customActionDesc.trim());
                      setCustomActionDesc("");
                    }
                  }}
                  disabled={isProcessing || !customActionDesc.trim()}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                    customActionDesc.trim()
                      ? "bg-blue-600 hover:bg-blue-500 text-white shadow-md"
                      : "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700"
                  }`}
                >
                  <Send className="w-3 h-3" />
                  <span>Dispatch Directive</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Local Synchronisation Queue & Logs */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileCode className="w-4 h-4 text-amber-400" />
                <h4 className="text-sm font-bold text-white tracking-wide">
                  Local Queue & Shore Ledger Sync
                </h4>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                  {manualActions.length} Local Actions
                </span>
              </div>
            </div>

            {/* Live Reconnect Sync Status Banner */}
            <div
              className={`p-3.5 rounded-lg border text-xs space-y-2 transition-all ${
                isOffline
                  ? "bg-rose-950/30 border-rose-500/30 text-rose-300"
                  : "bg-emerald-950/30 border-emerald-500/30 text-emerald-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-semibold">
                  {isOffline ? (
                    <>
                      <WifiOff className="w-4 h-4 text-rose-400 shrink-0" />
                      <span>OFFLINE: Queued to Local Cryptographic Cache</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span>ONLINE: Reconciled with Central Shore Ledger</span>
                    </>
                  )}
                </div>

                {!isOffline && (
                  <button
                    onClick={triggerSync}
                    disabled={isManualSyncing}
                    className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-mono bg-emerald-600/30 border border-emerald-500/40 text-emerald-200 hover:bg-emerald-600/50 transition-colors"
                  >
                    <RotateCw className={`w-3 h-3 ${isManualSyncing ? "animate-spin" : ""}`} />
                    <span>{isManualSyncing ? "Syncing..." : "Sync Now"}</span>
                  </button>
                )}
              </div>

              <div className="text-[11px] font-mono text-slate-400 flex flex-wrap justify-between pt-1 border-t border-slate-800">
                <span>Sync Protocol: <strong>TLS 1.3 / Idempotent REST</strong></span>
                <span>Last Shore Sync: <strong className="text-slate-300">{isOffline ? "Pending Satellite Reconnect" : lastSyncTime}</strong></span>
              </div>
            </div>

            <p className="text-xs text-slate-400">
              Actions executed locally during offline or degraded states are tagged with prefix <code className="text-amber-300">MANUAL-*</code> and reconciled into the shore audit ledger with timestamps upon reconnection.
            </p>

            <div className="space-y-2.5 max-h-[340px] overflow-y-auto pr-1">
              {manualActions.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 border border-dashed border-slate-800 rounded-lg">
                  No manual fallback actions executed in this session yet. Use the Left Console to dispatch an order.
                </div>
              ) : (
                manualActions.map((evt) => (
                  <div
                    key={evt.audit_id}
                    className="p-3 bg-slate-800/80 border border-slate-700/60 rounded-lg text-xs space-y-1.5"
                  >
                    <div className="flex items-center justify-between text-[11px] font-mono">
                      <span className="text-amber-300 font-bold">{evt.target}</span>
                      <span className="text-slate-400">
                        {new Date(evt.timestamp).toLocaleTimeString()}
                      </span>
                    </div>
                    <p className="text-slate-200 text-xs">
                      {evt.after_state?.description || "Manual navigation order"}
                    </p>
                    <div className="pt-1 border-t border-slate-700/50 flex justify-between text-[10px] text-slate-400">
                      <span>Actor: <strong className="text-slate-300">{evt.actor}</strong></span>
                      <span>
                        Sync State:{" "}
                        <strong className={isOffline ? "text-amber-400" : "text-emerald-400"}>
                          {isOffline ? "QUEUED (LOCAL STORAGE)" : "RECONCILED ON SHORE"}
                        </strong>
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Step-by-Step Offline & Online Simulation Guide */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-sm space-y-3 text-xs">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-blue-400" />
            <h4 className="text-sm font-bold text-white tracking-wide">
              Step-by-Step Simulation Workflow: Satellite Blackout &rarr; Local Fallback &rarr; Online Ledger Reconciliation
            </h4>
          </div>
          <span className="px-2 py-0.5 font-mono text-[10px] rounded bg-blue-500/10 text-blue-300 border border-blue-500/20">
            WF-05 / WF-06 / BR-05 Reference Guide
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
          <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800/80 space-y-1.5">
            <div className="flex items-center gap-1.5 text-rose-400 font-bold">
              <span className="w-5 h-5 rounded-full bg-rose-500/20 flex items-center justify-center text-[10px] border border-rose-500/30">1</span>
              <span>Sever Satellite Link (Offline)</span>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Click the <strong>Satellite Status badge</strong> in the top header or banner to switch to <code className="text-rose-300">OFFLINE</code>. Cloud AI and shore coordination are now disconnected.
            </p>
          </div>

          <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800/80 space-y-1.5">
            <div className="flex items-center gap-1.5 text-amber-400 font-bold">
              <span className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center text-[10px] border border-amber-500/30">2</span>
              <span>Execute Local Orders (Master)</span>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Under <strong>Master Authority</strong>, dispatch a local navigation fallback order. Notice the new order is tagged <code className="text-amber-300">MANUAL-*</code> and marked <code className="text-amber-400">QUEUED (LOCAL STORAGE)</code>.
            </p>
          </div>

          <div className="p-3 bg-slate-950/80 rounded-lg border border-slate-800/80 space-y-1.5">
            <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
              <span className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-[10px] border border-emerald-500/30">3</span>
              <span>Restore Link & Verify Sync</span>
            </div>
            <p className="text-slate-400 text-[11px] leading-relaxed">
              Switch connectivity back to <code className="text-emerald-300">ONLINE</code>. The status transitions to <code className="text-emerald-400">RECONCILED ON SHORE</code>, and the entry appears in the <strong>Audit Ledger</strong> tab with timestamps and state diffs.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
