"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Activity,
  AlertCircle,
  BarChart3,
  Briefcase,
  CheckCircle2,
  ChevronRight,
  Clock,
  Code2,
  Crown,
  Edit2,
  Eye,
  EyeOff,
  Filter,
  LogOut,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Trash2,
  User,
  Users,
  X,
  Check,
} from "lucide-react";
import { ButtonShadcn } from "@/components/ui/ButtonShadcn";
import { InputShadcn } from "@/components/ui/InputShadcn";
import { Label } from "@/components/ui/Label";

type UserRole = "stakeholder" | "ba" | "it";
type Tab = "users" | "create" | "audit";

interface User {
  id: number;
  email: string;
  role: UserRole;
  name: string | null;
  is_it_manager: boolean;
  created_at: string;
}

interface AuditLog {
  id: number;
  admin_id: string;
  action: string;
  details: Record<string, unknown> | null;
  created_at: string;
}

const roleConfig: Record<UserRole, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  stakeholder: {
    label: "Stakeholder",
    color: "text-blue-300",
    bg: "bg-blue-500/15 border-blue-500/30",
    icon: <User className="size-3" />,
  },
  ba: {
    label: "Business Analyst",
    color: "text-purple-300",
    bg: "bg-purple-500/15 border-purple-500/30",
    icon: <Briefcase className="size-3" />,
  },
  it: {
    label: "IT Professional",
    color: "text-emerald-300",
    bg: "bg-emerald-500/15 border-emerald-500/30",
    icon: <Code2 className="size-3" />,
  },
};

