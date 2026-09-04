import React, { useState } from "react";
import {
  Compass,
  Navigation,
  Anchor,
  AlertTriangle,
  Wind,
  Layers,
  MapPin,
  Maximize2,
  CheckCircle,
  Eye,
  Info,
} from "lucide-react";
import { Vessel, RecoveryOption } from "../types";

interface NauticalMapProps {
  vessel: Vessel;
  options: RecoveryOption[];
  executedActionIds: string[];
}

export const NauticalMap: React.FC<NauticalMapProps> = ({
  vessel,
  options,
  executedActionIds,
}) => {
  const [selectedRouteId, setSelectedRouteId] = useState<string>("ORIGINAL");
  const [hoveredPoint, setHoveredPoint] = useState<string | null>(null);

  // Coordinate projection mapping for SVG canvas (approx Mercator bounding box: Longitude 10W to 130E, Latitude 40S to 60N)
  const project = (lat: number, lon: number) => {
    // Map bounds
    const minLon = -20;
    const maxLon = 135;
    const minLat = -40;
    const maxLat = 60;

    const width = 900;
    const height = 480;

    const x = ((lon - minLon) / (maxLon - minLon)) * width;
    // Invert Y for SVG coordinates
    const y = height - ((lat - minLat) / (maxLat - minLat)) * height;

    return { x, y };
  };

  // Original Waypoints
  const originalPoints = vessel.waypoints.map((wp) => ({
    ...wp,
    ...project(wp.lat, wp.lon),
  }));

  // Alternate Route: Cape of Good Hope Option
  const capeRouteWaypoints = [
    { lat: 12.35, lon: 43.42, name: "Bab-el-Mandeb" },
    { lat: 16.94, lon: 54.0, name: "Port of Salalah (Haven)" },
    { lat: -4.04, lon: 39.66, name: "Mombasa Approach" },
    { lat: -34.2, lon: 18.4, name: "Cape of Good Hope" },
    { lat: 14.7, lon: -17.5, name: "Dakar Passage" },
    { lat: 36.14, lon: -5.35, name: "Strait of Gibraltar" },
    { lat: 51.92, lon: 4.47, name: "Rotterdam" },
  ].map((wp) => ({ ...wp, ...project(wp.lat, wp.lon) }));

  // Alternate Route: Valencia Discharge Option
  const valenciaRouteWaypoints = [
    { lat: 12.35, lon: 43.42, name: "Bab-el-Mandeb" },
    { lat: 27.85, lon: 34.32, name: "Suez Canal" },
    { lat: 39.46, lon: -0.37, name: "Port of Valencia (Discharge Hub)" },
  ].map((wp) => ({ ...wp, ...project(wp.lat, wp.lon) }));

  // Helper to build SVG path string
  const buildSvgPath = (points: Array<{ x: number; y: number }>) => {
    if (points.length === 0) return "";
    return points.reduce((acc, pt, idx) => `${acc} ${idx === 0 ? "M" : "L"} ${pt.x.toFixed(1)} ${pt.y.toFixed(1)}`, "");
  };

  const vesselPos = project(vessel.current_position.lat, vessel.current_position.lon);
  const stormZonePos = project(13.5, 45.5);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Compass className="w-5 h-5 text-blue-400" />
            <h3 className="text-base font-bold text-white tracking-wide">
              Nautical Route & Disruption Zone Visualizer
            </h3>
            <span className="px-2 py-0.5 text-xs font-mono rounded bg-slate-800 text-slate-300 border border-slate-700">
              ECDIS Electronic Chart Overlay
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time positional telemetry, Solas navigation corridors, and weather avoidance rerouting vectors.
          </p>
        </div>

        {/* Route Layer Selector */}
        <div className="flex items-center gap-2 bg-slate-800/90 border border-slate-700/80 p-1 rounded-lg text-xs">
          <span className="text-slate-400 pl-2 font-medium">Active Layer:</span>
          <button
            onClick={() => setSelectedRouteId("ORIGINAL")}
            className={`px-2.5 py-1 rounded font-medium transition-all ${
              selectedRouteId === "ORIGINAL"
                ? "bg-blue-600 text-white shadow-sm"
                : "text-slate-300 hover:bg-slate-700"
            }`}
          >
            Original Plan (Suez)
          </button>
          <button
            onClick={() => setSelectedRouteId("CAPE")}
            className={`px-2.5 py-1 rounded font-medium transition-all ${
              selectedRouteId === "CAPE"
                ? "bg-amber-600 text-white shadow-sm"
                : "text-slate-300 hover:bg-slate-700"
            }`}
          >
            Option A (Cape of Good Hope)
          </button>
          <button
            onClick={() => setSelectedRouteId("VALENCIA")}
            className={`px-2.5 py-1 rounded font-medium transition-all ${
              selectedRouteId === "VALENCIA"
                ? "bg-emerald-600 text-white shadow-sm"
                : "text-slate-300 hover:bg-slate-700"
            }`}
          >
            Option C (Valencia Hub)
          </button>
        </div>
      </div>

      {/* SVG Nautical Chart Viewport */}
      <div className="relative w-full aspect-[16/9] max-h-[500px] bg-slate-950 rounded-xl border border-slate-800 overflow-hidden shadow-inner flex items-center justify-center">
        {/* Ocean Grid Background */}
        <svg
          viewBox="0 0 900 480"
          className="w-full h-full select-none"
          style={{ background: "radial-gradient(ellipse at center, #0a1322 0%, #030712 100%)" }}
        >
          <defs>
            {/* Grid Pattern */}
            <pattern id="nautical-grid" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#1e293b" strokeWidth="0.5" strokeDasharray="2,2" />
            </pattern>
            {/* Storm Hazard Pattern */}
            <radialGradient id="storm-gradient" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.45" />
              <stop offset="70%" stopColor="#f43f5e" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#f43f5e" stopOpacity="0" />
            </radialGradient>
          </defs>

          {/* Background Grid */}
          <rect width="900" height="480" fill="url(#nautical-grid)" />

          {/* Simplified Continental Outlines (Eurasia, Africa, Indian Ocean) */}
          <g fill="#1e293b" stroke="#334155" strokeWidth="0.8" opacity="0.6">
            {/* Europe / Med */}
            <path d="M 320 60 L 400 65 L 430 110 L 400 140 L 350 150 L 330 130 L 310 140 L 290 100 Z" />
            {/* Africa */}
            <path d="M 330 150 L 410 150 L 460 210 L 440 330 L 390 410 L 340 380 L 310 270 L 290 180 Z" />
            {/* Asia */}
            <path d="M 430 110 L 580 80 L 720 90 L 820 140 L 800 240 L 730 250 L 650 280 L 540 210 L 460 210 Z" />
            {/* Australia */}
            <path d="M 720 340 L 820 320 L 840 400 L 760 430 L 710 390 Z" />
          </g>

          {/* Storm Disruption Zone */}
          <g>
            <circle cx={stormZonePos.x} cy={stormZonePos.y} r="55" fill="url(#storm-gradient)" />
            <circle
              cx={stormZonePos.x}
              cy={stormZonePos.y}
              r="35"
              fill="none"
              stroke="#f43f5e"
              strokeWidth="1.5"
              strokeDasharray="4,3"
              className="animate-spin origin-center"
              style={{ transformOrigin: `${stormZonePos.x}px ${stormZonePos.y}px`, animationDuration: "14s" }}
            />
            <text
              x={stormZonePos.x}
              y={stormZonePos.y - 42}
              fill="#fda4af"
              fontSize="10"
              fontWeight="bold"
              fontFamily="monospace"
              textAnchor="middle"
            >
              HIGH RISK / DISRUPTION ZONE
            </text>
          </g>

          {/* Routes */}
          {/* 1. Original Planned Route (Red dashed if selected/disrupted) */}
          <path
            d={buildSvgPath(originalPoints)}
            fill="none"
            stroke={selectedRouteId === "ORIGINAL" ? "#3b82f6" : "#475569"}
            strokeWidth={selectedRouteId === "ORIGINAL" ? "2.5" : "1.2"}
            strokeDasharray={selectedRouteId === "ORIGINAL" ? "none" : "4,4"}
            opacity={selectedRouteId === "ORIGINAL" ? 1 : 0.4}
          />

          {/* 2. Cape of Good Hope Route */}
          {(selectedRouteId === "CAPE" || selectedRouteId === "ALL") && (
            <path
              d={buildSvgPath(capeRouteWaypoints)}
              fill="none"
              stroke="#f59e0b"
              strokeWidth="2.5"
              strokeDasharray="6,4"
              opacity="0.95"
            />
          )}

          {/* 3. Valencia Route */}
          {(selectedRouteId === "VALENCIA" || selectedRouteId === "ALL") && (
            <path
              d={buildSvgPath(valenciaRouteWaypoints)}
              fill="none"
              stroke="#10b981"
              strokeWidth="2.5"
              strokeDasharray="6,4"
              opacity="0.95"
            />
          )}

          {/* Waypoints Render */}
          {originalPoints.map((wp, idx) => (
            <g
              key={idx}
              className="cursor-pointer"
              onMouseEnter={() => setHoveredPoint(wp.name)}
              onMouseLeave={() => setHoveredPoint(null)}
            >
              <circle
                cx={wp.x}
                cy={wp.y}
                r={wp.status === "current" ? "6" : "4"}
                fill={wp.status === "passed" ? "#64748b" : wp.status === "current" ? "#3b82f6" : "#94a3b8"}
                stroke="#0f172a"
                strokeWidth="1.5"
              />
              <text
                x={wp.x + 8}
                y={wp.y + 4}
                fill="#cbd5e1"
                fontSize="9"
                fontWeight="500"
                fontFamily="sans-serif"
              >
                {wp.name}
              </text>
            </g>
          ))}

          {/* Alternate Cape Waypoints if selected */}
          {selectedRouteId === "CAPE" &&
            capeRouteWaypoints.map((wp, idx) => (
              <g key={`cape-${idx}`}>
                <circle cx={wp.x} cy={wp.y} r="4.5" fill="#f59e0b" stroke="#0f172a" strokeWidth="1.5" />
                <text x={wp.x + 8} y={wp.y + 4} fill="#fde68a" fontSize="9" fontWeight="bold">
                  {wp.name}
                </text>
              </g>
            ))}

          {/* Vessel Live Icon Marker */}
          <g transform={`translate(${vesselPos.x}, ${vesselPos.y}) rotate(${vessel.heading})`}>
            <polygon points="0,-12 7,8 0,4 -7,8" fill="#60a5fa" stroke="#ffffff" strokeWidth="1.5" />
            <circle cx="0" cy="0" r="16" fill="none" stroke="#60a5fa" strokeWidth="1" strokeDasharray="3,3" opacity="0.7" />
          </g>
          <text
            x={vesselPos.x}
            y={vesselPos.y - 18}
            fill="#93c5fd"
            fontSize="10"
            fontWeight="bold"
            textAnchor="middle"
            fontFamily="monospace"
          >
            {vessel.name} ({vessel.speed_knots} kts)
          </text>
        </svg>

        {/* HUD Overlay Stats Box in Bottom-Left */}
        <div className="absolute bottom-3 left-3 bg-slate-900/90 backdrop-blur-sm border border-slate-700/80 rounded-lg p-3 text-xs space-y-1.5 shadow-lg max-w-xs">
          <div className="flex items-center justify-between text-slate-300 font-semibold border-b border-slate-800 pb-1">
            <span className="flex items-center gap-1">
              <Navigation className="w-3.5 h-3.5 text-blue-400" /> Active Vector
            </span>
            <span className="font-mono text-blue-300">{selectedRouteId}</span>
          </div>
          <div className="text-[11px] font-mono text-slate-400 space-y-0.5">
            <div className="flex justify-between">
              <span>Position:</span>
              <span className="text-slate-200">{vessel.current_position.name}</span>
            </div>
            <div className="flex justify-between">
              <span>Coordinates:</span>
              <span className="text-slate-200">
                {vessel.current_position.lat.toFixed(2)}N, {vessel.current_position.lon.toFixed(2)}E
              </span>
            </div>
            <div className="flex justify-between">
              <span>Planned Next WP:</span>
              <span className="text-amber-300">Port of Salalah Haven (16.9N)</span>
            </div>
          </div>
        </div>

        {/* Map Legend in Top-Right */}
        <div className="absolute top-3 right-3 bg-slate-900/85 backdrop-blur-sm border border-slate-800 rounded-lg p-2.5 text-[11px] space-y-1 shadow">
          <div className="flex items-center gap-2">
            <span className="w-3 h-0.5 bg-blue-500 inline-block" />
            <span className="text-slate-300">Original Route</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-0.5 bg-amber-500 inline-block border-dashed" />
            <span className="text-slate-300">Option A (Safety Cape Reroute)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-0.5 bg-emerald-500 inline-block border-dashed" />
            <span className="text-slate-300">Option C (Valencia Relay)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80 inline-block" />
            <span className="text-rose-300">Hazard / Disruption Region</span>
          </div>
        </div>
      </div>
    </div>
  );
};
