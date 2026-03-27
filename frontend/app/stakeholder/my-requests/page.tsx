"use client";

import { useEffect, useState } from "react";
import {
  Loader2, FileText, Clock, Flame, TrendingUp, Zap,
  ChevronDown, ChevronUp, Briefcase, Paperclip, Download,
  CheckCircle2, Circle, AlertCircle,
} from "lucide-react";
import { Card } from "@/components/ui/Card";

const API = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5001";

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
  attachments: Attachment[];
}

const workflow = ["Submitted", "BA Assigned", "BRD", "FRD", "Dev", "UAT", "Closed"];

const priorityConfig: Record<string, { icon: React.ReactNode; cls: string; dot: string }> = {
  Low:      { icon: <TrendingUp className="size-3" />, cls: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-400" },
  Medium:   { icon: <Clock className="size-3" />,      cls: "bg-amber-50 text-amber-700 border-amber-200",       dot: "bg-amber-400" },
  High:     { icon: <Zap className="size-3" />,        cls: "bg-orange-50 text-orange-700 border-orange-200",    dot: "bg-orange-500" },
  Critical: { icon: <Flame className="size-3" />,      cls: "bg-rose-50 text-rose-700 border-rose-200",          dot: "bg-rose-500" },
};

const statusConfig: Record<string, { cls: string; icon: React.ReactNode }> = {
  Submitted:    { cls: "bg-blue-50 text-blue-700",     icon: <Circle className="size-3" /> },
  "BA Assigned":{ cls: "bg-purple-50 text-purple-700", icon: <Clock className="size-3" /> },
  BRD:          { cls: "bg-indigo-50 text-indigo-700", icon: <Clock className="size-3" /> },
  FRD:          { cls: "bg-sky-50 text-sky-700",       icon: <Clock className="size-3" /> },
  Dev:          { cls: "bg-amber-50 text-amber-700",   icon: <Clock className="size-3" /> },
  UAT:          { cls: "bg-teal-50 text-teal-700",     icon: <Clock className="size-3" /> },
  Approved:     { cls: "bg-emerald-50 text-emerald-700", icon: <CheckCircle2 className="size-3" /> },
  Rejected:     { cls: "bg-rose-50 text-rose-700",    icon: <AlertCircle className="size-3" /> },
  Closed:       { cls: "bg-slate-100 text-slate-500", icon: <CheckCircle2 className="size-3" /> },
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function WorkflowBar({ status }: { status: string }) {
  const idx = workflow.indexOf(status);
  const current = idx === -1 ? 0 : idx;
  return (
    <div className="mt-3">
      <div className="flex items-center gap-0">
        {workflow.map((step, i) => {
          const done    = i < current;
          const active  = i === current;
          const isLast  = i === workflow.length - 1;
          return (
            <div key={step} className="flex flex-1 items-center">
              <div className="flex flex-col items-center gap-1 min-w-0">
                <div className={`flex size-6 items-center justify-center rounded-full text-[9px] font-bold border-2 transition-all ${
                  done   ? "bg-blue-600 border-blue-600 text-white" :
                  active ? "bg-white border-blue-600 text-blue-600" :
                           "bg-white border-slate-200 text-slate-400"
                }`}>
                  {done ? "✓" : i + 1}
                </div>
                <span className={`text-[9px] font-medium text-center leading-tight ${active ? "text-blue-600" : done ? "text-slate-600" : "text-slate-400"}`}>
                  {step}
                </span>
              </div>
              {!isLast && (
                <div className={`h-0.5 flex-1 mx-1 mb-4 rounded-full ${i < current ? "bg-blue-600" : "bg-slate-200"}`} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function MyRequestsPage() {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [downloading, setDownloading] = useState<number | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("authToken");
    if (!token) { setLoading(false); return; }
    fetch(`${API}/api/requests/my`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setRequests(d.requests || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const downloadAttachment = async (attachmentId: number, filename: string) => {
    setDownloading(attachmentId);
    try {
      const token = localStorage.getItem("authToken");
      const res = await fetch(`${API}/api/requests/attachment/${attachmentId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const { url } = await res.json();
      const a = document.createElement("a");
      a.href = url; a.download = filename; a.target = "_blank";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } catch {
      // silently fail
    } finally {
      setDownloading(null);
    }
  };

  if (loading) return (
    <div className="flex h-64 items-center justify-center gap-2 text-slate-400">
      <Loader2 className="size-5 animate-spin" /><span className="text-sm">Loading your requests…</span>
    </div>
  );

  if (requests.length === 0) return (
    <Card>
      <div className="flex flex-col items-center py-16 text-center">
        <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-slate-50 border border-slate-100">
          <FileText className="size-8 text-slate-300" />
        </div>
        <p className="text-sm font-semibold text-slate-600">No requests yet</p>
        <p className="mt-1 text-xs text-slate-400">Submit a business problem to get started</p>
      </div>
    </Card>
  );

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-slate-800">My Requests</h2>
        <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">{requests.length}</span>
      </div>

      {requests.map((req) => {
        const isOpen = expanded === req.id;
        const pc = priorityConfig[req.priority] ?? priorityConfig.Low;
        const sc = statusConfig[req.status] ?? statusConfig.Submitted;

        return (
          <div key={req.id} className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden transition-all">
            {/* Card header — always visible */}
            <button
              onClick={() => setExpanded(isOpen ? null : req.id)}
              className="w-full px-5 py-4 text-left hover:bg-slate-50 transition-colors"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-1.5">
                    <span className="font-mono text-[11px] font-bold text-blue-500">{req.req_number}</span>
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${pc.cls}`}>
                      {pc.icon}{req.priority}
                    </span>
                    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${sc.cls}`}>
                      {sc.icon}{req.status}
                    </span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">{req.category}</span>
                  </div>
                  <p className="text-sm font-semibold text-slate-800 truncate">{req.title}</p>
                  <div className="mt-1.5 flex items-center gap-3 text-xs text-slate-400">
                    {req.ba_name || req.ba_email ? (
                      <span className="flex items-center gap-1">
                        <Briefcase className="size-3 text-purple-400" />
                        {req.ba_name || req.ba_email}
                      </span>
                    ) : (
                      <span className="italic">No BA assigned</span>
                    )}
                    <span>·</span>
                    <span>{new Date(req.created_at).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}</span>
                  </div>
                </div>
                <div className="shrink-0 text-slate-400">
                  {isOpen ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                </div>
              </div>
            </button>

            {/* Expanded details */}
            {isOpen && (
              <div className="border-t border-slate-100 px-5 pb-5 pt-4 space-y-4">
                {/* Workflow progress */}
                <WorkflowBar status={req.status} />

                {/* Description */}
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-1">Description</p>
                  <p className="text-sm text-slate-700 leading-relaxed">{req.description}</p>
                </div>

                {/* Attachments */}
                {req.attachments.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-2">
                      Attachments ({req.attachments.length})
                    </p>
                    <div className="space-y-1.5">
                      {req.attachments.map((att) => (
                        <div key={att.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <Paperclip className="size-3.5 shrink-0 text-slate-400" />
                            <span className="text-xs font-medium text-slate-700 truncate">{att.original_name}</span>
                            <span className="text-[10px] text-slate-400 shrink-0">{formatSize(att.size)}</span>
                          </div>
                          <button
                            onClick={() => downloadAttachment(att.id, att.original_name)}
                            disabled={downloading === att.id}
                            className="flex items-center gap-1 rounded-lg bg-white border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:border-blue-300 hover:text-blue-600 transition-all disabled:opacity-50"
                          >
                            {downloading === att.id
                              ? <Loader2 className="size-3 animate-spin" />
                              : <Download className="size-3" />}
                            Download
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
      })}
    </div>
  );
}
