"use client";

import { useEffect, useState } from "react";
import { RoleLayout } from "@/components/dashboard/RoleLayout";
import { baNav } from "@/lib/mockData";

function decodeToken(token: string) {
  try { return JSON.parse(atob(token.split(".")[1])); } catch { return null; }
}

export default function BALayout({ children }: { children: React.ReactNode }) {
  const [userName, setUserName] = useState("Business Analyst");

  useEffect(() => {
    const token = localStorage.getItem("authToken");
    if (!token) return;
    const decoded = decodeToken(token);
    if (decoded?.name) setUserName(decoded.name);
    else if (decoded?.email) setUserName(decoded.email);
  }, []);

  return (
    <RoleLayout title="Business Analyst Portal" userName={userName} navItems={baNav}>
      {children}
    </RoleLayout>
  );
}
