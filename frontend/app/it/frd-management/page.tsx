"use client";

import { useEffect, useState, useCallback } from "react";
import {
  FolderOpen, RefreshCw, Loader2, ChevronDown, ChevronUp,
  FileText, CheckCircle2, XCircle, ClipboardList, BookOpen,
  Shield, Database, Monitor, GitBranch, Search, Filter,
  Wand2, ArrowRight, Tag, Zap, AlertTriangle, Users, FileDown,
} from "lucide-react";
import { downloadFRDAsPDF } from "@/lib/pdfExport";
import { ensureAuth } from "@/lib/authGuard";

const API = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5001";

interface FrdListItem {
  id: number;
  doc_id: string;
  version: string;
  status: string;
  title: string;
  category: string;
  priority: string;
  brd_doc_id: string;
  request_id: number;
  request_title: string;
  req_number: string;
  brd_id: number;
  tc_count: string;
  author_name: string | null;
  author_email: string;
  generated_at: string;
  updated_at: string;
}

interface FrdDoc {
  meta: {
    doc_id: string; brd_doc_id: string; title: string; version: string;
    status: string; category: string; priority: string; effective_date: string;
    generated_at: string; request_number: string; ai_note: string;
  };
  sections: {
    overview: { title: string; purpose: string; scope: string; audience: string };
    functional_specifications: { title: string; items: FsItem[] };
    system_behavior: { title: string; workflows: WorkflowItem[] };
    data_requirements: { title: string; entities: EntityItem[] };
    ui_requirements: { title: string; screens: ScreenItem[] };
    integration_requirements: { title: string; items: IntItem[] };
    non_functional_requirements: { title: string; items: NfrItem[] };
    traceability_matrix: { title: string; mappings: TraceItem[] };
  };
  _db_id?: number;
}

interface FsItem { id: string; brd_ref: string; title: string; description: string; priority: string; acceptance_criteria: string[]; business_rules: string[] }
interface WorkflowItem { id: string; name: string; trigger: string; steps: string[]; expected_outcome: string }
interface EntityItem { name: string; attributes: string[]; constraints: string[] }
interface ScreenItem { name: string; description: string; components: string[] }
interface IntItem { id: string; system: string; type: string; description: string }
interface NfrItem { id: string; category: string; requirement: string; metric: string }
interface TraceItem { brd_ref: string; frd_ref: string; description: string }

