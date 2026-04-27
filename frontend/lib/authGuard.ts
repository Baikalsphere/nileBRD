export interface UserMeta {
  id: number;
  name: string;
  email: string;
  role: string;
}

/** Read display-only user info from the non-httpOnly cookie set at login. */
export function getUserMeta(): UserMeta | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)user_meta=([^;]+)/);
  if (!match) return null;
  try {
    return JSON.parse(atob(decodeURIComponent(match[1])));
  } catch {
    return null;
  }
}

// Module-level cache so we only hit /api/auth/token once per page load.
let _cachedToken: string | null = null;
let _pendingFetch: Promise<string | null> | null = null;

/**
 * Returns the JWT for outbound API calls.
 * Reads from the httpOnly cookie via a same-origin API route and caches
 * the result in memory so subsequent calls are synchronous-fast.
 */
export async function ensureAuth(): Promise<string | null> {
  if (_cachedToken) return _cachedToken;

  if (!_pendingFetch) {
    _pendingFetch = fetch("/api/auth/token")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { token: string } | null) => {
        _cachedToken = data?.token ?? null;
        _pendingFetch = null;
        return _cachedToken;
      })
      .catch(() => {
        _pendingFetch = null;
        return null;
      });
  }

  return _pendingFetch;
}

/** Clear the in-memory token cache (call on logout). */
export function clearAuthCache(): void {
  _cachedToken = null;
  _pendingFetch = null;
}

/** Sign the user out: clears cookies server-side and redirects to login. */
export async function signOut(): Promise<void> {
  clearAuthCache();
  await fetch("/api/auth/logout", { method: "POST" });
  window.location.href = "/";
}
