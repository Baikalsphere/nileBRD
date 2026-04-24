"use client";

import { useEffect, useState, useCallback } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  ClipboardList, CheckCircle2, Clock, FileText, Bell,
  TrendingUp, RefreshCw, ArrowRight, ChevronRight,
  AlertTriangle, Users, SendHorizonal, Star, Hourglass,
  ThumbsUp, MessageSquare, BarChart2, CircleDot,
} from "lucide-react";
import { ensureAuth, getUserMeta } from "@/lib/authGuard";

const API = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5001";

// ── Types ──────────────────────────────────────────────────────────────────────
interface DashboardStats {
  role: "stakeholder";
  requests: {
    total: number;
    by_status: Record<string, number>;
    by_priority: Record<string, number>;
    recent: RecentRequest[];
    trend: TrendPoint[];
  };
  brd_reviews: BrdReviewItem[];
  shared_count: number;
}

interface RecentRequest {
  id: number; req_number: string; title: string;
  status: string; priority: string; category: string;
  created_at: string; updated_at: string;
  ba_name: string | null; ba_email: string | null;
}

interface BrdReviewItem {
  id: number; doc_id: string; version: string; brd_status: string;
  brd_title: string; req_number: string; request_title: string;
  updated_at: string; review_status: string; comment: string | null;
}

interface TrendPoint { label: string; count: number; }

