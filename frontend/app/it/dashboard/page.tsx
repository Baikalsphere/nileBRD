"use client";

import { useEffect, useState } from "react";
import {
  FileCheck2, FolderOpen, FlaskConical, AlertTriangle,
  CheckCircle2, Clock, TrendingUp, ArrowRight,
  Layers, Users, ShieldCheck, Activity,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { ensureAuth, getUserMeta } from "@/lib/authGuard";

const API = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:5001";

interface Stats {
  brd_stats:   { total_received: number; with_frd: number; pending_frd: number };
  frd_stats:   { total: number; draft: number; in_review: number; approved: number; with_test_cases: number };
  tc_stats:    { total_suites: number; total_cases: number; critical: number; system_cases: number; uat_cases: number };
  recent_brds: { id: number; doc_id: string; title: string; category: string; priority: string; submitted_at: string; submitted_by_name: string; has_frd: boolean }[];
  recent_frds: { id: number; doc_id: string; status: string; generated_at: string; title: string; request_title: string; req_number: string; has_test_cases: boolean }[];
  trend:       { label: string; brds: number; frds: number }[];
}

const PRIORITY_COLOR: Record<string, string> = {
  Critical: "bg-red-100 text-red-700",
  High:     "bg-orange-100 text-orange-700",
  Medium:   "bg-amber-100 text-amber-700",
  Low:      "bg-slate-100 text-slate-600",
  "Must Have":    "bg-red-100 text-red-700",
  "Should Have":  "bg-orange-100 text-orange-700",
  "Could Have":   "bg-amber-100 text-amber-700",
};

const FRD_STATUS_COLOR: Record<string, string> = {
  Draft:      "bg-amber-100 text-amber-700",
  "In Review":"bg-blue-100 text-blue-700",
  Approved:   "bg-emerald-100 text-emerald-700",
  Final:      "bg-violet-100 text-violet-700",
};

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "yesterday" : `${d}d ago`;
}

