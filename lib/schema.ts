import { sqliteTable, text, integer, uniqueIndex, index } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  image: text("image"),
  slug: text("slug").notNull().unique(),
  timezone: text("timezone").notNull().default("Europe/Madrid"),
  googleRefreshToken: text("google_refresh_token"), // cifrado
  googleAccessToken: text("google_access_token"), // cifrado
  googleTokenExpiry: integer("google_token_expiry"),
  calendarId: text("calendar_id").notNull().default("primary"),
  createdAt: integer("created_at").notNull(),
});

export const meetingTypes = sqliteTable(
  "meeting_types",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    slug: text("slug").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    config: text("config").notNull(), // JSON validado por meetingConfigSchema
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [uniqueIndex("meeting_types_user_slug").on(t.userId, t.slug)],
);

export const bookings = sqliteTable(
  "bookings",
  {
    id: text("id").primaryKey(),
    meetingTypeId: text("meeting_type_id").notNull(),
    userId: text("user_id").notNull(),
    startUtc: integer("start_utc").notNull(),
    endUtc: integer("end_utc").notNull(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    email: text("email").notNull(),
    guests: text("guests").notNull().default("[]"),
    answers: text("answers").notNull().default("{}"),
    timezone: text("timezone").notNull(),
    status: text("status", { enum: ["confirmed", "cancelled"] }).notNull().default("confirmed"),
    googleEventId: text("google_event_id"),
    meetUrl: text("meet_url"),
    hubspotContactId: text("hubspot_contact_id"),
    hubspotMeetingId: text("hubspot_meeting_id"),
    integrationLog: text("integration_log").notNull().default("[]"),
    token: text("token").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [index("bookings_user_start").on(t.userId, t.startUtc)],
);

export type User = typeof users.$inferSelect;
export type MeetingTypeRow = typeof meetingTypes.$inferSelect;
export type Booking = typeof bookings.$inferSelect;
