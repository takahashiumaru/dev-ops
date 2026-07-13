import { NextResponse } from "next/server";
import { authorizeAction, requestIp } from "@/lib/action-security";
import { getSessionUser } from "@/lib/auth";
import { beginOperationAudit, finishOperationAudit } from "@/lib/operation-audit";
import {
  closeTerminalSession,
  createTerminalSession,
  resizeTerminalSession,
  subscribeTerminalSession,
  writeTerminalSession,
} from "@/lib/terminal-sessions";

export const dynamic = "force-dynamic";
const requestIdPattern = /^[0-9a-f-]{36}$/i;
const clamp = (value: unknown, min: number, max: number, fallback: number) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(max, Math.max(min, Math.round(number))) : fallback;
};

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (user.role !== "owner") return NextResponse.json({ error: "Owner access required" }, { status: 403 });
  const id = new URL(request.url).searchParams.get("id") || "";
  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: { type: "data" | "exit"; data: string }) => {
        controller.enqueue(encoder.encode(`event: ${event.type}\ndata: ${event.data}\n\n`));
        if (event.type === "exit") controller.close();
      };
      unsubscribe = subscribeTerminalSession(id, user.id, send);
      if (!unsubscribe) {
        controller.enqueue(encoder.encode("event: exit\ndata: Terminal session unavailable\n\n"));
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(": connected\n\n"));
    },
    cancel() { unsubscribe?.(); },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

export async function POST(request: Request) {
  const security = await authorizeAction(request, {
    roles: ["owner"], rateLimitKey: "interactive-terminal", minimumIntervalMs: 0,
  });
  if (security.response) return security.response;
  const body = (await request.json().catch(() => ({}))) as {
    action?: unknown; id?: unknown; data?: unknown; cols?: unknown; rows?: unknown;
  };
  const action = String(body.action || "create");
  if (action === "input") {
    const data = typeof body.data === "string" ? body.data : "";
    if (!data || data.length > 16_384 || !writeTerminalSession(String(body.id || ""), security.user.id, data))
      return NextResponse.json({ error: "Terminal session unavailable" }, { status: 404 });
    return NextResponse.json({ ok: true });
  }
  if (action === "resize") {
    const resized = resizeTerminalSession(
      String(body.id || ""), security.user.id,
      clamp(body.cols, 20, 300, 120), clamp(body.rows, 8, 120, 32),
    );
    return resized ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Terminal session unavailable" }, { status: 404 });
  }
  const requestId = request.headers.get("x-opsdeck-request-id") || "";
  if (!requestIdPattern.test(requestId)) return NextResponse.json({ error: "Invalid request ID" }, { status: 400 });
  let auditId: number | null = null;
  try {
    auditId = await beginOperationAudit({
      requestId, user: security.user, action: "open terminal", targetType: "server",
      target: "primary-vps", ip: requestIp(request),
    });
    const id = await createTerminalSession(
      security.user.id, clamp(body.cols, 20, 300, 120), clamp(body.rows, 8, 120, 32),
    );
    await finishOperationAudit(auditId, "success", "Interactive SSH terminal opened.");
    return NextResponse.json({ id });
  } catch (error) {
    if (auditId) await finishOperationAudit(auditId, "failed", error instanceof Error ? error.message : "Terminal failed").catch(() => undefined);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Terminal failed" }, { status: 502 });
  }
}

export async function DELETE(request: Request) {
  const security = await authorizeAction(request, {
    roles: ["owner"], rateLimitKey: "close-terminal", minimumIntervalMs: 0,
  });
  if (security.response) return security.response;
  const id = new URL(request.url).searchParams.get("id") || "";
  closeTerminalSession(id, security.user.id);
  return NextResponse.json({ ok: true });
}
