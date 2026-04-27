"use client";

import { useState, useEffect } from "react";
import { getUserMeta, ensureAuth } from "@/lib/authGuard";
import {
  FlaskConical, ClipboardCheck, Bug, Rocket,
  CheckCircle2, Clock, XCircle, AlertTriangle,
  ArrowRight, RefreshCw, Inbox,
} from "lucide-react";

const API = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5001";

const STATUS_ICON: Record<string, React.ReactNode> = {
  Pass:          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />,
  Fail:          <XCircle      className="w-3.5 h-3.5 text-red-500" />,
  "In Progress": <Clock        className="w-3.5 h-3.5 text-amber-500" />,
  Pending:       <Clock        className="w-3.5 h-3.5 text-slate-400" />,
};

const STATUS_BADGE: Record<string, string> = {
  Pass:          "bg-emerald-50 text-emerald-700",
  Fail:          "bg-red-50 text-red-700",
  "In Progress": "bg-amber-50 text-amber-700",
  Pending:       "bg-slate-100 text-slate-500",
  Deployed:      "bg-emerald-50 text-emerald-700",
  "In Progress_deploy": "bg-amber-50 text-amber-700",
};

const DEPLOY_DOT: Record<string, string> = {
  Deployed:      "bg-emerald-400",
  "In Progress": "bg-amber-400",
  Partial:       "bg-yellow-400",
  Failed:        "bg-red-400",
  Pending:       "bg-slate-300",
};

const DEPLOY_BG: Record<string, string> = {
  Deployed:      "bg-emerald-50 border-emerald-200",
  "In Progress": "bg-amber-50 border-amber-200",
  Partial:       "bg-yellow-50 border-yellow-200",
  Failed:        "bg-red-50 border-red-200",
  Pending:       "bg-slate-50 border-slate-200",
};

interface DashData {
  sit: { total: number; passed: number; failed: number; in_progress: number; pending: number; pass_rate: number };
  uat: { total: number; passed: number; failed: number; in_progress: number; pending: number; pass_rate: number };
  open_defects: number;
  deployments: { environment: string; status: string; updated_at: string }[];
  recent_sit: { test_case_id: string; title: string | null; status: string; updated_at: string }[];
}

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

function deployStatus(deployments: DashData["deployments"], env: string) {
  return deployments.find(d => d.environment === env)?.status ?? "Pending";
}

