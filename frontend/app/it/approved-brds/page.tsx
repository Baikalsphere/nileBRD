"use client";

import { useEffect, useState, useCallback } from "react";
import {
  FileCheck2, RefreshCw, Loader2, ChevronDown, ChevronUp,
  FileText, BarChart3, CheckCircle2,
  XCircle, ShieldAlert, ClipboardList, BookOpen, Printer,
  Crown, Search, Filter, Info, Wand2, ArrowRight,
  X, AlertTriangle, ChevronRight, AlertCircle, GitBranch,
  Database, Layers, CheckCheck, ArrowLeft,
} from "lucide-react";
import { buildPdfHtml, type BrdDoc } from "@/lib/brdPdf";
import { ensureAuth } from "@/lib/authGuard";

const API = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5001";

interface ApprovedBrd {
  id: number;
  doc_id: string;
  version: string;
  status: "Approved" | "Final";
  title: string;
  category: string;
  priority: string;
  readiness_score: string;
  executive_summary: string;
  content: BrdDoc;
  request_id: number;
  request_title: string;
  req_number: string;
  req_priority: string;
  req_category: string;
  author_name: string;
  author_email: string;
  generated_at: string;
  updated_at: string;
  submitted_at: string | null;
  reviews_approved: string;
  reviews_total: string;
}

const STATUS_COLORS: Record<string, string> = {
  Approved: "bg-violet-100 text-violet-700 border-violet-200",
  Final:    "bg-emerald-100 text-emerald-700 border-emerald-200",
};

const PRIORITY_DOT: Record<string, string> = {
  Low: "bg-emerald-400", Medium: "bg-amber-400", High: "bg-orange-500", Critical: "bg-rose-500",
};

const IMPACT_COLORS: Record<string, string> = {
  High: "bg-rose-100 text-rose-700", Medium: "bg-amber-100 text-amber-700", Low: "bg-emerald-100 text-emerald-700",
};

const PRIORITY_COLORS: Record<string, string> = {
  "Must Have":   "bg-rose-100 text-rose-700 border-rose-200",
  "Should Have": "bg-amber-100 text-amber-700 border-amber-200",
  "Could Have":  "bg-sky-100 text-sky-700 border-sky-200",
  "Won't Have":  "bg-slate-100 text-slate-500 border-slate-200",
};

function ReadinessBar({ score }: { score: number }) {
  const color = score >= 5 ? "bg-emerald-500" : score >= 3 ? "bg-amber-500" : "bg-rose-500";
  const pct = (score / 5) * 100;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-20 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
      <span className={`text-xs font-bold ${score >= 5 ? "text-emerald-600" : score >= 3 ? "text-amber-600" : "text-rose-600"}`}>
        {score}/5
      </span>
    </div>
  );
}

