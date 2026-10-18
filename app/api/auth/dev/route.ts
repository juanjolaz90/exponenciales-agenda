import { NextResponse } from "next/server";
import { googleConfigured } from "@/lib/google";
import { upsertUser } from "@/lib/users";
import { startSession } from "@/lib/session";

/** Acceso de prueba solo en desarrollo y solo si Google no está configurado. */
export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production" || googleConfigured()) {
    return new NextResponse("No disponible", { status: 404 });
  }
  const user = await upsertUser({ email: "demo@exponencialesfirm.com", name: "Juanjo Demo" });
  await startSession(user.id);
  return NextResponse.redirect(new URL("/app", req.url), 303);
}
