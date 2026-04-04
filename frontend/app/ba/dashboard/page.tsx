"use client";

import { useEffect, useState, useCallback } from "react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import {
  Briefcase, FileText, CheckCircle2, Clock, AlertTriangle,
  TrendingUp, RefreshCw, ArrowRight, ChevronRight,
  Sparkles, Users, MessageSquare, Target, Zap, BarChart2,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5001";

// ── Types ──────────────────────────────────────────────────────────────────────
interface DashboardStats {
  role: "ba";
  requests: {
    total: number;
    by_status: Record<string, number>;
    by_priority: Record<string, number>;
    recent: RecentRequest[];
    trend: TrendPoint[];
  };
  brds: {
    total: number;
    by_status: Record<string, string>;
    recent: RecentBrd[];
    pending_review_count: number;
    total_pending: number;
    total_approved: number;
    total_changes: number;
  };
}

interface RecentRequest {
  id: number; req_number: string; title: string;
  status: string; priority: string; category: string;
  created_at: string; updated_at: string;
  stakeholder_name: string | null; stakeholder_email: string;
}

interface RecentBrd {
  id: number; doc_id: string; version: string; status: string;
  brd_title: string; req_number: string; request_title: string;
  updated_at: string;
  reviews_pending: string; reviews_approved: string;
  reviews_changes: string; reviews_total: string;
}

interface TrendPoint { label: string; count: number; }

