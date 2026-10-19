"use client";

import { useActionState, useMemo } from "react";
import { saveSettings } from "@/app/app/actions";

type Initial = { name: string; slug: string; timezone: string; calendarId: string; image: string };

export function SettingsForm({ initial, baseUrl }: { initial: Initial; baseUrl: string }) {
  const [state, action, pending] = useActionState(saveSettings, null);
  const timezones = useMemo(() => Intl.supportedValuesOf("timeZone"), []);
  return (
    <form action={action} className="card space-y-4 p-6">
      <h2 className="font-semibold">Perfil público</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="label">Nombre que verán tus clientes</span>
          <input name="name" defaultValue={initial.name} className="field" required />
        </label>
        <label className="block">
          <span className="label">Tu URL</span>
          <div className="flex items-center rounded-lg border border-line bg-bg focus-within:border-accent">
            <span className="pl-3 font-mono text-xs text-dim">{baseUrl.replace(/^https?:\/\//, "")}/</span>
            <input name="slug" defaultValue={initial.slug} className="w-full bg-transparent px-1 py-2.5 font-mono text-sm outline-none" required />
          </div>
        </label>
        <label className="block">
          <span className="label">Tu zona horaria (para el panel)</span>
          <select name="timezone" defaultValue={initial.timezone} className="field">
            {timezones.map((tz) => (
              <option key={tz}>{tz}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label">Calendario de Google</span>
          <input name="calendarId" defaultValue={initial.calendarId} className="field font-mono" />
          <span className="mt-1 block text-xs text-dim">«primary» = los eventos se crean en tu calendario principal y bloquea cualquier evento de todos tus calendarios.</span>
        </label>
        <label className="block sm:col-span-2">
          <span className="label">Foto (URL de la imagen)</span>
          <div className="flex items-center gap-3">
            {initial.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={initial.image} alt="" className="size-10 shrink-0 rounded-full object-cover" />
            ) : null}
            <input name="image" type="url" defaultValue={initial.image} placeholder="https://…/foto.jpg" className="field" />
          </div>
          <span className="mt-1 block text-xs text-dim">La que verán tus clientes en las páginas de reserva. Vacío = foto de Google.</span>
        </label>
      </div>
      <div className="flex items-center justify-end gap-4">
        {state && <span className={`text-sm ${state.ok ? "text-emerald-400" : "text-accent"}`}>{state.ok ? "Guardado" : state.error}</span>}
        <button className="btn-primary" disabled={pending}>
          {pending ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </form>
  );
}
