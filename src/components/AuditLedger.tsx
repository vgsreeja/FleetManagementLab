import React, { useState } from "react";
import {
  Layers,
  Search,
  Download,
  Filter,
  Clock,
  User,
  Shield,
  FileJson,
  ChevronDown,
  ChevronUp,
  Tag,
  Check,
  Copy,
  Terminal,
} from "lucide-react";
import { AuditEvent, Role } from "../types";

interface AuditLedgerProps {
  auditLog: AuditEvent[];
  versions: {
    app: string;
    policy: string;
    model: string;
  };
  onExport: () => void;
}

export const AuditLedger: React.FC<AuditLedgerProps> = ({
  auditLog,
  versions,
  onExport,
}) => {
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [filterAction, setFilterAction] = useState<string>("ALL");
  const [filterRole, setFilterRole] = useState<string>("ALL");
  const [expandedAuditId, setExpandedAuditId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const actionTypes = Array.from(new Set(auditLog.map((a) => a.action)));

  const filteredLogs = auditLog.filter((item) => {
    const matchesSearch =
      searchTerm === "" ||
      item.audit_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.actor.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.target.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesAction = filterAction === "ALL" || item.action === filterAction;
    const matchesRole = filterRole === "ALL" || item.role === filterRole;

    return matchesSearch && matchesAction && matchesRole;
  });

  return (
    <div className="space-y-6">
      {/* Top Header & Export Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-lg bg-sky-600/20 border border-sky-500/30 flex items-center justify-center text-sky-400">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">
                  FR-009 / FR-010: Immutable Audit Ledger & State Provenance
                </h3>
                <span className="px-2 py-0.5 text-xs font-mono rounded bg-slate-800 text-slate-300 border border-slate-700">
                  Material Versions Locked
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                Every operational decision, AI recommendation, and state mutation is immutably timestamped with before/after state diffs and policy hashes.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              id="export-audit-btn"
              onClick={onExport}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Download State Export JSON</span>
            </button>
          </div>
        </div>

        {/* Material Policy Versions Bar */}
        <div className="mt-4 pt-4 border-t border-slate-800 flex flex-wrap items-center gap-4 text-xs font-mono">
          <span className="text-slate-400">Material Version Hashes:</span>
          <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
            app: <strong className="text-blue-300">{versions.app}</strong>
          </span>
          <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
            policy: <strong className="text-emerald-300">{versions.policy}</strong>
          </span>
          <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
            model: <strong className="text-amber-300">{versions.model}</strong>
          </span>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs">
        {/* Search */}
        <div className="relative flex-1 min-w-[220px]">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            id="audit-search-input"
            type="text"
            placeholder="Search by action, actor, target or audit ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
          />
        </div>

        {/* Action Filter */}
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-400">Action:</span>
          <select
            id="audit-action-filter"
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none"
          >
            <option value="ALL">All Actions ({auditLog.length})</option>
            {actionTypes.map((act) => (
              <option key={act} value={act}>
                {act}
              </option>
            ))}
          </select>
        </div>

        {/* Role Filter */}
        <div className="flex items-center gap-2">
          <Shield className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-400">Role:</span>
          <select
            id="audit-role-filter"
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
            className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none"
          >
            <option value="ALL">All Roles</option>
            <option value={Role.MASTER}>{Role.MASTER}</option>
            <option value={Role.FLEET_OPS}>{Role.FLEET_OPS}</option>
            <option value={Role.AUDIT_OBSERVER}>{Role.AUDIT_OBSERVER}</option>
          </select>
        </div>
      </div>

      {/* Audit Events Stream */}
      <div className="space-y-2.5">
        {filteredLogs.length === 0 ? (
          <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-xl text-xs text-slate-400">
            No audit records matching current search and filter criteria.
          </div>
        ) : (
          filteredLogs.map((entry) => {
            const isExpanded = expandedAuditId === entry.audit_id;

            return (
              <div
                key={entry.audit_id}
                id={`audit-entry-${entry.audit_id}`}
                className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden text-xs transition-colors hover:border-slate-700"
              >
                {/* Main Summary Row */}
                <div
                  onClick={() => setExpandedAuditId(isExpanded ? null : entry.audit_id)}
                  className="p-3.5 flex flex-wrap items-center justify-between gap-3 cursor-pointer select-none"
                >
                  <div className="flex items-center gap-3 flex-wrap">
                    <span
                      className={`px-2 py-0.5 font-mono text-[10px] font-bold rounded ${
                        entry.action.includes("EXECUTED") || entry.action.includes("APPROVED")
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                          : entry.action.includes("UNAUTHORIZED") || entry.action.includes("REJECTED")
                          ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                          : entry.action.includes("DEDUPLICATED") || entry.action.includes("SKIP")
                          ? "bg-purple-500/20 text-purple-300 border border-purple-500/30"
                          : "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                      }`}
                    >
                      {entry.action}
                    </span>

                    <span className="font-mono text-slate-300 font-semibold">
                      Target: {entry.target}
                    </span>

                    <span className="text-slate-400 flex items-center gap-1">
                      <User className="w-3 h-3 text-slate-500" />
                      {entry.actor} ({entry.role})
                    </span>
                  </div>

                  <div className="flex items-center gap-3 font-mono text-[11px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(entry.timestamp).toLocaleString()}
                    </span>

                    <span className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-300">
                      {entry.connectivity_state}
                    </span>

                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </div>

                {/* Expanded JSON State Diff & Material Versions Inspector */}
                {isExpanded && (
                  <div className="p-4 bg-slate-950 border-t border-slate-800 space-y-3 font-mono text-[11px]">
                    <div className="flex justify-between items-center text-slate-400">
                      <span>Audit ID: <strong className="text-slate-200">{entry.audit_id}</strong></span>
                      <button
                        onClick={() => handleCopy(entry.audit_id, JSON.stringify(entry, null, 2))}
                        className="flex items-center gap-1 text-slate-400 hover:text-blue-300"
                      >
                        {copiedId === entry.audit_id ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span className="text-emerald-400">Copied</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-3 h-3" />
                            <span>Copy Entry JSON</span>
                          </>
                        )}
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {/* Before State */}
                      <div className="p-2.5 bg-slate-900 rounded border border-slate-800 space-y-1">
                        <span className="text-slate-400 text-[10px] uppercase font-bold block">
                          Before Mutation State:
                        </span>
                        <pre className="text-slate-300 text-[10px] overflow-x-auto whitespace-pre-wrap">
                          {JSON.stringify(entry.before_state, null, 2)}
                        </pre>
                      </div>

                      {/* After State */}
                      <div className="p-2.5 bg-slate-900 rounded border border-slate-800 space-y-1">
                        <span className="text-emerald-400 text-[10px] uppercase font-bold block">
                          After Mutation State:
                        </span>
                        <pre className="text-emerald-300 text-[10px] overflow-x-auto whitespace-pre-wrap">
                          {JSON.stringify(entry.after_state, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
