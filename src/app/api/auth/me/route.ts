import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import {
  createActionToken,
  getSessionUser,
  sessionCookieName,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(sessionCookieName)?.value;
  const user = await getSessionUser();

  if (!user) {
    return NextResponse.json({ user: null }, { status: 401 });
  }

  return NextResponse.json({
    user: { ...user, actionToken: createActionToken(sessionToken!) },
  });
}
