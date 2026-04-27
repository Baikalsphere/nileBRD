import { NextRequest, NextResponse } from "next/server";

// Returns the JWT to authenticated client-side code.
// The token is stored in an httpOnly cookie so JS can't read it directly,
// but this same-origin route makes it available for outbound API calls.
export async function GET(request: NextRequest) {
  const token = request.cookies.get("auth_token")?.value;
  if (!token) {
    return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
  }
  return NextResponse.json({ token });
}
