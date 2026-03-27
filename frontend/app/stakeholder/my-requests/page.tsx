"use client";

import { useEffect, useState } from "react";
import {
  Loader2, FileText, Clock, Flame, TrendingUp, Zap,
  Briefcase, Paperclip, Download, CheckCircle2, Circle,
  AlertCircle, ChevronDown, ChevronRight, CalendarDays,
  LayoutGrid, List,
} from "lucide-react";

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

const WORKFLOW = ["Submitted", "BA Assigned", "BRD", "FRD", "Dev", "UAT", "Closed"];

const priorityConfig: Record<string, { label: string; dot: string; text: string; bg: string; border: string; icon: React.ReactNode }> = {
  Low:      { label: "Low",      dot: "bg-emerald-400", text: "text-emerald-700", bg: "bg-emerald-50",  border: "border-emerald-200", icon: <TrendingUp className="size-3" /> },
  Medium:   { label: "Medium",   dot: "bg-amber-400",   text: "text-amber-700",   bg: "bg-amber-50",    border: "border-amber-200",   icon: <Clock className="size-3" /> },
  High:     { label: "High",     dot: "bg-orange-500",  text: "text-orange-700",  bg: "bg-orange-50",   border: "border-orange-200",  icon: <Zap className="size-3" /> },
  Critical: { label: "Critical", dot: "bg-rose-500",    text: "text-rose-700",    bg: "bg-rose-50",     border: "border-rose-200",    icon: <Flame className="size-3" /> },
};

const statusConfig: Record<string, { text: string; bg: string; icon: React.ReactNode; step: number }> = {
  Submitted:     { text: "text-blue-700",   bg: "bg-blue-50",    icon: <Circle className="size-3" />,       step: 0 },
  "BA Assigned": { text: "text-violet-700", bg: "bg-violet-50",  icon: <Clock className="size-3" />,        step: 1 },
  BRD:           { text: "text-indigo-700", bg: "bg-indigo-50",  icon: <FileText className="size-3" />,     step: 2 },
  FRD:           { text: "text-sky-700",    bg: "bg-sky-50",     icon: <FileText className="size-3" />,     step: 3 },
  Dev:           { text: "text-amber-700",  bg: "bg-amber-50",   icon: <Clock className="size-3" />,        step: 4 },
  UAT:           { text: "text-teal-700",   bg: "bg-teal-50",    icon: <Clock className="size-3" />,        step: 5 },
  Approved:      { text: "text-emerald-700",bg: "bg-emerald-50", icon: <CheckCircle2 className="size-3" />, step: 6 },
  Rejected:      { text: "text-rose-700",   bg: "bg-rose-50",    icon: <AlertCircle className="size-3" />,  step: 0 },
  Closed:        { text: "text-slate-500",  bg: "bg-slate-100",  icon: <CheckCircle2 className="size-3" />, step: 6 },
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
}

function ProgressBar({ status }: { status: string }) {
  const sc = statusConfig[status];
  const current = sc?.step ?? 0;
  const pct = Math.round((current / (WORKFLOW.length - 1)) * 100);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-medium text-slate-500">Progress</span>
        <span className="font-semibold text-slate-700">{WORKFLOW[current]}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 transition-all duration-700"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between">
        {WORKFLOW.map((_, i) => (
          <div
            key={i}
            className={`size-1.5 rounded-full transition-colors ${i <= current ? "bg-blue-500" : "bg-slate-200"}`}
          />
        ))}
      </div>
    </div>
  );
}

