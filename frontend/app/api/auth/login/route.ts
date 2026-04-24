import { NextResponse } from "next/server";

const COOKIE_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds
const IS_PROD = process.env.NODE_ENV === "production";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const backendUrl = process.env.BACKEND_URL || "http://localhost:5001";

    const response = await fetch(`${backendUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    const res = NextResponse.json(
      { message: data.message, user: data.user },
      { status: 200 }
    );

    // Store the JWT in an httpOnly cookie — not accessible from JS
    res.cookies.set("auth_token", data.token, {
      httpOnly: true,
      secure: IS_PROD,
      sameSite: "lax",
      maxAge: COOKIE_MAX_AGE,
      path: "/",
    });

    // Store non-sensitive user info in a regular cookie for client-side display
    const userMeta = Buffer.from(
      JSON.stringify({
        id: data.user.id,
        name: data.user.name ?? data.user.email,
        email: data.user.email,
        role: data.user.role,
      })
    ).toString("base64");

    res.cookies.set("user_meta", userMeta, {
      httpOnly: false,
      secure: IS_PROD,
      sameSite: "lax",
      maxAge: COOKIE_MAX_AGE,
      path: "/",
    });

    return res;
  } catch (error) {
    console.error("Login error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
