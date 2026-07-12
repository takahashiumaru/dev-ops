import { NextResponse } from "next/server";
import {
  authenticateUser,
  createActionToken,
  createSessionToken,
  getSessionCookieOptions,
  sessionCookieName,
} from "@/lib/auth";

export const dynamic = "force-dynamic";

type LoginAttemptState = Map<string, { count: number; resetAt: number }>;
const globalLogin = globalThis as typeof globalThis & {
  __opsdeckLoginAttempts?: LoginAttemptState;
};
const loginAttempts =
  (globalLogin.__opsdeckLoginAttempts ??= new Map<
    string,
    { count: number; resetAt: number }
  >());

function clientIp(request: Request) {
  const forwarded = request.headers
    .get("x-forwarded-for")
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return (
    request.headers.get("x-real-ip")?.trim() ||
    forwarded?.at(-1) ||
    "unknown"
  );
}

function pruneAttempts(now: number) {
  for (const [key, attempt] of loginAttempts) {
    if (attempt.resetAt <= now) loginAttempts.delete(key);
  }
  while (loginAttempts.size > 1_000) {
    const oldest = loginAttempts.keys().next().value as string | undefined;
    if (!oldest) break;
    loginAttempts.delete(oldest);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string; password?: string };
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
    }

    const ip = clientIp(request);
    const attemptKey = `${ip}:${email}`;
    const now = Date.now();
    if (loginAttempts.size > 500) pruneAttempts(now);
    const attempt = loginAttempts.get(attemptKey);
    if (attempt && attempt.resetAt > now && attempt.count >= 5) {
      return NextResponse.json(
        { error: "Too many sign-in attempts. Try again in a few minutes" },
        { status: 429 },
      );
    }

    const user = await authenticateUser(email, password);

    if (!user) {
      const current = attempt && attempt.resetAt > now ? attempt.count : 0;
      loginAttempts.set(attemptKey, {
        count: current + 1,
        resetAt: now + 5 * 60_000,
      });
      return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
    }

    loginAttempts.delete(attemptKey);
    const sessionToken = createSessionToken(user);
    const response = NextResponse.json({
      user: { ...user, actionToken: createActionToken(sessionToken) },
    });
    response.cookies.set(
      sessionCookieName,
      sessionToken,
      getSessionCookieOptions(request),
    );

    return response;
  } catch (error) {
    return NextResponse.json(
      { error: "Sign-in is temporarily unavailable" },
      { status: 503 },
    );
  }
}
