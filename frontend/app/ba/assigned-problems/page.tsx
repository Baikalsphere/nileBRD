"use client";

import { useState, useEffect } from "react";
import {
  AlertCircle, Briefcase, Clock, Download, Flame, Inbox,
  MessageSquare, Paperclip, RefreshCw, TrendingUp, Zap,
  Eye, ChevronRight, Calendar, User, Tag, FileText, X,
} from "lucide-react";
import { useDiscussionPanel } from "@/components/dashboard/DiscussionPanel";
import { ensureAuth, getUserMeta } from "@/lib/authGuard";

const API = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5001";

type Priority = "Low" | "Medium" | "High" | "Critical";
type RequestStatus = "Submitted" | "In Progress" | "Pending Review" | "Closed";

interface Attachment { id: number; original_name: string; mimetype: string; size: number; }
interface AssignedRequest {
  id: number; req_number: string; title: string; description: string;
  priority: Priority; category: string; status: RequestStatus;
  assignment_mode: string; created_at: string;
  stakeholder_email: string; stakeholder_name: string | null;
  attachments: Attachment[];
}
interface PreviousRequest {
  id: number; req_number: string; title: string; priority: Priority;
  category: string; status: string; created_at: string;
  stakeholder_name: string | null; stakeholder_email: string;
  new_ba_name: string | null; new_ba_email: string | null;
}

const priorityConfig: Record<Priority, { color: string; bg: string; border: string; dot: string; icon: React.ReactNode }> = {
  Low:      { color: "text-emerald-700", bg: "bg-emerald-50",  border: "border-emerald-200", dot: "bg-emerald-400", icon: <TrendingUp className="size-3" /> },
  Medium:   { color: "text-amber-700",   bg: "bg-amber-50",    border: "border-amber-200",   dot: "bg-amber-400",   icon: <Clock className="size-3" /> },
  High:     { color: "text-orange-700",  bg: "bg-orange-50",   border: "border-orange-200",  dot: "bg-orange-500",  icon: <Zap className="size-3" /> },
  Critical: { color: "text-rose-700",    bg: "bg-rose-50",     border: "border-rose-200",    dot: "bg-rose-500",    icon: <Flame className="size-3" /> },
};

const statusConfig: Record<string, { color: string; bg: string }> = {
  "Submitted":      { color: "text-blue-700",    bg: "bg-blue-50"    },
  "In Progress":    { color: "text-violet-700",  bg: "bg-violet-50"  },
  "Pending Review": { color: "text-amber-700",   bg: "bg-amber-50"   },
  "Closed":         { color: "text-slate-500",   bg: "bg-slate-100"  },
};

function formatSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DetailsModal({ request, isOpen, onClose }: { request: AssignedRequest | null; isOpen: boolean; onClose: () => void }) {
  const [downloading, setDownloading] = useState<number | null>(null);
  if (!isOpen || !request) return null;

  const downloadAttachment = async (att: Attachment) => {
    setDownloading(att.id);
    try {
      const token = await ensureAuth();
      const res = await fetch(`${API}/api/requests/attachment/${att.id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Failed to get download link");
      const { url } = await res.json();
      window.open(url, "_blank");
    } catch (err) { console.error(err); }
    finally { setDownloading(null); }
  };

  const p = priorityConfig[request.priority] ?? priorityConfig.Medium;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        {/* Top accent */}
        <div className="h-1 w-full rounded-t-2xl bg-gradient-to-r from-indigo-500 via-violet-500 to-purple-500" />

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5">
          <div className="flex items-start gap-4">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-indigo-50">
              <FileText className="size-5 text-indigo-600" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs font-bold text-indigo-500">{request.req_number}</span>
                <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${p.color} ${p.bg} ${p.border}`}>
                  {p.icon} {request.priority}
                </span>
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusConfig[request.status]?.color ?? "text-slate-500"} ${statusConfig[request.status]?.bg ?? "bg-slate-100"}`}>
                  {request.status}
                </span>
              </div>
              <h2 className="mt-1.5 text-lg font-bold text-slate-900 leading-snug">{request.title}</h2>
            </div>
          </div>
          <button onClick={onClose} className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
            <X className="size-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 pb-2 space-y-5 max-h-[55vh] overflow-y-auto">
          <div>
            <p className="mb-1.5 text-[11px] font-bold uppercase tracking-widest text-slate-400">Problem Description</p>
            <p className="text-sm leading-relaxed text-slate-700">{request.description}</p>
          </div>

          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { label: "Category", value: request.category, icon: <Tag className="size-3.5 text-slate-400" /> },
              { label: "Assignment", value: request.assignment_mode, icon: <User className="size-3.5 text-slate-400" /> },
              { label: "Submitted", value: new Date(request.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }), icon: <Calendar className="size-3.5 text-slate-400" /> },
              { label: "Stakeholder", value: request.stakeholder_name || request.stakeholder_email, icon: <User className="size-3.5 text-slate-400" /> },
            ].map(({ label, value, icon }) => (
              <div key={label} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <div className="flex items-center gap-1.5 mb-1">{icon}<p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p></div>
                <p className="text-xs font-semibold text-slate-800 truncate" title={value}>{value}</p>
              </div>
            ))}
          </div>

          {request.attachments.length > 0 && (
            <div>
              <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-slate-400">
                Attachments ({request.attachments.length})
              </p>
              <div className="space-y-2">
                {request.attachments.map((att) => (
                  <div key={att.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 hover:border-indigo-200 hover:bg-indigo-50/30 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-indigo-100">
                        <Paperclip className="size-4 text-indigo-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-800">{att.original_name}</p>
                        <p className="text-xs text-slate-400">{formatSize(att.size)}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => downloadAttachment(att)}
                      disabled={downloading === att.id}
                      className="ml-3 flex shrink-0 items-center gap-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 px-3.5 py-2 text-xs font-semibold text-white transition-colors"
                    >
                      {downloading === att.id ? <RefreshCw className="size-3 animate-spin" /> : <Download className="size-3" />}
                      {downloading === att.id ? "Downloading…" : "Download"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/60 rounded-b-2xl">
          <button onClick={onClose} className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AssignedRequestsPage() {
  const [requests, setRequests]             = useState<AssignedRequest[]>([]);
  const [prevRequests, setPrevRequests]     = useState<PreviousRequest[]>([]);
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState("");
  const [refreshing, setRefreshing]         = useState(false);
  const [userId, setUserId]                 = useState(0);
  const [userName, setUserName]             = useState("");
  const [detailsOpen, setDetailsOpen]       = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<AssignedRequest | null>(null);
  const [showPrev, setShowPrev]             = useState(false);
  const { openDiscussion } = useDiscussionPanel();

  useEffect(() => {
    const meta = getUserMeta();
    if (meta) { setUserId(meta.id); setUserName(meta.name || meta.email || "BA"); }
  }, []);

  const fetchRequests = async () => {
    try {
      const token = await ensureAuth();
      const [assignedRes, prevRes] = await Promise.all([
        fetch(`${API}/api/requests/assigned`,            { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/api/requests/previously-assigned`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (!assignedRes.ok) throw new Error("Failed to fetch requests");
      const assignedData = await assignedRes.json();
      const prevData     = prevRes.ok ? await prevRes.json() : { requests: [] };
      setRequests(assignedData.requests);
      setPrevRequests(prevData.requests || []);
      setError("");
    } catch {
      setError("Could not load assigned requests. Make sure you are logged in as a BA.");
    } finally { setLoading(false); setRefreshing(false); }
  };

  useEffect(() => { fetchRequests(); }, []);

  const handleRefresh = () => { setRefreshing(true); fetchRequests(); };

  const byPriority: Record<string, number> = {};
  requests.forEach((r) => { byPriority[r.priority] = (byPriority[r.priority] || 0) + 1; });

  return (
    <div className="space-y-8 pb-8">

      {/* ── Page header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-lg shadow-violet-200">
            <Briefcase className="size-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Assigned Requests</h1>
            <p className="text-sm text-slate-500">
              {loading ? "Loading…" : `${requests.length} active request${requests.length !== 1 ? "s" : ""} assigned to you`}
            </p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-600 shadow-sm hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-95"
        >
          <RefreshCw className={`size-4 ${refreshing ? "animate-spin text-indigo-500" : "text-slate-400"}`} />
          Refresh
        </button>
      </div>

      {/* ── Priority stats ── */}
      {requests.length > 0 && !loading && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {(["Critical", "High", "Medium", "Low"] as Priority[]).map((lvl) => {
            const p     = priorityConfig[lvl];
            const count = byPriority[lvl] || 0;
            return (
              <div key={lvl} className={`relative overflow-hidden rounded-2xl border-2 p-5 ${p.bg} ${p.border}`}>
                <div className={`absolute right-3 top-3 flex size-8 items-center justify-center rounded-xl ${p.bg}`}>
                  <span className={p.color}>{p.icon}</span>
                </div>
                <p className={`text-4xl font-black ${p.color}`}>{count}</p>
                <p className={`mt-1 text-xs font-bold uppercase tracking-widest ${p.color} opacity-70`}>{lvl}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Content ── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 py-24">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-white shadow-sm">
            <RefreshCw className="size-6 animate-spin text-indigo-400" />
          </div>
          <p className="text-sm font-medium text-slate-500">Loading assigned requests…</p>
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-rose-200 bg-rose-50 py-20 text-center px-8">
          <AlertCircle className="size-12 text-rose-400" />
          <div>
            <p className="text-base font-semibold text-slate-800">{error}</p>
            <p className="mt-1 text-sm text-slate-500">Please refresh or log in again.</p>
          </div>
        </div>
      ) : requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-5 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 py-24 text-center px-8">
          <div className="flex size-20 items-center justify-center rounded-3xl bg-white shadow-sm">
            <Inbox className="size-10 text-slate-300" />
          </div>
          <div>
            <p className="text-lg font-bold text-slate-700">No requests assigned</p>
            <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-slate-400">
              When a stakeholder submits a request and it is assigned to you, it will appear here.
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">Req #</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-slate-400">Title</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">Priority</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">Status</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap hidden lg:table-cell">Category</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap hidden md:table-cell">Stakeholder</th>
                <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap hidden xl:table-cell">Submitted</th>
                <th className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">Docs</th>
                <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request, idx) => {
                const p  = priorityConfig[request.priority] ?? priorityConfig.Medium;
                const sc = statusConfig[request.status] ?? { color: "text-slate-500", bg: "bg-slate-100" };
                return (
                  <tr
                    key={request.id}
                    className={`border-b border-slate-100 hover:bg-indigo-50/40 transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"}`}
                  >
                    {/* Req number */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className="font-mono text-xs font-bold text-indigo-500 bg-indigo-50 rounded-md px-2 py-1">
                        {request.req_number}
                      </span>
                    </td>

                    {/* Title */}
                    <td className="px-4 py-3.5 max-w-[280px]">
                      <p className="text-sm font-semibold text-slate-800 truncate" title={request.title}>
                        {request.title}
                      </p>
                    </td>

                    {/* Priority */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold ${p.color} ${p.bg} ${p.border}`}>
                        {p.icon}{request.priority}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3.5 whitespace-nowrap">
                      <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${sc.color} ${sc.bg}`}>
                        {request.status}
                      </span>
                    </td>

                    {/* Category */}
                    <td className="px-4 py-3.5 hidden lg:table-cell">
                      <span className="text-xs text-slate-500">{request.category}</span>
                    </td>

                    {/* Stakeholder */}
                    <td className="px-4 py-3.5 hidden md:table-cell whitespace-nowrap">
                      <span className="text-xs text-slate-500">
                        {request.stakeholder_name || request.stakeholder_email.split("@")[0]}
                      </span>
                    </td>

                    {/* Date */}
                    <td className="px-4 py-3.5 hidden xl:table-cell whitespace-nowrap">
                      <span className="text-xs text-slate-400">
                        {new Date(request.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                      </span>
                    </td>

                    {/* Attachments */}
                    <td className="px-4 py-3.5 text-center">
                      {request.attachments.length > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                          <Paperclip className="size-3" />{request.attachments.length}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => { setSelectedRequest(request); setDetailsOpen(true); }}
                          className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all"
                        >
                          <Eye className="size-3.5 text-slate-400" />
                          Details
                        </button>
                        <button
                          onClick={() => openDiscussion(request, userId, userName)}
                          className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition-all shadow-sm shadow-indigo-100"
                        >
                          <MessageSquare className="size-3.5" />
                          Discuss
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Footer row */}
          <div className="border-t border-slate-100 bg-slate-50 px-5 py-2.5">
            <p className="text-xs font-medium text-slate-400">
              {requests.length} request{requests.length !== 1 ? "s" : ""} total
            </p>
          </div>
        </div>
      )}

      {/* ── Previously assigned ── */}
      {prevRequests.length > 0 && (
        <div className="space-y-4">
          <button
            onClick={() => setShowPrev((v) => !v)}
            className="flex w-full items-center gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-left hover:bg-amber-100 transition-colors"
          >
            <AlertCircle className="size-4 shrink-0 text-amber-500" />
            <div className="flex-1">
              <p className="text-sm font-bold text-amber-700">Reassigned Away From You</p>
              <p className="text-xs text-amber-600 mt-0.5">{prevRequests.length} request{prevRequests.length !== 1 ? "s" : ""} that were previously yours</p>
            </div>
            <ChevronRight className={`size-4 text-amber-500 transition-transform ${showPrev ? "rotate-90" : ""}`} />
          </button>

          {showPrev && (
            <div className="rounded-2xl border border-amber-200 bg-white overflow-hidden">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-amber-100 bg-amber-50">
                    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-amber-600">Req #</th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-amber-600">Title</th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-amber-600 hidden sm:table-cell">Priority</th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-amber-600 hidden md:table-cell">Stakeholder</th>
                    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-amber-600 hidden lg:table-cell">Date</th>
                    <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-widest text-amber-600">Reassigned To</th>
                  </tr>
                </thead>
                <tbody>
                  {prevRequests.map((r, idx) => {
                    const p = priorityConfig[r.priority as Priority] ?? priorityConfig.Medium;
                    return (
                      <tr key={r.id} className={`border-b border-amber-100 last:border-0 ${idx % 2 === 0 ? "bg-white" : "bg-amber-50/30"}`}>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span className="font-mono text-xs font-bold text-amber-600 bg-amber-100 rounded-md px-2 py-1">{r.req_number}</span>
                        </td>
                        <td className="px-4 py-3 max-w-[240px]">
                          <p className="text-sm font-semibold text-slate-700 truncate">{r.title}</p>
                        </td>
                        <td className="px-4 py-3 hidden sm:table-cell whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${p.color} ${p.bg} ${p.border}`}>
                            {p.icon}{r.priority}
                          </span>
                        </td>
                        <td className="px-4 py-3 hidden md:table-cell">
                          <span className="text-xs text-slate-500">{r.stakeholder_name || r.stakeholder_email.split("@")[0]}</span>
                        </td>
                        <td className="px-4 py-3 hidden lg:table-cell whitespace-nowrap">
                          <span className="text-xs text-slate-400">{new Date(r.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}</span>
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap">
                          <span className="rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                            → {r.new_ba_name || r.new_ba_email || "Reassigned"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <DetailsModal request={selectedRequest} isOpen={detailsOpen} onClose={() => setDetailsOpen(false)} />
    </div>
  );
}
