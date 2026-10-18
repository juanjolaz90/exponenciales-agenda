import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { currentUser } from "@/lib/session";
import { googleConfigured } from "@/lib/google";

export const metadata = { title: "Entrar" };

const ERRORS: Record<string, string> = {
  forbidden: "Este email no tiene acceso. Añádelo a ALLOWED_EMAILS.",
  google: "No se pudo conectar con Google. Inténtalo de nuevo.",
  state: "La sesión de inicio caducó. Inténtalo de nuevo.",
  unverified: "Tu email de Google no está verificado.",
};

export default async function Login(props: PageProps<"/login">) {
  if (await currentUser()) redirect("/app");
  const { error } = await props.searchParams;
  const google = googleConfigured();
  const devLogin = !google && process.env.NODE_ENV !== "production";

  return (
    <main className="grid flex-1 place-items-center px-4 py-16">
      <div className="w-full max-w-sm">
        <Logo />
        <h1 className="mt-10 text-3xl font-bold tracking-tight">Tu agenda de ventas</h1>
        <p className="mt-2 text-sm text-muted">
          Crea enlaces de reserva, sincroniza con Google Calendar y registra cada reunión en HubSpot.
        </p>

        {typeof error === "string" && ERRORS[error] && (
          <p className="mt-6 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-ink">{ERRORS[error]}</p>
        )}

        <div className="mt-8 space-y-3">
          {google ? (
            // eslint-disable-next-line @next/next/no-html-link-for-pages -- ruta de API, navegación completa
            <a href="/api/auth/google" className="btn-primary w-full">
              Entrar con Google
            </a>
          ) : (
            <p className="rounded-lg border border-line bg-surface px-3 py-2 text-xs text-muted">
              Google no está configurado (faltan GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET).
            </p>
          )}
          {devLogin && (
            <form action="/api/auth/dev" method="post">
              <button className="btn-ghost w-full">Entrar en modo demo (solo local)</button>
            </form>
          )}
        </div>
        <p className="mt-6 text-xs text-dim">
          Al entrar con Google se pide acceso a tus eventos y a tu disponibilidad para crear las reuniones.
        </p>
      </div>
    </main>
  );
}
