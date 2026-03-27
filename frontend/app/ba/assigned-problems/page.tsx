"use client";

import { useState, useEffect } from "react";
import {
  AlertCircle,
  Briefcase,
  Clock,
  Download,
  FileText,
  Flame,
  Inbox,
  Paperclip,
  RefreshCw,
  TrendingUp,
  Zap,
} from "lucide-react";
import { Card } from "@/components/ui/Card";

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

const priorityConfig: Record<Priority, { color: string; bg: string; border: string; icon: React.ReactNode }> = {
  Low:      { color: "text-emerald-600", bg: "bg-emerald-50",  border: "border-emerald-200", icon: <TrendingUp className="size-3" /> },
  Medium:   { color: "text-amber-600",   bg: "bg-amber-50",    border: "border-amber-200",   icon: <Clock className="size-3" /> },
  High:     { color: "text-orange-600",  bg: "bg-orange-50",   border: "border-orange-200",  icon: <Zap className="size-3" /> },
  Critical: { color: "text-rose-600",    bg: "bg-rose-50",     border: "border-rose-200",    icon: <Flame className="size-3" /> },
};

const statusConfig: Record<RequestStatus, { color: string; bg: string }> = {
  "Submitted":       { color: "text-blue-700",   bg: "bg-blue-50 border-blue-200" },
  "In Progress":     { color: "text-amber-700",  bg: "bg-amber-50 border-amber-200" },
  "Pending Review":  { color: "text-purple-700", bg: "bg-purple-50 border-purple-200" },
  "Closed":          { color: "text-slate-600",  bg: "bg-slate-100 border-slate-200" },
};

function formatSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(0)} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function RequestCard({ request }: { request: AssignedRequest }) {
  const [downloading, setDownloading] = useState<number | null>(null);
  const [expanded, setExpanded] = useState(false);

  const p = priorityConfig[request.priority] ?? priorityConfig.Medium;
  const s = statusConfig[request.status as RequestStatus] ?? statusConfig.Submitted;

  const downloadAttachment = async (att: Attachment) => {
    setDownloading(att.id);
    try {
      const token = localStorage.getItem("authToken");
      const res = await fetch(`${API}/api/requests/attachment/${att.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = att.original_name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-all duration-200 hover:shadow-md">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 p-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-mono text-xs font-semibold text-blue-500">{request.req_number}</span>
            <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${s.color} ${s.bg}`}>
              {request.status}
            </span>
            <span className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${p.color} ${p.bg} ${p.border}`}>
              {p.icon} {request.priority}
            </span>
          </div>
          <p className="text-sm font-semibold text-slate-800">{request.title}</p>
          <p className="mt-0.5 text-xs text-slate-500">
            From: {request.stakeholder_name || request.stakeholder_email}
          </p>
        </div>
        <button
          onClick={() => setExpanded((e) => !e)}
          className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
        >
          {expanded ? "Less" : "Details"}
        </button>
      </div>

      {/* Expanded */}
      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 space-y-3">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-1">Description</p>
            <p className="text-sm text-slate-700 leading-relaxed">{request.description}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="font-medium uppercase tracking-wide text-slate-400">Category</p>
              <p className="mt-0.5 text-slate-700">{request.category}</p>
            </div>
            <div>
              <p className="font-medium uppercase tracking-wide text-slate-400">Assignment</p>
              <p className="mt-0.5 capitalize text-slate-700">{request.assignment_mode}</p>
            </div>
            <div>
              <p className="font-medium uppercase tracking-wide text-slate-400">Submitted</p>
              <p className="mt-0.5 text-slate-700">
                {new Date(request.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
              </p>
            </div>
          </div>

          {/* Attachments */}
          {request.attachments.length > 0 && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-slate-400 mb-2">
                Attachments ({request.attachments.length})
              </p>
              <div className="space-y-1.5">
                {request.attachments.map((att) => (
                  <div key={att.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-blue-50">
                        <Paperclip className="size-3.5 text-blue-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-xs font-medium text-slate-700">{att.original_name}</p>
                        <p className="text-xs text-slate-400">{formatSize(att.size)}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => downloadAttachment(att)}
                      disabled={downloading === att.id}
                      className="ml-2 flex shrink-0 items-center gap-1.5 rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-100 disabled:opacity-50 transition-colors"
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
      )}
    </div>
  );
}

export default function AssignedRequestsPage() {
  const [requests, setRequests] = useState<AssignedRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const fetchRequests = async () => {
    try {
      const token = localStorage.getItem("authToken");
      const res = await fetch(`${API}/api/requests/assigned`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to fetch requests");
      const data = await res.json();
      setRequests(data.requests);
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

  const byPriority: Record<string, number> = {};
  requests.forEach((r) => { byPriority[r.priority] = (byPriority[r.priority] || 0) + 1; });

  return (
    <div className="space-y-5">
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
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 shadow-sm hover:bg-slate-50 transition-colors"
        >
          <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Stats row */}
      {requests.length > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {(["Critical", "High", "Medium", "Low"] as Priority[]).map((lvl) => {
            const p = priorityConfig[lvl];
            const count = byPriority[lvl] || 0;
            return (
              <div key={lvl} className={`rounded-2xl border p-3 ${p.bg} ${p.border}`}>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className={p.color}>{p.icon}</span>
                  <span className={`text-xs font-semibold ${p.color}`}>{lvl}</span>
                </div>
                <p className={`text-2xl font-bold ${p.color}`}>{count}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <Card>
          <div className="flex items-center justify-center py-12 gap-3 text-slate-400">
            <RefreshCw className="size-5 animate-spin" />
            <span>Loading assigned requests...</span>
          </div>
        </Card>
      ) : error ? (
        <Card>
          <div className="flex items-center justify-center py-12 text-center">
            <div>
              <AlertCircle className="size-10 text-rose-400 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-700">{error}</p>
            </div>
          </div>
        </Card>
      ) : requests.length === 0 ? (
        <Card>
          <div className="flex flex-col items-center py-16 text-center">
            <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-slate-100">
              <Inbox className="size-8 text-slate-400" />
            </div>
            <p className="text-base font-semibold text-slate-700">No requests assigned yet</p>
            <p className="mt-1 max-w-xs text-sm text-slate-400">
              When a stakeholder submits a request and selects you, it will appear here.
            </p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => (
            <RequestCard key={req.id} request={req} />
          ))}
        </div>
      )}
    </div>
  );
}
