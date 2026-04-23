"use client";

import { useEffect, useRef, useState, useCallback, createContext, useContext } from "react";
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
  useChannelActionContext,
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
  AlertTriangle, GitBranch, Pencil, Save, RefreshCw,
  MoreHorizontal, CornerUpLeft, Trash2, ScanSearch,
  TrendingUp, List, Shield, Database, Link2, Quote,
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
  marked_by_name?: string;
  marked_by_email?: string;
}

interface DocRequirement {
  requirement: string;
  type?: string;
  priority_hint?: string;
  verbatim_source?: string;
}
interface DocBusinessRule { rule: string; verbatim_source?: string; }
interface DocProcessStep { step_number?: number; step: string; actor?: string; system?: string; outcome?: string; }
interface DocDataRequirement { field: string; description?: string; format?: string; constraints?: string; }
interface DocIntegration { system: string; direction?: string; description?: string; technical_details?: string; }
interface DocQuantData { metric: string; value: string; context?: string; }
interface DocStakeholder { name_or_role: string; involvement?: string; }

interface DocumentAnalysisResult {
  document_types?: string[];
  document_summary?: string;
  relevance_score?: number;
  problem_statement_in_doc?: string;
  current_state?: string;
  desired_state?: string;
  key_requirements?: DocRequirement[];
  business_rules?: DocBusinessRule[];
  process_steps?: DocProcessStep[];
  data_requirements?: DocDataRequirement[];
  integrations?: DocIntegration[];
  quantitative_data?: DocQuantData[];
  compliance_requirements?: string[];
  stakeholders?: DocStakeholder[];
  technical_specifications?: string[];
  assumptions_in_document?: string[];
  constraints?: string[];
  risks_mentioned?: string[];
  open_questions?: string[];
  key_verbatim_quotes?: string[];
  documents_analyzed?: { name: string; sizeKb: number; mime?: string }[];
  analyzed_at?: string;
  no_documents?: boolean;
  message?: string;
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
  has_documents?: boolean;
}

interface CompletenessResult {
  completeness_score: number;
  readiness: string;
  present: string[];
  missing: string[];
  clarification_questions: string[];
  documents_referenced: boolean;
}

interface WorkflowStep {
  step: number;
  name: string;
  actor: string;
  action: string;
  outcome: string;
  systems_involved: string[];
}

interface ScopeResult {
  scope_id?: number;
  scope_title: string;
  in_scope: string[];
  out_of_scope: string[];
  ambiguities: string[];
  critical_gaps: string[];
  source_references?: string[];
  status?: string;
}

interface WorkflowResult {
  workflow_id?: number;
  workflow_title: string;
  steps: WorkflowStep[];
  status?: string;
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
}>({ importantIds: new Set(), toggle: () => {} });

// Provides currentUser to BrdReviewCard rendered inside Stream Chat attachments
const ChatUserCtx = createContext<CurrentUser | null>(null);

// Rendered by Stream inside .str-chat__message-inner flex row — naturally sits next to the bubble
function CustomMessageOptions() {
  const { message, handleDelete } = useMessageContext();
  const { openThread } = useChannelActionContext();
  const { importantIds, toggle } = useContext(ImportantCtx);
  const currentUser = useContext(ChatUserCtx);
  const isImportant = importantIds.has(message.id ?? "");
  const isOwn = !!currentUser && String(currentUser.id) === message.user?.id;

  if (!message.id) return null;

  const doMarkImportant = () => {
    if (!message.id) return;
    const text = typeof message.text === "string" ? message.text : "";
    const sender = message.user?.name || message.user?.id || "";
    toggle(message.id, text, sender);
  };

  return (
    <div className="opacity-0 group-hover:opacity-100 transition-opacity duration-100 flex items-start pt-1">
      <MessageActionsDropdown
        isImportant={isImportant}
        isOwn={isOwn}
        onMarkImportant={doMarkImportant}
        onReply={() => openThread(message, { preventDefault: () => {} } as React.MouseEvent)}
        onDelete={() => handleDelete?.({ preventDefault: () => {} } as React.MouseEvent)}
      />
    </div>
  );
}

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

