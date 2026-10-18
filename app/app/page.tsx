import Link from "next/link";
import { and, asc, desc, eq, gt } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { bookings, meetingTypes } from "@/lib/schema";
import { requireUser } from "@/lib/session";
import { parseType, formatRange } from "@/lib/booking";
import { appUrl, googleConfigured } from "@/lib/google";
import { hubspotConfigured } from "@/lib/hubspot";
import { LOCATION_LABEL } from "@/lib/meeting-config";
import { nowMs } from "@/lib/time";
import { CopyLink } from "@/components/admin/CopyLink";
import { ToggleActive } from "@/components/admin/ToggleActive";

export const metadata = { title: "Agendas" };

export default async function Dashboard() {
  const user = await requireUser();
  const db = await getDb();
  const types = (
    await db.select().from(meetingTypes).where(eq(meetingTypes.userId, user.id)).orderBy(desc(meetingTypes.createdAt))
  ).map(parseType);
  const upcoming = await db
    .select()
    .from(bookings)
    .where(and(eq(bookings.userId, user.id), eq(bookings.status, "confirmed"), gt(bookings.endUtc, nowMs())))
    .orderBy(asc(bookings.startUtc))
    .limit(5);
  const titleOf = new Map(types.map((t) => [t.id, t.title]));
  const googleOk = googleConfigured() && Boolean(user.googleRefreshToken);

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="eyebrow">Panel</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">Tus agendas</h1>
          <p className="mt-1 text-sm text-muted">
            Página pública:{" "}
            <Link href={`/${user.slug}`} className="font-mono text-ink underline decoration-line underline-offset-4" target="_blank">
              {appUrl().replace(/^https?:\/\//, "")}/{user.slug}
            </Link>
          </p>
        </div>
        <Link href="/app/agendas/nueva" className="btn-primary">
          + Nueva agenda
        </Link>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <Status ok={googleOk} label="Google Calendar" hint={googleOk ? "Conectado" : "Sin conectar"} />
        <Status ok={hubspotConfigured()} label="HubSpot" hint={hubspotConfigured() ? "Token configurado" : "Falta HUBSPOT_ACCESS_TOKEN"} />
      </div>

      {types.length === 0 ? (
        <div className="card grid place-items-center px-6 py-16 text-center">
          <p className="text-lg font-semibold">Todavía no tienes ninguna agenda</p>
          <p className="mt-1 max-w-sm text-sm text-muted">
            Crea tu primer enlace de reunión: duraciones, horario, preguntas y sincronización con HubSpot.
          </p>
          <Link href="/app/agendas/nueva" className="btn-primary mt-6">
            Crear agenda
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {types.map((t) => {
            const url = `${appUrl()}/${user.slug}/${t.slug}`;
            return (
              <div key={t.id} className="card flex flex-col overflow-hidden">
                <div className="h-1" style={{ background: t.config.accent }} />
                <div className="flex flex-1 flex-col p-5">
                  <div className="flex items-start justify-between gap-3">
                    <Link href={`/app/agendas/${t.id}`} className="text-lg font-semibold leading-tight hover:underline">
                      {t.title}
                    </Link>
                    <ToggleActive id={t.id} active={t.active} />
                  </div>
                  <p className="mt-1 font-mono text-xs text-dim">/{user.slug}/{t.slug}</p>
                  <p className="mt-3 text-sm text-muted">
                    {t.config.durations.map((d) => `${d} min`).join(" · ")} — {LOCATION_LABEL[t.config.location.type]}
                  </p>
                  <div className="mt-auto flex gap-2 pt-5">
                    <CopyLink url={url} />
                    <Link href={`/${user.slug}/${t.slug}`} target="_blank" className="btn-ghost px-3 py-1.5 text-xs">
                      Ver
                    </Link>
                    <Link href={`/app/agendas/${t.id}`} className="btn-ghost ml-auto px-3 py-1.5 text-xs">
                      Editar
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <section>
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">Próximas reuniones</h2>
          <Link href="/app/reservas" className="text-xs text-muted hover:text-ink">
            Ver todas →
          </Link>
        </div>
        <div className="card mt-3 divide-y divide-line">
          {upcoming.length === 0 && <p className="px-5 py-6 text-sm text-dim">No hay reuniones próximas.</p>}
          {upcoming.map((b) => (
            <div key={b.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3 text-sm">
              <span className="font-mono text-xs text-muted">{formatRange(b.startUtc, b.endUtc, user.timezone)}</span>
              <span className="font-medium">
                {b.firstName} {b.lastName}
              </span>
              <span className="text-dim">{titleOf.get(b.meetingTypeId) ?? "—"}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Status({ ok, label, hint }: { ok: boolean; label: string; hint: string }) {
  return (
    <Link href="/app/ajustes" className="inline-flex items-center gap-2 rounded-full border border-line px-3 py-1 hover:bg-surface-2">
      <span className={`size-1.5 rounded-full ${ok ? "bg-emerald-400" : "bg-amber-400"}`} />
      <span className="text-ink">{label}</span>
      <span className="text-dim">{hint}</span>
    </Link>
  );
}
