import { NextResponse } from "next/server";
import { endSession } from "@/lib/session";

export async function POST(req: Request) {
  await endSession();
  return NextResponse.redirect(new URL("/login", req.url), 303);
}