function WorkflowSteps({ status }: { status: string }) {
  const sc = statusConfig[status];
  const current = sc?.step ?? 0;
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1">
      {WORKFLOW.map((step, i) => {
        const done    = i < current;
        const active  = i === current;
        const future  = i > current;
        return (
          <div key={step} className="flex items-center shrink-0">
            <div className="flex flex-col items-center gap-1">
              <div className={`flex size-5 items-center justify-center rounded-full text-[9px] font-bold transition-all ${
                done   ? "bg-blue-600 text-white" :
                active ? "ring-2 ring-blue-500 ring-offset-1 bg-blue-600 text-white" :
                         "bg-slate-100 text-slate-400"
              }`}>
                {done ? "✓" : i + 1}
              </div>
              <span className={`text-[9px] font-medium whitespace-nowrap ${
                active ? "text-blue-600" : done ? "text-slate-500" : "text-slate-300"
              }`}>{step}</span>
            </div>
            {i < WORKFLOW.length - 1 && (
              <div className={`mx-1 mb-3.5 h-px w-4 shrink-0 ${i < current ? "bg-blue-400" : "bg-slate-200"}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function MyRequestsPage() {
  const [requests, setRequests]   = useState<RequestItem[]>([]);
  const [loading, setLoading]     = useState(true);
  const [expanded, setExpanded]   = useState<number | null>(null);
  const [downloading, setDownloading] = useState<number | null>(null);
  const [view, setView]           = useState<"list" | "grid">("list");

  useEffect(() => {
    const token = localStorage.getItem("authToken");
    if (!token) { setLoading(false); return; }
    fetch(`${API}/api/requests/my`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(d => { setRequests(d.requests || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const downloadAttachment = async (id: number, filename: string) => {
    setDownloading(id);
    try {
      const token = localStorage.getItem("authToken");
      const res = await fetch(`${API}/api/requests/attachment/${id}`, { headers: { Authorization: `Bearer ${token}` } });
      const { url } = await res.json();
      const a = document.createElement("a");
      a.href = url; a.download = filename; a.target = "_blank";
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
    } finally { setDownloading(null); }
  };

  // Summary counts
  const counts = {
    total:      requests.length,
    active:     requests.filter(r => !["Closed", "Rejected"].includes(r.status)).length,
    completed:  requests.filter(r => r.status === "Closed").length,
    unassigned: requests.filter(r => !r.ba_name && !r.ba_email).length,
  };

  if (loading) return (
    <div className="flex h-64 items-center justify-center gap-2 text-slate-400">
      <Loader2 className="size-5 animate-spin" /><span className="text-sm">Loading your requests…</span>
    </div>
  );

  if (requests.length === 0) return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white py-24 text-center">
      <div className="mb-4 flex size-16 items-center justify-center rounded-2xl bg-slate-50">
        <FileText className="size-8 text-slate-300" />
      </div>
      <p className="text-sm font-semibold text-slate-600">No requests yet</p>
      <p className="mt-1 text-xs text-slate-400">Submit a business problem to get started</p>
    </div>
  );

  return (
    <div className="space-y-5">

      {/* ── Summary strip ── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total",      value: counts.total,      color: "text-slate-700", bg: "bg-slate-50",    border: "border-slate-200" },
          { label: "Active",     value: counts.active,     color: "text-blue-700",  bg: "bg-blue-50",     border: "border-blue-200" },
          { label: "Completed",  value: counts.completed,  color: "text-emerald-700",bg:"bg-emerald-50",  border: "border-emerald-200" },
          { label: "Unassigned", value: counts.unassigned, color: "text-amber-700", bg: "bg-amber-50",    border: "border-amber-200" },
        ].map(s => (
          <div key={s.label} className={`rounded-xl border ${s.border} ${s.bg} px-4 py-3`}>
            <p className="text-[11px] font-medium text-slate-500">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Header row ── */}
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-slate-800">My Requests</h2>
        <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-1">
          <button onClick={() => setView("list")} className={`rounded-md p-1.5 transition-colors ${view === "list" ? "bg-slate-100 text-slate-700" : "text-slate-400 hover:text-slate-600"}`}>
            <List className="size-3.5" />
          </button>
          <button onClick={() => setView("grid")} className={`rounded-md p-1.5 transition-colors ${view === "grid" ? "bg-slate-100 text-slate-700" : "text-slate-400 hover:text-slate-600"}`}>
            <LayoutGrid className="size-3.5" />
          </button>
        </div>
      </div>

      {/* ── Request list ── */}
      <div className={view === "grid" ? "grid grid-cols-1 gap-4 lg:grid-cols-2" : "space-y-3"}>
        {requests.map(req => {
          const isOpen = expanded === req.id;
          const pc = priorityConfig[req.priority] ?? priorityConfig.Low;
          const sc = statusConfig[req.status] ?? statusConfig.Submitted;

          return (
            <div
              key={req.id}
              className={`rounded-2xl border bg-white shadow-sm transition-all duration-200 overflow-hidden ${
                isOpen ? "border-blue-200 shadow-md shadow-blue-50" : "border-slate-200 hover:border-slate-300 hover:shadow-md"
              }`}
            >
              {/* ── Card header ── */}
              <button
                onClick={() => setExpanded(isOpen ? null : req.id)}
                className="w-full px-5 py-4 text-left"
              >
                <div className="flex items-start gap-4">
                  {/* Priority colour bar */}
                  <div className={`mt-1 h-10 w-1 shrink-0 rounded-full ${pc.dot}`} />

                  <div className="min-w-0 flex-1">
                    {/* Top row: req number + badges */}
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span className="font-mono text-[11px] font-bold text-blue-500">{req.req_number}</span>
                      <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${pc.bg} ${pc.border} ${pc.text}`}>
                        {pc.icon}{pc.label}
                      </span>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${sc.bg} ${sc.text}`}>
                        {sc.icon}{req.status}
                      </span>
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500">{req.category}</span>
                    </div>

                    {/* Title */}
                    <p className="text-sm font-semibold text-slate-800 leading-snug">{req.title}</p>

                    {/* Meta row */}
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                      <span className="flex items-center gap-1">
                        <CalendarDays className="size-3" />
                        {formatDate(req.created_at)}
                      </span>
                      {req.ba_name || req.ba_email ? (
                        <span className="flex items-center gap-1 text-violet-600">
                          <Briefcase className="size-3" />
                          {req.ba_name || req.ba_email}
                        </span>
                      ) : (
                        <span className="italic text-amber-500">Awaiting BA assignment</span>
                      )}
                      {req.attachments.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Paperclip className="size-3" />
                          {req.attachments.length} file{req.attachments.length !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Chevron */}
                  <div className="shrink-0 text-slate-300 mt-1 transition-transform duration-200" style={{ transform: isOpen ? "rotate(90deg)" : "rotate(0deg)" }}>
                    <ChevronRight className="size-4" />
                  </div>
                </div>

                {/* Progress bar — always visible */}
                <div className="mt-3 pl-5">
                  <ProgressBar status={req.status} />
                </div>
              </button>

              {/* ── Expanded section ── */}
              {isOpen && (
                <div className="border-t border-slate-100 px-5 pb-5 pt-4 space-y-5">

                  {/* Workflow steps */}
                  <WorkflowSteps status={req.status} />

                  {/* Description */}
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">Description</p>
                    <p className="text-sm text-slate-600 leading-relaxed bg-slate-50 rounded-xl p-3.5 border border-slate-100">
                      {req.description}
                    </p>
                  </div>

                  {/* Attachments */}
                  {req.attachments.length > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                        Attachments · {req.attachments.length}
                      </p>
                      <div className="space-y-2">
                        {req.attachments.map(att => (
                          <div key={att.id} className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 transition-colors hover:border-slate-300">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-blue-50">
                                <Paperclip className="size-3.5 text-blue-500" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-medium text-slate-700 truncate">{att.original_name}</p>
                                <p className="text-[10px] text-slate-400">{formatSize(att.size)}</p>
                              </div>
                            </div>
                            <button
                              onClick={() => downloadAttachment(att.id, att.original_name)}
                              disabled={downloading === att.id}
                              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 transition-all disabled:opacity-50 ml-3 shrink-0"
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
    </div>
  );
}
