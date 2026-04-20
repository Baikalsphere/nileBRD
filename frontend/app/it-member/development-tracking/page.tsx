"use client";

import { useState } from "react";
import { GitBranch, CheckCircle2, Clock, AlertTriangle, Circle } from "lucide-react";

type TaskStatus = "Backlog" | "In Progress" | "Done";

interface DevTask {
  id: string;
  title: string;
  priority: "High" | "Medium" | "Low";
  status: TaskStatus;
  linked: string;
}

const INITIAL_TASKS: DevTask[] = [
  { id: "DEV-01", title: "Fix concurrent session token conflict (SIT-12)", priority: "High", status: "In Progress", linked: "SIT-12" },
  { id: "DEV-02", title: "Performance optimisation for 50+ concurrent users", priority: "High", status: "In Progress", linked: "SIT-13" },
  { id: "DEV-03", title: "Cross-browser CSS fixes for Safari/Edge", priority: "Medium", status: "Backlog", linked: "SIT-14" },
  { id: "DEV-04", title: "Data migration rollback script", priority: "Medium", status: "Backlog", linked: "SIT-15" },
  { id: "DEV-05", title: "Stakeholder UAT sign-off notification email", priority: "Medium", status: "Backlog", linked: "UAT-04" },
  { id: "DEV-06", title: "Production defect logging UI for stakeholders", priority: "Low", status: "Backlog", linked: "UAT-05" },
  { id: "DEV-07", title: "Resolve API pagination reset on filter change", priority: "Medium", status: "In Progress", linked: "BUG-201" },
  { id: "DEV-08", title: "JWT multi-session management", priority: "High", status: "Backlog", linked: "SIT-12" },
  { id: "DEV-09", title: "Load balancer configuration for 50+ users", priority: "High", status: "Backlog", linked: "SIT-13" },
  { id: "DEV-10", title: "End-to-end request flow optimisation", priority: "Low", status: "Done", linked: "SIT-02" },
  { id: "DEV-11", title: "BRD to FRD pipeline error handling", priority: "Medium", status: "Done", linked: "SIT-03" },
  { id: "DEV-12", title: "File upload size validation (Supabase)", priority: "Low", status: "Done", linked: "SIT-05" },
];

const PRIORITY_COLOR: Record<string, string> = {
  High:   "bg-red-100 text-red-700",
  Medium: "bg-amber-100 text-amber-700",
  Low:    "bg-slate-100 text-slate-500",
};

const COLS: { status: TaskStatus; label: string; color: string; icon: React.ReactNode }[] = [
  { status: "Backlog",     label: "Backlog",     color: "border-slate-300 bg-slate-50",  icon: <Circle className="w-3.5 h-3.5 text-slate-400" /> },
  { status: "In Progress", label: "In Progress", color: "border-amber-300 bg-amber-50",  icon: <Clock className="w-3.5 h-3.5 text-amber-500" /> },
  { status: "Done",        label: "Done",        color: "border-emerald-300 bg-emerald-50", icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /> },
];

export default function DevTrackingPage() {
  const [tasks, setTasks] = useState<DevTask[]>(INITIAL_TASKS);

  const move = (id: string, status: TaskStatus) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, status } : t));
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6 space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <GitBranch className="w-6 h-6 text-indigo-600" /> Development Tracking
        </h1>
        <p className="text-sm text-slate-500 mt-0.5">Track development tasks linked to SIT/UAT findings</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        {COLS.map(col => {
          const count = tasks.filter(t => t.status === col.status).length;
          return (
            <div key={col.status} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
              <div className="flex items-center gap-2 mb-1">
                {col.icon}
                <span className="text-sm font-semibold text-slate-700">{col.label}</span>
              </div>
              <p className="text-3xl font-bold text-slate-900">{count}</p>
            </div>
          );
        })}
      </div>

      {/* Kanban */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {COLS.map(col => (
          <div key={col.status} className={`rounded-2xl border-2 ${col.color} p-4 space-y-2 min-h-[300px]`}>
            <div className="flex items-center gap-2 mb-3">
              {col.icon}
              <span className="text-sm font-bold text-slate-700">{col.label}</span>
              <span className="ml-auto text-xs text-slate-400 font-medium">
                {tasks.filter(t => t.status === col.status).length}
              </span>
            </div>

            {tasks.filter(t => t.status === col.status).map(task => (
              <div key={task.id} className="bg-white rounded-xl border border-slate-200 p-3 shadow-sm space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold text-slate-800 leading-tight">{task.title}</p>
                  <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded shrink-0 ${PRIORITY_COLOR[task.priority]}`}>{task.priority}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-[10px] text-slate-400">{task.id}</span>
                    {task.linked && (
                      <span className="font-mono text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded">→ {task.linked}</span>
                    )}
                  </div>
                </div>
                {/* Move actions */}
                <div className="flex gap-1 flex-wrap">
                  {COLS.filter(c => c.status !== col.status).map(c => (
                    <button
                      key={c.status}
                      onClick={() => move(task.id, c.status)}
                      className="text-[10px] font-semibold px-2 py-0.5 rounded border border-slate-200 text-slate-500 hover:bg-slate-50"
                    >
                      → {c.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}

            {tasks.filter(t => t.status === col.status).length === 0 && (
              <div className="flex items-center justify-center h-24 text-xs text-slate-300">
                No tasks
              </div>
            )}
          </div>
        ))}
      </div>

      {/* High priority alert */}
      {tasks.filter(t => t.priority === "High" && t.status !== "Done").length > 0 && (
        <div className="bg-white rounded-2xl border border-red-200 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <span className="text-sm font-bold text-slate-800">High Priority — Action Needed</span>
          </div>
          <div className="space-y-1.5">
            {tasks.filter(t => t.priority === "High" && t.status !== "Done").map(t => (
              <div key={t.id} className="flex items-center gap-2 text-xs">
                <span className="font-mono text-red-500">{t.id}</span>
                <span className="text-slate-700">{t.title}</span>
                <span className="ml-auto text-slate-400">{t.status}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
