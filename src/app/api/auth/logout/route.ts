import { NextResponse } from "next/server";
import { sessionCookieName, getSessionCookieOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const cookieOptions = getSessionCookieOptions(request);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookieName, "", {
    ...cookieOptions,
    maxAge: 0,
  });

  return response;
}
