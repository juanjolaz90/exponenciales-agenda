"use client";

import dynamic from "next/dynamic";
import type { PublicMeeting } from "./BookingWidget";

// Depende de la zona horaria del navegador: se renderiza solo en cliente.
const BookingWidget = dynamic(() => import("./BookingWidget").then((m) => m.BookingWidget), {
  ssr: false,
  loading: () => <div className="card h-[560px] w-full max-w-4xl animate-pulse" />,
});

export function BookingWidgetLoader({ meeting }: { meeting: PublicMeeting }) {
  return <BookingWidget meeting={meeting} />;
}
