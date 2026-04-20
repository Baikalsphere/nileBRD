"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FlaskConical, CheckCircle2, XCircle, Clock, Rocket, Ban,
  AlertTriangle, ChevronDown, ChevronRight, ArrowLeft,
  RefreshCw, Search, Layers, Zap, Shield, Activity,
  Save, BarChart3, ListFilter, CalendarDays, TrendingUp,
  Lock, Unlock, Tag, Hash,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_BACKEND_URL;

type SITStatus = "Pending" | "In Progress" | "Pass" | "Fail" | "Blocked";

interface TcDoc {
  id: number;
  doc_id: string;
  title: string;
  total_cases: number;
  request_title: string;
  req_number: string;
  generated_at: string;
  sit_released: boolean;
  sit_pass_rate: number | null;
  sit_released_at: string | null;
  summary?: { system: number; integration: number; performance: number; security: number; uat: number };
}

interface SITCase {
  id: string;
  name: string;
  type: string;
  priority: string;
  description: string;
  steps: { step_num: number; action: string; expected: string }[];
  expected_result: string;
  preconditions?: string[];
}

interface SITData {
  sit_cases: SITCase[];
  uat_case_count: number;
  results: Record<string, { status: SITStatus; remarks: string }>;
  pass_rate: number;
  released: boolean;
  released_at: string | null;
}

// ─── Style maps ──────────────────────────────────────────────────────────────

const TYPE_CFG: Record<string, { color: string; bg: string; border: string; icon: React.ReactNode }> = {
  System:      { color: "text-violet-700", bg: "bg-violet-50",  border: "border-violet-200", icon: <Layers   className="w-3 h-3" /> },
  Integration: { color: "text-blue-700",   bg: "bg-blue-50",    border: "border-blue-200",   icon: <Zap      className="w-3 h-3" /> },
  Performance: { color: "text-amber-700",  bg: "bg-amber-50",   border: "border-amber-200",  icon: <Activity className="w-3 h-3" /> },
  Security:    { color: "text-rose-700",   bg: "bg-rose-50",    border: "border-rose-200",   icon: <Shield   className="w-3 h-3" /> },
};

