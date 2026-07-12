import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import type { RowDataPacket } from "mysql2";
import { unstable_cache } from "next/cache";
import { queryRows } from "@/lib/db";

export const dynamic = "force-dynamic";

type UserRow = RowDataPacket & {
  id: number;
  name: string;
  email: string;
  role: "owner" | "admin" | "operator" | "viewer";
  status: "active" | "invited" | "suspended";
  last_login_at: string | null;
  created_at: string;
};

const getCachedUsers = unstable_cache(
  async () => queryRows<UserRow>(
    `SELECT id, name, email, role, status, last_login_at, created_at
     FROM users
     WHERE deleted_at IS NULL
     ORDER BY FIELD(role, 'owner', 'admin', 'operator', 'viewer'), id ASC
     LIMIT 100`,
  ),
  ["opsdeck-users"],
  { revalidate: 60, tags: ["opsdeck-users"] },
);

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!["owner", "admin"].includes(user.role)) {
    return NextResponse.json(
      { error: "Insufficient permission" },
      { status: 403 },
    );
  }
  try {
    const users = await getCachedUsers();

    return NextResponse.json({ users, cache: "60s" });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load users" },
      { status: 503 },
    );
  }
}
