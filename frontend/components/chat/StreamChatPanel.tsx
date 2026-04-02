"use client";

import { useEffect, useState, useCallback, createContext, useContext } from "react";
import { useRouter } from "next/navigation";
import type { Channel as StreamChannel } from "stream-chat";
import {
  Chat,
  Channel,
  Window,
  MessageList,
  MessageInput,
  Thread,
  MessageSimple,
  Attachment,
  useMessageContext,
} from "stream-chat-react";
import "stream-chat-react/dist/css/v2/index.css";
import "./stream-overrides.css";
import { getStreamClient, fetchStreamToken } from "@/lib/streamClient";
import { VideoMeetingModal } from "./VideoMeetingModal";
import { MemberManagementPanel } from "./MemberManagementPanel";
import { BrdReviewCard } from "./BrdReviewCard";
import {
  ArrowLeft, Video, Users, Loader2, MessageSquare, AlertCircle,
  Bookmark, BookmarkCheck, Sparkles, X, ChevronRight,
  CheckCircle2, XCircle, ClipboardList, ShieldAlert, Zap,
  Tag, BarChart3, Copy, Check, FileText, ExternalLink,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5001";

const priorityConfig: Record<string, { dot: string; text: string; bg: string; border: string }> = {
  Low:      { dot: "bg-emerald-400", text: "text-emerald-700", bg: "bg-emerald-50",  border: "border-emerald-200" },
  Medium:   { dot: "bg-amber-400",   text: "text-amber-700",   bg: "bg-amber-50",    border: "border-amber-200" },
  High:     { dot: "bg-orange-500",  text: "text-orange-700",  bg: "bg-orange-50",   border: "border-orange-200" },
  Critical: { dot: "bg-rose-500",    text: "text-rose-700",    bg: "bg-rose-50",     border: "border-rose-200" },
};

interface RequestInfo {
  id: number;
  req_number: string;
  title: string;
  priority: string;
  status: string;
}

interface CurrentUser {
  id: number;
  email: string;
  name: string;
  role: string;
}

interface ImportantMessage {
  stream_message_id: string;
  message_text: string;
  sender_name: string;
  marked_at: string;
}

interface ReadinessCheck { label: string; pass: boolean; }
interface BrdReadiness { checks: ReadinessCheck[]; score: number; readinessLevel: string; }

interface Analysis {
  generated_at: string;
  ai_model?: string;
  request: { title: string; category: string; priority: string; status: string };
  executive_summary: string;
  key_requirements: string[];
  stakeholder_concerns: string[];
  action_items: string[];
  keywords: string[];
  brd_readiness: BrdReadiness;
  message_count: number;
}

interface Props {
  request: RequestInfo;
  currentUser: CurrentUser;
  onBack?: () => void;
}

// ── Context ───────────────────────────────────────────────────────────────────
const ImportantCtx = createContext<{
  importantIds: Set<string>;
  toggle: (id: string, text: string, sender: string) => void;
  isBA: boolean;
}>({ importantIds: new Set(), toggle: () => {}, isBA: false });

// Provides currentUser to BrdReviewCard rendered inside Stream Chat attachments
const ChatUserCtx = createContext<CurrentUser | null>(null);

type BrdAttachmentPayload = { brd_id: number; doc_id: string; title: string; version: string; request_id: number };

// Custom attachment renderer — intercepts BRD review cards, delegates rest to Stream default
function CustomAttachment(props: Parameters<typeof Attachment>[0]) {
  const currentUser = useContext(ChatUserCtx);
  const brdAtt = (props.attachments ?? []).find((a) => (a as { type?: string }).type === "brd_review") as
    | (BrdAttachmentPayload & { type: string })
    | undefined;
  if (brdAtt && currentUser) {
    return <BrdReviewCard attachment={brdAtt} currentUser={currentUser} />;
  }
  return <Attachment {...props} />;
}

// ── Custom message — bookmark for BA only ─────────────────────────────────────
function CustomMessage() {
  const { message } = useMessageContext();
  const { importantIds, toggle, isBA } = useContext(ImportantCtx);
  const isImportant = importantIds.has(message.id ?? "");

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!message.id) return;
    const text = typeof message.text === "string" ? message.text : "";
    const sender = message.user?.name || message.user?.id || "";
    toggle(message.id, text, sender);
  };

  return (
    <div className="group relative">
      <MessageSimple />
      {isBA && message.id && (
        <button
          onClick={handleToggle}
          title={isImportant ? "Remove from key points" : "Mark as key point"}
          className={`absolute right-2 top-1 z-10 rounded-lg p-1.5 transition-all duration-150 ${
            isImportant
              ? "opacity-100 bg-amber-50 text-amber-500 shadow-sm shadow-amber-100"
              : "opacity-0 group-hover:opacity-100 bg-white/90 text-slate-300 hover:text-amber-500 hover:bg-amber-50 shadow-sm"
          }`}
        >
          {isImportant
            ? <BookmarkCheck className="size-3.5 fill-amber-200 stroke-amber-500" />
            : <Bookmark className="size-3.5" />
          }
        </button>
      )}
      {!isBA && isImportant && (
        <span className="absolute right-2 top-1 z-10 rounded-lg bg-amber-50 p-1.5">
          <BookmarkCheck className="size-3.5 fill-amber-200 stroke-amber-500" />
        </span>
      )}
    </div>
  );
}

