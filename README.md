# Opsdeck Infrastructure Console

Private control plane for VPS resources, projects, Docker, GitHub CI/CD, logs, alerts, deployments, and user access.

## Data Strategy

- GitHub repositories and workflow runs are synchronized server-side and cached in MySQL.
- Dashboard pages read GitHub data from MySQL, so navigation does not consume GitHub API calls.
- CPU, RAM, swap, disk, systemd state, and Docker inventory are read live only on relevant pages.
- Nginx, systemd, and Docker logs are fetched on demand from an allowlist and are not persisted by default.
- VPS and GitHub mutations use role checks, exact-origin + CSRF verification, explicit allowlists, rate limits, confirmations, and MySQL audit records.
- Integration credentials stay in server-side environment variables and are never returned to the browser.

## Local Commands

- `npm ci`
- `npm run dev`
- `npm run build`
- `npm run typecheck`
- `DATABASE_URL=... npm run db:migrate`
- `npm run github:sync`

Do not commit real `.env` files or connection strings.

## Database

Migrations create authentication, GitHub cache, sync history, metric snapshots, and operation audit tables. `npm run db:migrate` applies every SQL migration in filename order.

## Required Environment

- `DATABASE_URL`
- `GITHUB_TOKEN`
- `AUTH_SECRET` (at least 32 bytes in production)
- `APP_ORIGIN` (exact public origin, for example `https://dev-ops.example.com`)
- `VPS_HOST`, `VPS_PORT`, `VPS_PASSWORD`
- `VPS_HOST_FINGERPRINTS` (comma-separated SHA-256 hex host-key digests)
- Optional: `VPS_USER` (defaults to `ubuntu`), `VPS_NAME`, `DOCKER_ACTION_ALLOWLIST`

## Deployment

The GitHub workflow builds an immutable release, installs production dependencies inside that release, applies migrations, switches the `current` symlink atomically, and performs local plus public health checks. If the new service fails its local health check, the workflow restores the previous release.
# dev-ops
