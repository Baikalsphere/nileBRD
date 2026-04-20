"use client";

import { useState, useEffect, useCallback } from "react";
import {
  ClipboardCheck, CheckCircle2, XCircle, Clock, AlertTriangle,
  ChevronDown, ChevronUp, RefreshCw, MonitorPlay, PenLine,
  Bug, Send, Plus,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_BACKEND_URL;

function authHeader() {
  const t = localStorage.getItem("authToken");
  return t ? { Authorization: `Bearer ${t}` } : {};
}

type UATStatus = "Pending" | "In Progress" | "Pass" | "Fail";

interface AssignedCase {
  id: number;
  test_case_id: string;
  status: UATStatus;
  test_mode: string | null;
  remarks: string | null;
  manual_notes: string | null;
  assigned_at: string;
  updated_at: string;
  tc_document_id: number;
  tc_doc_id: string;
  request_title: string;
  req_number: string;
  request_id: number;
  definition: {
    id: string;
    name: string;
    description: string;
    type: string;
    priority: string;
    steps?: { step_num: number; action: string; expected: string }[];
    expected_result?: string;
    preconditions?: string[];
  };
}

interface DefectForm {
  title: string;
  description: string;
  severity: "Critical" | "High" | "Medium" | "Low";
}

const STATUS_COLOR: Record<string, string> = {
  Pass:          "bg-emerald-100 text-emerald-700",
  Fail:          "bg-red-100 text-red-700",
  "In Progress": "bg-amber-100 text-amber-700",
  Pending:       "bg-slate-100 text-slate-500",
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  Pass:          <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
  Fail:          <XCircle className="w-4 h-4 text-red-500" />,
  "In Progress": <Clock className="w-4 h-4 text-amber-500" />,
  Pending:       <Clock className="w-4 h-4 text-slate-400" />,
};

export default function UATTestingPage() {
  const [cases, setCases] = useState<AssignedCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [localRemarks, setLocalRemarks] = useState<Record<number, string>>({});
  const [localNotes, setLocalNotes] = useState<Record<number, string>>({});
  const [localMode, setLocalMode] = useState<Record<number, string>>({});
  const [saving, setSaving] = useState<number | null>(null);
  const [saveMsg, setSaveMsg] = useState<Record<number, string>>({});
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterRequest, setFilterRequest] = useState("All");
  const [defectModal, setDefectModal] = useState<{ requestId: number; requestTitle: string } | null>(null);
  const [defectForm, setDefectForm] = useState<DefectForm>({ title: "", description: "", severity: "Medium" });
  const [submittingDefect, setSubmittingDefect] = useState(false);
  const [defectMsg, setDefectMsg] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    fetch(`${API}/api/testing/uat/my-cases`, { headers: authHeader() })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setCases(data);
          const remarks: Record<number, string> = {};
          const notes: Record<number, string> = {};
          const mode: Record<number, string> = {};
          data.forEach((c: AssignedCase) => {
            remarks[c.id] = c.remarks ?? "";
            notes[c.id] = c.manual_notes ?? "";
            mode[c.id] = c.test_mode ?? "manual";
          });
          setLocalRemarks(remarks);
          setLocalNotes(notes);
          setLocalMode(mode);
        } else {
          setError(data.message ?? "Failed to load assigned cases");
        }
      })
      .catch(() => setError("Network error"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const updateCase = async (c: AssignedCase, status: UATStatus) => {
    setSaving(c.id);
    try {
      const r = await fetch(`${API}/api/testing/uat/assignments/${c.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({
          status,
          remarks: localRemarks[c.id] ?? "",
          manual_notes: localNotes[c.id] ?? "",
          test_mode: localMode[c.id] ?? "manual",
        }),
      });
      const d = await r.json();
      if (r.ok) {
        setSaveMsg(prev => ({ ...prev, [c.id]: "Saved" }));
        setCases(prev => prev.map(x => x.id === c.id ? { ...x, status } : x));
        setTimeout(() => setSaveMsg(prev => ({ ...prev, [c.id]: "" })), 2000);
      } else {
        setSaveMsg(prev => ({ ...prev, [c.id]: d.message ?? "Failed" }));
      }
    } finally {
      setSaving(null);
    }
  };

  const saveRemarks = async (c: AssignedCase) => {
    setSaving(c.id);
    try {
      const r = await fetch(`${API}/api/testing/uat/assignments/${c.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({
          remarks: localRemarks[c.id] ?? "",
          manual_notes: localNotes[c.id] ?? "",
          test_mode: localMode[c.id] ?? "manual",
        }),
      });
      if (r.ok) {
        setSaveMsg(prev => ({ ...prev, [c.id]: "Notes saved" }));
        setTimeout(() => setSaveMsg(prev => ({ ...prev, [c.id]: "" })), 2000);
      }
    } finally {
      setSaving(null);
    }
  };

  const submitDefect = async () => {
    if (!defectModal || !defectForm.title.trim()) return;
    setSubmittingDefect(true);
    try {
      const r = await fetch(`${API}/api/deployments/defects`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeader() },
        body: JSON.stringify({
          request_id: defectModal.requestId,
          title: defectForm.title,
          description: defectForm.description,
          severity: defectForm.severity,
        }),
      });
      const d = await r.json();
      if (r.ok) {
        setDefectMsg("Defect reported successfully");
        setDefectForm({ title: "", description: "", severity: "Medium" });
        setTimeout(() => { setDefectMsg(""); setDefectModal(null); }, 2000);
      } else {
        setDefectMsg(d.message ?? "Failed to report defect");
      }
    } finally {
      setSubmittingDefect(false);
    }
  };

  const passed  = cases.filter(c => c.status === "Pass").length;
  const failed  = cases.filter(c => c.status === "Fail").length;
  const pending = cases.filter(c => c.status === "Pending").length;
  const inProg  = cases.filter(c => c.status === "In Progress").length;

  // Unique requests for filter
  const requests = Array.from(new Map(cases.map(c => [c.request_id, c.req_number + " — " + c.request_title])).entries());

  const filtered = cases.filter(c =>
    (filterStatus === "All" || c.status === filterStatus) &&
    (filterRequest === "All" || String(c.request_id) === filterRequest)
  );

  // Group by request for display
  const byRequest = filtered.reduce<Record<string, AssignedCase[]>>((acc, c) => {
    const key = c.req_number;
    acc[key] = acc[key] || [];
    acc[key].push(c);
    return acc;
  }, {});

  if (loading) return (
    <div className="min-h-screen bg-slate-50 p-6 flex items-center justify-center text-slate-400">
      <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading your UAT cases…
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <ClipboardCheck className="w-6 h-6 text-violet-600" /> UAT Testing
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Your assigned User Acceptance Test cases — execute and record results</p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 border border-slate-200 px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50"
        >
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Assigned",    val: cases.length, color: "text-slate-800",   bg: "bg-white" },
          { label: "Passed",      val: passed,        color: "text-emerald-700", bg: "bg-emerald-50" },
          { label: "Failed",      val: failed,        color: "text-red-700",     bg: "bg-red-50" },
          { label: "Pending",     val: pending + inProg, color: "text-amber-700", bg: "bg-amber-50" },
        ].map(k => (
          <div key={k.label} className={`${k.bg} rounded-xl border border-slate-200 p-4 shadow-sm`}>
            <p className={`text-2xl font-bold ${k.color}`}>{k.val}</p>
            <p className="text-xs text-slate-500 mt-0.5">{k.label}</p>
          </div>
        ))}
      </div>

      {cases.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 bg-white rounded-2xl border border-slate-200 text-slate-400 gap-3">
          <ClipboardCheck className="w-10 h-10" />
          <div className="text-center">
            <p className="text-sm font-semibold">No UAT cases assigned yet</p>
            <p className="text-xs mt-1">The BA or IT team will assign test cases to you once SIT testing is complete</p>
          </div>
        </div>
      ) : (
        <>
          {/* Filters */}
          <div className="flex gap-3 flex-wrap items-center">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500">Status:</span>
              <div className="flex gap-1">
                {["All", "Pending", "In Progress", "Pass", "Fail"].map(s => (
                  <button key={s} onClick={() => setFilterStatus(s)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${filterStatus === s ? "bg-violet-100 text-violet-700" : "bg-white border border-slate-200 text-slate-500 hover:bg-slate-50"}`}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            {requests.length > 1 && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-500">Request:</span>
                <select
                  className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-violet-200"
                  value={filterRequest}
                  onChange={e => setFilterRequest(e.target.value)}
                >
                  <option value="All">All requests</option>
                  {requests.map(([id, label]) => (
                    <option key={id} value={String(id)}>{label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* Cases grouped by request */}
          {Object.entries(byRequest).map(([reqNumber, reqCases]) => {
            const reqCase = reqCases[0];
            return (
              <div key={reqNumber} className="space-y-2">
                {/* Request header */}
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-mono text-xs text-slate-400">{reqNumber}</span>
                    <span className="text-sm font-bold text-slate-800 ml-2">{reqCase.request_title}</span>
                  </div>
                  <button
                    onClick={() => setDefectModal({ requestId: reqCase.request_id, requestTitle: reqCase.request_title })}
                    className="flex items-center gap-1.5 text-xs text-rose-600 hover:text-rose-700 border border-rose-200 px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 transition-colors"
                  >
                    <Bug className="w-3.5 h-3.5" /> Report Defect
                  </button>
                </div>

                {/* Cases */}
                <div className="space-y-2">
                  {reqCases.map(c => {
                    const mode = localMode[c.id] ?? "manual";
                    const isExpanded = expanded === c.id;
                    return (
                      <div key={c.id} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                        <div
                          className="flex items-center gap-3 p-4 cursor-pointer hover:bg-slate-50"
                          onClick={() => setExpanded(isExpanded ? null : c.id)}
                        >
                          {STATUS_ICON[c.status]}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-semibold text-slate-800">
                                {c.definition?.name ?? c.test_case_id}
                              </span>
                              <span className="font-mono text-[10px] text-slate-400">{c.test_case_id}</span>
                            </div>
                            {c.definition?.description && (
                              <p className="text-[11px] text-slate-400 mt-0.5 truncate">{c.definition.description}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {saveMsg[c.id] && (
                              <span className="text-[10px] text-emerald-600 font-medium">{saveMsg[c.id]}</span>
                            )}
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[c.status]}`}>{c.status}</span>
                            {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="border-t border-slate-100 p-4 space-y-4 bg-slate-50">
                            {/* Description */}
                            {c.definition?.description && (
                              <p className="text-sm text-slate-600">{c.definition.description}</p>
                            )}

                            {/* Preconditions */}
                            {c.definition?.preconditions?.length && (
                              <div>
                                <p className="text-xs font-semibold text-slate-500 mb-1.5">Preconditions</p>
                                <ul className="space-y-0.5">
                                  {c.definition.preconditions.map((p, i) => (
                                    <li key={i} className="text-xs text-slate-600 flex gap-2">
                                      <span className="text-slate-300 shrink-0">•</span>{p}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Test Steps */}
                            {c.definition?.steps?.length ? (
                              <div>
                                <p className="text-xs font-semibold text-slate-500 mb-2">Test Steps</p>
                                <div className="space-y-1.5">
                                  {c.definition.steps.map(s => (
                                    <div key={s.step_num} className="flex gap-3 text-xs">
                                      <span className="shrink-0 w-5 h-5 rounded-full bg-violet-100 text-violet-700 font-bold flex items-center justify-center text-[10px]">{s.step_num}</span>
                                      <div className="flex-1">
                                        <p className="text-slate-700">{s.action}</p>
                                        <p className="text-slate-400 mt-0.5">→ {s.expected}</p>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ) : null}

                            {/* Testing mode */}
                            <div>
                              <p className="text-xs font-semibold text-slate-500 mb-2">Testing Mode</p>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => setLocalMode(prev => ({ ...prev, [c.id]: "simulation" }))}
                                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold transition-all ${
                                    mode === "simulation" ? "bg-violet-100 border-violet-300 text-violet-700" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                                  }`}
                                >
                                  <MonitorPlay className="w-3.5 h-3.5" /> Simulation
                                </button>
                                <button
                                  onClick={() => setLocalMode(prev => ({ ...prev, [c.id]: "manual" }))}
                                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-semibold transition-all ${
                                    mode === "manual" ? "bg-violet-100 border-violet-300 text-violet-700" : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                                  }`}
                                >
                                  <PenLine className="w-3.5 h-3.5" /> Manual
                                </button>
                              </div>
                            </div>

                            {/* Manual notes */}
                            {mode === "manual" && (
                              <div>
                                <p className="text-xs font-semibold text-slate-500 mb-1.5">Testing Notes</p>
                                <textarea
                                  className="w-full text-sm border border-slate-200 rounded-lg p-2.5 bg-white resize-none focus:outline-none focus:ring-2 focus:ring-violet-200"
                                  rows={3}
                                  placeholder="Describe what you tested, observations, and outcome…"
                                  value={localNotes[c.id] ?? ""}
                                  onChange={e => setLocalNotes(prev => ({ ...prev, [c.id]: e.target.value }))}
                                />
                              </div>
                            )}

                            {/* Remarks */}
                            <div>
                              <p className="text-xs font-semibold text-slate-500 mb-1.5">Remarks / Result Summary</p>
                              <textarea
                                className="w-full text-sm border border-slate-200 rounded-lg p-2.5 bg-white resize-none focus:outline-none focus:ring-2 focus:ring-violet-200"
                                rows={2}
                                placeholder="Pass/fail reason, observed behaviour…"
                                value={localRemarks[c.id] ?? ""}
                                onChange={e => setLocalRemarks(prev => ({ ...prev, [c.id]: e.target.value }))}
                              />
                            </div>

                            {/* Actions */}
                            <div className="flex gap-2 flex-wrap items-center">
                              {(["Pass", "Fail", "In Progress"] as UATStatus[]).map(s => (
                                <button
                                  key={s}
                                  onClick={() => updateCase(c, s)}
                                  disabled={saving === c.id}
                                  className={`px-4 py-2 rounded-xl text-xs font-semibold border transition-all disabled:opacity-50 ${
                                    c.status === s
                                      ? STATUS_COLOR[s] + " border-current"
                                      : s === "Pass"
                                        ? "bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700"
                                        : s === "Fail"
                                          ? "bg-red-600 text-white border-red-600 hover:bg-red-700"
                                          : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                                  }`}
                                >
                                  {saving === c.id ? "Saving…" : `Mark ${s}`}
                                </button>
                              ))}
                              <button
                                onClick={() => saveRemarks(c)}
                                disabled={saving === c.id}
                                className="ml-auto px-3 py-2 text-xs text-slate-500 border border-slate-200 rounded-xl hover:bg-slate-50 disabled:opacity-50"
                              >
                                Save Notes
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {filtered.length === 0 && (
            <div className="text-center py-10 text-slate-400 text-sm bg-white rounded-2xl border border-slate-200">
              No cases match the current filters
            </div>
          )}
        </>
      )}

      {/* Report defect modal */}
      {defectModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 bg-rose-100 rounded-full flex items-center justify-center shrink-0">
                <Bug className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800">Report Production Defect</h3>
                <p className="text-xs text-slate-400">{defectModal.requestTitle}</p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Title <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  className="w-full text-sm border border-slate-200 rounded-xl p-3 bg-white focus:outline-none focus:ring-2 focus:ring-rose-200"
                  placeholder="Brief description of the defect…"
                  value={defectForm.title}
                  onChange={e => setDefectForm(prev => ({ ...prev, title: e.target.value }))}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Description</label>
                <textarea
                  className="w-full text-sm border border-slate-200 rounded-xl p-3 bg-white resize-none focus:outline-none focus:ring-2 focus:ring-rose-200"
                  rows={3}
                  placeholder="Steps to reproduce, expected vs actual behaviour…"
                  value={defectForm.description}
                  onChange={e => setDefectForm(prev => ({ ...prev, description: e.target.value }))}
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1.5 block">Severity</label>
                <div className="flex gap-2">
                  {(["Critical", "High", "Medium", "Low"] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => setDefectForm(prev => ({ ...prev, severity: s }))}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                        defectForm.severity === s
                          ? s === "Critical" ? "bg-red-100 border-red-300 text-red-700"
                          : s === "High" ? "bg-orange-100 border-orange-300 text-orange-700"
                          : s === "Medium" ? "bg-amber-100 border-amber-300 text-amber-700"
                          : "bg-slate-100 border-slate-300 text-slate-600"
                          : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              {defectMsg && (
                <p className={`text-xs font-medium ${defectMsg.includes("success") ? "text-emerald-600" : "text-red-600"}`}>
                  {defectMsg}
                </p>
              )}
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => { setDefectModal(null); setDefectForm({ title: "", description: "", severity: "Medium" }); setDefectMsg(""); }}
                className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={submitDefect}
                disabled={submittingDefect || !defectForm.title.trim()}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-600 text-white rounded-xl text-sm font-semibold hover:bg-rose-700 disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
                {submittingDefect ? "Submitting…" : "Submit Defect"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
