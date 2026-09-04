import React, { useState } from "react";
import {
  X,
  Zap,
  Radio,
  AlertTriangle,
  Flame,
  Wind,
  Anchor,
  Layers,
  Sparkles,
} from "lucide-react";
import { VesselEvent, Vessel } from "../types";

interface IngestEventModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedVessel: Vessel;
  onIngest: (event: Partial<VesselEvent>) => void;
}

export const IngestEventModal: React.FC<IngestEventModalProps> = ({
  isOpen,
  onClose,
  selectedVessel,
  onIngest,
}) => {
  const [sourceSystem, setSourceSystem] = useState<string>("BRIDGE_TELEMETRY_ENGINE");
  const [disruptionType, setDisruptionType] = useState<string>("Engine Turbocharger Vibration Spike");
  const [severity, setSeverity] = useState<"CRITICAL" | "HIGH" | "MEDIUM" | "LOW">("CRITICAL");
  const [vibrationRms, setVibrationRms] = useState<number>(18.5);
  const [bearingTemp, setBearingTemp] = useState<number>(94.0);
  const [speedLoss, setSpeedLoss] = useState<number>(4.5);
  const [customJson, setCustomJson] = useState<string>("");

  if (!isOpen) return null;

  const presetScenarios = [
    {
      name: "Severe Turbocharger Vibration Spike",
      source: "BRIDGE_TELEMETRY_ENGINE",
      severity: "CRITICAL" as const,
      type: "Main Engine Turbocharger Bearing Vibration Alert",
      payload: {
        vibration_rms_mms: 19.2,
        bearing_temp_c: 96.5,
        max_derated_power_pct: 60,
        estimated_speed_loss_knots: 5.2,
      },
    },
    {
      name: "Red Sea Maritime Security Restriction",
      source: "NAVTEX_UKMTO_BROADCAST",
      severity: "CRITICAL" as const,
      type: "Strait Security Threat Escalation Level 4",
      payload: {
        threat_level: "HIGH",
        convoy_required: true,
        war_risk_insurance_increase_pct: 350,
      },
    },
    {
      name: "Rotterdam APM Berth Congestion Warning",
      source: "PORT_COMMUNITY_SYSTEM_NLRTM",
      severity: "HIGH" as const,
      type: "Terminal Berth Window Delay & Crane Maintenance",
      payload: {
        berth_delay_hours: 48,
        demurrage_risk_usd: 160000,
        feeder_slot_forfeited: true,
      },
    },
    {
      name: "Tropical Cyclone Avoidance Warning",
      source: "COPERNICUS_WEATHER_ECMWF",
      severity: "HIGH" as const,
      type: "Category 3 Cyclone Front Crossing Sea Lane",
      payload: {
        wind_speed_knots: 55,
        significant_wave_height_m: 7.8,
        minimum_safe_distance_nm: 180,
      },
    },
  ];

  const handleApplyPreset = (preset: typeof presetScenarios[0]) => {
    setSourceSystem(preset.source);
    setDisruptionType(preset.type);
    setSeverity(preset.severity);
    if (preset.payload.vibration_rms_mms) setVibrationRms(preset.payload.vibration_rms_mms);
    if (preset.payload.bearing_temp_c) setBearingTemp(preset.payload.bearing_temp_c);
    if (preset.payload.estimated_speed_loss_knots) setSpeedLoss(preset.payload.estimated_speed_loss_knots);
    setCustomJson(JSON.stringify(preset.payload, null, 2));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    let payload: Record<string, any> = {
      vibration_rms_mms: Number(vibrationRms),
      bearing_temp_c: Number(bearingTemp),
      estimated_speed_loss_knots: Number(speedLoss),
    };

    if (customJson.trim()) {
      try {
        payload = JSON.parse(customJson);
      } catch (err) {
        console.warn("Invalid custom JSON payload, using standard numeric values.");
      }
    }

    onIngest({
      source_system: sourceSystem,
      disruption_type: disruptionType,
      severity,
      vessel_id: selectedVessel.id,
      vessel_name: selectedVessel.name,
      telemetry_payload: payload,
      original_timestamp: new Date().toISOString(),
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl max-w-xl w-full p-6 text-slate-100 space-y-5 animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-blue-400" />
            <h3 className="text-base font-bold text-white">
              WF-01: Ingest Maritime Disruption Event
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 transition-colors p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Presets */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-slate-300 block">
            Select Operational Disruption Preset:
          </label>
          <div className="grid grid-cols-2 gap-2">
            {presetScenarios.map((preset, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleApplyPreset(preset)}
                className="p-2.5 rounded-lg bg-slate-800/80 hover:bg-slate-800 border border-slate-700/70 text-left text-xs transition-colors hover:border-blue-500/50"
              >
                <span className="font-semibold text-slate-200 block truncate">
                  {preset.name}
                </span>
                <span className="text-[10px] text-slate-400 block mt-0.5 font-mono">
                  {preset.severity} &bull; {preset.source}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Ingest Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-slate-400 block mb-1">Source Telemetry Sensor / Feed:</label>
              <input
                type="text"
                value={sourceSystem}
                onChange={(e) => setSourceSystem(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-200 font-mono text-xs focus:outline-none focus:border-blue-500"
                required
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Severity Level:</label>
              <select
                value={severity}
                onChange={(e) => setSeverity(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-200 text-xs focus:outline-none focus:border-blue-500"
              >
                <option value="CRITICAL">CRITICAL (Navigation Hazard)</option>
                <option value="HIGH">HIGH (ETA / Schedule Alert)</option>
                <option value="MEDIUM">MEDIUM (Commercial Risk)</option>
                <option value="LOW">LOW (Advisory)</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-slate-400 block mb-1">Disruption Event Classification:</label>
            <input
              type="text"
              value={disruptionType}
              onChange={(e) => setDisruptionType(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-200 text-xs focus:outline-none focus:border-blue-500"
              required
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="text-slate-400 block mb-1">Vibration RMS (mm/s):</label>
              <input
                type="number"
                step="0.1"
                value={vibrationRms}
                onChange={(e) => setVibrationRms(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-200 font-mono text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Bearing Temp (&deg;C):</label>
              <input
                type="number"
                step="0.5"
                value={bearingTemp}
                onChange={(e) => setBearingTemp(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-200 font-mono text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
            <div>
              <label className="text-slate-400 block mb-1">Speed Loss (kts):</label>
              <input
                type="number"
                step="0.1"
                value={speedLoss}
                onChange={(e) => setSpeedLoss(parseFloat(e.target.value) || 0)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-slate-200 font-mono text-xs focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div className="pt-2 border-t border-slate-800 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold shadow-md transition-colors"
            >
              Ingest Disruption Event
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
