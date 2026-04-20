"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  ClipboardCheck, CheckCircle2, XCircle, Clock, AlertTriangle,
  ArrowLeft, FileText, RefreshCw, Users, Sliders, Trash2,
  UserPlus, Send, ThumbsUp, ThumbsDown, Search,
  Bug, ShieldCheck, Rocket, Filter, Activity, TrendingUp,
  CircleDot, ChevronDown, ChevronRight, MoreHorizontal,
  SortAsc, SortDesc, Check, Square, Minus, Tag, Calendar,
  BarChart3, Eye, EyeOff,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_BACKEND_URL;

function authHeader(): Record<string, string> {
  const t = localStorage.getItem("authToken");
  return t ? { Authorization: `Bearer ${t}` } : {};
}

// ─── Types ───────────────────────────────────────────────────────────────────

interface TcDocSummary {
  id: number;
  doc_id: string;
  title: string;
  request_title: string;
  req_number: string;
  request_id: number;
  generated_at: string;
}

interface UATCase {
  id: string;
  name: string;
  type: string;
  description: string;
  steps?: { step_num: number; action: string; expected: string }[];
}

interface Assignment {
  id: number;
  test_case_id: string;
  stakeholder_id: number;
  stakeholder_name: string;
  stakeholder_email: string;
  status: string;
  test_mode: string;
  remarks: string;
  manual_notes: string;
  assigned_at: string;
  updated_at: string;
}

interface Stakeholder {
  id: number;
  name: string;
  email: string;
}

interface ApprovalRequest {
  id: number;
  status: string;
  pass_rate: number;
  submitted_at: string;
  reviewed_at: string | null;
  comment: string | null;
}

interface UATData {
  uat_cases: UATCase[];
  assignments: Assignment[];
  threshold: number;
  pass_rate: number;
  sit_released: boolean;
  approval: ApprovalRequest | null;
}

interface ProductionRelease {
  id: number;
  status: string;
  created_at: string;
  marked_completed_at: string | null;
  completed_by_name: string | null;
}

interface Defect {
  id: number;
  title: string;
  description: string;
  severity: string;
  status: string;
  remarks: string | null;
  created_at: string;
  updated_at: string;
  reported_by_name: string;
  reported_by_email: string;
  assigned_to_name: string | null;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_PILL: Record<string, string> = {
  Pass:          "bg-emerald-100 text-emerald-700 border-emerald-200",
  Fail:          "bg-red-100 text-red-700 border-red-200",
  "In Progress": "bg-amber-100 text-amber-700 border-amber-200",
  Pending:       "bg-slate-100 text-slate-500 border-slate-200",
  Unassigned:    "bg-slate-100 text-slate-400 border-slate-200",
};

const SEV_PILL: Record<string, string> = {
  Critical: "bg-red-100 text-red-700 border-red-300",
  High:     "bg-orange-100 text-orange-700 border-orange-300",
  Medium:   "bg-amber-100 text-amber-700 border-amber-300",
  Low:      "bg-slate-100 text-slate-500 border-slate-200",
};

const DEFECT_STATUS_PILL: Record<string, string> = {
  Open:          "bg-red-100 text-red-700",
  "In Progress": "bg-amber-100 text-amber-700",
  Resolved:      "bg-emerald-100 text-emerald-700",
  Closed:        "bg-slate-100 text-slate-500",
};

function StatusIcon({ status }: { status: string }) {
  if (status === "Pass")          return <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />;
  if (status === "Fail")          return <XCircle className="w-3.5 h-3.5 text-red-500" />;
  if (status === "In Progress")   return <Clock className="w-3.5 h-3.5 text-amber-500" />;
  return <CircleDot className="w-3.5 h-3.5 text-slate-400" />;
}

function initials(name: string) {
  return name.split(" ").map(w => w[0]).join("").toUpperCase().slice(0, 2);
}

// ─── Document List ────────────────────────────────────────────────────────────

function DocList({ onSelect }: { onSelect: (doc: TcDocSummary) => void }) {
  const [docs, setDocs] = useState<TcDocSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch(`${API}/api/testing/uat/documents`, { headers: authHeader() })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setDocs(data.map(d => ({
            id: d.id, doc_id: d.doc_id,
            title: d.title ?? d.doc_id,
            request_title: d.request_title,
            req_number: d.req_number,
            request_id: d.request_id,
            generated_at: d.generated_at,
          })));
        } else setError(data.message ?? "Failed to load");
      })
      .catch(() => setError("Network error"))
      .finally(() => setLoading(false));
  }, []);

  const filtered = docs.filter(d =>
    !search ||
    d.request_title.toLowerCase().includes(search.toLowerCase()) ||
    d.req_number.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return (
    <div className="flex items-center justify-center h-48 text-slate-400 gap-2">
      <RefreshCw className="w-5 h-5 animate-spin" /> Loading…
    </div>
  );

  if (error) return (
    <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
  );

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search requests…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-violet-200"
        />
      </div>

      {!filtered.length ? (
        <div className="flex flex-col items-center justify-center h-56 text-slate-400 gap-3 bg-white rounded-2xl border border-dashed border-slate-200">
          <ClipboardCheck className="w-10 h-10 opacity-30" />
          <p className="text-sm font-medium">{docs.length ? "No results match your search" : "No UAT oversight requests yet"}</p>
          <p className="text-xs text-slate-300">Documents appear once IT releases SIT for UAT</p>
        </div>
      ) : (
        /* Table */
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-800 text-white text-left">
                <th className="px-5 py-3 text-xs font-semibold">Request</th>
                <th className="px-4 py-3 text-xs font-semibold hidden sm:table-cell">Doc ID</th>
                <th className="px-4 py-3 text-xs font-semibold hidden md:table-cell">Released</th>
                <th className="px-4 py-3 text-xs font-semibold">Status</th>
                <th className="px-4 py-3 text-xs font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(doc => (
                <tr key={doc.id} className="hover:bg-violet-50/40 transition-colors group">
                  <td className="px-5 py-3.5">
                    <p className="font-semibold text-slate-800 group-hover:text-violet-700 transition-colors">{doc.request_title}</p>
                    <p className="text-[11px] text-slate-400 mt-0.5">{doc.req_number}</p>
                  </td>
                  <td className="px-4 py-3.5 hidden sm:table-cell">
                    <span className="font-mono text-xs text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">{doc.doc_id}</span>
                  </td>
                  <td className="px-4 py-3.5 hidden md:table-cell">
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      {new Date(doc.generated_at).toLocaleDateString()}
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-violet-100 text-violet-700 border border-violet-200">In UAT</span>
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <button
                      onClick={() => onSelect(doc)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white text-xs font-semibold rounded-lg hover:opacity-90 transition-opacity shadow-sm"
                    >
                      <Eye className="w-3.5 h-3.5" /> Manage
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-5 py-2.5 border-t border-slate-100 bg-slate-50 text-xs text-slate-400">
            {filtered.length} request{filtered.length !== 1 ? "s" : ""} in UAT
          </div>
        </div>
      )}
    </div>
  );
}

