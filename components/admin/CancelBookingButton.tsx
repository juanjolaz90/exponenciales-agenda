"use client";

import { useTransition } from "react";
import { cancelBookingAsHost } from "@/app/app/actions";

export function CancelBookingButton({ id }: { id: string }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      className="text-xs text-dim hover:text-accent disabled:opacity-50"
      onClick={() => {
        if (confirm("¿Cancelar esta reunión? Se avisará a los asistentes desde Google Calendar.")) {
          start(() => cancelBookingAsHost(id));
        }
      }}
    >
      {pending ? "Cancelando…" : "Cancelar"}
    </button>
  );
}