function ExpandedBrdDetail({ brd }: { brd: ApprovedBrd }) {
  const doc = brd.content;
  if (!doc?.sections) return null;
  const s = doc.sections;

  return (
    <div className="border-t border-slate-100 bg-gradient-to-b from-slate-50/60 to-white px-6 pb-8 pt-6">
      <div className="grid gap-5 lg:grid-cols-2">

        {/* Executive Summary */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-[10px] font-bold text-white">1</div>
            <BarChart3 className="size-3.5 text-indigo-500" />
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Executive Summary</h4>
          </div>
          <p className="text-sm leading-relaxed text-slate-600">{s.executive_summary?.text}</p>
        </div>

        {/* Objective */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-[10px] font-bold text-white">2</div>
            <BookOpen className="size-3.5 text-violet-500" />
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Business Objective</h4>
          </div>
          <p className="text-sm leading-relaxed text-slate-600 mb-3">{s.objective?.text}</p>
          <ul className="space-y-1.5">
            {(s.objective?.goals || []).map((g: string, i: number) => (
              <li key={i} className="flex items-start gap-2">
                <CheckCircle2 className="size-3.5 mt-0.5 shrink-0 text-violet-400" />
                <span className="text-xs text-slate-600">{g}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Scope */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-sky-600 text-[10px] font-bold text-white">3</div>
            <Info className="size-3.5 text-sky-500" />
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Scope</h4>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 mb-2">✓ In Scope</p>
              <ul className="space-y-1">
                {(s.scope?.in_scope || []).map((item: string, i: number) => (
                  <li key={i} className="flex gap-1.5 items-start text-xs text-slate-600">
                    <span className="mt-1.5 size-1 shrink-0 rounded-full bg-emerald-400" />{item}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider text-rose-600 mb-2">✗ Out of Scope</p>
              <ul className="space-y-1">
                {(s.scope?.out_of_scope || []).map((item: string, i: number) => (
                  <li key={i} className="flex gap-1.5 items-start text-xs text-slate-500">
                    <span className="mt-1.5 size-1 shrink-0 rounded-full bg-rose-400" />{item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        {/* Functional Requirements */}
        {s.functional_requirements?.items?.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-[10px] font-bold text-white">5</div>
              <ClipboardList className="size-3.5 text-emerald-500" />
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Functional Requirements</h4>
              <span className="ml-auto text-xs text-slate-400">{s.functional_requirements.items.length} items</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="py-2 pr-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 w-14">ID</th>
                    <th className="py-2 pr-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">Requirement</th>
                    <th className="py-2 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400 w-28">Priority</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {s.functional_requirements.items.map((fr: { id: string; description: string; priority: string }) => (
                    <tr key={fr.id}>
                      <td className="py-2.5 pr-3 font-mono text-xs font-bold text-indigo-600">{fr.id}</td>
                      <td className="py-2.5 pr-3 text-slate-700 leading-relaxed text-xs">{fr.description}</td>
                      <td className="py-2.5">
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${PRIORITY_COLORS[fr.priority] ?? PRIORITY_COLORS["Must Have"]}`}>
                          {fr.priority}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Risk Register */}
        {s.risk_register?.items?.length > 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
            <div className="mb-3 flex items-center gap-2">
              <div className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-rose-600 text-[10px] font-bold text-white">7</div>
              <ShieldAlert className="size-3.5 text-rose-500" />
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Risk Register</h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    {["ID", "Risk", "Impact", "Probability", "Mitigation"].map(h => (
                      <th key={h} className="py-2 pr-3 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {s.risk_register.items.map((r: { id: string; description: string; impact: string; probability: string; mitigation: string }) => (
                    <tr key={r.id}>
                      <td className="py-2 pr-3 font-mono text-xs font-bold text-rose-500">{r.id}</td>
                      <td className="py-2 pr-3 text-xs text-slate-700 leading-relaxed">{r.description}</td>
                      <td className="py-2 pr-3"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${IMPACT_COLORS[r.impact] ?? IMPACT_COLORS.Medium}`}>{r.impact}</span></td>
                      <td className="py-2 pr-3"><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${IMPACT_COLORS[r.probability] ?? IMPACT_COLORS.Medium}`}>{r.probability}</span></td>
                      <td className="py-2 text-xs text-slate-600 leading-relaxed">{r.mitigation}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Readiness */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex size-6 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-[10px] font-bold text-white">9</div>
            <CheckCircle2 className="size-3.5 text-emerald-500" />
            <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">BRD Readiness Assessment</h4>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex flex-col items-center rounded-2xl bg-slate-50 p-5 shrink-0">
              <span className={`text-4xl font-black ${s.brd_readiness?.score >= 5 ? "text-emerald-500" : s.brd_readiness?.score >= 3 ? "text-amber-500" : "text-rose-500"}`}>
                {s.brd_readiness?.score}/5
              </span>
              <span className="text-[10px] text-slate-500 mt-1">Readiness</span>
            </div>
            <div>
              <p className={`text-sm font-bold mb-3 ${s.brd_readiness?.score >= 5 ? "text-emerald-600" : s.brd_readiness?.score >= 3 ? "text-amber-600" : "text-rose-600"}`}>
                {s.brd_readiness?.readinessLevel}
              </p>
              <ul className="grid sm:grid-cols-2 gap-1.5">
                {(s.brd_readiness?.checks || []).map((c: { label: string; pass: boolean }) => (
                  <li key={c.label} className="flex items-center gap-2">
                    {c.pass
                      ? <CheckCircle2 className="size-3.5 shrink-0 text-emerald-500" />
                      : <XCircle className="size-3.5 shrink-0 text-slate-300" />}
                    <span className={`text-xs ${c.pass ? "text-slate-700" : "text-slate-400"}`}>{c.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── FRD Staged Modal ──────────────────────────────────────────────────────────

type Stage1Result = {
  score: number;
  readiness_level: string;
  summary: string;
  strengths: string[];
  gaps: string[];
  technical_questions: string[];
  recommendation: string;
};

type Stage2Result = {
  summary: string;
  in_scope_components: { component: string; rationale: string }[];
  out_of_scope_components: { component: string; rationale: string }[];
  integration_points: { system: string; type: string; description: string }[];
  data_domains: string[];
  ambiguities: string[];
};

type Stage3Result = {
  summary: string;
  system_modules: { name: string; responsibility: string; brd_refs: string[] }[];
  data_flow: { step: number; from: string; to: string; description: string }[];
  api_contracts: { endpoint: string; purpose: string; consumed_by: string }[];
  technology_constraints: string[];
  open_decisions: string[];
};

const STAGE_LABELS = ["BRD Readiness", "Technical Scope", "Architecture", "Generate FRD"];

function StageBar({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0 px-6 py-4 border-b border-slate-100">
      {STAGE_LABELS.map((label, i) => {
        const done    = i < current;
        const active  = i === current;
        const locked  = i > current;
        return (
          <div key={label} className="flex items-center flex-1 last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <div className={`flex size-7 items-center justify-center rounded-full text-[11px] font-bold border-2 transition-all ${
                done   ? "bg-emerald-500 border-emerald-500 text-white" :
                active ? "bg-violet-600 border-violet-600 text-white" :
                         "bg-white border-slate-200 text-slate-400"
              }`}>
                {done ? <CheckCheck className="size-3.5" /> : i + 1}
              </div>
              <span className={`text-[9px] font-semibold whitespace-nowrap ${
                active ? "text-violet-600" : done ? "text-emerald-600" : "text-slate-400"
              }`}>{label}</span>
            </div>
            {i < STAGE_LABELS.length - 1 && (
              <div className={`flex-1 h-0.5 mb-4 mx-1 ${done ? "bg-emerald-400" : "bg-slate-100"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function FrdStagedModal({ brd, onClose, onGenerated }: {
  brd: ApprovedBrd;
  onClose: () => void;
  onGenerated: (docId: string) => void;
}) {
  const [stage, setStage]           = useState(0);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [stage1, setStage1]         = useState<Stage1Result | null>(null);
  const [stage2, setStage2]         = useState<Stage2Result | null>(null);
  const [stage3, setStage3]         = useState<Stage3Result | null>(null);
  const [generating, setGenerating] = useState(false);

  const call = useCallback(async (path: string, body?: object) => {
    const token = await ensureAuth();
    const res = await fetch(`${API}/api/stream/brd-documents/${brd.id}/${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || "Request failed");
    return data;
  }, [brd.id]);

  const runStage1 = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await call("frd-stage-1");
      setStage1(data);
      setStage(1);
    } catch (e) { setError(e instanceof Error ? e.message : "Stage 1 failed"); }
    finally { setLoading(false); }
  }, [call]);

  const runStage2 = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await call("frd-stage-2");
      setStage2(data);
      setStage(2);
    } catch (e) { setError(e instanceof Error ? e.message : "Stage 2 failed"); }
    finally { setLoading(false); }
  }, [call]);

  const runStage3 = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const data = await call("frd-stage-3", { approvedScope: stage2 });
      setStage3(data);
      setStage(3);
    } catch (e) { setError(e instanceof Error ? e.message : "Stage 3 failed"); }
    finally { setLoading(false); }
  }, [call, stage2]);

  const runGenerate = useCallback(async () => {
    setGenerating(true); setError(null);
    try {
      const token = await ensureAuth();
      const res = await fetch(`${API}/api/stream/brd-documents/${brd.id}/generate-frd`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Generation failed");
      onGenerated(data.meta?.doc_id ?? "");
    } catch (e) { setError(e instanceof Error ? e.message : "Generation failed"); }
    finally { setGenerating(false); }
  }, [brd.id, onGenerated]);

  const scoreColor = stage1
    ? stage1.score >= 75 ? "text-emerald-600" : stage1.score >= 50 ? "text-amber-600" : "text-rose-600"
    : "";
  const scoreBg = stage1
    ? stage1.score >= 75 ? "bg-emerald-50 border-emerald-200" : stage1.score >= 50 ? "bg-amber-50 border-amber-200" : "bg-rose-50 border-rose-200"
    : "";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex h-full max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">

        {/* Top accent */}
        <div className="h-1 w-full bg-gradient-to-r from-violet-500 to-indigo-500 shrink-0" />

        {/* Header */}
        <div className="flex shrink-0 items-center justify-between px-6 pt-4 pb-3">
          <div>
            <p className="text-base font-bold text-slate-800">Generate FRD</p>
            <p className="text-[11px] text-slate-400">{brd.doc_id} · {brd.request_title}</p>
          </div>
          <button onClick={onClose} className="flex size-8 items-center justify-center rounded-xl border border-slate-200 text-slate-400 hover:bg-slate-100">
            <X className="size-4" />
          </button>
        </div>

        {/* Stage bar */}
        <StageBar current={stage} />

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">

          {error && (
            <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3">
              <AlertCircle className="size-4 shrink-0 text-rose-500" />
              <p className="text-sm text-rose-700">{error}</p>
            </div>
          )}

          {/* Stage 0 — kick off */}
          {stage === 0 && !loading && (
            <div className="flex flex-col items-center gap-4 py-8 text-center">
              <div className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-lg shadow-violet-200">
                <Layers className="size-8 text-white" />
              </div>
              <div>
                <p className="text-base font-bold text-slate-800">3-Stage FRD Pre-check</p>
                <p className="mt-1 text-sm text-slate-500 max-w-sm leading-relaxed">
                  Before generating the FRD, the AI will run 3 checks — readiness, technical scope, and architecture — for your review.
                </p>
              </div>
              <div className="mt-2 grid grid-cols-3 gap-3 w-full text-left">
                {[
                  { icon: <CheckCircle2 className="size-4 text-violet-500" />, label: "Stage 1", desc: "BRD Readiness Check" },
                  { icon: <GitBranch   className="size-4 text-violet-500" />, label: "Stage 2", desc: "Technical Scope" },
                  { icon: <Database    className="size-4 text-violet-500" />, label: "Stage 3", desc: "System Architecture" },
                ].map(s => (
                  <div key={s.label} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                    {s.icon}
                    <p className="text-[10px] font-bold text-slate-500 uppercase mt-2">{s.label}</p>
                    <p className="text-xs font-semibold text-slate-700 mt-0.5">{s.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center gap-3 py-12">
              <Loader2 className="size-7 animate-spin text-violet-500" />
              <p className="text-sm text-slate-500">
                {stage === 0 ? "Running BRD readiness check…" :
                 stage === 1 ? "Defining technical scope…" :
                               "Generating architecture overview…"}
              </p>
            </div>
          )}

          {/* Stage 1 result */}
          {stage === 1 && stage1 && !loading && (
            <div className="space-y-4">
              <div className={`flex items-center gap-4 rounded-2xl border p-4 ${scoreBg}`}>
                <div className="shrink-0 text-center">
                  <p className={`text-4xl font-black ${scoreColor}`}>{stage1.score}</p>
                  <p className="text-[10px] text-slate-500">/ 100</p>
                </div>
                <div>
                  <p className={`text-sm font-bold ${scoreColor}`}>{stage1.readiness_level}</p>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">{stage1.summary}</p>
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 mb-2">Strengths</p>
                  <ul className="space-y-1.5">
                    {stage1.strengths.map((s, i) => (
                      <li key={i} className="flex gap-2 text-xs text-slate-700">
                        <CheckCircle2 className="size-3.5 shrink-0 text-emerald-500 mt-0.5" />{s}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600 mb-2">Gaps</p>
                  <ul className="space-y-1.5">
                    {stage1.gaps.map((g, i) => (
                      <li key={i} className="flex gap-2 text-xs text-slate-700">
                        <AlertTriangle className="size-3.5 shrink-0 text-amber-500 mt-0.5" />{g}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {stage1.technical_questions.length > 0 && (
                <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600 mb-2">Questions to Consider</p>
                  <ul className="space-y-1.5">
                    {stage1.technical_questions.map((q, i) => (
                      <li key={i} className="flex gap-2 text-xs text-slate-700">
                        <span className="size-4 flex shrink-0 items-center justify-center rounded-full bg-blue-200 text-blue-700 font-bold text-[9px]">{i+1}</span>{q}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold ${
                stage1.recommendation === "Proceed"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : stage1.recommendation === "Proceed with caution"
                  ? "border-amber-200 bg-amber-50 text-amber-700"
                  : "border-rose-200 bg-rose-50 text-rose-700"
              }`}>
                <Info className="size-3.5 shrink-0" />
                Recommendation: {stage1.recommendation}
              </div>
            </div>
          )}

          {/* Stage 2 result */}
          {stage === 2 && stage2 && !loading && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 leading-relaxed">{stage2.summary}</p>

              <div className="grid sm:grid-cols-2 gap-3">
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 mb-2">In-Scope Components</p>
                  <ul className="space-y-2">
                    {stage2.in_scope_components.map((c, i) => (
                      <li key={i}>
                        <p className="text-xs font-semibold text-slate-800">{c.component}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">{c.rationale}</p>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="rounded-xl border border-rose-100 bg-rose-50/60 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-rose-600 mb-2">Out-of-Scope</p>
                  <ul className="space-y-2">
                    {stage2.out_of_scope_components.map((c, i) => (
                      <li key={i}>
                        <p className="text-xs font-semibold text-slate-800">{c.component}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">{c.rationale}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {stage2.integration_points.length > 0 && (
                <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-blue-600 mb-2">Integration Points</p>
                  <div className="space-y-2">
                    {stage2.integration_points.map((ip, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="rounded-full bg-blue-200 px-2 py-0.5 text-[9px] font-bold text-blue-700 shrink-0">{ip.type}</span>
                        <div>
                          <p className="text-xs font-semibold text-slate-800">{ip.system}</p>
                          <p className="text-[10px] text-slate-500">{ip.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {stage2.data_domains.length > 0 && (
                <div className="rounded-xl border border-violet-100 bg-violet-50/60 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-violet-600 mb-2">Data Domains</p>
                  <div className="flex flex-wrap gap-1.5">
                    {stage2.data_domains.map((d, i) => (
                      <span key={i} className="rounded-full bg-violet-100 px-2.5 py-1 text-[11px] font-semibold text-violet-700">{d}</span>
                    ))}
                  </div>
                </div>
              )}

              {stage2.ambiguities.length > 0 && (
                <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600 mb-2">Ambiguities</p>
                  <ul className="space-y-1">
                    {stage2.ambiguities.map((a, i) => (
                      <li key={i} className="flex gap-2 text-xs text-slate-700">
                        <AlertTriangle className="size-3.5 shrink-0 text-amber-500 mt-0.5" />{a}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Stage 3 result */}
          {stage === 3 && stage3 && !loading && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 leading-relaxed">{stage3.summary}</p>

              {stage3.system_modules.length > 0 && (
                <div className="rounded-xl border border-violet-100 bg-violet-50/60 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-violet-600 mb-2">System Modules</p>
                  <div className="space-y-2">
                    {stage3.system_modules.map((m, i) => (
                      <div key={i} className="rounded-lg bg-white border border-violet-100 px-3 py-2">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-xs font-bold text-slate-800">{m.name}</p>
                          <div className="flex gap-1">
                            {m.brd_refs.map(r => <span key={r} className="rounded bg-violet-100 px-1.5 text-[9px] font-bold text-violet-600">{r}</span>)}
                          </div>
                        </div>
                        <p className="text-[10px] text-slate-500">{m.responsibility}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {stage3.data_flow.length > 0 && (
                <div className="rounded-xl border border-sky-100 bg-sky-50/60 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-sky-600 mb-2">Data Flow</p>
                  <ol className="space-y-1.5">
                    {stage3.data_flow.map((f, i) => (
                      <li key={i} className="flex gap-2 text-xs text-slate-700 items-start">
                        <span className="size-4 flex shrink-0 items-center justify-center rounded-full bg-sky-200 text-sky-700 font-bold text-[9px]">{f.step}</span>
                        <span><span className="font-semibold">{f.from}</span> → <span className="font-semibold">{f.to}</span>: {f.description}</span>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {stage3.api_contracts.length > 0 && (
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-600 mb-2">API Contracts</p>
                  <div className="space-y-1.5">
                    {stage3.api_contracts.map((a, i) => (
                      <div key={i} className="flex items-start gap-2">
                        <code className="shrink-0 rounded bg-indigo-100 px-1.5 py-0.5 text-[10px] font-mono text-indigo-700">{a.endpoint}</code>
                        <p className="text-[10px] text-slate-600">{a.purpose} — <span className="text-slate-400">consumed by {a.consumed_by}</span></p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {stage3.open_decisions.length > 0 && (
                <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-3">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600 mb-2">Open Decisions</p>
                  <ul className="space-y-1">
                    {stage3.open_decisions.map((d, i) => (
                      <li key={i} className="flex gap-2 text-xs text-slate-700">
                        <AlertTriangle className="size-3.5 shrink-0 text-amber-500 mt-0.5" />{d}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="shrink-0 flex items-center justify-between border-t border-slate-100 px-6 py-4">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
          >
            <ArrowLeft className="size-4" /> Cancel
          </button>

          <div className="flex items-center gap-2">
            {/* Stage 0 → run stage 1 */}
            {stage === 0 && !loading && (
              <button onClick={runStage1} className="flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2 text-sm font-semibold text-white hover:bg-violet-700 transition-colors">
                Start Check <ChevronRight className="size-4" />
              </button>
            )}
            {/* Stage 1 → approve, go to stage 2 */}
            {stage === 1 && !loading && (
              <button onClick={runStage2} className="flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2 text-sm font-semibold text-white hover:bg-violet-700 transition-colors">
                Approve & Define Scope <ChevronRight className="size-4" />
              </button>
            )}
            {/* Stage 2 → approve, go to stage 3 */}
            {stage === 2 && !loading && (
              <button onClick={runStage3} className="flex items-center gap-2 rounded-xl bg-violet-600 px-5 py-2 text-sm font-semibold text-white hover:bg-violet-700 transition-colors">
                Approve & Review Architecture <ChevronRight className="size-4" />
              </button>
            )}
            {/* Stage 3 → generate */}
            {stage === 3 && !loading && (
              <button
                onClick={runGenerate}
                disabled={generating}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:opacity-90 transition-opacity disabled:opacity-60"
              >
                {generating ? <Loader2 className="size-4 animate-spin" /> : <Wand2 className="size-4" />}
                {generating ? "Generating FRD…" : "Generate FRD"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ApprovedBrdsPage() {
  const [brds, setBrds] = useState<ApprovedBrd[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "Approved" | "Final">("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [pdfLoadingId, setPdfLoadingId] = useState<number | null>(null);
  const [frdModalBrd, setFrdModalBrd]   = useState<ApprovedBrd | null>(null);
  const [frdSuccess, setFrdSuccess]     = useState<string | null>(null);

  const fetchBrds = useCallback(async () => {
    setLoading(true);
    try {
      const token = await ensureAuth();
      const res = await fetch(`${API}/api/stream/approved-brds`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setBrds(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchBrds(); }, [fetchBrds]);

  const handleFrdGenerated = useCallback((docId: string) => {
    setFrdModalBrd(null);
    setFrdSuccess(`FRD generated: ${docId}. View it in FRD Management.`);
    setTimeout(() => setFrdSuccess(null), 6000);
  }, []);

  const openPdf = useCallback((brd: ApprovedBrd) => {
    if (!brd.content) return;
    const win = window.open("", "_blank");
    if (!win) { alert("Allow popups to view the BRD PDF."); return; }
    setPdfLoadingId(brd.id);
    try {
      win.document.open();
      win.document.write(buildPdfHtml(brd.content));
      win.document.close();
    } finally {
      setPdfLoadingId(null);
    }
  }, []);

  const filtered = brds.filter(b => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      b.doc_id?.toLowerCase().includes(q) ||
      b.title?.toLowerCase().includes(q) ||
      b.request_title?.toLowerCase().includes(q) ||
      b.req_number?.toLowerCase().includes(q) ||
      b.author_name?.toLowerCase().includes(q);
    const matchStatus = statusFilter === "all" || b.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const stats = {
    total: brds.length,
    approved: brds.filter(b => b.status === "Approved").length,
    final: brds.filter(b => b.status === "Final").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-md shadow-emerald-200">
            <FileCheck2 className="size-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Approved BRDs</h1>
            <p className="text-xs text-slate-500">Stakeholder-approved Business Requirements Documents ready for implementation</p>
          </div>
        </div>
        <button
          onClick={fetchBrds}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-sm hover:bg-slate-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-slate-500 to-slate-600 shadow-sm">
            <FileText className="size-4 text-white" />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-800">{stats.total}</p>
            <p className="text-xs text-slate-500">Total BRDs</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-violet-200 bg-violet-50 p-4 shadow-sm">
          <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-violet-600 shadow-sm">
            <CheckCircle2 className="size-4 text-white" />
          </div>
          <div>
            <p className="text-2xl font-bold text-violet-700">{stats.approved}</p>
            <p className="text-xs text-violet-500">Approved</p>
          </div>
        </div>
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-sm">
            <Crown className="size-4 text-white" />
          </div>
          <div>
            <p className="text-2xl font-bold text-emerald-700">{stats.final}</p>
            <p className="text-xs text-emerald-500">Sent to IT</p>
          </div>
        </div>
      </div>

      {/* FRD success toast */}
      {frdSuccess && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3 shadow-sm">
          <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
          <span className="text-sm font-medium text-emerald-800">{frdSuccess}</span>
          <a href="/it/frd-management" className="ml-auto flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-900">
            Open FRD Management <ArrowRight className="size-3" />
          </a>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="relative flex-1 min-w-52">
          <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by title, doc ID, request, author..."
            className="h-9 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-800 placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:bg-white transition-colors"
          />
        </div>
        <div className="flex items-center gap-1">
          <Filter className="size-3.5 text-slate-400" />
          {(["all", "Approved", "Final"] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-all ${
                statusFilter === s
                  ? s === "Approved" ? "bg-violet-600 text-white" : s === "Final" ? "bg-emerald-600 text-white" : "bg-slate-700 text-white"
                  : "text-slate-500 hover:bg-slate-100"
              }`}
            >
              {s === "all" ? "All" : s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-slate-400">
            <Loader2 className="size-5 animate-spin" />
            <span className="text-sm">Loading approved BRDs…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center px-6">
            <div className="mb-5 flex size-20 items-center justify-center rounded-3xl bg-gradient-to-br from-emerald-50 to-teal-100 border-2 border-dashed border-emerald-200">
              <FileCheck2 className="size-9 text-emerald-300" />
            </div>
            <p className="text-base font-bold text-slate-600">
              {brds.length === 0 ? "No approved BRDs yet" : "No results match your search"}
            </p>
            <p className="mt-2 text-sm text-slate-400 max-w-sm leading-relaxed">
              {brds.length === 0
                ? "Once stakeholders approve a BRD and the BA sends it to IT, it will appear here."
                : "Try adjusting your search or filter."}
            </p>
          </div>
        ) : (
          <>
            {/* Header row */}
            <div className="grid grid-cols-[1fr_2fr_1fr_1fr_1fr_1fr_auto] items-center gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3">
              {["Doc ID", "Request", "Category", "Priority", "Status", "Readiness", ""].map(h => (
                <div key={h} className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{h}</div>
              ))}
            </div>

            {/* BRD rows */}
            <div className="divide-y divide-slate-100">
              {filtered.map(brd => {
                const isExpanded = expandedId === brd.id;
                const score = parseInt(brd.readiness_score ?? "0");

                return (
                  <div key={brd.id}>
                    {/* Main row */}
                    <div
                      className={`grid grid-cols-[1fr_2fr_1fr_1fr_1fr_1fr_auto] items-center gap-4 px-5 py-4 transition-colors cursor-pointer ${isExpanded ? "bg-indigo-50/40" : "hover:bg-slate-50/70"}`}
                      onClick={() => setExpandedId(isExpanded ? null : brd.id)}
                    >
                      {/* Doc ID */}
                      <div>
                        <span className="font-mono text-xs font-bold text-indigo-600">{brd.doc_id}</span>
                        <p className="text-[10px] text-slate-400 mt-0.5 font-mono">v{brd.version}</p>
                      </div>

                      {/* Request */}
                      <div>
                        <p className="text-sm font-semibold text-slate-800 leading-snug line-clamp-1">{brd.request_title || brd.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="font-mono text-[10px] text-slate-400">{brd.req_number}</span>
                          <span className="text-[10px] text-slate-400">·</span>
                          <span className="text-[10px] text-slate-500">
                            {brd.author_name || brd.author_email}
                          </span>
                        </div>
                      </div>

                      {/* Category */}
                      <div className="text-xs text-slate-600 line-clamp-1">{brd.category || brd.req_category}</div>

                      {/* Priority */}
                      <div>
                        <span className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
                          <span className={`size-1.5 rounded-full shrink-0 ${PRIORITY_DOT[brd.priority || brd.req_priority] ?? "bg-slate-300"}`} />
                          {brd.priority || brd.req_priority}
                        </span>
                      </div>

                      {/* Status */}
                      <div>
                        <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-bold ${STATUS_COLORS[brd.status] ?? STATUS_COLORS.Approved}`}>
                          {brd.status === "Final" && <Crown className="size-2.5 mr-1" />}
                          {brd.status}
                        </span>
                        {brd.submitted_at && (
                          <p className="text-[10px] text-slate-400 mt-1">
                            Sent {new Date(brd.submitted_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                          </p>
                        )}
                      </div>

                      {/* Readiness */}
                      <div>
                        <ReadinessBar score={score} />
                        <p className="text-[10px] text-slate-400 mt-1">
                          {brd.reviews_approved}/{brd.reviews_total} approved
                        </p>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => openPdf(brd)}
                          disabled={pdfLoadingId === brd.id}
                          title="Open BRD as PDF"
                          className="flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors disabled:opacity-50"
                        >
                          {pdfLoadingId === brd.id
                            ? <Loader2 className="size-3.5 animate-spin" />
                            : <Printer className="size-3.5" />}
                          PDF
                        </button>
                        <button
                          onClick={() => setFrdModalBrd(brd)}
                          title="Generate FRD from this approved BRD"
                          className="flex items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 hover:bg-violet-100 transition-colors"
                        >
                          <Wand2 className="size-3.5" />
                          Generate FRD
                        </button>
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : brd.id)}
                          className="flex size-8 items-center justify-center rounded-xl border border-slate-200 text-slate-400 hover:bg-slate-100 transition-colors"
                        >
                          {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Expanded detail */}
                    {isExpanded && <ExpandedBrdDetail brd={brd} />}
                  </div>
                );
              })}
            </div>

            <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-400">
              Showing {filtered.length} of {brds.length} approved BRDs
            </div>
          </>
        )}
      </div>

      {frdModalBrd && (
        <FrdStagedModal
          brd={frdModalBrd}
          onClose={() => setFrdModalBrd(null)}
          onGenerated={handleFrdGenerated}
        />
      )}
    </div>
  );
}
