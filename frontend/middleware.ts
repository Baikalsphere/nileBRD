import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

// Maps each portal prefix to the role required to access it
const PORTAL_ROLES: Record<string, string> = {
  "/ba": "ba",
  "/it": "it",
  "/stakeholder": "stakeholder",
  "/it-member": "it_member",
};

// Maps each role to its home portal — used for wrong-role redirects
const ROLE_PORTAL: Record<string, string> = {
  ba: "/ba",
  it: "/it",
  stakeholder: "/stakeholder",
  it_member: "/it-member",
};

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const portalPrefix = Object.keys(PORTAL_ROLES).find((p) =>
    pathname === p || pathname.startsWith(p + "/")
  );
  if (!portalPrefix) return NextResponse.next();

  const requiredRole = PORTAL_ROLES[portalPrefix];
  const token = request.cookies.get("auth_token")?.value;

  if (!token) {
    return NextResponse.redirect(new URL("/?reason=unauthenticated", request.url));
  }

  const secret = process.env.JWT_SECRET;
  if (!secret) {
    // JWT_SECRET not configured in frontend env — deny access
    console.error("JWT_SECRET is not set in the frontend environment");
    return NextResponse.redirect(new URL("/?reason=config", request.url));
  }

  try {
    const { payload } = await jwtVerify(
      token,
      new TextEncoder().encode(secret)
    );

    const userRole = payload.role as string | undefined;

    if (userRole !== requiredRole) {
      const correctPortal = ROLE_PORTAL[userRole ?? ""] ?? "/";
      return NextResponse.redirect(new URL(correctPortal, request.url));
    }

    return NextResponse.next();
  } catch {
    // Token invalid or expired — clear stale cookies and send to login
    const response = NextResponse.redirect(
      new URL("/?reason=session_expired", request.url)
    );
    response.cookies.delete("auth_token");
    response.cookies.delete("user_meta");
    return response;
  }
}

export const config = {
  matcher: [
    "/ba/:path*",
    "/it/:path*",
    "/stakeholder/:path*",
    "/it-member/:path*",
  ],
};
