import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { meetingTypes, users } from "@/lib/schema";
import { parseType } from "@/lib/booking";
import { LOCATION_LABEL } from "@/lib/meeting-config";
import { Logo } from "@/components/Logo";

export default async function PublicProfile(props: PageProps<"/[user]">) {
  const { user: slug } = await props.params;
  const db = await getDb();
  const user = await db.query.users.findFirst({ where: eq(users.slug, slug) });
  if (!user) notFound();
  const types = (
    await db
      .select()
      .from(meetingTypes)
      .where(and(eq(meetingTypes.userId, user.id), eq(meetingTypes.active, true)))
      .orderBy(asc(meetingTypes.createdAt))
  ).map(parseType);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-14">
      <Logo />
      <div className="mt-10 flex items-center gap-4">
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.image} alt="" className="size-14 rounded-full object-cover" />
        ) : (
          <span className="grid size-14 place-items-center rounded-full bg-surface-2 text-xl font-semibold">{user.name[0]}</span>
        )}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{user.name}</h1>
          <p className="text-sm text-muted">Elige el tipo de reunión</p>
        </div>
      </div>
      <div className="mt-8 space-y-3">
        {types.length === 0 && <p className="text-sm text-dim">No hay agendas disponibles ahora mismo.</p>}
        {types.map((t) => (
          <Link
            key={t.id}
            href={`/${user.slug}/${t.slug}`}
            className="card group flex items-center gap-4 p-5 transition hover:border-[color:var(--a)]"
            style={{ "--a": t.config.accent } as React.CSSProperties}
          >
            <span className="h-10 w-1 rounded-full" style={{ background: t.config.accent }} />
            <div className="flex-1">
              <p className="font-semibold">{t.title}</p>
              <p className="text-sm text-muted">
                {t.config.durations.join(" / ")} min · {LOCATION_LABEL[t.config.location.type]}
              </p>
            </div>
            <span className="text-dim transition group-hover:translate-x-0.5 group-hover:text-ink">→</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
