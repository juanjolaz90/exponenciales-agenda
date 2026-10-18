import { z } from "zod";

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Formato HH:MM");

export const windowSchema = z
  .object({ start: hhmm, end: hhmm })
  .refine((w) => w.start < w.end, "La hora de fin debe ser posterior al inicio");

export const questionSchema = z.object({
  id: z.string().min(1).max(40),
  label: z.string().trim().min(1).max(200),
  type: z.enum(["text", "textarea", "phone"]),
  required: z.boolean(),
});

export const meetingConfigSchema = z
  .object({
    durations: z.array(z.number().int().min(5).max(480)).min(1).max(8),
    defaultDuration: z.number().int(),
    increment: z.number().int().refine((n) => [5, 10, 15, 20, 30, 60].includes(n)),
    timezone: z.string().min(1),
    // Clave: día ISO (1 = lunes ... 7 = domingo)
    weekly: z.record(z.enum(["1", "2", "3", "4", "5", "6", "7"]), z.array(windowSchema)),
    bufferBefore: z.number().int().min(0).max(240),
    bufferAfter: z.number().int().min(0).max(240),
    minNoticeMinutes: z.number().int().min(0).max(60 * 24 * 30),
    maxDaysAhead: z.number().int().min(1).max(365),
    guests: z.object({ enabled: z.boolean(), max: z.number().int().min(0).max(20) }),
    questions: z.array(questionSchema).max(15),
    location: z.object({
      type: z.enum(["meet", "phone", "inperson", "link"]),
      value: z.string().max(500),
    }),
    accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    confirmationMessage: z.string().max(1000),
    syncHubspot: z.boolean(),
  })
  .refine((c) => c.durations.includes(c.defaultDuration), {
    message: "La duración por defecto debe estar entre las duraciones",
    path: ["defaultDuration"],
  })
  .refine((c) => isValidTimeZone(c.timezone), { message: "Zona horaria no válida", path: ["timezone"] });

export type MeetingConfig = z.infer<typeof meetingConfigSchema>;

export const meetingTypeInputSchema = z.object({
  title: z.string().trim().min(1, "Pon un título").max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Solo minúsculas, números y guiones")
    .max(60),
  description: z.string().max(2000),
  active: z.boolean(),
  config: meetingConfigSchema,
});
export type MeetingTypeInput = z.infer<typeof meetingTypeInputSchema>;

export function isValidTimeZone(tz: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function defaultConfig(timezone = "Europe/Madrid"): MeetingConfig {
  const day = [{ start: "09:00", end: "17:00" }];
  return {
    durations: [15, 30, 45, 60],
    defaultDuration: 30,
    increment: 15,
    timezone,
    weekly: { "1": day, "2": day, "3": day, "4": day, "5": day, "6": [], "7": [] },
    bufferBefore: 0,
    bufferAfter: 0,
    minNoticeMinutes: 120,
    maxDaysAhead: 14,
    guests: { enabled: true, max: 10 },
    questions: [],
    location: { type: "meet", value: "" },
    accent: "#F43A59",
    confirmationMessage: "¡Listo! Te hemos enviado la invitación por email.",
    syncHubspot: true,
  };
}

export const LOCATION_LABEL: Record<MeetingConfig["location"]["type"], string> = {
  meet: "Google Meet",
  phone: "Llamada telefónica",
  inperson: "Presencial",
  link: "Videollamada",
};

/** Slugs que no pueden usarse como usuario porque chocan con rutas de la app. */
export const RESERVED_SLUGS = new Set(["app", "api", "login", "b", "_next", "favicon.ico", "logout"]);
