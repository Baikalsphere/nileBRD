import { NextResponse } from "next/server";

export async function POST() {
  const res = NextResponse.json({ message: "Logged out" }, { status: 200 });
  res.cookies.delete("auth_token");
  res.cookies.delete("user_meta");
  return res;
}
