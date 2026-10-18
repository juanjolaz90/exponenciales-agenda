import { NextResponse } from "next/server";
import { bookingInputSchema, createBooking, BookingError } from "@/lib/booking";

export async function POST(req: Request) {
  const parsed = bookingInputSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Datos no válidos" }, { status: 400 });
  }
  if (parsed.data.website) return NextResponse.json({ error: "Datos no válidos" }, { status: 400 });
  try {
    const b = await createBooking(parsed.data);
    return NextResponse.json({ id: b.id, token: b.token });
  } catch (e) {
    if (e instanceof BookingError) return NextResponse.json({ error: e.message }, { status: 409 });
    console.error("[book]", e);
    return NextResponse.json({ error: "No se pudo completar la reserva." }, { status: 500 });
  }
}