// ── Helpers ────────────────────────────────────────────────────────────────────
function decodeToken(t: string) {
  try { return JSON.parse(atob(t.split(".")[1])); } catch { return null; }
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

const STATUS_CFG: Record<string, { label: string; color: string; bg: string; bar: string }> = {
  Submitted:        { label: "Submitted",        color: "text-amber-700",   bg: "bg-amber-50 border-amber-200",   bar: "bg-amber-400" },
  "In Progress":    { label: "In Progress",       color: "text-blue-700",    bg: "bg-blue-50 border-blue-200",     bar: "bg-blue-500" },
  "Pending Review": { label: "Pending Review",    color: "text-violet-700",  bg: "bg-violet-50 border-violet-200", bar: "bg-violet-500" },
  "In Review":      { label: "In Review",         color: "text-violet-700",  bg: "bg-violet-50 border-violet-200", bar: "bg-violet-500" },
  Done:             { label: "Done",              color: "text-emerald-700", bg: "bg-emerald-50 border-emerald-200", bar: "bg-emerald-500" },
  Closed:           { label: "Closed",            color: "text-slate-600",   bg: "bg-slate-50 border-slate-200",   bar: "bg-slate-400" },
};

const PRIORITY_CFG: Record<string, { dot: string; text: string; border: string; bg: string }> = {
  Critical: { dot: "bg-rose-500",   text: "text-rose-700",   border: "border-rose-200",   bg: "bg-rose-50" },
  High:     { dot: "bg-orange-500", text: "text-orange-700", border: "border-orange-200", bg: "bg-orange-50" },
  Medium:   { dot: "bg-amber-500",  text: "text-amber-700",  border: "border-amber-200",  bg: "bg-amber-50" },
  Low:      { dot: "bg-emerald-400",text: "text-emerald-700",border: "border-emerald-200",bg: "bg-emerald-50" },
};

const BRD_STATUS_CFG: Record<string, { color: string; bg: string; border: string }> = {
  Draft:       { color: "text-amber-700",   bg: "bg-amber-50",   border: "border-amber-200" },
  "In Review": { color: "text-blue-700",    bg: "bg-blue-50",    border: "border-blue-200" },
  Approved:    { color: "text-violet-700",  bg: "bg-violet-50",  border: "border-violet-200" },
  Final:       { color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
};

function StatCard({
  icon, label, value, sub, gradient, iconBg,
}: {
  icon: React.ReactNode; label: string; value: string | number;
  sub?: string; gradient: string; iconBg: string;
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border p-5 shadow-sm ${gradient}`}>
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
    </div>
  );
}

function StatusBar({ label, count, total, cfg }: { label: string; count: number; total: number; cfg: typeof STATUS_CFG[string] }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-28 shrink-0 text-xs font-semibold text-slate-600 truncate">{cfg?.label ?? label}</span>
      <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ${cfg?.bar ?? "bg-slate-400"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-8 text-right text-xs font-bold text-slate-700">{count}</span>
      <span className="w-8 text-right text-[10px] text-slate-400">{pct}%</span>
    </div>
  );
}

// ── Custom Recharts tooltip ────────────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-lg text-xs">
      <p className="font-semibold text-slate-700">{label}</p>
      <p className="text-indigo-600 font-bold">{payload[0].value} request{payload[0].value !== 1 ? "s" : ""}</p>
    </div>
  );
};

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function BADashboardPage() {
  const [stats, setStats]       = useState<DashboardStats | null>(null);
  const [loading, setLoading]   = useState(true);
  const [userName, setUserName] = useState("Analyst");

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("authToken");
      const res = await fetch(`${API}/api/requests/dashboard-stats`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setStats(await res.json());
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("authToken");
    if (token) {
      const d = decodeToken(token);
      if (d?.name) setUserName(d.name.split(" ")[0]);
      else if (d?.email) setUserName(d.email.split("@")[0]);
    }
    fetchStats();
  }, [fetchStats]);

  const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  if (loading) {
    return (
      <div className="space-y-5">
        {/* Skeleton header */}
        <div className="h-28 rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 animate-pulse" />
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
  const reqTotal  = s?.requests.total ?? 0;
  const byStatus  = s?.requests.by_status ?? {};
  const byPriority = s?.requests.by_priority ?? {};
  const trendData  = s?.requests.trend ?? [];
  const recent    = s?.requests.recent ?? [];
  const brds      = s?.brds ?? { total: 0, by_status: {}, recent: [], pending_review_count: 0, total_pending: 0, total_approved: 0, total_changes: 0 };

  const activeCount = (byStatus["Submitted"] ?? 0) + (byStatus["In Progress"] ?? 0) + (byStatus["Pending Review"] ?? 0) + (byStatus["In Review"] ?? 0);
  const doneCount   = (byStatus["Done"] ?? 0) + (byStatus["Closed"] ?? 0);

  const STATUS_ORDER = ["Submitted", "In Progress", "In Review", "Pending Review", "Done", "Closed"];
  const PRIORITY_ORDER = ["Critical", "High", "Medium", "Low"];

  return (
    <div className="space-y-5">

      {/* ── Hero Header ─────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-700 px-7 py-6 shadow-lg shadow-indigo-200">
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: "radial-gradient(circle at 80% 20%, white 1px, transparent 1px)", backgroundSize: "28px 28px" }} />
        <div className="relative flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-indigo-200">{greeting()},</p>
            <h1 className="mt-0.5 text-2xl font-black text-white">{userName}</h1>
            <p className="mt-1 text-xs text-indigo-300">{today}</p>
            <div className="mt-3 flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white">
                <Briefcase className="size-3" /> Business Analyst
              </span>
              {brds.pending_review_count > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/20 px-3 py-1 text-xs font-semibold text-amber-200">
                  <AlertTriangle className="size-3" /> {brds.pending_review_count} BRD{brds.pending_review_count !== 1 ? "s" : ""} awaiting stakeholder review
                </span>
              )}
            </div>
          </div>
          <div className="hidden lg:flex items-end gap-6 text-right">
            <div>
              <p className="text-3xl font-black text-white">{reqTotal}</p>
              <p className="text-xs text-indigo-300">Total Requests</p>
            </div>
            <div className="h-10 w-px bg-white/20" />
            <div>
              <p className="text-3xl font-black text-white">{brds.total}</p>
              <p className="text-xs text-indigo-300">BRDs Created</p>
            </div>
            <div className="h-10 w-px bg-white/20" />
            <div>
              <p className="text-3xl font-black text-white">{activeCount}</p>
              <p className="text-xs text-indigo-300">Active</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI Cards ───────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          icon={<Briefcase className="size-5 text-white" />}
          label="Total Requests"
          value={reqTotal}
          sub={`${activeCount} active · ${doneCount} closed`}
          gradient="bg-white border-slate-200"
          iconBg="bg-gradient-to-br from-indigo-500 to-indigo-600"
        />
        <StatCard
          icon={<Zap className="size-5 text-white" />}
          label="Active"
          value={activeCount}
          sub={`${byStatus["Submitted"] ?? 0} awaiting action`}
          gradient="bg-white border-slate-200"
          iconBg="bg-gradient-to-br from-amber-400 to-orange-500"
        />
        <StatCard
          icon={<FileText className="size-5 text-white" />}
          label="BRDs Created"
          value={brds.total}
          sub={`${brds.by_status["Approved"] ?? 0} approved · ${brds.by_status["Final"] ?? 0} final`}
          gradient="bg-white border-slate-200"
          iconBg="bg-gradient-to-br from-violet-500 to-violet-600"
        />
        <StatCard
          icon={<CheckCircle2 className="size-5 text-white" />}
          label="Reviews Approved"
          value={brds.total_approved}
          sub={`${brds.total_pending} pending · ${brds.total_changes} change req.`}
          gradient="bg-white border-slate-200"
          iconBg="bg-gradient-to-br from-emerald-500 to-teal-600"
        />
      </div>

      {/* ── Mid Row: Status Breakdown + Priority + BRD Pipeline ─────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">

        {/* Request Status Breakdown */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-xl bg-indigo-50">
                <BarChart2 className="size-4 text-indigo-600" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">Request Status</h3>
            </div>
            <span className="text-xs text-slate-400">{reqTotal} total</span>
          </div>
          <div className="space-y-3">
            {STATUS_ORDER.filter(s => (byStatus[s] ?? 0) > 0 || ["Submitted", "In Progress"].includes(s)).map(s => (
              <StatusBar
                key={s} label={s}
                count={byStatus[s] ?? 0}
                total={reqTotal}
                cfg={STATUS_CFG[s] ?? STATUS_CFG.Submitted}
              />
            ))}
            {reqTotal === 0 && (
              <p className="py-4 text-center text-xs text-slate-400">No requests assigned yet</p>
            )}
          </div>
        </div>

        {/* Priority Breakdown */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-xl bg-rose-50">
              <Target className="size-4 text-rose-500" />
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

        {/* BRD Pipeline */}
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-xl bg-violet-50">
                <FileText className="size-4 text-violet-600" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">BRD Pipeline</h3>
            </div>
            <span className="text-xs text-slate-400">{brds.total} total</span>
          </div>
          <div className="space-y-2">
            {(["Draft", "In Review", "Approved", "Final"] as const).map(s => {
              const cnt = parseInt(String(brds.by_status[s] ?? 0));
              const cfg = BRD_STATUS_CFG[s];
              return (
                <div key={s} className={`flex items-center justify-between rounded-xl border px-3 py-2.5 ${cfg.bg} ${cfg.border}`}>
                  <span className={`text-xs font-semibold ${cfg.color}`}>{s}</span>
                  <span className={`text-xl font-black ${cfg.color}`}>{cnt}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-4 border-t border-slate-100 pt-3 grid grid-cols-3 gap-2 text-center">
            {[
              { label: "Pending Review", val: brds.total_pending, color: "text-amber-600" },
              { label: "Approved", val: brds.total_approved, color: "text-emerald-600" },
              { label: "Changes Req.", val: brds.total_changes, color: "text-rose-600" },
            ].map(({ label, val, color }) => (
              <div key={label} className="rounded-xl bg-slate-50 py-2">
                <p className={`text-lg font-black ${color}`}>{val}</p>
                <p className="text-[10px] text-slate-500 leading-tight">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Trend Chart ─────────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-xl bg-indigo-50">
              <TrendingUp className="size-4 text-indigo-600" />
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
        <div className="h-52">
          {trendData.some(d => d.count > 0) ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="indigo-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#6366f1" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} interval={1} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2} fill="url(#indigo-grad)" dot={false} activeDot={{ r: 4, fill: "#6366f1" }} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-sm text-slate-400">
              No request activity in the last 14 days
            </div>
          )}
        </div>
      </div>

      {/* ── Bottom Row: Recent Requests + Recent BRDs ────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">

        {/* Recent Requests */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-xl bg-blue-50">
                <Briefcase className="size-4 text-blue-600" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">Recent Requests</h3>
            </div>
            <a href="/ba/assigned-problems" className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700">
              View all <ArrowRight className="size-3" />
            </a>
          </div>
          {recent.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-slate-400">
              <Briefcase className="size-8 mb-2 text-slate-200" />
              <p className="text-sm">No requests assigned yet</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {recent.map(r => {
                const sCfg = STATUS_CFG[r.status] ?? STATUS_CFG.Submitted;
                const pCfg = PRIORITY_CFG[r.priority];
                return (
                  <div key={r.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50/60 transition-colors">
                    <div className={`size-1.5 shrink-0 rounded-full ${pCfg?.dot ?? "bg-slate-300"}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-800 truncate">{r.title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-mono text-[10px] text-slate-400">{r.req_number}</span>
                        <span className="text-[10px] text-slate-400">·</span>
                        <span className="text-[10px] text-slate-500 truncate">{r.stakeholder_name || r.stakeholder_email}</span>
                      </div>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${sCfg.color} ${sCfg.bg}`}>
                      {r.status}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent BRDs */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div className="flex items-center gap-2">
              <div className="flex size-8 items-center justify-center rounded-xl bg-violet-50">
                <FileText className="size-4 text-violet-600" />
              </div>
              <h3 className="text-sm font-bold text-slate-800">Recent BRDs</h3>
            </div>
            <a href="/ba/brd-management" className="flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700">
              View all <ArrowRight className="size-3" />
            </a>
          </div>
          {brds.recent.length === 0 ? (
            <div className="flex flex-col items-center py-12 text-slate-400">
              <FileText className="size-8 mb-2 text-slate-200" />
              <p className="text-sm">No BRDs created yet</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-50">
              {brds.recent.map(b => {
                const bCfg = BRD_STATUS_CFG[b.status] ?? BRD_STATUS_CFG.Draft;
                const pending = parseInt(b.reviews_pending);
                const changes = parseInt(b.reviews_changes);
                return (
                  <div key={b.id} className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50/60 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-800 truncate">{b.brd_title || b.request_title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-mono text-[10px] text-slate-400">{b.doc_id}</span>
                        <span className="text-[10px] text-slate-400">v{b.version}</span>
                        {pending > 0 && (
                          <span className="text-[10px] text-amber-600 font-semibold">{pending} pending</span>
                        )}
                        {changes > 0 && (
                          <span className="text-[10px] text-rose-600 font-semibold">{changes} change req.</span>
                        )}
                      </div>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold ${bCfg.color} ${bCfg.bg} ${bCfg.border}`}>
                      {b.status}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Action Items Banner ─────────────────────────────────────────────── */}
      {(brds.total_changes > 0 || brds.pending_review_count > 0) && (
        <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4">
          <div className="flex items-center gap-2 shrink-0">
            <AlertTriangle className="size-4 text-amber-500" />
            <span className="text-sm font-bold text-amber-800">Action Required</span>
          </div>
          <div className="flex flex-wrap gap-3">
            {brds.total_changes > 0 && (
              <a href="/ba/brd-management"
                className="flex items-center gap-1.5 rounded-xl bg-amber-100 border border-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-200 transition-colors">
                <Sparkles className="size-3" />
                {brds.total_changes} BRD{brds.total_changes !== 1 ? "s" : ""} with change requests — enhance from feedback
                <ChevronRight className="size-3" />
              </a>
            )}
            {brds.pending_review_count > 0 && (
              <a href="/ba/brd-management"
                className="flex items-center gap-1.5 rounded-xl bg-blue-100 border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-700 hover:bg-blue-200 transition-colors">
                <MessageSquare className="size-3" />
                {brds.pending_review_count} BRD{brds.pending_review_count !== 1 ? "s" : ""} awaiting stakeholder review
                <ChevronRight className="size-3" />
              </a>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
