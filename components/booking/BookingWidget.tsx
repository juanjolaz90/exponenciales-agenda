"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { DateTime, Info } from "luxon";

type Question = { id: string; label: string; type: "text" | "textarea" | "phone"; required: boolean };
export type PublicMeeting = {
  id: string;
  title: string;
  description: string;
  host: { name: string; image: string | null };
  durations: number[];
  defaultDuration: number;
  maxDaysAhead: number;
  location: "meet" | "phone" | "inperson" | "link";
  guests: { enabled: boolean; max: number };
  questions: Question[];
  accent: string;
  hostTimezone: string;
};

const LOCATION: Record<PublicMeeting["location"], string> = {
  meet: "Google Meet",
  link: "Videollamada",
  phone: "Llamada telefónica",
  inperson: "Presencial",
};

const ucfirst = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

const fmtDuration = (m: number) => (m < 60 ? `${m} minutos` : m % 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : m === 60 ? "1 hora" : `${m / 60} horas`);

export function BookingWidget({ meeting }: { meeting: PublicMeeting }) {
  const router = useRouter();
  // Se renderiza solo en cliente (ver BookingWidgetLoader), así que la zona del navegador está disponible.
  const [tz, setTz] = useState(() => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
  const [duration, setDuration] = useState(meeting.defaultDuration);
  const [month, setMonth] = useState<DateTime>(() => DateTime.now().setZone(tz).startOf("month"));
  const [date, setDate] = useState<string | null>(null);
  const [slot, setSlot] = useState<number | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [reload, setReload] = useState(0);
  const timezones = useMemo(() => Intl.supportedValuesOf("timeZone"), []);

  // Resultado etiquetado con su petición: si no coincide con la actual, está cargando.
  const monthKey = month.toFormat("yyyy-MM");
  const reqKey = `${duration}|${tz}|${monthKey}|${reload}`;
  const [result, setResult] = useState<{ key: string; days?: Record<string, number[]>; error?: string } | null>(null);
  const loading = result?.key !== reqKey;
  const days = !loading ? (result?.days ?? null) : null;
  const error = !loading ? (result?.error ?? null) : null;

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/slots?type=${meeting.id}&duration=${duration}&tz=${encodeURIComponent(tz)}&month=${monthKey}`, {
      signal: ctrl.signal,
    })
      .then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body.error ?? "No se pudo cargar la disponibilidad.");
        return body;
      })
      .then((d: { days: Record<string, number[]> }) => {
        setResult({ key: reqKey, days: d.days });
        setDate((cur) => (cur && d.days[cur] ? cur : (Object.keys(d.days).sort()[0] ?? null)));
      })
      .catch((e) => {
        if (e?.name !== "AbortError") setResult({ key: reqKey, error: e?.message || "No se pudo cargar la disponibilidad." });
      });
    return () => ctrl.abort();
  }, [meeting.id, duration, tz, monthKey, reqKey]);

  const now = DateTime.now().setZone(tz);
  const canPrev = month ? month > now.startOf("month") : false;
  const canNext = month ? month.plus({ months: 1 }) <= now.plus({ days: meeting.maxDaysAhead }).startOf("month") : false;

  const selectSlot = (s: number) => {
    setSlot(s);
    setStep(2);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const style = { "--accent": meeting.accent } as React.CSSProperties;

  return (
    <div className="w-full max-w-4xl" style={style}>
      <Steps step={step} />
      <div className="card mt-6 grid overflow-hidden md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* Columna izquierda: anfitrión + calendario */}
        <div className="border-b border-line p-6 sm:p-8 md:border-r md:border-b-0">
          <div className="flex items-center gap-3">
            {meeting.host.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={meeting.host.image} alt="" className="size-11 rounded-full object-cover" />
            ) : (
              <span className="grid size-11 place-items-center rounded-full bg-surface-2 font-semibold">{meeting.host.name[0]}</span>
            )}
            <div>
              <p className="text-sm text-muted">{meeting.host.name}</p>
              <h1 className="text-xl font-bold leading-tight tracking-tight">{meeting.title}</h1>
            </div>
          </div>
          {meeting.description && <p className="mt-4 whitespace-pre-line text-sm text-muted">{meeting.description}</p>}

          {step === 1 && month && (
            <Calendar
              month={month}
              days={days}
              selected={date}
              loading={loading}
              canPrev={canPrev}
              canNext={canNext}
              onMonth={(m) => {
                setMonth(m);
                setDate(null);
              }}
              onSelect={setDate}
            />
          )}
          {step === 2 && slot && (
            <div className="mt-8 rounded-xl border border-line bg-bg p-4">
              <p className="eyebrow">Tu reunión</p>
              <p className="mt-2 font-semibold">
                {ucfirst(DateTime.fromMillis(slot, { zone: tz }).setLocale("es").toFormat("cccc d 'de' LLLL"))}
              </p>
              <p className="font-mono text-sm text-muted">
                {DateTime.fromMillis(slot, { zone: tz }).toFormat("HH:mm")}–
                {DateTime.fromMillis(slot + duration * 60_000, { zone: tz }).toFormat("HH:mm")} · {tz.replace(/_/g, " ")}
              </p>
              <button type="button" className="mt-3 text-xs underline" style={{ color: meeting.accent }} onClick={() => setStep(1)}>
                Cambiar fecha u hora
              </button>
            </div>
          )}
        </div>

        {/* Columna derecha */}
        <div className="p-6 sm:p-8">
          {step === 1 ? (
            <>
              <h2 className="text-sm font-semibold">Ubicación de la reunión</h2>
              <p className="mt-1.5 text-sm text-muted">◎ {LOCATION[meeting.location]}</p>

              <h2 className="mt-6 text-sm font-semibold">Duración de la reunión</h2>
              <div
                className={`mt-3 grid gap-2 ${meeting.durations.length > 1 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-1"}`}
                role="radiogroup"
              >
                {meeting.durations.map((d) => (
                  <button
                    key={d}
                    role="radio"
                    aria-checked={d === duration}
                    type="button"
                    onClick={() => setDuration(d)}
                    className="rounded-lg border px-2 py-2 text-sm transition"
                    style={
                      d === duration
                        ? { borderColor: meeting.accent, background: `${meeting.accent}1f`, color: "#F2F0EB" }
                        : { borderColor: "#2a2633", color: "#A9A5B3" }
                    }
                  >
                    {d < 60 ? `${d} min` : fmtDuration(d)}
                  </button>
                ))}
              </div>

              <h2 className="mt-7 text-sm font-semibold">¿A qué hora te va bien?</h2>
              <p className="mt-1 text-sm text-muted">
                {date ? ucfirst(DateTime.fromISO(date).setLocale("es").toFormat("cccc d 'de' LLLL")) : "Elige un día"}
              </p>
              <label className="mt-3 block">
                <span className="sr-only">Zona horaria</span>
                <select className="field py-2 text-xs" value={tz} onChange={(e) => setTz(e.target.value)}>
                  {timezones.map((z) => (
                    <option key={z} value={z}>
                      {z.replace(/_/g, " ")} ({DateTime.now().setZone(z).toFormat("ZZ")})
                    </option>
                  ))}
                </select>
              </label>

              <div className="mt-4 max-h-[440px] overflow-y-auto pr-1 [scrollbar-width:thin]">
                {error && <p className="text-sm text-accent">{error}</p>}
                {loading && !error && (
                  <div className="grid gap-2">
                    {Array.from({ length: 8 }).map((_, i) => (
                      <div key={i} className="h-12 animate-pulse rounded-lg bg-surface-2" />
                    ))}
                  </div>
                )}
                {!loading && !error && days && (
                  <>
                    {date && days[date] ? (
                      <div className="grid gap-2">
                        {days[date].map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => selectSlot(s)}
                            className="h-12 w-full rounded-lg border border-line font-mono text-sm transition hover:border-[color:var(--accent)] hover:text-[color:var(--accent)]"
                          >
                            {DateTime.fromMillis(s, { zone: tz }).toFormat("HH:mm")}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="rounded-lg border border-dashed border-line p-4 text-sm text-dim">
                        {Object.keys(days).length ? "Elige un día con disponibilidad." : "No hay huecos libres este mes."}
                        {!Object.keys(days).length && canNext && (
                          <button type="button" className="ml-1 underline" onClick={() => month && setMonth(month.plus({ months: 1 }))}>
                            Ver el mes siguiente
                          </button>
                        )}
                      </p>
                    )}
                  </>
                )}
                {/* Degradado que indica que hay más horas al hacer scroll */}
                <div className="pointer-events-none sticky bottom-0 h-6 bg-gradient-to-t from-surface to-transparent" />
              </div>
            </>
          ) : (
            slot && (
              <BookingForm
                meeting={meeting}
                slot={slot}
                duration={duration}
                tz={tz}
                onBack={() => setStep(1)}
                onTaken={() => {
                  setStep(1);
                  setSlot(null);
                  setReload((r) => r + 1);
                }}
                onDone={(id, token) => router.push(`/b/${id}?t=${token}`)}
              />
            )
          )}
        </div>
      </div>
    </div>
  );
}

