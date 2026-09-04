import React, { useState } from "react";
import {
  FileCheck2,
  CheckCircle2,
  XCircle,
  Play,
  RotateCcw,
  Clock,
  Terminal,
  Shield,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Award,
} from "lucide-react";
import { Stage7TestResult } from "../types";

interface Stage7HarnessProps {
  results: Stage7TestResult[];
  isRunning: boolean;
  onRunTests: () => void;
  passed?: boolean;
  totalAudit?: number;
  totalActions?: number;
}

export const Stage7Harness: React.FC<Stage7HarnessProps> = ({
  results,
  isRunning,
  onRunTests,
  passed,
  totalAudit = 0,
  totalActions = 0,
}) => {
  const [expandedTestId, setExpandedTestId] = useState<string | null>(null);

  const passedCount = results.filter((r) => r.status === "PASSED").length;
  const totalCount = results.length || 5;

  return (
    <div className="space-y-6">
      {/* Top Banner & Summary Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-lg bg-emerald-600/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">
                  Stage 7 Evaluation Harness & Hard Gates
                </h3>
                <span className="px-2 py-0.5 text-xs font-mono rounded bg-slate-800 text-slate-300 border border-slate-700">
                  PRD Section 10 & 13
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-2xl">
                Automated regression harness validating domain invariants: Idempotency under at-least-once network replays, Master authority protection, Provenance data contracts, Offline autonomy, and State export.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right">
              <span className="text-xs text-slate-400 block">Verification Gate</span>
              <span
                className={`text-sm font-mono font-bold ${
                  passed === true
                    ? "text-emerald-400"
                    : passed === false
                    ? "text-rose-400"
                    : "text-slate-300"
                }`}
              >
                {results.length > 0 ? `${passedCount} / ${totalCount} PASSED` : "READY TO RUN"}
              </span>
            </div>

            <button
              id="run-stage7-main-btn"
              onClick={onRunTests}
              disabled={isRunning}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-md transition-all"
            >
              <Play className={`w-4 h-4 ${isRunning ? "animate-spin" : ""}`} />
              <span>{isRunning ? "Running Hard Gates..." : "Execute Stage 7 Suite"}</span>
            </button>
          </div>
        </div>

        {/* Aggregate Stats */}
        {results.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-slate-800/60 p-2.5 rounded border border-slate-700/60">
              <span className="text-slate-400 text-[11px] block">Overall Gate Status</span>
              <span className={`font-bold font-mono mt-0.5 block ${passed ? "text-emerald-300" : "text-rose-300"}`}>
                {passed ? "ALL 5 GATES PASSED (100%)" : "GATES FAILED"}
              </span>
            </div>
            <div className="bg-slate-800/60 p-2.5 rounded border border-slate-700/60">
              <span className="text-slate-400 text-[11px] block">Audit Events Generated</span>
              <span className="font-bold font-mono text-blue-300 mt-0.5 block">
                {totalAudit} Verified Events
              </span>
            </div>
            <div className="bg-slate-800/60 p-2.5 rounded border border-slate-700/60">
              <span className="text-slate-400 text-[11px] block">Idempotent Executions</span>
              <span className="font-bold font-mono text-slate-200 mt-0.5 block">
                {totalActions} Actions Protected
              </span>
            </div>
            <div className="bg-slate-800/60 p-2.5 rounded border border-slate-700/60">
              <span className="text-slate-400 text-[11px] block">Execution Duration</span>
              <span className="font-bold font-mono text-amber-300 mt-0.5 block">
                {results.reduce((acc, r) => acc + r.duration_ms, 0)} ms
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Test Results Breakdown */}
      <div className="space-y-3">
        {results.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-8 text-center space-y-3">
            <FileCheck2 className="w-10 h-10 text-slate-600 mx-auto" />
            <div className="text-slate-300 font-semibold text-sm">
              Stage 7 Hard Gates Suite Initialized
            </div>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Click &quot;Execute Stage 7 Suite&quot; above to run the full automated verification harness against the domain orchestrator.
            </p>
          </div>
        ) : (
          results.map((test) => {
            const isExpanded = expandedTestId === test.id;
            const isPassed = test.status === "PASSED";

            return (
              <div
                key={test.id}
                id={`stage7-card-${test.id}`}
                className={`bg-slate-900 border rounded-xl overflow-hidden transition-all ${
                  isPassed ? "border-slate-800 hover:border-emerald-500/30" : "border-rose-500/40"
                }`}
              >
                {/* Header Row */}
                <div
                  onClick={() => setExpandedTestId(isExpanded ? null : test.id)}
                  className="p-4 flex items-center justify-between gap-3 cursor-pointer select-none hover:bg-slate-800/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {isPassed ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                    ) : (
                      <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                    )}

                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-bold text-white">{test.name}</h4>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-blue-300 border border-slate-700">
                          {test.fr_ref}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{test.description}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs font-mono text-slate-400">
                      {test.duration_ms}ms
                    </span>
                    <span
                      className={`px-2.5 py-1 text-xs font-mono font-bold rounded ${
                        isPassed
                          ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                          : "bg-rose-500/20 text-rose-300 border border-rose-500/40"
                      }`}
                    >
                      {test.status}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </div>

                {/* Expanded Console & Assertion Breakdown */}
                {isExpanded && (
                  <div className="p-4 bg-slate-950/80 border-t border-slate-800 space-y-3 text-xs">
                    <div>
                      <span className="text-[11px] font-semibold text-slate-400 block mb-1">
                        Hard Gate Assertion Formula:
                      </span>
                      <code className="font-mono text-xs px-2.5 py-1.5 rounded bg-slate-900 border border-slate-800 text-emerald-300 block">
                        {test.assertion}
                      </code>
                    </div>

                    <div>
                      <span className="text-[11px] font-semibold text-slate-400 block mb-1 flex items-center gap-1">
                        <Terminal className="w-3 h-3 text-blue-400" />
                        Execution Trace Logs:
                      </span>
                      <div className="p-3 bg-black/70 rounded-lg border border-slate-800 font-mono text-[11px] text-slate-300 space-y-1">
                        {test.logs.map((log, lIdx) => (
                          <div key={lIdx} className="flex gap-2">
                            <span className="text-slate-600 select-none">&gt;</span>
                            <span
                              className={
                                log.startsWith("PASS") || log.startsWith("Assertion verified")
                                  ? "text-emerald-400 font-semibold"
                                  : log.startsWith("ERROR") || log.startsWith("FAIL")
                                  ? "text-rose-400 font-semibold"
                                  : "text-slate-300"
                              }
                            >
                              {log}
                            </span>
                          </div>
                        ))}
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
