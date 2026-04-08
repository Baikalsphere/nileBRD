import { StreamChat } from "stream-chat";

const STREAM_API_KEY    = process.env.STREAM_API_KEY;
const STREAM_API_SECRET = process.env.STREAM_API_SECRET;

if (!STREAM_API_KEY || !STREAM_API_SECRET) {
  console.error(
    "[streamService] STREAM_API_KEY or STREAM_API_SECRET is not set. " +
    "Add both to your Render environment variables."
  );
}

// Use `new StreamChat()` instead of getInstance() to guarantee the secret
// is bound to this instance. getInstance() is a singleton and can return
// a previously cached instance that was created without a secret.
const serverClient = new StreamChat(STREAM_API_KEY, STREAM_API_SECRET);

export async function upsertStreamUser({ id, name, email, role }) {
  await serverClient.upsertUser({
    id: String(id),
    name: name || email,
    email,
    custom_role: role,
  });
}

export function generateStreamToken(userId) {
  return serverClient.createToken(String(userId));
}

export async function getOrCreateRequestChannel(requestId, baUserId, reqNumber) {
  const channelId = `request-${requestId}`;
  const channel = serverClient.channel("messaging", channelId, {
    name: reqNumber,
    created_by_id: String(baUserId),
  });
  await channel.create();
  await channel.addModerators([String(baUserId)]);
  return { channelId, channelType: "messaging" };
}

export async function addMemberToChannel(requestId, userId, streamRole) {
  const channel = serverClient.channel("messaging", `request-${requestId}`);
  if (streamRole === "moderator") {
    await channel.addModerators([String(userId)]);
  } else {
    await channel.addMembers([String(userId)]);
  }
}

export async function removeMemberFromChannel(requestId, userId) {
  const channel = serverClient.channel("messaging", `request-${requestId}`);
  await channel.removeMembers([String(userId)]);
}

export async function sendMessageToChannel(requestId, text, attachments = [], senderId) {
  const channel = serverClient.channel("messaging", `request-${requestId}`);
  return await channel.sendMessage({
    text,
    attachments,
    user_id: String(senderId),
  });
}
