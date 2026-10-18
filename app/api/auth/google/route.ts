import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { googleAuthUrl, googleConfigured } from "@/lib/google";
import { newId } from "@/lib/crypto";

export async function GET() {
  if (!googleConfigured()) return NextResponse.redirect(new URL("/login?error=google", process.env.APP_URL ?? "http://localhost:3000"));
  const state = newId(16);
  (await cookies()).set("ea_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 600,
  });
  return NextResponse.redirect(googleAuthUrl(state));
}
