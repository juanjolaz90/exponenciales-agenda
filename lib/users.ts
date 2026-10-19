import "server-only";
import { eq } from "drizzle-orm";
import { getDb } from "./db";
import { users, type User } from "./schema";
import { newId } from "./crypto";
import { RESERVED_SLUGS } from "./meeting-config";

/** ALLOWED_EMAILS (separados por comas). Si está vacío, solo se permite crear el primer usuario. */
export async function isEmailAllowed(email: string) {
  const list = (process.env.ALLOWED_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (list.length) return list.includes(email.toLowerCase());
  const db = await getDb();
  const any = await db.select({ id: users.id }).from(users).limit(1);
  if (!any.length) return true;
  return Boolean(await db.query.users.findFirst({ where: eq(users.email, email.toLowerCase()) }));
}

export function slugify(s: string) {
  return (
    s
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "agenda"
  );
}

export async function uniqueUserSlug(base: string) {
  const db = await getDb();
  let slug = slugify(base);
  for (let i = 2; RESERVED_SLUGS.has(slug) || (await db.query.users.findFirst({ where: eq(users.slug, slug) })); i++) {
    slug = `${slugify(base)}-${i}`;
  }
  return slug;
}

export async function upsertUser(p: {
  email: string;
  name: string;
  image?: string | null;
  tokens?: Partial<Pick<User, "googleRefreshToken" | "googleAccessToken" | "googleTokenExpiry">>;
}): Promise<User> {
  const db = await getDb();
  const email = p.email.toLowerCase();
  const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
  if (existing) {
    const set: Partial<User> = { image: existing.image ?? p.image ?? null };
    if (p.tokens?.googleAccessToken) set.googleAccessToken = p.tokens.googleAccessToken;
    if (p.tokens?.googleTokenExpiry) set.googleTokenExpiry = p.tokens.googleTokenExpiry;
    if (p.tokens?.googleRefreshToken) set.googleRefreshToken = p.tokens.googleRefreshToken;
    await db.update(users).set(set).where(eq(users.id, existing.id));
    return { ...existing, ...set };
  }
  const user: User = {
    id: newId(),
    email,
    name: p.name,
    image: p.image ?? null,
    slug: await uniqueUserSlug(p.name.split(" ")[0] || email.split("@")[0]),
    timezone: "Europe/Madrid",
    googleRefreshToken: p.tokens?.googleRefreshToken ?? null,
    googleAccessToken: p.tokens?.googleAccessToken ?? null,
    googleTokenExpiry: p.tokens?.googleTokenExpiry ?? null,
    calendarId: "primary",
    createdAt: Date.now(),
  };
  await db.insert(users).values(user);
  return user;
}
