import React from "react";
import {
  Anchor,
  Shield,
  Radio,
  Wifi,
  WifiOff,
  AlertTriangle,
  Play,
  Download,
  RotateCcw,
  Compass,
  FileCheck2,
  HardDrive,
  Activity,
  Layers,
} from "lucide-react";
import { Role, ConnectivityState, Vessel } from "../types";

interface HeaderProps {
  currentRole: Role;
  onRoleChange: (role: Role) => void;
  connectivity: ConnectivityState;
  networkLatencyMs: number;
  onOpenConnectivityModal: () => void;
  vessels: Vessel[];
  selectedVesselId: string;
  onSelectVessel: (vesselId: string) => void;
  activeTab: "console" | "map" | "offline" | "stage7" | "audit";
  onTabChange: (tab: "console" | "map" | "offline" | "stage7" | "audit") => void;
  onRunStage7: () => void;
  onExportState: () => void;
  onResetScenario: () => void;
  isRunningStage7: boolean;
  stage7Passed?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  currentRole,
  onRoleChange,
  connectivity,
  networkLatencyMs,
  onOpenConnectivityModal,
  vessels,
  selectedVesselId,
  onSelectVessel,
  activeTab,
  onTabChange,
  onRunStage7,
  onExportState,
  onResetScenario,
  isRunningStage7,
  stage7Passed,
}) => {
  const selectedVessel = vessels.find((v) => v.id === selectedVesselId) || vessels[0];

  const getRoleBadgeStyle = (role: Role) => {
    switch (role) {
      case Role.MASTER:
        return "bg-emerald-950/80 border-emerald-500/40 text-emerald-300";
      case Role.FLEET_OPS:
        return "bg-sky-950/80 border-sky-500/40 text-sky-300";
      case Role.AUDIT_OBSERVER:
        return "bg-amber-950/80 border-amber-500/40 text-amber-300";
    }
  };

  const getConnectivityBadge = () => {
    switch (connectivity) {
      case ConnectivityState.ONLINE:
        return {
          icon: <Wifi className="w-3.5 h-3.5 text-emerald-400" />,
          label: `ONLINE (${networkLatencyMs}ms)`,
          bg: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20",
        };
      case ConnectivityState.DEGRADED:
        return {
          icon: <Radio className="w-3.5 h-3.5 text-amber-400 animate-pulse" />,
          label: `DEGRADED (${networkLatencyMs}ms)`,
          bg: "bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20",
        };
      case ConnectivityState.OFFLINE:
        return {
          icon: <WifiOff className="w-3.5 h-3.5 text-rose-400" />,
          label: "OFFLINE (SAT-DISCONNECTED)",
          bg: "bg-rose-500/10 border-rose-500/30 text-rose-300 hover:bg-rose-500/20",
        };
    }
  };

  const connBadge = getConnectivityBadge();

  return (
    <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-40 text-slate-100 shadow-md">
      {/* Top Banner Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2.5 flex flex-wrap items-center justify-between gap-3">
        {/* Left: Branding & IMO context */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-600/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shadow-inner">
            <Anchor className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-1.5">
                FleetVoyage Orchestrator
              </h1>
              <span className="px-1.5 py-0.5 text-[10px] font-mono tracking-wider font-semibold rounded bg-blue-500/15 border border-blue-400/30 text-blue-300">
                PRD-V1 STAGE 1-8
              </span>
            </div>
            <p className="text-xs text-slate-400">
              AI Disruption Recovery & Navigational Authority Engine
            </p>
          </div>
        </div>

        {/* Center: Vessel & Role Selectors */}
        <div className="flex items-center flex-wrap gap-2.5">
          {/* Active Vessel Selector */}
          <div className="flex items-center gap-1.5 bg-slate-800/80 border border-slate-700/70 rounded-lg px-2.5 py-1 text-xs">
            <Compass className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400">Vessel:</span>
            <select
              id="vessel-selector"
              value={selectedVesselId}
              onChange={(e) => onSelectVessel(e.target.value)}
              className="bg-transparent text-slate-200 font-medium focus:outline-none cursor-pointer text-xs"
            >
              {vessels.map((v) => (
                <option key={v.id} value={v.id} className="bg-slate-800 text-slate-200">
                  {v.name} ({v.imo})
                </option>
              ))}
            </select>
          </div>

          {/* Role Selector with Authority Policy indicator */}
          <div className="flex items-center gap-1.5 bg-slate-800/80 border border-slate-700/70 rounded-lg px-2.5 py-1 text-xs">
            <Shield className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-slate-400">Actor Role:</span>
            <select
              id="role-selector"
              value={currentRole}
              onChange={(e) => onRoleChange(e.target.value as Role)}
              className="bg-transparent font-medium focus:outline-none cursor-pointer text-xs text-slate-200"
            >
              <option value={Role.MASTER} className="bg-slate-800 text-emerald-300">
                {Role.MASTER} (Navigational Authority)
              </option>
              <option value={Role.FLEET_OPS} className="bg-slate-800 text-sky-300">
                {Role.FLEET_OPS} (Shore Support)
              </option>
              <option value={Role.AUDIT_OBSERVER} className="bg-slate-800 text-amber-300">
                {Role.AUDIT_OBSERVER} (Read-Only Observer)
              </option>
            </select>
          </div>

          {/* Connectivity Status Button */}
          <button
            id="connectivity-button"
            onClick={onOpenConnectivityModal}
            title="Configure Connectivity Simulation (Online / Degraded / Offline)"
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-mono transition-colors ${connBadge.bg}`}
          >
            {connBadge.icon}
            <span>{connBadge.label}</span>
          </button>
        </div>

        {/* Right Actions: Test Harness, Export, Reset */}
        <div className="flex items-center gap-2">
          <button
            id="run-stage7-header-btn"
            onClick={onRunStage7}
            disabled={isRunningStage7}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
              stage7Passed === true
                ? "bg-emerald-900/40 border-emerald-500/40 text-emerald-300 hover:bg-emerald-900/60"
                : stage7Passed === false
                ? "bg-rose-900/40 border-rose-500/40 text-rose-300 hover:bg-rose-900/60"
                : "bg-blue-600/20 border-blue-500/40 text-blue-300 hover:bg-blue-600/30"
            }`}
          >
            <Play className={`w-3.5 h-3.5 ${isRunningStage7 ? "animate-spin" : ""}`} />
            <span>{isRunningStage7 ? "Verifying..." : "Stage 7 Gates"}</span>
            {stage7Passed !== undefined && (
              <span className={`w-2 h-2 rounded-full ${stage7Passed ? "bg-emerald-400" : "bg-rose-400"}`} />
            )}
          </button>

          <button
            id="export-state-btn"
            onClick={onExportState}
            title="Export full provenance, state mutations, and audit log (FR-010)"
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span>Export FR-010</span>
          </button>

          <button
            id="reset-scenario-btn"
            onClick={onResetScenario}
            title="Reset scenario to reference baseline"
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-400 hover:text-slate-200 transition-colors"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex items-center border-t border-slate-800 text-xs">
        <div className="flex space-x-1 py-1.5 overflow-x-auto">
          <button
            id="tab-console"
            onClick={() => onTabChange("console")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all ${
              activeTab === "console"
                ? "bg-slate-800 text-blue-400 border border-blue-500/30 shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Disruption & Recovery (WF-01 to 04)</span>
          </button>

          <button
            id="tab-map"
            onClick={() => onTabChange("map")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all ${
              activeTab === "map"
                ? "bg-slate-800 text-blue-400 border border-blue-500/30 shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Nautical Route Visualizer</span>
          </button>

          <button
            id="tab-offline"
            onClick={() => onTabChange("offline")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all ${
              activeTab === "offline"
                ? "bg-slate-800 text-amber-400 border border-amber-500/30 shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
          >
            <HardDrive className="w-3.5 h-3.5" />
            <span>Offline Fallback Station (WF-05/06)</span>
            {connectivity === ConnectivityState.OFFLINE && (
              <span className="w-2 h-2 rounded-full bg-rose-400 animate-ping" />
            )}
          </button>

          <button
            id="tab-stage7"
            onClick={() => onTabChange("stage7")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all ${
              activeTab === "stage7"
                ? "bg-slate-800 text-emerald-400 border border-emerald-500/30 shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
          >
            <FileCheck2 className="w-3.5 h-3.5" />
            <span>Stage 7 Hard Gates Suite</span>
          </button>

          <button
            id="tab-audit"
            onClick={() => onTabChange("audit")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition-all ${
              activeTab === "audit"
                ? "bg-slate-800 text-sky-400 border border-sky-500/30 shadow-sm"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Audit Trail & Provenance (FR-009)</span>
          </button>
        </div>
      </div>
    </header>
  );
};
