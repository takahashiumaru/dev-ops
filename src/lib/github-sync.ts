import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { getPool, queryRows } from "@/lib/db";

type GitHubRepository = {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  private: boolean;
  visibility?: "public" | "private" | "internal";
  default_branch: string;
  language: string | null;
  html_url: string;
  archived: boolean;
  open_issues_count: number;
  pushed_at: string | null;
  owner: { login: string };
};

type GitHubWorkflowRun = {
  id: number;
  name: string;
  event: string;
  head_branch: string | null;
  head_sha: string | null;
  run_number: number;
  status: string;
  conclusion: string | null;
  html_url: string;
  run_started_at: string | null;
  updated_at: string | null;
  actor?: { login: string };
};

type RepositoryRow = RowDataPacket & { id: number; full_name: string };

function githubHeaders() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN is not configured");

  return {
    Accept: "application/vnd.github+json",
    Authorization: `Bearer ${token}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "opsdeck-dashboard",
  };
}

async function githubJson<T>(url: string): Promise<T> {
  const response = await fetch(url, {
    headers: githubHeaders(),
    cache: "no-store",
  });
  if (!response.ok) {
    const remaining = response.headers.get("x-ratelimit-remaining");
    throw new Error(
      `GitHub request failed (${response.status}, remaining ${remaining ?? "unknown"})`,
    );
  }
  return response.json() as Promise<T>;
}

async function githubRepositoryPages() {
  const repositories: GitHubRepository[] = [];
  for (let page = 1; page <= 10; page += 1) {
    const batch = await githubJson<GitHubRepository[]>(
      `https://api.github.com/user/repos?affiliation=owner,collaborator,organization_member&sort=pushed&per_page=100&page=${page}`,
    );
    repositories.push(...batch);
    if (batch.length < 100) break;
  }
  return repositories;
}

function toMysqlDate(value: string | null) {
  return value
    ? new Date(value).toISOString().slice(0, 19).replace("T", " ")
    : null;
}

export async function syncGitHub() {
  const pool = getPool();
  const startedAt = new Date();
  const [syncInsert] = await pool.execute<ResultSetHeader>(
    `INSERT INTO integration_syncs (integration, status, started_at)
     VALUES ('github', 'running', ?)`,
    [toMysqlDate(startedAt.toISOString())],
  );

  try {
    const repositories = await githubRepositoryPages();
    const syncedAt = toMysqlDate(new Date().toISOString());

    for (const repo of repositories) {
      await pool.execute(
        `INSERT INTO github_repositories
          (github_id, owner, name, full_name, description, visibility, default_branch, language, html_url,
           is_archived, open_issues_count, pushed_at, synced_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           owner = VALUES(owner), name = VALUES(name), full_name = VALUES(full_name),
           description = VALUES(description), visibility = VALUES(visibility),
           default_branch = VALUES(default_branch), language = VALUES(language), html_url = VALUES(html_url),
           is_archived = VALUES(is_archived), open_issues_count = VALUES(open_issues_count),
           pushed_at = VALUES(pushed_at), synced_at = VALUES(synced_at)`,
        [
          repo.id,
          repo.owner.login,
          repo.name,
          repo.full_name,
          repo.description,
          repo.visibility ?? (repo.private ? "private" : "public"),
          repo.default_branch,
          repo.language,
          repo.html_url,
          repo.archived ? 1 : 0,
          repo.open_issues_count,
          toMysqlDate(repo.pushed_at),
          syncedAt,
        ],
      );
    }

    const storedRepos = await queryRows<RepositoryRow>(
      `SELECT id, full_name FROM github_repositories
       WHERE is_archived = 0 ORDER BY pushed_at DESC LIMIT 100`,
    );

    let runCount = 0;
    for (let offset = 0; offset < storedRepos.length; offset += 5) {
      const batch = storedRepos.slice(offset, offset + 5);
      const runPayloads = await Promise.all(
        batch.map(async (repo) => ({
          repo,
          payload: await githubJson<{ workflow_runs: GitHubWorkflowRun[] }>(
            `https://api.github.com/repos/${repo.full_name}/actions/runs?per_page=10`,
          ),
        })),
      );
      for (const { repo, payload } of runPayloads) {
        for (const run of payload.workflow_runs) {
          await pool.execute(
            `INSERT INTO github_workflow_runs
            (github_id, repository_id, workflow_name, event_name, branch, head_sha, run_number,
             status, conclusion, actor_login, html_url, started_at, completed_at, synced_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             workflow_name = VALUES(workflow_name), status = VALUES(status), conclusion = VALUES(conclusion),
             actor_login = VALUES(actor_login), completed_at = VALUES(completed_at), synced_at = VALUES(synced_at)`,
            [
              run.id,
              repo.id,
              run.name,
              run.event,
              run.head_branch,
              run.head_sha,
              run.run_number,
              run.status,
              run.conclusion,
              run.actor?.login ?? null,
              run.html_url,
              toMysqlDate(run.run_started_at),
              toMysqlDate(run.updated_at),
              syncedAt,
            ],
          );
          runCount += 1;
        }
      }
    }

    const total = repositories.length + runCount;
    await pool.execute(
      `UPDATE integration_syncs SET status = 'success', items_synced = ?, message = ?, finished_at = ? WHERE id = ?`,
      [
        total,
        `${repositories.length} repositories, ${runCount} workflow runs`,
        syncedAt,
        syncInsert.insertId,
      ],
    );
    return {
      repositories: repositories.length,
      workflowRuns: runCount,
      syncedAt,
    };
  } catch (error) {
    await pool.execute(
      `UPDATE integration_syncs SET status = 'failed', message = ?, finished_at = ? WHERE id = ?`,
      [
        error instanceof Error
          ? error.message.slice(0, 500)
          : "Unknown sync error",
        toMysqlDate(new Date().toISOString()),
        syncInsert.insertId,
      ],
    );
    throw error;
  }
}