// ── Helpers ────────────────────────────────────────────────────────────────────

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; border: string; bar: string; icon: React.ReactNode }> = {
  Submitted:        { label: "Submitted",     color: "text-amber-700",   bg: "bg-amber-50",   border: "border-amber-200",   bar: "bg-amber-400",   icon: <SendHorizonal className="size-3" /> },
  "In Progress":    { label: "In Progress",   color: "text-blue-700",    bg: "bg-blue-50",    border: "border-blue-200",    bar: "bg-blue-500",    icon: <Clock className="size-3" /> },
  "Pending Review": { label: "In Review",     color: "text-violet-700",  bg: "bg-violet-50",  border: "border-violet-200",  bar: "bg-violet-500",  icon: <FileText className="size-3" /> },
  "In Review":      { label: "In Review",     color: "text-violet-700",  bg: "bg-violet-50",  border: "border-violet-200",  bar: "bg-violet-500",  icon: <FileText className="size-3" /> },
  Done:             { label: "Completed",     color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200", bar: "bg-emerald-500", icon: <CheckCircle2 className="size-3" /> },
  Closed:           { label: "Closed",        color: "text-slate-600",   bg: "bg-slate-100",  border: "border-slate-200",   bar: "bg-slate-400",   icon: <CheckCircle2 className="size-3" /> },
};

const PRIORITY_CFG: Record<string, { dot: string; text: string; border: string; bg: string }> = {
  Critical: { dot: "bg-rose-500",    text: "text-rose-700",   border: "border-rose-200",   bg: "bg-rose-50" },
  High:     { dot: "bg-orange-500",  text: "text-orange-700", border: "border-orange-200", bg: "bg-orange-50" },
  Medium:   { dot: "bg-amber-500",   text: "text-amber-700",  border: "border-amber-200",  bg: "bg-amber-50" },
  Low:      { dot: "bg-emerald-400", text: "text-emerald-700",border: "border-emerald-200",bg: "bg-emerald-50" },
};

const REVIEW_CFG: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  pending:            { label: "Awaiting Your Review", color: "text-amber-700",   bg: "bg-amber-50",   border: "border-amber-300",   icon: <Hourglass className="size-3.5" /> },
  approved:           { label: "You Approved",         color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-300", icon: <ThumbsUp className="size-3.5" /> },
  changes_requested:  { label: "Changes Requested",    color: "text-rose-700",    bg: "bg-rose-50",    border: "border-rose-300",    icon: <MessageSquare className="size-3.5" /> },
};

function StatCard({
  icon, label, value, sub, iconBg, alert,
}: {
  icon: React.ReactNode; label: string; value: string | number;
  sub?: string; iconBg: string; alert?: boolean;
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border p-5 shadow-sm bg-white ${alert ? "border-amber-300 ring-1 ring-amber-200" : "border-slate-200"}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
          <p className="mt-1.5 text-3xl font-black text-slate-900">{value}</p>
          {sub && <p className="mt-1 text-xs text-slate-500">{sub}</p>}
        </div>
        <div className={`flex size-11 shrink-0 items-center justify-center rounded-2xl shadow-sm ${iconBg}`}>
          {icon}
        </div>
      </div>
      {alert && (
        <div className="absolute top-2 right-2 size-2 rounded-full bg-amber-400 animate-pulse" />
      )}
    </div>
  );
}

const ChartTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-slate-700">{label}</p>
      <p className="text-sky-600 font-bold">{payload[0].value} request{payload[0].value !== 1 ? "s" : ""}</p>
    </div>
  );
};

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function StakeholderDashboardPage() {
  const [stats, setStats]       = useState<DashboardStats | null>(null);
  const [loading, setLoading]   = useState(true);
  const [userName, setUserName] = useState("there");

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const token = await ensureAuth();
      const res = await fetch(`${API}/api/requests/dashboard-stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setStats(await res.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const meta = getUserMeta();
    if (meta?.name) setUserName(meta.name.split(" ")[0]);
    else if (meta?.email) setUserName(meta.email.split("@")[0]);
    fetchStats();
  }, [fetchStats]);

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="h-28 rounded-2xl bg-gradient-to-r from-sky-500 to-teal-600 animate-pulse" />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-28 rounded-2xl bg-slate-100 animate-pulse" />)}
        </div>
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2 h-64 rounded-2xl bg-slate-100 animate-pulse" />
          <div className="h-64 rounded-2xl bg-slate-100 animate-pulse" />
        </div>
      </div>
    );
  }

  const s = stats;
  const reqTotal   = s?.requests.total ?? 0;
  const byStatus   = s?.requests.by_status ?? {};
  const byPriority = s?.requests.by_priority ?? {};
  const trendData  = s?.requests.trend ?? [];
  const recent     = s?.requests.recent ?? [];
  const brdReviews = s?.brd_reviews ?? [];
  const sharedCount = s?.shared_count ?? 0;

  const activeCount     = (byStatus["Submitted"] ?? 0) + (byStatus["In Progress"] ?? 0);
  const inReviewCount   = (byStatus["Pending Review"] ?? 0) + (byStatus["In Review"] ?? 0);
  const completedCount  = (byStatus["Done"] ?? 0) + (byStatus["Closed"] ?? 0);
  const pendingReviews  = brdReviews.filter(b => b.review_status === "pending");
  const approvedBrds    = brdReviews.filter(b => b.review_status === "approved");

  const STATUS_ORDER = ["Submitted", "In Progress", "In Review", "Pending Review", "Done", "Closed"];
  const PRIORITY_ORDER = ["Critical", "High", "Medium", "Low"];

  return (
    <div className="space-y-5">

      {/* ── Hero Header ─────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-sky-500 via-sky-600 to-teal-600 px-7 py-6 shadow-lg shadow-sky-200">
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: "radial-gradient(circle at 20% 80%, white 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
        <div className="relative flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-sky-200">{greeting()},</p>
            <h1 className="mt-0.5 text-2xl font-black text-white">{userName}</h1>
            <p className="mt-1 text-xs text-sky-300">{today}</p>
            <div className="mt-3 flex items-center gap-3 flex-wrap">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white">
                <Users className="size-3" /> Stakeholder
              </span>
              {pendingReviews.length > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/25 px-3 py-1 text-xs font-semibold text-amber-100">
                  <Bell className="size-3" /> {pendingReviews.length} BRD{pendingReviews.length !== 1 ? "s" : ""} pending your review
                </span>
              )}
              {sharedCount > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-sky-100">
                  <Users className="size-3" /> {sharedCount} shared request{sharedCount !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>
          <div className="hidden lg:flex items-end gap-6 text-right">
            <div>
              <p className="text-3xl font-black text-white">{reqTotal}</p>
              <p className="text-xs text-sky-300">Total Requests</p>
            </div>
            <div className="h-10 w-px bg-white/20" />
            <div>
              <p className="text-3xl font-black text-white">{activeCount}</p>
              <p className="text-xs text-sky-300">Active</p>
            </div>
            <div className="h-10 w-px bg-white/20" />
            <div>
              <p className="text-3xl font-black text-white">{completedCount}</p>
              <p className="text-xs text-sky-300">Completed</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI Cards ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={<ClipboardList className="size-5 text-white" />}
          label="Total Requests"
          value={reqTotal}
          sub={`${sharedCount} shared with me`}
          iconBg="bg-gradient-to-br from-sky-500 to-sky-600"
        />
        <StatCard
          icon={<Clock className="size-5 text-white" />}
          label="Active"
          value={activeCount}
          sub={`${byStatus["Submitted"] ?? 0} submitted · ${byStatus["In Progress"] ?? 0} in progress`}
          iconBg="bg-gradient-to-br from-amber-400 to-orange-500"
          alert={activeCount > 0}
        />
        <StatCard
          icon={<FileText className="size-5 text-white" />}
          label="In Review"
          value={inReviewCount}
          sub={`${pendingReviews.length} BRD${pendingReviews.length !== 1 ? "s" : ""} awaiting your sign-off`}
          iconBg="bg-gradient-to-br from-violet-500 to-violet-600"
          alert={pendingReviews.length > 0}
        />
        <StatCard
          icon={<CheckCircle2 className="size-5 text-white" />}
          label="Completed"
          value={completedCount}
          sub={`${approvedBrds.length} BRD${approvedBrds.length !== 1 ? "s" : ""} you approved`}
          iconBg="bg-gradient-to-br from-emerald-500 to-teal-600"
        />
      </div>

      {/* ── Middle Row: Status + Priority + BRD Reviews ─────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">

        {/* Request Status Breakdown */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-xl bg-sky-50">
                <BarChart2 className="size-4 text-sky-600" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">Request Status</h3>
            </div>
            <span className="text-xs text-slate-400">{reqTotal} total</span>
          </div>
          <div className="space-y-3">
            {STATUS_ORDER.filter(st => (byStatus[st] ?? 0) > 0 || ["Submitted", "In Progress"].includes(st)).map(st => {
              const cnt = byStatus[st] ?? 0;
              const cfg = STATUS_CFG[st] ?? STATUS_CFG.Submitted;
              const pct = reqTotal > 0 ? Math.round((cnt / reqTotal) * 100) : 0;
              return (
                <div key={st} className="flex items-center gap-3">
                  <span className="w-24 shrink-0 text-xs font-semibold text-slate-600 truncate">{cfg.label}</span>
                  <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className={`h-full rounded-full transition-all duration-700 ${cfg.bar}`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="w-6 text-right text-xs font-bold text-slate-700">{cnt}</span>
                </div>
              );
            })}
            {reqTotal === 0 && <p className="py-4 text-center text-xs text-slate-400">No requests submitted yet</p>}
          </div>

          {/* Quick status row */}
          {reqTotal > 0 && (
            <div className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3">
              {[
                { label: "Active",    val: activeCount,    color: "text-amber-600"   },
                { label: "In Review", val: inReviewCount,  color: "text-violet-600"  },
                { label: "Done",      val: completedCount, color: "text-emerald-600" },
              ].map(({ label, val, color }) => (
                <div key={label} className="rounded-xl bg-slate-50 py-2 text-center">
                  <p className={`text-lg font-black ${color}`}>{val}</p>
                  <p className="text-[10px] text-slate-500">{label}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Priority Breakdown */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-xl bg-rose-50">
              <Star className="size-4 text-rose-500" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">Priority Breakdown</h3>
          </div>
          <div className="space-y-2.5">
            {PRIORITY_ORDER.map(p => {
              const cnt = byPriority[p] ?? 0;
              const cfg = PRIORITY_CFG[p];
              const pct = reqTotal > 0 ? Math.round((cnt / reqTotal) * 100) : 0;
              return (
                <div key={p} className={`flex items-center justify-between rounded-xl border px-3 py-2.5 ${cfg.bg} ${cfg.border}`}>
                  <div className="flex items-center gap-2">
                    <span className={`size-2 rounded-full shrink-0 ${cfg.dot}`} />
                    <span className={`text-xs font-semibold ${cfg.text}`}>{p}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-16 rounded-full bg-white/60 overflow-hidden">
                      <div className={`h-full rounded-full ${cfg.dot}`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className={`text-sm font-black w-5 text-right ${cfg.text}`}>{cnt}</span>
                  </div>
                </div>
              );
            })}
            {reqTotal === 0 && <p className="py-4 text-center text-xs text-slate-400">No data</p>}
          </div>
        </div>

        {/* BRD Review Queue */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm overflow-hidden">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className={`flex size-8 items-center justify-center rounded-xl ${pendingReviews.length > 0 ? "bg-amber-50" : "bg-slate-50"}`}>
                <FileText className={`size-4 ${pendingReviews.length > 0 ? "text-amber-500" : "text-slate-400"}`} />
              </div>
              <h3 className="text-sm font-bold text-slate-800">BRD Reviews</h3>
            </div>
            {pendingReviews.length > 0 && (
              <span className="flex size-5 items-center justify-center rounded-full bg-amber-400 text-[10px] font-bold text-white">
                {pendingReviews.length}
              </span>
            )}
          </div>
          {brdReviews.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <FileText className="size-8 mb-2 text-slate-200" />
              <p className="text-xs text-slate-400">No BRDs to review yet</p>
              <p className="text-[10px] text-slate-300 mt-1">BRDs shared by your BA will appear here</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {brdReviews.map(b => {
                const rCfg = REVIEW_CFG[b.review_status] ?? REVIEW_CFG.pending;
                return (
                  <div key={`${b.id}-${b.review_status}`} className={`rounded-xl border p-3 ${rCfg.bg} ${rCfg.border}`}>
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <p className="text-xs font-semibold text-slate-800 leading-snug line-clamp-1">
                        {b.brd_title || b.request_title}
                      </p>
                      <span className="font-mono text-[10px] text-slate-400 shrink-0">v{b.version}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className={`flex items-center gap-1 text-[10px] font-semibold ${rCfg.color}`}>
                        {rCfg.icon} {rCfg.label}
                      </span>
                      <span className="text-[10px] text-slate-400">{timeAgo(b.updated_at)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Activity Trend ───────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-xl bg-sky-50">
              <TrendingUp className="size-4 text-sky-600" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Request Activity</h3>
              <p className="text-[10px] text-slate-400">Last 14 days</p>
            </div>
          </div>
          <button onClick={fetchStats} className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-500 hover:bg-slate-50 transition-colors">
            <RefreshCw className="size-3" /> Refresh
          </button>
        </div>
        <div className="h-48">
          {trendData.some(d => d.count > 0) ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="sky-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#0ea5e9" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} interval={1} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="count" stroke="#0ea5e9" strokeWidth={2} fill="url(#sky-grad)" dot={false} activeDot={{ r: 4, fill: "#0ea5e9" }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">
              No request activity in the last 14 days
            </div>
          )}
        </div>
      </div>

      {/* ── Recent Requests Table ────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-xl bg-sky-50">
              <ClipboardList className="size-4 text-sky-600" />
            </div>
            <h3 className="text-sm font-bold text-slate-800">My Recent Requests</h3>
          </div>
          <a href="/stakeholder/my-requests" className="flex items-center gap-1 text-xs font-medium text-sky-600 hover:text-sky-700">
            View all <ArrowRight className="size-3" />
          </a>
        </div>
        {recent.length === 0 ? (
          <div className="flex flex-col items-center py-14 text-center">
            <ClipboardList className="size-10 mb-3 text-slate-200" />
            <p className="text-sm font-semibold text-slate-500">No requests yet</p>
            <p className="text-xs text-slate-400 mt-1">Submit a business problem to get started</p>
            <a href="/stakeholder/submit-problem"
              className="mt-3 flex items-center gap-1.5 rounded-xl bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-700 transition-colors">
              <SendHorizonal className="size-3" /> Submit New Request
            </a>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50">
                    {["Request", "Category", "Priority", "Status", "Assigned BA", "Updated"].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-slate-400">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {recent.map(r => {
                    const sCfg = STATUS_CFG[r.status] ?? STATUS_CFG.Submitted;
                    const pCfg = PRIORITY_CFG[r.priority];
                    return (
                      <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 py-3.5">
                          <p className="font-semibold text-slate-800 leading-snug">{r.title}</p>
                          <span className="font-mono text-[10px] text-slate-400">{r.req_number}</span>
                        </td>
                        <td className="px-4 py-3.5 text-xs text-slate-600">{r.category}</td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold ${pCfg?.bg} ${pCfg?.border} ${pCfg?.text}`}>
                            <span className={`size-1.5 rounded-full ${pCfg?.dot}`} />
                            {r.priority}
                          </span>
                        </td>
                        <td className="px-4 py-3.5">
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-bold ${sCfg.color} ${sCfg.bg} ${sCfg.border}`}>
                            {sCfg.icon} {sCfg.label}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-xs text-slate-600">
                          {r.ba_name || r.ba_email || <span className="italic text-slate-400">Unassigned</span>}
                        </td>
                        <td className="px-4 py-3.5 text-xs text-slate-400">{timeAgo(r.updated_at)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* ── Pending BRD Review Alert ─────────────────────────────────────────── */}
      {pendingReviews.length > 0 && (
        <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 px-5 py-4 shadow-sm">
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex size-8 items-center justify-center rounded-xl bg-amber-100">
              <Bell className="size-4 text-amber-600" />
            </div>
            <div>
              <p className="text-sm font-bold text-amber-800">BRDs Awaiting Your Review</p>
              <p className="text-xs text-amber-600">{pendingReviews.length} document{pendingReviews.length !== 1 ? "s" : ""} need{pendingReviews.length === 1 ? "s" : ""} your approval</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {pendingReviews.map(b => (
              <div key={b.id} className="rounded-xl border border-amber-200 bg-white px-3 py-2">
                <p className="text-xs font-semibold text-slate-700 line-clamp-1 max-w-48">{b.brd_title || b.request_title}</p>
                <p className="text-[10px] text-slate-400 mt-0.5 font-mono">{b.doc_id} · v{b.version}</p>
              </div>
            ))}
          </div>
          <a href="/stakeholder/my-requests"
            className="ml-auto shrink-0 flex items-center gap-1.5 rounded-xl bg-amber-500 px-4 py-2 text-xs font-bold text-white hover:bg-amber-600 transition-colors shadow-sm">
            Review Now <ChevronRight className="size-3" />
          </a>
        </div>
      )}

    </div>
  );
}
