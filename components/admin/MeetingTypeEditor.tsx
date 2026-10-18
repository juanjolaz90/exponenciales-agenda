"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveMeetingType, deleteMeetingType } from "@/app/app/actions";
import type { MeetingConfig, MeetingTypeInput } from "@/lib/meeting-config";
import { Switch } from "./ToggleActive";

const DAYS = [
  ["1", "Lunes"],
  ["2", "Martes"],
  ["3", "Miércoles"],
  ["4", "Jueves"],
  ["5", "Viernes"],
  ["6", "Sábado"],
  ["7", "Domingo"],
] as const;
const DURATION_PRESETS = [15, 20, 30, 45, 60, 90, 120];
const ACCENTS = ["#F43A59", "#7C5CFF", "#2BB673", "#F59E0B", "#0EA5E9", "#F2F0EB"];

type Props = { id: string | null; initial: MeetingTypeInput; userSlug: string; baseUrl: string };

export function MeetingTypeEditor({ id, initial, userSlug, baseUrl }: Props) {
  const router = useRouter();
  const [data, setData] = useState(initial);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const c = data.config;
  const timezones = useMemo(() => Intl.supportedValuesOf("timeZone"), []);

  const set = (patch: Partial<MeetingTypeInput>) => setData((d) => ({ ...d, ...patch }));
  const setC = (patch: Partial<MeetingConfig>) => setData((d) => ({ ...d, config: { ...d.config, ...patch } }));

  const toggleDuration = (m: number) => {
    const has = c.durations.includes(m);
    if (has && c.durations.length === 1) return;
    const durations = has ? c.durations.filter((x) => x !== m) : [...c.durations, m].sort((a, b) => a - b);
    setC({ durations, defaultDuration: durations.includes(c.defaultDuration) ? c.defaultDuration : durations[0] });
  };

  const setDay = (day: keyof MeetingConfig["weekly"], windows: MeetingConfig["weekly"][typeof day]) =>
    setC({ weekly: { ...c.weekly, [day]: windows } });

  const save = () =>
    start(async () => {
      setMsg(null);
      const res = await saveMeetingType(id, data);
      if (!res.ok) return setMsg({ ok: false, text: res.error });
      setMsg({ ok: true, text: "Guardado" });
      if (!id && res.id) router.replace(`/app/agendas/${res.id}`);
      else router.refresh();
    });

  return (
    <div className="pb-28">
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Section title="General" desc="Lo que verá tu cliente al abrir el enlace.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Título">
                <input
                  className="field"
                  value={data.title}
                  onChange={(e) => {
                    const title = e.target.value;
                    const autoSlug = !id && (data.slug === "" || data.slug === slugify(data.title));
                    set({ title, ...(autoSlug ? { slug: slugify(title) } : {}) });
                  }}
                  placeholder="Reunión de descubrimiento"
                />
              </Field>
              <Field label="URL">
                <div className="flex items-center rounded-lg border border-line bg-bg focus-within:border-accent">
                  <span className="pl-3 font-mono text-xs text-dim">/{userSlug}/</span>
                  <input
                    className="w-full bg-transparent px-1 py-2.5 font-mono text-sm outline-none"
                    value={data.slug}
                    onChange={(e) => set({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") })}
                  />
                </div>
              </Field>
            </div>
            <Field label="Descripción (opcional)">
              <textarea
                className="field min-h-20"
                value={data.description}
                onChange={(e) => set({ description: e.target.value })}
                placeholder="En 30 minutos revisamos tu CRM y te proponemos próximos pasos."
              />
            </Field>
            <label className="flex items-center gap-3 text-sm">
              <Switch checked={data.active} onChange={(v) => set({ active: v })} label="Agenda activa" />
              Agenda activa (acepta reservas)
            </label>
          </Section>

          <Section title="Duración" desc="Puedes ofrecer varias. La marcada con ★ es la que aparece seleccionada.">
            <div className="flex flex-wrap gap-2">
              {DURATION_PRESETS.map((m) => {
                const on = c.durations.includes(m);
                return (
                  <button
                    key={m}
                    type="button"
                    onClick={() => toggleDuration(m)}
                    className={`rounded-lg border px-3 py-2 text-sm transition ${
                      on ? "border-accent bg-accent/10 text-ink" : "border-line text-muted hover:text-ink"
                    }`}
                  >
                    {m < 60 ? `${m} min` : `${m / 60} h`}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              {c.durations.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setC({ defaultDuration: m })}
                  className={`rounded-full px-3 py-1 ${c.defaultDuration === m ? "bg-ink text-bg" : "bg-surface-2 text-muted"}`}
                >
                  {c.defaultDuration === m ? "★ " : ""}
                  {m} min
                </button>
              ))}
            </div>
          </Section>

          <Section title="Horario" desc="Tramos en los que aceptas reuniones, en tu zona horaria.">
            <Field label="Zona horaria del organizador">
              <select className="field" value={c.timezone} onChange={(e) => setC({ timezone: e.target.value })}>
                {timezones.map((tz) => (
                  <option key={tz}>{tz}</option>
                ))}
              </select>
            </Field>
            <div className="divide-y divide-line rounded-xl border border-line">
              {DAYS.map(([key, name]) => {
                const windows = c.weekly[key] ?? [];
                const on = windows.length > 0;
                return (
                  <div key={key} className="flex flex-wrap items-start gap-3 px-4 py-3">
                    <label className="flex w-32 items-center gap-3 pt-1.5 text-sm">
                      <Switch
                        checked={on}
                        label={name}
                        onChange={(v) => setDay(key, v ? [{ start: "09:00", end: "17:00" }] : [])}
                      />
                      {name}
                    </label>
                    <div className="flex flex-1 flex-col gap-2">
                      {!on && <span className="pt-1.5 text-sm text-dim">No disponible</span>}
                      {windows.map((w, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <input
                            type="time"
                            className="field w-32 py-1.5"
                            value={w.start}
                            onChange={(e) => setDay(key, windows.map((x, j) => (j === i ? { ...x, start: e.target.value } : x)))}
                          />
                          <span className="text-dim">–</span>
                          <input
                            type="time"
                            className="field w-32 py-1.5"
                            value={w.end}
                            onChange={(e) => setDay(key, windows.map((x, j) => (j === i ? { ...x, end: e.target.value } : x)))}
                          />
                          <button
                            type="button"
                            aria-label="Quitar tramo"
                            className="px-2 text-dim hover:text-accent"
                            onClick={() => setDay(key, windows.filter((_, j) => j !== i))}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                    {on && (
                      <button
                        type="button"
                        className="pt-1.5 text-xs text-muted hover:text-ink"
                        onClick={() => setDay(key, [...windows, { start: "16:00", end: "18:00" }])}
                      >
                        + tramo
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </Section>

          <Section title="Reglas de reserva" desc="Controla cuándo y con qué margen te pueden reservar.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Horas de inicio cada">
                <select className="field" value={c.increment} onChange={(e) => setC({ increment: +e.target.value })}>
                  {[5, 10, 15, 20, 30, 60].map((n) => (
                    <option key={n} value={n}>
                      {n} minutos
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Antelación mínima">
                <select className="field" value={c.minNoticeMinutes} onChange={(e) => setC({ minNoticeMinutes: +e.target.value })}>
                  {[
                    [0, "Sin mínimo"],
                    [30, "30 minutos"],
                    [60, "1 hora"],
                    [120, "2 horas"],
                    [240, "4 horas"],
                    [720, "12 horas"],
                    [1440, "1 día"],
                    [2880, "2 días"],
                  ].map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Ventana de reserva (días hacia delante)">
                <input
                  type="number"
                  min={1}
                  max={365}
                  className="field"
                  value={c.maxDaysAhead}
                  onChange={(e) => setC({ maxDaysAhead: clamp(+e.target.value, 1, 365) })}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Margen antes (min)">
                  <input
                    type="number"
                    min={0}
                    max={240}
                    step={5}
                    className="field"
                    value={c.bufferBefore}
                    onChange={(e) => setC({ bufferBefore: clamp(+e.target.value, 0, 240) })}
                  />
                </Field>
                <Field label="Margen después (min)">
                  <input
                    type="number"
                    min={0}
                    max={240}
                    step={5}
                    className="field"
                    value={c.bufferAfter}
                    onChange={(e) => setC({ bufferAfter: clamp(+e.target.value, 0, 240) })}
                  />
                </Field>
              </div>
            </div>
          </Section>

          <Section title="Ubicación">
            <div className="grid gap-2 sm:grid-cols-4">
              {(
                [
                  ["meet", "Google Meet", "Enlace automático"],
                  ["link", "Otro enlace", "Zoom, Teams…"],
                  ["phone", "Teléfono", "Tú llamas o te llaman"],
                  ["inperson", "Presencial", "Dirección"],
                ] as const
              ).map(([type, label, hint]) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setC({ location: { type, value: type === c.location.type ? c.location.value : "" } })}
                  className={`rounded-xl border p-3 text-left transition ${
                    c.location.type === type ? "border-accent bg-accent/10" : "border-line hover:bg-surface-2"
                  }`}
                >
                  <span className="block text-sm font-medium">{label}</span>
                  <span className="text-xs text-dim">{hint}</span>
                </button>
              ))}
            </div>
            {c.location.type !== "meet" && (
              <Field
                label={
                  c.location.type === "link" ? "URL de la videollamada" : c.location.type === "phone" ? "Teléfono o instrucciones" : "Dirección"
                }
              >
                <input className="field" value={c.location.value} onChange={(e) => setC({ location: { ...c.location, value: e.target.value } })} />
              </Field>
            )}
          </Section>

          <Section title="Formulario" desc="Siempre se piden nombre, apellidos y email. Añade lo que necesites para cualificar.">
            <label className="flex items-center gap-3 text-sm">
              <Switch checked={c.guests.enabled} onChange={(v) => setC({ guests: { ...c.guests, enabled: v } })} label="Permitir invitados" />
              Permitir añadir invitados
              {c.guests.enabled && (
                <span className="flex items-center gap-2 text-muted">
                  · máximo
                  <input
                    type="number"
                    min={1}
                    max={20}
                    className="field w-20 py-1"
                    value={c.guests.max}
                    onChange={(e) => setC({ guests: { ...c.guests, max: clamp(+e.target.value, 1, 20) } })}
                  />
                </span>
              )}
            </label>
            <div className="space-y-2">
              {c.questions.map((q, i) => (
                <div key={q.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-line p-3">
                  <input
                    className="field min-w-48 flex-1"
                    value={q.label}
                    placeholder="Pregunta"
                    onChange={(e) => setC({ questions: c.questions.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)) })}
                  />
                  <select
                    className="field w-40"
                    value={q.type}
                    onChange={(e) =>
                      setC({
                        questions: c.questions.map((x, j) => (j === i ? { ...x, type: e.target.value as typeof q.type } : x)),
                      })
                    }
                  >
                    <option value="text">Texto corto</option>
                    <option value="textarea">Texto largo</option>
                    <option value="phone">Teléfono</option>
                  </select>
                  <label className="flex items-center gap-2 text-xs text-muted">
                    <input
                      type="checkbox"
                      className="accent-[#F43A59]"
                      checked={q.required}
                      onChange={(e) =>
                        setC({ questions: c.questions.map((x, j) => (j === i ? { ...x, required: e.target.checked } : x)) })
                      }
                    />
                    Obligatoria
                  </label>
                  <button
                    type="button"
                    aria-label="Eliminar pregunta"
                    className="px-2 text-dim hover:text-accent"
                    onClick={() => setC({ questions: c.questions.filter((_, j) => j !== i) })}
                  >
                    ✕
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="btn-ghost text-xs"
                disabled={c.questions.length >= 15}
                onClick={() =>
                  setC({
                    questions: [...c.questions, { id: `q${Date.now().toString(36)}`, label: "", type: "text", required: false }],
                  })
                }
              >
                + Añadir pregunta
              </button>
            </div>
          </Section>

          <Section title="Confirmación y CRM">
            <Field label="Mensaje tras reservar">
              <textarea
                className="field min-h-16"
                value={c.confirmationMessage}
                onChange={(e) => setC({ confirmationMessage: e.target.value })}
              />
            </Field>
            <label className="flex items-center gap-3 text-sm">
              <Switch checked={c.syncHubspot} onChange={(v) => setC({ syncHubspot: v })} label="Sincronizar con HubSpot" />
              Crear/actualizar el contacto y registrar la reunión en HubSpot
            </label>
          </Section>
        </div>

        <aside className="space-y-6 lg:sticky lg:top-20 lg:self-start">
          <Section title="Color">
            <div className="flex flex-wrap gap-2">
              {ACCENTS.map((a) => (
                <button
                  key={a}
                  type="button"
                  aria-label={`Color ${a}`}
                  onClick={() => setC({ accent: a })}
                  className={`size-8 rounded-full border-2 ${c.accent.toLowerCase() === a.toLowerCase() ? "border-ink" : "border-transparent"}`}
                  style={{ background: a }}
                />
              ))}
              <input
                type="color"
                aria-label="Color personalizado"
                value={c.accent}
                onChange={(e) => setC({ accent: e.target.value })}
                className="size-8 cursor-pointer rounded-full border border-line bg-transparent"
              />
            </div>
          </Section>
          <div className="card p-5">
            <p className="eyebrow">Vista previa</p>
            <div className="mt-3 rounded-xl border border-line bg-bg p-4">
              <div className="h-1 w-10 rounded-full" style={{ background: c.accent }} />
              <p className="mt-3 font-semibold">{data.title || "Sin título"}</p>
              <p className="mt-1 text-xs text-muted">
                {c.durations.join(" / ")} min · {c.location.type === "meet" ? "Google Meet" : c.location.value || "—"}
              </p>
              <div className="mt-3 grid grid-cols-3 gap-1.5">
                {["9:00", "9:30", "10:00"].map((t, i) => (
                  <span
                    key={t}
                    className="rounded-md border py-1 text-center font-mono text-[11px]"
                    style={i === 0 ? { borderColor: c.accent, color: c.accent } : { borderColor: "#2a2633" }}
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
            {id && (
              <a href={`${baseUrl}/${userSlug}/${initial.slug}`} target="_blank" className="mt-3 block text-xs text-muted hover:text-ink">
                Abrir página pública →
              </a>
            )}
          </div>
          {id && (
            <button
              type="button"
              className="text-xs text-dim hover:text-accent"
              onClick={() => {
                if (!confirm("¿Eliminar esta agenda? Las reservas existentes se conservan.")) return;
                start(async () => {
                  await deleteMeetingType(id);
                  router.replace("/app");
                });
              }}
            >
              Eliminar agenda
            </button>
          )}
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-end gap-4 px-4 py-3">
          {msg && <span className={`text-sm ${msg.ok ? "text-emerald-400" : "text-accent"}`}>{msg.text}</span>}
          <button type="button" className="btn-ghost" onClick={() => router.push("/app")}>
            Volver
          </button>
          <button type="button" className="btn-primary" disabled={pending} onClick={save}>
            {pending ? "Guardando…" : id ? "Guardar cambios" : "Crear agenda"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="card space-y-4 p-5 sm:p-6">
      <div>
        <h2 className="font-semibold">{title}</h2>
        {desc && <p className="mt-0.5 text-sm text-muted">{desc}</p>}
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
    </label>
  );
}

const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, Number.isFinite(n) ? n : min));

function slugify(s: string) {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
