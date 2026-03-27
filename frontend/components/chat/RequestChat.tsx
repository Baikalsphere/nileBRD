"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import {
  ArrowLeft, CheckCheck, CornerDownRight, Loader2,
  Send, Video, X, MessageSquare,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5001";

interface ReplySnapshot {
  reply_text?: string;
  reply_sender_name?: string;
  reply_sender_email?: string;
}
interface Message extends ReplySnapshot {
  id: number;
  request_id: number;
  message: string;
  reply_to_id: number | null;
  created_at: string;
  sender_id: number;
  sender_email: string;
  sender_name: string | null;
  sender_role: string;
}
interface RequestInfo {
  id: number;
  req_number: string;
  title: string;
  priority: string;
  status: string;
}
interface Props {
  request: RequestInfo;
  currentUserId: number;
  currentUserName: string;
  onBack?: () => void;
}

const avatarPalette = [
  "bg-violet-500", "bg-blue-500", "bg-teal-500",
  "bg-amber-500", "bg-rose-500", "bg-indigo-500",
  "bg-pink-500",  "bg-cyan-500",
];

function initials(name: string | null, email: string) {
  const src = name?.trim() || email;
  const p = src.split(" ");
  return (p.length >= 2 ? p[0][0] + p[p.length - 1][0] : src.slice(0, 2)).toUpperCase();
}

function Avatar({ name, email, id }: { name: string | null; email: string; id: number }) {
  return (
    <div className={`size-7 shrink-0 rounded-full ${avatarPalette[id % avatarPalette.length]} flex items-center justify-center text-[10px] font-bold text-white`}>
      {initials(name, email)}
    </div>
  );
}

const priorityColors: Record<string, string> = {
  Low: "text-emerald-600", Medium: "text-amber-600", High: "text-orange-600", Critical: "text-rose-600",
};
const priorityDot: Record<string, string> = {
  Low: "bg-emerald-400", Medium: "bg-amber-400", High: "bg-orange-500", Critical: "bg-rose-500",
};

function DateSeparator({ date }: { date: string }) {
  const d = new Date(date);
  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  let label = d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
  if (d.toDateString() === today.toDateString()) label = "Today";
  else if (d.toDateString() === yesterday.toDateString()) label = "Yesterday";
  return (
    <div className="flex items-center gap-3 my-5">
      <div className="flex-1 h-px bg-slate-100" />
      <span className="text-[10px] font-medium text-slate-400 whitespace-nowrap">{label}</span>
      <div className="flex-1 h-px bg-slate-100" />
    </div>
  );
}

