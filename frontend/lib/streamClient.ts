import { StreamChat } from "stream-chat";
import { ensureAuth } from "@/lib/authGuard";

const API = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5001";

let clientSingleton: StreamChat | null = null;

export function getStreamClient(): StreamChat {
  if (!clientSingleton) {
    clientSingleton = StreamChat.getInstance(
      process.env.NEXT_PUBLIC_STREAM_API_KEY!
    );
  }
  return clientSingleton;
}

export async function fetchStreamToken(): Promise<{
  token: string;
  apiKey: string;
  userId: string;
}> {
  const authToken = await ensureAuth();
  const res = await fetch(`${API}/api/stream/token`, {
    headers: { Authorization: `Bearer ${authToken}` },
  });
  if (!res.ok) throw new Error("Failed to fetch Stream token");
  return res.json();
}
