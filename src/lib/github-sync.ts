import type { ResultSetHeader, RowDataPacket } from "mysql2";
import { getPool, queryRows } from "@/lib/db";
import { projects } from "@/lib/dashboard-data";

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
  head_commit?: { message?: string | null } | null;
  run_number: number;
  status: string;
  conclusion: string | null;
  html_url: string;
  run_started_at: string | null;
  updated_at: string | null;
  actor?: { login: string };
};

type RepositoryRow = RowDataPacket & { id: number; full_name: string };
type LockRow = RowDataPacket & { acquired: number };

type WorkflowRunRow = RowDataPacket & {
  id: number;
  github_id: number;
  full_name: string;
  status: string;
  conclusion: string | null;
  is_archived: number;
};

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

async function githubMutation(url: string) {
  const response = await fetch(url, {
    method: "POST",
    headers: githubHeaders(),
    cache: "no-store",
  });
  if (!response.ok) {
    let detail = "";
    try {
      const payload = (await response.json()) as { message?: string };
      detail = payload.message ? `: ${payload.message}` : "";
    } catch {
      detail = "";
    }
    throw new Error(`GitHub action failed (${response.status})${detail}`);
  }
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
  const lockConnection = await pool.getConnection();
  const [lockRows] = await lockConnection.query<LockRow[]>(
    "SELECT GET_LOCK('opsdeck:github-sync', 0) AS acquired",
  );
  if (Number(lockRows[0]?.acquired) !== 1) {
    lockConnection.release();
    throw new Error("A GitHub sync is already running");
  }
  try {
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
            (github_id, repository_id, workflow_name, event_name, branch, head_sha, commit_message, run_number,
             status, conclusion, actor_login, html_url, started_at, completed_at, synced_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             workflow_name = VALUES(workflow_name), status = VALUES(status), conclusion = VALUES(conclusion),
             commit_message = VALUES(commit_message), actor_login = VALUES(actor_login),
             completed_at = VALUES(completed_at), synced_at = VALUES(synced_at)`,
            [
              run.id,
              repo.id,
              run.name,
              run.event,
              run.head_branch,
              run.head_sha,
              run.head_commit?.message?.trim().slice(0, 4000) || null,
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
  } finally {
    await lockConnection
      .query("SELECT RELEASE_LOCK('opsdeck:github-sync')")
      .catch(() => undefined);
    lockConnection.release();
  }
}

export async function rerunGitHubWorkflow(databaseRunId: number) {
  const runs = await queryRows<WorkflowRunRow>(
    `SELECT r.id, r.github_id, r.status, r.conclusion,
            repo.full_name, repo.is_archived
     FROM github_workflow_runs r
     JOIN github_repositories repo ON repo.id = r.repository_id
     WHERE r.id = ?
     LIMIT 1`,
    [databaseRunId],
  );
  const run = runs[0];
  if (!run || run.is_archived) throw new Error("Workflow run is not available");
  const allowedRepositories = new Set<string>(
    projects
      .map((project) => project.repo)
      .filter((repository) => repository.includes("/")),
  );
  if (!allowedRepositories.has(run.full_name)) {
    throw new Error("Workflow retry is not enabled for this repository");
  }
  if (run.status !== "completed") {
    throw new Error("Only completed workflow runs can be retried");
  }
  const [owner, repository] = run.full_name.split("/");
  if (!owner || !repository) throw new Error("Repository name is invalid");
  const mode = run.conclusion === "failure" ? "rerun-failed-jobs" : "rerun";
  await githubMutation(
    `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repository)}/actions/runs/${run.github_id}/${mode}`,
  );

  await getPool().execute(
    `UPDATE github_workflow_runs
     SET status = 'queued', conclusion = NULL, completed_at = NULL, synced_at = UTC_TIMESTAMP()
     WHERE id = ?`,
    [run.id],
  );
  return {
    runId: run.id,
    repository: run.full_name,
    mode,
    message: `GitHub workflow retry requested for ${run.full_name}.`,
  };
}
