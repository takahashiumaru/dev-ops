import crypto from "node:crypto";
import { cookies } from "next/headers";
import type { RowDataPacket } from "mysql2";
import { getPool, queryRows } from "@/lib/db";

export const sessionCookieName = "opsdeck_session";
export const sessionDurationSeconds = 60 * 60 * 12;

const scryptParameters = { N: 16_384, r: 8, p: 1 } as const;

export type AuthUser = {
  id: number;
  name: string;
  email: string;
  role: "owner" | "admin" | "operator" | "viewer";
  status: "active" | "invited" | "suspended";
};

type UserRow = RowDataPacket & AuthUser & {
  password_hash: string;
};

type SessionPayload = AuthUser & {
  exp: number;
};

function getSessionSecret() {
  const secret = process.env.AUTH_SECRET?.trim();

  if (!secret) {
    if (process.env.NODE_ENV !== "production") {
      return "opsdeck-development-only-session-secret";
    }
    throw new Error("AUTH_SECRET is not configured");
  }

  if (Buffer.byteLength(secret) < 32) {
    throw new Error("AUTH_SECRET must contain at least 32 bytes");
  }

  return secret;
}

function toBase64Url(value: string | Buffer) {
  return Buffer.from(value).toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function signPayload(encodedPayload: string) {
  return crypto.createHmac("sha256", getSessionSecret()).update(encodedPayload).digest("base64url");
}

export function createActionToken(sessionToken: string) {
  return crypto
    .createHmac("sha256", getSessionSecret())
    .update(`action:${sessionToken}`)
    .digest("base64url");
}

function timingSafeEqual(a: string, b: string) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);

  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto
    .scryptSync(password, salt, 64, scryptParameters)
    .toString("hex");

  return `scrypt$N${scryptParameters.N}$r${scryptParameters.r}$p${scryptParameters.p}$${salt}$${hash}`;
}

function verifyPassword(password: string, storedHash: string) {
  if (storedHash.startsWith("sha256$")) {
    const [, salt, hash] = storedHash.split("$");
    if (!salt || !hash) return false;
    const candidate = crypto.createHash("sha256").update(`${salt}${password}`).digest("hex");
    return timingSafeEqual(candidate, hash);
  }

  if (storedHash.startsWith("scrypt$")) {
    const [, nPart, rPart, pPart, salt, hash] = storedHash.split("$");
    if (!nPart || !rPart || !pPart || !salt || !hash) return false;
    const n = Number(nPart.replace("N", ""));
    const r = Number(rPart.replace("r", ""));
    const p = Number(pPart.replace("p", ""));
    if (
      !Number.isInteger(n) ||
      n < 2 ||
      n > 32_768 ||
      (n & (n - 1)) !== 0 ||
      !Number.isInteger(r) ||
      r < 1 ||
      r > 16 ||
      !Number.isInteger(p) ||
      p < 1 ||
      p > 4
    ) {
      return false;
    }

    try {
      const candidate = crypto.scryptSync(password, salt, 64, { N: n, r, p }).toString("hex");
      return timingSafeEqual(candidate, hash);
    } catch {
      return false;
    }
  }

  return false;
}

export async function authenticateUser(email: string, password: string) {
  const rows = await queryRows<UserRow>(
    `SELECT id, name, email, password_hash, role, status
     FROM users
     WHERE email = ? AND deleted_at IS NULL
     LIMIT 1`,
    [email],
  );
  const user = rows[0];

  if (!user || user.status !== "active" || !verifyPassword(password, user.password_hash)) {
    return null;
  }

  const upgradedHash = user.password_hash.startsWith("sha256$") ? hashPassword(password) : null;
  await getPool().execute(
    `UPDATE users
     SET password_hash = COALESCE(?, password_hash), last_login_at = UTC_TIMESTAMP()
     WHERE id = ?`,
    [upgradedHash, user.id],
  );

  return {
    id: Number(user.id),
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
  } satisfies AuthUser;
}

export function createSessionToken(user: AuthUser) {
  const payload: SessionPayload = {
    ...user,
    exp: Math.floor(Date.now() / 1000) + sessionDurationSeconds,
  };
  const encodedPayload = toBase64Url(JSON.stringify(payload));
  return `${encodedPayload}.${signPayload(encodedPayload)}`;
}

export function verifySessionToken(token?: string | null) {
  if (!token) return null;

  const [encodedPayload, signature] = token.split(".");
  if (!encodedPayload || !signature || !timingSafeEqual(signPayload(encodedPayload), signature)) return null;

  try {
    const payload = JSON.parse(fromBase64Url(encodedPayload)) as SessionPayload;
    if (
      !payload.exp ||
      payload.exp < Math.floor(Date.now() / 1000) ||
      payload.status !== "active"
    ) {
      return null;
    }

    return {
      id: Number(payload.id),
      name: payload.name,
      email: payload.email,
      role: payload.role,
      status: payload.status,
    } satisfies AuthUser;
  } catch {
    return null;
  }
}

export async function getSessionUser() {
  const cookieStore = await cookies();
  const tokenUser = verifySessionToken(cookieStore.get(sessionCookieName)?.value);
  if (!tokenUser) return null;

  const rows = await queryRows<UserRow>(
    `SELECT id, name, email, password_hash, role, status
     FROM users
     WHERE id = ? AND status = 'active' AND deleted_at IS NULL
     LIMIT 1`,
    [tokenUser.id],
  );
  const user = rows[0];
  if (!user || user.email !== tokenUser.email) return null;

  return {
    id: Number(user.id),
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
  } satisfies AuthUser;
}

function requestUsesHttps(request: Request) {
  const override = process.env.AUTH_COOKIE_SECURE?.trim().toLowerCase();
  if (override === "true" || override === "1") return true;
  if (override === "false" || override === "0") return false;

  const forwardedProtocol = request.headers
    .get("x-forwarded-proto")
    ?.split(",")[0]
    ?.trim()
    .toLowerCase();
  if (forwardedProtocol) return forwardedProtocol === "https";

  return new URL(request.url).protocol === "https:";
}

export function getSessionCookieOptions(request: Request) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: requestUsesHttps(request),
    path: "/",
    maxAge: sessionDurationSeconds,
  };
}
