import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  createActionToken,
  getSessionUser,
  sessionCookieName,
  type AuthUser,
} from "@/lib/auth";

type SecurityState = {
  lastActionAt: Map<string, number>;
};

const globalSecurity = globalThis as typeof globalThis & {
  __opsdeckActionSecurity?: SecurityState;
};

function actionState() {
  globalSecurity.__opsdeckActionSecurity ??= { lastActionAt: new Map() };
  return globalSecurity.__opsdeckActionSecurity;
}

function requestIsSameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  try {
    const configured = process.env.APP_ORIGIN?.trim().replace(/\/$/, "");
    const expected =
      configured ||
      (process.env.NODE_ENV === "production" ? "" : new URL(request.url).origin);
    return Boolean(expected) && new URL(origin).origin === expected;
  } catch {
    return false;
  }
}

async function requestHasActionToken(request: Request) {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(sessionCookieName)?.value;
  const actionToken = request.headers.get("x-opsdeck-csrf");
  if (!sessionToken || !actionToken) return false;
  return createActionToken(sessionToken) === actionToken;
}

export function requestIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    null
  );
}

export async function authorizeAction(
  request: Request,
  options: {
    roles: AuthUser["role"][];
    rateLimitKey: string;
    minimumIntervalMs?: number;
  },
): Promise<{ user: AuthUser; response?: never } | { user?: never; response: NextResponse }> {
  const user = await getSessionUser();
  if (!user) {
    return {
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  if (!options.roles.includes(user.role)) {
    return {
      response: NextResponse.json(
        { error: "Insufficient permission" },
        { status: 403 },
      ),
    };
  }

  if (
    request.headers.get("x-opsdeck-action") !== "1" ||
    !requestIsSameOrigin(request) ||
    !(await requestHasActionToken(request))
  ) {
    return {
      response: NextResponse.json(
        { error: "Action request could not be verified" },
        { status: 403 },
      ),
    };
  }

  const interval = options.minimumIntervalMs ?? 2_500;
  const key = `${user.id}:${options.rateLimitKey}`;
  const state = actionState();
  if (state.lastActionAt.size > 500) {
    const oldest = state.lastActionAt.keys().next().value as string | undefined;
    if (oldest) state.lastActionAt.delete(oldest);
  }
  const now = Date.now();
  const previous = state.lastActionAt.get(key) ?? 0;
  if (now - previous < interval) {
    return {
      response: NextResponse.json(
        { error: "Wait a moment before running another action" },
        { status: 429 },
      ),
    };
  }
  state.lastActionAt.set(key, now);

  return { user };
}
