import { NextResponse } from "next/server";
import { authorizeAction } from "@/lib/action-security";
import { syncGitHub } from "@/lib/github-sync";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const security = await authorizeAction(request, {
    roles: ["owner", "admin"],
    rateLimitKey: "github-sync",
    minimumIntervalMs: 5_000,
  });
  if (security.response) return security.response;

  try {
    return NextResponse.json({ ok: true, ...(await syncGitHub()) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "GitHub sync failed" },
      { status: 502 },
    );
  }
}
