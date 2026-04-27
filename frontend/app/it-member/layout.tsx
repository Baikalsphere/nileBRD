"use client";

import { useEffect, useState } from "react";
import { RoleLayout } from "@/components/dashboard/RoleLayout";
import { itMemberNav } from "@/lib/mockData";
import { getUserMeta } from "@/lib/authGuard";

export default function ITMemberLayout({ children }: { children: React.ReactNode }) {
  const [userName, setUserName] = useState("IT Member");

  useEffect(() => {
    const meta = getUserMeta();
    if (meta?.name) setUserName(meta.name);
  }, []);

  return (
    <RoleLayout title="IT Member Portal" userName={userName} navItems={itMemberNav}>
      {children}
    </RoleLayout>
  );
}
