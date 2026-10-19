import { requireUser } from "@/lib/session";
import { appUrl, calendarsToCheck, googleConfigured, type CheckedCalendar } from "@/lib/google";
import { hubspotConfigured } from "@/lib/hubspot";
import { SettingsForm } from "@/components/admin/SettingsForm";

export const metadata = { title: "Ajustes" };

export default async function SettingsPage() {
  const user = await requireUser();
  const googleOk = googleConfigured() && Boolean(user.googleRefreshToken);
  let checked: { calendars: CheckedCalendar[]; needsReconnect: boolean } | null = null;
  let calendarError = false;
  if (googleOk) {
    try {
      checked = await calendarsToCheck(user);
    } catch {
      calendarError = true;
    }
  }
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <p className="eyebrow">Ajustes</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Perfil e integraciones</h1>
      </div>

      <SettingsForm
        baseUrl={appUrl()}
        initial={{ name: user.name, slug: user.slug, timezone: user.timezone, calendarId: user.calendarId, image: user.image ?? "" }}
      />

      <section className="card space-y-4 p-6">
        <h2 className="font-semibold">Integraciones</h2>
        <Row
          title="Google Calendar y Meet"
          ok={googleOk}
          text={
            googleOk
              ? `Conectado como ${user.email}. Se leen tus huecos ocupados y se crean eventos con enlace de Meet.`
              : googleConfigured()
                ? "Vuelve a entrar con Google para conceder acceso al calendario."
                : "Configura GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET (ver README)."
          }
          action={googleConfigured() ? (
            // eslint-disable-next-line @next/next/no-html-link-for-pages -- ruta de API, navegación completa
            <a href="/api/auth/google" className="btn-ghost px-3 py-1.5 text-xs">{googleOk ? "Reconectar" : "Conectar"}</a>
          ) : null}
        />
        {googleOk && (
          <div className="rounded-xl border border-line p-4">
            <p className="text-sm font-medium">Calendarios que bloquean tu agenda</p>
            {calendarError && (
              <p className="mt-1 text-sm text-accent">Google no responde ahora mismo; revisa que la Google Calendar API esté activada.</p>
            )}
            {checked?.needsReconnect && (
              <p className="mt-1 text-sm text-amber-300">
                Solo se consulta el calendario principal. Pulsa «Reconectar» arriba para que bloquee cualquier calendario de tu cuenta.
              </p>
            )}
            {checked && (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {checked.calendars.map((c) => (
                  <li key={c.id} className="rounded-full bg-surface-2 px-2.5 py-1 text-xs text-muted">
                    {c.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <Row
          title="HubSpot"
          ok={hubspotConfigured()}
          text={
            hubspotConfigured()
              ? "Cada reserva crea o actualiza el contacto y registra la reunión asignada a tu usuario de HubSpot (por email)."
              : "Crea una private app en HubSpot y guarda su token en HUBSPOT_ACCESS_TOKEN (ver README)."
          }
        />
      </section>
    </div>
  );
}

function Row({ title, ok, text, action }: { title: string; ok: boolean; text: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 rounded-xl border border-line p-4">
      <span className={`mt-1.5 size-2 shrink-0 rounded-full ${ok ? "bg-emerald-400" : "bg-amber-400"}`} />
      <div className="flex-1">
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-0.5 text-sm text-muted">{text}</p>
      </div>
      {action}
    </div>
  );
}
