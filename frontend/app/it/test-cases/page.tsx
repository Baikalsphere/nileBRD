"use client";

import { useEffect, useState, useCallback } from "react";
import {
  FlaskConical, ChevronDown, ChevronRight, Search, CheckCircle2,
  XCircle, Clock, Ban, AlertTriangle, Layers, Zap, Shield,
  Activity, FileDown, Rocket, RefreshCw, Loader2, CalendarDays,
  BarChart3, Save, TrendingUp, Hash, ListFilter,
} from "lucide-react";
import { downloadTestCasesAsPDF } from "@/lib/pdfExport";
import { ensureAuth } from "@/lib/authGuard";

const API = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:5001";

// ─── Types ───────────────────────────────────────────────────────────────────

interface TcListItem {
  id: number; doc_id: string; frd_doc_id: string; brd_doc_id: string;
  title: string; status: string; total_cases: number;
  summary: { system: number; integration: number; uat: number; performance: number; security: number; critical: number; high: number; medium: number; low: number };
  request_title: string; req_number: string; generated_at: string; generated_by_name: string;
  sit_released: boolean; sit_pass_rate: number | null; sit_released_at: string | null;
}
interface TestStep { step_num: number; action: string; expected: string }
interface TestCase {
  id: string; name: string; description: string; type: string; priority: string;
  preconditions: string[]; steps: TestStep[]; expected_result: string;
}
interface SitState {
  sit_cases: TestCase[];
  results: Record<string, { status: string; remarks: string }>;
  pass_rate: number; released: boolean; released_at: string | null;
}

// ─── Style maps ──────────────────────────────────────────────────────────────

const TYPE_CFG: Record<string, { color: string; bg: string; border: string; icon: React.ReactNode }> = {
  System:      { color: "text-violet-700", bg: "bg-violet-50",  border: "border-violet-200", icon: <Layers   className="w-3 h-3" /> },
  Integration: { color: "text-blue-700",   bg: "bg-blue-50",    border: "border-blue-200",   icon: <Zap      className="w-3 h-3" /> },
  Performance: { color: "text-amber-700",  bg: "bg-amber-50",   border: "border-amber-200",  icon: <Activity className="w-3 h-3" /> },
  Security:    { color: "text-rose-700",   bg: "bg-rose-50",    border: "border-rose-200",   icon: <Shield   className="w-3 h-3" /> },
};
const PRIORITY_CFG: Record<string, string> = {
  Critical: "bg-red-100 text-red-700 border-red-200",
  High:     "bg-orange-100 text-orange-700 border-orange-200",
  Medium:   "bg-yellow-100 text-yellow-700 border-yellow-200",
  Low:      "bg-slate-100 text-slate-600 border-slate-200",
};
const SIT_STATUS_CFG: Record<string, { color: string; bg: string; border: string; icon: React.ReactNode }> = {
  Pending:       { color: "text-slate-600",   bg: "bg-slate-100",  border: "border-slate-200",   icon: <Clock        className="w-3 h-3" /> },
  "In Progress": { color: "text-amber-700",   bg: "bg-amber-50",   border: "border-amber-200",   icon: <Clock        className="w-3 h-3" /> },
  Pass:          { color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", icon: <CheckCircle2 className="w-3 h-3" /> },
  Fail:          { color: "text-red-700",     bg: "bg-red-50",     border: "border-red-200",     icon: <XCircle      className="w-3 h-3" /> },
  Blocked:       { color: "text-amber-700",   bg: "bg-amber-50",   border: "border-amber-200",   icon: <Ban          className="w-3 h-3" /> },
};

function TypeTag({ type }: { type: string }) {
  const c = TYPE_CFG[type] ?? { color: "text-slate-600", bg: "bg-slate-50", border: "border-slate-200", icon: null };
  return <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border ${c.color} ${c.bg} ${c.border}`}>{c.icon}{type}</span>;
}
function PriorityTag({ priority }: { priority: string }) {
  return <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold border ${PRIORITY_CFG[priority] ?? ""}`}>{priority}</span>;
}

// ─── SIT Tab ─────────────────────────────────────────────────────────────────

