import { syncGitHub } from "../src/lib/github-sync";
import { getPool } from "../src/lib/db";

async function main() {
  try {
    const result = await syncGitHub();
    console.log(
      `GitHub sync complete: ${result.repositories} repositories, ${result.workflowRuns} workflow runs.`,
    );
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : "GitHub sync failed",
    );
    process.exitCode = 1;
  } finally {
    await getPool().end();
  }
}

main();
