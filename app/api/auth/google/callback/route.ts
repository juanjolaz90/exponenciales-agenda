import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { appUrl, exchangeCode, fetchProfile } from "@/lib/google";
import { encrypt } from "@/lib/crypto";
import { isEmailAllowed, upsertUser } from "@/lib/users";
import { startSession } from "@/lib/session";

export async function GET(req: NextRequest) {
  const fail = (code: string) => NextResponse.redirect(`${appUrl()}/login?error=${code}`);
  const jar = await cookies();
  const expected = jar.get("ea_oauth_state")?.value;
  jar.delete("ea_oauth_state");
  const code = req.nextUrl.searchParams.get("code");
  if (!code || !expected || req.nextUrl.searchParams.get("state") !== expected) return fail("state");

  try {
    const t = await exchangeCode(code);
    const profile = await fetchProfile(t.access_token);
    if (!profile.email_verified) return fail("unverified");
    if (!(await isEmailAllowed(profile.email))) return fail("forbidden");
    const user = await upsertUser({
      email: profile.email,
      name: profile.name ?? profile.email.split("@")[0],
      image: profile.picture,
      tokens: {
        googleAccessToken: encrypt(t.access_token),
        googleTokenExpiry: Date.now() + t.expires_in * 1000,
        ...(t.refresh_token ? { googleRefreshToken: encrypt(t.refresh_token) } : {}),
      },
    });
    await startSession(user.id);
    return NextResponse.redirect(`${appUrl()}/app`);
  } catch (e) {
    console.error("[google callback]", e);
    return fail("google");
  }
}
