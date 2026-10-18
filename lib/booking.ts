import "server-only";
import { and, eq, gt, lt } from "drizzle-orm";
import { DateTime } from "luxon";
import { z } from "zod";
import { getDb } from "./db";
import { bookings, meetingTypes, users, type Booking, type MeetingTypeRow, type User } from "./schema";
import { meetingConfigSchema, LOCATION_LABEL, type MeetingConfig } from "./meeting-config";
import { computeSlots, type Interval } from "./availability";
import { newId } from "./crypto";
import * as google from "./google";
import * as hubspot from "./hubspot";

export type MeetingType = Omit<MeetingTypeRow, "config"> & { config: MeetingConfig };

export function parseType(row: MeetingTypeRow): MeetingType {
  return { ...row, config: meetingConfigSchema.parse(JSON.parse(row.config)) };
}

export async function getPublicType(userSlug: string, typeSlug: string) {
  const db = await getDb();
  const user = await db.query.users.findFirst({ where: eq(users.slug, userSlug) });
  if (!user) return null;
  const row = await db.query.meetingTypes.findFirst({
    where: and(eq(meetingTypes.userId, user.id), eq(meetingTypes.slug, typeSlug), eq(meetingTypes.active, true)),
  });
  return row ? { user, type: parseType(row) } : null;
}

/** Ocupado = calendario de Google + reservas confirmadas en nuestra base de datos. */
export async function busyFor(user: User, from: number, to: number): Promise<Interval[]> {
  const db = await getDb();
  const own = await db
    .select({ start: bookings.startUtc, end: bookings.endUtc })
    .from(bookings)
    .where(and(eq(bookings.userId, user.id), eq(bookings.status, "confirmed"), lt(bookings.startUtc, to), gt(bookings.endUtc, from)));
  let gcal: Interval[] = [];
  try {
    gcal = await google.busyTimes(user, from, to);
  } catch (e) {
    console.error("[freeBusy]", e);
  }
  return [...own, ...gcal];
}

export async function availableSlots(user: User, type: MeetingType, duration: number, from: number, to: number) {
  const busy = await busyFor(user, from - 24 * 3600_000, to + 24 * 3600_000);
  return computeSlots({ config: type.config, duration, from, to, now: Date.now(), busy });
}

export const bookingInputSchema = z.object({
  typeId: z.string().min(1),
  start: z.number().int(),
  duration: z.number().int(),
  timezone: z.string().min(1),
  firstName: z.string().trim().min(1, "Obligatorio").max(80),
  lastName: z.string().trim().min(1, "Obligatorio").max(80),
  email: z.string().trim().toLowerCase().email("Email no válido"),
  guests: z.array(z.string().trim().toLowerCase().email()).max(20),
  answers: z.record(z.string(), z.string().max(4000)),
  website: z.string().max(0).optional(), // honeypot
});
export type BookingInput = z.infer<typeof bookingInputSchema>;

export class BookingError extends Error {}

export async function createBooking(input: BookingInput): Promise<Booking> {
  const db = await getDb();
  const row = await db.query.meetingTypes.findFirst({
    where: and(eq(meetingTypes.id, input.typeId), eq(meetingTypes.active, true)),
  });
  if (!row) throw new BookingError("Esta agenda ya no está disponible.");
  const type = parseType(row);
  const user = (await db.query.users.findFirst({ where: eq(users.id, row.userId) }))!;
  const c = type.config;

  if (!c.durations.includes(input.duration)) throw new BookingError("Duración no válida.");
  const guests = c.guests.enabled ? [...new Set(input.guests)].filter((g) => g !== input.email) : [];
  if (guests.length > c.guests.max) throw new BookingError(`Máximo ${c.guests.max} invitados.`);
  for (const q of c.questions) {
    if (q.required && !input.answers[q.id]?.trim()) throw new BookingError(`Responde: ${q.label}`);
  }

  // La hora debe seguir libre (Google + reservas).
  const end = input.start + input.duration * 60_000;
  const slots = await availableSlots(user, type, input.duration, input.start, input.start + 1);
  if (!slots.includes(input.start)) throw new BookingError("Esa hora ya no está disponible. Elige otra, por favor.");

  const booking: Booking = {
    id: newId(9),
    meetingTypeId: type.id,
    userId: user.id,
    startUtc: input.start,
    endUtc: end,
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    guests: JSON.stringify(guests),
    answers: JSON.stringify(
      Object.fromEntries(c.questions.map((q) => [q.id, input.answers[q.id]?.trim() ?? ""])),
    ),
    timezone: input.timezone,
    status: "confirmed",
    googleEventId: null,
    meetUrl: null,
    hubspotContactId: null,
    hubspotMeetingId: null,
    integrationLog: "[]",
    token: newId(18),
    createdAt: Date.now(),
  };

  // Inserción atómica: rechaza si otra reserva se solapa (doble clic o dos visitantes a la vez).
  const pad = { before: c.bufferBefore * 60_000, after: c.bufferAfter * 60_000 };
  await db.transaction(async (tx) => {
    const clash = await tx
      .select({ id: bookings.id })
      .from(bookings)
      .where(
        and(
          eq(bookings.userId, user.id),
          eq(bookings.status, "confirmed"),
          lt(bookings.startUtc, end + pad.after),
          gt(bookings.endUtc, input.start - pad.before),
        ),
      )
      .limit(1);
    if (clash.length) throw new BookingError("Esa hora ya no está disponible. Elige otra, por favor.");
    await tx.insert(bookings).values(booking);
  });

  await syncIntegrations(user, type, booking);
  return (await db.query.bookings.findFirst({ where: eq(bookings.id, booking.id) }))!;
}

