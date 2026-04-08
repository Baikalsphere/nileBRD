"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";

import { iconMap } from "@/components/dashboard/IconMap";
import { type NavItem } from "@/lib/mockData";
import { cn } from "@/lib/utils";

type SidebarProps = {
  title: string;
  navItems: NavItem[];
  collapsed: boolean;
  onToggle: () => void;
};

export function PortalSidebar({ title, navItems, collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      suppressHydrationWarning
      className={cn(
        "fixed left-0 top-0 z-50 flex h-screen flex-col border-r border-slate-200 bg-white shadow-sm transition-all duration-300",
        collapsed ? "w-16" : "w-64",
      )}
    >
      {/* Header */}
      <div className={cn(
        "flex items-center border-b border-slate-100 px-4 py-4",
        collapsed ? "justify-center" : "justify-between",
      )}>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">BPRM Portal</p>
            <p className="mt-0.5 truncate text-sm font-semibold text-slate-800">{title}</p>
          </div>
        )}
        <button
          onClick={onToggle}
          className="flex size-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          suppressHydrationWarning
        >
          {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
        {navItems.map((item) => {
          const Icon = iconMap[item.icon as keyof typeof iconMap] || iconMap["layout-dashboard"];
          const active = pathname === item.href;

          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl px-2 py-2.5 text-sm font-medium transition-all duration-150",
                collapsed ? "justify-center" : "",
                active
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-800",
              )}
            >
              {/* Active left accent bar */}
              {active && !collapsed && (
                <span className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-r-full bg-indigo-500" />
              )}

              {/* Icon box */}
              <span className={cn(
                "flex size-8 shrink-0 items-center justify-center rounded-lg transition-all duration-150",
                active
                  ? "bg-indigo-100 text-indigo-600"
                  : "text-slate-400 group-hover:bg-slate-100 group-hover:text-slate-600",
              )}>
                <Icon size={16} />
              </span>

              {/* Label */}
              {!collapsed && (
                <span className="flex-1 truncate">{item.label}</span>
              )}

              {/* Active dot when collapsed */}
              {active && collapsed && (
                <span className="absolute right-1 top-1/2 size-1.5 -translate-y-1/2 rounded-full bg-indigo-500" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="border-t border-slate-100 px-2 py-3">
        <Link
          href="/"
          title={collapsed ? "Logout" : undefined}
          className={cn(
            "group flex items-center gap-3 rounded-xl px-2 py-2.5 text-sm font-medium text-slate-500 transition-all duration-150 hover:bg-rose-50 hover:text-rose-600",
            collapsed ? "justify-center" : "",
          )}
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg transition-all duration-150 group-hover:bg-rose-100 group-hover:text-rose-500">
            <LogOut size={16} />
          </span>
          {!collapsed && <span>Logout</span>}
        </Link>
      </div>
    </aside>
  );
}
