"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Rocket, CheckCircle2, Clock, AlertTriangle, ArrowLeft,
  GitMerge, Server, Eye, FileText, RefreshCw,
} from "lucide-react";
import { ensureAuth } from "@/lib/authGuard";

const API = process.env.NEXT_PUBLIC_BACKEND_URL;

async function authHeader(): Promise<Record<string, string>> {
  const t = await ensureAuth();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

interface TcDocSummary {
  id: number;
  doc_id: string;
  title: string;
  request_title: string;
  req_number: string;
  request_id: number;
  generated_at: string;
}

interface Deployment {
  id: number;
  environment: "SIT" | "UAT" | "Production";
  deployment_type: "Full" | "Partial";
  status: "Pending" | "In Progress" | "Deployed" | "Partial" | "Failed";
  notes: string | null;
  deployed_by_name: string | null;
  deployed_at: string | null;
  created_at: string;
  tc_doc_id: string | null;
}

const STATUS_COLOR: Record<string, string> = {
  Deployed:      "bg-emerald-100 text-emerald-700",
  "In Progress": "bg-amber-100 text-amber-700",
  Pending:       "bg-slate-100 text-slate-500",
  Partial:       "bg-blue-100 text-blue-700",
  Failed:        "bg-red-100 text-red-700",
};

const ENV_GRADIENT: Record<string, string> = {
  SIT:        "from-cyan-500 to-cyan-700",
  UAT:        "from-violet-500 to-violet-700",
  Production: "from-indigo-600 to-indigo-800",
};

const ENV_ICON: Record<string, React.ReactNode> = {
  SIT:        <GitMerge className="w-5 h-5 text-white" />,
  UAT:        <Eye className="w-5 h-5 text-white" />,
  Production: <Server className="w-5 h-5 text-white" />,
};

const ENVS: Array<"SIT" | "UAT" | "Production"> = ["SIT", "UAT", "Production"];

// ─── Document List ──────────────────────────────────────────────────────────

function DocList({ onSelect }: { onSelect: (doc: TcDocSummary) => void }) {
  const [docs, setDocs] = useState<TcDocSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    authHeader()
      .then(headers => fetch(`${API}/api/stream/test-case-documents`, { headers }))
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setDocs(data);
        else setError(data.message ?? "Failed to load documents");
      })
      .catch(() => setError("Network error"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-40 text-slate-400">
      <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading documents…
    </div>
  );

  if (error) return (
    <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
  );

  if (!docs.length) return (
    <div className="flex flex-col items-center justify-center h-40 text-slate-400 gap-2">
      <FileText className="w-8 h-8" />
      <p className="text-sm">No test case documents found</p>
    </div>
  );

  return (
    <div className="space-y-3">
      {docs.map(doc => (
        <div
          key={doc.id}
          className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer"
          onClick={() => onSelect(doc)}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <span className="font-mono text-xs text-slate-400">{doc.doc_id}</span>
                <span className="text-sm font-bold text-slate-800 truncate">{doc.request_title}</span>
                <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded">{doc.req_number}</span>
              </div>
              <p className="text-xs text-slate-500">{doc.title}</p>
            </div>
            <button className="px-3 py-1.5 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 shrink-0">
              Manage
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Deployment Detail ───────────────────────────────────────────────────────

function DeployDetail({ doc, onBack }: { doc: TcDocSummary; onBack: () => void }) {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirmEnv, setConfirmEnv] = useState<"SIT" | "UAT" | "Production" | null>(null);
  const [deployType, setDeployType] = useState<"Full" | "Partial">("Full");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  const showMsg = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 3500); };

  const load = useCallback(async () => {
    setLoading(true);
    fetch(`${API}/api/deployments/${doc.request_id}`, { headers: await authHeader() })
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setDeployments(data);
          const n: Record<string, string> = {};
          data.forEach((d: Deployment) => { n[d.environment] = d.notes ?? ""; });
          setNotes(n);
        } else {
          setError(data.message ?? "Failed to load deployments");
        }
      })
      .catch(() => setError("Network error"))
      .finally(() => setLoading(false));
  }, [doc.request_id]);

  useEffect(() => { load(); }, [load]);

  // Ensure all 3 environments exist (create missing ones locally)
  const deployMap: Record<string, Deployment | null> = {};
  deployments.forEach(d => { deployMap[d.environment] = d; });

  const createDeployment = async (env: "SIT" | "UAT" | "Production") => {
    setSaving(true);
    try {
      const r = await fetch(`${API}/api/deployments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...await authHeader() },
        body: JSON.stringify({
          request_id: doc.request_id,
          tc_document_id: doc.id,
          environment: env,
          deployment_type: deployType,
          notes: notes[env] ?? "",
        }),
      });
      const d = await r.json();
      if (r.ok) { load(); }
      else showMsg(d.message ?? "Create failed");
    } finally {
      setSaving(false);
    }
  };

  const updateDeployment = async (id: number, status: string, env: string) => {
    setSaving(true);
    try {
      const r = await fetch(`${API}/api/deployments/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...await authHeader() },
        body: JSON.stringify({ status, deployment_type: deployType, notes: notes[env] ?? "" }),
      });
      const d = await r.json();
      if (r.ok) { load(); setConfirmEnv(null); }
      else showMsg(d.message ?? "Update failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-40 text-slate-400">
      <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Loading deployments…
    </div>
  );

  if (error) return (
    <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>
  );

  const deployedCount = deployments.filter(d => d.status === "Deployed" || d.status === "Partial").length;
  const pendingCount  = deployments.filter(d => d.status === "Pending").length;
  const inProgCount   = deployments.filter(d => d.status === "In Progress").length;

  return (
    <div className="space-y-5">
      {/* Back + header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700">
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <div>
            <p className="text-xs text-slate-400">{doc.req_number} · {doc.doc_id}</p>
            <h2 className="text-lg font-bold text-slate-900">{doc.request_title}</h2>
          </div>
        </div>
        {msg && <span className="text-xs px-3 py-1.5 rounded-lg bg-slate-100 text-slate-700">{msg}</span>}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Deployed",    val: deployedCount, color: "text-emerald-700", bg: "bg-emerald-50" },
          { label: "In Progress", val: inProgCount,   color: "text-amber-700",   bg: "bg-amber-50" },
          { label: "Pending",     val: pendingCount,  color: "text-slate-600",   bg: "bg-slate-100" },
        ].map(k => (
          <div key={k.label} className={`${k.bg} rounded-xl border border-slate-200 p-4 shadow-sm`}>
            <p className={`text-2xl font-bold ${k.color}`}>{k.val}</p>
            <p className="text-xs text-slate-500">{k.label}</p>
          </div>
        ))}
      </div>

      {/* Pipeline visual */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
        <h2 className="font-bold text-slate-800 mb-4">Deployment Pipeline</h2>
        <div className="flex items-center gap-2">
          {ENVS.map((env, i) => {
            const d = deployMap[env];
            return (
              <div key={env} className="flex items-center gap-2 flex-1">
                <div className={`flex-1 rounded-xl bg-gradient-to-br ${ENV_GRADIENT[env]} p-4 text-white`}>
                  <div className="flex items-center gap-2 mb-1">
                    {ENV_ICON[env]}
                    <span className="text-sm font-bold">{env}</span>
                  </div>
                  <span className={`mt-1 inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white/20 ${
                    !d ? "text-white/40" :
                    d.status === "Deployed" ? "text-emerald-200" :
                    d.status === "Pending" ? "text-white/60" : "text-amber-200"
                  }`}>{d ? d.status : "Not Created"}</span>
                </div>
                {i < ENVS.length - 1 && <div className="w-6 h-0.5 bg-slate-200 shrink-0" />}
              </div>
            );
          })}
        </div>
      </div>

      {/* Deployment cards */}
      <div className="space-y-3">
        {ENVS.map(env => {
          const d = deployMap[env];
          return (
            <div key={env} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="p-5 space-y-4">
                {/* Header */}
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${ENV_GRADIENT[env]} flex items-center justify-center shrink-0`}>
                    {ENV_ICON[env]}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-slate-800">{env}</p>
                    <p className="text-[11px] text-slate-400">
                      {d
                        ? d.deployed_at
                          ? `Deployed ${new Date(d.deployed_at).toLocaleDateString()} by ${d.deployed_by_name ?? "—"}`
                          : `Status: ${d.status}`
                        : "Not yet created"}
                    </p>
                  </div>
                  {d && (
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[d.status]}`}>{d.status}</span>
                  )}
                </div>

                {/* Notes */}
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-1.5">Deployment Notes</p>
                  <textarea
                    className="w-full text-sm border border-slate-200 rounded-lg p-2.5 bg-white resize-none focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    rows={2}
                    placeholder="Add deployment notes..."
                    value={notes[env] ?? ""}
                    onChange={e => setNotes(prev => ({ ...prev, [env]: e.target.value }))}
                  />
                </div>

                {/* Deployment type */}
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-2">Deployment Type</p>
                  <div className="flex gap-2">
                    {(["Full", "Partial"] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => setDeployType(t)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                          deployType === t ? "bg-indigo-100 border-indigo-300 text-indigo-700" : "bg-white border-slate-200 text-slate-500"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 flex-wrap">
                  {!d && (
                    <button
                      onClick={() => createDeployment(env)}
                      disabled={saving}
                      className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50"
                    >
                      <Rocket className="w-3.5 h-3.5" /> Create Deployment
                    </button>
                  )}
                  {d && d.status !== "Deployed" && (
                    <button
                      onClick={() => setConfirmEnv(env)}
                      disabled={saving}
                      className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50"
                    >
                      <Rocket className="w-3.5 h-3.5" /> Mark {deployType === "Full" ? "Deployed" : "Partial"}
                    </button>
                  )}
                  {d && d.status !== "In Progress" && d.status !== "Deployed" && (
                    <button
                      onClick={() => updateDeployment(d.id, "In Progress", env)}
                      disabled={saving}
                      className="px-4 py-2 border border-slate-200 bg-white text-slate-600 text-xs font-semibold rounded-xl hover:bg-slate-50 disabled:opacity-50"
                    >
                      <Clock className="w-3.5 h-3.5 inline mr-1" /> Mark In Progress
                    </button>
                  )}
                </div>

                {d?.status === "Deployed" && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                    <p className="text-xs text-emerald-700 font-medium">
                      {env} deployment complete
                      {env === "Production" && " — request status updated to Under Observation"}
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Confirm modal */}
      {confirmEnv && deployMap[confirmEnv] && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                <Rocket className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800">Confirm Deployment</h3>
                <p className="text-xs text-slate-400">{confirmEnv} — {deployType} deployment</p>
              </div>
            </div>
            {confirmEnv === "Production" && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl mb-4 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                <p className="text-xs text-amber-700">This is a <strong>Production</strong> deployment. Ensure all approvals are in place before proceeding.</p>
              </div>
            )}
            <p className="text-sm text-slate-600 mb-5">
              {confirmEnv === "Production"
                ? "Once deployed, the request status will be set to \"Under Observation\" and stakeholders will be notified."
                : `Marking ${confirmEnv} as ${deployType === "Full" ? "Deployed" : "Partial"}.`}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmEnv(null)} className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-600 hover:bg-slate-50">
                Cancel
              </button>
              <button
                onClick={() => {
                  const d = deployMap[confirmEnv!]!;
                  updateDeployment(d.id, deployType === "Full" ? "Deployed" : "Partial", confirmEnv!);
                }}
                disabled={saving}
                className="flex-1 px-4 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50"
              >
                {saving ? "Confirming…" : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function DeploymentPage() {
  const [selectedDoc, setSelectedDoc] = useState<TcDocSummary | null>(null);

  return (
    <div className="min-h-screen bg-slate-50 p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <Rocket className="w-6 h-6 text-indigo-600" /> Deployment
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">
          {selectedDoc
            ? "Manage deployment status across SIT, UAT and Production"
            : "Select a test case document to manage its deployment pipeline"}
        </p>
      </div>

      {!selectedDoc
        ? <DocList onSelect={setSelectedDoc} />
        : <DeployDetail doc={selectedDoc} onBack={() => setSelectedDoc(null)} />
      }
    </div>
  );
}
