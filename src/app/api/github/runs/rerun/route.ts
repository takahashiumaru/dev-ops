import { NextResponse } from "next/server";
import { authorizeAction, requestIp } from "@/lib/action-security";
import { rerunGitHubWorkflow } from "@/lib/github-sync";
import {
  beginOperationAudit,
  finishOperationAudit,
} from "@/lib/operation-audit";

export const dynamic = "force-dynamic";

const requestIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  let runId = 0;
  try {
    const body = (await request.json()) as { runId?: number };
    runId = Number(body.runId || 0);
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (!Number.isSafeInteger(runId) || runId <= 0) {
    return NextResponse.json({ error: "Workflow run is invalid" }, { status: 400 });
  }
  const requestId = request.headers.get("x-opsdeck-request-id") || "";
  if (!requestIdPattern.test(requestId)) {
    return NextResponse.json(
      { error: "Action request ID is invalid" },
      { status: 400 },
    );
  }

  const security = await authorizeAction(request, {
    roles: ["owner", "admin"],
    rateLimitKey: `github-rerun:${runId}`,
  });
  if (security.response) return security.response;

  let auditId: number;
  try {
    auditId = await beginOperationAudit({
      requestId,
      user: security.user,
      action: "rerun",
      targetType: "github-workflow",
      target: String(runId),
      ip: requestIp(request),
    });
  } catch {
    return NextResponse.json(
      { error: "Retry is already running or could not be audited" },
      { status: 409 },
    );
  }

  try {
    const result = await rerunGitHubWorkflow(runId);
    await finishOperationAudit(auditId, "success", result.message).catch(
      () => undefined,
    );
    return NextResponse.json({ ok: true, auditId, ...result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Workflow retry failed";
    await finishOperationAudit(auditId, "failed", message).catch(
      () => undefined,
    );
    return NextResponse.json({ error: message, auditId }, { status: 502 });
  }
}
