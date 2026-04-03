"use client";

import { useEffect, useState, useCallback } from "react";
import {
  FileText, CheckCircle2, XCircle, Clock, MessageSquare,
  ThumbsUp, AlertCircle, Loader2, ChevronRight, Sparkles,
  ExternalLink, RefreshCw, Printer,
} from "lucide-react";
import { openPdf, type BrdDoc } from "@/lib/brdPdf";

const API = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5001";

interface BrdAttachment {
  brd_id: number;
  doc_id: string;
  title: string;
  version: string;
  request_id: number;
}

interface ReviewItem {
  id: number;
  reviewer_id: number;
  reviewer_name: string;
  status: "pending" | "approved" | "changes_requested";
  comment: string | null;
  reviewed_at: string;
}

interface CurrentUser {
  id: number;
  name: string;
  email: string;
  role: string;
}

interface Props {
  attachment: BrdAttachment;
  currentUser: CurrentUser;
}

export function BrdReviewCard({ attachment, currentUser }: Props) {
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [openingPdf, setOpeningPdf] = useState(false);
  const [comment, setComment] = useState("");
  const [myAction, setMyAction] = useState<"approve" | "changes" | null>(null);

  const isBA = currentUser.role === "ba";

  const fetchReviews = useCallback(async () => {
    try {
      const token = localStorage.getItem("authToken");
      const res = await fetch(`${API}/api/stream/brd-documents/${attachment.brd_id}/reviews`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setReviews(data.reviews || []);
      }
    } finally {
      setLoading(false);
    }
  }, [attachment.brd_id]);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);

  const myReview = reviews.find((r) => r.reviewer_id === currentUser.id);
  const approved = reviews.filter((r) => r.status === "approved").length;
  const changesRequested = reviews.filter((r) => r.status === "changes_requested");
  const total = reviews.length;
  const allApproved = total > 0 && approved === total;

  const submitReview = async (status: "approved" | "changes_requested") => {
    if (status === "changes_requested" && !comment.trim()) return;
    setSubmitting(true);
    try {
      const token = localStorage.getItem("authToken");
      await fetch(`${API}/api/stream/brd-documents/${attachment.brd_id}/review`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ status, comment: status === "changes_requested" ? comment.trim() : null }),
      });
      setMyAction(null);
      setComment("");
      fetchReviews();
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenPdf = async () => {
    setOpeningPdf(true);
    try {
      const token = localStorage.getItem("authToken");
      const res = await fetch(`${API}/api/stream/brd-documents/${attachment.brd_id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) { alert("Could not load BRD document."); return; }
      const doc: BrdDoc = await res.json();
      openPdf(doc);
    } finally {
      setOpeningPdf(false);
    }
  };

  const enhanceBrd = async () => {
    setEnhancing(true);
    try {
      const token = localStorage.getItem("authToken");
      const res = await fetch(`${API}/api/stream/brd-documents/${attachment.brd_id}/enhance`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json();
        alert(`Enhancement failed: ${err.message}`);
      } else {
        fetchReviews();
      }
    } finally {
      setEnhancing(false);
    }
  };

  const progressPct = total > 0 ? Math.round((approved / total) * 100) : 0;

  return (
    <div className="my-2 w-full max-w-md rounded-2xl border border-indigo-100 bg-white shadow-md overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 border-b border-indigo-50 bg-gradient-to-r from-indigo-50 to-violet-50 px-4 py-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-sm shadow-indigo-200">
          <FileText className="size-4 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-slate-800">{attachment.title}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="font-mono text-[10px] font-semibold text-indigo-500">{attachment.doc_id}</span>
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-600">
              v{attachment.version}
            </span>
            {allApproved && (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-600">
                ✓ Approved
              </span>
            )}
          </div>
        </div>
        <button
          onClick={handleOpenPdf}
          disabled={openingPdf}
          title="Open BRD as PDF"
          className="flex size-7 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-violet-100 hover:text-violet-600 transition-colors disabled:opacity-50"
        >
          {openingPdf ? <Loader2 className="size-3.5 animate-spin" /> : <Printer className="size-3.5" />}
        </button>
        {isBA && (
          <a
            href="/ba/brd-management"
            target="_blank"
            rel="noreferrer"
            title="View in BRD Management"
            className="flex size-7 shrink-0 items-center justify-center rounded-lg text-slate-400 hover:bg-indigo-100 hover:text-indigo-600 transition-colors"
          >
            <ExternalLink className="size-3.5" />
          </a>
        )}
      </div>

      {/* Review progress */}
      <div className="px-4 pt-3 pb-2">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Stakeholder Reviews
          </span>
          <button
            onClick={fetchReviews}
            className="flex size-5 items-center justify-center rounded text-slate-300 hover:text-slate-500 transition-colors"
          >
            <RefreshCw className="size-3" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-3 text-slate-400">
            <Loader2 className="size-3.5 animate-spin" />
            <span className="text-xs">Loading reviews…</span>
          </div>
        ) : total === 0 ? (
          <p className="py-2 text-xs text-slate-400">No reviewers assigned yet.</p>
        ) : (
          <>
            {/* Progress bar */}
            <div className="mb-3">
              <div className="mb-1.5 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600">
                  {approved}/{total} approved
                </span>
                <span className="text-[11px] text-slate-400">{progressPct}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    allApproved ? "bg-emerald-500" : "bg-indigo-500"
                  }`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>

            {/* Per-reviewer chips */}
            <div className="flex flex-col gap-1.5">
              {reviews.map((r) => (
                <div key={r.id} className="flex items-start gap-2.5 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                  <span className="mt-0.5 shrink-0">
                    {r.status === "approved" ? (
                      <CheckCircle2 className="size-3.5 text-emerald-500" />
                    ) : r.status === "changes_requested" ? (
                      <XCircle className="size-3.5 text-rose-500" />
                    ) : (
                      <Clock className="size-3.5 text-amber-400" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-slate-700">{r.reviewer_name}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        r.status === "approved"
                          ? "bg-emerald-100 text-emerald-600"
                          : r.status === "changes_requested"
                          ? "bg-rose-100 text-rose-600"
                          : "bg-amber-50 text-amber-600"
                      }`}>
                        {r.status === "approved" ? "Approved" : r.status === "changes_requested" ? "Changes Requested" : "Pending"}
                      </span>
                    </div>
                    {r.comment && (
                      <p className="mt-1 text-[11px] leading-relaxed text-slate-500 italic">"{r.comment}"</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Action area */}
      <div className="border-t border-slate-100 px-4 py-3">
        {/* BA view — show enhancement button if there are change requests */}
        {isBA && changesRequested.length > 0 && (
          <button
            onClick={enhanceBrd}
            disabled={enhancing}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm shadow-indigo-200 hover:from-violet-500 hover:to-indigo-500 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {enhancing ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                AI enhancing BRD…
              </>
            ) : (
              <>
                <Sparkles className="size-3.5" />
                Enhance BRD with {changesRequested.length} feedback{changesRequested.length > 1 ? "s" : ""}
                <ChevronRight className="size-3.5 opacity-70" />
              </>
            )}
          </button>
        )}

        {isBA && allApproved && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
            <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
            <span className="text-xs font-semibold text-emerald-700">All stakeholders approved — BRD is finalised!</span>
          </div>
        )}

        {isBA && !allApproved && changesRequested.length === 0 && total > 0 && (
          <p className="text-center text-[11px] text-slate-400">
            Waiting for {total - approved} stakeholder{total - approved !== 1 ? "s" : ""} to review…
          </p>
        )}

        {/* Stakeholder view — approve or request changes */}
        {!isBA && !allApproved && (
          <>
            {myReview && myReview.status !== "pending" ? (
              <div>
                <div className={`mb-2 flex items-center gap-2 rounded-xl px-3 py-2 ${
                  myReview.status === "approved"
                    ? "bg-emerald-50 border border-emerald-200"
                    : "bg-rose-50 border border-rose-200"
                }`}>
                  {myReview.status === "approved"
                    ? <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
                    : <AlertCircle className="size-4 shrink-0 text-rose-500" />
                  }
                  <span className={`text-xs font-semibold ${myReview.status === "approved" ? "text-emerald-700" : "text-rose-700"}`}>
                    {myReview.status === "approved" ? "You approved this BRD" : "You requested changes"}
                  </span>
                </div>
                {/* Allow changing review */}
                <button
                  onClick={() => setMyAction(myAction ? null : myReview.status === "approved" ? "changes" : "approve")}
                  className="text-[11px] text-slate-400 hover:text-slate-600 underline underline-offset-2 transition-colors"
                >
                  Change my review
                </button>
              </div>
            ) : (
              <div>
                {myAction === null && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setMyAction("approve")}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-100 transition-colors"
                    >
                      <ThumbsUp className="size-3.5" />
                      Approve
                    </button>
                    <button
                      onClick={() => setMyAction("changes")}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100 transition-colors"
                    >
                      <MessageSquare className="size-3.5" />
                      Request Changes
                    </button>
                  </div>
                )}

                {myAction === "approve" && (
                  <div className="space-y-2">
                    <p className="text-xs text-slate-500">Confirm you approve this BRD as-is?</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => submitReview("approved")}
                        disabled={submitting}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-60 transition-colors"
                      >
                        {submitting ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
                        Confirm Approval
                      </button>
                      <button onClick={() => setMyAction(null)} className="rounded-xl border border-slate-200 px-3 text-xs text-slate-500 hover:bg-slate-50 transition-colors">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {myAction === "changes" && (
                  <div className="space-y-2">
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Describe what needs to be changed or improved…"
                      rows={3}
                      className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700 placeholder-slate-400 focus:border-rose-300 focus:outline-none focus:ring-1 focus:ring-rose-200"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => submitReview("changes_requested")}
                        disabled={submitting || !comment.trim()}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-rose-600 py-2 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-60 transition-colors"
                      >
                        {submitting ? <Loader2 className="size-3.5 animate-spin" /> : <AlertCircle className="size-3.5" />}
                        Submit Feedback
                      </button>
                      <button onClick={() => { setMyAction(null); setComment(""); }} className="rounded-xl border border-slate-200 px-3 text-xs text-slate-500 hover:bg-slate-50 transition-colors">
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {!isBA && allApproved && (
          <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
            <CheckCircle2 className="size-4 shrink-0 text-emerald-600" />
            <span className="text-xs font-semibold text-emerald-700">BRD approved by all stakeholders</span>
          </div>
        )}
      </div>
    </div>
  );
}
