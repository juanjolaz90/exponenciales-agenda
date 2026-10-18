import { notFound } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { timingSafeEqual } from "node:crypto";
import { getDb } from "@/lib/db";
import { bookings, meetingTypes, users } from "@/lib/schema";
import { cancelBooking, formatRange, parseType } from "@/lib/booking";
import { nowMs } from "@/lib/time";
import { LOCATION_LABEL } from "@/lib/meeting-config";

export const metadata = { title: "Reunión confirmada", robots: { index: false } };

const sameToken = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

async function load(id: string, token: string) {
  const db = await getDb();
  const b = await db.query.bookings.findFirst({ where: eq(bookings.id, id) });
  if (!b || !sameToken(b.token, token)) return null;
  const row = await db.query.meetingTypes.findFirst({ where: eq(meetingTypes.id, b.meetingTypeId) });
  const host = await db.query.users.findFirst({ where: eq(users.id, b.userId) });
  return { b, type: row ? parseType(row) : null, host };
}

export default async function BookingPage(props: PageProps<"/b/[id]">) {
  const { id } = await props.params;
  const { t } = await props.searchParams;
  const token = typeof t === "string" ? t : "";
  const data = await load(id, token);
  if (!data) notFound();
  const { b, type, host } = data;
  const cancelled = b.status === "cancelled";
  const past = b.endUtc < nowMs();
  const accent = type?.config.accent ?? "#F43A59";

  async function cancel() {
    "use server";
    const d = await load(id, token);
    if (d && d.b.endUtc > nowMs()) await cancelBooking(d.b);
    revalidatePath(`/b/${id}`);
  }

  const gcalLink = `https://calendar.google.com/calendar/render?${new URLSearchParams({
    action: "TEMPLATE",
    text: `${type?.title ?? "Reunión"} con ${host?.name ?? ""}`,
    dates: `${iso(b.startUtc)}/${iso(b.endUtc)}`,
    details: b.meetUrl ? `Enlace: ${b.meetUrl}` : "",
  })}`;

  return (
    <main className="grid flex-1 place-items-center px-4 py-14">
      <div className="card w-full max-w-lg overflow-hidden">
        <div className="h-1.5" style={{ background: cancelled ? "#77737F" : accent }} />
        <div className="p-8">
          <span
            className="grid size-12 place-items-center rounded-full text-xl"
            style={{ background: cancelled ? "#1a1724" : `${accent}22`, color: cancelled ? "#A9A5B3" : accent }}
          >
            {cancelled ? "✕" : "✓"}
          </span>
          <h1 className="mt-5 text-2xl font-bold tracking-tight">{cancelled ? "Reunión cancelada" : "¡Reunión confirmada!"}</h1>
          {!cancelled && type?.config.confirmationMessage && <p className="mt-2 text-sm text-muted">{type.config.confirmationMessage}</p>}

          <dl className="mt-6 space-y-3 rounded-xl border border-line bg-bg p-4 text-sm">
            <Row k="Qué">{type?.title ?? "Reunión"} con {host?.name}</Row>
            <Row k="Cuándo">
              <span>{formatRange(b.startUtc, b.endUtc, b.timezone)}</span>
              <span className="block font-mono text-xs text-dim">{b.timezone}</span>
            </Row>
            {type && (
              <Row k="Dónde">
                {b.meetUrl ? (
                  <a href={b.meetUrl} className="underline" style={{ color: accent }}>
                    {type.config.location.type === "meet" ? "Google Meet" : b.meetUrl}
                  </a>
                ) : (
                  type.config.location.value || LOCATION_LABEL[type.config.location.type]
                )}
              </Row>
            )}
            <Row k="Invitado">
              {b.firstName} {b.lastName} · {b.email}
            </Row>
          </dl>

          {!cancelled && !past && (
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <a href={gcalLink} target="_blank" className="btn-ghost text-xs">
                Añadir a Google Calendar
              </a>
              <form action={cancel} className="ml-auto">
                <button className="text-xs text-dim hover:text-accent">Cancelar reunión</button>
              </form>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

const iso = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[72px_1fr] gap-3">
      <dt className="font-mono text-[11px] uppercase tracking-wider text-dim">{k}</dt>
      <dd>{children}</dd>
    </div>
  );
}