const STATUS_CFG: Record<string, { color: string; bg: string; border: string }> = {
  Draft:       { color: "text-amber-700",   bg: "bg-amber-50",   border: "border-amber-200" },
  "In Review": { color: "text-blue-700",    bg: "bg-blue-50",    border: "border-blue-200" },
  Approved:    { color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
  Final:       { color: "text-violet-700",  bg: "bg-violet-50",  border: "border-violet-200" },
};

const PRIORITY_DOT: Record<string, string> = {
  Critical: "bg-rose-500", High: "bg-orange-500", Medium: "bg-amber-400", Low: "bg-emerald-400",
  "Must Have": "bg-rose-500", "Should Have": "bg-orange-400", "Could Have": "bg-amber-400",
};

const NFR_ICON: Record<string, React.ReactNode> = {
  Performance:     <Zap className="size-3 text-amber-500" />,
  Security:        <Shield className="size-3 text-rose-500" />,
  Availability:    <CheckCircle2 className="size-3 text-emerald-500" />,
  Scalability:     <Zap className="size-3 text-blue-500" />,
  Maintainability: <GitBranch className="size-3 text-violet-500" />,
  Usability:       <Users className="size-3 text-sky-500" />,
  Compatibility:   <Monitor className="size-3 text-slate-500" />,
};

function SectionCard({ number, icon, title, children }: { number: string; icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <div className="flex size-7 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-[11px] font-bold text-white">{number}</div>
        {icon}
        <h4 className="text-sm font-bold text-slate-800">{title}</h4>
        <div className="flex-1 h-px bg-slate-100" />
      </div>
      {children}
    </div>
  );
}

function FrdDetail({ doc }: { doc: FrdDoc }) {
  const s = doc.sections;
  const PRIORITY_COLORS: Record<string, string> = {
    "Must Have": "bg-rose-100 text-rose-700 border-rose-200",
    "Should Have": "bg-amber-100 text-amber-700 border-amber-200",
    "Could Have": "bg-sky-100 text-sky-700 border-sky-200",
  };

  return (
    <div className="border-t border-slate-100 bg-gradient-to-b from-slate-50/60 to-white px-6 pb-8 pt-6 space-y-4">

      {/* Toolbar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-start gap-2 flex-1 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertTriangle className="size-4 shrink-0 text-amber-500 mt-0.5" />
          <p className="text-xs text-amber-700">{doc.meta.ai_note}</p>
        </div>
        <button
          onClick={() => downloadFRDAsPDF(doc)}
          className="flex shrink-0 items-center gap-1.5 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2.5 text-xs font-semibold text-violet-700 hover:bg-violet-100 transition-colors"
        >
          <FileDown className="size-3.5" />
          Download PDF
        </button>
      </div>

      {/* Overview */}
      <SectionCard number="1" icon={<BookOpen className="size-4 text-violet-500" />} title={s.overview.title}>
        <div className="space-y-3">
          <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Purpose</p><p className="text-sm text-slate-600 leading-relaxed">{s.overview.purpose}</p></div>
          <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Scope</p><p className="text-sm text-slate-600 leading-relaxed">{s.overview.scope}</p></div>
          <div><p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">Audience</p><p className="text-sm text-slate-600">{s.overview.audience}</p></div>
        </div>
      </SectionCard>

      {/* Functional Specifications */}
      <SectionCard number="2" icon={<ClipboardList className="size-4 text-emerald-500" />} title={s.functional_specifications.title}>
        <div className="space-y-4">
          {s.functional_specifications.items.map(fs => (
            <div key={fs.id} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold text-violet-600">{fs.id}</span>
                  <span className="text-[10px] text-slate-400">←</span>
                  <span className="font-mono text-[10px] text-slate-400">{fs.brd_ref}</span>
                </div>
                <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${PRIORITY_COLORS[fs.priority] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>{fs.priority}</span>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed mb-3">{fs.description}</p>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 mb-1.5">✓ Acceptance Criteria</p>
                  <ul className="space-y-1">{fs.acceptance_criteria.slice(0, 3).map((c, i) => <li key={i} className="flex gap-1.5 text-xs text-slate-600"><CheckCircle2 className="size-3 shrink-0 text-emerald-400 mt-0.5" />{c}</li>)}</ul>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-blue-600 mb-1.5">⚡ Business Rules</p>
                  <ul className="space-y-1">{fs.business_rules.slice(0, 2).map((r, i) => <li key={i} className="flex gap-1.5 text-xs text-slate-600"><span className="size-1 rounded-full bg-blue-400 shrink-0 mt-1.5" />{r}</li>)}</ul>
                </div>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* System Behavior */}
      <SectionCard number="3" icon={<GitBranch className="size-4 text-blue-500" />} title={s.system_behavior.title}>
        <div className="space-y-3">
          {s.system_behavior.workflows.map(wf => (
            <div key={wf.id} className="rounded-xl border border-blue-100 bg-blue-50/40 p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="font-mono text-xs font-bold text-blue-600">{wf.id}</span>
                <p className="text-sm font-semibold text-slate-800">{wf.name}</p>
              </div>
              <p className="text-xs text-slate-500 mb-2"><span className="font-semibold">Trigger:</span> {wf.trigger}</p>
              <ol className="space-y-1 mb-2 pl-1">
                {wf.steps.map((step, i) => <li key={i} className="flex gap-2 text-xs text-slate-600"><span className="size-4 shrink-0 flex items-center justify-center rounded-full bg-blue-200 text-blue-700 font-bold text-[9px]">{i + 1}</span>{step}</li>)}
              </ol>
              <p className="text-xs text-emerald-700 font-medium">✓ {wf.expected_outcome}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Data Requirements */}
      <SectionCard number="4" icon={<Database className="size-4 text-sky-500" />} title={s.data_requirements.title}>
        <div className="grid sm:grid-cols-2 gap-3">
          {s.data_requirements.entities.map(e => (
            <div key={e.name} className="rounded-xl border border-sky-100 bg-sky-50/40 p-3">
              <p className="text-xs font-bold text-sky-700 mb-2">{e.name}</p>
              <div className="mb-2">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Attributes</p>
                <div className="flex flex-wrap gap-1">{e.attributes.slice(0, 6).map(a => <span key={a} className="rounded-md bg-sky-100 px-1.5 py-0.5 text-[10px] text-sky-700 font-mono">{a}</span>)}</div>
              </div>
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Constraints</p>
                <ul className="space-y-0.5">{e.constraints.slice(0, 2).map((c, i) => <li key={i} className="text-[10px] text-slate-500">• {c}</li>)}</ul>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* UI Requirements */}
      <SectionCard number="5" icon={<Monitor className="size-4 text-indigo-500" />} title={s.ui_requirements.title}>
        <div className="space-y-3">
          {s.ui_requirements.screens.map(sc => (
            <div key={sc.name} className="rounded-xl border border-indigo-100 bg-indigo-50/30 p-3">
              <p className="text-xs font-bold text-indigo-700 mb-1">{sc.name}</p>
              <p className="text-xs text-slate-600 mb-2">{sc.description}</p>
              <div className="flex flex-wrap gap-1">{sc.components.map(c => <span key={c} className="rounded-md bg-indigo-100 px-2 py-0.5 text-[10px] text-indigo-700">{c}</span>)}</div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Integration Requirements */}
      <SectionCard number="6" icon={<GitBranch className="size-4 text-violet-500" />} title={s.integration_requirements.title}>
        <div className="space-y-2">
          {s.integration_requirements.items.map(int => (
            <div key={int.id} className="flex gap-3 rounded-xl border border-violet-100 bg-violet-50/30 p-3">
              <span className="font-mono text-xs font-bold text-violet-600 shrink-0 w-16">{int.id}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-xs font-bold text-slate-700">{int.system}</p>
                  <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] text-violet-600 font-semibold">{int.type}</span>
                </div>
                <p className="text-xs text-slate-600">{int.description}</p>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* NFRs */}
      <SectionCard number="7" icon={<Shield className="size-4 text-rose-500" />} title={s.non_functional_requirements.title}>
        <div className="grid sm:grid-cols-2 gap-2">
          {s.non_functional_requirements.items.map(nfr => (
            <div key={nfr.id} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex items-center gap-1.5 mb-1.5">
                {NFR_ICON[nfr.category] ?? <Zap className="size-3 text-slate-400" />}
                <span className="text-xs font-bold text-slate-700">{nfr.category}</span>
                <span className="font-mono text-[10px] text-slate-400 ml-auto">{nfr.id}</span>
              </div>
              <p className="text-xs text-slate-600 mb-1.5">{nfr.requirement}</p>
              <p className="text-[10px] text-emerald-700 font-mono bg-emerald-50 rounded px-2 py-1">{nfr.metric}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Traceability Matrix */}
      <SectionCard number="8" icon={<Tag className="size-4 text-slate-500" />} title={s.traceability_matrix.title}>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead><tr className="border-b border-slate-100">{["BRD Ref", "FRD Ref", "Description"].map(h => <th key={h} className="py-2 pr-4 text-left text-[10px] font-bold uppercase tracking-wider text-slate-400">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-50">
              {s.traceability_matrix.mappings.map(m => (
                <tr key={m.brd_ref}>
                  <td className="py-2 pr-4 font-mono font-bold text-rose-500">{m.brd_ref}</td>
                  <td className="py-2 pr-4 font-mono font-bold text-violet-600">{m.frd_ref}</td>
                  <td className="py-2 text-slate-600">{m.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
}

export default function FrdManagementPage() {
  const [frds, setFrds]               = useState<FrdListItem[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const [expandedId, setExpandedId]   = useState<number | null>(null);
  const [expandedDoc, setExpandedDoc] = useState<FrdDoc | null>(null);
  const [loadingDocId, setLoadingDocId] = useState<number | null>(null);
  const [generatingTcId, setGeneratingTcId] = useState<number | null>(null);
  const [tcSuccess, setTcSuccess]     = useState<string | null>(null);

  const fetchFrds = useCallback(async () => {
    setLoading(true);
    try {
      const token = await ensureAuth();
      const res = await fetch(`${API}/api/stream/frd-documents`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setFrds(await res.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchFrds(); }, [fetchFrds]);

  const toggleExpand = useCallback(async (id: number) => {
    if (expandedId === id) { setExpandedId(null); setExpandedDoc(null); return; }
    setExpandedId(id);
    setExpandedDoc(null);
    setLoadingDocId(id);
    try {
      const token = await ensureAuth();
      const res = await fetch(`${API}/api/stream/frd-documents/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setExpandedDoc(await res.json());
    } finally { setLoadingDocId(null); }
  }, [expandedId]);

  const generateTestCases = useCallback(async (frdId: number, docId: string) => {
    setGeneratingTcId(frdId);
    try {
      const token = await ensureAuth();
      const res = await fetch(`${API}/api/stream/frd-documents/${frdId}/generate-test-cases`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) { alert(data.message || "Failed to generate test cases"); return; }
      setTcSuccess(`${data.meta?.total_cases ?? "?"} test cases generated from ${docId}. View in Test Cases.`);
      setTimeout(() => setTcSuccess(null), 6000);
      fetchFrds();
    } finally { setGeneratingTcId(null); }
  }, [fetchFrds]);

  const filtered = frds.filter(f => {
    const q = search.toLowerCase();
    return !q || f.doc_id?.toLowerCase().includes(q) || f.title?.toLowerCase().includes(q) ||
      f.request_title?.toLowerCase().includes(q) || f.req_number?.toLowerCase().includes(q);
  });

  const stats = { total: frds.length, withTc: frds.filter(f => parseInt(f.tc_count) > 0).length };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-violet-700 shadow-md shadow-violet-200">
            <FolderOpen className="size-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">FRD Management</h1>
            <p className="text-xs text-slate-500">AI-generated Functional Requirements Documents from approved BRDs</p>
          </div>
        </div>
        <button onClick={fetchFrds} disabled={loading} className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-sm hover:bg-slate-50 transition-colors disabled:opacity-50">
          <RefreshCw className={`size-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          { label: "FRDs Generated", val: stats.total, color: "text-violet-700", bg: "bg-violet-50 border-violet-200", icon: <FolderOpen className="size-4 text-violet-600" /> },
          { label: "With Test Cases", val: stats.withTc, color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", icon: <CheckCircle2 className="size-4 text-emerald-600" /> },
          { label: "Pending Test Cases", val: stats.total - stats.withTc, color: "text-amber-700", bg: "bg-amber-50 border-amber-200", icon: <AlertTriangle className="size-4 text-amber-500" /> },
        ].map(({ label, val, color, bg, icon }) => (
          <div key={label} className={`flex items-center gap-3 rounded-2xl border p-4 shadow-sm ${bg}`}>
            <div className="flex size-10 items-center justify-center rounded-xl bg-white shadow-sm">{icon}</div>
            <div><p className={`text-2xl font-black ${color}`}>{val}</p><p className="text-xs text-slate-500">{label}</p></div>
          </div>
        ))}
      </div>

      {/* TC success toast */}
      {tcSuccess && (
        <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-3">
          <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
          <span className="text-sm font-medium text-emerald-800">{tcSuccess}</span>
          <a href="/it/test-cases" className="ml-auto flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-900">
            View Test Cases <ArrowRight className="size-3" />
          </a>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by doc ID, title, request…"
          className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-4 text-sm text-slate-800 placeholder:text-slate-400 focus:border-violet-400 focus:outline-none transition-colors shadow-sm" />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-slate-400"><Loader2 className="size-5 animate-spin" /><span className="text-sm">Loading FRDs…</span></div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
            <div className="mb-5 flex size-20 items-center justify-center rounded-3xl bg-gradient-to-br from-violet-50 to-violet-100 border-2 border-dashed border-violet-200">
              <FolderOpen className="size-9 text-violet-300" />
            </div>
            <p className="text-base font-bold text-slate-600">{frds.length === 0 ? "No FRDs generated yet" : "No results match"}</p>
            <p className="mt-2 text-sm text-slate-400 max-w-sm leading-relaxed">
              {frds.length === 0 ? "Open Approved BRDs and click Generate FRD to create an FRD from an approved BRD." : "Try a different search term."}
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-[1fr_2fr_1fr_1fr_auto] items-center gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3">
              {["Doc ID", "Request", "Status", "Test Cases", ""].map(h => (
                <div key={h} className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{h}</div>
              ))}
            </div>

            <div className="divide-y divide-slate-100">
              {filtered.map(frd => {
                const isExpanded = expandedId === frd.id;
                const sCfg = STATUS_CFG[frd.status] ?? STATUS_CFG.Draft;
                const tcCount = parseInt(frd.tc_count);

                return (
                  <div key={frd.id}>
                    <div
                      className={`grid grid-cols-[1fr_2fr_1fr_1fr_auto] items-center gap-4 px-5 py-4 cursor-pointer transition-colors ${isExpanded ? "bg-violet-50/40" : "hover:bg-slate-50/70"}`}
                      onClick={() => toggleExpand(frd.id)}
                    >
                      {/* Doc ID */}
                      <div>
                        <span className="font-mono text-xs font-bold text-violet-600">{frd.doc_id}</span>
                        <p className="text-[10px] text-slate-400 mt-0.5">v{frd.version} · from {frd.brd_doc_id}</p>
                      </div>

                      {/* Request */}
                      <div>
                        <p className="text-sm font-semibold text-slate-800 leading-snug line-clamp-1">{frd.request_title}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="font-mono text-[10px] text-slate-400">{frd.req_number}</span>
                          <span className="text-[10px] text-slate-400">·</span>
                          <span className="text-[10px] text-slate-500">{frd.author_name || frd.author_email}</span>
                        </div>
                      </div>

                      {/* Status */}
                      <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-bold ${sCfg.color} ${sCfg.bg} ${sCfg.border}`}>
                        {frd.status}
                      </span>

                      {/* Test Cases */}
                      <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                        {tcCount > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 border border-emerald-200 px-2.5 py-1 text-[10px] font-bold text-emerald-700">
                            <CheckCircle2 className="size-3" /> {tcCount} cases
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 italic">None yet</span>
                        )}
                        <button
                          onClick={() => generateTestCases(frd.id, frd.doc_id)}
                          disabled={generatingTcId === frd.id}
                          title="Generate test cases from this FRD"
                          className="flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1.5 text-[10px] font-bold text-sky-700 hover:bg-sky-100 transition-colors disabled:opacity-50"
                        >
                          {generatingTcId === frd.id ? <Loader2 className="size-3 animate-spin" /> : <Wand2 className="size-3" />}
                          {tcCount > 0 ? "Re-generate" : "Gen. TCs"}
                        </button>
                      </div>

                      {/* Expand toggle */}
                      <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                        <button onClick={() => toggleExpand(frd.id)} className="flex size-8 items-center justify-center rounded-xl border border-slate-200 text-slate-400 hover:bg-slate-100">
                          {loadingDocId === frd.id ? <Loader2 className="size-4 animate-spin" /> : isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      expandedDoc ? <FrdDetail doc={expandedDoc} /> : (
                        <div className="border-t border-slate-100 flex items-center justify-center py-10 text-slate-400">
                          <Loader2 className="size-5 animate-spin" />
                        </div>
                      )
                    )}
                  </div>
                );
              })}
            </div>

            <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-400">
              Showing {filtered.length} of {frds.length} FRD documents
            </div>
          </>
        )}
      </div>
    </div>
  );
}
