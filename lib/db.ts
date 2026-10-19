import "server-only";
import type { Client } from "@libsql/client";
import { createClient as createHttpClient } from "@libsql/client/http";
import { drizzle } from "drizzle-orm/libsql";
import * as schema from "./schema";

// Local: archivo SQLite. Producción: Turso (libsql://...) con DATABASE_AUTH_TOKEN.
const url = process.env.DATABASE_URL ?? "file:./data/agenda.db";

const SCHEMA_SQL = [
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    image TEXT,
    slug TEXT NOT NULL UNIQUE,
    timezone TEXT NOT NULL DEFAULT 'Europe/Madrid',
    google_refresh_token TEXT,
    google_access_token TEXT,
    google_token_expiry INTEGER,
    calendar_id TEXT NOT NULL DEFAULT 'primary',
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS meeting_types (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    slug TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    config TEXT NOT NULL,
    active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS meeting_types_user_slug ON meeting_types(user_id, slug)`,
  `CREATE TABLE IF NOT EXISTS bookings (
    id TEXT PRIMARY KEY,
    meeting_type_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    start_utc INTEGER NOT NULL,
    end_utc INTEGER NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL,
    guests TEXT NOT NULL DEFAULT '[]',
    answers TEXT NOT NULL DEFAULT '{}',
    timezone TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'confirmed',
    google_event_id TEXT,
    meet_url TEXT,
    hubspot_contact_id TEXT,
    hubspot_meeting_id TEXT,
    integration_log TEXT NOT NULL DEFAULT '[]',
    token TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE INDEX IF NOT EXISTS bookings_user_start ON bookings(user_id, start_utc)`,
];

function makeClient(): Client {
  if (url.startsWith("file:")) {
    // Solo en local: el cliente nativo (con binario de SQLite) se carga únicamente aquí.
    /* eslint-disable @typescript-eslint/no-require-imports */
    const fs = require("node:fs") as typeof import("node:fs");
    const { createClient } = require("@libsql/client") as typeof import("@libsql/client");
    /* eslint-enable @typescript-eslint/no-require-imports */
    fs.mkdirSync("./data", { recursive: true });
    return createClient({ url });
  }
  // Turso / servidor remoto: cliente HTTP 100 % JavaScript, ideal para funciones serverless.
  return createHttpClient({
    url: url.replace(/^libsql:\/\//, "https://"),
    authToken: process.env.DATABASE_AUTH_TOKEN,
  });
}

type Db = ReturnType<typeof drizzle<typeof schema, Client>>;
const g = globalThis as unknown as { __agendaDb?: Promise<Db> };

async function init(): Promise<Db> {
  const client = makeClient();
  await client.batch(SCHEMA_SQL, "write");
  return drizzle(client, { schema });
}

/** Devuelve la base de datos con el esquema ya creado. Se conecta en la primera petición, no al compilar. */
export function getDb(): Promise<Db> {
  g.__agendaDb ??= init().catch((e) => {
    g.__agendaDb = undefined; // reintenta en la siguiente petición
    throw e;
  });
  return g.__agendaDb;
}
