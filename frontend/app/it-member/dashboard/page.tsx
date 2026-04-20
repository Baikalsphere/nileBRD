"use client";

import { useState } from "react";
import {
  FlaskConical, ClipboardCheck, GitBranch, Bug,
  Rocket, Activity, CheckCircle2, Clock, XCircle,
  AlertTriangle, ArrowRight, TrendingUp,
} from "lucide-react";

function decodeToken(token: string) {
  try { return JSON.parse(atob(token.split(".")[1])); } catch { return null; }
}

const SIT_CASES = [
  { id: "SIT-01", title: "Role-based navigation permissions", status: "Pass" },
  { id: "SIT-02", title: "End-to-end request submission flow", status: "Pass" },
  { id: "SIT-03", title: "BRD to FRD conversion pipeline", status: "Pass" },
  { id: "SIT-04", title: "JWT auth & session expiry", status: "Pass" },
  { id: "SIT-05", title: "File attachment upload & retrieval", status: "Pass" },
  { id: "SIT-06", title: "Database constraint validations", status: "Pass" },
  { id: "SIT-07", title: "Approval modal workflow", status: "Pass" },
  { id: "SIT-08", title: "Stream Chat real-time messaging", status: "Pass" },
  { id: "SIT-09", title: "API rate limiting & error handling", status: "Pass" },
  { id: "SIT-10", title: "Notification delivery & read status", status: "Pass" },
  { id: "SIT-11", title: "PDF export fidelity check", status: "Pass" },
  { id: "SIT-12", title: "Concurrent session handling", status: "Fail" },
  { id: "SIT-13", title: "Performance under 50 concurrent users", status: "In Progress" },
  { id: "SIT-14", title: "Cross-browser rendering", status: "In Progress" },
  { id: "SIT-15", title: "Data migration rollback scenario", status: "Pending" },
];

const UAT_CASES = [
  { id: "UAT-01", title: "Stakeholder submits & tracks request", assignee: "Finance Team", status: "Pass" },
  { id: "UAT-02", title: "BA generates BRD from discussion", assignee: "Operations Lead", status: "Pass" },
  { id: "UAT-03", title: "IT manager reviews & approves FRD", assignee: "IT Lead", status: "In Progress" },
  { id: "UAT-04", title: "UAT sign-off by stakeholder", assignee: "Finance Team", status: "Pending" },
  { id: "UAT-05", title: "Production release observation flow", assignee: "Operations Lead", status: "Pending" },
];

const DEV_TASKS = [
  { id: "DEV-01", title: "Fix concurrent session bug (SIT-12)", priority: "High", status: "In Progress" },
  { id: "DEV-02", title: "Performance optimisation for 50+ users", priority: "High", status: "In Progress" },
  { id: "DEV-03", title: "Cross-browser CSS fixes", priority: "Medium", status: "Pending" },
  { id: "DEV-04", title: "Data migration rollback script", priority: "Medium", status: "Pending" },
];

const STATUS_ICON: Record<string, React.ReactNode> = {
  Pass:        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />,
  Fail:        <XCircle className="w-3.5 h-3.5 text-red-500" />,
  "In Progress": <Clock className="w-3.5 h-3.5 text-amber-500" />,
  Pending:     <Clock className="w-3.5 h-3.5 text-slate-400" />,
};

const STATUS_COLOR: Record<string, string> = {
  Pass:          "bg-emerald-50 text-emerald-700",
  Fail:          "bg-red-50 text-red-700",
  "In Progress": "bg-amber-50 text-amber-700",
  Pending:       "bg-slate-100 text-slate-500",
};

const PRIORITY_COLOR: Record<string, string> = {
  High:   "bg-red-100 text-red-700",
  Medium: "bg-amber-100 text-amber-700",
  Low:    "bg-slate-100 text-slate-500",
};

