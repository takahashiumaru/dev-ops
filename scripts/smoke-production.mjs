import crypto from "node:crypto";
import mysql from "mysql2/promise";

const baseUrl = (process.env.SMOKE_BASE_URL || "https://dev-ops.takahashiumaru.my.id").replace(/\/$/, "");
const databaseUrl = process.env.DATABASE_URL;
const secret = process.env.AUTH_SECRET;

if (!databaseUrl || !secret) {
  throw new Error("DATABASE_URL and AUTH_SECRET are required");
}

const parsed = new URL(databaseUrl);
const connection = await mysql.createConnection({
  host: parsed.hostname,
  port: Number(parsed.port || 3306),
  user: decodeURIComponent(parsed.username),
  password: decodeURIComponent(parsed.password),
  database: decodeURIComponent(parsed.pathname.replace(/^\//, "")),
});

const [users] = await connection.query(
  `SELECT id, name, email, role, status
   FROM users
   WHERE status = 'active' AND deleted_at IS NULL
   ORDER BY FIELD(role, 'owner', 'admin', 'operator', 'viewer'), id
   LIMIT 1`,
);
await connection.end();

const user = users[0];
if (!user) throw new Error("No active smoke-test user is available");

const payload = Buffer.from(
  JSON.stringify({
    id: Number(user.id),
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    exp: Math.floor(Date.now() / 1000) + 300,
  }),
).toString("base64url");
const signature = crypto
  .createHmac("sha256", secret)
  .update(payload)
  .digest("base64url");
const sessionToken = `${payload}.${signature}`;
const actionToken = crypto
  .createHmac("sha256", secret)
  .update(`action:${sessionToken}`)
  .digest("base64url");

async function check(label, path, options = {}, expected = 200) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      Cookie: `opsdeck_session=${sessionToken}`,
      ...(options.headers || {}),
    },
  });
  if (response.status !== expected) {
    throw new Error(`${label} returned ${response.status}, expected ${expected}`);
  }
  const body = await response.json();
  console.log(`${label}=${response.status}`);
  return body;
}

await check("health", "/api/health");
await check("session", "/api/auth/me");
const dashboard = await check("dashboard", "/api/dashboard");
if (!Array.isArray(dashboard.repositories) || !Array.isArray(dashboard.auditLog)) {
  throw new Error("Dashboard payload is incomplete");
}
const live = await check("vps_live", "/api/vps/live");
if (!live.hostname || !live.docker?.containers) {
  throw new Error("Live VPS payload is incomplete");
}
await check("opsdeck_logs", "/api/vps/logs?source=project&target=opsdeck&stream=app");
await check(
  "invalid_action_guard",
  "/api/operations/action",
  {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: baseUrl,
      "X-Opsdeck-Action": "1",
      "X-Opsdeck-CSRF": actionToken,
      "X-Opsdeck-Request-Id": crypto.randomUUID(),
    },
    body: JSON.stringify({ type: "unsupported", action: "restart", target: "docker" }),
  },
  400,
);

if (process.env.SMOKE_ACTIONS === "1") {
  await check("safe_service_action", "/api/operations/action", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Origin: baseUrl,
      "X-Opsdeck-Action": "1",
      "X-Opsdeck-CSRF": actionToken,
      "X-Opsdeck-Request-Id": crypto.randomUUID(),
    },
    body: JSON.stringify({ type: "service", action: "start", target: "cron" }),
  });
}

console.log(`smoke=ok host=${live.hostname} repos=${dashboard.repositories.length}`);
