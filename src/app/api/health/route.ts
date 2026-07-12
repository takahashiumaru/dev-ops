import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { unstable_cache } from "next/cache";
import { queryRows } from "@/lib/db";

export const dynamic = "force-dynamic";

type CountRow = RowDataPacket & {
  users_count: number;
};

const getCachedHealth = unstable_cache(
  async () => queryRows<CountRow>(
    "SELECT COUNT(*) AS users_count FROM users WHERE deleted_at IS NULL",
  ),
  ["opsdeck-health"],
  { revalidate: 60, tags: ["opsdeck-health"] },
);

export async function GET() {
  const startedAt = Date.now();

  try {
    const rows = await getCachedHealth();

    return NextResponse.json({
      ok: true,
      database: {
        connected: true,
        usersTable: true,
        seeded: Number(rows[0]?.users_count ?? 0) > 0,
      },
      latencyMs: Date.now() - startedAt,
      checkedAt: new Date().toISOString(),
      cache: "60s",
    });
  } catch {
    return NextResponse.json(
      {
        ok: false,
        database: {
          connected: false,
          usersTable: false,
        },
        error: "Health dependency unavailable",
        latencyMs: Date.now() - startedAt,
        checkedAt: new Date().toISOString(),
        cache: "miss",
      },
      { status: 503 },
    );
  }
}
