"use client";

import { useEffect, useState } from "react";
import {
  FlaskConical, ChevronDown, ChevronRight, Search,
  CheckCircle2, XCircle, Clock, Ban, AlertTriangle,
  ShieldCheck, Layers, Users, Zap, Shield, Activity, Filter,
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
  meta: { total_cases: number; summary: TcListItem["summary"] };
  test_cases: TestCase[];
}

const TYPE_CFG: Record<string, { color: string; bg: string; border: string; icon: React.ReactNode }> = {
  System:      { color: "text-violet-700", bg: "bg-violet-50",  border: "border-violet-200", icon: <Layers   className="w-3 h-3" /> },
  Integration: { color: "text-blue-700",   bg: "bg-blue-50",    border: "border-blue-200",   icon: <Zap      className="w-3 h-3" /> },
  UAT:         { color: "text-teal-700",   bg: "bg-teal-50",    border: "border-teal-200",   icon: <Users    className="w-3 h-3" /> },
  Performance: { color: "text-amber-700",  bg: "bg-amber-50",   border: "border-amber-200",  icon: <Activity className="w-3 h-3" /> },
  Security:    { color: "text-rose-700",   bg: "bg-rose-50",    border: "border-rose-200",   icon: <Shield   className="w-3 h-3" /> },
};
const PRIORITY_CFG: Record<string, string> = {
  Critical: "bg-red-100 text-red-700 border-red-200",
  High:     "bg-orange-100 text-orange-700 border-orange-200",
  Medium:   "bg-yellow-100 text-yellow-700 border-yellow-200",
  Low:      "bg-slate-100 text-slate-600 border-slate-200",
};
const STATUS_CFG: Record<string, { color: string; bg: string; border: string; icon: React.ReactNode }> = {
  Pending: { color: "text-slate-600",   bg: "bg-slate-100",  border: "border-slate-200",   icon: <Clock        className="w-3 h-3" /> },
  Pass:    { color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", icon: <CheckCircle2 className="w-3 h-3" /> },
  Fail:    { color: "text-red-700",     bg: "bg-red-50",     border: "border-red-200",     icon: <XCircle      className="w-3 h-3" /> },
  Blocked: { color: "text-amber-700",   bg: "bg-amber-50",   border: "border-amber-200",   icon: <Ban          className="w-3 h-3" /> },
};

function TypeTag({ type }: { type: string }) {
  const c = TYPE_CFG[type] ?? { color: "text-slate-600", bg: "bg-slate-50", border: "border-slate-200", icon: null };
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${c.color} ${c.bg} ${c.border}`}>
      {c.icon}{type}
    </span>
  );
}
function PriorityTag({ priority }: { priority: string }) {
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${PRIORITY_CFG[priority] ?? ""}`}>
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
      className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border cursor-pointer focus:outline-none ${c.color} ${c.bg} ${c.border}`}
    >
      {Object.keys(STATUS_CFG).map(s => <option key={s} value={s}>{s}</option>)}
    </select>
  );
}

function CaseDetail({ tc }: { tc: TestCase }) {
  return (
    <tr>
      <td colSpan={6} className="px-0 py-0">
        <div className="mx-4 mb-3 rounded-xl border border-slate-200 bg-slate-50 overflow-hidden">
          {tc.description && (
            <p className="px-4 pt-3 pb-2 text-xs text-slate-500 leading-relaxed border-b border-slate-100">{tc.description}</p>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-0 divide-y md:divide-y-0 md:divide-x divide-slate-100">
            {/* Preconditions */}
            {tc.preconditions?.length > 0 && (
              <div className="p-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Preconditions</p>
                <ul className="space-y-1">
                  {tc.preconditions.map((p, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-slate-700">
                      <span className="mt-0.5 w-3.5 h-3.5 shrink-0 rounded-full bg-violet-100 text-violet-600 text-[9px] font-bold flex items-center justify-center">{i + 1}</span>
                      {p}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {/* Expected result */}
            {tc.expected_result && (
              <div className="p-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Expected Outcome</p>
                <p className="text-xs text-emerald-700 leading-relaxed">{tc.expected_result}</p>
              </div>
            )}
          </div>
          {/* Steps table */}
          {tc.steps?.length > 0 && (
            <div className="border-t border-slate-100">
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-slate-100/70">
                    <th className="text-left px-3 py-1.5 text-[10px] font-bold text-slate-400 w-8">#</th>
                    <th className="text-left px-3 py-1.5 text-[10px] font-bold text-slate-500 w-1/2">Action</th>
                    <th className="text-left px-3 py-1.5 text-[10px] font-bold text-slate-500">Expected Result</th>
                  </tr>
                </thead>
                <tbody>
                  {tc.steps.map(step => (
                    <tr key={step.step_num} className="border-t border-slate-100 hover:bg-white">
                      <td className="px-3 py-2 text-[10px] font-bold text-slate-300">{step.step_num}</td>
                      <td className="px-3 py-2 text-slate-700 leading-snug">{step.action}</td>
                      <td className="px-3 py-2 text-slate-500 leading-snug">{step.expected}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

function ExpandedRow({ docId }: { docId: number }) {
  const [detail, setDetail]   = useState<TcDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [expandedCase, setExpandedCase] = useState<string | null>(null);
  const [typeFilter, setTypeFilter]     = useState("All");
  const [priorityFilter, setPriority]   = useState("All");
  const [caseSearch, setCaseSearch]     = useState("");

  useEffect(() => {
    setLoading(true);
    const token = localStorage.getItem("authToken");
    fetch(`${API}/api/stream/test-case-documents/${docId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => {
        setDetail(d);
        const init: Record<string, string> = {};
        d.test_cases?.forEach((tc: TestCase) => { init[tc.id] = tc.status; });
        setStatuses(init);
      })
      .finally(() => setLoading(false));
  }, [docId]);

  if (loading) {
    return (
      <tr>
        <td colSpan={7} className="py-8 text-center">
          <div className="flex items-center justify-center gap-2 text-slate-400">
            <div className="w-4 h-4 border-2 border-violet-400 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Loading test cases…</span>
          </div>
        </td>
      </tr>
    );
  }
  if (!detail) return <tr><td colSpan={7} className="py-6 text-center text-sm text-slate-400">Failed to load.</td></tr>;

  const total   = detail.meta.total_cases;
  const passed  = Object.values(statuses).filter(s => s === "Pass").length;
  const failed  = Object.values(statuses).filter(s => s === "Fail").length;
  const blocked = Object.values(statuses).filter(s => s === "Blocked").length;
  const pct     = total > 0 ? Math.round((passed / total) * 100) : 0;

  const types      = ["All", "System", "Integration", "UAT", "Performance", "Security"];
  const priorities = ["All", "Critical", "High", "Medium", "Low"];

  const cases = detail.test_cases.filter(tc => {
    if (typeFilter !== "All" && tc.type !== typeFilter) return false;
    if (priorityFilter !== "All" && tc.priority !== priorityFilter) return false;
    if (caseSearch && !tc.name.toLowerCase().includes(caseSearch.toLowerCase()) && !tc.id.toLowerCase().includes(caseSearch.toLowerCase())) return false;
    return true;
  });

  return (
    <>
      {/* Progress + filters row */}
      <tr className="bg-violet-50/40">
        <td colSpan={7} className="px-6 py-4">
          <div className="flex flex-wrap items-center gap-6">
            {/* Progress bar */}
            <div className="flex-1 min-w-48">
              <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                <span>Execution Progress</span>
                <span className="font-semibold">{pct}% — {passed}/{total} passed</span>
              </div>
              <div className="h-2 bg-slate-200 rounded-full overflow-hidden flex">
                <div className="bg-emerald-500 transition-all" style={{ width: `${(passed / total) * 100}%` }} />
                <div className="bg-red-400 transition-all"     style={{ width: `${(failed / total) * 100}%` }} />
                <div className="bg-amber-400 transition-all"   style={{ width: `${(blocked / total) * 100}%` }} />
              </div>
              <div className="flex gap-3 mt-1 text-[10px] text-slate-400">
                {[["bg-emerald-500","Pass",passed],["bg-red-400","Fail",failed],["bg-amber-400","Blocked",blocked],["bg-slate-300","Pending",total-passed-failed-blocked]].map(([dot,lbl,val]) => (
                  <span key={lbl as string} className="flex items-center gap-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />{lbl}: <b>{val}</b>
                  </span>
                ))}
              </div>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2">
              <Filter className="w-3.5 h-3.5 text-slate-400" />
              {types.map(t => (
                <button key={t} onClick={() => setTypeFilter(t)}
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${typeFilter === t ? "bg-violet-600 text-white" : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"}`}>
                  {t}
                </button>
              ))}
              <span className="w-px h-4 bg-slate-200" />
              {priorities.map(p => (
                <button key={p} onClick={() => setPriority(p)}
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-colors ${priorityFilter === p ? "bg-slate-700 text-white" : "bg-white text-slate-500 border border-slate-200 hover:bg-slate-50"}`}>
                  {p}
                </button>
              ))}
              <div className="relative ml-2">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                <input value={caseSearch} onChange={e => setCaseSearch(e.target.value)}
                  placeholder="Search cases…"
                  className="pl-6 pr-2 py-0.5 text-[10px] rounded border border-slate-200 bg-white focus:outline-none focus:ring-1 focus:ring-violet-300 w-32" />
              </div>
            </div>
          </div>
        </td>
      </tr>

      {/* Inner table header */}
      <tr className="bg-slate-100/80 border-t border-b border-slate-200">
        <td className="w-6" />
        <td className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider w-20">ID</td>
        <td className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Test Case Name</td>
        <td className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider w-28">Type</td>
        <td className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider w-24">Priority</td>
        <td className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider w-24">FRD Ref</td>
        <td className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider w-28">Status</td>
      </tr>

      {cases.length === 0 ? (
        <tr>
          <td colSpan={7} className="py-6 text-center text-xs text-slate-400">No test cases match the current filters.</td>
        </tr>
      ) : (
        cases.map(tc => {
          const isOpen = expandedCase === tc.id;
          return (
            <>
              <tr
                key={tc.id}
                className={`border-t border-slate-100 cursor-pointer transition-colors ${isOpen ? "bg-violet-50/60" : "hover:bg-slate-50"}`}
                onClick={() => setExpandedCase(isOpen ? null : tc.id)}
              >
                <td className="pl-4 py-3 text-slate-300">
                  {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                </td>
                <td className="px-4 py-3">
                  <span className="font-mono text-[11px] font-bold text-slate-500">{tc.id}</span>
                </td>
                <td className="px-4 py-3">
                  <span className="text-sm text-slate-800 font-medium">{tc.name}</span>
                </td>
                <td className="px-4 py-3"><TypeTag type={tc.type} /></td>
                <td className="px-4 py-3"><PriorityTag priority={tc.priority} /></td>
                <td className="px-4 py-3">
                  <span className="font-mono text-[10px] text-slate-400">{tc.frd_ref}</span>
                </td>
                <td className="px-4 py-3">
                  <StatusSelect
                    value={statuses[tc.id] ?? tc.status}
                    onChange={v => setStatuses(prev => ({ ...prev, [tc.id]: v }))}
                  />
                </td>
              </tr>
              {isOpen && <CaseDetail tc={tc} />}
            </>
          );
        })
      )}
    </>
  );
}

export default function TestCasesPage() {
  const [docs, setDocs]       = useState<TcListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

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
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <FlaskConical className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Test Cases</h1>
            <p className="text-violet-200 text-sm">AI-generated test suites derived from FRDs</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          {[
            { label: "Documents",   val: totalDocs,  icon: <FlaskConical className="w-3.5 h-3.5" /> },
            { label: "Total Cases", val: totalCases, icon: <ShieldCheck className="w-3.5 h-3.5" /> },
            { label: "System",      val: totalSys,   icon: <Layers className="w-3.5 h-3.5" /> },
            { label: "Integration", val: totalInt,   icon: <Zap className="w-3.5 h-3.5" /> },
            { label: "UAT",         val: totalUat,   icon: <Users className="w-3.5 h-3.5" /> },
            { label: "Critical",    val: totalCrit,  icon: <AlertTriangle className="w-3.5 h-3.5" /> },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-2 bg-white/15 border border-white/20 rounded-xl px-4 py-2">
              <span className="text-white/70">{s.icon}</span>
              <span className="text-white font-bold text-sm">{s.val}</span>
              <span className="text-white/60 text-xs">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="px-8 py-6 space-y-4">
        {/* Search */}
        <div className="flex items-center gap-3">
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by request, doc ID, FRD ref…"
              className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400 shadow-sm"
            />
          </div>
          {!loading && (
            <p className="text-xs text-slate-400">{filtered.length} document{filtered.length !== 1 ? "s" : ""}</p>
          )}
        </div>

        {/* Main table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
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
            <table className="w-full">
              {/* Column headers */}
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50">
                  <th className="w-8" />
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Request</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Doc ID</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">FRD Ref</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Cases</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">Generated</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500">By</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map(doc => {
                  const isOpen = expandedId === doc.id;
                  const s = doc.summary ?? {};
                  return (
                    <>
                      {/* Request row */}
                      <tr
                        key={doc.id}
                        className={`border-b border-slate-100 cursor-pointer transition-colors ${isOpen ? "bg-violet-50 border-violet-100" : "hover:bg-slate-50"}`}
                        onClick={() => setExpandedId(isOpen ? null : doc.id)}
                      >
                        <td className="pl-4 py-4 text-slate-300">
                          {isOpen
                            ? <ChevronDown className="w-4 h-4 text-violet-400" />
                            : <ChevronRight className="w-4 h-4" />}
                        </td>

                        {/* Request */}
                        <td className="px-4 py-4">
                          <p className="text-sm font-semibold text-slate-800 leading-snug">{doc.request_title}</p>
                          <span className="font-mono text-[11px] text-slate-400">{doc.req_number}</span>
                        </td>

                        {/* Doc ID */}
                        <td className="px-4 py-4">
                          <span className="font-mono text-xs font-bold text-violet-700 bg-violet-50 border border-violet-100 px-2 py-0.5 rounded">
                            {doc.doc_id}
                          </span>
                        </td>

                        {/* FRD Ref */}
                        <td className="px-4 py-4">
                          <span className="font-mono text-xs text-blue-600 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded">
                            {doc.frd_doc_id}
                          </span>
                        </td>

                        {/* Cases breakdown */}
                        <td className="px-4 py-4">
                          <div className="flex flex-wrap gap-1">
                            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold border border-slate-200">
                              {doc.total_cases}
                            </span>
                            {(s.system ?? 0) > 0 && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-50 text-violet-700 border border-violet-100 font-semibold">{s.system} sys</span>
                            )}
                            {(s.integration ?? 0) > 0 && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100 font-semibold">{s.integration} int</span>
                            )}
                            {(s.uat ?? 0) > 0 && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-100 font-semibold">{s.uat} uat</span>
                            )}
                            {(s.critical ?? 0) > 0 && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-700 border border-red-100 font-semibold">{s.critical} crit</span>
                            )}
                          </div>
                        </td>

                        {/* Date */}
                        <td className="px-4 py-4 text-xs text-slate-500">
                          {new Date(doc.generated_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                        </td>

                        {/* Author */}
                        <td className="px-4 py-4 text-xs text-slate-500">{doc.generated_by_name ?? "—"}</td>
                      </tr>

                      {/* Expanded test cases inline */}
                      {isOpen && <ExpandedRow docId={doc.id} />}
                    </>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
