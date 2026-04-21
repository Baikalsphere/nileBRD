"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Briefcase, CalendarDays, Check, Clock, Download, FileText,
  Flame, Inbox, Loader2, MessageSquare, Paperclip,
  RefreshCw, TrendingUp, Users, Eye, Zap, AlertCircle, UserCheck,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { useDiscussionPanel } from "@/components/dashboard/DiscussionPanel";

const API = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5001";

type Priority = "Low" | "Medium" | "High" | "Critical";

interface Attachment { id: number; original_name: string; mimetype: string; size: number; }

interface RequestItem {
  id: number;
  req_number: string;
  title: string;
  description: string;
  priority: string;
  category: string;
  status: string;
  assignment_mode: string;
  created_at: string;
  ba_name: string | null;
  ba_email: string | null;
  stakeholder_name?: string | null;
  stakeholder_email?: string | null;
  attachments: Attachment[];
}

const priorityConfig: Record<string, { color: string; bg: string; border: string; icon: React.ReactNode }> = {
  Low:      { color: "text-emerald-600", bg: "bg-emerald-50",  border: "border-emerald-200", icon: <TrendingUp className="size-3" /> },
  Medium:   { color: "text-amber-600",   bg: "bg-amber-50",    border: "border-amber-200",   icon: <Clock className="size-3" /> },
  High:     { color: "text-orange-600",  bg: "bg-orange-50",   border: "border-orange-200",  icon: <Zap className="size-3" /> },
  Critical: { color: "text-rose-600",    bg: "bg-rose-50",     border: "border-rose-200",    icon: <Flame className="size-3" /> },
};

const WORKFLOW = ["Submitted", "BA Assigned", "BRD", "FRD", "Dev", "UAT", "Closed"];
const statusStep: Record<string, number> = {
  Submitted: 0, "BA Assigned": 1, BRD: 2, FRD: 3, Dev: 4, UAT: 5,
  Approved: 6, Closed: 6, Rejected: 0,
};

