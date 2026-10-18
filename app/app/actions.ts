"use server";

import { revalidatePath } from "next/cache";
import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { getDb } from "@/lib/db";
import { bookings, meetingTypes, users } from "@/lib/schema";
import { requireUser } from "@/lib/session";
import { meetingTypeInputSchema, isValidTimeZone, RESERVED_SLUGS, type MeetingTypeInput } from "@/lib/meeting-config";
import { newId } from "@/lib/crypto";
import { cancelBooking } from "@/lib/booking";

export type ActionResult = { ok: true; id?: string } | { ok: false; error: string };

export async function saveMeetingType(id: string | null, raw: MeetingTypeInput): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = meetingTypeInputSchema.safeParse(raw);
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    return { ok: false, error: `${i.path.join(".")}: ${i.message}` };
  }
  const data = parsed.data;
  const db = await getDb();

  const clash = await db.query.meetingTypes.findFirst({
    where: and(eq(meetingTypes.userId, user.id), eq(meetingTypes.slug, data.slug), id ? ne(meetingTypes.id, id) : undefined),
  });
  if (clash) return { ok: false, error: "Ya tienes otra agenda con esa URL." };

  const values = {
    title: data.title,
    slug: data.slug,
    description: data.description,
    active: data.active,
    config: JSON.stringify(data.config),
    updatedAt: Date.now(),
  };
  if (id) {
    const res = await db
      .update(meetingTypes)
      .set(values)
      .where(and(eq(meetingTypes.id, id), eq(meetingTypes.userId, user.id)));
    if (!res.rowsAffected) return { ok: false, error: "Agenda no encontrada." };
  } else {
    id = newId();
    await db.insert(meetingTypes).values({ id, userId: user.id, createdAt: Date.now(), ...values });
  }
  revalidatePath("/app");
  return { ok: true, id };
}

export async function deleteMeetingType(id: string) {
  const user = await requireUser();
  const db = await getDb();
  await db.delete(meetingTypes).where(and(eq(meetingTypes.id, id), eq(meetingTypes.userId, user.id)));
  revalidatePath("/app");
}

export async function toggleMeetingType(id: string, active: boolean) {
  const user = await requireUser();
  const db = await getDb();
  await db
    .update(meetingTypes)
    .set({ active, updatedAt: Date.now() })
    .where(and(eq(meetingTypes.id, id), eq(meetingTypes.userId, user.id)));
  revalidatePath("/app");
}

const settingsSchema = z.object({
  name: z.string().trim().min(1).max(80),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Solo minúsculas, números y guiones")
    .max(40),
  timezone: z.string().refine(isValidTimeZone, "Zona horaria no válida"),
  calendarId: z.string().trim().min(1).max(200),
});

export async function saveSettings(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = settingsSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const s = parsed.data;
  if (RESERVED_SLUGS.has(s.slug)) return { ok: false, error: "Esa URL está reservada." };
  const db = await getDb();
  const taken = await db.query.users.findFirst({ where: and(eq(users.slug, s.slug), ne(users.id, user.id)) });
  if (taken) return { ok: false, error: "Esa URL ya está en uso." };
  await db.update(users).set(s).where(eq(users.id, user.id));
  revalidatePath("/app", "layout");
  return { ok: true };
}

export async function cancelBookingAsHost(id: string) {
  const user = await requireUser();
  const db = await getDb();
  const b = await db.query.bookings.findFirst({ where: and(eq(bookings.id, id), eq(bookings.userId, user.id)) });
  if (b) await cancelBooking(b);
  revalidatePath("/app/reservas");
  revalidatePath("/app");
}
