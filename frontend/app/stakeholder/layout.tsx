"use client";

import { useEffect, useState } from "react";
import { RoleLayout } from "@/components/dashboard/RoleLayout";
import { stakeholderNav } from "@/lib/mockData";

function decodeToken(token: string) {
  try { return JSON.parse(atob(token.split(".")[1])); } catch { return null; }
}

export default function StakeholderLayout({ children }: { children: React.ReactNode }) {
  const [userName, setUserName] = useState("Stakeholder");

  useEffect(() => {
    const token = localStorage.getItem("authToken");
    if (!token) return;
    const decoded = decodeToken(token);
    if (decoded?.name) setUserName(decoded.name);
    else if (decoded?.email) setUserName(decoded.email);
  }, []);

  return (
    <RoleLayout title="Stakeholder Portal" userName={userName} navItems={stakeholderNav}>
      {children}
    </RoleLayout>
  );
}
