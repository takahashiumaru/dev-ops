import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getPool } from "@/lib/db";
import { syncGitHub } from "@/lib/github-sync";
import { getLiveServerData } from "@/lib/server-live";

export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const secret = process.env.HOURLY_SYNC_SECRET?.trim() || "";
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  const left = Buffer.from(secret);
  const right = Buffer.from(provided);
  return secret.length >= 32 && left.length === right.length && crypto.timingSafeEqual(left, right);
}

async function syncVpsSnapshot() {
  const data = await getLiveServerData();
  const pool = getPool();
  const serverKey = process.env.VPS_NAME || data.hostname;
  const capturedAt = new Date(data.checkedAt).toISOString().slice(0, 19).replace("T", " ");
  await pool.execute(
    `INSERT INTO server_metric_snapshots
      (server_key, cpu_percent, memory_percent, swap_percent, disk_percent,
       load_1m, load_5m, load_15m, captured_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [serverKey, data.cpuPercent, data.memory.percent, data.swap.percent,
      data.disk.percent, data.load[0], data.load[1], data.load[2], capturedAt],
  );
  await pool.execute(
    `INSERT INTO integration_syncs
      (integration, status, items_synced, message, started_at, finished_at)
     VALUES ('vps', 'success', ?, ?, ?, ?)`,
    [
      data.services.length + data.docker.containers.length,
      `${data.services.length} services, ${data.docker.containers.length} containers, metrics captured`,
      capturedAt,
      capturedAt,
    ],
  );
  return {
    hostname: data.hostname,
    services: data.services.length,
    containers: data.docker.containers.length,
    checkedAt: data.checkedAt,
  };
}

export async function POST(request: Request) {
  if (!authorized(request))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [github, vps] = await Promise.allSettled([syncGitHub(), syncVpsSnapshot()]);
  await Promise.all([
    getPool().execute(
      `DELETE FROM server_metric_snapshots WHERE captured_at < UTC_TIMESTAMP() - INTERVAL 30 DAY`,
    ),
    getPool().execute(
      `DELETE FROM integration_syncs WHERE started_at < UTC_TIMESTAMP() - INTERVAL 90 DAY`,
    ),
  ]).catch(() => undefined);

  const failed = [github, vps].some((result) => result.status === "rejected");
  return NextResponse.json(
    {
      ok: !failed,
      github: github.status === "fulfilled" ? github.value : { error: github.reason instanceof Error ? github.reason.message : "GitHub sync failed" },
      vps: vps.status === "fulfilled" ? vps.value : { error: vps.reason instanceof Error ? vps.reason.message : "VPS sync failed" },
      syncedAt: new Date().toISOString(),
    },
    { status: failed ? 500 : 200, headers: { "Cache-Control": "no-store" } },
  );
}
