"use client";

import { useEffect, useState, useMemo } from "react";
import { Clock, Flame, Loader2, MessageSquare, TrendingUp, Zap, Search } from "lucide-react";
import { RequestChat } from "@/components/chat/RequestChat";
import { ensureAuth, getUserMeta } from "@/lib/authGuard";

const API = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5001";

interface DiscussionRequest {
  id: number;
  req_number: string;
  title: string;
  priority: string;
  category: string;
  status: string;
  ba_name: string | null;
  ba_email: string | null;
  stakeholder_name: string | null;
  stakeholder_email: string | null;
  unread_count: number;
  last_message: string | null;
  last_message_at: string | null;
}


const priorityDot: Record<string, string> = {
  Low: "bg-emerald-400", Medium: "bg-amber-400", High: "bg-orange-500", Critical: "bg-rose-500",
};
const priorityIcon: Record<string, React.ReactNode> = {
  Low: <TrendingUp className="size-3 text-emerald-500" />,
  Medium: <Clock className="size-3 text-amber-500" />,
  High: <Zap className="size-3 text-orange-500" />,
  Critical: <Flame className="size-3 text-rose-500" />,
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  return new Date(dateStr).toLocaleDateString([], { month: "short", day: "numeric" });
}

function getInitials(name: string | null, email: string | null) {
  const src = name || email || "?";
  const parts = src.trim().split(" ");
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : src.slice(0, 2).toUpperCase();
}

const avatarPalette = [
  "bg-cyan-500", "bg-teal-500", "bg-indigo-500",
  "bg-violet-500", "bg-amber-500", "bg-rose-500",
];

export default function ITMemberDiscussionsPage() {
  const [requests, setRequests]       = useState<DiscussionRequest[]>([]);
  const [selected, setSelected]       = useState<DiscussionRequest | null>(null);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const [currentUser, setCurrentUser] = useState<{ id: number; email: string; name: string; role: string } | null>(null);

  useEffect(() => {
    const meta = getUserMeta();
    if (meta) setCurrentUser({ id: meta.id, email: meta.email, name: meta.name || meta.email, role: meta.role || "it_member" });

    ensureAuth().then(token => {
      fetch(`${API}/api/discussions/requests`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.json())
        .then(d => { setRequests(d.requests || []); setLoading(false); })
        .catch(() => setLoading(false));
    });
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return requests;
    const q = search.toLowerCase();
    return requests.filter(r =>
      r.title.toLowerCase().includes(q) ||
      r.req_number.toLowerCase().includes(q) ||
      (r.ba_name || r.ba_email || "").toLowerCase().includes(q)
    );
  }, [requests, search]);

  if (!currentUser) return (
    <div className="flex h-96 items-center justify-center gap-2 text-slate-400">
      <Loader2 className="size-5 animate-spin" /><span className="text-sm">Loading…</span>
    </div>
  );

  return (
    <div className="flex h-[calc(100vh-130px)] min-h-[600px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      {/* Sidebar */}
      <div className="flex w-72 shrink-0 flex-col border-r border-slate-100">
        <div className="border-b border-slate-100 px-4 pb-3 pt-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-slate-800">Discussions</h2>
            {requests.length > 0 && (
              <span className="text-xs font-medium text-slate-400">{requests.length} open</span>
            )}
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 size-3.5 text-slate-400" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search…"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-xs text-slate-700 placeholder:text-slate-400 transition-all focus:border-cyan-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-cyan-100"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-1">
          {loading ? (
            <div className="flex h-48 flex-col items-center justify-center gap-2 text-slate-400">
              <Loader2 className="size-5 animate-spin" />
              <span className="text-xs">Loading…</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center gap-2 px-6 text-center">
              <MessageSquare className="size-8 text-slate-200" />
              <p className="text-xs text-slate-400">
                {search ? "No results" : "No channels assigned yet"}
              </p>
            </div>
          ) : filtered.map(req => {
            const isActive = selected?.id === req.id;
            const unread   = req.unread_count;
            const initials = getInitials(req.ba_name, req.ba_email);
            const avatarBg = avatarPalette[req.id % avatarPalette.length];

            return (
              <button
                key={req.id}
                onClick={() => {
                  setSelected(req);
                  setRequests(prev => prev.map(r => r.id === req.id ? { ...r, unread_count: 0 } : r));
                }}
                className={`relative w-full px-3 py-2.5 text-left transition-colors duration-150 ${
                  isActive ? "bg-cyan-50" : "hover:bg-slate-50"
                }`}
              >
                {isActive && <div className="absolute bottom-2 left-0 top-2 w-0.5 rounded-r-full bg-cyan-500" />}
                <div className="flex items-center gap-3">
                  <div className={`flex size-9 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white ${avatarBg}`}>
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="mb-0.5 flex items-center justify-between gap-1">
                      <span className={`truncate text-xs font-semibold ${isActive ? "text-cyan-800" : "text-slate-800"}`}>
                        {req.title}
                      </span>
                      <span className="shrink-0 text-[10px] text-slate-400">
                        {req.last_message_at ? timeAgo(req.last_message_at) : ""}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-1">
                      <p className={`truncate text-[11px] ${unread > 0 ? "font-semibold text-slate-700" : "text-slate-400"}`}>
                        {req.last_message || (req.ba_name ? `BA: ${req.ba_name}` : "No messages yet")}
                      </p>
                      {unread > 0 && (
                        <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-cyan-500 text-[9px] font-bold text-white">
                          {unread > 9 ? "9+" : unread}
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-1.5">
                      {priorityIcon[req.priority]}
                      <span className={`size-1.5 shrink-0 rounded-full ${priorityDot[req.priority] ?? "bg-slate-300"}`} />
                      <span className="font-mono text-[10px] text-slate-400">{req.req_number}</span>
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {selected ? (
          <RequestChat
            request={selected}
            currentUserId={currentUser.id}
            currentUserName={currentUser.name}
            onBack={() => setSelected(null)}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center bg-slate-50/50 text-center">
            <div className="mb-4 flex size-16 items-center justify-center rounded-2xl border border-slate-200 bg-white shadow-sm">
              <MessageSquare className="size-7 text-slate-300" />
            </div>
            <p className="text-sm font-semibold text-slate-600">No conversation selected</p>
            <p className="mt-1 max-w-[220px] text-xs text-slate-400">
              Pick a discussion from the sidebar to join
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
