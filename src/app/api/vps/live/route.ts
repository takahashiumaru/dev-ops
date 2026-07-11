import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { getLiveServerData } from "@/lib/server-live";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const data = await getLiveServerData();
    const serverKey = process.env.VPS_NAME || data.hostname;
    getPool()
      .execute(
        `INSERT INTO server_metric_snapshots
          (server_key, cpu_percent, memory_percent, swap_percent, disk_percent, load_1m, load_5m, load_15m, captured_at)
         SELECT ?, ?, ?, ?, ?, ?, ?, ?, ? FROM DUAL
         WHERE NOT EXISTS (
           SELECT 1 FROM server_metric_snapshots
           WHERE server_key = ? AND captured_at >= UTC_TIMESTAMP() - INTERVAL 1 MINUTE
         )`,
        [
          serverKey,
          data.cpuPercent,
          data.memory.percent,
          data.swap.percent,
          data.disk.percent,
          data.load[0],
          data.load[1],
          data.load[2],
          new Date(data.checkedAt).toISOString().slice(0, 19).replace("T", " "),
          serverKey,
        ],
      )
      .catch(() => undefined);
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to reach VPS" },
      { status: 502 },
    );
  }
}