// ── Analysis Result Modal ─────────────────────────────────────────────────────
function AnalysisModal({
  analysis,
  onClose,
  onGenerateBrd,
  generatingBrd,
  brdSuccess,
  isBA,
}: {
  analysis: Analysis;
  onClose: () => void;
  onGenerateBrd?: () => void;
  generatingBrd?: boolean;
  brdSuccess?: boolean;
  isBA?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const copyToClipboard = () => {
    const text = [
      `BRD Key Conversation Analysis — ${analysis.request.title}`,
      `Generated: ${new Date(analysis.generated_at).toLocaleString()}`,
      "",
      "EXECUTIVE SUMMARY",
      analysis.executive_summary,
      "",
      "KEY REQUIREMENTS",
      ...analysis.key_requirements.map((r, i) => `${i + 1}. ${r}`),
      "",
      "STAKEHOLDER CONCERNS",
      ...(analysis.stakeholder_concerns.length
        ? analysis.stakeholder_concerns.map((c, i) => `${i + 1}. ${c}`)
        : ["None identified"]),
      "",
      "ACTION ITEMS",
      ...(analysis.action_items.length
        ? analysis.action_items.map((a, i) => `${i + 1}. ${a}`)
        : ["None identified"]),
      "",
      "KEY TOPICS",
      analysis.keywords.join(", "),
      "",
      "BRD READINESS",
      analysis.brd_readiness.readinessLevel,
      ...analysis.brd_readiness.checks.map(c => `${c.pass ? "✓" : "✗"} ${c.label}`),
    ].join("\n");

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const { checks, score, readinessLevel } = analysis.brd_readiness;
  const readinessColor =
    score >= 5 ? "text-emerald-600" : score >= 3 ? "text-amber-600" : "text-rose-600";
  const readinessBg =
    score >= 5 ? "bg-emerald-50 border-emerald-200" : score >= 3 ? "bg-amber-50 border-amber-200" : "bg-rose-50 border-rose-200";

  return (
    <div className="absolute inset-0 z-30 flex flex-col bg-white">
      {/* Accent */}
      <div className="h-0.5 w-full bg-gradient-to-r from-indigo-500 via-violet-500 to-amber-400 shrink-0" />

      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-md shadow-indigo-200">
            <Sparkles className="size-5 text-white" />
          </div>
          <div>
            <p className="text-base font-bold text-slate-800">Key Conversation Analysis</p>
            <p className="text-[11px] text-slate-400">
              Based on {analysis.message_count} marked message{analysis.message_count !== 1 ? "s" : ""} ·{" "}
              {new Date(analysis.generated_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              {analysis.ai_model && (
                <span className="ml-2 rounded-full bg-violet-50 border border-violet-200 px-1.5 py-0.5 text-[10px] font-medium text-violet-600">
                  AI: {analysis.ai_model.replace("Xenova/", "")}
                </span>
              )}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={copyToClipboard}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 transition-all hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700"
          >
            {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
            {copied ? "Copied!" : "Copy"}
          </button>
          <button
            onClick={onClose}
            className="flex size-9 items-center justify-center rounded-xl border border-slate-200 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-5">

        {/* Executive Summary */}
        <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-violet-50 p-5">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="size-4 text-indigo-500" />
            <p className="text-xs font-bold uppercase tracking-widest text-indigo-600">Executive Summary</p>
          </div>
          <p className="text-sm leading-relaxed text-slate-700">{analysis.executive_summary}</p>
        </div>

        {/* Requirements + Concerns grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

          {/* Key Requirements */}
          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <ClipboardList className="size-4 text-emerald-500" />
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Key Requirements</p>
            </div>
            {analysis.key_requirements.length ? (
              <ul className="space-y-2">
                {analysis.key_requirements.map((r, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-[9px] font-bold text-emerald-600">
                      {i + 1}
                    </span>
                    <span className="text-xs leading-relaxed text-slate-700">{r}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-400 italic">No specific requirements identified</p>
            )}
          </div>

          {/* Stakeholder Concerns */}
          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <ShieldAlert className="size-4 text-amber-500" />
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Concerns & Risks</p>
            </div>
            {analysis.stakeholder_concerns.length ? (
              <ul className="space-y-2">
                {analysis.stakeholder_concerns.map((c, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[9px] font-bold text-amber-600">
                      {i + 1}
                    </span>
                    <span className="text-xs leading-relaxed text-slate-700">{c}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-slate-400 italic">No concerns identified</p>
            )}
          </div>
        </div>

        {/* Action Items */}
        {analysis.action_items.length > 0 && (
          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="size-4 text-indigo-500" />
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Action Items</p>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {analysis.action_items.map((a, i) => (
                <div key={i} className="flex items-start gap-2 rounded-xl border border-indigo-100 bg-indigo-50/50 px-3 py-2">
                  <ChevronRight className="mt-0.5 size-3.5 shrink-0 text-indigo-400" />
                  <span className="text-xs leading-relaxed text-slate-700">{a}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Keywords + BRD Readiness side-by-side */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

          {/* Keywords */}
          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-3">
              <Tag className="size-4 text-violet-500" />
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Key Topics</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {analysis.keywords.map((kw) => (
                <span key={kw} className="rounded-full border border-violet-100 bg-violet-50 px-2.5 py-1 text-[11px] font-semibold text-violet-700">
                  {kw}
                </span>
              ))}
            </div>
          </div>

          {/* BRD Readiness */}
          <div className={`rounded-2xl border p-4 shadow-sm ${readinessBg}`}>
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className={`size-4 ${readinessColor}`} />
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">BRD Readiness</p>
            </div>
            <p className={`mb-3 text-sm font-bold ${readinessColor}`}>{readinessLevel}</p>
            <ul className="space-y-1.5">
              {checks.map((c) => (
                <li key={c.label} className="flex items-center gap-2">
                  {c.pass
                    ? <CheckCircle2 className="size-3.5 shrink-0 text-emerald-500" />
                    : <XCircle className="size-3.5 shrink-0 text-slate-300" />
                  }
                  <span className={`text-xs ${c.pass ? "text-slate-700" : "text-slate-400"}`}>{c.label}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* Footer — Generate BRD */}
      {isBA && (
        <div className="shrink-0 border-t border-slate-100 px-6 py-4 bg-slate-50/60">
          {brdSuccess ? (
            <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="size-4 text-emerald-600" />
                <span className="text-sm font-medium text-emerald-700">BRD Draft created successfully!</span>
              </div>
              <a
                href="/ba/brd-management"
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors"
              >
                View BRD <ExternalLink className="size-3" />
              </a>
            </div>
          ) : (
            <button
              onClick={onGenerateBrd}
              disabled={generatingBrd}
              className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-indigo-200 transition-all hover:shadow-lg hover:shadow-indigo-300 hover:from-violet-500 hover:via-indigo-500 hover:to-blue-500 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {generatingBrd ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Building BRD with AI…
                </>
              ) : (
                <>
                  <FileText className="size-4" />
                  Generate Draft BRD Document
                  <ChevronRight className="size-4 opacity-70" />
                </>
              )}
            </button>
          )}
          {!brdSuccess && (
            <p className="mt-2 text-center text-[10px] text-slate-400">
              AI will generate a full structured BRD from these key points
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ── Key Points panel ──────────────────────────────────────────────────────────
function KeyPointsPanel({
  messages,
  isBA,
  generating,
  onGenerate,
  onClose,
}: {
  messages: ImportantMessage[];
  isBA: boolean;
  generating: boolean;
  onGenerate: () => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute inset-y-0 right-0 z-20 flex w-[340px] flex-col bg-white shadow-2xl">
      <div className="h-0.5 w-full bg-gradient-to-r from-amber-400 via-orange-400 to-amber-300 shrink-0" />

      <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-400 shadow-sm shadow-amber-200">
            <Sparkles className="size-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">Key Points</p>
            <p className="text-[11px] text-slate-400">
              {messages.length} {messages.length === 1 ? "point" : "points"} marked
            </p>
          </div>
        </div>
        <button onClick={onClose} className="flex size-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
          <X className="size-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-center px-4">
            <div className="mb-4 flex size-14 items-center justify-center rounded-2xl border-2 border-dashed border-slate-200">
              <Bookmark className="size-6 text-slate-300" />
            </div>
            <p className="text-sm font-semibold text-slate-500">No key points yet</p>
            {isBA ? (
              <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
                Hover over any message and click the bookmark icon to mark it as a key point.
              </p>
            ) : (
              <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
                Key points marked by the BA will appear here.
              </p>
            )}
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={msg.stream_message_id} className="group rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 hover:border-amber-200 hover:bg-amber-50/50 transition-colors">
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[10px] font-bold text-amber-600">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs leading-relaxed text-slate-700">{msg.message_text}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[10px] font-semibold text-slate-500">{msg.sender_name}</span>
                    <span className="text-[10px] text-slate-300">·</span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(msg.marked_at).toLocaleDateString([], { month: "short", day: "numeric" })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="shrink-0 border-t border-slate-100 p-4 space-y-2">
        {isBA && (
          <button
            onClick={onGenerate}
            disabled={messages.length === 0 || generating}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 text-sm font-semibold text-white shadow-sm shadow-indigo-200 transition-all hover:from-indigo-500 hover:to-violet-500 hover:shadow-md hover:shadow-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Analysing…
              </>
            ) : (
              <>
                <Sparkles className="size-4" />
                Generate Key Conversation Points
                <ChevronRight className="size-4 opacity-70" />
              </>
            )}
          </button>
        )}
        <p className="text-center text-[10px] text-slate-400">
          {isBA ? "Analyses marked messages to extract BRD-ready insights" : "Only the BA can generate the analysis"}
        </p>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export function StreamChatPanel({ request, currentUser, onBack }: Props) {
  const router = useRouter();
  const [channel, setChannel] = useState<StreamChannel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [meetingUrl, setMeetingUrl] = useState<string | null>(null);
  const [loadingMeeting, setLoadingMeeting] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [showKeyPoints, setShowKeyPoints] = useState(false);
  const [importantMessages, setImportantMessages] = useState<ImportantMessage[]>([]);
  const [generating, setGenerating] = useState(false);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [generatingBrd, setGeneratingBrd] = useState(false);
  const [brdSuccess, setBrdSuccess] = useState(false);

  const isBA = currentUser.role === "ba";
  const importantIds = new Set(importantMessages.map((m) => m.stream_message_id));
  const pc = priorityConfig[request.priority] ?? priorityConfig.Medium;

  const fetchImportant = useCallback(async () => {
    try {
      const token = localStorage.getItem("authToken");
      const res = await fetch(`${API}/api/stream/channels/${request.id}/important`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.messages) setImportantMessages(data.messages);
    } catch { /* non-critical */ }
  }, [request.id]);

  const toggleImportant = useCallback(async (msgId: string, text: string, sender: string) => {
    if (!isBA) return;
    const token = localStorage.getItem("authToken");
    if (importantIds.has(msgId)) {
      setImportantMessages((prev) => prev.filter((m) => m.stream_message_id !== msgId));
      await fetch(`${API}/api/stream/channels/${request.id}/important/${encodeURIComponent(msgId)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
    } else {
      setImportantMessages((prev) => [...prev, {
        stream_message_id: msgId,
        message_text: text,
        sender_name: sender,
        marked_at: new Date().toISOString(),
      }]);
      await fetch(`${API}/api/stream/channels/${request.id}/important`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ streamMessageId: msgId, messageText: text, senderName: sender }),
      });
    }
  }, [request.id, importantIds, isBA]);

  const generateAnalysis = useCallback(async () => {
    if (!isBA) return;
    setGenerating(true);
    try {
      const token = localStorage.getItem("authToken");
      const res = await fetch(`${API}/api/stream/channels/${request.id}/generate-key-points`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.error) {
        alert(data.error);
        return;
      }
      setAnalysis(data);
      setShowKeyPoints(false);
    } finally {
      setGenerating(false);
    }
  }, [request.id, isBA]);

  const generateDraftBRD = useCallback(async () => {
    if (!isBA || !analysis) return;
    setGeneratingBrd(true);
    setBrdSuccess(false);
    try {
      const token = localStorage.getItem("authToken");
      const res = await fetch(`${API}/api/stream/channels/${request.id}/generate-brd`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ analysis }),
      });
      if (!res.ok) {
        const err = await res.json();
        alert(`BRD generation failed: ${err.message || "Unknown error"}`);
        return;
      }
      setBrdSuccess(true);
    } finally {
      setGeneratingBrd(false);
    }
  }, [request.id, isBA, analysis]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const { token, userId } = await fetchStreamToken();
        const client = getStreamClient();
        if (!client.userID) {
          await client.connectUser({ id: userId, name: currentUser.name || currentUser.email }, token);
        }
        if (isBA) {
          const authToken = localStorage.getItem("authToken");
          await fetch(`${API}/api/stream/channels/${request.id}`, {
            method: "POST",
            headers: { Authorization: `Bearer ${authToken}` },
          });
        }
        const ch = client.channel("messaging", `request-${request.id}`);
        await ch.watch();
        if (!cancelled) { setChannel(ch); setLoading(false); fetchImportant(); }
      } catch (err: unknown) {
        if (!cancelled) {
          const msg = err instanceof Error ? err.message : String(err);
          setError(
            msg.includes("Channel not found") || msg.includes("not a member")
              ? "This channel hasn't been set up yet. The assigned BA will initialise it when they open the discussion."
              : "Failed to connect to chat. Please refresh and try again."
          );
          setLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
      channel?.stopWatching().catch(() => {});
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request.id, currentUser.id]);

  const startMeeting = useCallback(async () => {
    setLoadingMeeting(true);
    try {
      const authToken = localStorage.getItem("authToken");
      const res = await fetch(`${API}/api/stream/daily/rooms`, {
        method: "POST",
        headers: { Authorization: `Bearer ${authToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({ requestId: request.id }),
      });
      const { url } = await res.json();
      setMeetingUrl(url);
    } finally { setLoadingMeeting(false); }
  }, [request.id]);

  return (
    <ChatUserCtx.Provider value={currentUser}>
    <ImportantCtx.Provider value={{ importantIds, toggle: toggleImportant, isBA }}>
      <div className="relative flex h-full flex-col bg-white">

        {/* ── Header ── */}
        <div className="shrink-0 border-b border-slate-100 bg-white">
          <div className="h-0.5 bg-gradient-to-r from-indigo-500 via-violet-500 to-indigo-400" />
          <div className="flex items-center gap-4 px-5 py-4">
            {onBack && (
              <button onClick={onBack} className="flex size-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-all hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-600">
                <ArrowLeft className="size-4" />
              </button>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-mono text-xs font-semibold text-indigo-400">{request.req_number}</span>
                <span className="text-slate-300">·</span>
                <p className="text-sm font-semibold text-slate-800 truncate">{request.title}</p>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <span className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${pc.text} ${pc.bg} ${pc.border}`}>
                  <span className={`size-1.5 rounded-full ${pc.dot}`} />
                  {request.priority}
                </span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-medium text-slate-500">
                  {request.status}
                </span>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={() => { setShowKeyPoints(v => !v); setShowMembers(false); setAnalysis(null); }}
                className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-semibold transition-all ${
                  showKeyPoints
                    ? "border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50 text-amber-700 shadow-sm shadow-amber-100"
                    : "border-slate-200 bg-white text-slate-600 hover:border-amber-200 hover:bg-amber-50 hover:text-amber-700"
                }`}
              >
                <Sparkles className={`size-4 ${showKeyPoints ? "text-amber-500" : "text-slate-400"}`} />
                Key Points
                {importantMessages.length > 0 && (
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${showKeyPoints ? "bg-amber-200 text-amber-700" : "bg-slate-100 text-slate-500"}`}>
                    {importantMessages.length}
                  </span>
                )}
              </button>
              {isBA && (
                <button
                  onClick={() => { setShowMembers(v => !v); setShowKeyPoints(false); }}
                  className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-semibold transition-all ${
                    showMembers
                      ? "border-violet-300 bg-gradient-to-br from-violet-50 to-purple-50 text-violet-700 shadow-sm shadow-violet-100"
                      : "border-slate-200 bg-white text-slate-600 hover:border-violet-200 hover:bg-violet-50 hover:text-violet-700"
                  }`}
                >
                  <Users className={`size-4 ${showMembers ? "text-violet-500" : "text-slate-400"}`} />
                  Members
                </button>
              )}
              <button
                onClick={startMeeting}
                disabled={loadingMeeting}
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-600 transition-all hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 disabled:opacity-50"
              >
                {loadingMeeting ? <Loader2 className="size-4 animate-spin text-indigo-400" /> : <Video className="size-4 text-indigo-400" />}
                {loadingMeeting ? "Starting…" : "Video Call"}
              </button>
            </div>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="relative flex min-h-0 flex-1 overflow-hidden">
          {loading ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3">
              <div className="flex size-14 items-center justify-center rounded-2xl bg-indigo-50">
                <Loader2 className="size-6 animate-spin text-indigo-500" />
              </div>
              <p className="text-sm font-medium text-slate-500">Connecting to chat…</p>
            </div>
          ) : error ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 px-8 text-center">
              <div className="flex size-14 items-center justify-center rounded-2xl border border-slate-100 bg-slate-50">
                {error.includes("set up") ? <MessageSquare className="size-6 text-slate-300" /> : <AlertCircle className="size-6 text-rose-400" />}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">Chat unavailable</p>
                <p className="mt-1 text-xs text-slate-400">{error}</p>
              </div>
            </div>
          ) : channel ? (
            <div className="absolute inset-0 bg-slate-50/30">
              <Chat client={getStreamClient()} theme="str-chat__theme-light">
                <Channel channel={channel} Message={CustomMessage} Attachment={CustomAttachment}>
                  <Window>
                    <MessageList />
                    <MessageInput focus />
                  </Window>
                  <Thread />
                </Channel>
              </Chat>
            </div>
          ) : null}

          {/* Analysis result — full overlay */}
          {analysis && (
            <AnalysisModal
              analysis={analysis}
              onClose={() => { setAnalysis(null); setBrdSuccess(false); }}
              onGenerateBrd={generateDraftBRD}
              generatingBrd={generatingBrd}
              brdSuccess={brdSuccess}
              isBA={isBA}
            />
          )}

          {/* Key Points panel */}
          {showKeyPoints && !analysis && (
            <KeyPointsPanel
              messages={importantMessages}
              isBA={isBA}
              generating={generating}
              onGenerate={generateAnalysis}
              onClose={() => setShowKeyPoints(false)}
            />
          )}

          {/* Members panel */}
          {showMembers && isBA && (
            <MemberManagementPanel requestId={request.id} onClose={() => setShowMembers(false)} />
          )}
        </div>

        {meetingUrl && <VideoMeetingModal roomUrl={meetingUrl} onClose={() => setMeetingUrl(null)} />}
      </div>
    </ImportantCtx.Provider>
    </ChatUserCtx.Provider>
  );
}