function StatCard({ label, value, sub, icon, gradient }: {
  label: string; value: number | string; sub?: string;
  icon: React.ReactNode; gradient: string;
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl p-5 text-white shadow-sm ${gradient}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="p-2 bg-white/20 rounded-xl">{icon}</div>
      </div>
      <p className="text-3xl font-bold mb-0.5">{value}</p>
      <p className="text-sm font-semibold opacity-90">{label}</p>
      {sub && <p className="text-xs opacity-70 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function ITDashboardPage() {
  const [stats, setStats]   = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState("IT Manager");

  useEffect(() => {
    const meta = getUserMeta();
    if (meta?.name) setUserName(meta.name.split(" ")[0]);

    ensureAuth().then(token => {
      fetch(`${API}/api/stream/it-dashboard-stats`, {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then(r => r.json())
        .then(d => setStats(d))
        .catch(() => {})
        .finally(() => setLoading(false));
    });
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96 gap-3 text-slate-400">
        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm">Loading dashboard…</span>
      </div>
    );
  }

  const brd = stats?.brd_stats   ?? { total_received: 0, with_frd: 0, pending_frd: 0 };
  const frd = stats?.frd_stats   ?? { total: 0, draft: 0, in_review: 0, approved: 0, with_test_cases: 0 };
  const tc  = stats?.tc_stats    ?? { total_suites: 0, total_cases: 0, critical: 0, system_cases: 0, uat_cases: 0 };
  const trend     = stats?.trend       ?? [];
  const recentBrds = stats?.recent_brds ?? [];
  const recentFrds = stats?.recent_frds ?? [];

  // Pipeline conversion rates
  const frdRate = brd.total_received > 0 ? Math.round((brd.with_frd / brd.total_received) * 100) : 0;
  const tcRate  = frd.total > 0 ? Math.round((frd.with_test_cases / frd.total) * 100) : 0;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero header */}
      <div className="bg-gradient-to-br from-indigo-700 via-blue-700 to-cyan-600 px-8 py-8">
        <div className="mb-1">
          <p className="text-indigo-200 text-sm font-medium">Welcome back,</p>
          <h1 className="text-3xl font-bold text-white">{userName}</h1>
        </div>
        <p className="text-indigo-300 text-sm mt-1">
          {brd.pending_frd > 0
            ? `${brd.pending_frd} BRD${brd.pending_frd > 1 ? "s" : ""} awaiting FRD generation`
            : "All received BRDs have FRDs generated"}
        </p>
      </div>

      <div className="px-8 py-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="BRDs Received" value={brd.total_received}
            sub={`${brd.pending_frd} pending FRD`}
            icon={<FileCheck2 className="w-5 h-5 text-white" />}
            gradient="bg-gradient-to-br from-indigo-500 to-indigo-700"
          />
          <StatCard
            label="FRDs Generated" value={frd.total}
            sub={`${frd.with_test_cases} with test suites`}
            icon={<FolderOpen className="w-5 h-5 text-white" />}
            gradient="bg-gradient-to-br from-violet-500 to-violet-700"
          />
          <StatCard
            label="Test Suites" value={tc.total_suites}
            sub={`${tc.total_cases} total cases`}
            icon={<FlaskConical className="w-5 h-5 text-white" />}
            gradient="bg-gradient-to-br from-teal-500 to-teal-700"
          />
          <StatCard
            label="Critical Cases" value={tc.critical}
            sub={`${tc.system_cases} system · ${tc.uat_cases} UAT`}
            icon={<AlertTriangle className="w-5 h-5 text-white" />}
            gradient="bg-gradient-to-br from-rose-500 to-rose-700"
          />
        </div>

        {/* Pipeline + FRD Status */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Pipeline progress */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h2 className="font-bold text-slate-800 mb-5 flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-500" /> Pipeline Overview
            </h2>
            <div className="space-y-5">
              {/* Stage 1 */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <FileCheck2 className="w-4 h-4 text-indigo-500" />
                    <span className="text-sm font-semibold text-slate-700">BRDs Received</span>
                  </div>
                  <span className="text-sm font-bold text-slate-800">{brd.total_received}</span>
                </div>
                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-indigo-500 rounded-full" style={{ width: "100%" }} />
                </div>
                <div className="flex justify-between text-[11px] text-slate-400 mt-1">
                  <span>{brd.with_frd} converted to FRD</span>
                  <span>{brd.pending_frd} pending</span>
                </div>
              </div>

              {/* Arrow */}
              <div className="flex justify-center"><ArrowRight className="w-4 h-4 text-slate-300" /></div>

              {/* Stage 2 */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <FolderOpen className="w-4 h-4 text-violet-500" />
                    <span className="text-sm font-semibold text-slate-700">FRDs Generated</span>
                  </div>
                  <span className="text-sm font-bold text-slate-800">{brd.with_frd} / {brd.total_received} <span className="text-xs font-normal text-slate-400">({frdRate}%)</span></span>
                </div>
                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${frdRate}%` }} />
                </div>
              </div>

              {/* Arrow */}
              <div className="flex justify-center"><ArrowRight className="w-4 h-4 text-slate-300" /></div>

              {/* Stage 3 */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <FlaskConical className="w-4 h-4 text-teal-500" />
                    <span className="text-sm font-semibold text-slate-700">Test Cases Generated</span>
                  </div>
                  <span className="text-sm font-bold text-slate-800">{frd.with_test_cases} / {frd.total} <span className="text-xs font-normal text-slate-400">({tcRate}%)</span></span>
                </div>
                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-teal-500 rounded-full transition-all" style={{ width: `${tcRate}%` }} />
                </div>
              </div>
            </div>
          </div>

          {/* FRD Status breakdown */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h2 className="font-bold text-slate-800 mb-5 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-violet-500" /> FRD Status
            </h2>
            <div className="space-y-3">
              {[
                { label: "Draft",      val: frd.draft,      color: "bg-amber-400",  bg: "bg-amber-50",   text: "text-amber-700" },
                { label: "In Review",  val: frd.in_review,  color: "bg-blue-400",   bg: "bg-blue-50",    text: "text-blue-700" },
                { label: "Approved",   val: frd.approved,   color: "bg-emerald-400",bg: "bg-emerald-50", text: "text-emerald-700" },
              ].map(s => {
                const pct = frd.total > 0 ? Math.round((s.val / frd.total) * 100) : 0;
                return (
                  <div key={s.label}>
                    <div className="flex justify-between text-xs mb-1">
                      <span className={`font-semibold ${s.text}`}>{s.label}</span>
                      <span className="text-slate-500">{s.val} ({pct}%)</span>
                    </div>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div className={`h-full ${s.color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-6 pt-4 border-t border-slate-100 space-y-3">
              {[
                { label: "System Cases",      val: tc.system_cases, icon: <Layers className="w-3.5 h-3.5 text-violet-500" />, color: "text-violet-700" },
                { label: "UAT Cases",          val: tc.uat_cases,    icon: <Users className="w-3.5 h-3.5 text-teal-500" />,   color: "text-teal-700" },
                { label: "Critical Priority",  val: tc.critical,     icon: <AlertTriangle className="w-3.5 h-3.5 text-red-500" />, color: "text-red-700" },
              ].map(s => (
                <div key={s.label} className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    {s.icon}{s.label}
                  </div>
                  <span className={`text-sm font-bold ${s.color}`}>{s.val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 14-day Trend Chart */}
        {trend.length > 0 && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h2 className="font-bold text-slate-800 mb-1 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-indigo-500" /> 14-Day Activity Trend
            </h2>
            <p className="text-xs text-slate-400 mb-5">BRDs received and FRDs generated per day</p>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={trend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="brdGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="frdGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} interval={2} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e2e8f0" }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="brds" name="BRDs Received" stroke="#6366f1" fill="url(#brdGrad)" strokeWidth={2} dot={false} />
                <Area type="monotone" dataKey="frds" name="FRDs Generated" stroke="#8b5cf6" fill="url(#frdGrad)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Recent activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Recent BRDs received */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <FileCheck2 className="w-4 h-4 text-indigo-500" /> Recently Received BRDs
              </h2>
              <span className="text-xs text-slate-400">{recentBrds.length} shown</span>
            </div>
            {recentBrds.length === 0 ? (
              <div className="py-10 text-center">
                <FileCheck2 className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-sm text-slate-400">No BRDs received yet</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentBrds.map(b => (
                  <div key={b.id} className="px-5 py-3.5 hover:bg-slate-50 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                      <FileCheck2 className="w-4 h-4 text-indigo-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{b.title || b.doc_id}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${PRIORITY_COLOR[b.priority] ?? "bg-slate-100 text-slate-600"}`}>{b.priority}</span>
                        <span className="text-[11px] text-slate-400">{b.category}</span>
                        <span className="text-[11px] text-slate-400">· {b.submitted_by_name}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-[11px] text-slate-400">{timeAgo(b.submitted_at)}</span>
                      {b.has_frd
                        ? <span className="text-[10px] font-semibold text-emerald-600 flex items-center gap-0.5"><CheckCircle2 className="w-3 h-3" />FRD done</span>
                        : <span className="text-[10px] font-semibold text-amber-600 flex items-center gap-0.5"><Clock className="w-3 h-3" />Needs FRD</span>
                      }
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent FRDs */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <FolderOpen className="w-4 h-4 text-violet-500" /> Recently Generated FRDs
              </h2>
              <span className="text-xs text-slate-400">{recentFrds.length} shown</span>
            </div>
            {recentFrds.length === 0 ? (
              <div className="py-10 text-center">
                <FolderOpen className="w-8 h-8 text-slate-200 mx-auto mb-2" />
                <p className="text-sm text-slate-400">No FRDs generated yet</p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {recentFrds.map(f => (
                  <div key={f.id} className="px-5 py-3.5 hover:bg-slate-50 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center shrink-0">
                      <FolderOpen className="w-4 h-4 text-violet-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 truncate">{f.request_title}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${FRD_STATUS_COLOR[f.status] ?? "bg-slate-100 text-slate-600"}`}>{f.status}</span>
                        <span className="font-mono text-[10px] text-slate-400">{f.doc_id}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-[11px] text-slate-400">{timeAgo(f.generated_at)}</span>
                      {f.has_test_cases
                        ? <span className="text-[10px] font-semibold text-teal-600 flex items-center gap-0.5"><FlaskConical className="w-3 h-3" />TCs done</span>
                        : <span className="text-[10px] font-semibold text-slate-400 flex items-center gap-0.5"><Clock className="w-3 h-3" />No TCs yet</span>
                      }
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
