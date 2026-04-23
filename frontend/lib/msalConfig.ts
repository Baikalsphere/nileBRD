import { PublicClientApplication, type Configuration } from "@azure/msal-browser";

export const msalConfig: Configuration = {
  auth: {
    clientId: process.env.NEXT_PUBLIC_AZURE_CLIENT_ID!,
    authority: `https://login.microsoftonline.com/${process.env.NEXT_PUBLIC_AZURE_TENANT_ID}`,
    redirectUri:
      process.env.NEXT_PUBLIC_REDIRECT_URI ||
      (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000"),
  },
  cache: {
    cacheLocation: "sessionStorage",
  },
};

export const loginRequest = {
  scopes: ["User.Read", "openid", "profile", "email"],
};

let _instance: PublicClientApplication | null = null;

export function getMsalInstance(): PublicClientApplication {
  if (!_instance) {
    _instance = new PublicClientApplication(msalConfig);
  }
  return _instance;
}
