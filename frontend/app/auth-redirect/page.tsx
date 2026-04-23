"use client";

import { useEffect } from "react";
import { getMsalInstance } from "@/lib/msalConfig";

export default function AuthRedirect() {
  useEffect(() => {
    (async () => {
      try {
        const msal = getMsalInstance();
        await msal.initialize();
        await msal.handleRedirectPromise();
      } catch {
        // errors are handled by the opener window
      }
    })();
  }, []);

  // Intentionally blank — this page only exists to close the popup
  return null;
}