// ── Message actions dropdown (three-dots) ────────────────────────────────────
function MessageActionsDropdown({
  isImportant,
  isOwn,
  onMarkImportant,
  onReply,
  onDelete,
}: {
  isImportant: boolean;
  isOwn: boolean;
  onMarkImportant: () => void;
  onReply: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);

  const row = "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-xs font-medium text-left transition-colors";

  return (
    <div ref={wrapRef} className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(v => !v); }}
        title="Message actions"
        className={`flex size-5 items-center justify-center rounded transition-colors ${
          open
            ? "bg-slate-200 text-slate-700"
            : "text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        }`}
      >
        <MoreHorizontal className="size-3" />
      </button>

      {open && (
        <div
          className={`absolute top-full mt-1 z-50 w-44 overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-lg shadow-black/[0.08] ring-1 ring-black/[0.03] p-1 select-none ${
            isOwn ? "left-0" : "right-0"
          }`}
        >
          <button
            onClick={() => { onReply(); setOpen(false); }}
            className={`${row} text-slate-700 hover:bg-slate-100`}
          >
            <CornerUpLeft className="size-3 shrink-0 text-slate-400" />
            Reply
          </button>

          <button
              onClick={() => { onMarkImportant(); setOpen(false); }}
              className={`${row} ${
                isImportant
                  ? "text-amber-700 hover:bg-amber-50"
                  : "text-slate-700 hover:bg-amber-50 hover:text-amber-700"
              }`}
            >
              {isImportant
                ? <BookmarkCheck className="size-3 shrink-0 fill-amber-300 stroke-amber-600" />
                : <Bookmark className="size-3 shrink-0 text-amber-500" />}
              {isImportant ? "Unmark Key Point" : "Mark as Key Point"}
            </button>

          {isOwn && (
            <>
              <div className="my-0.5 mx-1 border-t border-slate-100" />
              <button
                onClick={() => { onDelete(); setOpen(false); }}
                className={`${row} text-rose-600 hover:bg-rose-50`}
              >
                <Trash2 className="size-3 shrink-0" />
                Delete
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Custom message — group wrapper enables group-hover in CustomMessageOptions ──
function CustomMessage() {
  const { message } = useMessageContext();
  const { importantIds } = useContext(ImportantCtx);
  const currentUser = useContext(ChatUserCtx);
  const isImportant = importantIds.has(message.id ?? "");
  const isOwn = !!currentUser && String(currentUser.id) === message.user?.id;

  if (!message.id) return <MessageSimple />;

  return (
    <div className="group relative">
      <MessageSimple />

      {/* Key-point amber badge — always visible when marked */}
      {isImportant && (
        <span
          className={`pointer-events-none absolute top-1 z-10 flex items-center gap-1 rounded-full bg-amber-50 border border-amber-200 px-1.5 py-0.5 shadow-sm ${
            isOwn ? "right-8" : "left-8"
          }`}
        >
          <BookmarkCheck className="size-2.5 fill-amber-300 stroke-amber-600" />
          <span className="text-[9px] font-semibold text-amber-600 leading-none">Key Point</span>
        </span>
      )}
    </div>
  );
}

// ── Document Intelligence Modal ───────────────────────────────────────────────
function DocumentIntelligenceModal({
  result,
  onClose,
  onProceed,
}: {
  result: DocumentAnalysisResult;
  onClose: () => void;
  onProceed: () => void;
}) {
  const score = result.relevance_score ?? 0;
  const scoreColor = score >= 70 ? "text-emerald-600" : score >= 40 ? "text-amber-600" : "text-rose-600";
  const scoreBg    = score >= 70 ? "bg-emerald-50 border-emerald-200" : score >= 40 ? "bg-amber-50 border-amber-200" : "bg-rose-50 border-rose-200";

  const Section = ({ icon, label, children, accent = "indigo" }: { icon: React.ReactNode; label: string; children: React.ReactNode; accent?: string }) => (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <span className={`text-${accent}-500`}>{icon}</span>
        <p className="text-xs font-bold uppercase tracking-widest text-slate-500">{label}</p>
      </div>
      {children}
    </div>
  );

  const Pill = ({ text, color = "slate" }: { text: string; color?: string }) => (
    <span className={`rounded-full border border-${color}-100 bg-${color}-50 px-2.5 py-0.5 text-[11px] font-medium text-${color}-700`}>
      {text}
    </span>
  );

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-white">
      <div className="h-0.5 w-full bg-gradient-to-r from-teal-400 via-emerald-500 to-cyan-400 shrink-0" />

      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-teal-400 to-emerald-600 shadow-md">
            <ScanSearch className="size-5 text-white" />
          </div>
          <div>
            <p className="text-base font-bold text-slate-800">Document Intelligence</p>
            <p className="text-[11px] text-slate-400">
              AI extracted {result.documents_analyzed?.length ?? 0} document{(result.documents_analyzed?.length ?? 0) !== 1 ? "s" : ""} · {(result.key_requirements || []).length} requirements found
            </p>
          </div>
        </div>
        <button onClick={onClose} className="flex size-9 items-center justify-center rounded-xl border border-slate-200 text-slate-400 hover:bg-slate-100">
          <X className="size-4" />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">

        {/* Relevance + doc types */}
        <div className={`rounded-2xl border p-5 ${scoreBg}`}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Document Relevance Score</p>
            <span className={`text-2xl font-black ${scoreColor}`}>{score}/100</span>
          </div>
          <div className="w-full rounded-full bg-slate-200 h-2 mb-3">
            <div className={`h-2 rounded-full ${score >= 70 ? "bg-emerald-500" : score >= 40 ? "bg-amber-500" : "bg-rose-500"}`} style={{ width: `${score}%` }} />
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {(result.document_types || []).map((t, i) => <Pill key={i} text={t} color="teal" />)}
            {(result.documents_analyzed || []).map((d, i) => (
              <span key={i} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] text-slate-500">
                {d.name} ({d.sizeKb}KB)
              </span>
            ))}
          </div>
        </div>

        {/* Summary */}
        {result.document_summary && (
          <div className="rounded-2xl border border-teal-100 bg-gradient-to-br from-teal-50 to-emerald-50 p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-teal-600 mb-2">Document Summary</p>
            <p className="text-sm leading-relaxed text-slate-700">{result.document_summary}</p>
          </div>
        )}

        {/* Current State / Desired State */}
        {(result.current_state || result.desired_state) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {result.current_state && (
              <div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-rose-500 mb-2">Current State (As-Is)</p>
                <p className="text-xs leading-relaxed text-slate-700">{result.current_state}</p>
              </div>
            )}
            {result.desired_state && (
              <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4">
                <p className="text-xs font-bold uppercase tracking-widest text-emerald-600 mb-2">Desired State (To-Be)</p>
                <p className="text-xs leading-relaxed text-slate-700">{result.desired_state}</p>
              </div>
            )}
          </div>
        )}

        {/* Key Requirements */}
        {(result.key_requirements || []).length > 0 && (
          <Section icon={<ClipboardList className="size-4" />} label={`Requirements (${result.key_requirements!.length})`} accent="indigo">
            <ul className="space-y-2">
              {result.key_requirements!.map((r, i) => (
                <li key={i} className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[9px] font-bold text-indigo-600">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-slate-700">{r.requirement}</p>
                      <div className="flex gap-1.5 mt-1 flex-wrap">
                        {r.type && <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold text-slate-500">{r.type}</span>}
                        {r.priority_hint && <span className="rounded-full bg-indigo-50 px-1.5 py-0.5 text-[9px] font-semibold text-indigo-600">{r.priority_hint}</span>}
                      </div>
                      {r.verbatim_source && (
                        <p className="mt-1 text-[10px] italic text-slate-400">"{r.verbatim_source}"</p>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Process Steps */}
        {(result.process_steps || []).length > 0 && (
          <Section icon={<List className="size-4" />} label="Process Flow from Documents" accent="violet">
            <ol className="space-y-2">
              {result.process_steps!.map((s, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[10px] font-bold text-violet-600">{s.step_number ?? i + 1}</span>
                  <div>
                    <p className="text-xs text-slate-700">{s.step}</p>
                    <p className="text-[10px] text-slate-400">{s.actor && `By: ${s.actor}`}{s.system && ` · System: ${s.system}`}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Section>
        )}

        {/* Quantitative Data */}
        {(result.quantitative_data || []).length > 0 && (
          <Section icon={<TrendingUp className="size-4" />} label="Numbers & SLAs" accent="amber">
            <div className="grid gap-2 sm:grid-cols-2">
              {result.quantitative_data!.map((q, i) => (
                <div key={i} className="rounded-xl border border-amber-100 bg-amber-50/50 px-3 py-2">
                  <p className="text-[10px] font-semibold text-amber-700 uppercase">{q.metric}</p>
                  <p className="text-sm font-bold text-slate-800">{q.value}</p>
                  {q.context && <p className="text-[10px] text-slate-500">{q.context}</p>}
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Business Rules */}
        {(result.business_rules || []).length > 0 && (
          <Section icon={<Shield className="size-4" />} label="Business Rules" accent="rose">
            <ul className="space-y-1.5">
              {result.business_rules!.map((r, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-rose-100 text-[9px] font-bold text-rose-600">{i + 1}</span>
                  <span className="text-xs text-slate-700">{r.rule}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Integrations */}
        {(result.integrations || []).length > 0 && (
          <Section icon={<Link2 className="size-4" />} label="Integrations" accent="cyan">
            <ul className="space-y-2">
              {result.integrations!.map((int, i) => (
                <li key={i} className="rounded-xl border border-cyan-100 bg-cyan-50/40 px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-cyan-700">{int.system}</span>
                    {int.direction && <span className="rounded-full bg-cyan-100 px-1.5 py-0.5 text-[9px] font-semibold text-cyan-600">{int.direction}</span>}
                  </div>
                  {int.description && <p className="text-[11px] text-slate-600 mt-0.5">{int.description}</p>}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Compliance */}
        {(result.compliance_requirements || []).length > 0 && (
          <Section icon={<Shield className="size-4" />} label="Compliance & Regulatory" accent="emerald">
            <ul className="space-y-1.5">
              {result.compliance_requirements!.map((c, i) => (
                <li key={i} className="flex items-start gap-2">
                  <CheckCircle2 className="size-3.5 mt-0.5 shrink-0 text-emerald-500" />
                  <span className="text-xs text-slate-700">{c}</span>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Open Questions */}
        {(result.open_questions || []).length > 0 && (
          <Section icon={<AlertTriangle className="size-4" />} label="Open Questions (BA must resolve)" accent="amber">
            <ol className="space-y-1.5">
              {result.open_questions!.map((q, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-amber-100 text-[9px] font-bold text-amber-700">{i + 1}</span>
                  <span className="text-xs text-slate-700">{q}</span>
                </li>
              ))}
            </ol>
          </Section>
        )}

        {/* Key Verbatim Quotes */}
        {(result.key_verbatim_quotes || []).length > 0 && (
          <Section icon={<Quote className="size-4" />} label="Key Verbatim Quotes" accent="violet">
            <ul className="space-y-2">
              {result.key_verbatim_quotes!.map((q, i) => (
                <li key={i} className="rounded-xl border-l-2 border-violet-300 bg-violet-50/50 pl-3 pr-2 py-2">
                  <p className="text-xs italic text-slate-600">"{q}"</p>
                </li>
              ))}
            </ul>
          </Section>
        )}

        {/* Constraints & Risks */}
        {((result.constraints || []).length > 0 || (result.risks_mentioned || []).length > 0) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {(result.constraints || []).length > 0 && (
              <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Constraints</p>
                <ul className="space-y-1.5">
                  {result.constraints!.map((c, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <XCircle className="size-3.5 mt-0.5 shrink-0 text-slate-400" />
                      <span className="text-xs text-slate-700">{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {(result.risks_mentioned || []).length > 0 && (
              <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                <p className="text-xs font-bold uppercase tracking-widest text-rose-500 mb-3">Risks Mentioned</p>
                <ul className="space-y-1.5">
                  {result.risks_mentioned!.map((r, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <AlertTriangle className="size-3.5 mt-0.5 shrink-0 text-rose-400" />
                      <span className="text-xs text-slate-700">{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-slate-100 p-4 flex gap-2">
        <button
          onClick={onClose}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
        >
          <ArrowLeft className="size-3.5" /> Back to Discussion
        </button>
        <button
          onClick={onProceed}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:from-teal-500 hover:to-emerald-500"
        >
          <ChevronRight className="size-4" /> Proceed to Completeness Check
        </button>
      </div>
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
  // Stage 0 — document intelligence
  onAnalyzeDocs,
  analyzingDocs,
  docAnalysis,
  // Staged flow props
  onCheckCompleteness,
  checkingCompleteness,
  completenessResult,
  onGenerateScope,
  generatingScope,
  scopeApproved,
  onGenerateWorkflow,
  generatingWorkflow,
  workflowApproved,
}: {
  analysis: Analysis;
  onClose: () => void;
  onGenerateBrd?: () => void;
  generatingBrd?: boolean;
  brdSuccess?: boolean;
  isBA?: boolean;
  onAnalyzeDocs?: () => void;
  analyzingDocs?: boolean;
  docAnalysis?: DocumentAnalysisResult | null;
  onCheckCompleteness?: () => void;
  checkingCompleteness?: boolean;
  completenessResult?: CompletenessResult | null;
  onGenerateScope?: () => void;
  generatingScope?: boolean;
  scopeApproved?: boolean;
  onGenerateWorkflow?: () => void;
  generatingWorkflow?: boolean;
  workflowApproved?: boolean;
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

      {/* Footer — BRD Generation Pipeline */}
      {isBA && (
        <div className="shrink-0 border-t border-slate-200 bg-gradient-to-b from-slate-50 to-white">
          {brdSuccess ? (
            <div className="px-5 py-4">
              <div className="flex items-center gap-4 rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50 px-5 py-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-500 shadow-sm shadow-emerald-200">
                  <CheckCircle2 className="size-5 text-white" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-emerald-800">BRD Draft created successfully!</p>
                  <p className="text-xs text-emerald-600/80 mt-0.5">Ready for stakeholder review and sign-off.</p>
                </div>
                <a href="/ba/brd-management" className="flex shrink-0 items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition-colors">
                  View BRD <ExternalLink className="size-3.5" />
                </a>
              </div>
            </div>
          ) : (
            <div className="px-5 py-4 space-y-2">
              {/* Pipeline label + progress indicators */}
              <div className="flex items-center justify-between pb-1">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">BRD Generation Pipeline</p>
                <div className="flex items-center gap-1">
                  {[
                    !!docAnalysis && !docAnalysis.no_documents,
                    !!completenessResult,
                    scopeApproved ?? false,
                    workflowApproved ?? false,
                    false,
                  ].map((done, i) => (
                    <div key={i} className={`h-1 rounded-full transition-all ${done ? "w-6 bg-emerald-400" : "w-4 bg-slate-200"}`} />
                  ))}
                </div>
              </div>

              {/* Step 0 — Document Intelligence */}
              <div className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 transition-all ${
                docAnalysis && !docAnalysis.no_documents
                  ? "border-emerald-200 bg-emerald-50/70"
                  : docAnalysis?.no_documents
                  ? "border-slate-100 bg-slate-50"
                  : "border-teal-200 bg-teal-50/50"
              }`}>
                <div className={`flex size-7 shrink-0 items-center justify-center rounded-lg font-black text-xs ${
                  docAnalysis && !docAnalysis.no_documents ? "bg-emerald-500 text-white" : "bg-teal-100 text-teal-700"
                }`}>
                  {docAnalysis && !docAnalysis.no_documents ? <CheckCircle2 className="size-3.5" /> : "0"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-bold leading-snug ${docAnalysis?.no_documents ? "text-slate-400" : docAnalysis ? "text-emerald-700" : "text-slate-700"}`}>
                    {docAnalysis?.no_documents ? "No documents attached" : docAnalysis ? `Docs analysed — ${(docAnalysis.key_requirements || []).length} requirements found` : "Analyse Attached Documents"}
                  </p>
                  <p className="text-[10px] text-slate-400 leading-tight mt-0.5">
                    {docAnalysis?.no_documents ? "Proceed without document analysis" : "AI extracts requirements, rules & data from uploaded files"}
                  </p>
                </div>
                {!docAnalysis?.no_documents && (
                  <button onClick={onAnalyzeDocs} disabled={analyzingDocs}
                    className={`flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-all disabled:opacity-50 ${
                      docAnalysis ? "bg-slate-100 text-slate-600 hover:bg-slate-200" : "bg-teal-600 text-white hover:bg-teal-500"
                    }`}>
                    {analyzingDocs ? <Loader2 className="size-3 animate-spin" /> : docAnalysis ? <RefreshCw className="size-3" /> : <ScanSearch className="size-3" />}
                    <span>{analyzingDocs ? "Scanning…" : docAnalysis ? "Re-scan" : "Scan"}</span>
                  </button>
                )}
              </div>

              {/* Step 1 — Completeness Check */}
              <div className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 transition-all ${
                completenessResult ? "border-emerald-200 bg-emerald-50/70" : "border-amber-200 bg-amber-50/50"
              }`}>
                <div className={`flex size-7 shrink-0 items-center justify-center rounded-lg font-black text-xs ${
                  completenessResult ? "bg-emerald-500 text-white" : "bg-amber-100 text-amber-700"
                }`}>
                  {completenessResult ? <CheckCircle2 className="size-3.5" /> : "1"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-bold leading-snug ${completenessResult ? "text-emerald-700" : "text-slate-700"}`}>
                    {completenessResult ? `Completeness: ${completenessResult.completeness_score}% — ${completenessResult.readiness}` : "Check Discussion Completeness"}
                  </p>
                  <p className="text-[10px] text-slate-400 leading-tight mt-0.5">
                    {completenessResult ? `${completenessResult.missing.length} gap${completenessResult.missing.length !== 1 ? "s" : ""} identified` : "AI scores coverage and lists missing requirements"}
                  </p>
                </div>
                <button onClick={onCheckCompleteness} disabled={checkingCompleteness}
                  className={`flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-all disabled:opacity-50 ${
                    completenessResult ? "bg-slate-100 text-slate-600 hover:bg-slate-200" : "bg-amber-500 text-white hover:bg-amber-400"
                  }`}>
                  {checkingCompleteness ? <Loader2 className="size-3 animate-spin" /> : completenessResult ? <RefreshCw className="size-3" /> : <AlertTriangle className="size-3" />}
                  <span>{checkingCompleteness ? "Checking…" : completenessResult ? "Re-check" : "Check"}</span>
                </button>
              </div>

              {/* Step 2 — Scope Definition */}
              <div className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 transition-all ${
                scopeApproved
                  ? "border-emerald-200 bg-emerald-50/70"
                  : completenessResult
                  ? "border-indigo-200 bg-indigo-50/50"
                  : "border-slate-100 bg-slate-50 opacity-60"
              }`}>
                <div className={`flex size-7 shrink-0 items-center justify-center rounded-lg font-black text-xs ${
                  scopeApproved ? "bg-emerald-500 text-white" : completenessResult ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-400"
                }`}>
                  {scopeApproved ? <CheckCircle2 className="size-3.5" /> : "2"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-bold leading-snug ${scopeApproved ? "text-emerald-700" : completenessResult ? "text-slate-700" : "text-slate-400"}`}>
                    {scopeApproved ? "Scope approved ✓" : "Define & Approve Scope"}
                  </p>
                  <p className="text-[10px] text-slate-400 leading-tight mt-0.5">
                    {scopeApproved ? "In-scope items locked for BRD generation" : completenessResult ? "AI maps in-scope, out-of-scope & ambiguities" : "Complete Step 1 first"}
                  </p>
                </div>
                <button onClick={onGenerateScope} disabled={!completenessResult || generatingScope}
                  className={`flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-all disabled:opacity-40 ${
                    scopeApproved ? "bg-slate-100 text-slate-600 hover:bg-slate-200" : completenessResult ? "bg-indigo-600 text-white hover:bg-indigo-500" : "bg-slate-100 text-slate-400 cursor-not-allowed"
                  }`}>
                  {generatingScope ? <Loader2 className="size-3 animate-spin" /> : scopeApproved ? <RefreshCw className="size-3" /> : <GitBranch className="size-3" />}
                  <span>{generatingScope ? "Generating…" : scopeApproved ? "Revise" : "Define"}</span>
                </button>
              </div>

              {/* Step 3 — Workflow */}
              <div className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 transition-all ${
                workflowApproved
                  ? "border-emerald-200 bg-emerald-50/70"
                  : scopeApproved
                  ? "border-violet-200 bg-violet-50/50"
                  : "border-slate-100 bg-slate-50 opacity-60"
              }`}>
                <div className={`flex size-7 shrink-0 items-center justify-center rounded-lg font-black text-xs ${
                  workflowApproved ? "bg-emerald-500 text-white" : scopeApproved ? "bg-violet-100 text-violet-700" : "bg-slate-100 text-slate-400"
                }`}>
                  {workflowApproved ? <CheckCircle2 className="size-3.5" /> : "3"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-bold leading-snug ${workflowApproved ? "text-emerald-700" : scopeApproved ? "text-slate-700" : "text-slate-400"}`}>
                    {workflowApproved ? "Workflow approved ✓" : "Generate & Approve Workflow"}
                  </p>
                  <p className="text-[10px] text-slate-400 leading-tight mt-0.5">
                    {workflowApproved ? "Process steps confirmed by BA" : scopeApproved ? "AI builds step-by-step process from approved scope" : "Complete Step 2 first"}
                  </p>
                </div>
                <button onClick={onGenerateWorkflow} disabled={!scopeApproved || generatingWorkflow}
                  className={`flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11px] font-bold transition-all disabled:opacity-40 ${
                    workflowApproved ? "bg-slate-100 text-slate-600 hover:bg-slate-200" : scopeApproved ? "bg-violet-600 text-white hover:bg-violet-500" : "bg-slate-100 text-slate-400 cursor-not-allowed"
                  }`}>
                  {generatingWorkflow ? <Loader2 className="size-3 animate-spin" /> : workflowApproved ? <RefreshCw className="size-3" /> : <List className="size-3" />}
                  <span>{generatingWorkflow ? "Generating…" : workflowApproved ? "Revise" : "Build"}</span>
                </button>
              </div>

              {/* Step 4 — Generate BRD */}
              <button onClick={onGenerateBrd} disabled={!workflowApproved || generatingBrd}
                className={`flex w-full items-center justify-center gap-2.5 rounded-xl px-4 py-3.5 text-sm font-bold transition-all mt-1 ${
                  workflowApproved
                    ? "bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-600 text-white shadow-md shadow-indigo-200 hover:shadow-lg hover:shadow-indigo-300 hover:from-violet-500 hover:via-indigo-500 hover:to-blue-500"
                    : "bg-slate-100 text-slate-400 cursor-not-allowed"
                } disabled:opacity-50`}>
                {generatingBrd
                  ? <><Loader2 className="size-4 animate-spin" /> Building BRD with AI…</>
                  : <><Sparkles className="size-4" /> Step 4: Generate Draft BRD <ChevronRight className="size-4 opacity-70" /></>
                }
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Completeness Check Modal ───────────────────────────────────────────────────
function CompletenessModal({
  result,
  onClose,
  onBackToChat,
}: {
  result: CompletenessResult;
  onClose: () => void;
  onBackToChat?: () => void;
}) {
  const score = result.completeness_score;
  const scoreColor = score >= 75 ? "text-emerald-600" : score >= 50 ? "text-amber-600" : "text-rose-600";
  const scoreBg = score >= 75 ? "bg-emerald-50 border-emerald-200" : score >= 50 ? "bg-amber-50 border-amber-200" : "bg-rose-50 border-rose-200";

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-white">
      <div className="h-0.5 w-full bg-gradient-to-r from-amber-400 to-orange-400 shrink-0" />
      <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-md">
            <AlertTriangle className="size-5 text-white" />
          </div>
          <div>
            <p className="text-base font-bold text-slate-800">Discussion Completeness Check</p>
            <p className="text-[11px] text-slate-400">AI assessment of requirement coverage</p>
          </div>
        </div>
        <button onClick={onClose} className="flex size-9 items-center justify-center rounded-xl border border-slate-200 text-slate-400 hover:bg-slate-100">
          <X className="size-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-5">
        {/* Score */}
        <div className={`rounded-2xl border p-5 ${scoreBg}`}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Completeness Score</p>
            <span className={`text-2xl font-black ${scoreColor}`}>{score}%</span>
          </div>
          <div className="w-full rounded-full bg-slate-200 h-2 mb-3">
            <div className={`h-2 rounded-full transition-all ${score >= 75 ? "bg-emerald-500" : score >= 50 ? "bg-amber-500" : "bg-rose-500"}`} style={{ width: `${score}%` }} />
          </div>
          <p className={`text-sm font-semibold ${scoreColor}`}>{result.readiness}</p>
          {result.documents_referenced && <p className="text-[11px] text-slate-500 mt-1">✓ Attached documents were referenced in assessment</p>}
        </div>

        {/* What's covered */}
        {result.present.length > 0 && (
          <div className="rounded-2xl border border-emerald-100 bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-600 mb-3">What&apos;s Covered</p>
            <ul className="space-y-1.5">
              {result.present.map((p, i) => (
                <li key={i} className="flex items-start gap-2">
                  <CheckCircle2 className="size-3.5 mt-0.5 shrink-0 text-emerald-500" />
                  <span className="text-xs text-slate-700">{p}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* What's missing */}
        {result.missing.length > 0 && (
          <div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-rose-600 mb-3">Critical Gaps</p>
            <ul className="space-y-1.5">
              {result.missing.map((m, i) => (
                <li key={i} className="flex items-start gap-2">
                  <XCircle className="size-3.5 mt-0.5 shrink-0 text-rose-500" />
                  <span className="text-xs text-slate-700">{m}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Questions to ask */}
        {result.clarification_questions.length > 0 && (
          <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-amber-600 mb-3">Questions to Ask Stakeholder</p>
            <ol className="space-y-1.5">
              {result.clarification_questions.map((q, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-amber-200 text-[9px] font-bold text-amber-700">{i + 1}</span>
                  <span className="text-xs text-slate-700">{q}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-slate-100 bg-gradient-to-b from-slate-50 to-white px-5 py-4 space-y-2">
        {score < 65 && (
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-100 bg-amber-50 px-3.5 py-2.5">
            <AlertTriangle className="size-4 shrink-0 mt-0.5 text-amber-500" />
            <p className="text-xs text-amber-700">Score is below 65% — consider gathering more information before proceeding to scope definition.</p>
          </div>
        )}
        <div className="flex gap-2">
          {onBackToChat && (
            <button onClick={onBackToChat}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
              <ArrowLeft className="size-3.5" /> Back to Discussion
            </button>
          )}
          <button onClick={onClose}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-4 py-3 text-sm font-bold text-white shadow-sm shadow-indigo-200 hover:from-indigo-500 hover:to-violet-500 transition-all">
            Proceed to Scope <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Scope Review Modal ─────────────────────────────────────────────────────────
function ScopeModal({
  scope,
  onClose,
  onSave,
  onBackToChat,
}: {
  scope: ScopeResult;
  onClose: () => void;
  onSave: (content: ScopeResult, approve: boolean) => Promise<void>;
  onBackToChat?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<ScopeResult>(scope);
  const [saving, setSaving] = useState(false);

  const save = async (approve: boolean) => {
    setSaving(true);
    try { await onSave(draft, approve); }
    finally { setSaving(false); }
  };

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-white">
      <div className="h-0.5 w-full bg-gradient-to-r from-indigo-500 to-violet-500 shrink-0" />
      <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-md">
            <GitBranch className="size-5 text-white" />
          </div>
          <div>
            <p className="text-base font-bold text-slate-800">Project Scope Definition</p>
            <p className="text-[11px] text-slate-400">Review and approve before generating workflow</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setEditing(e => !e)}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all ${editing ? "border-amber-300 bg-amber-50 text-amber-700" : "border-slate-200 bg-white text-slate-600 hover:border-indigo-200 hover:text-indigo-700"}`}
          >
            <Pencil className="size-3.5" />{editing ? "Editing" : "Edit"}
          </button>
          <button onClick={onClose} className="flex size-9 items-center justify-center rounded-xl border border-slate-200 text-slate-400 hover:bg-slate-100">
            <X className="size-4" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50/50 px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-widest text-indigo-600 mb-1">Scope Title</p>
          {editing
            ? <input className="w-full rounded-lg border border-indigo-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400" value={draft.scope_title} onChange={e => setDraft(d => ({ ...d, scope_title: e.target.value }))} />
            : <p className="text-sm font-semibold text-slate-800">{draft.scope_title}</p>
          }
        </div>

        {/* In Scope */}
        <div className="rounded-2xl border border-emerald-100 bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-600 mb-3">In Scope ({draft.in_scope.length} items)</p>
          <ul className="space-y-1.5">
            {draft.in_scope.map((s, i) => (
              <li key={i} className="flex items-start gap-2">
                <CheckCircle2 className="size-3.5 mt-0.5 shrink-0 text-emerald-500" />
                {editing
                  ? <input className="flex-1 rounded border border-slate-200 px-2 py-0.5 text-xs text-slate-700" value={s} onChange={e => setDraft(d => ({ ...d, in_scope: d.in_scope.map((x, j) => j === i ? e.target.value : x) }))} />
                  : <span className="text-xs text-slate-700">{s}</span>
                }
              </li>
            ))}
            {editing && <button onClick={() => setDraft(d => ({ ...d, in_scope: [...d.in_scope, ""] }))} className="mt-1 text-xs text-emerald-600 hover:underline">+ Add item</button>}
          </ul>
        </div>

        {/* Out of Scope */}
        {draft.out_of_scope.length > 0 && (
          <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-3">Out of Scope</p>
            <ul className="space-y-1.5">
              {draft.out_of_scope.map((s, i) => (
                <li key={i} className="flex items-start gap-2">
                  <XCircle className="size-3.5 mt-0.5 shrink-0 text-slate-400" />
                  <span className="text-xs text-slate-500">{s}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Ambiguities & Gaps */}
        {(draft.ambiguities.length > 0 || draft.critical_gaps.length > 0) && (
          <div className="rounded-2xl border border-amber-100 bg-amber-50/50 p-4">
            {draft.ambiguities.length > 0 && (<>
              <p className="text-xs font-bold uppercase tracking-widest text-amber-600 mb-2">Needs Clarification</p>
              <ul className="space-y-1 mb-3">
                {draft.ambiguities.map((a, i) => <li key={i} className="text-xs text-slate-700 flex gap-2"><ShieldAlert className="size-3.5 mt-0.5 shrink-0 text-amber-500" />{a}</li>)}
              </ul>
            </>)}
            {draft.critical_gaps.length > 0 && (<>
              <p className="text-xs font-bold uppercase tracking-widest text-rose-600 mb-2">Critical Gaps</p>
              <ul className="space-y-1">
                {draft.critical_gaps.map((g, i) => <li key={i} className="text-xs text-slate-700 flex gap-2"><AlertTriangle className="size-3.5 mt-0.5 shrink-0 text-rose-500" />{g}</li>)}
              </ul>
            </>)}
          </div>
        )}
      </div>

      <div className="shrink-0 border-t border-slate-100 bg-gradient-to-b from-slate-50 to-white px-5 py-4 space-y-2">
        {onBackToChat && (
          <button onClick={onBackToChat}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-500 hover:bg-slate-50 transition-colors">
            <ArrowLeft className="size-3.5" /> Back to Discussion (gather more information)
          </button>
        )}
        <div className="flex gap-2">
          <button onClick={() => save(false)} disabled={saving}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">
            <Save className="size-3.5" /> Save Draft
          </button>
          <button onClick={() => save(true)} disabled={saving}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-3 text-sm font-bold text-white shadow-sm shadow-emerald-200 hover:from-emerald-400 hover:to-teal-500 transition-all disabled:opacity-50">
            {saving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
            Approve Scope
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Workflow Review Modal ──────────────────────────────────────────────────────
function WorkflowModal({
  workflow,
  onClose,
  onSave,
  onBackToChat,
}: {
  workflow: WorkflowResult;
  onClose: () => void;
  onSave: (content: WorkflowResult, approve: boolean) => Promise<void>;
  onBackToChat?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<WorkflowResult>(workflow);
  const [saving, setSaving] = useState(false);

  const save = async (approve: boolean) => {
    setSaving(true);
    try { await onSave(draft, approve); }
    finally { setSaving(false); }
  };

  const updateStep = (idx: number, field: keyof WorkflowStep, value: string) => {
    setDraft(d => ({
      ...d,
      steps: d.steps.map((s, i) => i === idx ? { ...s, [field]: value } : s),
    }));
  };

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-white">
      <div className="h-0.5 w-full bg-gradient-to-r from-violet-500 to-indigo-500 shrink-0" />
      <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 shadow-md">
            <RefreshCw className="size-5 text-white" />
          </div>
          <div>
            <p className="text-base font-bold text-slate-800">Process Workflow</p>
            <p className="text-[11px] text-slate-400">{draft.steps.length} steps — review and approve before BRD generation</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setEditing(e => !e)}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all ${editing ? "border-amber-300 bg-amber-50 text-amber-700" : "border-slate-200 bg-white text-slate-600 hover:border-violet-200 hover:text-violet-700"}`}
          >
            <Pencil className="size-3.5" />{editing ? "Editing" : "Edit"}
          </button>
          <button onClick={onClose} className="flex size-9 items-center justify-center rounded-xl border border-slate-200 text-slate-400 hover:bg-slate-100">
            <X className="size-4" />
          </button>
        </div>
      </div>

      <div className="shrink-0 border-b border-slate-100 px-6 py-2">
        {editing
          ? <input className="w-full rounded-lg border border-violet-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-400" value={draft.workflow_title} onChange={e => setDraft(d => ({ ...d, workflow_title: e.target.value }))} />
          : <p className="text-sm font-semibold text-slate-700">{draft.workflow_title}</p>
        }
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-3">
        {draft.steps.map((step, i) => (
          <div key={step.step} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-bold text-violet-700">
                {step.step}
              </div>
              <div className="flex-1 space-y-1">
                {editing ? (
                  <>
                    <input className="w-full rounded border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-800" value={step.name} onChange={e => updateStep(i, "name", e.target.value)} placeholder="Step name" />
                    <div className="grid grid-cols-2 gap-1">
                      <input className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600" value={step.actor} onChange={e => updateStep(i, "actor", e.target.value)} placeholder="Actor" />
                      <input className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600" value={step.outcome} onChange={e => updateStep(i, "outcome", e.target.value)} placeholder="Outcome" />
                    </div>
                    <textarea className="w-full rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 resize-none" rows={2} value={step.action} onChange={e => updateStep(i, "action", e.target.value)} placeholder="Action description" />
                  </>
                ) : (
                  <>
                    <p className="text-xs font-bold text-slate-800">{step.name}</p>
                    <p className="text-[11px] text-slate-500"><span className="font-semibold">Actor:</span> {step.actor}</p>
                    <p className="text-xs text-slate-600">{step.action}</p>
                    <p className="text-[11px] text-emerald-600"><span className="font-semibold">Outcome:</span> {step.outcome}</p>
                    {step.systems_involved?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {step.systems_involved.map(sys => (
                          <span key={sys} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">{sys}</span>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="shrink-0 border-t border-slate-100 bg-gradient-to-b from-slate-50 to-white px-5 py-4 space-y-2">
        {onBackToChat && (
          <button onClick={onBackToChat}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-500 hover:bg-slate-50 transition-colors">
            <ArrowLeft className="size-3.5" /> Back to Discussion (gather more information)
          </button>
        )}
        <div className="flex gap-2">
          <button onClick={() => save(false)} disabled={saving}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-50">
            <Save className="size-3.5" /> Save Draft
          </button>
          <button onClick={() => save(true)} disabled={saving}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-3 text-sm font-bold text-white shadow-sm shadow-violet-200 hover:from-violet-500 hover:to-indigo-500 transition-all disabled:opacity-50">
            {saving ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
            Approve Workflow
          </button>
        </div>
      </div>
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
            <p className="mt-1.5 text-xs leading-relaxed text-slate-400">
              Hover over any message and click ··· → Mark as Key Point to flag it for the BRD.
            </p>
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
                  <div className="mt-2 flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-semibold text-slate-500">{msg.sender_name}</span>
                    <span className="text-[10px] text-slate-300">·</span>
                    <span className="text-[10px] text-slate-400">
                      {new Date(msg.marked_at).toLocaleDateString([], { month: "short", day: "numeric" })}
                    </span>
                    {msg.marked_by_name && (
                      <>
                        <span className="text-[10px] text-slate-300">·</span>
                        <span className="text-[10px] text-indigo-500">
                          ★ {msg.marked_by_name}
                        </span>
                      </>
                    )}
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
          {isBA ? "Analyses marked messages to extract BRD-ready insights" : "Anyone can mark key points — the BA uses them to generate the BRD"}
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
  // Stage 0 — document intelligence
  const [docAnalysis, setDocAnalysis] = useState<DocumentAnalysisResult | null>(null);
  const [analyzingDocs, setAnalyzingDocs] = useState(false);
  const [showDocAnalysisModal, setShowDocAnalysisModal] = useState(false);
  // Staged flow state
  const [checkingCompleteness, setCheckingCompleteness] = useState(false);
  const [completenessResult, setCompletenessResult] = useState<CompletenessResult | null>(null);
  const [showCompletenessModal, setShowCompletenessModal] = useState(false);
  const [generatingScope, setGeneratingScope] = useState(false);
  const [scopeResult, setScopeResult] = useState<ScopeResult | null>(null);
  const [showScopeModal, setShowScopeModal] = useState(false);
  const [scopeApproved, setScopeApproved] = useState(false);
  const [generatingWorkflow, setGeneratingWorkflow] = useState(false);
  const [workflowResult, setWorkflowResult] = useState<WorkflowResult | null>(null);
  const [showWorkflowModal, setShowWorkflowModal] = useState(false);
  const [workflowApproved, setWorkflowApproved] = useState(false);

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
  }, [request.id, importantIds]);

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

  const runDocumentAnalysis = useCallback(async () => {
    if (!isBA) return;
    setAnalyzingDocs(true);
    try {
      const token = localStorage.getItem("authToken");
      const res = await fetch(`${API}/api/stream/channels/${request.id}/analyze-documents`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setDocAnalysis(data);
      if (!data.no_documents) setShowDocAnalysisModal(true);
    } catch { alert("Document analysis failed. Please try again."); }
    finally { setAnalyzingDocs(false); }
  }, [request.id, isBA]);

  const runCompletenessCheck = useCallback(async () => {
    if (!isBA) return;
    setCheckingCompleteness(true);
    try {
      const token = localStorage.getItem("authToken");
      const res = await fetch(`${API}/api/stream/channels/${request.id}/completeness-check`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setCompletenessResult(data);
      setShowCompletenessModal(true);
    } catch { alert("Completeness check failed. Please try again."); }
    finally { setCheckingCompleteness(false); }
  }, [request.id, isBA]);

  const runGenerateScope = useCallback(async () => {
    if (!isBA) return;
    setGeneratingScope(true);
    try {
      const token = localStorage.getItem("authToken");
      const res = await fetch(`${API}/api/stream/channels/${request.id}/generate-scope`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setScopeResult(data);
      setShowScopeModal(true);
    } catch { alert("Scope generation failed. Please try again."); }
    finally { setGeneratingScope(false); }
  }, [request.id, isBA]);

  const saveScope = useCallback(async (content: ScopeResult, approve: boolean) => {
    const token = localStorage.getItem("authToken");
    await fetch(`${API}/api/stream/channels/${request.id}/scope`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ content, approve }),
    });
    setScopeResult({ ...content, status: approve ? "approved" : "draft" });
    if (approve) { setScopeApproved(true); setShowScopeModal(false); }
  }, [request.id]);

  const runGenerateWorkflow = useCallback(async () => {
    if (!isBA || !scopeResult) return;
    setGeneratingWorkflow(true);
    try {
      const token = localStorage.getItem("authToken");
      const res = await fetch(`${API}/api/stream/channels/${request.id}/generate-workflow`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ scope_content: scopeResult }),
      });
      const data = await res.json();
      setWorkflowResult(data);
      setShowWorkflowModal(true);
    } catch { alert("Workflow generation failed. Please try again."); }
    finally { setGeneratingWorkflow(false); }
  }, [request.id, isBA, scopeResult]);

  const saveWorkflow = useCallback(async (content: WorkflowResult, approve: boolean) => {
    const token = localStorage.getItem("authToken");
    await fetch(`${API}/api/stream/channels/${request.id}/workflow`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ content, approve }),
    });
    setWorkflowResult({ ...content, status: approve ? "approved" : "draft" });
    if (approve) { setWorkflowApproved(true); setShowWorkflowModal(false); }
  }, [request.id]);

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
    <ImportantCtx.Provider value={{ importantIds, toggle: toggleImportant }}>
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
                <Channel channel={channel} Message={CustomMessage} Attachment={CustomAttachment} MessageOptions={CustomMessageOptions}>
                  <Window>
                    <MessageList />
                    <MessageInput focus />
                  </Window>
                  <Thread />
                </Channel>
              </Chat>
            </div>
          ) : null}

          {/* Analysis result — full overlay with staged flow */}
          {analysis && !showCompletenessModal && !showScopeModal && !showWorkflowModal && !showDocAnalysisModal && (
            <AnalysisModal
              analysis={analysis}
              onClose={() => { setAnalysis(null); setBrdSuccess(false); setCompletenessResult(null); setScopeApproved(false); setWorkflowApproved(false); setDocAnalysis(null); }}
              onGenerateBrd={generateDraftBRD}
              generatingBrd={generatingBrd}
              brdSuccess={brdSuccess}
              isBA={isBA}
              onAnalyzeDocs={runDocumentAnalysis}
              analyzingDocs={analyzingDocs}
              docAnalysis={docAnalysis}
              onCheckCompleteness={runCompletenessCheck}
              checkingCompleteness={checkingCompleteness}
              completenessResult={completenessResult}
              onGenerateScope={runGenerateScope}
              generatingScope={generatingScope}
              scopeApproved={scopeApproved}
              onGenerateWorkflow={runGenerateWorkflow}
              generatingWorkflow={generatingWorkflow}
              workflowApproved={workflowApproved}
            />
          )}

          {/* Document Intelligence modal — Stage 0 */}
          {analysis && showDocAnalysisModal && docAnalysis && !docAnalysis.no_documents && (
            <DocumentIntelligenceModal
              result={docAnalysis}
              onClose={() => { setShowDocAnalysisModal(false); setAnalysis(null); }}
              onProceed={() => setShowDocAnalysisModal(false)}
            />
          )}

          {/* Completeness check modal */}
          {analysis && showCompletenessModal && completenessResult && (
            <CompletenessModal
              result={completenessResult}
              onClose={() => setShowCompletenessModal(false)}
              onBackToChat={() => { setShowCompletenessModal(false); setAnalysis(null); }}
            />
          )}

          {/* Scope review modal */}
          {analysis && showScopeModal && scopeResult && (
            <ScopeModal
              scope={scopeResult}
              onClose={() => setShowScopeModal(false)}
              onSave={saveScope}
              onBackToChat={() => { setShowScopeModal(false); setAnalysis(null); }}
            />
          )}

          {/* Workflow review modal */}
          {analysis && showWorkflowModal && workflowResult && (
            <WorkflowModal
              workflow={workflowResult}
              onClose={() => setShowWorkflowModal(false)}
              onSave={saveWorkflow}
              onBackToChat={() => { setShowWorkflowModal(false); setAnalysis(null); }}
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