export function RequestChat({ request, currentUserId, currentUserName, onBack }: Props) {
  const [messages, setMessages]   = useState<Message[]>([]);
  const [draft, setDraft]         = useState("");
  const [replyTo, setReplyTo]     = useState<Message | null>(null);
  const [connected, setConnected] = useState(false);
  const [loading, setLoading]     = useState(true);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const msgRefs   = useRef<Record<number, HTMLDivElement | null>>({});
  const inputRef  = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const token = localStorage.getItem("authToken");
    if (!token) return;
    fetch(`${API}/api/discussions/messages/${request.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(d => { setMessages(d.messages || []); setLoading(false); })
      .catch(() => setLoading(false));

    const socket = io(API, { auth: { token }, transports: ["websocket", "polling"] });
    socketRef.current = socket;
    socket.on("connect", () => { setConnected(true); socket.emit("join-room", { requestId: request.id }); });
    socket.on("disconnect", () => setConnected(false));
    socket.on("new-message", (msg: Message) => {
      setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
      // Auto mark-read since the chat is open
      const t = localStorage.getItem("authToken");
      if (t) fetch(`${API}/api/discussions/mark-read/${request.id}`, { method: "POST", headers: { Authorization: `Bearer ${t}` } });
    });
    return () => { socket.emit("leave-room", { requestId: request.id }); socket.disconnect(); };
  }, [request.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = useCallback(() => {
    if (!draft.trim() || !socketRef.current) return;
    socketRef.current.emit("send-message", { requestId: request.id, message: draft.trim(), replyToId: replyTo?.id ?? null });
    setDraft(""); setReplyTo(null);
    inputRef.current?.focus();
  }, [draft, replyTo, request.id]);

  const scrollTo = (id: number) => {
    const el = msgRefs.current[id];
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.style.transition = "background 0.2s";
    el.style.background = "#eff6ff";
    setTimeout(() => { if (el) el.style.background = ""; }, 1200);
  };

  return (
    <div className="flex h-full flex-col bg-white">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 border-b border-slate-100 px-5 py-3.5">
        {onBack && (
          <button onClick={onBack} className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors">
            <ArrowLeft className="size-4" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-800">{request.title}</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="font-mono text-[10px] text-slate-400">{request.req_number}</span>
            <span className={`size-1 rounded-full ${priorityDot[request.priority] ?? "bg-slate-300"}`} />
            <span className={`text-[10px] font-medium ${priorityColors[request.priority] ?? "text-slate-500"}`}>{request.priority}</span>
            <span className="text-[10px] text-slate-300">·</span>
            <span className="text-[10px] text-slate-400">{request.status}</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <div className={`size-1.5 rounded-full ${connected ? "bg-emerald-400" : "bg-slate-300"}`} />
          <button
            onClick={() => window.open(`https://teams.microsoft.com/l/meeting/new?subject=${encodeURIComponent(request.title)}`, "_blank", "noopener,noreferrer")}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50 hover:border-slate-300 transition-all"
          >
            <Video className="size-3.5 text-indigo-500" />
            Teams Meeting
          </button>
        </div>
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-0.5 bg-white">
        {loading ? (
          <div className="flex h-full items-center justify-center gap-2 text-slate-400">
            <Loader2 className="size-5 animate-spin" /><span className="text-sm">Loading…</span>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="mb-3 flex size-14 items-center justify-center rounded-2xl bg-slate-50 border border-slate-100">
              <MessageSquare className="size-6 text-slate-300" />
            </div>
            <p className="text-sm font-semibold text-slate-500">No messages yet</p>
            <p className="mt-1 text-xs text-slate-400">Start the discussion below</p>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => {
              const isMe   = msg.sender_id === currentUserId;
              const prev   = i > 0 ? messages[i - 1] : null;
              const newDay = !prev || new Date(msg.created_at).toDateString() !== new Date(prev.created_at).toDateString();
              const sameAuthorAsPrev = prev && prev.sender_id === msg.sender_id && !newDay;
              const showAvatar = !isMe && !sameAuthorAsPrev;
              const showName   = showAvatar;
              const time = new Date(msg.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

              return (
                <div key={msg.id}>
                  {newDay && <DateSeparator date={msg.created_at} />}
                  <div
                    ref={el => { msgRefs.current[msg.id] = el; }}
                    className={`flex items-end gap-2 ${isMe ? "justify-end" : "justify-start"} ${sameAuthorAsPrev ? "mt-0.5" : "mt-3"}`}
                    onMouseEnter={() => setHoveredId(msg.id)}
                    onMouseLeave={() => setHoveredId(null)}
                  >
                    {/* Avatar placeholder */}
                    {!isMe && (
                      <div className="w-7 shrink-0 self-end">
                        {showAvatar && <Avatar name={msg.sender_name} email={msg.sender_email} id={msg.sender_id} />}
                      </div>
                    )}

                    <div className={`flex flex-col ${isMe ? "items-end" : "items-start"} max-w-[65%]`}>
                      {showName && (
                        <span className="mb-1 ml-0.5 text-[10px] font-medium text-slate-400">
                          {msg.sender_name || msg.sender_email}
                        </span>
                      )}

                      <div className="flex items-end gap-1.5">
                        {/* Reply button on hover */}
                        {hoveredId === msg.id && (
                          <button
                            onClick={() => { setReplyTo(msg); inputRef.current?.focus(); }}
                            className={`mb-1 flex size-6 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 shadow-sm hover:text-blue-500 hover:border-blue-200 transition-colors ${isMe ? "order-first" : "order-last"}`}
                          >
                            <CornerDownRight className="size-3" />
                          </button>
                        )}

                        <div className={`rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                          isMe
                            ? "bg-blue-600 text-white rounded-br-sm"
                            : "bg-slate-100 text-slate-800 rounded-bl-sm"
                        }`}>
                          {/* Reply quote */}
                          {msg.reply_to_id && msg.reply_text && (
                            <button
                              onClick={() => scrollTo(msg.reply_to_id!)}
                              className={`mb-2 block w-full rounded-lg border-l-2 px-2 py-1 text-left text-xs ${
                                isMe ? "border-blue-300 bg-blue-500/50" : "border-slate-300 bg-white/60"
                              }`}
                            >
                              <p className={`text-[10px] font-semibold mb-0.5 ${isMe ? "text-blue-200" : "text-slate-500"}`}>
                                {msg.reply_sender_name || msg.reply_sender_email}
                              </p>
                              <p className={`line-clamp-1 ${isMe ? "text-blue-100" : "text-slate-500"}`}>{msg.reply_text}</p>
                            </button>
                          )}

                          <p className="whitespace-pre-wrap break-words">{msg.message}</p>

                          <p className={`mt-1 text-[10px] text-right ${isMe ? "text-blue-300" : "text-slate-400"} flex items-center justify-end gap-1`}>
                            {time}
                            {isMe && <CheckCheck className="size-3" />}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </>
        )}
      </div>

      {/* ── Reply bar ── */}
      {replyTo && (
        <div className="flex items-center gap-3 border-t border-slate-100 bg-slate-50 px-5 py-2">
          <CornerDownRight className="size-3.5 shrink-0 text-slate-400" />
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-semibold text-blue-600">{replyTo.sender_name || replyTo.sender_email}</p>
            <p className="truncate text-[11px] text-slate-500">{replyTo.message}</p>
          </div>
          <button onClick={() => setReplyTo(null)} className="shrink-0 text-slate-400 hover:text-slate-600 transition-colors">
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {/* ── Input ── */}
      <div className="flex items-center gap-2.5 border-t border-slate-100 bg-white px-4 py-3">
        <input
          ref={inputRef}
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder={connected ? "Message…" : "Connecting…"}
          disabled={!connected}
          className="flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all disabled:opacity-50"
        />
        <button
          onClick={send}
          disabled={!draft.trim() || !connected}
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow-md disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Send className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
