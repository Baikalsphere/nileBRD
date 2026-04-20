import { createClient } from "@supabase/supabase-js";

// Uses the service_role key (not anon key) so it can bypass RLS and access private buckets.
// Bucket should be set to PRIVATE in Supabase dashboard — access is controlled via signed URLs.
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  console.error("[storage] SUPABASE_URL or SUPABASE_SERVICE_KEY env var is missing — file uploads will fail.");
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

export const BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "bprm-attachments";

// Upload a file buffer → returns the storage path (key)
export async function uploadFile(buffer, filename, mimetype, requestId) {
  const key = `requests/${requestId}/${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(key, buffer, { contentType: mimetype, upsert: false });

  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  return key;
}

// Generate a signed download URL valid for 15 minutes
export async function getSignedDownloadUrl(key) {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(key, 900);

  if (error) throw new Error(`Failed to create signed URL: ${error.message}`);
  return data.signedUrl;
}

// Delete a file (used for rollback on failed request submission)
export async function deleteFile(key) {
  await supabase.storage.from(BUCKET).remove([key]);
}
