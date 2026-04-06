"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";

import { iconMap } from "@/components/dashboard/IconMap";
import { type NavItem } from "@/lib/mockData";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";

type SidebarProps = {
  title: string;
  navItems: NavItem[];
};

export function PortalSidebar({ title, navItems }: SidebarProps) {
  const pathname = usePathname();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon">
      {/* Brand header */}
      <SidebarHeader className="border-b border-sidebar-border px-3 py-3">
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/50">
              BPRM Portal
            </p>
            <p className="mt-0.5 truncate text-sm font-semibold text-sidebar-foreground">
              {title}
            </p>
          </div>
        )}
      </SidebarHeader>

      {/* Nav items */}
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const Icon =
                  iconMap[item.icon as keyof typeof iconMap] ||
                  iconMap["layout-dashboard"];
                const active = pathname === item.href;

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.label}
                      size="default"
                    >
                      <Link href={item.href}>
                        <Icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Logout */}
      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="Logout">
              <Link href="/">
                <LogOut />
                <span>Logout</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}
