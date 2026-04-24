"use client";

import { useEffect, useState } from "react";
import { RoleLayout } from "@/components/dashboard/RoleLayout";
import { baNav } from "@/lib/mockData";
import { getUserMeta } from "@/lib/authGuard";

export default function BALayout({ children }: { children: React.ReactNode }) {
  const [userName, setUserName] = useState("Business Analyst");

  useEffect(() => {
    const meta = getUserMeta();
    if (meta?.name) setUserName(meta.name);
  }, []);

  return (
    <RoleLayout title="Business Analyst Portal" userName={userName} navItems={baNav}>
      {children}
    </RoleLayout>
  );
}
