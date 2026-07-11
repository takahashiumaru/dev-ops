import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { syncGitHub } from "@/lib/github-sync";

export const dynamic = "force-dynamic";

export async function POST() {
  const user = await getSessionUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["owner", "admin"].includes(user.role))
    return NextResponse.json(
      { error: "Insufficient permission" },
      { status: 403 },
    );

  try {
    return NextResponse.json({ ok: true, ...(await syncGitHub()) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "GitHub sync failed" },
      { status: 502 },
    );
  }
}
