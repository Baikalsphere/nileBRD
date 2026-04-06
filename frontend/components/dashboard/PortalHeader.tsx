"use client";

import { Bell, Search, X } from "lucide-react";
import { useMemo, useState } from "react";

const notifications = [
  "2 BRD approvals pending",
  "SIT test run starts at 4 PM",
  "Deployment REL-101 marked approved",
];

export function PortalHeader({ userName }: { userName: string }) {
  const [open, setOpen] = useState(false);
  const initials = useMemo(
    () => userName.split(" ").map((p) => p[0]).join("").toUpperCase(),
    [userName],
  );

  return (
    <header suppressHydrationWarning className="flex items-center justify-between gap-4 bg-white px-6 py-3.5">

      {/* Search */}
      <div className="relative w-full max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
        <input
          placeholder="Search…"
          className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-4 py-2 text-sm text-slate-700 placeholder-slate-400 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-2 focus:ring-indigo-100"
          suppressHydrationWarning
        />
      </div>

      <div className="flex items-center gap-3">
        {/* Bell */}
        <div className="relative">
          <button
            onClick={() => setOpen(v => !v)}
            className="relative flex size-9 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
            suppressHydrationWarning
          >
            <Bell size={16} />
            <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-rose-500" />
          </button>

          {open && (
            <div className="absolute right-0 mt-2 w-72 rounded-xl border border-slate-200 bg-white shadow-lg animate-scale-in origin-top-right">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
                <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">Notifications</p>
                <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={14} />
                </button>
              </div>
              <div className="divide-y divide-slate-100">
                {notifications.map((item) => (
                  <div key={item} className="px-4 py-3 cursor-pointer hover:bg-slate-50 transition-colors">
                    <p className="text-sm text-slate-700">{item}</p>
                    <p className="mt-0.5 text-xs text-slate-400">Just now</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* User */}
        <div className="flex items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-3 py-2">
          <span className="inline-flex size-7 items-center justify-center rounded-full bg-indigo-600 text-[11px] font-semibold text-white">
            {initials}
          </span>
          <p className="text-sm font-medium text-slate-800">{userName}</p>
        </div>
      </div>
    </header>
  );
}
