"use client";

import { useEffect, useState, useCallback } from "react";
import {
  FlaskConical,
  ChevronDown,
  ChevronRight,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Ban,
  AlertTriangle,
  ShieldCheck,
  Layers,
  Users,
  Zap,
  Filter,
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
  summary: {
    system: number;
    integration: number;
    uat: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  request_title: string;
  req_number: string;
  generated_at: string;
  generated_by_name: string;
}

interface TestStep {
  step_num: number;
  action: string;
  expected: string;
}

interface TestCase {
  id: string;
  frd_ref: string;
  name: string;
  description: string;
  type: string;
  priority: string;
  preconditions: string[];
  steps: TestStep[];
  expected_result: string;
  status: string;
}

interface TcDetail {
  meta: {
    doc_id: string;
    frd_doc_id: string;
    brd_doc_id: string;
    title: string;
    version: string;
    status: string;
    generated_at: string;
    request_number: string;
    total_cases: number;
    summary: TcListItem["summary"];
  };
  test_cases: TestCase[];
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  Pending:  { label: "Pending",  color: "bg-slate-100 text-slate-600 border-slate-200",   icon: <Clock className="w-3 h-3" /> },
  Pass:     { label: "Pass",     color: "bg-emerald-50 text-emerald-700 border-emerald-200", icon: <CheckCircle2 className="w-3 h-3" /> },
  Fail:     { label: "Fail",     color: "bg-red-50 text-red-700 border-red-200",           icon: <XCircle className="w-3 h-3" /> },
  Blocked:  { label: "Blocked",  color: "bg-amber-50 text-amber-700 border-amber-200",     icon: <Ban className="w-3 h-3" /> },
};

const TYPE_CONFIG: Record<string, { color: string; icon: React.ReactNode }> = {
  System:      { color: "bg-violet-50 text-violet-700 border-violet-200",  icon: <Layers className="w-3 h-3" /> },
  Integration: { color: "bg-blue-50 text-blue-700 border-blue-200",        icon: <Zap className="w-3 h-3" /> },
  UAT:         { color: "bg-teal-50 text-teal-700 border-teal-200",        icon: <Users className="w-3 h-3" /> },
};

const PRIORITY_CONFIG: Record<string, string> = {
  Critical: "bg-red-100 text-red-700 border-red-200",
  High:     "bg-orange-100 text-orange-700 border-orange-200",
  Medium:   "bg-yellow-100 text-yellow-700 border-yellow-200",
  Low:      "bg-slate-100 text-slate-600 border-slate-200",
};

function StatusBadge({ status }: { status: string }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.Pending;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
      {cfg.icon}{cfg.label}
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  const cfg = TYPE_CONFIG[type] ?? { color: "bg-slate-100 text-slate-600 border-slate-200", icon: null };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
      {cfg.icon}{type}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${PRIORITY_CONFIG[priority] ?? ""}`}>
      {priority}
    </span>
  );
}

function CaseStatusSelect({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`text-xs px-2 py-0.5 rounded-full border font-medium cursor-pointer focus:outline-none ${
        STATUS_CONFIG[value]?.color ?? ""
      }`}
    >
      {Object.keys(STATUS_CONFIG).map((s) => (
        <option key={s} value={s}>{s}</option>
      ))}
    </select>
  );
}

function TcDetailPanel({ docId }: { docId: number }) {
  const [data, setData] = useState<TcDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [caseStatuses, setCaseStatuses] = useState<Record<string, string>>({});
  const [expandedCase, setExpandedCase] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState("All");
  const [priorityFilter, setPriorityFilter] = useState("All");

  useEffect(() => {
    const token = localStorage.getItem("token");
    fetch(`${API}/api/stream/test-case-documents/${docId}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => {
        setData(d);
        const initial: Record<string, string> = {};
        d.test_cases?.forEach((tc: TestCase) => { initial[tc.id] = tc.status; });
        setCaseStatuses(initial);
      })
      .finally(() => setLoading(false));
  }, [docId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-400">
        <div className="animate-spin w-5 h-5 border-2 border-violet-500 border-t-transparent rounded-full mr-2" />
        Loading test cases…
      </div>
    );
  }
  if (!data) return <p className="py-8 text-center text-slate-400">Failed to load.</p>;

  const types = ["All", "System", "Integration", "UAT"];
  const priorities = ["All", "Critical", "High", "Medium", "Low"];

  const filtered = data.test_cases.filter((tc) => {
    if (typeFilter !== "All" && tc.type !== typeFilter) return false;
    if (priorityFilter !== "All" && tc.priority !== priorityFilter) return false;
    return true;
  });

  const passed  = Object.values(caseStatuses).filter((s) => s === "Pass").length;
  const failed  = Object.values(caseStatuses).filter((s) => s === "Fail").length;
  const blocked = Object.values(caseStatuses).filter((s) => s === "Blocked").length;
  const pending = Object.values(caseStatuses).filter((s) => s === "Pending").length;
  const total   = data.meta.total_cases;

  return (
    <div className="p-6 space-y-6">
      {/* Summary pills */}
      <div className="flex flex-wrap gap-3">
        {[
          { label: "Total", val: total, color: "bg-slate-100 text-slate-700" },
          { label: "System", val: data.meta.summary.system, color: "bg-violet-100 text-violet-700" },
          { label: "Integration", val: data.meta.summary.integration, color: "bg-blue-100 text-blue-700" },
          { label: "UAT", val: data.meta.summary.uat, color: "bg-teal-100 text-teal-700" },
          { label: "Critical", val: data.meta.summary.critical, color: "bg-red-100 text-red-700" },
          { label: "High", val: data.meta.summary.high, color: "bg-orange-100 text-orange-700" },
        ].map((s) => (
          <span key={s.label} className={`px-3 py-1 rounded-full text-xs font-semibold ${s.color}`}>
            {s.label}: {s.val}
          </span>
        ))}
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
          <span>Execution Progress</span>
          <span>{passed} / {total} passed</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden flex">
          <div className="bg-emerald-500 transition-all" style={{ width: `${(passed / total) * 100}%` }} />
          <div className="bg-red-400 transition-all" style={{ width: `${(failed / total) * 100}%` }} />
          <div className="bg-amber-400 transition-all" style={{ width: `${(blocked / total) * 100}%` }} />
        </div>
        <div className="flex gap-4 mt-1 text-xs text-slate-500">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />Pass: {passed}</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400 inline-block" />Fail: {failed}</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />Blocked: {blocked}</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-slate-300 inline-block" />Pending: {pending}</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Filter className="w-4 h-4 text-slate-400" />
        <div className="flex items-center gap-1">
          <span className="text-xs text-slate-500 mr-1">Type:</span>
          {types.map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                typeFilter === t
                  ? "bg-violet-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 ml-4">
          <span className="text-xs text-slate-500 mr-1">Priority:</span>
          {priorities.map((p) => (
            <button
              key={p}
              onClick={() => setPriorityFilter(p)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                priorityFilter === p
                  ? "bg-violet-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Test case list */}
      <div className="space-y-3">
        {filtered.map((tc) => {
          const isOpen = expandedCase === tc.id;
          return (
            <div key={tc.id} className="border border-slate-200 rounded-xl overflow-hidden">
              {/* Row header */}
              <div
                className="flex items-center gap-3 px-4 py-3 bg-white hover:bg-slate-50 cursor-pointer"
                onClick={() => setExpandedCase(isOpen ? null : tc.id)}
              >
                <button className="text-slate-400 flex-shrink-0">
                  {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
                <span className="font-mono text-xs font-semibold text-slate-500 w-16 flex-shrink-0">{tc.id}</span>
                <span className="text-sm font-medium text-slate-800 flex-1 min-w-0 truncate">{tc.name}</span>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <TypeBadge type={tc.type} />
                  <PriorityBadge priority={tc.priority} />
                  <CaseStatusSelect
                    value={caseStatuses[tc.id] ?? tc.status}
                    onChange={(v) => setCaseStatuses((prev) => ({ ...prev, [tc.id]: v }))}
                  />
                </div>
              </div>

              {/* Expanded detail */}
              {isOpen && (
                <div className="border-t border-slate-100 bg-slate-50 p-4 space-y-4">
                  <p className="text-sm text-slate-600">{tc.description}</p>

                  {/* Preconditions */}
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Preconditions</p>
                    <ul className="space-y-1">
                      {tc.preconditions.map((pre, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
                          <span className="w-4 h-4 rounded-full bg-violet-100 text-violet-700 text-xs flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                          {pre}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Steps */}
                  <div>
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Test Steps</p>
                    <div className="rounded-lg border border-slate-200 overflow-hidden bg-white">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 w-10">#</th>
                            <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500">Action</th>
                            <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500">Expected Result</th>
                          </tr>
                        </thead>
                        <tbody>
                          {tc.steps.map((step) => (
                            <tr key={step.step_num} className="border-b border-slate-100 last:border-0">
                              <td className="px-3 py-2.5 text-xs font-bold text-slate-400">{step.step_num}</td>
                              <td className="px-3 py-2.5 text-slate-700">{step.action}</td>
                              <td className="px-3 py-2.5 text-slate-600">{step.expected}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Expected result */}
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">
                    <p className="text-xs font-semibold text-emerald-700 mb-1">Expected Result</p>
                    <p className="text-sm text-emerald-800">{tc.expected_result}</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-center py-8 text-slate-400 text-sm">No test cases match the current filters.</p>
        )}
      </div>
    </div>
  );
}

export default function TestCasesPage() {
  const [docs, setDocs] = useState<TcListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const load = useCallback(() => {
    const token = localStorage.getItem("token");
    fetch(`${API}/api/stream/test-case-documents`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setDocs(Array.isArray(d) ? d : []))
      .catch(() => setDocs([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = docs.filter((d) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      d.doc_id.toLowerCase().includes(q) ||
      d.request_title?.toLowerCase().includes(q) ||
      d.req_number?.toLowerCase().includes(q) ||
      d.frd_doc_id?.toLowerCase().includes(q)
    );
  });

  const totalDocs    = docs.length;
  const totalCases   = docs.reduce((a, d) => a + d.total_cases, 0);
  const totalSystem  = docs.reduce((a, d) => a + (d.summary?.system ?? 0), 0);
  const totalUat     = docs.reduce((a, d) => a + (d.summary?.uat ?? 0), 0);
  const totalInteg   = docs.reduce((a, d) => a + (d.summary?.integration ?? 0), 0);
  const totalCrit    = docs.reduce((a, d) => a + (d.summary?.critical ?? 0), 0);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-violet-600 to-purple-700 px-8 py-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <FlaskConical className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Test Cases</h1>
            <p className="text-violet-200 text-sm">AI-generated test case documents derived from FRDs</p>
          </div>
        </div>
      </div>

      <div className="px-8 py-6 space-y-6">
        {/* Stat cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { label: "TC Documents",  val: totalDocs,   color: "from-violet-500 to-purple-600", icon: <FlaskConical className="w-5 h-5" /> },
            { label: "Total Cases",   val: totalCases,  color: "from-slate-600 to-slate-700",   icon: <Layers className="w-5 h-5" /> },
            { label: "System",        val: totalSystem, color: "from-indigo-500 to-indigo-600", icon: <Layers className="w-5 h-5" /> },
            { label: "Integration",   val: totalInteg,  color: "from-blue-500 to-blue-600",     icon: <Zap className="w-5 h-5" /> },
            { label: "UAT",           val: totalUat,    color: "from-teal-500 to-teal-600",     icon: <Users className="w-5 h-5" /> },
            { label: "Critical",      val: totalCrit,   color: "from-red-500 to-red-600",       icon: <AlertTriangle className="w-5 h-5" /> },
          ].map((s) => (
            <div key={s.label} className={`bg-gradient-to-br ${s.color} rounded-2xl p-4 text-white shadow`}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium opacity-80">{s.label}</p>
                <div className="opacity-60">{s.icon}</div>
              </div>
              <p className="text-2xl font-bold">{s.val}</p>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by request, doc ID, FRD ref…"
            className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400"
          />
        </div>

        {/* Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">Test Case Documents</h2>
            <span className="text-sm text-slate-500">{filtered.length} document{filtered.length !== 1 ? "s" : ""}</span>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16 text-slate-400">
              <div className="animate-spin w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full mr-3" />
              Loading test case documents…
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center">
              <FlaskConical className="w-12 h-12 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400 font-medium">No test case documents yet</p>
              <p className="text-slate-400 text-sm mt-1">Generate test cases from an FRD in the FRD Management page.</p>
            </div>
          ) : (
            <div>
              {/* Header row */}
              <div className="grid grid-cols-12 gap-4 px-6 py-3 bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wide">
                <div className="col-span-1" />
                <div className="col-span-2">Doc ID</div>
                <div className="col-span-3">Request</div>
                <div className="col-span-2">FRD Ref</div>
                <div className="col-span-2">Cases</div>
                <div className="col-span-2">Generated</div>
              </div>

              {filtered.map((doc) => {
                const isOpen = expandedId === doc.id;
                return (
                  <div key={doc.id} className="border-b border-slate-100 last:border-0">
                    {/* Row */}
                    <div
                      className="grid grid-cols-12 gap-4 px-6 py-4 items-center hover:bg-slate-50 cursor-pointer transition-colors"
                      onClick={() => setExpandedId(isOpen ? null : doc.id)}
                    >
                      <div className="col-span-1">
                        {isOpen
                          ? <ChevronDown className="w-4 h-4 text-slate-400" />
                          : <ChevronRight className="w-4 h-4 text-slate-400" />
                        }
                      </div>
                      <div className="col-span-2">
                        <p className="font-mono text-xs font-bold text-violet-700">{doc.doc_id}</p>
                        <p className="text-xs text-slate-400 mt-0.5">v1.0</p>
                      </div>
                      <div className="col-span-3">
                        <p className="text-sm font-medium text-slate-800 truncate">{doc.request_title}</p>
                        <p className="text-xs text-slate-400">{doc.req_number}</p>
                      </div>
                      <div className="col-span-2">
                        <span className="font-mono text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                          {doc.frd_doc_id}
                        </span>
                      </div>
                      <div className="col-span-2">
                        <div className="flex flex-wrap gap-1">
                          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold">
                            {doc.total_cases} total
                          </span>
                          {doc.summary?.critical > 0 && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                              {doc.summary.critical} crit
                            </span>
                          )}
                          <span className="text-xs px-2 py-0.5 rounded-full bg-violet-50 text-violet-700">
                            {doc.summary?.system ?? 0} sys
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-teal-50 text-teal-700">
                            {doc.summary?.uat ?? 0} uat
                          </span>
                        </div>
                      </div>
                      <div className="col-span-2">
                        <p className="text-xs text-slate-600">
                          {new Date(doc.generated_at).toLocaleDateString("en-GB", {
                            day: "numeric", month: "short", year: "numeric",
                          })}
                        </p>
                        <p className="text-xs text-slate-400">{doc.generated_by_name}</p>
                      </div>
                    </div>

                    {/* Expanded panel */}
                    {isOpen && (
                      <div className="border-t border-violet-100 bg-violet-50/30">
                        {/* Sub-header */}
                        <div className="px-6 py-3 flex items-center gap-2 border-b border-violet-100">
                          <ShieldCheck className="w-4 h-4 text-violet-500" />
                          <span className="text-sm font-semibold text-violet-800">{doc.title}</span>
                          <span className="ml-auto text-xs text-slate-400">Click a row to expand steps • Update status inline</span>
                        </div>
                        <TcDetailPanel docId={doc.id} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
