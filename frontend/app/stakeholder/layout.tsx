"use client";

import { useEffect, useState } from "react";
import { RoleLayout } from "@/components/dashboard/RoleLayout";
import { stakeholderNav } from "@/lib/mockData";
import { getUserMeta } from "@/lib/authGuard";

export default function StakeholderLayout({ children }: { children: React.ReactNode }) {
  const [userName, setUserName] = useState("Stakeholder");

  useEffect(() => {
    const meta = getUserMeta();
    if (meta?.name) setUserName(meta.name);
  }, []);

  return (
    <RoleLayout title="Stakeholder Portal" userName={userName} navItems={stakeholderNav}>
      {children}
    </RoleLayout>
  );
}
