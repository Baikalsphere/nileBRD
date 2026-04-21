"use client";

import { useState, useEffect } from "react";
import {
  AlertCircle,
  Briefcase,
  Clock,
  Download,
  Flame,
  Inbox,
  MessageSquare,
  Paperclip,
  RefreshCw,
  TrendingUp,
  Zap,
  Eye,
} from "lucide-react";
import { Card } from "@/components/ui/Card";
import { useDiscussionPanel } from "@/components/dashboard/DiscussionPanel";

const API = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5001";

type Priority = "Low" | "Medium" | "High" | "Critical";
type RequestStatus = "Submitted" | "In Progress" | "Pending Review" | "Closed";

interface Attachment {
  id: number;
  original_name: string;
  mimetype: string;
  size: number;
}

interface AssignedRequest {
  id: number;
  req_number: string;
  title: string;
  description: string;
  priority: Priority;
  category: string;
  status: RequestStatus;
  assignment_mode: string;
  created_at: string;
  stakeholder_email: string;
  stakeholder_name: string | null;
  attachments: Attachment[];
}

interface PreviousRequest {
  id: number;
  req_number: string;
  title: string;
  priority: Priority;
  category: string;
  status: string;
  created_at: string;
  stakeholder_name: string | null;
  stakeholder_email: string;
  new_ba_name: string | null;
  new_ba_email: string | null;
}

const priorityConfig: Record<Priority, { color: string; bg: string; border: string; icon: React.ReactNode }> = {
  Low:      { color: "text-emerald-600", bg: "bg-emerald-50",  border: "border-emerald-200", icon: <TrendingUp className="size-3" /> },
  Medium:   { color: "text-amber-600",   bg: "bg-amber-50",    border: "border-amber-200",   icon: <Clock className="size-3" /> },
  High:     { color: "text-orange-600",  bg: "bg-orange-50",   border: "border-orange-200",  icon: <Zap className="size-3" /> },
  Critical: { color: "text-rose-600",    bg: "bg-rose-50",     border: "border-rose-200",    icon: <Flame className="size-3" /> },
};

function formatSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(0)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function DetailsModal({ request, isOpen, onClose }: { request: AssignedRequest | null; isOpen: boolean; onClose: () => void }) {
  const [downloading, setDownloading] = useState<number | null>(null);

  if (!isOpen || !request) return null;

  const downloadAttachment = async (att: Attachment) => {
    setDownloading(att.id);
    try {
      const token = localStorage.getItem("authToken");
      const res = await fetch(`${API}/api/requests/attachment/${att.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to get download link");
      const { url } = await res.json();
      window.open(url, "_blank");
    } catch (err) {
      console.error(err);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="relative w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Request Details</h2>
            <p className="text-sm text-slate-500">Request #{request.req_number}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl">&times;</button>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-5 max-h-96 overflow-y-auto">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Title</p>
            <p className="text-base font-semibold text-slate-900">{request.title}</p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Description</p>
            <p className="text-sm text-slate-700 leading-relaxed">{request.description}</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Category</p>
              <p className="text-sm text-slate-700">{request.category}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Assignment Mode</p>
              <p className="text-sm capitalize text-slate-700">{request.assignment_mode}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">Submitted</p>
              <p className="text-sm text-slate-700">
                {new Date(request.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-1">From</p>
              <p className="text-sm text-slate-700">{request.stakeholder_name || request.stakeholder_email}</p>
            </div>
          </div>

          {/* Attachments */}
          {request.attachments.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">
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
                      {downloading === att.id
                        ? <RefreshCw className="size-3 animate-spin" />
                        : <Download className="size-3" />}
                      {downloading === att.id ? "..." : "Download"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-slate-200 flex justify-end gap-3 px-6 py-3 bg-slate-50 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 font-medium text-sm transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}


export default function AssignedRequestsPage() {
  const [requests, setRequests]           = useState<AssignedRequest[]>([]);
  const [prevRequests, setPrevRequests]   = useState<PreviousRequest[]>([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState("");
  const [refreshing, setRefreshing]       = useState(false);
  const [userId, setUserId]               = useState(0);
  const [userName, setUserName]           = useState("");
  const [detailsOpen, setDetailsOpen]     = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<AssignedRequest | null>(null);
  const { openDiscussion } = useDiscussionPanel();

  useEffect(() => {
    try {
      const t = localStorage.getItem("authToken");
      if (t) {
        const d = JSON.parse(atob(t.split(".")[1]));
        setUserId(d.id); setUserName(d.name || d.email || "BA");
      }
    } catch { /* ignore */ }
  }, []);

  const fetchRequests = async () => {
    try {
      const token = localStorage.getItem("authToken");
      const [assignedRes, prevRes] = await Promise.all([
        fetch(`${API}/api/requests/assigned`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/api/requests/previously-assigned`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (!assignedRes.ok) throw new Error("Failed to fetch requests");
      const assignedData = await assignedRes.json();
      const prevData = prevRes.ok ? await prevRes.json() : { requests: [] };
      setRequests(assignedData.requests);
      setPrevRequests(prevData.requests || []);
      setError("");
    } catch (err) {
      setError("Could not load assigned requests. Make sure you are logged in as a BA.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchRequests(); }, []);

  const handleRefresh = () => { setRefreshing(true); fetchRequests(); };

  const handleDetailsClick = (request: AssignedRequest) => {
    setSelectedRequest(request);
    setDetailsOpen(true);
  };

  const handleDiscussionClick = (request: AssignedRequest) => {
    openDiscussion(request, userId, userName);
  };

  const byPriority: Record<string, number> = {};
  requests.forEach((r) => { byPriority[r.priority] = (byPriority[r.priority] || 0) + 1; });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 shadow-md shadow-purple-100">
            <Briefcase className="size-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Assigned Requests</h1>
            <p className="text-xs text-slate-500">{requests.length} request{requests.length !== 1 ? "s" : ""} assigned to you</p>
          </div>
        </div>
        <button
          onClick={handleRefresh}
          suppressHydrationWarning
          className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 hover:border-slate-400 transition-all"
        >
          <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Stats grid */}
      {requests.length > 0 && (
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

      {/* Content */}
      {loading ? (
        <Card className="border-2 border-slate-300">
          <div className="flex items-center justify-center py-16 gap-3 text-slate-400">
            <RefreshCw className="size-5 animate-spin" />
            <span className="text-base">Loading assigned requests...</span>
          </div>
        </Card>
      ) : error ? (
        <Card className="border-2 border-rose-300">
          <div className="flex items-center justify-center py-16 text-center">
            <div>
              <AlertCircle className="size-12 text-rose-400 mx-auto mb-3" />
              <p className="text-base font-semibold text-slate-700">{error}</p>
            </div>
          </div>
        </Card>
      ) : requests.length === 0 ? (
        <Card className="border-2 border-slate-300">
          <div className="flex flex-col items-center py-20 text-center">
            <div className="mb-4 flex size-20 items-center justify-center rounded-2xl bg-slate-100">
              <Inbox className="size-10 text-slate-400" />
            </div>
            <p className="text-lg font-semibold text-slate-700">No requests assigned yet</p>
            <p className="mt-2 max-w-xs text-sm text-slate-500">
              When a stakeholder submits a request and selects you, it will appear here.
            </p>
          </div>
        </Card>
      ) : (
        <Card className="border-2 border-slate-300 overflow-hidden">
          {/* Table wrapper */}
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse">
              <thead>
                <tr className="border-b-2 border-slate-300 bg-gradient-to-r from-slate-50 to-slate-100">
                  <th className="w-[11%] px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">ID</th>
                  <th className="w-[28%] px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">Title</th>
                  <th className="w-[13%] px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">Priority</th>
                  <th className="w-[15%] px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">Stakeholder</th>
                  <th className="w-[14%] px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">Category</th>
                  <th className="w-[9%]  px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-slate-600">Date</th>
                  <th className="w-[10%] px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-slate-600">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {requests.map((request) => {
                  const p = priorityConfig[request.priority] ?? priorityConfig.Medium;

                  return (
                    <tr key={request.id} className="hover:bg-blue-50/40 transition-colors duration-100">
                      {/* ID */}
                      <td className="px-4 py-3 align-middle">
                        <span className="font-mono text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded whitespace-nowrap">
                          {request.req_number}
                        </span>
                      </td>

                      {/* Title */}
                      <td className="px-4 py-3 align-middle max-w-0">
                        <p className="text-xs font-semibold text-slate-900 truncate" title={request.title}>
                          {request.title}
                        </p>
                      </td>

                      {/* Priority */}
                      <td className="px-4 py-3 align-middle">
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-bold whitespace-nowrap ${p.color} ${p.bg} ${p.border}`}>
                          {p.icon}<span>{request.priority}</span>
                        </span>
                      </td>

                      {/* Stakeholder */}
                      <td className="px-4 py-3 align-middle max-w-0">
                        <p className="text-xs font-semibold text-indigo-700 truncate" title={request.stakeholder_name || request.stakeholder_email}>
                          {request.stakeholder_name ? request.stakeholder_name.split(" ")[0] : request.stakeholder_email.split("@")[0]}
                        </p>
                      </td>

                      {/* Category */}
                      <td className="px-4 py-3 align-middle max-w-0">
                        <span className="block truncate text-xs text-slate-600 bg-slate-100 px-2 py-1 rounded" title={request.category}>
                          {request.category}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="px-4 py-3 align-middle whitespace-nowrap text-xs text-slate-500">
                        {new Date(request.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3 align-middle">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => handleDetailsClick(request)}
                            className="flex h-7 w-7 items-center justify-center rounded bg-slate-600 hover:bg-slate-700 text-white transition-all hover:shadow-md active:scale-95"
                            title="View Details"
                          >
                            <Eye className="size-3.5" />
                          </button>
                          <button
                            onClick={() => handleDiscussionClick(request)}
                            className="flex h-7 w-7 items-center justify-center rounded bg-indigo-600 hover:bg-indigo-700 text-white transition-all hover:shadow-md active:scale-95"
                            title="Open Discussion"
                          >
                            <MessageSquare className="size-3.5" />
                          </button>
                          {/* Attachment badge — fixed-width slot keeps alignment stable */}
                          <div className="w-6 text-center">
                            {request.attachments.length > 0 && (
                              <span className="inline-flex items-center justify-center rounded bg-slate-100 text-xs font-bold text-slate-600 h-7 w-6" title={`${request.attachments.length} attachment${request.attachments.length > 1 ? "s" : ""}`}>
                                {request.attachments.length}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer stats */}
          <div className="border-t-2 border-slate-300 bg-gradient-to-r from-slate-50 to-slate-100 px-5 py-4">
            <p className="text-sm font-semibold text-slate-700">
              Total: <span className="font-bold text-slate-900">{requests.length}</span> request{requests.length !== 1 ? "s" : ""}
            </p>
          </div>
        </Card>
      )}

      {/* Previously assigned — reassigned away from this BA */}
      {prevRequests.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-4 text-slate-400" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">Reassigned Away From You</h2>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
              {prevRequests.length}
            </span>
          </div>
          <Card className="border-2 border-amber-200 overflow-hidden">
            <div className="w-full overflow-x-auto">
              <table className="w-full min-w-[580px] border-collapse">
                <thead>
                  <tr className="border-b-2 border-amber-200 bg-amber-50">
                    <th className="w-[12%] px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-amber-700">ID</th>
                    <th className="w-[28%] px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-amber-700">Title</th>
                    <th className="w-[12%] px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-amber-700">Priority</th>
                    <th className="w-[14%] px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-amber-700">Stakeholder</th>
                    <th className="w-[22%] px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-amber-700">Now Assigned To</th>
                    <th className="w-[12%] px-4 py-3 text-left text-xs font-bold uppercase tracking-wider text-amber-700">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100">
                  {prevRequests.map((r) => {
                    const p = priorityConfig[r.priority as Priority] ?? priorityConfig.Medium;
                    return (
                      <tr key={r.id} className="bg-amber-50/30 hover:bg-amber-50/60 transition-colors">
                        <td className="px-4 py-3 align-middle">
                          <span className="font-mono text-xs font-bold text-amber-700 bg-amber-100 px-2 py-1 rounded">{r.req_number}</span>
                        </td>
                        <td className="px-4 py-3 align-middle max-w-0">
                          <p className="text-xs font-semibold text-slate-800 truncate" title={r.title}>{r.title}</p>
                        </td>
                        <td className="px-4 py-3 align-middle">
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-bold ${p.color} ${p.bg} ${p.border}`}>
                            {p.icon}<span>{r.priority}</span>
                          </span>
                        </td>
                        <td className="px-4 py-3 align-middle max-w-0">
                          <p className="text-xs text-slate-600 truncate">{r.stakeholder_name || r.stakeholder_email.split("@")[0]}</p>
                        </td>
                        <td className="px-4 py-3 align-middle">
                          <span className="text-xs font-semibold text-indigo-700 bg-indigo-50 px-2 py-1 rounded-full">
                            Assigned to {r.new_ba_name || r.new_ba_email || "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 align-middle whitespace-nowrap text-xs text-slate-500">
                          {new Date(r.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Details Modal */}
      <DetailsModal request={selectedRequest} isOpen={detailsOpen} onClose={() => setDetailsOpen(false)} />
    </div>
  );
}
