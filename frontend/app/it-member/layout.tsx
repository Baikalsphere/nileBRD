"use client";

import { useEffect, useState } from "react";
import { RoleLayout } from "@/components/dashboard/RoleLayout";
import { itMemberNav } from "@/lib/mockData";

function decodeToken(token: string) {
  try { return JSON.parse(atob(token.split(".")[1])); } catch { return null; }
}

export default function ITMemberLayout({ children }: { children: React.ReactNode }) {
  const [userName, setUserName] = useState("IT Member");

  useEffect(() => {
    const token = localStorage.getItem("authToken");
    if (!token) return;
    const decoded = decodeToken(token);
    if (decoded?.name) setUserName(decoded.name);
    else if (decoded?.email) setUserName(decoded.email);
  }, []);

  return (
    <RoleLayout title="IT Member Portal" userName={userName} navItems={itMemberNav}>
      {children}
    </RoleLayout>
  );
}