function getInitials(name: string, email: string) {
  if (name.trim()) {
    const parts = name.trim().split(" ");
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}

const avatarColors = [
  "from-blue-500 to-blue-600",
  "from-purple-500 to-purple-600",
  "from-emerald-500 to-emerald-600",
  "from-amber-500 to-amber-600",
  "from-rose-500 to-rose-600",
  "from-cyan-500 to-cyan-600",
];

function UserAvatar({ name, email, id }: { name: string; email: string; id: number }) {
  const color = avatarColors[id % avatarColors.length];
  return (
    <div className={`flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${color} text-xs font-bold text-white shadow-sm`}>
      {getInitials(name, email)}
    </div>
  );
}

function StatCard({ label, value, icon, color }: { label: string; value: number; icon: React.ReactNode; color: string }) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-slate-700/50 bg-slate-800/50 p-4 backdrop-blur-xl">
      <div className={`flex size-10 items-center justify-center rounded-xl ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-2xl font-bold text-white">{value}</p>
        <p className="text-xs text-slate-400">{label}</p>
      </div>
    </div>
  );
}

function InlineNameEditor({
  userId,
  name,
  onSave,
}: {
  userId: number;
  name: string;
  onSave: (id: number, name: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState(name);

  const save = async () => {
    setSaving(true);
    await onSave(userId, draft.trim());
    setSaving(false);
    setEditing(false);
  };

  const cancel = () => {
    setDraft(name);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1.5">
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") cancel(); }}
          className="w-36 rounded-lg border border-slate-500 bg-slate-700 px-2 py-1 text-sm text-white placeholder:text-slate-500 focus:border-red-400 focus:outline-none"
          placeholder="Display name..."
        />
        <button onClick={save} disabled={saving} className="text-emerald-400 hover:text-emerald-300 transition-colors disabled:opacity-50">
          {saving ? <RefreshCw className="size-4 animate-spin" /> : <Check className="size-4" />}
        </button>
        <button onClick={cancel} className="text-slate-500 hover:text-slate-300 transition-colors">
          <X className="size-4" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => { setDraft(name); setEditing(true); }}
      className="group flex items-center gap-1.5 text-left"
    >
      <span className={`text-sm ${name ? "font-medium text-slate-200" : "italic text-slate-500"}`}>
        {name || "Set name..."}
      </span>
      <Edit2 className="size-3 text-slate-600 opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  );
}

export default function AdminPanel() {
  const [adminPassword, setAdminPassword] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  const [activeTab, setActiveTab] = useState<Tab>("users");
  const [users, setUsers] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all");

  // Create form
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [selectedRole, setSelectedRole] = useState<UserRole>("stakeholder");
  const [creatingUser, setCreatingUser] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  const [createError, setCreateError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [settingManagerId, setSettingManagerId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const API = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5001";

  useEffect(() => {
    const token = localStorage.getItem("adminToken");
    if (token) {
      verifyAdminToken(token);
    } else {
      setIsInitialized(true);
    }
  }, []);

  const saveUserName = async (id: number, name: string) => {
    const token = localStorage.getItem("adminToken");
    const res = await fetch(`${API}/api/admin/users/${id}/name`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      const data = await res.json();
      setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, name: data.user.name } : u)));
    }
  };

  const setAsItManager = async (userId: number) => {
    setSettingManagerId(userId);
    const token = localStorage.getItem("adminToken");
    const res = await fetch(`${API}/api/admin/users/${userId}/it-manager`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setSuccessMessage("IT Manager designation updated.");
      await fetchUsers();
      setTimeout(() => setSuccessMessage(""), 4000);
    }
    setSettingManagerId(null);
  };

  const handleDeleteUser = async (userId: number) => {
    setDeletingId(userId);
    setConfirmDeleteId(null);
    const token = localStorage.getItem("adminToken");
    const res = await fetch(`${API}/api/admin/users/${userId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setUsers(prev => prev.filter(u => u.id !== userId));
      setSuccessMessage("User and all associated data deleted.");
      setTimeout(() => setSuccessMessage(""), 4000);
    }
    setDeletingId(null);
  };

  const verifyAdminToken = async (token: string) => {
    try {
      const res = await fetch(`${API}/api/admin/verify`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });
      if (res.ok) {
        setIsAuthenticated(true);
        await Promise.all([fetchUsers(), fetchAuditLogs()]);
      } else {
        localStorage.removeItem("adminToken");
      }
    } catch {}
    setIsInitialized(true);
  };

  const fetchUsers = async () => {
    const token = localStorage.getItem("adminToken");
    const res = await fetch(`${API}/api/admin/users`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setUsers(data.users);
    } else if (res.status === 401) {
      localStorage.removeItem("adminToken");
      setIsAuthenticated(false);
    }
  };

  const fetchAuditLogs = async () => {
    const token = localStorage.getItem("adminToken");
    try {
      const res = await fetch(`${API}/api/admin/audit-logs`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAuditLogs(data.logs || []);
      }
    } catch {}
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchUsers(), fetchAuditLogs()]);
    setRefreshing(false);
  };

  const handleAdminLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: adminPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(res.status === 429 ? "Too many attempts. Try again later." : data.message || "Invalid password");
      } else {
        localStorage.setItem("adminToken", data.token);
        setIsAuthenticated(true);
        setAdminPassword("");
        await Promise.all([fetchUsers(), fetchAuditLogs()]);
      }
    } catch {
      setError("Cannot connect to admin service");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError("");
    setCreatingUser(true);
    try {
      const token = localStorage.getItem("adminToken");
      const res = await fetch(`${API}/api/admin/create-user`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ email: newEmail, password: newPassword, role: selectedRole, name: newName.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.message || "Failed to create user");
      } else {
        setSuccessMessage(`Account created for ${newEmail}`);
        setNewName(""); setNewEmail(""); setNewPassword(""); setSelectedRole("stakeholder");
        await fetchUsers();
        setTimeout(() => setSuccessMessage(""), 4000);
        setActiveTab("users");
      }
    } catch {
      setCreateError("Error creating user");
    } finally {
      setCreatingUser(false);
    }
  };

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem("adminToken");
      await fetch(`${API}/api/admin/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {}
    localStorage.removeItem("adminToken");
    setIsAuthenticated(false);
    setAdminPassword("");
    setUsers([]);
    setAuditLogs([]);
  };

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const name = u.name || "";
      const matchSearch =
        !search ||
        u.email.toLowerCase().includes(search.toLowerCase()) ||
        name.toLowerCase().includes(search.toLowerCase());
      const matchRole = roleFilter === "all" || u.role === roleFilter;
      return matchSearch && matchRole;
    });
  }, [users, search, roleFilter]);

  const stats = useMemo(() => ({
    total: users.length,
    stakeholder: users.filter((u) => u.role === "stakeholder").length,
    ba: users.filter((u) => u.role === "ba").length,
    it: users.filter((u) => u.role === "it").length,
  }), [users]);

  if (!isInitialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
        <div className="flex items-center gap-3 text-slate-400">
          <RefreshCw className="size-4 animate-spin" />
          Initializing...
        </div>
      </div>
    );
  }

  // ── Login screen ──────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="mb-10 flex flex-col items-center gap-3">
            <div className="flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br from-red-600 to-red-700 shadow-xl shadow-red-900/40">
              <Shield className="size-8 text-white" />
            </div>
            <div className="text-center">
              <h1 className="text-2xl font-bold text-white">Admin Control Panel</h1>
              <p className="mt-1 text-sm text-slate-400">Restricted — authorized access only</p>
            </div>
          </div>

          <form
            onSubmit={handleAdminLogin}
            className="space-y-5 rounded-2xl border border-slate-700/50 bg-slate-800/60 p-8 shadow-2xl backdrop-blur-xl"
          >
            <div className="space-y-2">
              <Label htmlFor="adminPassword" className="text-sm font-semibold text-slate-200">
                Admin Password
              </Label>
              <div className="relative">
                <InputShadcn
                  id="adminPassword"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  required
                  className="h-12 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500 focus:border-red-500 focus:ring-1 focus:ring-red-500/20 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-red-900/50 bg-red-950/40 p-3 text-sm text-red-300">
                <AlertCircle className="size-4 shrink-0" />
                {error}
              </div>
            )}

            <ButtonShadcn
              type="submit"
              className="h-12 w-full bg-gradient-to-r from-red-600 to-red-700 text-base font-semibold shadow-lg shadow-red-900/30 hover:from-red-700 hover:to-red-800 transition-all"
              disabled={loading}
            >
              {loading ? (
                <span className="flex items-center gap-2"><RefreshCw className="size-4 animate-spin" /> Verifying...</span>
              ) : (
                <span className="flex items-center gap-2"><Shield className="size-4" /> Access Panel</span>
              )}
            </ButtonShadcn>
          </form>
        </div>
      </div>
    );
  }

  // ── Authenticated panel ───────────────────────────────────────────────────
  const tabs: { id: Tab; label: string; icon: React.ReactNode; count?: number }[] = [
    { id: "users", label: "Users", icon: <Users className="size-4" />, count: users.length },
    { id: "create", label: "Create Account", icon: <Plus className="size-4" /> },
    { id: "audit", label: "Audit Log", icon: <Activity className="size-4" />, count: auditLogs.length },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <div className="mx-auto max-w-7xl px-6 py-8">

        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-11 items-center justify-center rounded-xl bg-gradient-to-br from-red-600 to-red-700 shadow-lg shadow-red-900/30">
              <Shield className="size-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Admin Control Panel</h1>
              <p className="text-xs text-slate-400">BPRM Portal — System Management</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleRefresh}
              className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs text-slate-300 transition-all hover:bg-slate-700"
            >
              <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs text-slate-300 transition-all hover:border-red-800 hover:bg-red-950/40 hover:text-red-300"
            >
              <LogOut className="size-3.5" />
              Logout
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Total Users" value={stats.total} icon={<Users className="size-5 text-white" />} color="bg-gradient-to-br from-slate-600 to-slate-700" />
          <StatCard label="Stakeholders" value={stats.stakeholder} icon={<User className="size-5 text-white" />} color="bg-gradient-to-br from-blue-600 to-blue-700" />
          <StatCard label="Business Analysts" value={stats.ba} icon={<Briefcase className="size-5 text-white" />} color="bg-gradient-to-br from-purple-600 to-purple-700" />
          <StatCard label="IT Professionals" value={stats.it} icon={<Code2 className="size-5 text-white" />} color="bg-gradient-to-br from-emerald-600 to-emerald-700" />
        </div>

        {/* Success toast */}
        {successMessage && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-800/50 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-300">
            <CheckCircle2 className="size-4 shrink-0" />
            {successMessage}
          </div>
        )}

        {/* Tabs */}
        <div className="mb-6 flex gap-1 rounded-xl border border-slate-700/50 bg-slate-800/50 p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
                activeTab === tab.id
                  ? "bg-slate-700 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
              {tab.count !== undefined && (
                <span className={`rounded-full px-1.5 py-0.5 text-xs font-bold ${activeTab === tab.id ? "bg-red-600 text-white" : "bg-slate-700 text-slate-400"}`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Users Tab ── */}
        {activeTab === "users" && (
          <div className="rounded-2xl border border-slate-700/50 bg-slate-800/50 shadow-2xl backdrop-blur-xl">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center gap-3 border-b border-slate-700/50 p-4">
              <div className="relative flex-1 min-w-52">
                <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or email..."
                  className="h-9 w-full rounded-xl border border-slate-600 bg-slate-700/50 pl-9 pr-3 text-sm text-white placeholder:text-slate-500 focus:border-slate-400 focus:outline-none"
                />
              </div>
              <div className="flex items-center gap-1">
                <Filter className="size-3.5 text-slate-500" />
                {(["all", "stakeholder", "ba", "it"] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setRoleFilter(r)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                      roleFilter === r
                        ? "bg-red-600 text-white"
                        : "text-slate-400 hover:bg-slate-700 hover:text-slate-200"
                    }`}
                  >
                    {r === "all" ? "All" : r === "ba" ? "BA" : r === "it" ? "IT" : "Stakeholder"}
                  </button>
                ))}
              </div>
            </div>

            {/* Table */}
            {filteredUsers.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-center">
                <Users className="mb-3 size-10 text-slate-600" />
                <p className="text-slate-400">{users.length === 0 ? "No users yet — create one above" : "No users match your search"}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700/50">
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">User</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Display Name</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Role</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Joined</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user, i) => {
                      const name = user.name || "";
                      const role = roleConfig[user.role];
                      return (
                        <tr
                          key={user.id}
                          className="group border-b border-slate-700/30 transition-colors hover:bg-slate-700/20"
                          style={{ animationDelay: `${i * 40}ms` }}
                        >
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <UserAvatar name={name} email={user.email} id={user.id} />
                              <div>
                                <p className="font-medium text-slate-200">{user.email}</p>
                                <p className="text-xs text-slate-500">ID #{user.id}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-5 py-3.5">
                            <InlineNameEditor userId={user.id} name={name} onSave={saveUserName} />
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex flex-col gap-1.5">
                              <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${role.color} ${role.bg}`}>
                                {role.icon}
                                {role.label}
                              </span>
                              {user.is_it_manager && (
                                <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                                  <Crown className="size-2.5" /> IT Manager
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-1.5 text-xs text-slate-400">
                              <Clock className="size-3.5" />
                              {new Date(user.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                            </div>
                          </td>
                          {/* Actions */}
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2">
                              {/* Set as IT Manager — only for IT role users */}
                              {user.role === "it" && !user.is_it_manager && (
                                <button
                                  onClick={() => setAsItManager(user.id)}
                                  disabled={settingManagerId === user.id}
                                  title="Designate as IT Manager"
                                  className="flex items-center gap-1.5 rounded-lg border border-amber-700/40 bg-amber-950/30 px-2.5 py-1.5 text-xs font-semibold text-amber-300 transition-all hover:bg-amber-900/40 disabled:opacity-50"
                                >
                                  {settingManagerId === user.id
                                    ? <RefreshCw className="size-3 animate-spin" />
                                    : <Crown className="size-3" />}
                                  Set as IT Manager
                                </button>
                              )}
                              {/* Confirm delete flow */}
                              {confirmDeleteId === user.id ? (
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs text-slate-400">Confirm?</span>
                                  <button
                                    onClick={() => handleDeleteUser(user.id)}
                                    disabled={deletingId === user.id}
                                    className="rounded-lg bg-red-700 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-600 disabled:opacity-50"
                                  >
                                    {deletingId === user.id ? <RefreshCw className="size-3 animate-spin" /> : "Yes, Delete"}
                                  </button>
                                  <button
                                    onClick={() => setConfirmDeleteId(null)}
                                    className="rounded-lg border border-slate-600 px-2.5 py-1.5 text-xs text-slate-400 hover:text-slate-200"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setConfirmDeleteId(user.id)}
                                  className="flex items-center gap-1.5 rounded-lg border border-red-900/40 bg-red-950/30 px-2.5 py-1.5 text-xs font-semibold text-red-400 transition-all hover:bg-red-900/40"
                                >
                                  <Trash2 className="size-3" />
                                  Delete
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="border-t border-slate-700/50 px-5 py-3 text-xs text-slate-500">
              Showing {filteredUsers.length} of {users.length} users
            </div>
          </div>
        )}

        {/* ── Create Account Tab ── */}
        {activeTab === "create" && (
          <div className="mx-auto max-w-lg">
            <div className="rounded-2xl border border-slate-700/50 bg-slate-800/50 p-8 shadow-2xl backdrop-blur-xl">
              <div className="mb-6 flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-xl bg-red-600/20 border border-red-600/30">
                  <Plus className="size-5 text-red-400" />
                </div>
                <div>
                  <h2 className="font-bold text-white">Create New Account</h2>
                  <p className="text-xs text-slate-400">User will be able to log in immediately</p>
                </div>
              </div>

              <form onSubmit={handleCreateUser} className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Display Name <span className="normal-case font-normal text-slate-600">(optional)</span></Label>
                  <InputShadcn
                    type="text"
                    placeholder="e.g. Alice Johnson"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    className="h-10 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Email Address *</Label>
                  <InputShadcn
                    type="email"
                    placeholder="user@company.com"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    required
                    className="h-10 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Password *</Label>
                  <InputShadcn
                    type="password"
                    placeholder="Min. 6 characters"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    className="h-10 bg-slate-700/50 border-slate-600 text-white placeholder:text-slate-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-slate-400">Portal Role *</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {(Object.entries(roleConfig) as [UserRole, typeof roleConfig[UserRole]][]).map(([key, cfg]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSelectedRole(key)}
                        className={`flex flex-col items-center gap-1.5 rounded-xl border py-3 text-center transition-all duration-200 ${
                          selectedRole === key
                            ? `${cfg.bg} border-opacity-60`
                            : "border-slate-600 bg-slate-700/30 hover:border-slate-500"
                        }`}
                      >
                        <span className={selectedRole === key ? cfg.color : "text-slate-500"}>{cfg.icon}</span>
                        <span className={`text-xs font-semibold ${selectedRole === key ? cfg.color : "text-slate-400"}`}>
                          {key === "ba" ? "BA" : key === "it" ? "IT" : "Stakeholder"}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {createError && (
                  <div className="flex items-center gap-2 rounded-lg border border-red-900/50 bg-red-950/40 p-3 text-sm text-red-300">
                    <AlertCircle className="size-4 shrink-0" /> {createError}
                  </div>
                )}

                <ButtonShadcn
                  type="submit"
                  disabled={creatingUser}
                  className="h-11 w-full bg-gradient-to-r from-red-600 to-red-700 font-semibold shadow-lg shadow-red-900/20 hover:from-red-700 hover:to-red-800"
                >
                  {creatingUser ? (
                    <span className="flex items-center gap-2"><RefreshCw className="size-4 animate-spin" /> Creating...</span>
                  ) : (
                    <span className="flex items-center gap-2"><Plus className="size-4" /> Create Account</span>
                  )}
                </ButtonShadcn>
              </form>
            </div>
          </div>
        )}

        {/* ── Audit Log Tab ── */}
        {activeTab === "audit" && (
          <div className="rounded-2xl border border-slate-700/50 bg-slate-800/50 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center justify-between border-b border-slate-700/50 px-5 py-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="size-4 text-slate-400" />
                <h2 className="font-semibold text-white">Admin Audit Log</h2>
              </div>
              <span className="text-xs text-slate-500">Last 100 actions</span>
            </div>

            {auditLogs.length === 0 ? (
              <div className="flex flex-col items-center py-16 text-center">
                <Activity className="mb-3 size-10 text-slate-600" />
                <p className="text-slate-400">No audit events recorded yet</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-700/30">
                {auditLogs.map((log) => (
                  <div key={log.id} className="flex items-start gap-4 px-5 py-3.5 hover:bg-slate-700/20 transition-colors">
                    <div className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-lg bg-slate-700">
                      <ChevronRight className="size-3.5 text-slate-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="rounded-md bg-slate-700 px-2 py-0.5 text-xs font-mono font-semibold text-slate-200">
                          {log.action}
                        </span>
                        {log.details && Object.keys(log.details).length > 0 && (
                          <span className="text-xs text-slate-500 truncate max-w-xs">
                            {Object.entries(log.details).map(([k, v]) => `${k}: ${v}`).join(" · ")}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1 text-xs text-slate-500 whitespace-nowrap">
                      <Clock className="size-3" />
                      {new Date(log.created_at).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
