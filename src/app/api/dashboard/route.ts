import { NextResponse } from "next/server";
import type { RowDataPacket } from "mysql2";
import { getSessionUser } from "@/lib/auth";
import { queryRows } from "@/lib/db";

export const dynamic = "force-dynamic";

type RepoRow = RowDataPacket & {
  id: number;
  owner: string;
  name: string;
  full_name: string;
  description: string | null;
  visibility: string;
  default_branch: string;
  language: string | null;
  html_url: string;
  is_archived: number;
  open_issues_count: number;
  pushed_at: Date | null;
  synced_at: Date;
};
type RunRow = RowDataPacket & {
  id: number;
  github_id: number;
  full_name: string;
  workflow_name: string;
  event_name: string;
  branch: string | null;
  head_sha: string | null;
  commit_message: string | null;
  run_number: number;
  status: string;
  conclusion: string | null;
  actor_login: string | null;
  html_url: string;
  started_at: Date | null;
  completed_at: Date | null;
};
type AuditRow = RowDataPacket & {
  id: number;
  user_name: string;
  user_role: string;
  action_name: string;
  target_type: string;
  target_name: string;
  status: string;
  message: string | null;
  started_at: Date;
  finished_at: Date | null;
};
type SyncRow = RowDataPacket & {
  status: string;
  items_synced: number;
  message: string | null;
  started_at: Date;
  finished_at: Date | null;
};
type MetricRow = RowDataPacket & {
  cpu_percent: number | null;
  memory_percent: number | null;
  swap_percent: number | null;
  disk_percent: number | null;
  load_1m: number | null;
  captured_at: Date;
};

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const range = searchParams.get("range") || "recent";

  let metricQuery = "";
  if (range === "day") {
    metricQuery = `
      SELECT CAST(AVG(cpu_percent) AS DOUBLE) AS cpu_percent,
             CAST(AVG(memory_percent) AS DOUBLE) AS memory_percent,
             CAST(AVG(swap_percent) AS DOUBLE) AS swap_percent,
             CAST(AVG(disk_percent) AS DOUBLE) AS disk_percent,
             CAST(AVG(load_1m) AS DOUBLE) AS load_1m,
             MIN(captured_at) AS captured_at
      FROM server_metric_snapshots
      WHERE captured_at >= UTC_TIMESTAMP() - INTERVAL 1 DAY
      GROUP BY FLOOR(UNIX_TIMESTAMP(captured_at) / 900)
      ORDER BY captured_at ASC
    `;
  } else if (range === "week") {
    metricQuery = `
      SELECT CAST(AVG(cpu_percent) AS DOUBLE) AS cpu_percent,
             CAST(AVG(memory_percent) AS DOUBLE) AS memory_percent,
             CAST(AVG(swap_percent) AS DOUBLE) AS swap_percent,
             CAST(AVG(disk_percent) AS DOUBLE) AS disk_percent,
             CAST(AVG(load_1m) AS DOUBLE) AS load_1m,
             MIN(captured_at) AS captured_at
      FROM server_metric_snapshots
      WHERE captured_at >= UTC_TIMESTAMP() - INTERVAL 7 DAY
      GROUP BY FLOOR(UNIX_TIMESTAMP(captured_at) / 7200)
      ORDER BY captured_at ASC
    `;
  } else if (range === "month") {
    metricQuery = `
      SELECT CAST(AVG(cpu_percent) AS DOUBLE) AS cpu_percent,
             CAST(AVG(memory_percent) AS DOUBLE) AS memory_percent,
             CAST(AVG(swap_percent) AS DOUBLE) AS swap_percent,
             CAST(AVG(disk_percent) AS DOUBLE) AS disk_percent,
             CAST(AVG(load_1m) AS DOUBLE) AS load_1m,
             MIN(captured_at) AS captured_at
      FROM server_metric_snapshots
      WHERE captured_at >= UTC_TIMESTAMP() - INTERVAL 30 DAY
      GROUP BY FLOOR(UNIX_TIMESTAMP(captured_at) / 28800)
      ORDER BY captured_at ASC
    `;
  } else {
    // default: recent
    metricQuery = `
      SELECT cpu_percent, memory_percent, swap_percent, disk_percent, load_1m, captured_at
      FROM (
        SELECT cpu_percent, memory_percent, swap_percent, disk_percent, load_1m, captured_at
        FROM server_metric_snapshots
        ORDER BY captured_at DESC
        LIMIT 96
      ) recent_samples
      ORDER BY captured_at ASC
    `;
  }

  try {
    const [repositories, workflowRuns, syncs, metricHistory, auditLog] =
      await Promise.all([
        queryRows<RepoRow>(
          `SELECT id, owner, name, full_name, description, visibility, default_branch, language,
                html_url, is_archived, open_issues_count, pushed_at, synced_at
         FROM github_repositories ORDER BY is_archived ASC, pushed_at DESC LIMIT 100`,
        ),
        queryRows<RunRow>(
          `SELECT r.id, r.github_id, repo.full_name, r.workflow_name, r.event_name, r.branch, r.head_sha,
                r.commit_message,
                r.run_number, r.status, r.conclusion, r.actor_login, r.html_url, r.started_at, r.completed_at
         FROM github_workflow_runs r
         JOIN github_repositories repo ON repo.id = r.repository_id
         ORDER BY COALESCE(r.started_at, r.created_at) DESC LIMIT 80`,
        ),
        queryRows<SyncRow>(
          `SELECT status, items_synced, message, started_at, finished_at
         FROM integration_syncs WHERE integration = 'github' ORDER BY started_at DESC LIMIT 8`,
        ),
        queryRows<MetricRow>(metricQuery),
        queryRows<AuditRow>(
          `SELECT id, user_name, user_role, action_name, target_type, target_name,
                  status, message, started_at, finished_at
           FROM operation_audit_logs
           ORDER BY started_at DESC
           LIMIT 30`,
        ),
      ]);

    return NextResponse.json({
      repositories,
      workflowRuns,
      syncs,
      metricHistory,
      auditLog,
      source: "mysql",
      fetchedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to read dashboard cache",
      },
      { status: 503 },
    );
  }
}