const STATUS_CFG: Record<SITStatus, { color: string; bg: string; border: string; dot: string; icon: React.ReactNode }> = {
  Pending:       { color: "text-slate-500",   bg: "bg-slate-50",   border: "border-slate-200",   dot: "bg-slate-300",   icon: <Clock        className="w-3.5 h-3.5" /> },
  "In Progress": { color: "text-amber-700",   bg: "bg-amber-50",   border: "border-amber-200",   dot: "bg-amber-400",   icon: <Clock        className="w-3.5 h-3.5" /> },
  Pass:          { color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", dot: "bg-emerald-500", icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
  Fail:          { color: "text-red-700",     bg: "bg-red-50",     border: "border-red-200",     dot: "bg-red-500",     icon: <XCircle      className="w-3.5 h-3.5" /> },
  Blocked:       { color: "text-purple-700",  bg: "bg-purple-50",  border: "border-purple-200",  dot: "bg-purple-500",  icon: <Ban          className="w-3.5 h-3.5" /> },
};

const PRIORITY_CFG: Record<string, string> = {
  Critical: "bg-red-100 text-red-700 border-red-200",
  High:     "bg-orange-100 text-orange-700 border-orange-200",
  Medium:   "bg-yellow-100 text-yellow-700 border-yellow-200",
  Low:      "bg-slate-100 text-slate-600 border-slate-200",
};

function authHeader(): Record<string, string> {
  const t = localStorage.getItem("authToken");
  return t ? { Authorization: `Bearer ${t}` } : {};
}
function getUserRole() {
  try { const t = localStorage.getItem("authToken"); if (!t) return ""; return JSON.parse(atob(t.split(".")[1]))?.role ?? ""; }
  catch { return ""; }
}

function TypeBadge({ type }: { type: string }) {
  const c = TYPE_CFG[type] ?? { color: "text-slate-600", bg: "bg-slate-50", border: "border-slate-200", icon: null };
  return <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold border ${c.color} ${c.bg} ${c.border}`}>{c.icon}{type}</span>;
}
function PriorityBadge({ priority }: { priority: string }) {
  return <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border ${PRIORITY_CFG[priority] ?? "bg-slate-100 text-slate-500 border-slate-200"}`}>{priority}</span>;
}
function SITStatusBadge({ status }: { status: SITStatus }) {
  const c = STATUS_CFG[status] ?? STATUS_CFG.Pending;
  return <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold border ${c.color} ${c.bg} ${c.border}`}>{c.icon}{status}</span>;
}

// ─── Doc List ─────────────────────────────────────────────────────────────────

function DocList({ onSelect }: { onSelect: (doc: TcDoc) => void }) {
  const [docs, setDocs]       = useState<TcDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");
  const [search, setSearch]   = useState("");
  const [filter, setFilter]   = useState<"all" | "pending" | "released">("all");

  useEffect(() => {
    fetch(`${API}/api/stream/test-case-documents`, { headers: authHeader() })
      .then(r => r.json())
      .then(d => Array.isArray(d) ? setDocs(d) : setError(d.message ?? "Failed to load"))
      .catch(() => setError("Network error"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = docs.filter(d => {
    const q = search.toLowerCase();
    const matchQ = !q || d.request_title?.toLowerCase().includes(q) || d.doc_id?.toLowerCase().includes(q) || d.req_number?.toLowerCase().includes(q);
    const matchF = filter === "all" || (filter === "released" && d.sit_released) || (filter === "pending" && !d.sit_released);
    return matchQ && matchF;
  });

  const releasedCount = docs.filter(d => d.sit_released).length;
  const pendingCount  = docs.filter(d => !d.sit_released).length;

  if (loading) return <div className="flex items-center justify-center h-48 text-slate-400 gap-2"><RefreshCw className="w-5 h-5 animate-spin" /> Loading documents…</div>;
  if (error)   return <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>;

  return (
    <div className="space-y-5">
      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total Documents", val: docs.length,    icon: <FlaskConical className="w-5 h-5 text-cyan-500" />,    bg: "bg-white",          accent: "border-l-cyan-400" },
          { label: "Released to UAT", val: releasedCount,  icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />, bg: "bg-emerald-50",     accent: "border-l-emerald-400" },
          { label: "SIT In Progress", val: pendingCount,   icon: <Clock className="w-5 h-5 text-amber-500" />,          bg: "bg-amber-50",       accent: "border-l-amber-400" },
        ].map(s => (
          <div key={s.label} className={`${s.bg} rounded-2xl border border-slate-200 border-l-4 ${s.accent} p-4 shadow-sm flex items-center gap-4`}>
            <div className="p-2.5 bg-white rounded-xl border border-slate-200 shadow-sm">{s.icon}</div>
            <div>
              <p className="text-2xl font-bold text-slate-800">{s.val}</p>
              <p className="text-xs text-slate-500">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search requests or doc IDs…"
            className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-cyan-300 shadow-sm" />
        </div>
        <div className="flex gap-1.5">
          {([["all", "All"], ["pending", "In SIT"], ["released", "Released to UAT"]] as const).map(([val, label]) => (
            <button key={val} onClick={() => setFilter(val)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${filter === val ? "bg-cyan-600 text-white shadow-sm" : "bg-white border border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Cards */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 bg-white rounded-2xl border border-slate-200">
          <FlaskConical className="w-10 h-10 text-slate-200" />
          <p className="text-slate-500 font-semibold text-sm">No documents found</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filtered.map(doc => {
            const s = doc.summary;
            const sitCount = (s?.system ?? 0) + (s?.integration ?? 0) + (s?.performance ?? 0) + (s?.security ?? 0);
            const passRate = doc.sit_pass_rate ?? 0;
            return (
              <div key={doc.id}
                className={`bg-white rounded-2xl border shadow-sm hover:shadow-md transition-all cursor-pointer group overflow-hidden
                  ${doc.sit_released ? "border-emerald-200 hover:border-emerald-300" : "border-slate-200 hover:border-cyan-300"}`}
                onClick={() => onSelect(doc)}>

                {/* Top accent bar */}
                <div className={`h-1 w-full ${doc.sit_released ? "bg-gradient-to-r from-emerald-400 to-teal-500" : "bg-gradient-to-r from-cyan-400 to-blue-500"}`} />

                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Header */}
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${doc.sit_released ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-cyan-50 text-cyan-700 border-cyan-200"}`}>
                          {doc.sit_released ? <><CheckCircle2 className="w-3 h-3" /> Released to UAT</> : <><Clock className="w-3 h-3" /> SIT In Progress</>}
                        </span>
                        <span className="font-mono text-[10px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">{doc.doc_id}</span>
                        <span className="font-mono text-[10px] text-slate-400">{doc.req_number}</span>
                      </div>
                      <h3 className="text-base font-bold text-slate-800 truncate">{doc.request_title}</h3>

                      {/* Type breakdown pills */}
                      <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                        {s?.system      ? <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-violet-50 text-violet-700 border border-violet-200"><Layers className="w-3 h-3" />{s.system} System</span>      : null}
                        {s?.integration ? <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200"><Zap className="w-3 h-3" />{s.integration} Integration</span> : null}
                        {s?.performance ? <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200"><Activity className="w-3 h-3" />{s.performance} Perf</span>     : null}
                        {s?.security    ? <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200"><Shield className="w-3 h-3" />{s.security} Security</span>       : null}
                        {!s && <span className="text-xs text-slate-400">{doc.total_cases} total cases</span>}
                      </div>
                    </div>

                    {/* Right side */}
                    <div className="flex flex-col items-end gap-3 shrink-0">
                      <button className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl transition-colors group-hover:shadow-sm
                        ${doc.sit_released ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-cyan-600 hover:bg-cyan-700 text-white"}`}>
                        <FlaskConical className="w-3.5 h-3.5" />
                        {doc.sit_released ? "View SIT" : "Execute SIT"}
                      </button>
                      <div className="flex items-center gap-1.5 text-xs text-slate-400">
                        <CalendarDays className="w-3.5 h-3.5" />
                        {new Date(doc.generated_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      </div>
                    </div>
                  </div>

                  {/* Pass rate bar */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[11px] font-semibold text-slate-500">SIT Pass Rate</span>
                      <span className={`text-xs font-bold ${doc.sit_released ? "text-emerald-600" : passRate >= 90 ? "text-emerald-600" : "text-cyan-600"}`}>
                        {passRate}%
                      </span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden relative">
                      <div className={`h-full rounded-full transition-all ${doc.sit_released || passRate >= 90 ? "bg-emerald-500" : "bg-cyan-500"}`}
                        style={{ width: `${passRate}%` }} />
                      <div className="absolute top-0 bottom-0 border-r border-dashed border-slate-400" style={{ left: "90%" }} />
                    </div>
                    {doc.sit_released && doc.sit_released_at && (
                      <p className="text-[10px] text-emerald-600 mt-1 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        Released on {new Date(doc.sit_released_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    )}
                    {!doc.sit_released && passRate === 0 && (
                      <p className="text-[10px] text-slate-400 mt-1">No results saved yet — open to begin testing</p>
                    )}
                    {!doc.sit_released && passRate > 0 && passRate < 90 && (
                      <p className="text-[10px] text-amber-600 mt-1">{90 - passRate}% more needed to unlock UAT release</p>
                    )}
                    {!doc.sit_released && passRate >= 90 && (
                      <p className="text-[10px] text-emerald-600 mt-1 font-semibold">Ready for UAT release — IT Manager can approve</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── SIT Detail ───────────────────────────────────────────────────────────────

function SITDetail({ doc, onBack }: { doc: TcDoc; onBack: () => void }) {
  const isItManager = getUserRole() === "it";

  const [data, setData]             = useState<SITData | null>(null);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState("");
  const [localStatuses, setLS]      = useState<Record<string, SITStatus>>({});
  const [localRemarks, setLR]       = useState<Record<string, string>>({});
  const [saving, setSaving]         = useState(false);
  const [releasing, setReleasing]   = useState(false);
  const [releaseConfirm, setRC]     = useState(false);
  const [saveMsg, setSaveMsg]       = useState<{ text: string; ok: boolean } | null>(null);
  const [expanded, setExpanded]     = useState<string | null>(null);
  const [search, setSearch]         = useState("");
  const [filterType, setFilterType] = useState("All");
  const [filterStatus, setFilterStatus] = useState<SITStatus | "All">("All");

  const load = useCallback(() => {
    setLoading(true);
    fetch(`${API}/api/testing/sit/${doc.id}`, { headers: authHeader() })
      .then(r => r.json())
      .then(d => {
        if (!d.sit_cases) { setError(d.message ?? "Failed to load SIT data"); return; }
        setData(d);
        const statuses: Record<string, SITStatus> = {};
        const remarks: Record<string, string> = {};
        d.sit_cases.forEach((tc: SITCase) => {
          statuses[tc.id] = (d.results[tc.id]?.status as SITStatus) ?? "Pending";
          remarks[tc.id]  = d.results[tc.id]?.remarks ?? "";
        });
        setLS(statuses); setLR(remarks);
      })
      .catch(() => setError("Network error"))
      .finally(() => setLoading(false));
  }, [doc.id]);

  useEffect(() => { load(); }, [load]);

  const saveResults = async () => {
    if (!data) return;
    setSaving(true); setSaveMsg(null);
    try {
      const updates = data.sit_cases.map(tc => ({ test_case_id: tc.id, status: localStatuses[tc.id] ?? "Pending", remarks: localRemarks[tc.id] ?? "" }));
      const r = await fetch(`${API}/api/testing/sit/${doc.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json", ...authHeader() }, body: JSON.stringify({ updates }),
      });
      if (r.ok) { setSaveMsg({ text: "Results saved", ok: true }); load(); }
      else { const d = await r.json(); setSaveMsg({ text: d.message ?? "Save failed", ok: false }); }
    } finally { setSaving(false); setTimeout(() => setSaveMsg(null), 4000); }
  };

  const releaseForUAT = async () => {
    setReleasing(true);
    try {
      const r = await fetch(`${API}/api/testing/sit/${doc.id}/release`, { method: "POST", headers: { "Content-Type": "application/json", ...authHeader() } });
      const d = await r.json();
      if (r.ok) { load(); setRC(false); }
      else setSaveMsg({ text: d.message ?? "Release failed", ok: false });
    } finally { setReleasing(false); }
  };

  if (loading) return <div className="flex items-center justify-center h-48 text-slate-400 gap-2"><RefreshCw className="w-5 h-5 animate-spin" /> Loading SIT data…</div>;
  if (error)   return <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>;
  if (!data)   return null;

  const cases     = data.sit_cases;
  const passed    = cases.filter(c => localStatuses[c.id] === "Pass").length;
  const failed    = cases.filter(c => localStatuses[c.id] === "Fail").length;
  const inProg    = cases.filter(c => localStatuses[c.id] === "In Progress").length;
  const blocked   = cases.filter(c => localStatuses[c.id] === "Blocked").length;
  const pending   = cases.filter(c => !localStatuses[c.id] || localStatuses[c.id] === "Pending").length;
  const localRate = cases.length ? Math.round((passed / cases.length) * 100) : 0;
  const savedRate = data.pass_rate;
  const sitReady  = savedRate >= 90;
  const unsaved   = localRate !== savedRate;

  const TYPE_OPTS   = ["All", "System", "Integration", "Performance", "Security"];
  const STATUS_OPTS: (SITStatus | "All")[] = ["All", "Pending", "In Progress", "Pass", "Fail", "Blocked"];

  const filteredCases = cases.filter(c =>
    (filterType === "All" || c.type === filterType) &&
    (filterStatus === "All" || (localStatuses[c.id] ?? "Pending") === filterStatus) &&
    (!search || c.name.toLowerCase().includes(search.toLowerCase()) || c.id.toLowerCase().includes(search.toLowerCase()))
  );

  const bulkSet = (status: SITStatus) => {
    const patch: Record<string, SITStatus> = {};
    filteredCases.forEach(c => { patch[c.id] = status; });
    setLS(prev => ({ ...prev, ...patch }));
  };

  return (
    <div className="space-y-5">

      {/* Released banner */}
      {data.released && (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
          <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <p className="text-sm font-bold text-emerald-800">SIT Released to UAT</p>
            <p className="text-xs text-emerald-600">
              Released on {new Date(data.released_at!).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })} with {savedRate}% pass rate.
              The BA is now managing UAT assignments.
            </p>
          </div>
          <Lock className="w-5 h-5 text-emerald-400 ml-auto shrink-0" />
        </div>
      )}

      {/* Top bar */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div className="w-px h-5 bg-slate-200" />
          <div>
            <p className="text-xs text-slate-400 font-mono">{doc.req_number} · {doc.doc_id}</p>
            <h2 className="text-base font-bold text-slate-900">{doc.request_title}</h2>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {saveMsg && (
            <span className={`text-xs font-semibold px-3 py-1.5 rounded-lg border ${saveMsg.ok ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"}`}>
              {saveMsg.text}
            </span>
          )}
          <button onClick={saveResults} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-slate-800 text-white text-sm font-semibold rounded-xl hover:bg-slate-900 disabled:opacity-50">
            {saving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {saving ? "Saving…" : "Save Results"}
          </button>
          {isItManager && sitReady && !data.released && (
            <button onClick={() => setRC(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700">
              <Rocket className="w-3.5 h-3.5" /> Release for UAT
            </button>
          )}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: "Total",       val: cases.length, color: "text-slate-800",   bg: "bg-white",      accent: "border-l-slate-300" },
          { label: "Passed",      val: passed,        color: "text-emerald-700", bg: "bg-emerald-50", accent: "border-l-emerald-400" },
          { label: "Failed",      val: failed,        color: "text-red-700",     bg: "bg-red-50",     accent: "border-l-red-400" },
          { label: "In Progress", val: inProg,        color: "text-amber-700",   bg: "bg-amber-50",   accent: "border-l-amber-400" },
          { label: "Pending",     val: pending + blocked, color: "text-slate-500", bg: "bg-slate-50", accent: "border-l-slate-300" },
        ].map(k => (
          <div key={k.label} className={`${k.bg} rounded-xl border border-slate-200 border-l-4 ${k.accent} p-4 shadow-sm`}>
            <p className={`text-2xl font-bold ${k.color}`}>{k.val}</p>
            <p className="text-xs text-slate-500 mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Pass rate */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-cyan-500" />
            <span className="text-sm font-semibold text-slate-700">Pass Rate</span>
          </div>
          <div className="flex items-center gap-4 text-sm">
            {unsaved && <span className="text-xs text-amber-600 font-medium">Local (unsaved): <strong>{localRate}%</strong></span>}
            <span className={`font-bold text-lg ${sitReady ? "text-emerald-600" : "text-cyan-600"}`}>Saved: {savedRate}%</span>
          </div>
        </div>
        <div className="relative h-5 bg-slate-100 rounded-full overflow-hidden">
          {unsaved && <div className="absolute inset-y-0 left-0 rounded-full bg-cyan-200/60" style={{ width: `${localRate}%` }} />}
          <div className={`absolute inset-y-0 left-0 rounded-full transition-all duration-500 ${sitReady ? "bg-emerald-500" : "bg-cyan-500"}`} style={{ width: `${savedRate}%` }} />
          <div className="absolute top-0 bottom-0 border-r-2 border-dashed border-slate-400 z-10" style={{ left: "90%" }} />
          {savedRate > 5 && <span className="absolute inset-0 flex items-center pl-3 text-[10px] font-bold text-white">{savedRate}%</span>}
        </div>
        <div className="flex justify-between text-[10px] text-slate-400 mt-1"><span>0%</span><span>90% threshold</span><span>100%</span></div>
        {!sitReady && localRate >= 90 && (
          <div className="mt-3 p-2.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2 text-xs text-amber-700 font-medium">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Local rate ready at {localRate}% — <strong>Save Results</strong> first, then IT Manager can release.
          </div>
        )}
        {!sitReady && localRate < 90 && <p className="mt-2 text-xs text-slate-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-amber-400" /> {90 - localRate}% more cases need to pass.</p>}
        {sitReady && !data.released && isItManager && <p className="mt-2 text-xs text-emerald-600 font-semibold flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Threshold met — click "Release for UAT" above.</p>}
        {sitReady && !data.released && !isItManager && <p className="mt-2 text-xs text-emerald-600 font-medium flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Threshold met — waiting for IT Manager to release.</p>}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap bg-white border border-slate-200 rounded-2xl p-3 shadow-sm">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search cases…"
            className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-cyan-200 w-36" />
        </div>
        <div className="w-px h-5 bg-slate-200" />
        <div className="flex gap-1">
          {TYPE_OPTS.map(t => (
            <button key={t} onClick={() => setFilterType(t)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-colors ${filterType === t ? "bg-cyan-600 text-white" : "bg-slate-50 border border-slate-200 text-slate-500 hover:bg-slate-100"}`}>
              {t}
            </button>
          ))}
        </div>
        <div className="w-px h-5 bg-slate-200" />
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as SITStatus | "All")}
          className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-slate-50 focus:outline-none text-slate-600">
          {STATUS_OPTS.map(s => <option key={s} value={s}>{s === "All" ? "All statuses" : s}</option>)}
        </select>
        <div className="w-px h-5 bg-slate-200 ml-auto" />
        <span className="text-[11px] text-slate-400 shrink-0">Bulk ({filteredCases.length}):</span>
        {(["Pass", "Fail", "In Progress", "Blocked"] as SITStatus[]).map(s => {
          const c = STATUS_CFG[s];
          return (
            <button key={s} onClick={() => bulkSet(s)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors hover:opacity-80 ${c.color} ${c.bg} ${c.border}`}>
              {s}
            </button>
          );
        })}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
              <th className="w-10" />
              <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 w-28">Case ID</th>
              <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Test Name</th>
              <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 w-32">Type</th>
              <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 w-24">Priority</th>
              <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 w-40">Set Status</th>
              <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 w-24">Saved</th>
            </tr>
          </thead>
          <tbody>
            {filteredCases.length === 0 ? (
              <tr><td colSpan={7} className="py-12 text-center text-sm text-slate-400">No cases match the current filters</td></tr>
            ) : filteredCases.flatMap(c => {
              const status      = localStatuses[c.id] ?? "Pending";
              const savedStatus = (data.results[c.id]?.status as SITStatus) ?? "Pending";
              const isDirty     = status !== savedStatus;
              const isOpen      = expanded === c.id;
              const scfg        = STATUS_CFG[status] ?? STATUS_CFG.Pending;

              return [
                <tr key={c.id}
                  className={`border-t border-slate-100 transition-colors cursor-pointer
                    ${isOpen ? "bg-cyan-50/40" : "hover:bg-slate-50/80"}
                    ${isDirty ? "border-l-2 border-l-amber-400" : ""}`}>
                  <td className="pl-3 py-3">
                    <button onClick={() => setExpanded(isOpen ? null : c.id)} className="text-slate-300 hover:text-cyan-500 transition-colors">
                      {isOpen ? <ChevronDown className="w-4 h-4 text-cyan-500" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                  </td>
                  <td className="px-4 py-3 font-mono text-[11px] font-bold text-slate-500">{c.id}</td>
                  <td className="px-4 py-3" onClick={() => setExpanded(isOpen ? null : c.id)}>
                    <p className="font-semibold text-slate-800 text-sm leading-snug">{c.name}</p>
                    {localRemarks[c.id] && <p className="text-[11px] text-slate-400 mt-0.5 truncate max-w-xs">{localRemarks[c.id]}</p>}
                  </td>
                  <td className="px-4 py-3"><TypeBadge type={c.type} /></td>
                  <td className="px-4 py-3"><PriorityBadge priority={c.priority} /></td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <select value={status}
                      onChange={e => setLS(prev => ({ ...prev, [c.id]: e.target.value as SITStatus }))}
                      className={`px-2 py-1 rounded-md text-[11px] font-bold border cursor-pointer focus:outline-none focus:ring-2 focus:ring-cyan-200 ${scfg.color} ${scfg.bg} ${scfg.border}`}>
                      {(["Pending", "In Progress", "Pass", "Fail", "Blocked"] as SITStatus[]).map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3"><SITStatusBadge status={savedStatus} /></td>
                </tr>,

                ...(isOpen ? [
                  <tr key={`${c.id}-exp`}>
                    <td colSpan={7} className="px-4 pb-4 pt-0 bg-cyan-50/20">
                      <div className="rounded-xl border border-cyan-100 bg-white overflow-hidden shadow-sm">
                        <div className="grid grid-cols-2 divide-x divide-slate-100">
                          {/* Left: case info */}
                          <div className="p-4 space-y-3">
                            {c.description && (
                              <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Description</p>
                                <p className="text-xs text-slate-600 leading-relaxed">{c.description}</p>
                              </div>
                            )}
                            {c.preconditions && c.preconditions.length > 0 && (
                              <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Preconditions</p>
                                <ul className="space-y-1">
                                  {c.preconditions.map((p, i) => (
                                    <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                                      <span className="shrink-0 mt-0.5 w-4 h-4 rounded-full bg-cyan-100 text-cyan-700 text-[9px] font-bold flex items-center justify-center">{i + 1}</span>
                                      {p}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {c.expected_result && (
                              <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Expected Result</p>
                                <p className="text-xs text-slate-600 p-2 bg-emerald-50 border border-emerald-100 rounded-lg leading-relaxed">{c.expected_result}</p>
                              </div>
                            )}
                          </div>
                          {/* Right: steps + controls */}
                          <div className="p-4 space-y-3">
                            {c.steps?.length > 0 && (
                              <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Test Steps</p>
                                <div className="rounded-lg overflow-hidden border border-slate-200 text-xs">
                                  <table className="w-full">
                                    <thead><tr className="bg-slate-50"><th className="text-left px-2 py-1.5 text-[9px] font-bold text-slate-400 w-6">#</th><th className="text-left px-2 py-1.5 text-[9px] font-bold text-slate-500 w-1/2">Action</th><th className="text-left px-2 py-1.5 text-[9px] font-bold text-slate-500">Expected</th></tr></thead>
                                    <tbody>{c.steps.map(s => (
                                      <tr key={s.step_num} className="border-t border-slate-100">
                                        <td className="px-2 py-1.5 font-mono text-[9px] font-bold text-slate-300">{s.step_num}</td>
                                        <td className="px-2 py-1.5 text-slate-700 leading-snug">{s.action}</td>
                                        <td className="px-2 py-1.5 text-slate-500 leading-snug">{s.expected}</td>
                                      </tr>
                                    ))}</tbody>
                                  </table>
                                </div>
                              </div>
                            )}
                            <div>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Remarks</p>
                              <textarea rows={2} value={localRemarks[c.id] ?? ""}
                                onChange={e => setLR(prev => ({ ...prev, [c.id]: e.target.value }))}
                                placeholder="Add test remarks or failure details…"
                                className="w-full text-xs border border-slate-200 rounded-lg p-2 bg-slate-50 resize-none focus:outline-none focus:ring-2 focus:ring-cyan-200" />
                            </div>
                            <div>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Quick Mark</p>
                              <div className="flex flex-wrap gap-1.5">
                                {(["Pass", "Fail", "In Progress", "Blocked", "Pending"] as SITStatus[]).map(s => {
                                  const sc = STATUS_CFG[s]; const active = status === s;
                                  return (
                                    <button key={s} onClick={() => setLS(prev => ({ ...prev, [c.id]: s }))}
                                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${active ? `${sc.color} ${sc.bg} ${sc.border} ring-1 ring-offset-1 ring-cyan-300` : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
                                      {sc.icon}{s}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </td>
                  </tr>
                ] : [])
              ];
            })}
          </tbody>
        </table>
        <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-400">
          <span>Showing {filteredCases.length} of {cases.length} cases</span>
          {unsaved && (
            <span className="flex items-center gap-1.5 text-amber-600 font-medium">
              <AlertTriangle className="w-3 h-3" />
              {cases.filter(c => (localStatuses[c.id] ?? "Pending") !== ((data.results[c.id]?.status as SITStatus) ?? "Pending")).length} unsaved changes
            </span>
          )}
        </div>
      </div>

      {/* Release modal */}
      {releaseConfirm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center"><Rocket className="w-5 h-5 text-emerald-600" /></div>
              <div>
                <h3 className="font-bold text-slate-800">Release for UAT Testing?</h3>
                <p className="text-xs text-slate-400">Saved pass rate: {savedRate}% — threshold met (≥90%)</p>
              </div>
            </div>
            <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl mb-4 flex items-center gap-2 text-sm text-emerald-700">
              <CheckCircle2 className="w-4 h-4" /><span className="font-medium">SIT complete: {passed}/{cases.length} cases passed</span>
            </div>
            <p className="text-sm text-slate-600 mb-5">The BA will assign UAT test cases to stakeholders. Request status will update to <strong>"UAT Testing"</strong>.</p>
            <div className="flex gap-3">
              <button onClick={() => setRC(false)} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
              <button onClick={releaseForUAT} disabled={releasing} className="flex-1 px-4 py-2.5 bg-emerald-600 text-white rounded-xl text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50">
                {releasing ? "Releasing…" : "Confirm Release"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SITTestingPage() {
  const [selected, setSelected] = useState<TcDoc | null>(null);
  return (
    <div className="min-h-screen bg-slate-50 p-6 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 bg-cyan-100 rounded-xl flex items-center justify-center">
          <FlaskConical className="w-5 h-5 text-cyan-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">SIT Testing</h1>
          <p className="text-sm text-slate-500">{selected ? "System Integration Testing — execute, track and report results" : "Select a test case document to begin SIT execution"}</p>
        </div>
      </div>
      {!selected ? <DocList onSelect={setSelected} /> : <SITDetail doc={selected} onBack={() => setSelected(null)} />}
    </div>
  );
}