function Steps({ step }: { step: 1 | 2 }) {
  const items = ["Elige una hora", "Tus datos"];
  return (
    <ol className="mx-auto flex max-w-sm items-center justify-center gap-3 text-xs">
      {items.map((label, i) => {
        const n = i + 1;
        const done = step > n;
        const active = step === n;
        return (
          <li key={label} className="flex items-center gap-3">
            {i > 0 && <span className="h-px w-10 bg-line" />}
            <span
              className="grid size-6 place-items-center rounded-full border font-mono"
              style={
                active || done
                  ? { borderColor: "var(--accent)", color: done ? "#0B0A10" : "var(--accent)", background: done ? "var(--accent)" : "transparent" }
                  : { borderColor: "#2a2633", color: "#77737F" }
              }
            >
              {done ? "✓" : n}
            </span>
            <span className={active ? "text-ink" : "text-dim"}>{label}</span>
          </li>
        );
      })}
    </ol>
  );
}

function Calendar(props: {
  month: DateTime;
  days: Record<string, number[]> | null;
  selected: string | null;
  loading: boolean;
  canPrev: boolean;
  canNext: boolean;
  onMonth: (m: DateTime) => void;
  onSelect: (d: string) => void;
}) {
  const { month, days, selected } = props;
  const lead = month.startOf("month").weekday - 1; // lunes = 0
  const total = month.daysInMonth ?? 30;
  const cells: (DateTime | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: total }, (_, i) => month.set({ day: i + 1 })),
  ];
  const weekdays = Info.weekdays("short", { locale: "es" });

  return (
    <div className="mt-8">
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label="Mes anterior"
          disabled={!props.canPrev}
          onClick={() => props.onMonth(month.minus({ months: 1 }))}
          className="grid size-8 place-items-center rounded-full text-muted hover:bg-surface-2 disabled:opacity-25"
        >
          ‹
        </button>
        <p className="font-semibold capitalize">{month.setLocale("es").toFormat("LLLL yyyy")}</p>
        <button
          type="button"
          aria-label="Mes siguiente"
          disabled={!props.canNext}
          onClick={() => props.onMonth(month.plus({ months: 1 }))}
          className="grid size-8 place-items-center rounded-full text-muted hover:bg-surface-2 disabled:opacity-25"
        >
          ›
        </button>
      </div>
      <div className="mt-4 grid grid-cols-7 gap-1 text-center">
        {weekdays.map((w) => (
          <span key={w} className="py-1 font-mono text-[10px] uppercase tracking-wider text-dim">
            {w.replace(".", "")}
          </span>
        ))}
        {cells.map((d, i) => {
          if (!d) return <span key={`e${i}`} />;
          const key = d.toISODate()!;
          const available = Boolean(days?.[key]?.length);
          const isSel = key === selected;
          return (
            <button
              key={key}
              type="button"
              disabled={!available}
              aria-pressed={isSel}
              aria-label={d.setLocale("es").toFormat("d 'de' LLLL")}
              onClick={() => props.onSelect(key)}
              className={`mx-auto grid aspect-square w-full max-w-10 place-items-center rounded-full text-sm transition ${
                props.loading ? "animate-pulse" : ""
              } ${available ? "font-semibold text-ink hover:bg-surface-2" : "text-dim/50"}`}
              style={isSel ? { background: "var(--accent)", color: "#0B0A10" } : available ? { boxShadow: "inset 0 0 0 1px #2a2633" } : undefined}
            >
              {d.day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function BookingForm(props: {
  meeting: PublicMeeting;
  slot: number;
  duration: number;
  tz: string;
  onBack: () => void;
  onTaken: () => void;
  onDone: (id: string, token: string) => void;
}) {
  const { meeting } = props;
  const [guests, setGuests] = useState<string[]>([]);
  const [guestInput, setGuestInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const emailOk = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

  const addGuest = () => {
    const g = guestInput.trim().toLowerCase();
    if (!emailOk(g) || guests.includes(g) || guests.length >= meeting.guests.max) return;
    setGuests([...guests, g]);
    setGuestInput("");
  };

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setSending(true);
    setError(null);
    const res = await fetch("/api/book", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        typeId: meeting.id,
        start: props.slot,
        duration: props.duration,
        timezone: props.tz,
        firstName: f.get("firstName"),
        lastName: f.get("lastName"),
        email: f.get("email"),
        guests,
        answers: Object.fromEntries(meeting.questions.map((q) => [q.id, String(f.get(`q_${q.id}`) ?? "")])),
        website: String(f.get("website") ?? ""),
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return props.onDone(data.id, data.token);
    setSending(false);
    setError(data.error ?? "No se pudo completar la reserva.");
    if (res.status === 409 && /disponible/.test(data.error ?? "")) setTimeout(props.onTaken, 1800);
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <h2 className="text-lg font-semibold">Tus datos</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="label">Nombre *</span>
          <input name="firstName" required autoComplete="given-name" className="field" />
        </label>
        <label className="block">
          <span className="label">Apellidos *</span>
          <input name="lastName" required autoComplete="family-name" className="field" />
        </label>
      </div>
      <label className="block">
        <span className="label">Email *</span>
        <input name="email" type="email" required autoComplete="email" className="field" />
      </label>

      {meeting.questions.map((q) => (
        <label key={q.id} className="block">
          <span className="label">
            {q.label}
            {q.required && " *"}
          </span>
          {q.type === "textarea" ? (
            <textarea name={`q_${q.id}`} required={q.required} className="field min-h-20" />
          ) : (
            <input name={`q_${q.id}`} type={q.type === "phone" ? "tel" : "text"} required={q.required} className="field" />
          )}
        </label>
      ))}

      {meeting.guests.enabled && (
        <div>
          <span className="label">Invitados (hasta {meeting.guests.max})</span>
          <div className="flex gap-2">
            <input
              type="email"
              value={guestInput}
              onChange={(e) => setGuestInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addGuest();
                }
              }}
              placeholder="email@empresa.com"
              className="field"
            />
            <button
              type="button"
              className="btn-ghost"
              disabled={!emailOk(guestInput.trim()) || guests.length >= meeting.guests.max}
              onClick={addGuest}
            >
              Añadir
            </button>
          </div>
          {guests.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {guests.map((g) => (
                <span key={g} className="inline-flex items-center gap-1.5 rounded-full bg-surface-2 px-2.5 py-1 text-xs">
                  {g}
                  <button type="button" aria-label={`Quitar ${g}`} className="text-dim hover:text-accent" onClick={() => setGuests(guests.filter((x) => x !== g))}>
                    ✕
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Campo trampa para bots */}
      <input name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden />

      {error && <p className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm">{error}</p>}

      <div className="flex gap-2 pt-2">
        <button type="button" className="btn-ghost" onClick={props.onBack}>
          Atrás
        </button>
        <button
          className="btn flex-1 text-on-accent"
          style={{ background: meeting.accent }}
          disabled={sending}
        >
          {sending ? "Confirmando…" : "Confirmar reunión"}
        </button>
      </div>
    </form>
  );
}
