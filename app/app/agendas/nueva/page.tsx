import { requireUser } from "@/lib/session";
import { defaultConfig } from "@/lib/meeting-config";
import { appUrl } from "@/lib/google";
import { MeetingTypeEditor } from "@/components/admin/MeetingTypeEditor";

export const metadata = { title: "Nueva agenda" };

export default async function NewMeetingType() {
  const user = await requireUser();
  return (
    <>
      <p className="eyebrow">Nueva agenda</p>
      <h1 className="mb-6 mt-1 text-3xl font-bold tracking-tight">Configura tu enlace de reunión</h1>
      <MeetingTypeEditor
        id={null}
        userSlug={user.slug}
        baseUrl={appUrl()}
        initial={{ title: "", slug: "", description: "", active: true, config: defaultConfig(user.timezone) }}
      />
    </>
  );
}
