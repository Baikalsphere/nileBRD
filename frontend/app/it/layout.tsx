"use client";

import { useEffect, useState } from "react";
import { RoleLayout } from "@/components/dashboard/RoleLayout";
import { itNav } from "@/lib/mockData";
import { getUserMeta } from "@/lib/authGuard";

export default function ITLayout({ children }: { children: React.ReactNode }) {
  const [userName, setUserName] = useState("IT Lead");

  useEffect(() => {
    const meta = getUserMeta();
    if (meta?.name) setUserName(meta.name);
  }, []);

  return (
    <RoleLayout title="IT Portal" userName={userName} navItems={itNav}>
      {children}
    </RoleLayout>
  );
}
