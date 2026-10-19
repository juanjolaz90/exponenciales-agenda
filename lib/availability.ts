import { DateTime } from "luxon";
import type { MeetingConfig } from "./meeting-config";

export type Interval = { start: number; end: number }; // epoch ms UTC

const MIN = 60_000;

/** Minutos libres exigidos entre esta reunión y cualquier otra. */
export const meetingGap = (c: Pick<MeetingConfig, "bufferBefore" | "bufferAfter">) =>
  Math.max(c.bufferBefore, c.bufferAfter);

const overlaps =(a: Interval, b: Interval) => a.start < b.end && b.start < a.end;

/**
 * Calcula las horas de inicio libres (epoch ms) entre `from` y `to`.
 * El horario semanal se interpreta en la zona horaria del organizador.
 */
export function computeSlots(opts: {
  config: MeetingConfig;
  duration: number; // minutos
  from: number;
  to: number;
  now: number;
  busy: Interval[];
}): number[] {
  const { config, duration, from, to, now, busy } = opts;
  const tz = config.timezone;
  const earliest = now + config.minNoticeMinutes * MIN;
  const latest = DateTime.fromMillis(now, { zone: tz })
    .startOf("day")
    .plus({ days: config.maxDaysAhead + 1 })
    .toMillis();

  const out: number[] = [];
  let day = DateTime.fromMillis(Math.max(from, now), { zone: tz }).startOf("day");
  const lastDay = DateTime.fromMillis(Math.min(to, latest), { zone: tz });

  while (day <= lastDay) {
    const windows = config.weekly[String(day.weekday) as keyof MeetingConfig["weekly"]] ?? [];
    for (const w of windows) {
      const [sh, sm] = w.start.split(":").map(Number);
      const [eh, em] = w.end.split(":").map(Number);
      const winStart = day.set({ hour: sh, minute: sm });
      const winEnd = day.set({ hour: eh, minute: em }).toMillis();
      for (let t = winStart; t.toMillis() + duration * MIN <= winEnd; t = t.plus({ minutes: config.increment })) {
        const start = t.toMillis();
        if (start < earliest || start < from || start >= to || start >= latest) continue;
        // Hueco mínimo entre reuniones en ambos sentidos (también tras una reunión ya existente).
        const gap = meetingGap(config) * MIN;
        const blocked: Interval = { start: start - gap, end: start + duration * MIN + gap };
        if (busy.some((b) => overlaps(blocked, b))) continue;
        out.push(start);
      }
    }
    day = day.plus({ days: 1 });
  }
  return [...new Set(out)].sort((a, b) => a - b);
}

/** Agrupa las horas por fecha local (YYYY-MM-DD) en la zona del visitante. */
export function groupByDay(slots: number[], tz: string): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const s of slots) {
    const key = DateTime.fromMillis(s, { zone: tz }).toISODate()!;
    (out[key] ??= []).push(s);
  }
  return out;
}
