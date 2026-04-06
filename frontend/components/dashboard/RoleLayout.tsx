"use client";

import { type ReactNode } from "react";

import { Breadcrumbs } from "@/components/dashboard/Breadcrumbs";
import { DiscussionPanelProvider } from "@/components/dashboard/DiscussionPanel";
import { PortalHeader } from "@/components/dashboard/PortalHeader";
import { PortalSidebar } from "@/components/dashboard/PortalSidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { type NavItem } from "@/lib/mockData";

type RoleLayoutProps = {
  title: string;
  userName: string;
  navItems: NavItem[];
  children: ReactNode;
};

export function RoleLayout({ title, userName, navItems, children }: RoleLayoutProps) {
  return (
    <SidebarProvider>
      <PortalSidebar title={title} navItems={navItems} />

      <SidebarInset>
        {/* Header row: trigger + existing portal header */}
        <div className="sticky top-0 z-50 flex items-center gap-1 border-b border-slate-200 bg-white">
          <div className="flex shrink-0 items-center pl-3">
            <SidebarTrigger />
          </div>
          <div className="flex-1 min-w-0">
            <PortalHeader userName={userName} />
          </div>
        </div>

        {/* Page content */}
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
      </SidebarInset>
    </SidebarProvider>
  );
}
