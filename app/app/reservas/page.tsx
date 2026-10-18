import { and, asc, desc, eq, gt, lte } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { bookings, meetingTypes } from "@/lib/schema";
import { requireUser } from "@/lib/session";
import { formatRange } from "@/lib/booking";
import Link from "next/link";
import { nowMs } from "@/lib/time";
import { CancelBookingButton } from "@/components/admin/CancelBookingButton";

export const metadata = { title: "Reservas" };

export default async function BookingsPage(props: PageProps<"/app/reservas">) {
  const user = await requireUser();
  const { vista } = await props.searchParams;
  const past = vista === "pasadas";
  const db = await getDb();
  const now = nowMs();
  const rows = await db
    .select({ b: bookings, title: meetingTypes.title })
    .from(bookings)
    .leftJoin(meetingTypes, eq(meetingTypes.id, bookings.meetingTypeId))
    .where(and(eq(bookings.userId, user.id), past ? lte(bookings.endUtc, now) : gt(bookings.endUtc, now)))
    .orderBy(past ? desc(bookings.startUtc) : asc(bookings.startUtc))
    .limit(200);

  return (
    <div>
      <p className="eyebrow">Reservas</p>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-3xl font-bold tracking-tight">Reuniones</h1>
        <div className="flex rounded-lg border border-line p-0.5 text-sm">
          <Link href="/app/reservas" className={`rounded-md px-3 py-1 ${!past ? "bg-surface-2" : "text-muted"}`}>
            Próximas
          </Link>
          <Link href="/app/reservas?vista=pasadas" className={`rounded-md px-3 py-1 ${past ? "bg-surface-2" : "text-muted"}`}>
            Pasadas
          </Link>
        </div>
      </div>

      <div className="card mt-6 overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-line text-xs text-dim">
            <tr>
              <th className="px-5 py-3 font-medium">Cuándo</th>
              <th className="px-5 py-3 font-medium">Invitado</th>
              <th className="px-5 py-3 font-medium">Agenda</th>
              <th className="px-5 py-3 font-medium">Sincronización</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-dim">
                  No hay reuniones {past ? "pasadas" : "próximas"}.
                </td>
              </tr>
            )}
            {rows.map(({ b, title }) => {
              const log = JSON.parse(b.integrationLog) as string[];
              const cancelled = b.status === "cancelled";
              return (
                <tr key={b.id} className={cancelled ? "opacity-50" : ""}>
                  <td className="px-5 py-3 font-mono text-xs text-muted">
                    {formatRange(b.startUtc, b.endUtc, user.timezone)}
                    {cancelled && <span className="ml-2 rounded bg-accent/15 px-1.5 py-0.5 text-accent">Cancelada</span>}
                  </td>
                  <td className="px-5 py-3">
                    <div className="font-medium">
                      {b.firstName} {b.lastName}
                    </div>
                    <div className="text-xs text-dim">{b.email}</div>
                  </td>
                  <td className="px-5 py-3 text-muted">{title ?? "—"}</td>
                  <td className="px-5 py-3">
                    <div className="flex flex-wrap gap-1.5">
                      {log.map((l) => (
                        <span
                          key={l}
                          title={l}
                          className={`max-w-48 truncate rounded px-1.5 py-0.5 font-mono text-[10px] ${
                            l.includes(":ok") ? "bg-emerald-400/10 text-emerald-300" : l.includes("error") ? "bg-accent/15 text-accent" : "bg-surface-2 text-dim"
                          }`}
                        >
                          {l}
                        </span>
                      ))}
                      {b.meetUrl && (
                        <a href={b.meetUrl} target="_blank" className="font-mono text-[10px] text-muted underline">
                          enlace
                        </a>
                      )}
                    </div>
                  </td>
                  <td className="px-5 py-3 text-right">{!cancelled && !past && <CancelBookingButton id={b.id} />}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
