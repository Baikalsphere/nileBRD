"use client";

import { useEffect, useState, useCallback } from "react";
import {
  FileCheck2, RefreshCw, Loader2, ChevronDown, ChevronUp,
  FileText, Calendar, User, Tag, BarChart3, CheckCircle2,
  XCircle, ShieldAlert, ClipboardList, BookOpen, Printer,
  Crown, Search, Filter, ArrowUpRight, Info,
} from "lucide-react";
import { buildPdfHtml, type BrdDoc } from "@/lib/brdPdf";

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

export default function ApprovedBrdsPage() {
  const [brds, setBrds] = useState<ApprovedBrd[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "Approved" | "Final">("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [pdfLoadingId, setPdfLoadingId] = useState<number | null>(null);

  const fetchBrds = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("authToken");
      const res = await fetch(`${API}/api/stream/approved-brds`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setBrds(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchBrds(); }, [fetchBrds]);

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
    </div>
  );
}
