import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db";
import { meetingTypes } from "@/lib/schema";
import { requireUser } from "@/lib/session";
import { parseType } from "@/lib/booking";
import { appUrl } from "@/lib/google";
import { MeetingTypeEditor } from "@/components/admin/MeetingTypeEditor";

export const metadata = { title: "Editar agenda" };

export default async function EditMeetingType(props: PageProps<"/app/agendas/[id]">) {
  const { id } = await props.params;
  const user = await requireUser();
  const db = await getDb();
  const row = await db.query.meetingTypes.findFirst({ where: and(eq(meetingTypes.id, id), eq(meetingTypes.userId, user.id)) });
  if (!row) notFound();
  const t = parseType(row);
  return (
    <>
      <p className="eyebrow">Editar agenda</p>
      <h1 className="mb-6 mt-1 text-3xl font-bold tracking-tight">{t.title}</h1>
      <MeetingTypeEditor
        key={t.updatedAt}
        id={t.id}
        userSlug={user.slug}
        baseUrl={appUrl()}
        initial={{ title: t.title, slug: t.slug, description: t.description, active: t.active, config: t.config }}
      />
    </>
  );
}
