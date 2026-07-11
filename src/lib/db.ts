import mysql from "mysql2/promise";
import type { RowDataPacket } from "mysql2";

type PoolState = {
  pool?: mysql.Pool;
};

const globalState = globalThis as typeof globalThis & {
  __devOpsDashboardDb?: PoolState;
};

function createPool() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured");
  }

  const parsed = new URL(databaseUrl);

  return mysql.createPool({
    host: parsed.hostname,
    port: Number(parsed.port || 3306),
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database: decodeURIComponent(parsed.pathname.replace(/^\//, "")),
    waitForConnections: true,
    connectionLimit: 5,
    maxIdle: 2,
    idleTimeout: 60_000,
    enableKeepAlive: true,
    timezone: "Z",
  });
}

export function getPool() {
  globalState.__devOpsDashboardDb ??= {};
  globalState.__devOpsDashboardDb.pool ??= createPool();
  return globalState.__devOpsDashboardDb.pool;
}

export async function queryRows<T extends RowDataPacket>(
  sql: string,
  values: unknown[] = [],
) {
  const [rows] = await getPool().query<T[]>(sql, values);
  return rows;
}
