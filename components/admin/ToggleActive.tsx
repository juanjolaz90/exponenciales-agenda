"use client";

import { useTransition } from "react";
import { toggleMeetingType } from "@/app/app/actions";

export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition ${
        checked ? "bg-accent" : "bg-line"
      } disabled:opacity-50`}
    >
      <span className={`size-4 rounded-full bg-ink shadow transition ${checked ? "translate-x-4.5" : "translate-x-0.5"}`} />
    </button>
  );
}

export function ToggleActive({ id, active }: { id: string; active: boolean }) {
  const [pending, start] = useTransition();
  return (
    <Switch
      checked={active}
      label={active ? "Desactivar agenda" : "Activar agenda"}
      disabled={pending}
      onChange={(v) => start(() => toggleMeetingType(id, v))}
    />
  );
}
