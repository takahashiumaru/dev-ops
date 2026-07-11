import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { runRemote } from "@/lib/server-live";
import { getProjectLogTarget, redactLogLine } from "@/lib/project-logs";

export const dynamic = "force-dynamic";

const serviceAllowlist = new Set([
  "nginx",
  "php8.3-fpm",
  "mysql",
  "docker",
  "supervisor",
  "cron",
  "taka-fintrack.service",
  "9router.service",
  "hermes-gateway.service",
  "server-monitoring.service",
  "hermes-dashboard.service",
  "mnemosyne-dashboard.service",
  "taka-school.service",
]);

const userServiceAllowlist = new Set([
  "taka-fintrack.service",
  "9router.service",
  "hermes-gateway.service",
  "server-monitoring.service",
  "taka-school.service",
]);

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(request.url);
  const source = searchParams.get("source") || "nginx-error";
  const target = searchParams.get("target") || "nginx";
  const stream = searchParams.get("stream") || "app";
  let command = "";
  let metadata: Record<string, unknown> = {};

  if (source === "project") {
    const projectTarget = getProjectLogTarget(target, stream);
    if (!projectTarget)
      return NextResponse.json(
        { error: "Project log source is not allowed" },
        { status: 400 },
      );
    command = projectTarget.command;
    metadata = {
      project: projectTarget.project,
      domain: projectTarget.domain,
      stream: projectTarget.stream,
      streamLabel: projectTarget.label,
      shared: Boolean(projectTarget.shared),
    };
  } else if (source === "nginx-error")
    command =
      "tail -n 120 /var/log/nginx/error.log 2>/dev/null || journalctl -u nginx -n 120 --no-pager -o short-iso";
  else if (source === "nginx-access")
    command = "tail -n 120 /var/log/nginx/access.log 2>/dev/null";
  else if (source === "service" && serviceAllowlist.has(target))
    command = userServiceAllowlist.has(target)
      ? `journalctl --user -u ${target} -n 120 --no-pager -o short-iso 2>/dev/null`
      : `sudo -n journalctl -u ${target} -n 120 --no-pager -o short-iso 2>/dev/null`;
  else if (
    source === "docker" &&
    /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/.test(target)
  )
    command = `docker logs --tail 120 --timestamps ${target} 2>&1`;
  else
    return NextResponse.json(
      { error: "Log source is not allowed" },
      { status: 400 },
    );

  try {
    const lines = (await runRemote(command))
      .split("\n")
      .filter(Boolean)
      .slice(-160)
      .map((line) => redactLogLine(line.slice(0, 8_000)));
    return NextResponse.json(
      {
        source,
        target,
        lines,
        ...metadata,
        redacted: true,
        checkedAt: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to read logs" },
      { status: 502 },
    );
  }
}
