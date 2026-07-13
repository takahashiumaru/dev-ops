import { NextResponse } from "next/server";
import { authorizeAction, requestIp } from "@/lib/action-security";
import { changeUserPassword, getSessionCookieOptions, sessionCookieName } from "@/lib/auth";
import { beginOperationAudit, finishOperationAudit } from "@/lib/operation-audit";

export const dynamic = "force-dynamic";

const requestIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  const security = await authorizeAction(request, {
    roles: ["owner", "admin", "operator", "viewer"],
    rateLimitKey: "change-password",
    minimumIntervalMs: 2_000,
  });
  if (security.response) return security.response;

  const requestId = request.headers.get("x-opsdeck-request-id") || "";
  if (!requestIdPattern.test(requestId))
    return NextResponse.json({ error: "Invalid request ID" }, { status: 400 });

  let body: { currentPassword?: unknown; newPassword?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const currentPassword = typeof body.currentPassword === "string" ? body.currentPassword : "";
  const newPassword = typeof body.newPassword === "string" ? body.newPassword : "";
  if (newPassword.length < 12 || newPassword.length > 128)
    return NextResponse.json(
      { error: "Password baru harus berisi 12–128 karakter" },
      { status: 400 },
    );
  if (currentPassword === newPassword)
    return NextResponse.json(
      { error: "Password baru harus berbeda dari password saat ini" },
      { status: 400 },
    );

  const auditId = await beginOperationAudit({
    requestId,
    user: security.user,
    action: "change password",
    targetType: "account",
    target: security.user.email,
    ip: requestIp(request),
  });
  try {
    const changed = await changeUserPassword(
      security.user.id,
      currentPassword,
      newPassword,
    );
    if (!changed) {
      await finishOperationAudit(auditId, "failed", "Current password verification failed.");
      return NextResponse.json(
        { error: "Password saat ini tidak sesuai" },
        { status: 400 },
      );
    }
    await finishOperationAudit(auditId, "success", "Account password changed successfully.");
    const response = NextResponse.json({ message: "Password berhasil diubah. Silakan login kembali." });
    response.cookies.set(sessionCookieName, "", {
      ...getSessionCookieOptions(request),
      maxAge: 0,
    });
    return response;
  } catch (error) {
    await finishOperationAudit(
      auditId,
      "failed",
      error instanceof Error ? error.message : "Password change failed",
    ).catch(() => undefined);
    return NextResponse.json({ error: "Tidak dapat mengubah password" }, { status: 500 });
  }
}