// ─── UAT Cases Table ──────────────────────────────────────────────────────────

type SortKey = "id" | "name" | "type" | "status";

function UATCasesTable({
  cases, assignments, stakeholders, docId, requestId,
  onAssign, onRemove, threshold,
}: {
  cases: UATCase[];
  assignments: Assignment[];
  stakeholders: Stakeholder[];
  docId: number;
  requestId: number;
  onAssign: () => void;
  onRemove: (id: number) => void;
  threshold: number;
}) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [sortKey, setSortKey] = useState<SortKey>("id");
  const [sortAsc, setSortAsc] = useState(true);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [selectedRows, setSelectedRows] = useState<Set<string>>(new Set());
  const [bulkStakeholder, setBulkStakeholder] = useState<number>(0);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [showAssignCol, setShowAssignCol] = useState(true);

  const assignmentsByCase = useMemo(() =>
    assignments.reduce<Record<string, Assignment[]>>((acc, a) => {
      acc[a.test_case_id] = acc[a.test_case_id] || [];
      acc[a.test_case_id].push(a);
      return acc;
    }, {}), [assignments]);

  function caseStatus(tcId: string) {
    const asgns = assignmentsByCase[tcId] ?? [];
    if (!asgns.length) return "Unassigned";
    if (asgns.every(a => a.status === "Pass")) return "Pass";
    if (asgns.some(a => a.status === "Fail")) return "Fail";
    if (asgns.some(a => a.status === "In Progress")) return "In Progress";
    return "Pending";
  }

  const uniqueTypes = ["All", ...Array.from(new Set(cases.map(c => c.type).filter(Boolean)))];
  const uniqueStatuses = ["All", "Unassigned", "Pending", "In Progress", "Pass", "Fail"];

  const filtered = useMemo(() => {
    let rows = [...cases];
    if (search) rows = rows.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.id.toLowerCase().includes(search.toLowerCase()));
    if (typeFilter !== "All") rows = rows.filter(c => c.type === typeFilter);
    if (statusFilter !== "All") rows = rows.filter(c => caseStatus(c.id) === statusFilter);
    rows.sort((a, b) => {
      let va = a[sortKey as keyof UATCase] as string ?? "";
      let vb = b[sortKey as keyof UATCase] as string ?? "";
      if (sortKey === "status") { va = caseStatus(a.id); vb = caseStatus(b.id); }
      return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
    });
    return rows;
  }, [cases, search, typeFilter, statusFilter, sortKey, sortAsc, assignments]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <SortAsc className="w-3 h-3 text-slate-300" />;
    return sortAsc ? <SortAsc className="w-3 h-3 text-violet-400" /> : <SortDesc className="w-3 h-3 text-violet-400" />;
  }

  const allSelected = filtered.length > 0 && filtered.every(c => selectedRows.has(c.id));
  const someSelected = filtered.some(c => selectedRows.has(c.id));

  function toggleAll() {
    if (allSelected) setSelectedRows(new Set());
    else setSelectedRows(new Set(filtered.map(c => c.id)));
  }
  function toggleRow(id: string) {
    const s = new Set(selectedRows);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelectedRows(s);
  }

  async function bulkAssign() {
    if (!bulkStakeholder || !selectedRows.size) return;
    setBulkLoading(true);
    for (const tcId of selectedRows) {
      await fetch(`${API}/api/testing/uat/${docId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ test_case_id: tcId, stakeholder_id: bulkStakeholder }),
      });
    }
    setBulkLoading(false);
    setSelectedRows(new Set());
    setBulkStakeholder(0);
    onAssign();
  }

  const passCount   = cases.filter(c => caseStatus(c.id) === "Pass").length;
  const failCount   = cases.filter(c => caseStatus(c.id) === "Fail").length;
  const ipCount     = cases.filter(c => caseStatus(c.id) === "In Progress").length;
  const unassigned  = cases.filter(c => caseStatus(c.id) === "Unassigned").length;

  return (
    <div className="space-y-4">
      {/* Mini stat pills */}
      <div className="flex flex-wrap gap-2">
        {[
          { label: "Total", val: cases.length, cls: "bg-slate-100 text-slate-600" },
          { label: "Pass", val: passCount, cls: "bg-emerald-100 text-emerald-700" },
          { label: "Fail", val: failCount, cls: "bg-red-100 text-red-700" },
          { label: "In Progress", val: ipCount, cls: "bg-amber-100 text-amber-700" },
          { label: "Unassigned", val: unassigned, cls: "bg-violet-100 text-violet-700" },
        ].map(s => (
          <button
            key={s.label}
            onClick={() => setStatusFilter(statusFilter === s.label ? "All" : s.label)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border border-transparent hover:border-current transition-all ${s.cls} ${statusFilter === s.label ? "ring-2 ring-offset-1 ring-current" : ""}`}
          >
            {s.val} {s.label}
          </button>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search cases by name or ID…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-violet-200"
          />
        </div>

        <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-xl p-1 overflow-x-auto shrink-0">
          <Tag className="w-3.5 h-3.5 text-slate-400 ml-1.5 shrink-0" />
          {uniqueTypes.map(t => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-2.5 py-1 text-xs font-semibold rounded-lg whitespace-nowrap transition-all ${typeFilter === t ? "bg-violet-600 text-white" : "text-slate-500 hover:bg-slate-100"}`}
            >
              {t}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowAssignCol(!showAssignCol)}
          className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 bg-white text-xs font-semibold text-slate-600 rounded-xl hover:bg-slate-50 shrink-0"
        >
          {showAssignCol ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          Assignees
        </button>
      </div>

      {/* Bulk assign bar */}
      {selectedRows.size > 0 && (
        <div className="flex items-center gap-3 px-4 py-3 bg-violet-50 border border-violet-200 rounded-xl">
          <span className="text-sm font-semibold text-violet-700">{selectedRows.size} case{selectedRows.size !== 1 ? "s" : ""} selected</span>
          <select
            value={bulkStakeholder}
            onChange={e => setBulkStakeholder(Number(e.target.value))}
            className="text-sm border border-violet-300 rounded-lg px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-violet-200 flex-1 max-w-xs"
          >
            <option value={0}>Select stakeholder to assign…</option>
            {stakeholders.map(s => (
              <option key={s.id} value={s.id}>{s.name || s.email}</option>
            ))}
          </select>
          <button
            onClick={bulkAssign}
            disabled={!bulkStakeholder || bulkLoading}
            className="px-4 py-1.5 bg-violet-600 text-white text-sm font-semibold rounded-lg hover:bg-violet-700 disabled:opacity-40 transition-colors"
          >
            {bulkLoading ? "Assigning…" : "Assign"}
          </button>
          <button
            onClick={() => setSelectedRows(new Set())}
            className="text-xs text-violet-500 hover:text-violet-700 font-medium"
          >
            Clear
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-800 text-white text-left">
                <th className="px-4 py-3 w-10">
                  <button onClick={toggleAll} className="flex items-center justify-center w-4 h-4 rounded border-2 border-slate-500 hover:border-white transition-colors">
                    {allSelected ? <Check className="w-2.5 h-2.5 text-white" /> : someSelected ? <Minus className="w-2.5 h-2.5 text-white" /> : null}
                  </button>
                </th>
                <th className="px-3 py-3 text-xs font-semibold cursor-pointer" onClick={() => toggleSort("id")}>
                  <span className="flex items-center gap-1">ID <SortIcon k="id" /></span>
                </th>
                <th className="px-3 py-3 text-xs font-semibold cursor-pointer" onClick={() => toggleSort("name")}>
                  <span className="flex items-center gap-1">Test Case <SortIcon k="name" /></span>
                </th>
                <th className="px-3 py-3 text-xs font-semibold cursor-pointer" onClick={() => toggleSort("type")}>
                  <span className="flex items-center gap-1">Type <SortIcon k="type" /></span>
                </th>
                {showAssignCol && <th className="px-3 py-3 text-xs font-semibold">Assigned To</th>}
                <th className="px-3 py-3 text-xs font-semibold cursor-pointer" onClick={() => toggleSort("status")}>
                  <span className="flex items-center gap-1">Status <SortIcon k="status" /></span>
                </th>
                <th className="px-3 py-3 text-xs font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={showAssignCol ? 7 : 6} className="px-4 py-10 text-center text-sm text-slate-400">
                    No cases match your filters
                  </td>
                </tr>
              )}
              {filtered.map(tc => {
                const caseAsgns = assignmentsByCase[tc.id] ?? [];
                const status = caseStatus(tc.id);
                const isExpanded = expandedRow === tc.id;
                const isSelected = selectedRows.has(tc.id);

                return (
                  <>
                    <tr
                      key={tc.id}
                      className={`transition-colors hover:bg-slate-50 ${isSelected ? "bg-violet-50/60" : ""} ${isExpanded ? "bg-slate-50" : ""}`}
                    >
                      <td className="px-4 py-3">
                        <button
                          onClick={() => toggleRow(tc.id)}
                          className="flex items-center justify-center w-4 h-4 rounded border-2 border-slate-300 hover:border-violet-500 transition-colors"
                        >
                          {isSelected && <Check className="w-2.5 h-2.5 text-violet-600" />}
                        </button>
                      </td>
                      <td className="px-3 py-3">
                        <button
                          onClick={() => setExpandedRow(isExpanded ? null : tc.id)}
                          className="flex items-center gap-1 font-mono text-[11px] text-slate-500 hover:text-violet-600 transition-colors"
                        >
                          {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                          {tc.id}
                        </button>
                      </td>
                      <td className="px-3 py-3 max-w-xs">
                        <p className="font-semibold text-slate-800 truncate">{tc.name}</p>
                        {tc.description && (
                          <p className="text-[11px] text-slate-400 truncate mt-0.5">{tc.description}</p>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        {tc.type && (
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100 whitespace-nowrap">
                            {tc.type}
                          </span>
                        )}
                      </td>
                      {showAssignCol && (
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-1 flex-wrap">
                            {caseAsgns.slice(0, 3).map(a => (
                              <span
                                key={a.id}
                                title={`${a.stakeholder_name || a.stakeholder_email} — ${a.status}`}
                                className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-violet-100 text-violet-700 text-[9px] font-bold border border-violet-200"
                              >
                                {initials(a.stakeholder_name || a.stakeholder_email)}
                              </span>
                            ))}
                            {caseAsgns.length > 3 && (
                              <span className="text-[10px] text-slate-400">+{caseAsgns.length - 3}</span>
                            )}
                            {caseAsgns.length === 0 && (
                              <span className="text-[10px] text-slate-400 italic">None</span>
                            )}
                          </div>
                        </td>
                      )}
                      <td className="px-3 py-3">
                        <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${STATUS_PILL[status]}`}>
                          <StatusIcon status={status} />
                          {status}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right">
                        <AssignDropdown
                          tc={tc}
                          caseAsgns={caseAsgns}
                          stakeholders={stakeholders}
                          docId={docId}
                          onAssign={onAssign}
                          onRemove={onRemove}
                        />
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${tc.id}-exp`} className="bg-slate-50 border-t border-slate-100">
                        <td colSpan={showAssignCol ? 7 : 6} className="px-6 py-4">
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <div>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">Description</p>
                              <p className="text-sm text-slate-600">{tc.description || "—"}</p>
                              {tc.steps && tc.steps.length > 0 && (
                                <div className="mt-3 space-y-1.5">
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">Test Steps</p>
                                  {tc.steps.map(s => (
                                    <div key={s.step_num} className="flex gap-2 text-xs">
                                      <span className="w-5 h-5 shrink-0 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-[10px] font-bold">{s.step_num}</span>
                                      <div>
                                        <span className="text-slate-700">{s.action}</span>
                                        {s.expected && <span className="text-slate-400 ml-2">→ {s.expected}</span>}
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            {caseAsgns.length > 0 && (
                              <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-2">Assignments</p>
                                <div className="space-y-1.5">
                                  {caseAsgns.map(a => (
                                    <div key={a.id} className="flex items-center gap-2 p-2 bg-white rounded-lg border border-slate-200">
                                      <span className="w-6 h-6 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-[9px] font-bold shrink-0">
                                        {initials(a.stakeholder_name || a.stakeholder_email)}
                                      </span>
                                      <div className="flex-1 min-w-0">
                                        <p className="text-xs font-semibold text-slate-700 truncate">{a.stakeholder_name || a.stakeholder_email}</p>
                                        {a.remarks && <p className="text-[10px] text-slate-400 truncate">{a.remarks}</p>}
                                      </div>
                                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${STATUS_PILL[a.status]}`}>{a.status}</span>
                                      <button onClick={() => onRemove(a.id)} className="p-0.5 text-slate-300 hover:text-red-500 transition-colors">
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-5 py-2.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between text-xs text-slate-400">
          <span>{filtered.length} of {cases.length} cases</span>
          {selectedRows.size > 0 && (
            <span className="text-violet-600 font-semibold">{selectedRows.size} selected</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Assign Dropdown ──────────────────────────────────────────────────────────

function AssignDropdown({ tc, caseAsgns, stakeholders, docId, onAssign, onRemove }: {
  tc: UATCase;
  caseAsgns: Assignment[];
  stakeholders: Stakeholder[];
  docId: number;
  onAssign: () => void;
  onRemove: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<number | null>(null);

  async function assign(shId: number) {
    setLoading(shId);
    await fetch(`${API}/api/testing/uat/${docId}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeader() },
      body: JSON.stringify({ test_case_id: tc.id, stakeholder_id: shId }),
    });
    setLoading(null);
    setOpen(false);
    onAssign();
  }

  const assignedIds = new Set(caseAsgns.map(a => a.stakeholder_id));
  const available = stakeholders.filter(s => !assignedIds.has(s.id));

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
      >
        <UserPlus className="w-3.5 h-3.5" />
        {available.length === 0 && caseAsgns.length > 0 ? "All assigned" : "Assign"}
        <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-lg z-20 overflow-hidden">
            {available.length > 0 && (
              <div className="p-1">
                <p className="text-[10px] font-semibold text-slate-400 px-2 py-1 uppercase tracking-wide">Assign to</p>
                {available.map(s => (
                  <button
                    key={s.id}
                    onClick={() => assign(s.id)}
                    disabled={loading === s.id}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-slate-700 hover:bg-violet-50 rounded-lg transition-colors disabled:opacity-50"
                  >
                    <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-[9px] font-bold shrink-0">
                      {initials(s.name || s.email)}
                    </span>
                    <span className="truncate">{s.name || s.email}</span>
                    {loading === s.id && <RefreshCw className="w-3 h-3 animate-spin ml-auto" />}
                  </button>
                ))}
              </div>
            )}
            {caseAsgns.length > 0 && (
              <div className="border-t border-slate-100 p-1">
                <p className="text-[10px] font-semibold text-slate-400 px-2 py-1 uppercase tracking-wide">Remove</p>
                {caseAsgns.map(a => (
                  <button
                    key={a.id}
                    onClick={() => { onRemove(a.id); setOpen(false); }}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span className="truncate">{a.stakeholder_name || a.stakeholder_email}</span>
                  </button>
                ))}
              </div>
            )}
            {available.length === 0 && caseAsgns.length === 0 && (
              <p className="text-xs text-slate-400 px-3 py-2">No stakeholders available</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Stakeholder Breakdown Table ──────────────────────────────────────────────

function StakeholderBreakdown({ assignments, threshold }: { assignments: Assignment[]; threshold: number }) {
  const byStakeholder = useMemo(() => {
    const map: Record<string, Assignment[]> = {};
    for (const a of assignments) {
      const key = String(a.stakeholder_id);
      map[key] = map[key] || [];
      map[key].push(a);
    }
    return Object.values(map);
  }, [assignments]);

  if (!byStakeholder.length) return (
    <div className="flex items-center justify-center h-20 text-slate-400 text-sm bg-slate-50 rounded-xl border border-dashed border-slate-200">
      No stakeholders assigned yet
    </div>
  );

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-2">
        <Users className="w-4 h-4 text-violet-500" />
        <span className="font-semibold text-slate-800 text-sm">Stakeholder Progress</span>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-50 text-left">
            <th className="px-5 py-2.5 text-xs font-semibold text-slate-500">Stakeholder</th>
            <th className="px-4 py-2.5 text-xs font-semibold text-slate-500">Assigned</th>
            <th className="px-4 py-2.5 text-xs font-semibold text-slate-500">Pass</th>
            <th className="px-4 py-2.5 text-xs font-semibold text-slate-500">Fail</th>
            <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 min-w-[120px]">Progress</th>
            <th className="px-4 py-2.5 text-xs font-semibold text-slate-500">Rate</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {byStakeholder.map(asgns => {
            const name = asgns[0].stakeholder_name || asgns[0].stakeholder_email;
            const passed = asgns.filter(a => a.status === "Pass").length;
            const failed = asgns.filter(a => a.status === "Fail").length;
            const rate = Math.round((passed / asgns.length) * 100);
            const ok = rate >= threshold;
            return (
              <tr key={asgns[0].stakeholder_id} className="hover:bg-slate-50">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-2">
                    <span className="w-7 h-7 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-[10px] font-bold shrink-0">
                      {initials(name)}
                    </span>
                    <div>
                      <p className="text-xs font-semibold text-slate-800">{name}</p>
                      <p className="text-[10px] text-slate-400">{asgns[0].stakeholder_email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm font-semibold text-slate-700">{asgns.length}</td>
                <td className="px-4 py-3 text-sm font-semibold text-emerald-600">{passed}</td>
                <td className="px-4 py-3 text-sm font-semibold text-red-500">{failed}</td>
                <td className="px-4 py-3">
                  <div className="h-2 bg-slate-100 rounded-full overflow-hidden w-24">
                    <div
                      className={`h-full rounded-full transition-all ${ok ? "bg-emerald-500" : "bg-violet-500"}`}
                      style={{ width: `${rate}%` }}
                    />
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-bold ${ok ? "text-emerald-600" : "text-amber-600"}`}>{rate}%</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── UAT Oversight Detail ─────────────────────────────────────────────────────

function UATOversightDetail({ doc, onBack }: { doc: TcDocSummary; onBack: () => void }) {
  const [data, setData] = useState<UATData | null>(null);
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [release, setRelease] = useState<ProductionRelease | null>(null);
  const [defects, setDefects] = useState<Defect[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [thresholdEdit, setThresholdEdit] = useState(false);
  const [newThreshold, setNewThreshold] = useState(80);
  const [approvalComment, setApprovalComment] = useState("");
  const [approvingAction, setApprovingAction] = useState<"approve" | "reject" | null>(null);
  const [completingRelease, setCompletingRelease] = useState(false);
  const [msg, setMsg] = useState("");
  const [activeTab, setActiveTab] = useState<"uat" | "approvals" | "defects" | "release">("uat");
  const [defectSort, setDefectSort] = useState<"severity" | "status" | "date">("date");
  const [defectFilter, setDefectFilter] = useState("All");
  const [updatingDefect, setUpdatingDefect] = useState<number | null>(null);

  const showMsg = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 3500); };

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetch(`${API}/api/testing/uat/${doc.id}`, { headers: authHeader() }).then(r => r.json()),
      fetch(`${API}/api/testing/stakeholders`, { headers: authHeader() }).then(r => r.json()),
      fetch(`${API}/api/deployments/release/${doc.request_id}`, { headers: authHeader() }).then(r => r.json()),
      fetch(`${API}/api/deployments/defects/${doc.request_id}`, { headers: authHeader() }).then(r => r.json()),
    ]).then(([uatData, shData, releaseData, defectData]) => {
      if (uatData.uat_cases) {
        setData(uatData);
        setNewThreshold(uatData.threshold);
      } else setError(uatData.message ?? "Failed to load UAT data");
      if (Array.isArray(shData)) setStakeholders(shData);
      setRelease(releaseData);
      if (Array.isArray(defectData)) setDefects(defectData);
    }).catch(() => setError("Network error"))
      .finally(() => setLoading(false));
  }, [doc.id, doc.request_id]);

  useEffect(() => { load(); }, [load]);

  const saveThreshold = async () => {
    const r = await fetch(`${API}/api/testing/uat/${doc.id}/config`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeader() },
      body: JSON.stringify({ pass_threshold: newThreshold }),
    });
    if (r.ok) { setThresholdEdit(false); load(); }
    else { const d = await r.json(); showMsg(d.message ?? "Failed"); }
  };

  const handleApproval = async (action: "approve" | "reject") => {
    if (!data?.approval) return;
    setApprovingAction(action);
    try {
      const r = await fetch(`${API}/api/testing/approvals/${data.approval.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ action, comment: approvalComment || null }),
      });
      const d = await r.json();
      if (r.ok) { load(); showMsg(action === "approve" ? "Approved for deployment" : "Approval rejected"); }
      else showMsg(d.message ?? "Action failed");
    } finally { setApprovingAction(null); }
  };

  const completeRelease = async () => {
    setCompletingRelease(true);
    try {
      const r = await fetch(`${API}/api/deployments/release/${doc.request_id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeader() },
      });
      const d = await r.json();
      if (r.ok) { load(); showMsg("Production release marked completed"); }
      else showMsg(d.message ?? "Failed");
    } finally { setCompletingRelease(false); }
  };

  const updateDefect = async (defectId: number, status: string) => {
    setUpdatingDefect(defectId);
    try {
      const r = await fetch(`${API}/api/deployments/defects/${defectId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({ status }),
      });
      if (r.ok) { load(); showMsg("Defect updated"); }
      else { const d = await r.json(); showMsg(d.message ?? "Update failed"); }
    } finally { setUpdatingDefect(null); }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-48 text-slate-400 gap-2">
      <RefreshCw className="w-5 h-5 animate-spin" /> Loading UAT data…
    </div>
  );
  if (error) return <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>;
  if (!data) return null;

  const { uat_cases, assignments, threshold, pass_rate, sit_released, approval } = data;
  const thresholdMet = pass_rate >= threshold;
  const openDefects = defects.filter(d => !["Resolved", "Closed"].includes(d.status)).length;
  const uniqAssigned = new Set(assignments.map(a => a.test_case_id)).size;

  const SEV_ORDER: Record<string, number> = { Critical: 0, High: 1, Medium: 2, Low: 3 };
  const filteredDefects = defects
    .filter(d => defectFilter === "All" || d.status === defectFilter)
    .sort((a, b) => {
      if (defectSort === "severity") return (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9);
      if (defectSort === "status") return a.status.localeCompare(b.status);
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const tabs = [
    { key: "uat" as const,       label: "UAT Cases",  icon: ClipboardCheck, badge: uat_cases.length },
    { key: "approvals" as const, label: "Approvals",  icon: ShieldCheck,    badge: approval ? 1 : 0 },
    { key: "defects" as const,   label: "Defects",    icon: Bug,            badge: openDefects, alert: openDefects > 0 },
    { key: "release" as const,   label: "Production", icon: Rocket,         badge: release ? 1 : 0 },
  ];

  return (
    <div className="space-y-5">
      {/* Gradient header */}
      <div className="bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 rounded-2xl p-5 text-white shadow-lg">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-start gap-3">
            <button onClick={onBack} className="mt-1 text-violet-200 hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="font-mono text-xs text-violet-200 bg-white/10 px-2 py-0.5 rounded">{doc.req_number}</span>
                <span className="font-mono text-xs text-violet-200 bg-white/10 px-2 py-0.5 rounded">{doc.doc_id}</span>
                {sit_released
                  ? <span className="text-xs text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded-full">SIT Passed</span>
                  : <span className="text-xs text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded-full">Awaiting SIT</span>
                }
              </div>
              <h2 className="text-xl font-bold">{doc.request_title}</h2>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {msg && <span className="text-xs px-3 py-1.5 rounded-lg bg-white/20">{msg}</span>}
            <button
              onClick={() => setThresholdEdit(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 text-sm font-medium rounded-xl border border-white/20 transition-colors"
            >
              <Sliders className="w-4 h-4" /> {threshold}% threshold
            </button>
          </div>
        </div>

        {/* KPI grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { icon: ClipboardCheck, label: "UAT Cases",    val: uat_cases.length, sub: `${uniqAssigned} assigned` },
            { icon: Users,          label: "Stakeholders", val: new Set(assignments.map(a => a.stakeholder_id)).size, sub: `${assignments.length} total assignments` },
            { icon: TrendingUp,     label: "Pass Rate",    val: `${pass_rate}%`, sub: thresholdMet ? "✓ Threshold met" : `${threshold - pass_rate}% below threshold` },
            { icon: Bug,            label: "Open Defects", val: openDefects, sub: `${defects.length} total` },
          ].map(k => (
            <div key={k.label} className="bg-white/10 border border-white/20 rounded-xl p-3 backdrop-blur-sm">
              <div className="flex items-center gap-1.5 mb-1.5">
                <k.icon className="w-3.5 h-3.5 text-violet-200" />
                <span className="text-[10px] text-violet-200 uppercase tracking-wide font-semibold">{k.label}</span>
              </div>
              <p className="text-2xl font-bold">{k.val}</p>
              <p className="text-[10px] text-violet-300 mt-0.5">{k.sub}</p>
            </div>
          ))}
        </div>

        {/* Pass rate bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-violet-200">Overall Pass Rate</span>
            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${thresholdMet ? "bg-emerald-500/30 text-emerald-200" : "bg-amber-500/30 text-amber-200"}`}>
              {thresholdMet ? `${pass_rate}% — Threshold Met ✓` : `${pass_rate}% — Need ${threshold}%`}
            </span>
          </div>
          <div className="h-2.5 bg-white/10 rounded-full overflow-hidden relative">
            <div
              className={`h-full rounded-full transition-all duration-700 ${thresholdMet ? "bg-emerald-400" : "bg-violet-300"}`}
              style={{ width: `${pass_rate}%` }}
            />
            <div className="absolute top-0 bottom-0 border-r-2 border-dashed border-white/50" style={{ left: `${threshold}%` }} />
          </div>
        </div>
      </div>

      {/* SIT warning */}
      {!sit_released && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3.5 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
          <p className="text-sm text-amber-700 font-medium">SIT testing not yet released — IT must release SIT before UAT can begin.</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold transition-all ${
              activeTab === tab.key ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{tab.label}</span>
            {tab.badge > 0 && (
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                tab.alert ? "bg-red-100 text-red-700" :
                activeTab === tab.key ? "bg-violet-100 text-violet-700" : "bg-slate-200 text-slate-500"
              }`}>{tab.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── UAT Cases ─────────────────────────────────────────────── */}
      {activeTab === "uat" && (
        <div className="space-y-4">
          <StakeholderBreakdown assignments={assignments} threshold={threshold} />
          <UATCasesTable
            cases={uat_cases}
            assignments={assignments}
            stakeholders={stakeholders}
            docId={doc.id}
            requestId={doc.request_id}
            onAssign={load}
            onRemove={async id => {
              await fetch(`${API}/api/testing/uat/assignments/${id}`, { method: "DELETE", headers: authHeader() });
              load();
            }}
            threshold={threshold}
          />
        </div>
      )}

      {/* ── Approvals ─────────────────────────────────────────────── */}
      {activeTab === "approvals" && (
        <div className="space-y-4">
          {!approval ? (
            <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-3 bg-white rounded-2xl border border-dashed border-slate-200">
              <ShieldCheck className="w-10 h-10 opacity-30" />
              <p className="text-sm font-medium">No approval request yet</p>
              <p className="text-xs text-slate-300">IT submits when UAT pass rate meets the threshold</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              {/* Header strip */}
              <div className={`px-5 py-4 border-b border-slate-100 ${
                approval.status === "Approved" ? "bg-gradient-to-r from-emerald-50 to-emerald-100/50" :
                approval.status === "Rejected" ? "bg-gradient-to-r from-red-50 to-red-100/50" :
                "bg-gradient-to-r from-blue-50 to-blue-100/50"
              }`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {approval.status === "Approved"
                      ? <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                      : approval.status === "Rejected"
                        ? <XCircle className="w-8 h-8 text-red-500" />
                        : <Clock className="w-8 h-8 text-blue-500" />
                    }
                    <div>
                      <p className="text-xs text-slate-500 mb-0.5">Approval Status</p>
                      <span className={`text-lg font-bold ${
                        approval.status === "Approved" ? "text-emerald-700" :
                        approval.status === "Rejected" ? "text-red-700" : "text-blue-700"
                      }`}>{approval.status}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-400">Submitted</p>
                    <p className="text-xs font-semibold text-slate-600">{new Date(approval.submitted_at).toLocaleDateString()}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{approval.pass_rate}% pass rate</p>
                  </div>
                </div>
              </div>

              {/* Timeline */}
              <div className="p-5">
                <div className="flex items-start gap-0 mb-5">
                  {["Submitted", "Under Review", approval.status === "Approved" ? "Approved" : approval.status === "Rejected" ? "Rejected" : "Pending Decision"].map((step, i) => {
                    const done = i === 0 || (i === 1 && approval.status !== "Pending") || (i === 2 && approval.status !== "Pending");
                    const active = (i === 1 && approval.status === "Pending") || (i === 2 && approval.status !== "Pending");
                    return (
                      <div key={step} className="flex-1 flex flex-col items-center">
                        <div className={`w-7 h-7 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all ${
                          done ? "bg-emerald-500 border-emerald-500 text-white" :
                          active ? "bg-violet-600 border-violet-600 text-white" :
                          "bg-white border-slate-300 text-slate-400"
                        }`}>
                          {done ? <Check className="w-3.5 h-3.5" /> : i + 1}
                        </div>
                        {i < 2 && <div className={`h-0.5 w-full mt-3.5 -mx-3.5 ${done ? "bg-emerald-400" : "bg-slate-200"}`} style={{ position: "relative", top: "-1.85rem", left: "50%", width: "calc(100% - 1.75rem)" }} />}
                        <p className={`text-[10px] font-semibold mt-1.5 text-center ${active ? "text-violet-700" : done ? "text-emerald-700" : "text-slate-400"}`}>{step}</p>
                      </div>
                    );
                  })}
                </div>

                {approval.comment && (
                  <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl mb-4">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Comment</p>
                    <p className="text-sm text-slate-700">{approval.comment}</p>
                  </div>
                )}

                {approval.status === "Pending" && (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Your Decision Comment (optional)</label>
                      <textarea
                        className="w-full text-sm border border-slate-200 rounded-xl p-3 bg-white resize-none focus:outline-none focus:ring-2 focus:ring-violet-200"
                        rows={3}
                        placeholder="Add context for your decision…"
                        value={approvalComment}
                        onChange={e => setApprovalComment(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={() => handleApproval("reject")}
                        disabled={approvingAction !== null}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-red-200 bg-red-50 text-red-700 text-sm font-semibold rounded-xl hover:bg-red-100 disabled:opacity-50"
                      >
                        <ThumbsDown className="w-4 h-4" />
                        {approvingAction === "reject" ? "Rejecting…" : "Reject"}
                      </button>
                      <button
                        onClick={() => handleApproval("approve")}
                        disabled={approvingAction !== null}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-sm font-semibold rounded-xl hover:opacity-90 disabled:opacity-50 shadow-sm"
                      >
                        <ThumbsUp className="w-4 h-4" />
                        {approvingAction === "approve" ? "Approving…" : "Approve for Deployment"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Defects ────────────────────────────────────────────────── */}
      {activeTab === "defects" && (
        <div className="space-y-4">
          {/* Summary cards */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Total",       val: defects.length,                                                    accent: "border-l-slate-400",   text: "text-slate-700" },
              { label: "Open",        val: defects.filter(d => d.status === "Open").length,                   accent: "border-l-red-500",     text: "text-red-700" },
              { label: "In Progress", val: defects.filter(d => d.status === "In Progress").length,            accent: "border-l-amber-400",   text: "text-amber-700" },
              { label: "Resolved",    val: defects.filter(d => ["Resolved","Closed"].includes(d.status)).length, accent: "border-l-emerald-500", text: "text-emerald-700" },
            ].map(s => (
              <div key={s.label} className={`bg-white rounded-xl border border-slate-200 border-l-4 ${s.accent} p-4 shadow-sm`}>
                <p className={`text-2xl font-bold ${s.text}`}>{s.val}</p>
                <p className="text-xs text-slate-500 mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>

          {defects.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-slate-400 gap-2 bg-white rounded-2xl border border-dashed border-slate-200">
              <Bug className="w-8 h-8 opacity-30" />
              <p className="text-sm">No defects reported yet</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              {/* Table toolbar */}
              <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3 flex-wrap">
                <span className="text-sm font-semibold text-slate-700">Production Defects</span>
                <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5 ml-auto">
                  {["All", "Open", "In Progress", "Resolved", "Closed"].map(f => (
                    <button
                      key={f}
                      onClick={() => setDefectFilter(f)}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${defectFilter === f ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-700"}`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-0.5">
                  {(["date", "severity", "status"] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => setDefectSort(s)}
                      className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all capitalize ${defectSort === s ? "bg-white shadow-sm text-slate-800" : "text-slate-500 hover:text-slate-700"}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-800 text-white text-left">
                    <th className="px-5 py-3 text-xs font-semibold">Defect</th>
                    <th className="px-4 py-3 text-xs font-semibold">Severity</th>
                    <th className="px-4 py-3 text-xs font-semibold hidden sm:table-cell">Reported By</th>
                    <th className="px-4 py-3 text-xs font-semibold hidden md:table-cell">Date</th>
                    <th className="px-4 py-3 text-xs font-semibold">Status</th>
                    <th className="px-4 py-3 text-xs font-semibold text-right">Update</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredDefects.map(d => (
                    <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-slate-800">{d.title}</p>
                        {d.description && <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">{d.description}</p>}
                        {d.remarks && <p className="text-[10px] text-violet-600 mt-0.5 italic">{d.remarks}</p>}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${SEV_PILL[d.severity] ?? "bg-slate-100 text-slate-600 border-slate-200"}`}>
                          {d.severity}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 hidden sm:table-cell">
                        <p className="text-xs font-semibold text-slate-700">{d.reported_by_name || d.reported_by_email}</p>
                      </td>
                      <td className="px-4 py-3.5 hidden md:table-cell text-xs text-slate-500">
                        {new Date(d.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${DEFECT_STATUS_PILL[d.status] ?? "bg-slate-100 text-slate-500"}`}>
                          {d.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-right">
                        {["Resolved", "Closed"].includes(d.status) ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 ml-auto" />
                        ) : (
                          <select
                            value={d.status}
                            disabled={updatingDefect === d.id}
                            onChange={e => updateDefect(d.id, e.target.value)}
                            className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-violet-200 disabled:opacity-50"
                          >
                            <option value="Open">Open</option>
                            <option value="In Progress">In Progress</option>
                            <option value="Resolved">Resolved</option>
                            <option value="Closed">Closed</option>
                          </select>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="px-5 py-2.5 border-t border-slate-100 bg-slate-50 text-xs text-slate-400">
                {filteredDefects.length} of {defects.length} defects
              </div>
            </div>
          )}

          {openDefects > 0 && (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
              <p className="text-xs text-amber-700">
                <strong>{openDefects} unresolved defect{openDefects !== 1 ? "s" : ""}</strong> — all must be resolved before completing production release.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── Production Release ─────────────────────────────────────── */}
      {activeTab === "release" && (
        <div className="space-y-4">
          {/* Pipeline stepper */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <p className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
              <Rocket className="w-4 h-4 text-violet-500" /> Release Pipeline
            </p>
            <div className="flex items-start">
              {[
                { label: "UAT Complete", done: pass_rate >= threshold, icon: ClipboardCheck },
                { label: "BA Approved", done: approval?.status === "Approved", icon: ShieldCheck },
                { label: "In Production", done: !!release, icon: Rocket },
                { label: "Defects Cleared", done: openDefects === 0 && defects.length >= 0, icon: Bug },
                { label: "Completed", done: release?.status === "Completed", icon: CheckCircle2 },
              ].map((step, i, arr) => (
                <div key={step.label} className="flex-1 flex flex-col items-center">
                  <div className="flex items-center w-full">
                    <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${
                      step.done ? "bg-emerald-500 border-emerald-500 text-white" : "bg-white border-slate-300 text-slate-400"
                    }`}>
                      {step.done ? <Check className="w-4 h-4" /> : <step.icon className="w-4 h-4" />}
                    </div>
                    {i < arr.length - 1 && (
                      <div className={`flex-1 h-0.5 ${step.done ? "bg-emerald-400" : "bg-slate-200"}`} />
                    )}
                  </div>
                  <p className={`text-[10px] font-semibold mt-2 text-center ${step.done ? "text-emerald-700" : "text-slate-400"}`}>
                    {step.label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {!release ? (
            <div className="flex flex-col items-center justify-center h-40 text-slate-400 gap-2 bg-white rounded-2xl border border-dashed border-slate-200">
              <Rocket className="w-8 h-8 opacity-30" />
              <p className="text-sm">No production deployment yet</p>
              <p className="text-xs text-slate-300">IT creates this when deploying to Production</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className={`px-5 py-4 border-b border-slate-100 ${release.status === "Completed" ? "bg-emerald-50" : "bg-amber-50"}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {release.status === "Completed"
                      ? <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                      : <Activity className="w-8 h-8 text-amber-500" />
                    }
                    <div>
                      <p className="text-xs text-slate-500">Production Release</p>
                      <p className={`text-lg font-bold ${release.status === "Completed" ? "text-emerald-700" : "text-amber-700"}`}>
                        {release.status}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-400">Created</p>
                    <p className="text-xs font-semibold text-slate-600">{new Date(release.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
              </div>

              <div className="p-5 space-y-4">
                {release.status === "Completed" ? (
                  <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <p className="text-sm font-bold text-emerald-700 mb-1">Release Complete</p>
                    <p className="text-xs text-emerald-600">
                      Marked complete by <strong>{release.completed_by_name ?? "BA"}</strong> on{" "}
                      {release.marked_completed_at ? new Date(release.marked_completed_at).toLocaleDateString() : "—"}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                      <p className="text-sm font-semibold text-amber-800">Under Observation</p>
                      <p className="text-xs text-amber-600 mt-1">Monitor production and resolve all defects before completing.</p>
                    </div>
                    {openDefects > 0 && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2">
                        <Bug className="w-4 h-4 text-red-500 shrink-0" />
                        <p className="text-xs text-red-700"><strong>{openDefects} open defect{openDefects !== 1 ? "s" : ""}</strong> must be resolved first.</p>
                      </div>
                    )}
                    <button
                      onClick={completeRelease}
                      disabled={completingRelease || openDefects > 0}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white text-sm font-semibold rounded-xl hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                    >
                      <Send className="w-4 h-4" />
                      {completingRelease ? "Completing…" : "Mark Production Release as Completed"}
                    </button>
                    <p className="text-[11px] text-slate-400 text-center">This action is irreversible</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Threshold modal */}
      {thresholdEdit && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 bg-violet-100 rounded-xl flex items-center justify-center">
                <Sliders className="w-4.5 h-4.5 text-violet-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800">UAT Approval Threshold</h3>
                <p className="text-xs text-slate-400">Minimum pass rate for deployment approval</p>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-600">Threshold</span>
                <span className="text-2xl font-bold text-violet-600">{newThreshold}%</span>
              </div>
              <input
                type="range" min={50} max={100} step={5}
                value={newThreshold}
                onChange={e => setNewThreshold(Number(e.target.value))}
                className="w-full accent-violet-600"
              />
              <div className="flex justify-between text-[10px] text-slate-400"><span>50%</span><span>75%</span><span>100%</span></div>
            </div>
            <div className="flex gap-3 mt-5">
              <button onClick={() => setThresholdEdit(false)} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50 font-medium">Cancel</button>
              <button onClick={saveThreshold} className="flex-1 px-4 py-2.5 bg-violet-600 text-white rounded-xl text-sm font-semibold hover:bg-violet-700">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function BaUatOversightPage() {
  const [selectedDoc, setSelectedDoc] = useState<TcDocSummary | null>(null);

  return (
    <div className="min-h-screen bg-slate-50 p-6 space-y-5">
      {!selectedDoc && (
        <div className="bg-gradient-to-r from-violet-600 via-purple-600 to-indigo-600 rounded-2xl p-6 text-white shadow-lg">
          <div className="flex items-center gap-3 mb-1">
            <ClipboardCheck className="w-6 h-6 text-violet-200" />
            <h1 className="text-2xl font-bold">UAT Oversight</h1>
          </div>
          <p className="text-sm text-violet-200">
            Manage stakeholder assignments, review approvals, track defects and complete production releases
          </p>
        </div>
      )}
      {!selectedDoc
        ? <DocList onSelect={setSelectedDoc} />
        : <UATOversightDetail doc={selectedDoc} onBack={() => setSelectedDoc(null)} />
      }
    </div>
  );
}
