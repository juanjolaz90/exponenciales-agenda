import "server-only";

const BASE = "https://api.hubapi.com";

export const hubspotConfigured = () => Boolean(process.env.HUBSPOT_ACCESS_TOKEN);

async function hs<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${process.env.HUBSPOT_ACCESS_TOKEN}`,
      "content-type": "application/json",
      ...init.headers,
    },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`HubSpot ${res.status} ${path}: ${(await res.text()).slice(0, 300)}`);
  return res.json() as Promise<T>;
}

/** Crea o actualiza el contacto por email y devuelve su id. */
export async function upsertContact(c: { email: string; firstName: string; lastName: string; phone?: string }) {
  const properties: Record<string, string> = { email: c.email, firstname: c.firstName, lastname: c.lastName };
  if (c.phone) properties.phone = c.phone;
  const data = await hs<{ results: { id: string }[] }>("/crm/v3/objects/contacts/batch/upsert", {
    method: "POST",
    body: JSON.stringify({ inputs: [{ idProperty: "email", id: c.email.toLowerCase(), properties }] }),
  });
  return data.results[0].id;
}

/** Id del propietario (usuario de HubSpot) con ese email, si existe. */
export async function ownerIdByEmail(email: string): Promise<string | null> {
  const data = await hs<{ results: { id: string }[] }>(
    `/crm/v3/owners?email=${encodeURIComponent(email)}&limit=1`,
  );
  return data.results[0]?.id ?? null;
}

export async function createMeeting(m: {
  contactId: string;
  ownerId: string | null;
  title: string;
  body: string;
  start: number;
  end: number;
  location: string;
  url: string | null;
}) {
  const properties: Record<string, string> = {
    hs_timestamp: new Date(m.start).toISOString(),
    hs_meeting_title: m.title,
    hs_meeting_body: m.body,
    hs_meeting_start_time: new Date(m.start).toISOString(),
    hs_meeting_end_time: new Date(m.end).toISOString(),
    hs_meeting_outcome: "SCHEDULED",
    hs_meeting_location: m.location,
  };
  if (m.url) properties.hs_meeting_external_url = m.url;
  if (m.ownerId) properties.hubspot_owner_id = m.ownerId;
  const data = await hs<{ id: string }>("/crm/v3/objects/meetings", {
    method: "POST",
    body: JSON.stringify({
      properties,
      // 200 = reunión → contacto (definida por HubSpot)
      associations: [
        { to: { id: m.contactId }, types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 200 }] },
      ],
    }),
  });
  return data.id;
}

export async function cancelMeeting(meetingId: string) {
  await hs(`/crm/v3/objects/meetings/${meetingId}`, {
    method: "PATCH",
    body: JSON.stringify({ properties: { hs_meeting_outcome: "CANCELED" } }),
  });
}
