"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Briefcase, CalendarDays, Check, Clock, Download, FileText,
  Flame, Inbox, Loader2, MessageSquare, Paperclip, Plus,
  RefreshCw, TrendingUp, Users, Eye, Zap, AlertCircle, UserCheck, Upload,
} from "lucide-react";
import { useDiscussionPanel } from "@/components/dashboard/DiscussionPanel";
import { ensureAuth } from "@/lib/authGuard";

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

const priorityConfig: Record<string, { color: string; bg: string; border: string; dot: string; icon: React.ReactNode }> = {
  Low:      { color: "text-emerald-700", bg: "bg-emerald-50",  border: "border-emerald-200", dot: "bg-emerald-400", icon: <TrendingUp className="size-3" /> },
  Medium:   { color: "text-amber-700",   bg: "bg-amber-50",    border: "border-amber-200",   dot: "bg-amber-400",   icon: <Clock className="size-3" /> },
  High:     { color: "text-orange-700",  bg: "bg-orange-50",   border: "border-orange-200",  dot: "bg-orange-500",  icon: <Zap className="size-3" /> },
  Critical: { color: "text-rose-700",    bg: "bg-rose-50",     border: "border-rose-200",    dot: "bg-rose-500",    icon: <Flame className="size-3" /> },
};

const statusConfig: Record<string, { color: string; bg: string }> = {
  "Submitted":   { color: "text-blue-700",   bg: "bg-blue-50"   },
  "BA Assigned": { color: "text-indigo-700", bg: "bg-indigo-50" },
  "BRD":         { color: "text-violet-700", bg: "bg-violet-50" },
  "FRD":         { color: "text-purple-700", bg: "bg-purple-50" },
  "Dev":         { color: "text-cyan-700",   bg: "bg-cyan-50"   },
  "UAT":         { color: "text-teal-700",   bg: "bg-teal-50"   },
  "Closed":      { color: "text-slate-500",  bg: "bg-slate-100" },
  "Rejected":    { color: "text-rose-700",   bg: "bg-rose-50"   },
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

function DetailsModal({ request, isOpen, onClose, onAttach }: { request: RequestItem | null; isOpen: boolean; onClose: () => void; onAttach?: () => void }) {
  const [downloading, setDownloading] = useState<number | null>(null);

  if (!isOpen || !request) return null;

  const downloadAttachment = async (att: Attachment) => {
    setDownloading(att.id);
    try {
      const token = await ensureAuth();
      const res = await fetch(`${API}/api/requests/attachment/${att.id}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error("Failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = att.original_name;
      a.click();
      URL.revokeObjectURL(url);
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
        <div className="border-t border-slate-200 flex items-center justify-between px-6 py-3 bg-slate-50 rounded-b-2xl">
          {onAttach ? (
            <button
              onClick={onAttach}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-colors"
            >
              <Paperclip className="size-3.5" />
              Attach Files
            </button>
          ) : <span />}
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
    ensureAuth()
      .then(token =>
        fetch(`${API}/api/requests/ba-list`, { headers: { Authorization: `Bearer ${token}` } })
      )
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
      const token = await ensureAuth();
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

function AddAttachmentModal({
  request,
  isOpen,
  onClose,
  onUploaded,
}: {
  request: RequestItem | null;
  isOpen: boolean;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { if (!isOpen) { setFiles([]); setError(""); } }, [isOpen]);

  if (!isOpen || !request) return null;

  const ALLOWED = ["application/pdf", "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "image/png", "image/jpeg"];

  const handleFiles = (picked: FileList | null) => {
    if (!picked) return;
    const valid = Array.from(picked).filter(f => ALLOWED.includes(f.type));
    const invalid = Array.from(picked).length - valid.length;
    setError(invalid > 0 ? `${invalid} file(s) skipped — unsupported type.` : "");
    setFiles(prev => [...prev, ...valid]);
  };

  const removeFile = (idx: number) => setFiles(prev => prev.filter((_, i) => i !== idx));

  const handleUpload = async () => {
    if (!files.length) return;
    setUploading(true);
    setError("");
    try {
      const token = await ensureAuth();
      const form = new FormData();
      files.forEach(f => form.append("attachments", f));
      const res = await fetch(`${API}/api/requests/${request.id}/attachments`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Upload failed");
      onUploaded();
      onClose();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Attach Files</h2>
            <p className="text-sm text-slate-500">{request.req_number} — {request.title}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-2xl leading-none">&times;</button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Drop zone */}
          <label className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 cursor-pointer px-4 py-8 transition-colors">
            <Upload className="size-8 text-slate-400" />
            <p className="text-sm font-semibold text-slate-600">Click to select files</p>
            <p className="text-xs text-slate-400">PDF, Word, Excel, PNG, JPEG · max 10 MB each</p>
            <input type="file" multiple className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg" onChange={e => handleFiles(e.target.files)} />
          </label>

          {/* Selected files */}
          {files.length > 0 && (
            <div className="space-y-2">
              {files.map((f, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Paperclip className="size-4 shrink-0 text-indigo-500" />
                    <p className="truncate text-xs font-medium text-slate-800">{f.name}</p>
                    <span className="shrink-0 text-xs text-slate-400">{(f.size / 1024).toFixed(0)} KB</span>
                  </div>
                  <button onClick={() => removeFile(i)} className="ml-2 text-slate-400 hover:text-rose-500 text-lg leading-none">&times;</button>
                </div>
              ))}
            </div>
          )}

          {error && <p className="text-xs text-rose-600">{error}</p>}
        </div>

        <div className="border-t border-slate-200 flex justify-end gap-3 px-6 py-3 bg-slate-50 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 font-medium text-sm">
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={!files.length || uploading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white font-semibold text-sm"
          >
            {uploading ? <RefreshCw className="size-3.5 animate-spin" /> : <Upload className="size-3.5" />}
            {uploading ? "Uploading…" : `Upload ${files.length > 0 ? `(${files.length})` : ""}`}
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
  onAttach,
  showSubmitter = false,
}: {
  requests: RequestItem[];
  onDetails: (r: RequestItem) => void;
  onDiscussion: (r: RequestItem) => void;
  onReassign?: (r: RequestItem) => void;
  onAttach?: (r: RequestItem) => void;
  showSubmitter?: boolean;
}) {
  if (requests.length === 0) return null;
  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className="border-b border-slate-200 bg-slate-50">
          <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">Req #</th>
          <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-slate-400">Title</th>
          <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">Priority</th>
          <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">Status</th>
          {showSubmitter
            ? <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap hidden md:table-cell">Submitted By</th>
            : <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap hidden md:table-cell">Assigned BA</th>
          }
          <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap hidden lg:table-cell">Category</th>
          <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap hidden xl:table-cell">Date</th>
          <th className="px-4 py-3 text-center text-[11px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">Docs</th>
          <th className="px-4 py-3 text-right text-[11px] font-bold uppercase tracking-widest text-slate-400 whitespace-nowrap">Actions</th>
        </tr>
      </thead>
      <tbody>
        {requests.map((req, idx) => {
          const p  = priorityConfig[req.priority] ?? priorityConfig.Medium;
          const sc = statusConfig[req.status] ?? { color: "text-slate-500", bg: "bg-slate-100" };
          return (
            <tr
              key={req.id}
              className={`border-b border-slate-100 hover:bg-indigo-50/40 transition-colors ${idx % 2 === 0 ? "bg-white" : "bg-slate-50/40"}`}
            >
              {/* Req number */}
              <td className="px-4 py-3.5 whitespace-nowrap">
                <span className="font-mono text-xs font-bold text-indigo-500 bg-indigo-50 rounded-md px-2 py-1">
                  {req.req_number}
                </span>
              </td>

              {/* Title */}
              <td className="px-4 py-3.5 max-w-[240px]">
                <p className="text-sm font-semibold text-slate-800 truncate" title={req.title}>{req.title}</p>
              </td>

              {/* Priority */}
              <td className="px-4 py-3.5 whitespace-nowrap">
                <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold ${p.color} ${p.bg} ${p.border}`}>
                  {p.icon}{req.priority}
                </span>
              </td>

              {/* Status */}
              <td className="px-4 py-3.5 whitespace-nowrap">
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${sc.color} ${sc.bg}`}>
                  {req.status}
                </span>
              </td>

              {/* BA / Submitter */}
              <td className="px-4 py-3.5 hidden md:table-cell whitespace-nowrap">
                {showSubmitter ? (
                  <span className="text-xs text-slate-500">
                    {req.stakeholder_name || req.stakeholder_email?.split("@")[0] || "—"}
                  </span>
                ) : (
                  <span className={`text-xs font-semibold ${req.ba_name || req.ba_email ? "text-indigo-700" : "text-amber-500 italic"}`}>
                    {req.ba_name || req.ba_email || "Awaiting assignment"}
                  </span>
                )}
              </td>

              {/* Category */}
              <td className="px-4 py-3.5 hidden lg:table-cell">
                <span className="text-xs text-slate-500">{req.category}</span>
              </td>

              {/* Date */}
              <td className="px-4 py-3.5 hidden xl:table-cell whitespace-nowrap">
                <span className="text-xs text-slate-400">
                  {new Date(req.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                </span>
              </td>

              {/* Attachments */}
              <td className="px-4 py-3.5 text-center">
                {req.attachments.length > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                    <Paperclip className="size-3" />{req.attachments.length}
                  </span>
                ) : (
                  <span className="text-xs text-slate-300">—</span>
                )}
              </td>

              {/* Actions */}
              <td className="px-4 py-3.5 text-right whitespace-nowrap">
                <div className="flex items-center justify-end gap-1.5">
                  <button
                    onClick={() => onDetails(req)}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all"
                  >
                    <Eye className="size-3.5 text-slate-400" />
                    Details
                  </button>
                  <button
                    onClick={() => onDiscussion(req)}
                    className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 transition-all shadow-sm shadow-indigo-100"
                  >
                    <MessageSquare className="size-3.5" />
                    Discuss
                  </button>
                  {onAttach && (
                    <button
                      onClick={() => onAttach(req)}
                      className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-all shadow-sm"
                      title="Attach Files"
                    >
                      <Paperclip className="size-3.5" />
                      Attach
                    </button>
                  )}
                  {onReassign && !showSubmitter && (req.ba_name || req.ba_email) && (
                    <button
                      onClick={() => onReassign(req)}
                      className="flex size-[30px] shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600 hover:bg-amber-200 transition-all"
                      title="Reassign BA"
                    >
                      <UserCheck className="size-3.5" />
                    </button>
                  )}
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
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
  const [attachRequest, setAttachRequest]       = useState<RequestItem | null>(null);
  const [attachOpen, setAttachOpen]             = useState(false);
  const { openDiscussion } = useDiscussionPanel();

  const fetchData = useCallback(async () => {
    const token = await ensureAuth();
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

  const handleDetails    = (req: RequestItem) => { setSelectedRequest(req); setDetailsOpen(true); };
  const handleDiscussion = (req: RequestItem) => openDiscussion(req, userId, userName);
  const handleReassign   = (req: RequestItem) => { setReassignRequest(req); setReassignOpen(true); };
  const handleAttach     = (req: RequestItem) => { setAttachRequest(req); setAttachOpen(true); };
  const handleAttachFromDetails = () => { setDetailsOpen(false); setAttachRequest(selectedRequest); setAttachOpen(true); };

  const byPriority: Record<string, number> = {};
  myRequests.forEach((r) => { byPriority[r.priority] = (byPriority[r.priority] || 0) + 1; });

  return (
    <div className="space-y-8 pb-8">

      {/* ── Page header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex size-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-200">
            <FileText className="size-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">My Requests</h1>
            <p className="text-sm text-slate-500">
              {loading ? "Loading…" : `${myRequests.length} request${myRequests.length !== 1 ? "s" : ""} submitted`}
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
      {myRequests.length > 0 && !loading && (
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

      {/* ── My Requests table ── */}
      {loading ? (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 py-24">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-white shadow-sm">
            <RefreshCw className="size-6 animate-spin text-indigo-400" />
          </div>
          <p className="text-sm font-medium text-slate-500">Loading your requests…</p>
        </div>
      ) : myRequests.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-5 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 py-24 text-center px-8">
          <div className="flex size-20 items-center justify-center rounded-3xl bg-white shadow-sm">
            <FileText className="size-10 text-slate-300" />
          </div>
          <div>
            <p className="text-lg font-bold text-slate-700">No requests yet</p>
            <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-slate-400">
              Submit a business problem to get started.
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <RequestsTable
            requests={myRequests}
            onDetails={handleDetails}
            onDiscussion={handleDiscussion}
            onReassign={handleReassign}
            onAttach={handleAttach}
          />
          <div className="border-t border-slate-100 bg-slate-50 px-5 py-2.5">
            <p className="text-xs font-medium text-slate-400">
              {myRequests.length} request{myRequests.length !== 1 ? "s" : ""} total
            </p>
          </div>
        </div>
      )}

      {/* ── Shared with me ── */}
      {sharedRequests.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Users className="size-4 text-slate-400" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">
              Shared with you by BA
            </h2>
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-600">
              {sharedRequests.length}
            </span>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <RequestsTable
              requests={sharedRequests}
              onDetails={handleDetails}
              onDiscussion={handleDiscussion}
              showSubmitter
            />
            <div className="border-t border-slate-100 bg-slate-50 px-5 py-2.5">
              <p className="text-xs font-medium text-slate-400">
                {sharedRequests.length} shared request{sharedRequests.length !== 1 ? "s" : ""} total
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Details modal */}
      <DetailsModal
        request={selectedRequest}
        isOpen={detailsOpen}
        onClose={() => setDetailsOpen(false)}
        onAttach={handleAttachFromDetails}
      />

      {/* Attach files modal */}
      <AddAttachmentModal
        request={attachRequest}
        isOpen={attachOpen}
        onClose={() => setAttachOpen(false)}
        onUploaded={handleRefresh}
      />

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
