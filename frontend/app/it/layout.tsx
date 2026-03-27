"use client";

import { useEffect, useState } from "react";
import { RoleLayout } from "@/components/dashboard/RoleLayout";
import { itNav } from "@/lib/mockData";

function decodeToken(token: string) {
  try { return JSON.parse(atob(token.split(".")[1])); } catch { return null; }
}

export default function ITLayout({ children }: { children: React.ReactNode }) {
  const [userName, setUserName] = useState("IT Lead");

  useEffect(() => {
    const token = localStorage.getItem("authToken");
    if (!token) return;
    const decoded = decodeToken(token);
    if (decoded?.name) setUserName(decoded.name);
    else if (decoded?.email) setUserName(decoded.email);
  }, []);

  return (
    <RoleLayout title="IT Portal" userName={userName} navItems={itNav}>
      {children}
    </RoleLayout>
  );
}
