"use client";

/**
 * Compatibility shim — forwards to StreamChatPanel.
 * Reads role and email from the user_meta cookie set at login.
 */
import { StreamChatPanel } from "./StreamChatPanel";
import { getUserMeta } from "@/lib/authGuard";

interface RequestInfo {
  id: number;
  req_number: string;
  title: string;
  priority: string;
  status: string;
}

interface Props {
  request: RequestInfo;
  currentUserId: number;
  currentUserName: string;
  onBack?: () => void;
}

export function RequestChat({ request, currentUserId, currentUserName, onBack }: Props) {
  const meta = getUserMeta();
  const role  = meta?.role  ?? "stakeholder";
  const email = meta?.email ?? "";

  return (
    <StreamChatPanel
      request={request}
      currentUser={{ id: currentUserId, name: currentUserName, email, role }}
      onBack={onBack}
    />
  );
}
