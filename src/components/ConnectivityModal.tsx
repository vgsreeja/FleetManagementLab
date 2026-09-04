import React, { useState } from "react";
import {
  X,
  Wifi,
  WifiOff,
  Radio,
  Sliders,
  ShieldAlert,
  HardDrive,
} from "lucide-react";
import { ConnectivityState, Role } from "../types";

interface ConnectivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentConnectivity: ConnectivityState;
  networkLatencyMs: number;
  onUpdateConnectivity: (state: ConnectivityState, latencyMs: number) => void;
  currentRole: Role;
}

export const ConnectivityModal: React.FC<ConnectivityModalProps> = ({
  isOpen,
  onClose,
  currentConnectivity,
  networkLatencyMs,
  onUpdateConnectivity,
  currentRole,
}) => {
  const [selectedState, setSelectedState] = useState<ConnectivityState>(currentConnectivity);
  const [latency, setLatency] = useState<number>(networkLatencyMs);

  if (!isOpen) return null;

  const handleApply = () => {
    onUpdateConnectivity(selectedState, latency);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-md w-full p-6 text-slate-100 space-y-5 animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Radio className="w-5 h-5 text-blue-400" />
            <h3 className="text-base font-bold text-white">
              Satellite & Cloud Connectivity Simulator
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-xs text-slate-400">
          Simulate maritime satellite link conditions (LEO / GEO / Outage) to test autonomous vessel continuity (WF-05/06) and at-least-once idempotency (BR-02).
        </p>

        {/* State Selection */}
        <div className="space-y-2.5">
          <label className="text-xs font-semibold text-slate-300 block">
            Select Link Connectivity State:
          </label>

          <button
            type="button"
            onClick={() => {
              setSelectedState(ConnectivityState.ONLINE);
              setLatency(45);
            }}
            className={`w-full p-3 rounded-lg border flex items-center gap-3 text-left transition-all ${
              selectedState === ConnectivityState.ONLINE
                ? "bg-emerald-950/40 border-emerald-500 text-emerald-200 shadow-sm"
                : "bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800"
            }`}
          >
            <Wifi className="w-5 h-5 text-emerald-400 shrink-0" />
            <div>
              <span className="font-bold text-xs block text-slate-100">ONLINE (Standard Starlink / VSAT)</span>
              <span className="text-[11px] text-slate-400 block mt-0.5">
                Low latency (45ms). Full cloud AI and shore synchronization active.
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedState(ConnectivityState.DEGRADED);
              setLatency(550);
            }}
            className={`w-full p-3 rounded-lg border flex items-center gap-3 text-left transition-all ${
              selectedState === ConnectivityState.DEGRADED
                ? "bg-amber-950/40 border-amber-500 text-amber-200 shadow-sm"
                : "bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800"
            }`}
          >
            <Radio className="w-5 h-5 text-amber-400 shrink-0 animate-pulse" />
            <div>
              <span className="font-bold text-xs block text-slate-100">DEGRADED (High Latency GEO / Rain Fade)</span>
              <span className="text-[11px] text-slate-400 block mt-0.5">
                Elevated latency (550ms+). Telemetry packet jitter and retransmissions.
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedState(ConnectivityState.OFFLINE);
              setLatency(0);
            }}
            className={`w-full p-3 rounded-lg border flex items-center gap-3 text-left transition-all ${
              selectedState === ConnectivityState.OFFLINE
                ? "bg-rose-950/40 border-rose-500 text-rose-200 shadow-sm"
                : "bg-slate-800/60 border-slate-700 text-slate-300 hover:bg-slate-800"
            }`}
          >
            <WifiOff className="w-5 h-5 text-rose-400 shrink-0" />
            <div>
              <span className="font-bold text-xs block text-slate-100">OFFLINE (Satellite Link Severed)</span>
              <span className="text-[11px] text-slate-400 block mt-0.5">
                Cloud unreachable. Triggers WF-05/06 Bridge Autonomous Navigation Fallback.
              </span>
            </div>
          </button>
        </div>

        {/* Latency Slider */}
        {selectedState !== ConnectivityState.OFFLINE && (
          <div className="space-y-2 pt-2 border-t border-slate-800 text-xs">
            <div className="flex justify-between items-center text-slate-400">
              <span className="flex items-center gap-1">
                <Sliders className="w-3.5 h-3.5" /> Simulated Round-Trip Latency:
              </span>
              <span className="font-mono font-bold text-slate-200">{latency} ms</span>
            </div>
            <input
              type="range"
              min="20"
              max="2500"
              step="25"
              value={latency}
              onChange={(e) => setLatency(parseInt(e.target.value))}
              className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
            />
          </div>
        )}

        {/* Action Buttons */}
        <div className="pt-2 border-t border-slate-800 flex justify-end gap-2 text-xs">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleApply}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-md transition-colors"
          >
            Apply Connectivity State
          </button>
        </div>
      </div>
    </div>
  );
};
