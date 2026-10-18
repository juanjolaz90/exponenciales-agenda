import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { eq } from "drizzle-orm";
import { secret } from "./crypto";
import { getDb } from "./db";
import { users } from "./schema";

const COOKIE = "ea_session";
const MAX_AGE = 60 * 60 * 24 * 30;
const enc = () => new TextEncoder().encode(secret());

export async function startSession(userId: string) {
  const jwt = await new SignJWT({ sub: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(enc());
  (await cookies()).set(COOKIE, jwt, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: MAX_AGE,
  });
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

export async function currentUser() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, enc());
    if (!payload.sub) return null;
    const db = await getDb();
    return (await db.query.users.findFirst({ where: eq(users.id, payload.sub) })) ?? null;
  } catch {
    return null;
  }
}

export async function requireUser() {
  const u = await currentUser();
  if (!u) redirect("/login");
  return u;
}