function SITTab({ doc, onReleased }: { doc: TcListItem; onReleased: () => void }) {
  const [sit, setSit]           = useState<SitState | null>(null);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [confirmRelease, setConfirmRelease] = useState(false);
  const [localStatuses, setLocalStatuses]   = useState<Record<string, { status: string; remarks: string }>>({});
  const [expandedCase, setExpanded] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [search, setSearch]     = useState("");
  const [saveMsg, setSaveMsg]   = useState<{ text: string; ok: boolean } | null>(null);

  const fetchSit = useCallback(async () => {
    setLoading(true);
    try {
      const token = await ensureAuth();
      const r = await fetch(`${API}/api/testing/sit/${doc.id}`, { headers: { Authorization: `Bearer ${token}` } });
      const d: SitState = await r.json();
      setSit(d);
      setLocalStatuses(Object.fromEntries(d.sit_cases.map(tc => [tc.id, d.results[tc.id] ?? { status: "Pending", remarks: "" }])));
    } finally { setLoading(false); }
  }, [doc.id]);

  useEffect(() => { fetchSit(); }, [fetchSit]);

  const saveAll = async () => {
    setSaving(true); setSaveMsg(null);
    try {
      const token = await ensureAuth();
      const updates = Object.entries(localStatuses).map(([test_case_id, v]) => ({ test_case_id, ...v }));
      const r = await fetch(`${API}/api/testing/sit/${doc.id}`, {
        method: "PUT", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      if (r.ok) { setSaveMsg({ text: "Saved", ok: true }); await fetchSit(); }
      else { const d = await r.json(); setSaveMsg({ text: d.message ?? "Save failed", ok: false }); }
    } finally { setSaving(false); setTimeout(() => setSaveMsg(null), 3000); }
  };

  const releaseForUAT = async () => {
    setReleasing(true);
    try {
      const token = await ensureAuth();
      const r = await fetch(`${API}/api/testing/sit/${doc.id}/release`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) { const d = await r.json(); alert(d.message); return; }
      await fetchSit(); onReleased(); setConfirmRelease(false);
    } finally { setReleasing(false); }
  };

  if (loading) return <div className="flex items-center justify-center py-16 gap-2 text-slate-400"><Loader2 className="w-5 h-5 animate-spin" /><span className="text-sm">Loading SIT data…</span></div>;
  if (!sit) return null;

  const { pass_rate, released } = sit;
  const sitReady = pass_rate >= 90;
  const sitTypes   = ["All", "System", "Integration", "Performance", "Security"];
  const sitStatuses = ["All", "Pending", "In Progress", "Pass", "Fail", "Blocked"];

  const passed  = sit.sit_cases.filter(tc => localStatuses[tc.id]?.status === "Pass").length;
  const failed  = sit.sit_cases.filter(tc => localStatuses[tc.id]?.status === "Fail").length;
  const inProg  = sit.sit_cases.filter(tc => localStatuses[tc.id]?.status === "In Progress").length;
  const pending = sit.sit_cases.filter(tc => !localStatuses[tc.id] || localStatuses[tc.id].status === "Pending").length;
  const localRate = sit.sit_cases.length ? Math.round((passed / sit.sit_cases.length) * 100) : 0;

  const cases = sit.sit_cases.filter(tc =>
    (typeFilter === "All" || tc.type === typeFilter) &&
    (statusFilter === "All" || (localStatuses[tc.id]?.status ?? "Pending") === statusFilter) &&
    (!search || tc.name.toLowerCase().includes(search.toLowerCase()) || tc.id.toLowerCase().includes(search.toLowerCase()))
  );

  const bulkSet = (status: string) => {
    const patch: Record<string, { status: string; remarks: string }> = {};
    cases.forEach(c => { patch[c.id] = { ...localStatuses[c.id], status }; });
    setLocalStatuses(prev => ({ ...prev, ...patch }));
  };

  return (
    <div className="space-y-4">
      {/* Released banner */}
      {released && (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
          <div>
            <p className="text-sm font-bold text-emerald-800">SIT Released to UAT</p>
            <p className="text-xs text-emerald-600">Released on {new Date(sit.released_at!).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })} with {pass_rate}% pass rate. BA is managing UAT assignments.</p>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: "Total",       val: sit.sit_cases.length, color: "text-slate-800",   bg: "bg-white",      accent: "border-l-slate-300" },
          { label: "Passed",      val: passed,               color: "text-emerald-700", bg: "bg-emerald-50", accent: "border-l-emerald-400" },
          { label: "Failed",      val: failed,               color: "text-red-700",     bg: "bg-red-50",     accent: "border-l-red-400" },
          { label: "In Progress", val: inProg,               color: "text-amber-700",   bg: "bg-amber-50",   accent: "border-l-amber-400" },
          { label: "Pending",     val: pending,              color: "text-slate-500",   bg: "bg-slate-50",   accent: "border-l-slate-300" },
        ].map(k => (
          <div key={k.label} className={`${k.bg} rounded-xl border border-slate-200 border-l-4 ${k.accent} p-4 shadow-sm`}>
            <p className={`text-2xl font-bold ${k.color}`}>{k.val}</p>
            <p className="text-xs text-slate-500 mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Pass rate + actions */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <BarChart3 className="w-4 h-4 text-indigo-500" />
            <span className="text-sm font-semibold text-slate-700">SIT Pass Rate</span>
            {localRate !== pass_rate && <span className="text-xs text-amber-600 font-medium">Local: {localRate}% (unsaved)</span>}
          </div>
          <span className={`text-xl font-bold ${sitReady ? "text-emerald-600" : "text-indigo-600"}`}>Saved: {pass_rate}%</span>
        </div>
        <div className="h-4 bg-slate-100 rounded-full overflow-hidden relative">
          {localRate !== pass_rate && <div className="absolute inset-y-0 left-0 rounded-full bg-indigo-200/50" style={{ width: `${localRate}%` }} />}
          <div className={`absolute inset-y-0 left-0 rounded-full transition-all ${sitReady ? "bg-emerald-500" : "bg-indigo-500"}`} style={{ width: `${pass_rate}%` }} />
          <div className="absolute top-0 bottom-0 border-r-2 border-dashed border-slate-400" style={{ left: "90%" }} />
          {pass_rate > 5 && <span className="absolute inset-0 flex items-center pl-3 text-[10px] font-bold text-white">{pass_rate}%</span>}
        </div>
        <div className="flex justify-between text-[10px] text-slate-400 mt-1 mb-4"><span>0%</span><span>90% threshold for UAT release</span><span>100%</span></div>

        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={saveAll} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {saving ? "Saving…" : "Save Results"}
          </button>
          {saveMsg && (
            <span className={`text-xs font-semibold px-3 py-1.5 rounded-lg border ${saveMsg.ok ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"}`}>{saveMsg.text}</span>
          )}
          {released ? (
            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-semibold rounded-xl">
              <CheckCircle2 className="w-4 h-4" /> Released for UAT on {new Date(sit.released_at!).toLocaleDateString()}
            </div>
          ) : (
            <button onClick={() => setConfirmRelease(true)} disabled={!sitReady}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-sm font-semibold rounded-xl hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed">
              <Rocket className="w-3.5 h-3.5" /> Release for UAT
            </button>
          )}
          <button onClick={() => downloadTestCasesAsPDF(
            { summary: doc.summary, doc_id: doc.doc_id, frd_doc_id: doc.frd_doc_id, brd_doc_id: doc.brd_doc_id, title: doc.request_title, version: "1.0", request_number: doc.req_number, total_cases: doc.total_cases },
            sit.sit_cases.map(tc => ({ ...tc, frd_ref: tc.id, status: sit.results[tc.id]?.status ?? "Pending" }))
          )} className="flex items-center gap-1.5 px-3 py-2 border border-slate-200 bg-white text-slate-600 text-sm rounded-xl hover:bg-slate-50">
            <FileDown className="w-3.5 h-3.5" /> Export PDF
          </button>
        </div>
        {!sitReady && localRate >= 90 && (
          <p className="mt-3 text-xs text-amber-600 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> Local rate at {localRate}% — save results first to unlock release.</p>
        )}
        {!sitReady && localRate < 90 && (
          <p className="mt-3 text-xs text-slate-400 flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-amber-400" /> {90 - localRate}% more needed — save results after marking cases as Pass.</p>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap bg-white border border-slate-200 rounded-2xl p-3 shadow-sm">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search cases…"
            className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-200 w-36" />
        </div>
        <div className="w-px h-5 bg-slate-200" />
        <div className="flex gap-1">{sitTypes.map(t => (
          <button key={t} onClick={() => setTypeFilter(t)}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold ${typeFilter === t ? "bg-indigo-600 text-white" : "bg-slate-50 border border-slate-200 text-slate-500 hover:bg-slate-100"}`}>
            {t}
          </button>
        ))}</div>
        <div className="w-px h-5 bg-slate-200" />
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-slate-50 focus:outline-none text-slate-600">
          {sitStatuses.map(s => <option key={s} value={s}>{s === "All" ? "All statuses" : s}</option>)}
        </select>
        <div className="w-px h-5 bg-slate-200 ml-auto" />
        <span className="text-[11px] text-slate-400 shrink-0">Bulk ({cases.length}):</span>
        {["Pass", "Fail", "In Progress", "Blocked"].map(s => {
          const c = SIT_STATUS_CFG[s];
          return (
            <button key={s} onClick={() => bulkSet(s)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border hover:opacity-80 ${c.color} ${c.bg} ${c.border}`}>
              {s}
            </button>
          );
        })}
      </div>

      {/* Cases table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full">
          <thead><tr className="bg-gradient-to-r from-slate-50 to-slate-100 border-b border-slate-200">
            <th className="w-10" />
            <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 w-24">Case ID</th>
            <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Name</th>
            <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 w-28">Type</th>
            <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 w-24">Priority</th>
            <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 w-36">Set Status</th>
            <th className="text-left px-4 py-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 w-24">Saved</th>
          </tr></thead>
          <tbody>
            {cases.length === 0 ? (
              <tr><td colSpan={7} className="py-12 text-center text-sm text-slate-400">No cases match filters</td></tr>
            ) : cases.flatMap(tc => {
              const isOpen  = expandedCase === tc.id;
              const local   = localStatuses[tc.id] ?? { status: "Pending", remarks: "" };
              const saved   = sit.results[tc.id]?.status ?? "Pending";
              const isDirty = local.status !== saved;
              const scfg    = SIT_STATUS_CFG[local.status] ?? SIT_STATUS_CFG.Pending;
              const savedCfg = SIT_STATUS_CFG[saved] ?? SIT_STATUS_CFG.Pending;
              return [
                <tr key={tc.id}
                  className={`border-t border-slate-100 cursor-pointer transition-colors ${isOpen ? "bg-indigo-50/30" : "hover:bg-slate-50"} ${isDirty ? "border-l-2 border-l-amber-400" : ""}`}
                  onClick={() => setExpanded(isOpen ? null : tc.id)}>
                  <td className="pl-3 py-3">{isOpen ? <ChevronDown className="w-4 h-4 text-indigo-400" /> : <ChevronRight className="w-4 h-4 text-slate-300" />}</td>
                  <td className="px-4 py-3 font-mono text-[11px] font-bold text-slate-500">{tc.id}</td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-800 text-sm">{tc.name}</p>
                    {local.remarks && <p className="text-[11px] text-slate-400 mt-0.5 truncate max-w-sm">{local.remarks}</p>}
                  </td>
                  <td className="px-4 py-3"><TypeTag type={tc.type} /></td>
                  <td className="px-4 py-3"><PriorityTag priority={tc.priority} /></td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    <select value={local.status}
                      onChange={e => setLocalStatuses(prev => ({ ...prev, [tc.id]: { ...prev[tc.id], status: e.target.value } }))}
                      className={`px-2 py-1 rounded-md text-[11px] font-bold border cursor-pointer focus:outline-none ${scfg.color} ${scfg.bg} ${scfg.border}`}>
                      {Object.keys(SIT_STATUS_CFG).map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold border ${savedCfg.color} ${savedCfg.bg} ${savedCfg.border}`}>
                      {savedCfg.icon}{saved}
                    </span>
                  </td>
                </tr>,
                ...(isOpen ? [
                  <tr key={`${tc.id}-det`}><td colSpan={7} className="px-4 pb-4 pt-0">
                    <div className="rounded-xl border border-indigo-100 bg-white overflow-hidden shadow-sm">
                      <div className="grid grid-cols-2 divide-x divide-slate-100">
                        <div className="p-4 space-y-3">
                          {tc.description && <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Description</p><p className="text-xs text-slate-600 leading-relaxed">{tc.description}</p></div>}
                          {tc.preconditions?.length > 0 && (
                            <div>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Preconditions</p>
                              <ul className="space-y-1">{tc.preconditions.map((p, i) => (
                                <li key={i} className="flex items-start gap-2 text-xs text-slate-600">
                                  <span className="shrink-0 mt-0.5 w-4 h-4 rounded-full bg-indigo-100 text-indigo-700 text-[9px] font-bold flex items-center justify-center">{i + 1}</span>{p}
                                </li>
                              ))}</ul>
                            </div>
                          )}
                          {tc.expected_result && <div><p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Expected Result</p><p className="text-xs text-slate-600 p-2 bg-emerald-50 border border-emerald-100 rounded-lg">{tc.expected_result}</p></div>}
                        </div>
                        <div className="p-4 space-y-3">
                          {tc.steps?.length > 0 && (
                            <div>
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Test Steps</p>
                              <div className="rounded-lg overflow-hidden border border-slate-200">
                                <table className="w-full text-xs">
                                  <thead><tr className="bg-slate-50"><th className="text-left px-2 py-1.5 text-[9px] font-bold text-slate-400 w-6">#</th><th className="text-left px-2 py-1.5 text-[9px] font-bold text-slate-500 w-1/2">Action</th><th className="text-left px-2 py-1.5 text-[9px] font-bold text-slate-500">Expected</th></tr></thead>
                                  <tbody>{tc.steps.map(s => (
                                    <tr key={s.step_num} className="border-t border-slate-100">
                                      <td className="px-2 py-1.5 font-mono text-[9px] font-bold text-slate-300">{s.step_num}</td>
                                      <td className="px-2 py-1.5 text-slate-700">{s.action}</td>
                                      <td className="px-2 py-1.5 text-slate-500">{s.expected}</td>
                                    </tr>
                                  ))}</tbody>
                                </table>
                              </div>
                            </div>
                          )}
                          <div>
                            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Remarks</label>
                            <textarea rows={2} value={local.remarks}
                              onChange={e => setLocalStatuses(prev => ({ ...prev, [tc.id]: { ...prev[tc.id], remarks: e.target.value } }))}
                              onClick={e => e.stopPropagation()}
                              className="w-full text-xs border border-slate-200 rounded-lg p-2 bg-slate-50 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-200"
                              placeholder="Remarks or failure details…" />
                          </div>
                          <div>
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Quick Mark</p>
                            <div className="flex flex-wrap gap-1.5">
                              {Object.keys(SIT_STATUS_CFG).map(s => {
                                const sc = SIT_STATUS_CFG[s]; const active = local.status === s;
                                return (
                                  <button key={s} onClick={e => { e.stopPropagation(); setLocalStatuses(prev => ({ ...prev, [tc.id]: { ...prev[tc.id], status: s } })); }}
                                    className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${active ? `${sc.color} ${sc.bg} ${sc.border} ring-1 ring-offset-1 ring-indigo-300` : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
                                    {sc.icon}{s}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </td></tr>
                ] : [])
              ];
            })}
          </tbody>
        </table>
        <div className="px-5 py-2.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-400">
          <span>Showing {cases.length} of {sit.sit_cases.length} cases</span>
          {localRate !== pass_rate && (
            <span className="flex items-center gap-1.5 text-amber-600 font-medium"><AlertTriangle className="w-3 h-3" /> Unsaved changes — save to update pass rate</span>
          )}
        </div>
      </div>

      {/* Release modal */}
      {confirmRelease && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center"><Rocket className="w-5 h-5 text-emerald-600" /></div>
              <div><h3 className="font-bold text-slate-800">Release for UAT?</h3><p className="text-xs text-slate-400">Saved pass rate: {pass_rate}% — threshold met (≥90%)</p></div>
            </div>
            <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl mb-4 flex items-center gap-2 text-sm text-emerald-700">
              <CheckCircle2 className="w-4 h-4" /><span className="font-medium">SIT complete: {passed}/{sit.sit_cases.length} cases passed</span>
            </div>
            <p className="text-sm text-slate-600 mb-5">The BA will assign UAT test cases to stakeholders. Request status → <strong>"UAT Testing"</strong>.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmRelease(false)} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50">Cancel</button>
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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TestCasesPage() {
  const [docs, setDocs]           = useState<TcListItem[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [filter, setFilter]       = useState<"all" | "pending" | "released">("all");
  const [selectedDoc, setSelectedDoc] = useState<TcListItem | null>(null);
  const [refreshKey, setRefreshKey]   = useState(0);

  useEffect(() => {
    setLoading(true);
    ensureAuth().then(token => {
      fetch(`${API}/api/stream/test-case-documents`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(d => setDocs(Array.isArray(d) ? d : []))
        .catch(() => setDocs([]))
        .finally(() => setLoading(false));
    });
  }, [refreshKey]);

  const filtered = docs.filter(d => {
    const q = search.toLowerCase();
    const matchQ = !q || d.doc_id?.toLowerCase().includes(q) || d.request_title?.toLowerCase().includes(q) || d.req_number?.toLowerCase().includes(q);
    const matchF = filter === "all" || (filter === "released" && d.sit_released) || (filter === "pending" && !d.sit_released);
    return matchQ && matchF;
  });

  const releasedCount = docs.filter(d => d.sit_released).length;
  const totalSit      = docs.reduce((a, d) => a + (d.summary?.system ?? 0) + (d.summary?.integration ?? 0) + (d.summary?.performance ?? 0) + (d.summary?.security ?? 0), 0);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Gradient header */}
      <div className="bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-700 px-8 py-8">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
            <FlaskConical className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Test Cases — SIT</h1>
            <p className="text-violet-200 text-sm">Generate, execute and release System Integration Tests</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-3">
          {[
            { label: "Documents",       val: docs.length,    icon: "📄" },
            { label: "SIT Cases",       val: totalSit,       icon: "🧪" },
            { label: "Released to UAT", val: releasedCount,  icon: "✅" },
            { label: "In Progress",     val: docs.length - releasedCount, icon: "⏳" },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-2 bg-white/15 border border-white/20 rounded-xl px-4 py-2">
              <span className="text-base">{s.icon}</span>
              <span className="text-white font-bold text-sm">{s.val}</span>
              <span className="text-white/60 text-xs">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="px-8 py-6 space-y-5">
        {selectedDoc ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <button onClick={() => setSelectedDoc(null)} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700">
                <ChevronRight className="w-4 h-4 rotate-180" /> Back to all documents
              </button>
              <div className="text-right">
                <p className="text-sm font-bold text-slate-800">{selectedDoc.request_title}</p>
                <p className="font-mono text-xs text-slate-400">{selectedDoc.req_number} · {selectedDoc.doc_id}</p>
              </div>
            </div>
            <SITTab key={`sit-${refreshKey}`} doc={selectedDoc} onReleased={() => { setRefreshKey(k => k + 1); }} />
          </div>
        ) : (
          <>
            {/* Search + filter */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="relative max-w-sm flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by request or doc ID…"
                  className="w-full pl-9 pr-4 py-2.5 text-sm rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400 shadow-sm" />
              </div>
              <div className="flex gap-1.5">
                {([["all", "All"], ["pending", "In SIT"], ["released", "Released to UAT"]] as const).map(([val, label]) => (
                  <button key={val} onClick={() => setFilter(val)}
                    className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all ${filter === val ? "bg-violet-600 text-white shadow-sm" : "bg-white border border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Doc cards */}
            {loading ? (
              <div className="flex items-center justify-center py-24 gap-3 text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin text-violet-500" /><span className="text-sm">Loading…</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3 bg-white rounded-2xl border border-slate-200">
                <FlaskConical className="w-10 h-10 text-slate-200" />
                <p className="text-slate-500 font-semibold">No test case documents found</p>
                <p className="text-slate-400 text-sm">Generate test cases from an FRD in FRD Management.</p>
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
                        ${doc.sit_released ? "border-emerald-200 hover:border-emerald-300" : "border-slate-200 hover:border-violet-300"}`}
                      onClick={() => setSelectedDoc(doc)}>
                      <div className={`h-1 ${doc.sit_released ? "bg-gradient-to-r from-emerald-400 to-teal-500" : "bg-gradient-to-r from-violet-500 to-indigo-600"}`} />
                      <div className="p-5">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-1">
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border
                                ${doc.sit_released ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-violet-50 text-violet-700 border-violet-200"}`}>
                                {doc.sit_released ? <><CheckCircle2 className="w-3 h-3" /> Released to UAT</> : <><Clock className="w-3 h-3" /> SIT In Progress</>}
                              </span>
                              <span className="font-mono text-[10px] text-slate-400 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">{doc.doc_id}</span>
                              <span className="font-mono text-[10px] text-slate-400">{doc.req_number}</span>
                            </div>
                            <h3 className="text-base font-bold text-slate-800 truncate">{doc.request_title}</h3>
                            <p className="text-xs text-slate-400 mt-0.5">Generated by {doc.generated_by_name || "—"}</p>
                            <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                              {s?.system      ? <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-violet-50 text-violet-700 border border-violet-200"><Layers className="w-3 h-3" />{s.system} System</span>           : null}
                              {s?.integration ? <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200"><Zap className="w-3 h-3" />{s.integration} Integration</span>      : null}
                              {s?.performance ? <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-200"><Activity className="w-3 h-3" />{s.performance} Performance</span> : null}
                              {s?.security    ? <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200"><Shield className="w-3 h-3" />{s.security} Security</span>          : null}
                              {!s && <span className="text-xs text-slate-400">{sitCount || doc.total_cases} SIT cases</span>}
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-3 shrink-0">
                            <button className={`flex items-center gap-1.5 px-4 py-2 text-sm font-semibold rounded-xl transition-colors
                              ${doc.sit_released ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-violet-600 hover:bg-violet-700 text-white"}`}>
                              <FlaskConical className="w-3.5 h-3.5" />
                              {doc.sit_released ? "View SIT" : "Execute SIT"}
                            </button>
                            <div className="flex items-center gap-1.5 text-xs text-slate-400">
                              <CalendarDays className="w-3.5 h-3.5" />
                              {new Date(doc.generated_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                            </div>
                          </div>
                        </div>

                        {/* Pass rate mini bar */}
                        <div className="mt-4">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[11px] font-semibold text-slate-500">SIT Pass Rate</span>
                            <span className={`text-xs font-bold ${doc.sit_released || passRate >= 90 ? "text-emerald-600" : "text-violet-600"}`}>{passRate}%</span>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden relative">
                            <div className={`h-full rounded-full transition-all ${doc.sit_released || passRate >= 90 ? "bg-emerald-500" : "bg-violet-500"}`} style={{ width: `${passRate}%` }} />
                            <div className="absolute top-0 bottom-0 border-r border-dashed border-slate-400" style={{ left: "90%" }} />
                          </div>
                          {doc.sit_released && doc.sit_released_at && (
                            <p className="text-[10px] text-emerald-600 mt-1 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" /> Released {new Date(doc.sit_released_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                            </p>
                          )}
                          {!doc.sit_released && passRate === 0 && <p className="text-[10px] text-slate-400 mt-1">No results saved yet</p>}
                          {!doc.sit_released && passRate > 0 && passRate < 90 && <p className="text-[10px] text-amber-600 mt-1">{90 - passRate}% more needed for UAT release</p>}
                          {!doc.sit_released && passRate >= 90 && <p className="text-[10px] text-emerald-600 font-semibold mt-1">Ready — save results and click Release for UAT</p>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
