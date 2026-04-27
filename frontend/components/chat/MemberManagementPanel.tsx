"use client";

import { useEffect, useState, useMemo } from "react";
import { X, UserPlus, Trash2, Search, Loader2, ShieldCheck, User, Users } from "lucide-react";

const API = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5001";

interface Member {
  id: number;
  name: string | null;
  email: string;
  role: string;
  stream_role: string;
}

interface User {
  id: number;
  name: string | null;
  email: string;
  role: string;
}

const roleLabel: Record<string, string> = {
  stakeholder: "Stakeholder",
  ba: "BA",
  it: "IT",
};

const roleBadge: Record<string, string> = {
  stakeholder: "bg-blue-100 text-blue-700",
  ba: "bg-violet-100 text-violet-700",
  it: "bg-indigo-100 text-indigo-700",
};

function getInitials(name: string | null, email: string) {
  const src = name || email;
  const parts = src.trim().split(" ");
  return parts.length >= 2
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : src.slice(0, 2).toUpperCase();
}

const avatarPalette = [
  "bg-violet-500", "bg-blue-500", "bg-teal-500",
  "bg-amber-500", "bg-rose-500", "bg-indigo-500", "bg-cyan-500",
];

interface Props {
  requestId: number;
  onClose: () => void;
}

export function MemberManagementPanel({ requestId, onClose }: Props) {
  const [members, setMembers] = useState<Member[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [search, setSearch] = useState("");
  const [addingId, setAddingId] = useState<number | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    import("@/lib/authGuard").then(({ ensureAuth }) => ensureAuth()).then(t => {
      if (cancelled) return;
      Promise.all([
        fetch(`${API}/api/stream/channels/${requestId}/members`, {
          headers: { Authorization: `Bearer ${t}` },
        }).then(r => r.json()),
        fetch(`${API}/api/stream/users`, {
          headers: { Authorization: `Bearer ${t}` },
        }).then(r => r.json()),
      ]).then(([membersData, usersData]) => {
        if (cancelled) return;
        setMembers(membersData.members || []);
        setAllUsers(usersData.users || []);
        setLoading(false);
      }).catch(() => { if (!cancelled) setLoading(false); });
    });
    return () => { cancelled = true; };
  }, [requestId]);

  const memberIds = useMemo(() => new Set(members.map(m => m.id)), [members]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return allUsers.filter(u =>
      !memberIds.has(u.id) &&
      ((u.name || "").toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q))
    );
  }, [allUsers, memberIds, search]);

  const addMember = async (user: User, streamRole: "moderator" | "member") => {
    const { ensureAuth } = await import("@/lib/authGuard");
    const t = await ensureAuth();
    setAddingId(user.id);
    await fetch(`${API}/api/stream/channels/${requestId}/members`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${t}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId: user.id, role: streamRole }),
    });
    setMembers(prev => [...prev, { ...user, stream_role: streamRole }]);
    setAddingId(null);
  };

  const removeMember = async (userId: number) => {
    const { ensureAuth } = await import("@/lib/authGuard");
    const t = await ensureAuth();
    setRemovingId(userId);
    await fetch(`${API}/api/stream/channels/${requestId}/members/${userId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${t}` },
    });
    setMembers(prev => prev.filter(m => m.id !== userId));
    setRemovingId(null);
  };

  return (
    <div className="absolute inset-y-0 right-0 z-20 flex w-[340px] flex-col bg-white shadow-2xl">

      {/* Accent bar */}
      <div className="h-0.5 w-full bg-gradient-to-r from-violet-500 via-purple-500 to-violet-400 shrink-0" />

      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 shadow-sm shadow-violet-200">
            <Users className="size-4 text-white" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800">Members</p>
            <p className="text-[11px] text-slate-400">{members.length} {members.length === 1 ? "participant" : "participants"}</p>
          </div>
        </div>
        <button onClick={onClose} className="flex size-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600">
          <X className="size-4" />
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-0 overflow-hidden">

        {/* Current members */}
        <div className="border-b border-slate-100 px-5 py-4">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400">Current Members</p>
          {loading ? (
            <div className="flex items-center gap-2 py-2 text-slate-400">
              <Loader2 className="size-4 animate-spin" />
              <span className="text-xs">Loading…</span>
            </div>
          ) : members.length === 0 ? (
            <p className="text-xs text-slate-400">No members yet</p>
          ) : (
            <div className="space-y-2">
              {members.map(m => (
                <div key={m.id} className="flex items-center gap-2.5">
                  <div className={`flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${avatarPalette[m.id % avatarPalette.length]}`}>
                    {getInitials(m.name, m.email)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-medium text-slate-700">{m.name || m.email}</p>
                    <div className="flex items-center gap-1">
                      <span className={`rounded px-1 py-0 text-[9px] font-semibold ${roleBadge[m.role] ?? "bg-slate-100 text-slate-500"}`}>
                        {roleLabel[m.role] ?? m.role}
                      </span>
                      {m.stream_role === "moderator" && (
                        <ShieldCheck className="size-3 text-amber-500" />
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => removeMember(m.id)}
                    disabled={removingId === m.id}
                    className="shrink-0 rounded-lg p-1 text-slate-300 hover:bg-rose-50 hover:text-rose-500 transition-colors disabled:opacity-40"
                  >
                    {removingId === m.id
                      ? <Loader2 className="size-3.5 animate-spin" />
                      : <Trash2 className="size-3.5" />}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add people */}
        <div className="flex flex-1 flex-col overflow-hidden px-5 py-4">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-widest text-slate-400">Add People</p>
          <div className="relative mb-3">
            <Search className="absolute left-2.5 top-2.5 size-3.5 text-slate-400 pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, email or role…"
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-8 pr-3 text-xs placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
            />
          </div>
          <div className="flex-1 overflow-y-auto space-y-1">
            {filtered.length === 0 ? (
              <p className="py-4 text-center text-xs text-slate-400">
                {search ? "No matching users" : "Everyone is already in the channel"}
              </p>
            ) : filtered.map(u => (
              <div key={u.id} className="flex items-center gap-2.5 rounded-lg px-2 py-2 hover:bg-slate-50">
                <div className={`flex size-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${avatarPalette[u.id % avatarPalette.length]}`}>
                  {getInitials(u.name, u.email)}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium text-slate-700">{u.name || u.email}</p>
                  <span className={`rounded px-1 py-0 text-[9px] font-semibold ${roleBadge[u.role] ?? "bg-slate-100 text-slate-500"}`}>
                    {roleLabel[u.role] ?? u.role}
                  </span>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {u.role === "ba" && (
                    <button
                      onClick={() => addMember(u, "moderator")}
                      disabled={addingId === u.id}
                      title="Add as moderator"
                      className="rounded-lg p-1 text-amber-400 hover:bg-amber-50 hover:text-amber-600 transition-colors disabled:opacity-40"
                    >
                      {addingId === u.id ? <Loader2 className="size-3.5 animate-spin" /> : <ShieldCheck className="size-3.5" />}
                    </button>
                  )}
                  <button
                    onClick={() => addMember(u, "member")}
                    disabled={addingId === u.id}
                    title="Add as member"
                    className="rounded-lg p-1 text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors disabled:opacity-40"
                  >
                    {addingId === u.id ? <Loader2 className="size-3.5 animate-spin" /> : <UserPlus className="size-3.5" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
