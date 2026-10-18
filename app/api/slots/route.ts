import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { DateTime } from "luxon";
import { getDb } from "@/lib/db";
import { meetingTypes, users } from "@/lib/schema";
import { availableSlots, parseType } from "@/lib/booking";
import { groupByDay } from "@/lib/availability";
import { isValidTimeZone } from "@/lib/meeting-config";

export const dynamic = "force-dynamic";

/** GET /api/slots?type=ID&duration=30&tz=Europe/Madrid&month=2026-10 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const tz = q.get("tz") ?? "UTC";
  const duration = Number(q.get("duration"));
  const month = DateTime.fromFormat(q.get("month") ?? "", "yyyy-MM", { zone: tz });
  if (!isValidTimeZone(tz) || !month.isValid) return NextResponse.json({ error: "Parámetros no válidos" }, { status: 400 });

  const db = await getDb();
  const row = await db.query.meetingTypes.findFirst({
    where: and(eq(meetingTypes.id, q.get("type") ?? ""), eq(meetingTypes.active, true)),
  });
  if (!row) return NextResponse.json({ error: "No encontrada" }, { status: 404 });
  const type = parseType(row);
  if (!type.config.durations.includes(duration)) return NextResponse.json({ error: "Duración no válida" }, { status: 400 });
  const user = (await db.query.users.findFirst({ where: eq(users.id, row.userId) }))!;

  const from = month.startOf("month").toMillis();
  const to = month.endOf("month").toMillis() + 1;
  const slots = await availableSlots(user, type, duration, from, to);
  return NextResponse.json({ days: groupByDay(slots, tz) }, { headers: { "cache-control": "no-store" } });
}
