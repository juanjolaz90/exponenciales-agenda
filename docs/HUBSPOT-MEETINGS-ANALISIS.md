# Análisis de HubSpot Meetings (referencia funcional)

Fecha: 2026-10-18. Fuentes:
- Captura con REA (`capture_browser_scenario`, Chrome headless, es-ES, Europe/Madrid) de
  `https://meetings-eu1.hubspot.com/exponenciales-firm/juanjo` (página propia del usuario).
- Documentación pública del Scheduler API de HubSpot (developers.hubspot.com).

Solo se estudió el comportamiento observable. No se copió código ni recursos de HubSpot.

## Flujo público (2 pasos)

**Paso 1: «Elige una hora»** ([captura](hubspot-paso1.png))
- Indicador de pasos arriba («Elige una hora», «Tu información») y el logo de la empresa.
- Tarjeta dividida en dos columnas:
  - Izquierda: avatar, «Reunirse con Juanjo» y el calendario mensual (L→D) con flechas de mes.
    Los días sin disponibilidad están desactivados y por defecto se selecciona el primer día libre.
  - Derecha: «¿Cuánto tiempo necesitas?» (30/15/45/60 min, con 30 por defecto),
    «¿A qué hora puedes?» con la fecha, un selector de zona horaria y la lista de horas de inicio
    (incremento de 15 min).
- La navegación de meses se limita a la ventana de reserva (semanas a mostrar).

**Paso 2: «Tu información»** ([captura](hubspot-paso2.png))
- Fecha y hora elegidas, con botón «Editar» para volver al paso 1.
- Nombre*, Apellidos*, Email*.
- «Agregar invitados»: hasta 10 emails.
- «Confirmar» se desactiva hasta que el formulario es válido; «Atrás» vuelve al paso 1.

## Endpoints observados (red)
- `GET app-eu1.hubspot.com/api/meetings-public/v3/book?slug=…`: configuración del enlace y disponibilidad.
- `GET …/meetings-public/v3/book/availability-page`: más franjas (paginado por mes).
- `POST …/meetings-public/v3/book`: crear la reserva.
- Más telemetría, analítica y banner de cookies (no se replica).

## Modelo de datos (Scheduler API)
- Enlace: `slug`, `name`, `type` (PERSONAL_LINK / GROUP / ROUND_ROBIN), organizador.
- `customParams`: `durations[]` (ms), `meetingBufferTime`, `startTimeIncrementMinutes`,
  `weeksToAdvertise`, `availability` por día de la semana (minutos desde 00:00),
  `formFields`, `guestSettings {canAddGuests, maxGuestCount}`, branding y consentimiento legal.
- Disponibilidad: franjas `{startMillisUtc, endMillisUtc}` agrupadas por duración.
- Reserva: `slug, firstName, lastName, email, startTime, duration, guestEmails, timezone, locale`.
  Respuesta: `calendarEventId`, `contactId`, `location` (Meet) e `isOffline`.

## Qué replica Exponenciales Agenda (v1, agenda personal)
Todo se configura desde el panel `/app`:
- Título, slug, descripción y color de acento.
- Duraciones múltiples con una por defecto.
- Incremento de horas de inicio.
- Horario semanal con varios tramos por día y zona horaria del organizador.
- Buffer antes y después de cada reunión.
- Antelación mínima y ventana de reserva (días).
- Invitados (activar y fijar el máximo).
- Preguntas personalizadas (texto o texto largo, obligatoria o no).
- Ubicación: Google Meet automático, teléfono, presencial o enlace propio.
- Mensaje de confirmación.
- Integraciones: Google Calendar (ocupado/libre, evento y Meet) y HubSpot (contacto, reunión y propietario).
