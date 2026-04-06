"use client";

import { useEffect, useState, useCallback } from "react";
import {
  FlaskConical, ChevronDown, ChevronRight, Search,
  CheckCircle2, XCircle, Clock, Ban, AlertTriangle,
  ShieldCheck, Layers, Users, Zap, Shield, Activity,
  FileText, Hash, Calendar, User,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:5001";

interface TcListItem {
  id: number;
  doc_id: string;
  frd_doc_id: string;
  brd_doc_id: string;
  title: string;
  status: string;
  total_cases: number;
  summary: { system: number; integration: number; uat: number; critical: number; high: number; medium: number; low: number };
  request_title: string;
  req_number: string;
  generated_at: string;
  generated_by_name: string;
}

interface TestStep { step_num: number; action: string; expected: string }
interface TestCase {
  id: string; frd_ref: string; name: string; description: string;
  type: string; priority: string; preconditions: string[];
  steps: TestStep[]; expected_result: string; status: string;
}
interface TcDetail {
  meta: { doc_id: string; frd_doc_id: string; title: string; version: string; status: string; generated_at: string; request_number: string; total_cases: number; summary: TcListItem["summary"] };
  test_cases: TestCase[];
}

// ── Config ─────────────────────────────────────────────────────────────────────
const TYPE_CFG: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  System:      { label: "System",      color: "text-violet-700", bg: "bg-violet-50",  border: "border-violet-200", icon: <Layers   className="w-3.5 h-3.5" /> },
  Integration: { label: "Integration", color: "text-blue-700",   bg: "bg-blue-50",    border: "border-blue-200",   icon: <Zap      className="w-3.5 h-3.5" /> },
  UAT:         { label: "UAT",         color: "text-teal-700",   bg: "bg-teal-50",    border: "border-teal-200",   icon: <Users    className="w-3.5 h-3.5" /> },
  Performance: { label: "Performance", color: "text-amber-700",  bg: "bg-amber-50",   border: "border-amber-200",  icon: <Activity className="w-3.5 h-3.5" /> },
  Security:    { label: "Security",    color: "text-rose-700",   bg: "bg-rose-50",    border: "border-rose-200",   icon: <Shield   className="w-3.5 h-3.5" /> },
};
const PRIORITY_CFG: Record<string, string> = {
  Critical: "bg-red-100 text-red-700 border-red-200",
  High:     "bg-orange-100 text-orange-700 border-orange-200",
  Medium:   "bg-yellow-100 text-yellow-700 border-yellow-200",
  Low:      "bg-slate-100 text-slate-600 border-slate-200",
};
const STATUS_CFG: Record<string, { color: string; bg: string; border: string; icon: React.ReactNode }> = {
  Pending: { color: "text-slate-600",  bg: "bg-slate-100",   border: "border-slate-200",   icon: <Clock        className="w-3 h-3" /> },
  Pass:    { color: "text-emerald-700",bg: "bg-emerald-50",  border: "border-emerald-200", icon: <CheckCircle2 className="w-3 h-3" /> },
  Fail:    { color: "text-red-700",    bg: "bg-red-50",      border: "border-red-200",     icon: <XCircle      className="w-3 h-3" /> },
  Blocked: { color: "text-amber-700",  bg: "bg-amber-50",    border: "border-amber-200",   icon: <Ban          className="w-3 h-3" /> },
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function TypeTag({ type }: { type: string }) {
  const c = TYPE_CFG[type] ?? { label: type, color: "text-slate-600", bg: "bg-slate-50", border: "border-slate-200", icon: null };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${c.color} ${c.bg} ${c.border}`}>
      {c.icon}{c.label}
    </span>
  );
}
function PriorityTag({ priority }: { priority: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold border ${PRIORITY_CFG[priority] ?? ""}`}>
      {priority}
    </span>
  );
}
function StatusSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const c = STATUS_CFG[value] ?? STATUS_CFG.Pending;
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      onClick={e => e.stopPropagation()}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border cursor-pointer focus:outline-none ${c.color} ${c.bg} ${c.border}`}
    >
      {Object.keys(STATUS_CFG).map(s => <option key={s} value={s}>{s}</option>)}
    </select>
  );
}

// ── Expanded test-case detail ──────────────────────────────────────────────────
function CaseDetail({ tc }: { tc: TestCase }) {
  return (
    <div className="px-4 pb-4 pt-3 space-y-4 bg-slate-50 border-t border-slate-100">
      {tc.description && (
        <p className="text-sm text-slate-600 leading-relaxed">{tc.description}</p>
      )}

      {/* Preconditions */}
      {tc.preconditions?.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Preconditions</p>
          <ul className="space-y-1.5">
            {tc.preconditions.map((p, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                <span className="mt-0.5 w-4 h-4 shrink-0 rounded-full bg-violet-100 text-violet-700 text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                {p}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Steps table */}
      {tc.steps?.length > 0 && (
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Test Steps</p>
          <div className="rounded-xl border border-slate-200 overflow-hidden bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-3 py-2 text-[11px] font-bold text-slate-400 w-8">#</th>
                  <th className="text-left px-3 py-2 text-[11px] font-bold text-slate-500 w-1/2">Action</th>
                  <th className="text-left px-3 py-2 text-[11px] font-bold text-slate-500">Expected Result</th>
                </tr>
              </thead>
              <tbody>
                {tc.steps.map(step => (
                  <tr key={step.step_num} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                    <td className="px-3 py-2.5 text-[11px] font-bold text-slate-300">{step.step_num}</td>
                    <td className="px-3 py-2.5 text-slate-700 leading-snug">{step.action}</td>
                    <td className="px-3 py-2.5 text-slate-500 leading-snug">{step.expected}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Expected result */}
      {tc.expected_result && (
        <div className="flex items-start gap-3 bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3">
          <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wide mb-0.5">Expected Outcome</p>
            <p className="text-sm text-emerald-800 leading-snug">{tc.expected_result}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Test cases loaded inside a request card ────────────────────────────────────
function RequestTestCases({ doc }: { doc: TcListItem }) {
  const [detail, setDetail]       = useState<TcDetail | null>(null);
  const [loading, setLoading]     = useState(false);
  const [statuses, setStatuses]   = useState<Record<string, string>>({});
  const [expanded, setExpanded]   = useState<string | null>(null);
  const [typeFilter, setTypeFilter]     = useState("All");
  const [priorityFilter, setPriority]   = useState("All");
  const [searchQ, setSearchQ]           = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const token = localStorage.getItem("authToken");
    const r = await fetch(`${API}/api/stream/test-case-documents/${doc.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (r.ok) {
      const d: TcDetail = await r.json();
      setDetail(d);
      const init: Record<string, string> = {};
      d.test_cases?.forEach(tc => { init[tc.id] = tc.status; });
      setStatuses(init);
    }
    setLoading(false);
  }, [doc.id]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 gap-2 text-slate-400">
        <div className="w-4 h-4 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm">Loading test cases…</span>
      </div>
    );
  }
  if (!detail) return <p className="py-8 text-center text-sm text-slate-400">Failed to load test cases.</p>;

  const types      = ["All", "System", "Integration", "UAT", "Performance", "Security"];
  const priorities = ["All", "Critical", "High", "Medium", "Low"];

  const cases = detail.test_cases.filter(tc => {
    if (typeFilter !== "All" && tc.type !== typeFilter) return false;
    if (priorityFilter !== "All" && tc.priority !== priorityFilter) return false;
    if (searchQ && !tc.name.toLowerCase().includes(searchQ.toLowerCase()) && !tc.id.toLowerCase().includes(searchQ.toLowerCase())) return false;
    return true;
  });

  const passed  = Object.values(statuses).filter(s => s === "Pass").length;
  const failed  = Object.values(statuses).filter(s => s === "Fail").length;
  const blocked = Object.values(statuses).filter(s => s === "Blocked").length;
  const total   = detail.meta.total_cases;
  const pct     = total > 0 ? Math.round((passed / total) * 100) : 0;

  // Group cases by type for display
  const grouped = types.filter(t => t !== "All").reduce<Record<string, TestCase[]>>((acc, t) => {
    const grp = cases.filter(tc => tc.type === t);
    if (grp.length) acc[t] = grp;
    return acc;
  }, {});

  return (
    <div className="p-5 space-y-5">
      {/* Progress bar */}
      <div className="bg-white border border-slate-100 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-600">Execution Progress</span>
          <span className="text-sm font-bold text-slate-800">{pct}% <span className="text-slate-400 font-normal text-xs">({passed}/{total} passed)</span></span>
        </div>
        <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden flex gap-0.5">
          <div className="bg-emerald-500 rounded-full transition-all duration-500" style={{ width: `${(passed / total) * 100}%` }} />
          <div className="bg-red-400 rounded-full transition-all duration-500" style={{ width: `${(failed / total) * 100}%` }} />
          <div className="bg-amber-400 rounded-full transition-all duration-500" style={{ width: `${(blocked / total) * 100}%` }} />
        </div>
        <div className="flex gap-5 text-xs text-slate-500">
          {[
            { label: "Pass",    val: passed,             dot: "bg-emerald-500" },
            { label: "Fail",    val: failed,             dot: "bg-red-400" },
            { label: "Blocked", val: blocked,            dot: "bg-amber-400" },
            { label: "Pending", val: total - passed - failed - blocked, dot: "bg-slate-300" },
          ].map(s => (
            <span key={s.label} className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${s.dot}`} />{s.label}: <strong>{s.val}</strong>
            </span>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Search */}
        <div className="relative flex-1 min-w-48 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            value={searchQ}
            onChange={e => setSearchQ(e.target.value)}
            placeholder="Search test cases…"
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-300"
          />
        </div>
        {/* Type filter */}
        <div className="flex items-center gap-1 flex-wrap">
          {types.map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${typeFilter === t ? "bg-violet-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
              {t}
            </button>
          ))}
        </div>
        {/* Priority filter */}
        <div className="flex items-center gap-1 flex-wrap ml-auto">
          {priorities.map(p => (
            <button key={p} onClick={() => setPriority(p)}
              className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${priorityFilter === p ? "bg-slate-700 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Cases grouped by type */}
      {Object.keys(grouped).length === 0 ? (
        <p className="text-center py-6 text-sm text-slate-400">No test cases match the current filters.</p>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([type, tcs]) => {
            const cfg = TYPE_CFG[type];
            return (
              <div key={type} className={`rounded-xl border ${cfg.border} overflow-hidden`}>
                {/* Type group header */}
                <div className={`flex items-center gap-2 px-4 py-2.5 ${cfg.bg} border-b ${cfg.border}`}>
                  <span className={cfg.color}>{cfg.icon}</span>
                  <span className={`text-xs font-bold ${cfg.color}`}>{type} Tests</span>
                  <span className={`ml-auto text-[11px] font-semibold ${cfg.color} opacity-70`}>{tcs.length} case{tcs.length !== 1 ? "s" : ""}</span>
                </div>

                {/* Case rows */}
                <div className="divide-y divide-slate-100 bg-white">
                  {tcs.map(tc => {
                    const isOpen = expanded === tc.id;
                    return (
                      <div key={tc.id}>
                        <div
                          className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 cursor-pointer transition-colors"
                          onClick={() => setExpanded(isOpen ? null : tc.id)}
                        >
                          <span className="text-slate-300 shrink-0">
                            {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                          </span>
                          <span className="font-mono text-[11px] font-bold text-slate-400 w-14 shrink-0">{tc.id}</span>
                          <span className="text-sm text-slate-800 font-medium flex-1 min-w-0 truncate">{tc.name}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="hidden sm:block font-mono text-[10px] text-slate-300">{tc.frd_ref}</span>
                            <PriorityTag priority={tc.priority} />
                            <StatusSelect
                              value={statuses[tc.id] ?? tc.status}
                              onChange={v => setStatuses(prev => ({ ...prev, [tc.id]: v }))}
                            />
                          </div>
                        </div>
                        {isOpen && <CaseDetail tc={tc} />}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Request card ───────────────────────────────────────────────────────────────
function RequestCard({ doc }: { doc: TcListItem }) {
  const [open, setOpen] = useState(false);
  const s = doc.summary ?? {};
  const total = doc.total_cases ?? 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      {/* Card header — always visible */}
      <div
        className="flex items-start gap-4 px-6 py-5 cursor-pointer hover:bg-slate-50/60 transition-colors"
        onClick={() => setOpen(o => !o)}
      >
        {/* Icon */}
        <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center shrink-0 mt-0.5">
          <FlaskConical className="w-5 h-5 text-violet-600" />
        </div>

        {/* Title block */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="text-sm font-bold text-slate-800 truncate">{doc.request_title}</h3>
            <span className="font-mono text-[11px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full border border-slate-200">{doc.req_number}</span>
          </div>
          <div className="flex items-center gap-3 flex-wrap text-[11px] text-slate-400">
            <span className="flex items-center gap-1"><FileText className="w-3 h-3" />{doc.doc_id}</span>
            <span className="flex items-center gap-1"><Hash className="w-3 h-3" />{doc.frd_doc_id}</span>
            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />
              {new Date(doc.generated_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            </span>
            {doc.generated_by_name && (
              <span className="flex items-center gap-1"><User className="w-3 h-3" />{doc.generated_by_name}</span>
            )}
          </div>
        </div>

        {/* Right side: case pills + chevron */}
        <div className="flex items-center gap-3 shrink-0">
          <div className="flex flex-wrap justify-end gap-1.5">
            <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-[11px] font-bold">{total} total</span>
            {s.system     > 0 && <span className="px-2 py-1 rounded-full bg-violet-50 text-violet-700 text-[11px] font-semibold border border-violet-100">{s.system} sys</span>}
            {s.integration > 0 && <span className="px-2 py-1 rounded-full bg-blue-50 text-blue-700 text-[11px] font-semibold border border-blue-100">{s.integration} int</span>}
            {s.uat        > 0 && <span className="px-2 py-1 rounded-full bg-teal-50 text-teal-700 text-[11px] font-semibold border border-teal-100">{s.uat} uat</span>}
            {s.critical   > 0 && <span className="px-2 py-1 rounded-full bg-red-50 text-red-700 text-[11px] font-semibold border border-red-100">{s.critical} crit</span>}
          </div>
          <span className="text-slate-300">
            {open ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
          </span>
        </div>
      </div>

      {/* Expanded section */}
      {open && (
        <div className="border-t border-slate-100">
          <RequestTestCases doc={doc} />
        </div>
      )}
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────
export default function TestCasesPage() {
  const [docs, setDocs]     = useState<TcListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("authToken");
    fetch(`${API}/api/stream/test-case-documents`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => setDocs(Array.isArray(d) ? d : []))
      .catch(() => setDocs([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = docs.filter(d => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      d.doc_id?.toLowerCase().includes(q) ||
      d.request_title?.toLowerCase().includes(q) ||
      d.req_number?.toLowerCase().includes(q) ||
      d.frd_doc_id?.toLowerCase().includes(q)
    );
  });

  const totalDocs  = docs.length;
  const totalCases = docs.reduce((a, d) => a + (d.total_cases ?? 0), 0);
  const totalSys   = docs.reduce((a, d) => a + (d.summary?.system ?? 0), 0);
  const totalUat   = docs.reduce((a, d) => a + (d.summary?.uat ?? 0), 0);
  const totalInt   = docs.reduce((a, d) => a + (d.summary?.integration ?? 0), 0);
  const totalCrit  = docs.reduce((a, d) => a + (d.summary?.critical ?? 0), 0);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 px-8 py-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-11 h-11 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
            <FlaskConical className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Test Cases</h1>
            <p className="text-violet-200 text-sm">AI-generated test suites derived from FRDs, grouped by request</p>
          </div>
        </div>

        {/* Stat pills in header */}
        <div className="flex flex-wrap gap-3">
          {[
            { label: "Documents",   val: totalDocs,  icon: <FlaskConical className="w-3.5 h-3.5" /> },
            { label: "Total Cases", val: totalCases, icon: <ShieldCheck className="w-3.5 h-3.5" /> },
            { label: "System",      val: totalSys,   icon: <Layers className="w-3.5 h-3.5" /> },
            { label: "Integration", val: totalInt,   icon: <Zap className="w-3.5 h-3.5" /> },
            { label: "UAT",         val: totalUat,   icon: <Users className="w-3.5 h-3.5" /> },
            { label: "Critical",    val: totalCrit,  icon: <AlertTriangle className="w-3.5 h-3.5" /> },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-2 bg-white/15 backdrop-blur border border-white/20 rounded-xl px-4 py-2">
              <span className="text-white/70">{s.icon}</span>
              <span className="text-white text-sm font-bold">{s.val}</span>
              <span className="text-white/60 text-xs">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="px-8 py-6 space-y-4">
        {/* Search */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by request, doc ID, FRD ref…"
            className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400 shadow-sm"
          />
        </div>

        {/* Results count */}
        {!loading && (
          <p className="text-xs text-slate-400 font-medium">
            {filtered.length} test suite{filtered.length !== 1 ? "s" : ""} {search && `matching "${search}"`}
          </p>
        )}

        {/* Cards */}
        {loading ? (
          <div className="flex items-center justify-center py-24 gap-3 text-slate-400">
            <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Loading test case documents…</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center">
              <FlaskConical className="w-8 h-8 text-slate-300" />
            </div>
            <p className="text-slate-500 font-semibold">No test case documents yet</p>
            <p className="text-slate-400 text-sm">Generate test cases from an FRD in the FRD Management page.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map(doc => <RequestCard key={doc.id} doc={doc} />)}
          </div>
        )}
      </div>
    </div>
  );
}