export default function ITMemberDashboard() {
  const [userName] = useState(() => {
    const meta = getUserMeta();
    return meta?.name?.split(" ")[0] || "Team Member";
  });
  const [data, setData]       = useState<DashData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const token = await ensureAuth();
      const res = await fetch(`${API}/api/stream/it-member-dashboard`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed to load");
      setData(json);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const sit      = data?.sit;
  const uat      = data?.uat;
  const sitReady = (sit?.pass_rate ?? 0) >= 90;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero */}
      <div className="bg-gradient-to-br from-cyan-700 via-teal-700 to-indigo-700 px-8 py-8 flex items-start justify-between">
        <div>
          <p className="text-cyan-200 text-sm font-medium">Welcome back,</p>
          <h1 className="text-3xl font-bold text-white">{userName}</h1>
          <p className="text-cyan-300 text-sm mt-1">
            {loading ? "Loading dashboard…" :
             sit?.total === 0 ? "No test cases found yet" :
             sitReady
               ? "SIT threshold reached — UAT release is available"
               : `SIT at ${sit?.pass_rate ?? 0}% — ${90 - (sit?.pass_rate ?? 0)}% more needed to release for UAT`}
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="mt-1 flex items-center gap-2 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold px-3 py-2 rounded-xl transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <div className="px-8 py-6 space-y-6">
        {error && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
        )}

        {loading && !data ? (
          <div className="flex items-center justify-center py-24 text-slate-400 gap-3">
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span>Loading dashboard…</span>
          </div>
        ) : data && (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                label="SIT Pass Rate" value={`${sit?.pass_rate ?? 0}%`}
                sub={`${sit?.passed ?? 0}/${sit?.total ?? 0} cases passed`}
                icon={<FlaskConical className="w-5 h-5 text-white" />}
                gradient={sitReady ? "bg-gradient-to-br from-emerald-500 to-emerald-700" : "bg-gradient-to-br from-cyan-500 to-cyan-700"}
              />
              <StatCard
                label="UAT Progress" value={`${uat?.pass_rate ?? 0}%`}
                sub={`${uat?.passed ?? 0}/${uat?.total ?? 0} cases complete`}
                icon={<ClipboardCheck className="w-5 h-5 text-white" />}
                gradient="bg-gradient-to-br from-violet-500 to-violet-700"
              />
              <StatCard
                label="Deployments" value={data.deployments.length}
                sub={`${data.deployments.filter(d => d.status === "Deployed").length} deployed`}
                icon={<Rocket className="w-5 h-5 text-white" />}
                gradient="bg-gradient-to-br from-indigo-500 to-indigo-700"
              />
              <StatCard
                label="Open Defects" value={data.open_defects}
                sub="Production monitoring"
                icon={<Bug className="w-5 h-5 text-white" />}
                gradient={data.open_defects > 0 ? "bg-gradient-to-br from-rose-500 to-rose-700" : "bg-gradient-to-br from-slate-500 to-slate-700"}
              />
            </div>

            {/* SIT + UAT */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* SIT */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <h2 className="font-bold text-slate-800 mb-1 flex items-center gap-2">
                  <FlaskConical className="w-4 h-4 text-cyan-500" /> SIT Testing Progress
                </h2>
                <p className="text-xs text-slate-400 mb-4">90% pass rate required to release for UAT</p>

                {sit?.total === 0 ? (
                  <div className="flex flex-col items-center py-8 text-slate-400 gap-2">
                    <Inbox className="w-8 h-8" />
                    <p className="text-sm">No SIT cases yet</p>
                  </div>
                ) : (
                  <>
                    <div className="mb-2">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-semibold text-slate-600">Pass Rate</span>
                        <span className={`font-bold ${sitReady ? "text-emerald-600" : "text-cyan-600"}`}>{sit?.pass_rate}%</span>
                      </div>
                      <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${sitReady ? "bg-emerald-500" : "bg-cyan-500"}`}
                          style={{ width: `${sit?.pass_rate}%` }}
                        />
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        <div className="w-1 h-1 rounded-full bg-slate-300" style={{ marginLeft: "90%" }} />
                        <span className="text-[10px] text-slate-400">90% threshold</span>
                      </div>
                    </div>

                    <div className="flex gap-3 mt-4">
                      {[
                        { label: "Passed",      val: sit?.passed,      dot: "bg-emerald-400", color: "text-emerald-600" },
                        { label: "Failed",      val: sit?.failed,      dot: "bg-red-400",     color: "text-red-600" },
                        { label: "In Progress", val: sit?.in_progress, dot: "bg-amber-400",   color: "text-amber-600" },
                        { label: "Pending",     val: sit?.pending,     dot: "bg-slate-300",   color: "text-slate-500" },
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
                        <p className="text-xs text-emerald-700 font-medium">SIT threshold met — go to SIT Testing to release for UAT</p>
                      </div>
                    )}

                    {data.recent_sit.length > 0 && (
                      <div className="mt-4 space-y-1.5">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Recent Updates</p>
                        {data.recent_sit.map(c => (
                          <div key={c.test_case_id} className="flex items-center gap-2">
                            {STATUS_ICON[c.status]}
                            <span className="text-xs text-slate-600 flex-1 truncate">{c.title ?? c.test_case_id}</span>
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${STATUS_BADGE[c.status]}`}>{c.status}</span>
                          </div>
                        ))}
                        <p className="text-[11px] text-slate-400 mt-1 flex items-center gap-1">
                          <ArrowRight className="w-3 h-3" /> View all in SIT Testing
                        </p>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* UAT */}
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
                <h2 className="font-bold text-slate-800 mb-1 flex items-center gap-2">
                  <ClipboardCheck className="w-4 h-4 text-violet-500" /> UAT Testing Progress
                </h2>
                <p className="text-xs text-slate-400 mb-4">Assignments across all stakeholders</p>

                {uat?.total === 0 ? (
                  <div className="flex flex-col items-center py-8 text-slate-400 gap-2">
                    <Inbox className="w-8 h-8" />
                    <p className="text-sm">No UAT assignments yet</p>
                  </div>
                ) : (
                  <>
                    <div className="mb-4">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-semibold text-slate-600">Completion Rate</span>
                        <span className="font-bold text-violet-600">{uat?.pass_rate}%</span>
                      </div>
                      <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full bg-violet-500 rounded-full transition-all" style={{ width: `${uat?.pass_rate}%` }} />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3 mt-2">
                      {[
                        { label: "Passed",      val: uat?.passed,      bg: "bg-emerald-50", color: "text-emerald-700" },
                        { label: "Failed",      val: uat?.failed,      bg: "bg-red-50",     color: "text-red-700" },
                        { label: "In Progress", val: uat?.in_progress, bg: "bg-amber-50",   color: "text-amber-700" },
                        { label: "Pending",     val: uat?.pending,     bg: "bg-slate-50",   color: "text-slate-600" },
                      ].map(s => (
                        <div key={s.label} className={`rounded-xl p-3 ${s.bg}`}>
                          <p className={`text-2xl font-bold ${s.color}`}>{s.val}</p>
                          <p className={`text-xs font-medium ${s.color} opacity-80`}>{s.label}</p>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Deployment Pipeline */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
              <h2 className="font-bold text-slate-800 mb-5 flex items-center gap-2">
                <Rocket className="w-4 h-4 text-indigo-500" /> Deployment Pipeline
              </h2>

              {data.deployments.length === 0 ? (
                <div className="flex flex-col items-center py-8 text-slate-400 gap-2">
                  <Inbox className="w-8 h-8" />
                  <p className="text-sm">No deployments yet</p>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row gap-3">
                  {(["SIT", "UAT", "Production"] as const).map((env, i) => {
                    const status = deployStatus(data.deployments, env);
                    return (
                      <div key={env} className={`flex-1 flex items-center gap-3 p-4 rounded-xl border ${DEPLOY_BG[status] ?? "bg-slate-50 border-slate-200"}`}>
                        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${DEPLOY_DOT[status] ?? "bg-slate-300"}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800">{env}</p>
                          <p className="text-xs text-slate-500 mt-0.5">{status}</p>
                        </div>
                        {i < 2 && <ArrowRight className="w-3.5 h-3.5 text-slate-300 hidden sm:block" />}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="mt-5 pt-4 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <p className="text-xs text-slate-600">
                    SIT must reach <span className="font-bold text-amber-600">90% pass rate</span> before UAT deployment
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
