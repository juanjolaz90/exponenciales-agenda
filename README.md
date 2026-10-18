# Exponenciales Agenda

Sistema de reservas propio, como HubSpot Meetings, con la marca de Exponenciales.
- **Panel `/app`**: creas y configuras las agendas (duraciones, horario semanal, márgenes, antelación,
  ventana de reserva, invitados, preguntas, ubicación, color, mensaje y sincronización con HubSpot).
- **Página pública `/{tu-url}/{agenda}`**: el cliente elige día, duración y hora en su zona horaria y
  después rellena sus datos.
- **Google Calendar**: lee tus huecos ocupados (free/busy) y crea el evento con enlace de Meet e invitación a los asistentes.
- **HubSpot**: crea o actualiza el contacto por email y registra la reunión asociada al contacto,
  con propietario = tu usuario de HubSpot (por email).
- **Confirmación `/b/{id}`**: botón «Añadir a Google Calendar» y cancelación (borra el evento y marca la reunión como cancelada en HubSpot).

El análisis funcional de HubSpot hecho con REA está en [docs/HUBSPOT-MEETINGS-ANALISIS.md](docs/HUBSPOT-MEETINGS-ANALISIS.md).

## Probar en local

```bash
npm install
npm run dev
```

Abre http://localhost:3000. Sin Google configurado, aparece **«Entrar en modo demo»** (solo en local).
La base de datos se guarda en `data/agenda.db`.

## Variables de entorno

Copia `.env.example` a `.env.local` y rellénalo:

| Variable | Para qué |
|---|---|
| `APP_URL` | URL pública, p. ej. `https://agenda.exponencialesfirm.com` |
| `SESSION_SECRET` | 32 caracteres aleatorios como mínimo. Cifra la sesión y los tokens de Google |
| `ALLOWED_EMAILS` | Emails que pueden entrar al panel |
| `DATABASE_URL` / `DATABASE_AUTH_TOKEN` | En local `file:./data/agenda.db`. En producción, Turso |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth de Google |
| `HUBSPOT_ACCESS_TOKEN` | Token de una private app de HubSpot |

### 1. Google (login + Calendar + Meet)
1. En [Google Cloud Console](https://console.cloud.google.com/), crea un proyecto y activa **Google Calendar API**.
2. Configura la **pantalla de consentimiento OAuth** con los permisos `calendar.events` y `calendar.freebusy`.
   Si usas Google Workspace, elige el tipo **Interno**. Si el tipo es «Externo» y la app sigue en modo prueba,
   Google caduca el acceso cada 7 días: publícala.
3. En Credenciales, crea un **ID de cliente OAuth** de tipo «Aplicación web» con este URI de redirección:
   `{APP_URL}/api/auth/google/callback` (y `http://localhost:3000/api/auth/google/callback` para local).

### 2. HubSpot
En HubSpot ve a **Configuración → Integraciones → Aplicaciones privadas → Crear**, con estos permisos:
- `crm.objects.contacts.read`, `crm.objects.contacts.write`
- `crm.objects.owners.read`

Copia el token en `HUBSPOT_ACCESS_TOKEN`. Si tu portal pide otro permiso para crear reuniones,
el error aparece en **Reservas → Sincronización**. Añade ese permiso a la app.

### 3. Publicar (Vercel + Turso)
1. Crea la base de datos en [Turso](https://turso.tech) y copia la URL `libsql://…` y el token.
   Vercel no conserva archivos locales, así que el SQLite en archivo no sirve en producción.
2. Sube el repositorio a GitHub e impórtalo en [Vercel](https://vercel.com). Añade las variables de entorno.
3. Opcional: en tu DNS, crea un CNAME `agenda` que apunte a Vercel y pon ese dominio en `APP_URL` y en Google.

## Estructura
- `lib/availability.ts`: motor de huecos libres (horario semanal + márgenes + antelación + ocupado).
- `lib/booking.ts`: reserva con comprobación atómica contra dobles reservas, integraciones y cancelación.
- `lib/google.ts` / `lib/hubspot.ts`: clientes de las APIs.
- `components/admin/MeetingTypeEditor.tsx`: editor de la agenda.
- `components/booking/BookingWidget.tsx`: flujo público de 2 pasos.
