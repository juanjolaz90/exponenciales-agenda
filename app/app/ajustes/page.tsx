import { requireUser } from "@/lib/session";
import { appUrl, googleConfigured } from "@/lib/google";
import { hubspotConfigured } from "@/lib/hubspot";
import { SettingsForm } from "@/components/admin/SettingsForm";

export const metadata = { title: "Ajustes" };

export default async function SettingsPage() {
  const user = await requireUser();
  const googleOk = googleConfigured() && Boolean(user.googleRefreshToken);
  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <p className="eyebrow">Ajustes</p>
        <h1 className="mt-1 text-3xl font-bold tracking-tight">Perfil e integraciones</h1>
      </div>

      <SettingsForm
        baseUrl={appUrl()}
        initial={{ name: user.name, slug: user.slug, timezone: user.timezone, calendarId: user.calendarId }}
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