function StatCard({ label, value, sub, icon, gradient }: {
  label: string; value: string | number; sub?: string;
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

export default function ITMemberDashboard() {
  const [userName] = useState(() => {
    if (typeof window === "undefined") return "Team Member";
    const token = localStorage.getItem("authToken");
    if (!token) return "Team Member";
    const d = decodeToken(token);
    return d?.name?.split(" ")[0] || "Team Member";
  });

  const sitPassed   = SIT_CASES.filter(c => c.status === "Pass").length;
  const sitFailed   = SIT_CASES.filter(c => c.status === "Fail").length;
  const sitPending  = SIT_CASES.filter(c => c.status !== "Pass" && c.status !== "Fail").length;
  const sitRate     = Math.round((sitPassed / SIT_CASES.length) * 100);
  const sitReady    = sitRate >= 90;

  const uatPassed   = UAT_CASES.filter(c => c.status === "Pass").length;
  const uatRate     = Math.round((uatPassed / UAT_CASES.length) * 100);

  const openDefects = 3;
  const activeTasks = DEV_TASKS.filter(t => t.status === "In Progress").length;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero */}
      <div className="bg-gradient-to-br from-cyan-700 via-teal-700 to-indigo-700 px-8 py-8">
        <p className="text-cyan-200 text-sm font-medium">Welcome back,</p>
        <h1 className="text-3xl font-bold text-white">{userName}</h1>
        <p className="text-cyan-300 text-sm mt-1">
          {sitReady
            ? "SIT threshold reached — UAT release is available"
            : `SIT at ${sitRate}% — ${90 - sitRate}% more needed to release for UAT`}
        </p>
      </div>

      <div className="px-8 py-6 space-y-6">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            label="SIT Pass Rate" value={`${sitRate}%`}
            sub={`${sitPassed}/${SIT_CASES.length} cases passed`}
            icon={<FlaskConical className="w-5 h-5 text-white" />}
            gradient={sitReady ? "bg-gradient-to-br from-emerald-500 to-emerald-700" : "bg-gradient-to-br from-cyan-500 to-cyan-700"}
          />
          <StatCard
            label="UAT Progress" value={`${uatRate}%`}
            sub={`${uatPassed}/${UAT_CASES.length} cases complete`}
            icon={<ClipboardCheck className="w-5 h-5 text-white" />}
            gradient="bg-gradient-to-br from-violet-500 to-violet-700"
          />
          <StatCard
            label="Active Dev Tasks" value={activeTasks}
            sub={`${DEV_TASKS.length} total tasks`}
            icon={<GitBranch className="w-5 h-5 text-white" />}
            gradient="bg-gradient-to-br from-indigo-500 to-indigo-700"
          />
          <StatCard
            label="Open Defects" value={openDefects}
            sub="Production monitoring"
            icon={<Bug className="w-5 h-5 text-white" />}
            gradient={openDefects > 0 ? "bg-gradient-to-br from-rose-500 to-rose-700" : "bg-gradient-to-br from-slate-500 to-slate-700"}
          />
        </div>

        {/* SIT + UAT Progress */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* SIT Progress */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h2 className="font-bold text-slate-800 mb-1 flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-cyan-500" /> SIT Testing Progress
            </h2>
            <p className="text-xs text-slate-400 mb-4">90% pass rate required to release for UAT</p>

            {/* Bar */}
            <div className="mb-2">
              <div className="flex justify-between text-xs mb-1">
                <span className="font-semibold text-slate-600">Pass Rate</span>
                <span className={`font-bold ${sitReady ? "text-emerald-600" : "text-cyan-600"}`}>{sitRate}%</span>
              </div>
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${sitReady ? "bg-emerald-500" : "bg-cyan-500"}`}
                  style={{ width: `${sitRate}%` }}
                />
              </div>
              <div className="flex items-center gap-1 mt-1">
                <div className="w-1 h-1 rounded-full bg-slate-300" style={{ marginLeft: "90%" }} />
                <span className="text-[10px] text-slate-400">90% threshold</span>
              </div>
            </div>

            <div className="flex gap-3 mt-4">
              {[
                { label: "Passed", val: sitPassed, color: "text-emerald-600", dot: "bg-emerald-400" },
                { label: "Failed", val: sitFailed, color: "text-red-600", dot: "bg-red-400" },
                { label: "Pending", val: sitPending, color: "text-slate-500", dot: "bg-slate-300" },
              ].map(s => (
                <div key={s.label} className="flex items-center gap-1.5 text-xs">
                  <div className={`w-2 h-2 rounded-full ${s.dot}`} />
                  <span className={s.color}>{s.val} {s.label}</span>
                </div>
              ))}
            </div>

            {sitReady && (
              <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <p className="text-xs text-emerald-700 font-medium">
                  SIT threshold met — go to SIT Testing to release for UAT
                </p>
              </div>
            )}

            {/* Recent cases */}
            <div className="mt-4 space-y-1.5">
              {SIT_CASES.slice(0, 5).map(c => (
                <div key={c.id} className="flex items-center gap-2">
                  {STATUS_ICON[c.status]}
                  <span className="text-xs text-slate-600 flex-1 truncate">{c.title}</span>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${STATUS_COLOR[c.status]}`}>{c.status}</span>
                </div>
              ))}
              <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                <ArrowRight className="w-3 h-3" /> View all in SIT Testing
              </p>
            </div>
          </div>

          {/* UAT Progress */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h2 className="font-bold text-slate-800 mb-1 flex items-center gap-2">
              <ClipboardCheck className="w-4 h-4 text-violet-500" /> UAT Testing Progress
            </h2>
            <p className="text-xs text-slate-400 mb-4">Assigned to stakeholders by role</p>

            <div className="mb-2">
              <div className="flex justify-between text-xs mb-1">
                <span className="font-semibold text-slate-600">Completion Rate</span>
                <span className="font-bold text-violet-600">{uatRate}%</span>
              </div>
              <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${uatRate}%` }} />
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {UAT_CASES.map(c => (
                <div key={c.id} className="flex items-center gap-2">
                  {STATUS_ICON[c.status]}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-700 truncate">{c.title}</p>
                    <p className="text-[10px] text-slate-400">{c.assignee}</p>
                  </div>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${STATUS_COLOR[c.status]}`}>{c.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Dev Tasks + Deployment Pipeline */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Dev Tasks */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <GitBranch className="w-4 h-4 text-indigo-500" /> Active Development Tasks
              </h2>
              <span className="text-xs text-slate-400">{DEV_TASKS.length} tasks</span>
            </div>
            <div className="divide-y divide-slate-100">
              {DEV_TASKS.map(t => (
                <div key={t.id} className="px-5 py-3.5 flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center shrink-0">
                    <GitBranch className="w-4 h-4 text-indigo-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{t.title}</p>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${PRIORITY_COLOR[t.priority]}`}>{t.priority}</span>
                  </div>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${STATUS_COLOR[t.status] ?? "bg-slate-100 text-slate-500"}`}>{t.status}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Deployment Pipeline */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h2 className="font-bold text-slate-800 mb-5 flex items-center gap-2">
              <Rocket className="w-4 h-4 text-indigo-500" /> Deployment Pipeline
            </h2>
            <div className="space-y-3">
              {[
                { env: "SIT", status: "In Progress", color: "text-amber-600", bg: "bg-amber-50 border-amber-200", dot: "bg-amber-400" },
                { env: "UAT", status: "Pending", color: "text-slate-500", bg: "bg-slate-50 border-slate-200", dot: "bg-slate-300" },
                { env: "Production", status: "Pending", color: "text-slate-500", bg: "bg-slate-50 border-slate-200", dot: "bg-slate-300" },
              ].map((stage, i) => (
                <div key={stage.env} className={`flex items-center gap-3 p-3 rounded-xl border ${stage.bg}`}>
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${stage.dot}`} />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-slate-800">{stage.env}</p>
                  </div>
                  <span className={`text-xs font-semibold ${stage.color}`}>{stage.status}</span>
                  {i < 2 && <ArrowRight className="w-3 h-3 text-slate-300 ml-1" />}
                </div>
              ))}
            </div>

            <div className="mt-5 pt-4 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <p className="text-xs text-slate-600">
                  SIT must reach <span className="font-bold text-amber-600">90% pass rate</span> before UAT deployment
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Monitoring summary */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h2 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-teal-500" /> System Monitoring Snapshot
          </h2>
          <div className="grid grid-cols-3 gap-4">
            {[
              { metric: "API Latency", value: "184ms", status: "Healthy", color: "text-emerald-600", bg: "bg-emerald-50" },
              { metric: "Error Rate", value: "0.7%", status: "Healthy", color: "text-emerald-600", bg: "bg-emerald-50" },
              { metric: "Open Defects", value: `${openDefects}`, status: "Monitor", color: "text-amber-600", bg: "bg-amber-50" },
            ].map(m => (
              <div key={m.metric} className={`rounded-xl p-4 ${m.bg}`}>
                <p className="text-xs font-medium text-slate-500">{m.metric}</p>
                <p className="text-xl font-bold text-slate-800 mt-0.5">{m.value}</p>
                <span className={`text-[10px] font-semibold ${m.color}`}>{m.status}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
