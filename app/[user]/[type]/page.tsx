import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPublicType } from "@/lib/booking";
import { BookingWidgetLoader } from "@/components/booking/BookingWidgetLoader";

export async function generateMetadata(props: PageProps<"/[user]/[type]">): Promise<Metadata> {
  const { user, type } = await props.params;
  const found = await getPublicType(user, type);
  return found ? { title: `${found.type.title} con ${found.user.name}` } : {};
}

export default async function PublicBookingPage(props: PageProps<"/[user]/[type]">) {
  const { user: userSlug, type: typeSlug } = await props.params;
  const found = await getPublicType(userSlug, typeSlug);
  if (!found) notFound();
  const { user, type } = found;
  const c = type.config;

  return (
    <main className="flex flex-1 flex-col items-center px-4 py-8 sm:py-14">
      <BookingWidgetLoader
        meeting={{
          id: type.id,
          title: type.title,
          description: type.description,
          host: { name: user.name, image: user.image },
          durations: c.durations,
          defaultDuration: c.defaultDuration,
          maxDaysAhead: c.maxDaysAhead,
          location: c.location.type,
          guests: c.guests,
          questions: c.questions,
          accent: c.accent,
          hostTimezone: c.timezone,
        }}
      />
      <p className="mt-8 font-mono text-[11px] uppercase tracking-[0.14em] text-dim">Exponenciales · Agenda</p>
    </main>
  );
}