function formatSize(b: number) {
  return b < 1024 * 1024 ? `${(b / 1024).toFixed(0)} KB` : `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

function WorkflowTracker({ status }: { status: string }) {
  const current  = statusStep[status] ?? 0;
  const rejected = status === "Rejected";
  return (
    <div className="flex items-start w-full">
      {WORKFLOW.map((step, i) => {
        const done   = !rejected && i < current;
        const active = !rejected && i === current;
        const last   = i === WORKFLOW.length - 1;
        return (
          <div key={step} className="flex flex-col items-center flex-1 min-w-0">
            <div className="flex items-center w-full">
              <div className={`h-px flex-1 ${i === 0 ? "invisible" : done ? "bg-indigo-400" : "bg-slate-200"}`} />
              <div className={`flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-semibold z-10 transition-colors ${
                done    ? "border-indigo-500 bg-indigo-500 text-white" :
                active  ? "border-indigo-500 bg-white text-indigo-600" :
                rejected && i === 0 ? "border-rose-400 bg-rose-400 text-white" :
                          "border-slate-200 bg-white text-slate-300"
              }`}>
                {done ? <Check size={12} strokeWidth={2.5} /> : i + 1}
              </div>
              <div className={`h-px flex-1 ${last ? "invisible" : done ? "bg-indigo-400" : "bg-slate-200"}`} />
            </div>
            <p className={`mt-2 text-center text-[10px] font-medium leading-tight px-0.5 ${
              active ? "text-indigo-600" : done ? "text-slate-500" : "text-slate-300"
            }`}>{step}</p>
          </div>
        );
      })}
    </div>
  );
}

function DetailsModal({ request, isOpen, onClose }: { request: RequestItem | null; isOpen: boolean; onClose: () => void }) {
  const [downloading, setDownloading] = useState<number | null>(null);

  if (!isOpen || !request) return null;

  const downloadAttachment = async (att: Attachment) => {
    setDownloading(att.id);
    try {
      const token = localStorage.getItem("authToken");
      const res = await fetch(`${API}/api/requests/attachment/${att.id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Failed");
      const { url } = await res.json();
      window.open(url, "_blank");
    } catch { /* ignore */ } finally { setDownloading(null); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Request Details</h2>
            <p className="text-sm text-slate-500">{request.req_number}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
        </div>

        {/* Content */}
        <div className="max-h-[70vh] overflow-y-auto px-6 py-5 space-y-6">
          {/* Workflow */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Progress</p>
            <WorkflowTracker status={request.status} />
          </div>

          {/* Meta grid */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Title</p>
              <p className="text-sm font-semibold text-slate-900">{request.title}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Category</p>
              <p className="text-sm text-slate-700">{request.category}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Submitted</p>
              <p className="text-sm text-slate-700">
                {new Date(request.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Assigned BA</p>
              <p className="text-sm text-indigo-700 font-medium">
                {request.ba_name || request.ba_email || <span className="text-amber-500 italic">Awaiting assignment</span>}
              </p>
            </div>
          </div>

          {/* Description */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Description</p>
            <p className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm leading-relaxed text-slate-600">
              {request.description}
            </p>
          </div>

          {/* Attachments */}
          {request.attachments.length > 0 && (
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Attachments ({request.attachments.length})
              </p>
              <div className="space-y-2">
                {request.attachments.map((att) => (
                  <div key={att.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 hover:bg-slate-100 transition-colors">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-blue-100">
                        <Paperclip className="size-4 text-blue-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-slate-900">{att.original_name}</p>
                        <p className="text-xs text-slate-500">{formatSize(att.size)}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => downloadAttachment(att)}
                      disabled={downloading === att.id}
                      className="ml-2 flex shrink-0 items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 px-3 py-1.5 text-xs font-semibold text-white transition-colors"
                    >
                      {downloading === att.id ? <RefreshCw className="size-3 animate-spin" /> : <Download className="size-3" />}
                      {downloading === att.id ? "…" : "Download"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 flex justify-end px-6 py-3 bg-slate-50 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 font-medium text-sm transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

interface BA { id: number; name: string | null; email: string; }

function ReassignModal({
  request,
  isOpen,
  onClose,
  onReassigned,
}: {
  request: RequestItem | null;
  isOpen: boolean;
  onClose: () => void;
  onReassigned: () => void;
}) {
  const [bas, setBas] = useState<BA[]>([]);
  const [selectedBaId, setSelectedBaId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    const token = localStorage.getItem("authToken");
    fetch(`${API}/api/requests/ba-list`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => setBas(d.bas || []))
      .catch(() => setError("Failed to load BA list"));
  }, [isOpen]);

  if (!isOpen || !request) return null;

  const handleSubmit = async () => {
    if (!selectedBaId) return;
    setSubmitting(true);
    setError("");
    try {
      const token = localStorage.getItem("authToken");
      const res = await fetch(`${API}/api/requests/${request.id}/reassign-ba`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ new_ba_id: selectedBaId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed");
      onReassigned();
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Reassign BA</h2>
            <p className="text-sm text-slate-500">{request.req_number} — {request.title}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {request.ba_name && (
            <p className="text-sm text-slate-600">
              Currently assigned to: <span className="font-semibold text-indigo-700">{request.ba_name}</span>
            </p>
          )}

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">Select New BA</label>
            <select
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              value={selectedBaId ?? ""}
              onChange={e => setSelectedBaId(Number(e.target.value))}
            >
              <option value="">Choose a BA…</option>
              {bas
                .filter(ba => ba.id !== (request as any).ba_id)
                .map(ba => (
                  <option key={ba.id} value={ba.id}>{ba.name || ba.email}</option>
                ))}
            </select>
          </div>

          {error && <p className="text-xs text-rose-600">{error}</p>}
        </div>

        <div className="border-t border-slate-200 flex justify-end gap-3 px-6 py-3 bg-slate-50 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 font-medium text-sm">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!selectedBaId || submitting}
            className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-semibold text-sm flex items-center gap-2"
          >
            {submitting ? <RefreshCw className="size-3.5 animate-spin" /> : <UserCheck className="size-3.5" />}
            {submitting ? "Reassigning…" : "Confirm Reassign"}
          </button>
        </div>
      </div>
    </div>
  );
}

function RequestsTable({
  requests,
  onDetails,
  onDiscussion,
  onReassign,
  showSubmitter = false,
}: {
  requests: RequestItem[];
  onDetails: (r: RequestItem) => void;
  onDiscussion: (r: RequestItem) => void;
  onReassign?: (r: RequestItem) => void;
  showSubmitter?: boolean;
}) {
  if (requests.length === 0) return null;
  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse">
        <thead>
          <tr className="border-b-2 border-slate-300 bg-gradient-to-r from-slate-50 to-slate-100">
            <th className="w-[11%] px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">ID</th>
            <th className="w-[26%] px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">Title</th>
            <th className="w-[12%] px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">Priority</th>
            <th className="w-[12%] px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">Status</th>
            {showSubmitter
              ? <th className="w-[14%] px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">Submitted By</th>
              : <th className="w-[14%] px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">Assigned BA</th>
            }
            <th className="w-[12%] px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">Category</th>
            <th className="w-[7%]  px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">Date</th>
            <th className="w-[6%]  px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-600">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {requests.map((req) => {
            const p = priorityConfig[req.priority] ?? priorityConfig.Medium;
            return (
              <tr key={req.id} className="hover:bg-blue-50/40 transition-colors duration-100">
                {/* ID */}
                <td className="px-4 py-3 align-middle">
                  <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded whitespace-nowrap">
                    {req.req_number}
                  </span>
                </td>

                {/* Title */}
                <td className="px-4 py-3 align-middle max-w-0">
                  <p className="text-xs font-semibold text-slate-900 truncate" title={req.title}>{req.title}</p>
                </td>

                {/* Priority */}
                <td className="px-4 py-3 align-middle">
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-bold whitespace-nowrap ${p.color} ${p.bg} ${p.border}`}>
                    {p.icon}<span>{req.priority}</span>
                  </span>
                </td>

                {/* Status */}
                <td className="px-4 py-3 align-middle">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap ${
                    req.status === "Closed"      ? "bg-emerald-100 text-emerald-700" :
                    req.status === "Rejected"    ? "bg-rose-100 text-rose-700" :
                    req.status === "Submitted"   ? "bg-slate-100 text-slate-600" :
                    req.status === "BA Assigned" ? "bg-indigo-100 text-indigo-700" :
                                                   "bg-violet-100 text-violet-700"
                  }`}>
                    {req.status}
                  </span>
                </td>

                {/* BA / Submitter */}
                <td className="px-4 py-3 align-middle max-w-0">
                  {showSubmitter ? (
                    <p className="text-xs font-semibold text-indigo-700 truncate">
                      {req.stakeholder_name || req.stakeholder_email?.split("@")[0] || "—"}
                    </p>
                  ) : (
                    <p className={`text-xs font-semibold truncate ${req.ba_name || req.ba_email ? "text-indigo-700" : "text-amber-500 italic"}`}>
                      {req.ba_name || req.ba_email || "Awaiting assignment"}
                    </p>
                  )}
                </td>

                {/* Category */}
                <td className="px-4 py-3 align-middle max-w-0">
                  <span className="block truncate text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded" title={req.category}>
                    {req.category}
                  </span>
                </td>

                {/* Date */}
                <td className="px-4 py-3 align-middle whitespace-nowrap text-xs text-slate-500">
                  {new Date(req.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </td>

                {/* Actions */}
                <td className="px-4 py-3 align-middle">
                  <div className="flex items-center justify-center gap-1.5">
                    <button
                      onClick={() => onDetails(req)}
                      className="flex h-7 w-7 items-center justify-center rounded bg-slate-600 hover:bg-slate-700 text-white transition-all hover:shadow-md active:scale-95"
                      title="View Details"
                    >
                      <Eye className="size-3.5" />
                    </button>
                    <button
                      onClick={() => onDiscussion(req)}
                      className="flex h-7 w-7 items-center justify-center rounded bg-indigo-600 hover:bg-indigo-700 text-white transition-all hover:shadow-md active:scale-95"
                      title="Open Discussion"
                    >
                      <MessageSquare className="size-3.5" />
                    </button>
                    {onReassign && !showSubmitter && (req.ba_name || req.ba_email) && (
                      <button
                        onClick={() => onReassign(req)}
                        className="flex h-7 w-7 items-center justify-center rounded bg-amber-500 hover:bg-amber-600 text-white transition-all hover:shadow-md active:scale-95"
                        title="Reassign BA"
                      >
                        <UserCheck className="size-3.5" />
                      </button>
                    )}
                    {req.attachments.length > 0 && (
                      <span className="inline-flex items-center justify-center rounded bg-slate-100 text-xs font-bold text-slate-600 h-7 w-6" title={`${req.attachments.length} attachment${req.attachments.length > 1 ? "s" : ""}`}>
                        {req.attachments.length}
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function MyRequestsPage() {
  const [myRequests, setMyRequests]         = useState<RequestItem[]>([]);
  const [sharedRequests, setSharedRequests] = useState<RequestItem[]>([]);
  const [loading, setLoading]               = useState(true);
  const [refreshing, setRefreshing]         = useState(false);
  const [userId, setUserId]                 = useState(0);
  const [userName, setUserName]             = useState("");
  const [selectedRequest, setSelectedRequest]   = useState<RequestItem | null>(null);
  const [detailsOpen, setDetailsOpen]           = useState(false);
  const [reassignRequest, setReassignRequest]   = useState<RequestItem | null>(null);
  const [reassignOpen, setReassignOpen]         = useState(false);
  const { openDiscussion } = useDiscussionPanel();

  const fetchData = useCallback(async () => {
    const token = localStorage.getItem("authToken");
    if (!token) { setLoading(false); return; }
    try {
      const decoded = JSON.parse(atob(token.split(".")[1]));
      setUserId(decoded.id);
      setUserName(decoded.name || decoded.email || "You");

      const [mine, shared] = await Promise.all([
        fetch(`${API}/api/requests/my`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
        fetch(`${API}/api/requests/shared-with-me`, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
      ]);
      setMyRequests(mine.requests || []);
      setSharedRequests(shared.requests || []);
    } catch { /* ignore */ } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRefresh = () => { setRefreshing(true); fetchData(); };

  const handleDetails = (req: RequestItem) => { setSelectedRequest(req); setDetailsOpen(true); };
  const handleDiscussion = (req: RequestItem) => openDiscussion(req, userId, userName);
  const handleReassign = (req: RequestItem) => { setReassignRequest(req); setReassignOpen(true); };

  const byPriority: Record<string, number> = {};
  myRequests.forEach((r) => { byPriority[r.priority] = (byPriority[r.priority] || 0) + 1; });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-md shadow-indigo-100">
            <FileText className="size-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">My Requests</h1>
            <p className="text-xs text-slate-500">{myRequests.length} request{myRequests.length !== 1 ? "s" : ""} submitted</p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 hover:border-slate-400 transition-all"
        >
          <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Priority stats grid */}
      {myRequests.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {(["Critical", "High", "Medium", "Low"] as Priority[]).map((lvl) => {
            const p = priorityConfig[lvl];
            const count = byPriority[lvl] || 0;
            return (
              <div key={lvl} className={`rounded-2xl border-2 p-4 ${p.bg} ${p.border}`}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={p.color}>{p.icon}</span>
                  <span className={`text-xs font-bold uppercase tracking-wider ${p.color}`}>{lvl}</span>
                </div>
                <p className={`text-3xl font-bold ${p.color}`}>{count}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* My Requests table */}
      {loading ? (
        <Card className="border-2 border-slate-300">
          <div className="flex items-center justify-center py-16 gap-3 text-slate-400">
            <RefreshCw className="size-5 animate-spin" />
            <span className="text-base">Loading requests…</span>
          </div>
        </Card>
      ) : myRequests.length === 0 ? (
        <Card className="border-2 border-slate-300">
          <div className="flex flex-col items-center py-20 text-center">
            <div className="mb-4 flex size-20 items-center justify-center rounded-2xl bg-slate-100">
              <Inbox className="size-10 text-slate-400" />
            </div>
            <p className="text-lg font-semibold text-slate-700">No requests yet</p>
            <p className="mt-2 max-w-xs text-sm text-slate-500">Submit a business problem to get started.</p>
          </div>
        </Card>
      ) : (
        <Card className="border-2 border-slate-300 overflow-hidden">
          <RequestsTable requests={myRequests} onDetails={handleDetails} onDiscussion={handleDiscussion} onReassign={handleReassign} />
          <div className="border-t-2 border-slate-300 bg-gradient-to-r from-slate-50 to-slate-100 px-5 py-4">
            <p className="text-sm font-semibold text-slate-700">
              Total: <span className="font-bold text-slate-900">{myRequests.length}</span> request{myRequests.length !== 1 ? "s" : ""}
            </p>
          </div>
        </Card>
      )}

      {/* Shared with me */}
      {sharedRequests.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Users className="size-4 text-slate-400" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">
              Requests shared with you by BA
            </h2>
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-600">
              {sharedRequests.length}
            </span>
          </div>
          <Card className="border-2 border-slate-300 overflow-hidden">
            <RequestsTable requests={sharedRequests} onDetails={handleDetails} onDiscussion={handleDiscussion} showSubmitter />
            <div className="border-t-2 border-slate-300 bg-gradient-to-r from-slate-50 to-slate-100 px-5 py-4">
              <p className="text-sm font-semibold text-slate-700">
                Total: <span className="font-bold text-slate-900">{sharedRequests.length}</span> shared request{sharedRequests.length !== 1 ? "s" : ""}
              </p>
            </div>
          </Card>
        </div>
      )}

      {/* Details modal */}
      <DetailsModal request={selectedRequest} isOpen={detailsOpen} onClose={() => setDetailsOpen(false)} />

      {/* Reassign modal */}
      <ReassignModal
        request={reassignRequest}
        isOpen={reassignOpen}
        onClose={() => setReassignOpen(false)}
        onReassigned={handleRefresh}
      />
    </div>
  );
}
