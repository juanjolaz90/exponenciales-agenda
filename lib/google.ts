import "server-only";
import { eq } from "drizzle-orm";
import { decrypt, encrypt, newId } from "./crypto";
import { getDb } from "./db";
import { users, type User } from "./schema";
import type { Interval } from "./availability";

export const GOOGLE_SCOPES = [
  "openid",
  "email",
  "profile",
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.freebusy",
];

export const googleConfigured = () =>
  Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export const appUrl = () => (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
const redirectUri = () => `${appUrl()}/api/auth/google/callback`;

export function googleAuthUrl(state: string) {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: GOOGLE_SCOPES.join(" "),
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

type TokenResponse = {
  access_token: string;
  expires_in: number;
  refresh_token?: string;
  id_token?: string;
  scope?: string;
};

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      ...body,
    }),
  });
  if (!res.ok) throw new Error(`Google token ${res.status}: ${await res.text()}`);
  return res.json();
}

export const exchangeCode = (code: string) =>
  tokenRequest({ code, grant_type: "authorization_code", redirect_uri: redirectUri() });

export async function fetchProfile(accessToken: string) {
  const res = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Google userinfo ${res.status}`);
  return (await res.json()) as { email: string; email_verified: boolean; name?: string; picture?: string };
}

/** Access token válido para el usuario, renovándolo si caducó. Null si no hay Google conectado. */
async function accessTokenFor(user: User): Promise<string | null> {
  if (!user.googleRefreshToken || !googleConfigured()) return null;
  if (user.googleAccessToken && user.googleTokenExpiry && user.googleTokenExpiry > Date.now() + 60_000) {
    return decrypt(user.googleAccessToken);
  }
  const t = await tokenRequest({
    grant_type: "refresh_token",
    refresh_token: decrypt(user.googleRefreshToken),
  });
  const db = await getDb();
  await db
    .update(users)
    .set({ googleAccessToken: encrypt(t.access_token), googleTokenExpiry: Date.now() + t.expires_in * 1000 })
    .where(eq(users.id, user.id));
  return t.access_token;
}

async function gcal(user: User, path: string, init: RequestInit = {}) {
  const token = await accessTokenFor(user);
  if (!token) return null;
  const res = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    ...init,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...init.headers },
    cache: "no-store",
  });
  if (!res.ok && res.status !== 410) throw new Error(`Google Calendar ${res.status}: ${await res.text()}`);
  return res.status === 204 || res.status === 410 ? {} : res.json();
}

export async function busyTimes(user: User, from: number, to: number): Promise<Interval[]> {
  const data = (await gcal(user, "/freeBusy", {
    method: "POST",
    body: JSON.stringify({
      timeMin: new Date(from).toISOString(),
      timeMax: new Date(to).toISOString(),
      items: [{ id: user.calendarId }],
    }),
  })) as { calendars?: Record<string, { busy?: { start: string; end: string }[] }> } | null;
  if (!data) return [];
  return Object.values(data.calendars ?? {}).flatMap((c) =>
    (c.busy ?? []).map((b) => ({ start: Date.parse(b.start), end: Date.parse(b.end) })),
  );
}

export async function createEvent(
  user: User,
  ev: {
    summary: string;
    description: string;
    start: number;
    end: number;
    timezone: string;
    attendees: string[];
    withMeet: boolean;
    location?: string;
  },
): Promise<{ id: string; meetUrl: string | null } | null> {
  const body = {
    summary: ev.summary,
    description: ev.description,
    start: { dateTime: new Date(ev.start).toISOString(), timeZone: ev.timezone },
    end: { dateTime: new Date(ev.end).toISOString(), timeZone: ev.timezone },
    attendees: ev.attendees.map((email) => ({ email })),
    location: ev.location || undefined,
    conferenceData: ev.withMeet
      ? { createRequest: { requestId: newId(), conferenceSolutionKey: { type: "hangoutsMeet" } } }
      : undefined,
    reminders: { useDefault: true },
  };
  const data = (await gcal(
    user,
    `/calendars/${encodeURIComponent(user.calendarId)}/events?conferenceDataVersion=1&sendUpdates=all`,
    { method: "POST", body: JSON.stringify(body) },
  )) as { id: string; hangoutLink?: string } | null;
  if (!data) return null;
  return { id: data.id, meetUrl: data.hangoutLink ?? null };
}

export async function deleteEvent(user: User, eventId: string) {
  await gcal(user, `/calendars/${encodeURIComponent(user.calendarId)}/events/${encodeURIComponent(eventId)}?sendUpdates=all`, {
    method: "DELETE",
  });
}
