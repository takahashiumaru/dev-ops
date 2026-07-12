import { NextResponse } from "next/server";
import { authorizeAction, requestIp } from "@/lib/action-security";
import {
  beginOperationAudit,
  finishOperationAudit,
} from "@/lib/operation-audit";
import {
  runContainerAction,
  runServiceAction,
  scheduleServerReboot,
  serviceActionRoles,
  validateServiceAction,
  type OperationAction,
} from "@/lib/operations";

export const dynamic = "force-dynamic";

type OperationBody = {
  type?: "service" | "container" | "server";
  action?: OperationAction | "reboot";
  target?: string;
  confirmation?: string;
};

const requestIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  let body: OperationBody;
  try {
    body = (await request.json()) as OperationBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const type = body.type;
  const action = body.action;
  const target = String(body.target || "");
  if (!type || !action) {
    return NextResponse.json({ error: "Action type is required" }, { status: 400 });
  }
  if (!(type === "service" || type === "container" || type === "server")) {
    return NextResponse.json({ error: "Action type is not allowed" }, { status: 400 });
  }

  const servicePolicy =
    type === "service" && target ? validateServiceAction(target, action) : null;
  const security = await authorizeAction(request, {
    roles:
      type === "server"
        ? ["owner"]
        : type === "service" && servicePolicy
          ? [...serviceActionRoles(target)]
          : ["owner", "admin", "operator"],
    rateLimitKey: `${type}:${target || "host"}`,
  });
  if (security.response) return security.response;

  if (
    type === "service" &&
    (!target || !servicePolicy)
  ) {
    return NextResponse.json(
      { error: "Service action is not allowed" },
      { status: 400 },
    );
  }
  if (type === "server" && (action !== "reboot" || target)) {
    return NextResponse.json(
      { error: "Server action is not allowed" },
      { status: 400 },
    );
  }
  const expectedHost = process.env.VPS_NAME || "VM-0-5-ubuntu";
  if (type === "server" && body.confirmation !== expectedHost) {
    return NextResponse.json(
      { error: "Server confirmation does not match the hostname" },
      { status: 400 },
    );
  }
  if (
    type === "container" &&
    (!target || !(["start", "stop", "restart"] as string[]).includes(action))
  ) {
    return NextResponse.json(
      { error: "Container action is not allowed" },
      { status: 400 },
    );
  }
  if (
    type === "service" &&
    ((action === "stop" && body.confirmation !== target) ||
      (target === "docker" &&
        action === "restart" &&
        body.confirmation !== target))
  ) {
    return NextResponse.json(
      { error: "Service confirmation does not match the target" },
      { status: 400 },
    );
  }

  const requestId = request.headers.get("x-opsdeck-request-id") || "";
  if (!requestIdPattern.test(requestId)) {
    return NextResponse.json(
      { error: "Action request ID is invalid" },
      { status: 400 },
    );
  }

  let auditId: number;
  try {
    auditId = await beginOperationAudit({
      requestId,
      user: security.user,
      action,
      targetType: type,
      target: target || "primary-vps",
      ip: requestIp(request),
    });
  } catch {
    return NextResponse.json(
      { error: "Action is already running or could not be audited" },
      { status: 409 },
    );
  }

  try {
    const result =
      type === "server"
        ? await scheduleServerReboot()
        : type === "service"
          ? await runServiceAction(target, action as OperationAction)
          : await runContainerAction(target, action as OperationAction);
    await finishOperationAudit(
      auditId,
      result.scheduled ? "scheduled" : "success",
      result.message,
    ).catch(() => undefined);
    return NextResponse.json(
      { ok: true, auditId, ...result },
      { status: result.scheduled ? 202 : 200 },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Operation could not be completed";
    await finishOperationAudit(auditId, "failed", message).catch(
      () => undefined,
    );
    return NextResponse.json({ error: message, auditId }, { status: 502 });
  }
}
