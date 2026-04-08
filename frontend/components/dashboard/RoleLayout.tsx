"use client";

import { useState, type ReactNode } from "react";

import { Breadcrumbs } from "@/components/dashboard/Breadcrumbs";
import { DiscussionPanelProvider } from "@/components/dashboard/DiscussionPanel";
import { PortalHeader } from "@/components/dashboard/PortalHeader";
import { PortalSidebar } from "@/components/dashboard/PortalSidebar";
import { type NavItem } from "@/lib/mockData";

type RoleLayoutProps = {
  title: string;
  userName: string;
  navItems: NavItem[];
  children: ReactNode;
};

export function RoleLayout({ title, userName, navItems, children }: RoleLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="min-h-screen bg-slate-100">
      <PortalSidebar
        title={title}
        navItems={navItems}
        collapsed={collapsed}
        onToggle={() => setCollapsed(v => !v)}
      />

      {/* Content column — shifts with sidebar */}
      <div
        className="flex min-h-screen flex-col transition-all duration-300"
        style={{ marginLeft: collapsed ? "4rem" : "16rem" }}
      >
        <PortalHeader userName={userName} />

        {/* Relative container so DiscussionPanel can absolute-fill it */}
        <div className="relative flex flex-1 overflow-hidden">
          <DiscussionPanelProvider>
            <main className="flex-1 overflow-y-auto px-6 py-7 sm:px-8">
              <div className="mx-auto max-w-6xl">
                <Breadcrumbs />
                <div className="space-y-6">{children}</div>
              </div>
            </main>
          </DiscussionPanelProvider>
        </div>
      </div>
    </div>
  );
}