function describe(type: MeetingType, b: Booking) {
  const answers = JSON.parse(b.answers) as Record<string, string>;
  const lines = [
    `Reserva desde Exponenciales Agenda (${type.title}).`,
    `Invitado: ${b.firstName} ${b.lastName} <${b.email}>`,
    ...type.config.questions.filter((q) => answers[q.id]).map((q) => `${q.label}: ${answers[q.id]}`),
  ];
  if (type.config.location.type !== "meet" && type.config.location.value) {
    lines.push(`${LOCATION_LABEL[type.config.location.type]}: ${type.config.location.value}`);
  }
  return lines.join("\n");
}

async function syncIntegrations(user: User, type: MeetingType, b: Booking) {
  const db = await getDb();
  const log: string[] = [];
  const patch: Partial<Booking> = {};
  const title = `${type.title} · ${b.firstName} ${b.lastName}`;
  const loc = type.config.location;

  try {
    const ev = await google.createEvent(user, {
      summary: title,
      description: describe(type, b),
      start: b.startUtc,
      end: b.endUtc,
      timezone: type.config.timezone,
      attendees: [b.email, ...(JSON.parse(b.guests) as string[])],
      withMeet: loc.type === "meet",
      location: loc.type === "meet" ? undefined : loc.value,
    });
    if (ev) {
      patch.googleEventId = ev.id;
      patch.meetUrl = ev.meetUrl ?? (loc.type === "link" ? loc.value : null);
      log.push("google:ok");
    } else log.push("google:no-conectado");
  } catch (e) {
    log.push(`google:error ${(e as Error).message.slice(0, 200)}`);
  }
  if (!patch.meetUrl && loc.type === "link") patch.meetUrl = loc.value;

  if (type.config.syncHubspot && hubspot.hubspotConfigured()) {
    try {
      const phoneQ = type.config.questions.find((q) => q.type === "phone");
      const phone = phoneQ ? (JSON.parse(b.answers) as Record<string, string>)[phoneQ.id] : undefined;
      const contactId = await hubspot.upsertContact({ email: b.email, firstName: b.firstName, lastName: b.lastName, phone });
      patch.hubspotContactId = contactId;
      const ownerId = await hubspot.ownerIdByEmail(user.email).catch(() => null);
      patch.hubspotMeetingId = await hubspot.createMeeting({
        contactId,
        ownerId,
        title,
        body: describe(type, b).replace(/\n/g, "<br>"),
        start: b.startUtc,
        end: b.endUtc,
        location: loc.type === "meet" ? "Google Meet" : loc.value || LOCATION_LABEL[loc.type],
        url: patch.meetUrl ?? null,
      });
      log.push("hubspot:ok");
    } catch (e) {
      log.push(`hubspot:error ${(e as Error).message.slice(0, 200)}`);
    }
  } else log.push("hubspot:desactivado");

  await db.update(bookings).set({ ...patch, integrationLog: JSON.stringify(log) }).where(eq(bookings.id, b.id));
}

export async function cancelBooking(b: Booking) {
  if (b.status === "cancelled") return;
  const db = await getDb();
  const user = (await db.query.users.findFirst({ where: eq(users.id, b.userId) }))!;
  const log = JSON.parse(b.integrationLog) as string[];
  if (b.googleEventId) {
    await google.deleteEvent(user, b.googleEventId).catch((e) => log.push(`google-cancel:error ${e.message}`));
  }
  if (b.hubspotMeetingId && hubspot.hubspotConfigured()) {
    await hubspot.cancelMeeting(b.hubspotMeetingId).catch((e) => log.push(`hubspot-cancel:error ${e.message}`));
  }
  await db.update(bookings).set({ status: "cancelled", integrationLog: JSON.stringify(log) }).where(eq(bookings.id, b.id));
}

export function formatRange(start: number, end: number, tz: string) {
  const s = DateTime.fromMillis(start, { zone: tz }).setLocale("es");
  const e = DateTime.fromMillis(end, { zone: tz }).setLocale("es");
  const day = s.toFormat("cccc d 'de' LLLL 'de' yyyy");
  return `${day.charAt(0).toUpperCase()}${day.slice(1)}, ${s.toFormat("HH:mm")}–${e.toFormat("HH:mm")}`;
}
