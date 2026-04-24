import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const UPLOADS_DIR = path.join(__dirname, "uploads");

export async function uploadFile(buffer, filename, mimetype, requestId) {
  const key = `requests/${requestId}/${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const dest = path.join(UPLOADS_DIR, key);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, buffer);
  return key;
}

export function getFilePath(key) {
  return path.join(UPLOADS_DIR, key);
}

export async function deleteFile(key) {
  try {
    await fs.unlink(path.join(UPLOADS_DIR, key));
  } catch {
    // ignore if already gone
  }
}
