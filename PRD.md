# PRD DevOps Operations Dashboard

## 0. Document Control And Evidence

| Item | Detail |
| --- | --- |
| Version | 1.0 |
| Date | 2026-07-10 |
| Author | OpenCode agent |
| Primary VM audited | `43.133.155.252` |
| Audit mode | Read-only SSH inspection, no restart/deploy/migration, no secret reads |
| Visual references | `ref.jpg`, `ref2.jpg` |
| Local context used | Obsidian VM inventory and freelance VPS server note |
| External references used | Docker official docs via Context7, GitHub official docs via Context7 |
| GitHub discovery used | Public/private repository search for known owners available to the authenticated GitHub integration |

Evidence captured in this PRD must be treated as a product baseline, not as permanent truth. The dashboard implementation must re-validate live state through the VM agent and integrations.

## 1. Ringkasan Produk

**Nama kerja:** DevOps Operations Dashboard  
**Target utama:** satu website untuk memonitor dan mengelola VM/VPS, domain, project, Docker, GitHub repository, CI/CD, deployment, logs, service runtime, database, alert, dan runbook operasional.  
**Referensi visual:** `ref.jpg` dan `ref2.jpg`, dengan arah visual **dark tactical telemetry dashboard** yang lebih matang, lebih rapi, dan lebih siap dipakai harian.

Produk ini dibuat untuk kebutuhan operasional personal/freelance di VPS `43.133.155.252`, tetapi arsitekturnya harus siap diperluas menjadi multi-VM dan multi-project.

## 2. Latar Belakang

Saat ini server `43.133.155.252` dipakai untuk beberapa project freelance dan personal. Informasi server, domain, runtime, service, Docker, GitHub repo, CI/CD, logs, dan backup tersebar di beberapa tempat. Akibatnya, setiap debugging atau deploy butuh membuka banyak sumber: SSH, Nginx config, GitHub, service manager, logs, Docker, database, dan catatan manual.

Dashboard ini harus menjadi **single control plane** untuk:

- Melihat kondisi VM secara real-time.
- Mengetahui project apa yang berjalan di VM.
- Melihat domain mana mengarah ke project mana.
- Memantau SSL, DNS, HTTP status, latency, dan uptime.
- Memantau Docker, container, image, volume, network, dan compose stack.
- Memantau GitHub repo, workflow run, job, deployment, artifact, dan status checks.
- Membaca logs lintas sumber tanpa harus SSH manual.
- Menerima alert dan mengelola incident.
- Menjalankan action operasional yang aman, diaudit, dan bisa dibatasi role.

## 3. Baseline VM Saat Ini

Audit read-only dilakukan terhadap host `43.133.155.252` dengan user `ubuntu` tanpa membaca secret, `.env`, password, private key, atau token.

### 3.1 Identitas Server

| Item | Nilai |
| --- | --- |
| Host/IP | `43.133.155.252` |
| SSH user | `ubuntu` |
| SSH port | `22` |
| Hostname | `VM-0-5-ubuntu` |
| OS | Ubuntu 24.04.4 LTS |
| Kernel | `6.8.0-134-generic` |
| Uptime saat audit | 3 hari 1 jam lebih |
| Load average saat audit | `0.38`, `0.14`, `0.10` |

### 3.2 Resource Saat Audit

| Resource | Kondisi |
| --- | --- |
| RAM total | 1.9 GiB |
| RAM used | 967 MiB |
| RAM available | 967 MiB |
| RAM free langsung | 78 MiB |
| Swap total | 1.9 GiB |
| Swap used | 835 MiB |
| Disk root | 40 GiB |
| Disk used | 23 GiB |
| Disk available | 15 GiB |
| Disk usage | 61% |

Catatan produk: RAM server relatif kecil dan swap sudah cukup aktif. Stack monitoring harus ringan, sampling harus terkontrol, dan fitur real-time tidak boleh membuat beban server naik signifikan.

### 3.3 Service Aktif

| Service | Status |
| --- | --- |
| `nginx` | active |
| `php8.3-fpm` | active |
| `mysql` | active |
| `supervisor` | active |
| `cron` | active |
| `docker` | active |

### 3.4 User Systemd Service Aktif

| Service | Fungsi |
| --- | --- |
| `taka-fintrack.service` | Menjalankan Taka FinTrack Next.js di port `3001` |
| `9router.service` | Local AI gateway/router di port `20128` |
| `hermes-gateway.service` | Hermes Agent Gateway |
| `server-monitoring.service` | Monitoring dashboard ringan yang sudah ada |
| `dbus.service` | D-Bus user session |

### 3.5 Docker Saat Audit

| Item | Nilai |
| --- | --- |
| Docker version | `29.6.1` |
| Docker service | active |
| Running containers | 0 container |

Catatan produk: Docker sudah siap di VM, tetapi belum ada container berjalan. Fitur Docker harus dimulai dari inventory, health, dan governance sebelum action start/stop/restart/pull/prune diaktifkan.

### 3.6 Mapping Project Dan Domain Yang Sudah Tercatat

| Project/domain | Runtime | Target/deploy path |
| --- | --- | --- |
| `apsone.web.id`, `apsone.app` | Laravel, PHP 8.3-FPM | `/home/ubuntu/project-work-uaps/public` |
| `sips-alhaq.studify.web.id` | Laravel, PHP 8.3-FPM | `/home/ubuntu/sips/public` |
| `olshop-onigiri.studify.web.id` | Laravel, PHP 8.3-FPM | `/home/ubuntu/onigiri-online-shop/public` |
| `takahashiumaru.my.id` | Next.js 14.2.35 | proxy `127.0.0.1:3001`, cwd `/home/ubuntu/taka-fintrack` |
| `takahashiumaru.web.id` | 9router Next.js 16.2.1 | proxy `127.0.0.1:20128` |
| `monitor.takahashiumaru.web.id` | Node app | proxy `127.0.0.1:3002`, cwd belum final |
| `hermes.takahashiumaru.my.id` | Hermes/server monitoring | proxy `127.0.0.1:9119` |

### 3.7 Data Kurang Yang Harus Diselesaikan Oleh Dashboard

| Gap | Dampak |
| --- | --- |
| AP3 SIAPS / `myapsone.com` belum terlihat di Nginx enabled saat audit sebelumnya | Status production tidak jelas |
| UAPS Stock belum punya domain dan deploy path terverifikasi | Tidak bisa dimonitor penuh |
| Project personal selain `taka-fintrack` belum jelas production deploy-nya | Tidak bisa dibuat service health otomatis |
| Laravel scheduler belum ditemukan aktif | Risiko task terjadwal tidak jalan |
| Laravel queue worker belum ditemukan aktif | Risiko job async tidak jalan |
| Backup database aktif belum lengkap dipetakan | Risiko recovery lemah |
| CWD untuk `monitor.takahashiumaru.web.id` belum dipetakan final | Perlu discovery agent |

## 4. Repository GitHub Awal Yang Relevan

GitHub repository yang terdeteksi dan relevan sebagai kandidat monitoring awal:

| Repo | Area | Catatan |
| --- | --- | --- |
| `takahashiumaru/project-work-uaps` | Freelance | APS One |
| `apsonemailserver-cloud/apsone` | Freelance | AP3 SIAPS |
| `takahashiumaru/sips` | Freelance | SIPS Alhaq |
| `takahashiumaru/onigiri-online-shop` | Freelance | Onigiri Online Shop |
| `takahashiumaru/taka-fintrack` | Personal | Aktif di VM |
| `takahashiumaru/taka-pos` | Personal | Deploy belum terlihat aktif |
| `takahashiumaru/taka-school` | Personal | Deploy belum terlihat aktif |
| `takahashiumaru/taka-photobooth` | Personal | Deploy belum terlihat aktif |
| `takahashiumaru/taka-ticket` | Personal | Deploy belum terlihat aktif |
| `takahashiumaru/taka-prd` | Personal | Deploy belum terlihat aktif |

Dashboard harus bisa menambah repo lain secara manual dan lewat GitHub account sync.

## 5. Visi Produk

Membuat dashboard DevOps yang terasa seperti **mission control**: cepat dibaca, sangat teknis, real-time, aman untuk production, dan bisa dipakai sebagai pusat keputusan saat deploy, debugging, incident, dan maintenance.

Prinsip utama:

- **Read-only first:** semua integrasi awal harus aman dan observasional.
- **Action with guardrails:** action seperti restart service, restart container, trigger deployment, dan rollback harus memakai role, konfirmasi, audit log, dan opsi dry-run bila memungkinkan.
- **No secret exposure:** nilai `.env`, token, password, private key, cookie, dan authorization header tidak boleh tampil di UI/log/export.
- **Inventory is product:** mapping VM, domain, repo, deploy path, service, Docker, dan database adalah fitur inti, bukan dokumentasi tambahan.
- **Fast first screen:** user harus tahu kondisi server dalam 5 detik pertama.

## 6. Target User

| Persona | Kebutuhan |
| --- | --- |
| Owner/Developer | Melihat semua project, VM, domain, CI/CD, dan logs dalam satu dashboard |
| DevOps Operator | Menangani alert, restart service/container, cek deployment, rollback |
| Viewer/Client Internal | Melihat status uptime, domain, deployment, dan incident tanpa akses action berbahaya |
| Future AI Agent | Membaca inventory dan menjalankan runbook aman berdasarkan permission |

## 7. Goals Dan Non-Goals

### 7.1 Goals

- Dashboard VM/VPS real-time untuk host `43.133.155.252`.
- Monitoring multi-project dan multi-domain.
- GitHub integration untuk repo, workflow runs, jobs, checks, deployments, artifacts, dan webhook events.
- Docker integration untuk containers, images, volumes, networks, compose projects, logs, stats, dan health.
- CI/CD dashboard dengan status pipeline, deploy history, rollback notes, dan failed build triage.
- Project inventory yang menghubungkan repo, domain, deploy path, runtime, database, service, logs, backup, dan owner.
- Alert system dengan severity, acknowledgement, resolution, dan notification channel.
- Log stream lintas sumber: Nginx, PHP-FPM, Laravel, Node/systemd, Docker, MySQL, Cron, Supervisor.
- UI premium dark telemetry seperti referensi, tetapi lebih konsisten dan responsive.
- Role-based access control dan audit log untuk setiap action.

### 7.2 Non-Goals MVP

- Menjadi full Kubernetes platform.
- Menjadi replacement penuh Grafana/Prometheus untuk organisasi besar.
- Menyimpan atau menampilkan secret mentah.
- Memberi shell bebas di browser tanpa sandbox dan audit.
- Auto-fix production tanpa approval manusia.

## 8. Product Principles

| Prinsip | Implementasi |
| --- | --- |
| Operational truth | Data berasal dari VM, Docker, GitHub, Nginx, systemd, dan checks aktual |
| Safety by default | Read-only mode menjadi default semua integrasi |
| Action clarity | Setiap action menjelaskan target, risiko, command, dan rollback |
| Traceability | Semua perubahan memiliki audit log |
| Low overhead | Agent dan polling tidak boleh membebani VPS kecil |
| Fast triage | Issue, degraded service, failed CI, dan expired SSL tampil di halaman utama |
| Redaction | Secret/log sensitif disensor otomatis sebelum tampil atau diekspor |

## 9. Informasi Arsitektur Tingkat Tinggi

### 9.1 Komponen

| Komponen | Fungsi |
| --- | --- |
| Web Dashboard | UI utama untuk monitoring dan action |
| Backend API | Auth, RBAC, inventory, metrics aggregation, GitHub sync, alert engine |
| VM Agent | Mengambil metrics, service status, Docker state, logs, Nginx map, runtime info |
| Metrics Store | Menyimpan time-series ringan dan snapshot terbaru |
| App Database | Menyimpan user, project, domain, repo, integration, alert, audit, runbook |
| Event Bus | Menyalurkan log/event real-time ke UI dan alert engine |
| GitHub Webhook Receiver | Menerima workflow/deployment/push/check events |
| Notification Worker | Mengirim alert ke Telegram/email/Slack/Discord sesuai konfigurasi |

### 9.2 Rekomendasi Stack MVP

| Layer | Rekomendasi |
| --- | --- |
| Frontend | Next.js/React + Tailwind CSS + custom industrial telemetry component system |
| Backend | TypeScript API service dengan WebSocket/SSE untuk live events |
| Agent | Go atau Node.js service ringan, berjalan sebagai `systemd` service |
| Database | MySQL yang sudah tersedia untuk metadata dan event ringkas |
| Metrics | MVP: downsampled metrics di MySQL; Phase lanjut: Prometheus/VictoriaMetrics compatible exporter |
| Realtime | Server-Sent Events untuk MVP, WebSocket untuk action/live terminal terbatas |
| Deploy | Nginx reverse proxy + systemd service, Docker optional phase lanjut |

Catatan: jika memilih Next.js versi baru yang butuh Node lebih tinggi, VM harus di-upgrade ke Node LTS yang sesuai. VM saat audit memakai Node `v18.19.1`, sehingga keputusan framework/runtime harus dicek sebelum implementasi.

### 9.3 Agent Architecture

Agent adalah komponen penting karena dashboard tidak boleh langsung membuka Docker socket, systemd, atau file log dari public web process tanpa pembatasan.

Agent bertugas:

- Mengirim heartbeat.
- Mengumpulkan CPU, RAM, swap, disk, network, process, uptime.
- Mengambil status service systemd dan user systemd.
- Mengambil Docker inventory via Docker Engine API atau Docker SDK.
- Mengambil container stats, logs, health, image, volume, network.
- Membaca Nginx site mapping secara read-only.
- Membaca log file yang di-allowlist.
- Menjalankan command action yang di-allowlist dengan audit.
- Redact secret sebelum data dikirim ke backend.

Agent tidak boleh:

- Mengekspos Docker socket ke internet.
- Menjalankan command arbitrary shell di MVP.
- Membaca nilai `.env` secara penuh.
- Mengirim private key, token, atau password ke backend.

## 10. Modul Produk

### 10.1 Command Center Overview

Halaman utama yang menjawab: “server aman atau ada masalah?”

Fitur:

- Global infrastructure health score.
- Current VM load, CPU, RAM, swap, disk, network, uptime.
- Active alerts count.
- Failed CI/CD count.
- Degraded domain count.
- Docker container status summary.
- Service health summary: Nginx, PHP-FPM, MySQL, Docker, Supervisor, Cron, user services.
- Real-time event feed.
- Active project table dengan status, domain, repo, runtime, deploy path, last deploy, last CI.
- Quick filters: `critical`, `warning`, `deploying`, `offline`, `docker`, `domain`, `ci-cd`.

Acceptance criteria:

- User bisa melihat status VM, service utama, domain, Docker, dan CI/CD dari satu layar.
- Data critical harus muncul tanpa scroll desktop.
- Data refresh otomatis tanpa reload manual.
- Bila agent offline, UI menampilkan stale state dan timestamp terakhir.

### 10.2 VM Monitoring

Fitur:

- Host profile: hostname, IP, OS, kernel, uptime, timezone.
- CPU usage, load average, process top consumers.
- Memory, swap, cache, pressure trend.
- Disk usage per mount, inode usage, growth trend.
- Network throughput, connection count, open ports allowlist.
- Service status untuk Nginx, PHP-FPM, MySQL, Docker, Supervisor, Cron.
- User systemd service status.
- Package update awareness sebagai read-only warning.
- Reboot required flag bila tersedia.

Threshold awal untuk VM `43.133.155.252`:

| Metric | Warning | Critical |
| --- | --- | --- |
| Disk root | `>=75%` | `>=85%` |
| RAM available | `<=20%` | `<=10%` |
| Swap usage | `>=40%` | `>=70%` |
| Load average 5m | `> CPU core count x 1.5` | `> CPU core count x 2.5` |
| Service down | immediate warning | critical untuk Nginx/MySQL/Docker |
| Agent stale | `>2m` | `>10m` |

### 10.3 Project Inventory

Setiap project harus punya satu halaman detail yang menggabungkan semua resource terkait.

Data project:

- Nama project.
- Area: freelance, personal, company, experimental.
- Repo GitHub.
- Default branch.
- Runtime: Laravel, Next.js, Node, Go, Docker, static, lainnya.
- Deploy path.
- Domain/subdomain.
- Nginx config path.
- Reverse proxy target atau public root.
- Service manager: systemd, supervisor, PM2, Docker Compose, cron-only.
- Database terkait.
- Log sources.
- Backup strategy.
- CI/CD workflows.
- Last deploy.
- Owner dan status production.

Project awal yang harus dibuat seed:

- APS One.
- AP3 SIAPS.
- SIPS Alhaq.
- Onigiri Online Shop.
- Taka FinTrack.
- Taka POS.
- Taka School.
- Taka Photobooth.
- Taka Ticket.
- Taka PRD.

Acceptance criteria:

- Satu project detail bisa menunjukkan domain, repo, runtime, service, logs, deployment, CI/CD, dan Docker terkait.
- Project dengan data kurang harus diberi badge `UNMAPPED`, bukan dianggap sehat.
- Dashboard bisa membedakan project production aktif dan repo yang belum deploy.

### 10.4 Domain, DNS, SSL, Dan HTTP Monitoring

Fitur:

- Domain inventory.
- DNS A/AAAA/CNAME target check.
- HTTP/HTTPS status check.
- Redirect chain viewer.
- SSL issuer, valid from, expires at, days remaining.
- Certificate renewal alert.
- Latency p50/p95.
- Uptime check history.
- Nginx mapping: `server_name`, `root`, `proxy_pass`, SSL config presence.
- Domain to project link.
- External check location optional.

Domains awal:

- `apsone.web.id`
- `apsone.app`
- `myapsone.com`
- `sips-alhaq.studify.web.id`
- `olshop-onigiri.studify.web.id`
- `takahashiumaru.my.id`
- `takahashiumaru.web.id`
- `monitor.takahashiumaru.web.id`
- `hermes.takahashiumaru.my.id`

Alert default:

- SSL expires in `<=14` days: warning.
- SSL expires in `<=3` days: critical.
- HTTP 5xx for `>=2` checks: critical.
- DNS target mismatch: warning.
- Domain unmapped to project: warning.

### 10.5 Docker Monitoring Dan Management

Docker adalah modul utama karena VM sudah punya Docker `29.6.1` aktif.

Fitur read-only MVP:

- Docker engine status.
- Docker version.
- Container list: running, exited, paused, restarting, unhealthy.
- Container detail: image, command, created, started, ports, mounts, labels, env keys only, healthcheck.
- Container stats: CPU, memory, network I/O, block I/O, PIDs.
- Container logs dengan filter time range dan keyword.
- Images list: repository, tag, image ID, size, created, dangling flag.
- Volumes list: name, driver, mountpoint, attached containers.
- Networks list: name, driver, subnet, gateway, connected containers.
- Compose project detection via labels.
- Docker system disk usage.
- Event stream: create, start, stop, die, health_status, pull, remove.

Fitur action P1:

- Start container.
- Stop container.
- Restart container.
- View last logs.
- Pull image.
- Recreate compose service.
- Prune dangling images dengan confirmation dan dry-run.

Fitur action P2:

- Deploy Docker Compose stack dari repo.
- Edit environment references lewat secret manager, bukan nilai plaintext.
- Rollback image tag.
- Container shell terbatas, disabled by default.

Safety Docker:

- Docker socket tidak boleh diekspos langsung ke public web app.
- Semua action harus lewat agent allowlist.
- Setiap action wajib punya audit log: actor, target, requested action, command template, timestamp, result, duration, exit code.
- Action destructive seperti remove volume, prune volume, dan remove image yang masih dipakai harus disabled di MVP.

Docker API basis:

- Container list dapat diambil lewat Docker Engine API `/containers/json`.
- Image list lewat `/images/json`.
- Volume list lewat Docker volumes endpoint.
- Network list lewat Docker networks endpoint.
- Logs dan stats mengikuti Docker Engine API/SDK atau Docker CLI fallback lewat agent.

### 10.6 GitHub Dan CI/CD

Dashboard harus memonitor GitHub sebagai sumber kebenaran repo dan CI/CD.

Fitur GitHub:

- Connect GitHub account/org menggunakan fine-grained token atau GitHub App.
- Repository sync.
- Branch list dan default branch.
- Latest commit, author, message, timestamp.
- Pull request summary.
- Workflow list.
- Workflow run list.
- Workflow jobs detail.
- Failed job log link/download metadata.
- Artifacts metadata.
- Deployments dan environments.
- Status checks dan commit statuses.
- Webhook event ingestion untuk push, workflow_run, check_suite, deployment, release.
- Manual workflow dispatch untuk role tertentu.
- Failed webhook redelivery status.

CI/CD views:

- Pipeline board per repo.
- Repo-to-project mapping.
- Last successful build.
- Last failed build.
- Deploy target environment.
- Deployment duration.
- Release notes.
- Rollback candidate.
- Secrets/config missing checklist, tanpa menampilkan nilai secret.

GitHub API basis:

- Workflow jobs dapat dibaca lewat endpoint `GET /repos/{owner}/{repo}/actions/runs/{run_id}/jobs`.
- Workflow runs, deployments, checks, artifacts, dan webhooks menjadi sumber data CI/CD.
- Semua webhook harus diverifikasi menggunakan signature secret.

Acceptance criteria:

- User bisa melihat pipeline gagal tanpa membuka GitHub.
- User bisa membuka job detail dan log metadata dari dashboard.
- Dashboard bisa menandai project yang repo-nya tidak punya CI/CD.
- Dashboard bisa membedakan failed build, failed deploy, dan service runtime down.

### 10.7 Deployment Control Plane

Fitur:

- Deploy history per project.
- Source: manual, GitHub Actions, webhook, local command, Docker deploy.
- Environment: production, staging, preview.
- Revision: commit SHA, branch, tag, image tag.
- Actor.
- Status: pending, building, deploying, success, failed, rolled_back.
- Deployment logs.
- Rollback notes.
- Post-deploy checks: HTTP status, service active, domain reachable, migration status if available.

Action P1:

- Trigger GitHub Actions workflow dispatch.
- Restart service yang terkait project.
- Pull latest dan build hanya jika project sudah punya runbook aman.

Action P2:

- Blue/green deployment untuk Docker project.
- One-click rollback ke previous successful deployment.
- Maintenance mode for Laravel project.

Safety:

- Semua deploy action disabled sampai runbook per project lengkap.
- Dashboard harus menampilkan command preview tanpa secret.
- Action harus punya confirmation phrase untuk production.

### 10.8 Logs Dan Real-Time Events

Log sources MVP:

- Nginx access log.
- Nginx error log.
- PHP-FPM log.
- Laravel `storage/logs`.
- Node/systemd journal untuk user services.
- Docker container logs.
- MySQL service log metadata jika aman.
- Cron log atau journal.
- Supervisor log metadata.

Fitur:

- Real-time log stream.
- Filter by project, domain, service, severity, keyword, time range.
- Correlation ID bila tersedia.
- Redaction otomatis untuk token/password/secret/API key.
- Log export dengan role check.
- Saved search.
- Error grouping.
- Timeline event per incident.

UI detail seperti referensi:

- Panel kanan `REAL-TIME EVENTS`.
- Event cards dengan severity badge: `CRITICAL`, `WARNING`, `INFO`, `DEPLOYING`, `RESOLVED`.
- Expandable JSON/code block untuk detail error.
- Quick controls: pause stream, filter, export.

### 10.9 Alerts Dan Incident Management

Fitur:

- Alert rules builder.
- Default alert rules dari VM, service, Docker, domain, SSL, GitHub, deployment, database.
- Severity: info, warning, high, critical.
- Alert lifecycle: open, acknowledged, investigating, resolved, muted.
- Assignment.
- Timeline comments.
- Related resources.
- Notification channels.
- Maintenance window.
- Alert deduplication.
- Alert silence/mute per project/domain/service.

Default rules:

- Nginx down.
- MySQL down.
- Docker down.
- Disk root above threshold.
- Swap above threshold.
- Domain 5xx.
- SSL near expiry.
- GitHub workflow failed on default branch.
- Docker container unhealthy.
- User systemd service failed.
- Agent stale.
- Backup stale.

### 10.10 Database Monitoring

MVP fokus ke MySQL service health tanpa membuka data aplikasi sensitif.

Fitur:

- MySQL service status.
- Uptime.
- Connection count.
- Slow query count jika tersedia.
- Database size per schema.
- Table size top N.
- Backup freshness.
- Error count.
- Read-only query panel untuk user tertentu, disabled by default.

Safety:

- Tidak menampilkan connection string.
- Tidak menyimpan password database plaintext.
- Query panel harus read-only dan punya timeout.
- Export data aplikasi disabled by default.

### 10.11 Backup Dan Recovery

Fitur:

- Backup inventory per project.
- Backup schedule.
- Last successful backup.
- Backup size.
- Backup storage location label, bukan credential.
- Restore runbook.
- Backup stale alert.
- Dry-run restore checklist.

Kebutuhan awal VM:

- Verifikasi backup APS yang saat ini tercatat ada tetapi cron-nya dikomentari/nonaktif.
- Tambahkan backup strategy untuk SIPS, Onigiri, dan project personal yang memakai MySQL.
- Tampilkan status `NO ACTIVE BACKUP` sampai bukti backup aktif tersedia.

### 10.12 Runbook Dan Action Center

Runbook adalah cara dashboard menjalankan tindakan operasional dengan aman.

Jenis runbook:

- Restart Nginx.
- Reload Nginx.
- Restart project systemd service.
- Restart Docker container.
- Clear Laravel cache.
- Enter Laravel maintenance mode.
- Exit Laravel maintenance mode.
- Pull and build project.
- Rollback deploy.
- Check certificate renewal.
- Check database backup.

Runbook fields:

- Name.
- Target resource type.
- Preconditions.
- Command template.
- Required role.
- Risk level.
- Dry-run support.
- Confirmation phrase.
- Expected output.
- Rollback steps.
- Audit metadata.

MVP rule:

- Runbook yang mengubah production harus dibuat disabled sampai diverifikasi manual.

### 10.13 Global Search Dan Command Palette

Fitur:

- Search servers, IPs, domains, projects, repos, workflow runs, logs, alerts, containers.
- Keyboard shortcut: `Cmd+K` / `Ctrl+K`.
- Filter syntax:
  - `type:domain status:down`
  - `repo:taka-fintrack ci:failed`
  - `service:nginx status:active`
  - `docker:container status:unhealthy`
  - `severity:critical`
- Command palette only shows actions allowed by role.

### 10.14 Notifications

Notification channels:

- Telegram.
- Email SMTP.
- Slack/Discord optional.
- Webhook custom.
- Browser push optional.

Notification requirements:

- Per severity routing.
- Quiet hours.
- Maintenance windows.
- Repeat interval.
- Alert resolved notification.
- Include direct dashboard link.
- Redact sensitive details.

### 10.15 AI/MCP-Compatible Operations Layer

Dashboard harus siap diintegrasikan dengan AI agent atau MCP-compatible tooling tanpa menjadikan agent sebagai sumber kebenaran tunggal.

Use case:

- Agent membaca project inventory.
- Agent membaca alert dan logs yang sudah direduksi/redacted.
- Agent menyarankan runbook.
- Agent menjalankan action hanya jika role/token mengizinkan.
- Agent membuat incident summary.
- Agent membuat postmortem draft.

Integrasi yang disiapkan:

- GitHub connector.
- MySQL read-only connector.
- Telegram notification connector.
- ClickUp/task connector optional.
- Browser/Lighthouse check connector optional.
- SSH/VM agent connector.

Guardrail:

- Agent tidak boleh melihat secret.
- Agent tidak boleh menjalankan destructive action tanpa explicit approval dan audit.
- Agent output harus menyertakan evidence link dari dashboard.

## 11. Information Architecture

### 11.1 Sidebar Navigation

Struktur sidebar mengikuti referensi, tetapi disesuaikan untuk DevOps dashboard.

**Main**

- Overview
- Issues
- Performance
- Alerts

**Observability**

- Metrics
- Log Stream
- Real-Time Events
- Traces

**Infrastructure**

- Compute / VM
- Docker
- Databases
- Network
- Domains & SSL

**Delivery**

- GitHub
- CI/CD
- Deployments
- Releases

**Projects**

- Inventory
- Environments
- Backups
- Runbooks

**Admin**

- Users & Roles
- Integrations
- Audit Logs
- Settings

### 11.2 Main Pages

| Page | Tujuan |
| --- | --- |
| Overview | Health ringkasan semua resource |
| Issues | Semua alert dan incident aktif |
| VM Detail | Metrics dan service host |
| Docker | Container/image/volume/network/compose |
| Project Detail | Domain, repo, deploy, logs, service, backup |
| Domain Detail | DNS, SSL, uptime, HTTP checks |
| CI/CD | Workflow runs, jobs, deployments |
| Logs | Log search dan stream |
| Runbooks | Action operational yang aman |
| Audit Logs | Jejak semua action dan access |

## 12. UI/UX Direction

### 12.1 Design Read

Dashboard dibaca sebagai **DevOps mission-control app untuk technical operator**, dengan bahasa visual **tactical telemetry / industrial brutalist**, dark, data-dense, sharp, dan real-time.

### 12.2 Visual DNA Dari Referensi

Elemen yang harus dipertahankan:

- Dark cockpit layout.
- Sidebar kiri dengan grouping jelas.
- Top search bar dengan command shortcut.
- Metric cards dengan icon kecil dan trend.
- Table active instances/project.
- Status badge berwarna.
- Real-time event panel kanan.
- Border tipis dan frame teknis.
- Monospace labels.
- Export logs button.
- Time range switcher: 1H, 24H, 1W, 1M.
- JSON/log block expandable.

Elemen yang harus ditingkatkan:

- Lebih responsive untuk laptop kecil dan mobile.
- Hierarchy lebih jelas untuk critical state.
- Table density bisa diatur: compact, comfortable.
- Empty state dan loading state lebih premium.
- Command palette lebih kuat.
- Status semantic lebih konsisten.
- Tidak terlalu ramai pada first screen.
- Accessibility contrast harus lulus minimal WCAG AA.

### 12.3 Design Tokens

| Token | Nilai awal |
| --- | --- |
| Background | `#090A0B` |
| Panel | `#111214` |
| Panel raised | `#17181A` |
| Border | `#2A2C30` |
| Border strong | `#3A3D42` |
| Text primary | `#F2F2EE` |
| Text secondary | `#A6A6A0` |
| Text muted | `#6F706B` |
| Accent primary | industrial amber `#FF8A1C` |
| Critical | `#FF4545` |
| Warning | `#F6B73C` |
| Success | `#2FD17C` |
| Info/deploying | `#4D8DFF` |
| Radius | `0px` atau maksimum `2px` untuk micro-control |
| Border width | `1px` default |
| Font data | `JetBrains Mono` atau `IBM Plex Mono` |
| Font heading | `Archivo`, `Geist`, atau `IBM Plex Sans Condensed` |

### 12.4 Component Style

- Square panels, no soft SaaS rounded cards.
- Visible grid lines.
- High-density tables with sticky header.
- Data numbers use monospace.
- Labels uppercase, tight but readable.
- Buttons have strong contrast and clear state.
- Critical alerts use red sparingly but strongly.
- Background may use subtle scanline/noise texture, but must not hurt readability.
- No generic purple gradient.
- No glassmorphism-heavy cards.
- No excessive shadows.

### 12.5 Responsive Behavior

Desktop `>=1280px`:

- Sidebar fixed.
- Content grid 12 columns.
- Event panel right sticky.
- Tables full width.

Laptop `1024px-1279px`:

- Sidebar compact.
- Event panel can collapse into bottom drawer.
- Metric cards 2-3 columns.

Tablet `768px-1023px`:

- Sidebar becomes icon rail or drawer.
- Tables become horizontal scroll with sticky first column.
- Event panel below main content.

Mobile `<768px`:

- Bottom nav or hamburger drawer.
- Summary cards stack.
- Tables become resource cards.
- Logs use full-screen modal/drawer.
- Action buttons hidden behind safe menu.

### 12.6 Key UI States

Setiap module wajib punya:

- Loading skeleton sesuai layout final.
- Empty state yang menjelaskan cara menghubungkan data.
- Error state dengan retry dan diagnostic ID.
- Stale data state dengan last sync timestamp.
- Offline agent state.
- Permission denied state.
- Action pending/running/success/failed state.

## 13. Functional Requirements

### 13.1 P0 MVP Requirements

| ID | Requirement | Acceptance Criteria |
| --- | --- | --- |
| P0-001 | User bisa login aman | Auth aktif, session aman, logout berfungsi |
| P0-002 | Dashboard membaca VM baseline | CPU/RAM/disk/swap/service tampil dan auto refresh |
| P0-003 | Agent heartbeat | UI menampilkan online/stale/offline |
| P0-004 | Project inventory seed | Project awal tampil dengan status mapped/unmapped |
| P0-005 | Domain monitoring | HTTP status, SSL expiry, dan project link tampil |
| P0-006 | Docker read-only inventory | Engine, containers, images, volumes, networks tampil |
| P0-007 | GitHub repo sync | Repo relevan tampil dan bisa dipetakan ke project |
| P0-008 | CI/CD read-only | Workflow runs dan jobs tampil untuk repo yang punya GitHub Actions |
| P0-009 | Service monitoring | Nginx/PHP/MySQL/Docker/Cron/Supervisor/user services tampil |
| P0-010 | Log viewer basic | Log sources allowlist bisa dibaca dengan redaction |
| P0-011 | Alerts default | Alert critical/warning muncul untuk service down, SSL expiry, disk high |
| P0-012 | Audit log | Login, sync, dan semua action tercatat |
| P0-013 | UI responsive | Overview usable di desktop, laptop, tablet, mobile |

### 13.2 P1 Requirements

| ID | Requirement | Acceptance Criteria |
| --- | --- | --- |
| P1-001 | Docker actions guarded | Start/stop/restart container dengan RBAC dan audit |
| P1-002 | GitHub workflow dispatch | User role tertentu bisa trigger workflow |
| P1-003 | Deployment history | Last deploy dan deploy timeline tampil per project |
| P1-004 | Notifications | Telegram/email alert terkirim sesuai severity |
| P1-005 | Runbook engine | Runbook read-only dan safe action tersedia |
| P1-006 | Backup monitor | Backup freshness tampil per project |
| P1-007 | Log stream real-time | Event/log stream bisa pause/filter/export |
| P1-008 | Command palette | Search dan quick action via `Cmd+K` |
| P1-009 | Incident lifecycle | Alert bisa acknowledge, assign, resolve |

### 13.3 P2 Requirements

| ID | Requirement | Acceptance Criteria |
| --- | --- | --- |
| P2-001 | Multi-VM support | Tambah VM baru via agent enrollment |
| P2-002 | Docker Compose deploy | Compose stack deploy/rollback via runbook |
| P2-003 | Advanced metrics store | Prometheus/VictoriaMetrics-compatible backend |
| P2-004 | AI incident summary | Generate summary dengan evidence links |
| P2-005 | External uptime probes | Check dari lokasi eksternal |
| P2-006 | Release management | Release notes dan changelog otomatis dari GitHub |
| P2-007 | SLO/SLA dashboard | Error budget dan uptime per project/domain |

## 14. Non-Functional Requirements

### 14.1 Performance

- Overview initial load target: `<2.5s` on normal broadband.
- API p95 dashboard summary: `<500ms` from cached snapshot.
- Metrics refresh: `5s-15s` for live panels, `60s` for lower priority data.
- Log streaming must support pause and backpressure.
- Dashboard must avoid heavy polling when tab inactive.

### 14.2 Reliability

- Agent reconnect automatic.
- Backend must tolerate GitHub API rate limit.
- UI must display stale data instead of blank screen.
- Failed sync must create visible event.
- Alert engine must not duplicate same alert repeatedly.

### 14.3 Security

- RBAC: Owner, Admin, Operator, Viewer.
- GitHub integration should prefer GitHub App or fine-grained token.
- Token stored encrypted at rest.
- Webhook signature verification mandatory.
- Docker/socket action only via agent allowlist.
- SSH key/password never stored plaintext.
- `.env` values never displayed, only key names and presence status.
- Logs redacted before display/export.
- Every mutating action has audit log.
- Dangerous actions require confirmation and permission.

### 14.4 Accessibility

- WCAG AA contrast minimum.
- Keyboard navigation for sidebar, search, table, modals, command palette.
- Focus states visible.
- Screen reader labels for severity and metric changes.
- Reduced motion supported.

### 14.5 Observability For The Dashboard Itself

- Self health endpoint.
- Backend error logs.
- Agent status page.
- Sync job status.
- Queue/job status.
- Last successful GitHub sync.
- Last successful VM scrape.

## 15. Data Model Draft

### 15.1 Core Tables

| Table | Purpose |
| --- | --- |
| `users` | User dashboard |
| `roles` | Role definitions |
| `user_roles` | Mapping user-role |
| `audit_logs` | Semua access/action |
| `servers` | VM/VPS inventory |
| `server_metrics` | Sampled host metrics |
| `server_services` | Systemd/supervisor/cron service status |
| `projects` | Project inventory |
| `project_resources` | Link project ke domain, repo, service, Docker, database |
| `domains` | Domain inventory |
| `domain_checks` | HTTP/DNS/SSL checks |
| `ssl_certificates` | SSL metadata |
| `github_accounts` | GitHub connection metadata |
| `repositories` | Repo data |
| `workflow_runs` | GitHub Actions workflow runs |
| `workflow_jobs` | GitHub Actions jobs |
| `deployments` | Deployment history |
| `docker_containers` | Container inventory snapshot |
| `docker_images` | Image inventory |
| `docker_volumes` | Volume inventory |
| `docker_networks` | Network inventory |
| `docker_events` | Docker events |
| `log_sources` | Log source allowlist |
| `log_events` | Indexed log events/metadata |
| `alert_rules` | Rule definitions |
| `alert_events` | Alert instances |
| `incidents` | Incident container |
| `runbooks` | Runbook definitions |
| `action_requests` | Action execution records |
| `backups` | Backup inventory/status |
| `notification_channels` | Telegram/email/webhook configs |
| `integration_secrets` | Encrypted references only |

### 15.2 Resource Relationship

Satu project dapat memiliki:

- Banyak domain.
- Satu atau banyak repository.
- Satu atau banyak services.
- Satu atau banyak Docker containers.
- Satu atau banyak databases.
- Banyak deployments.
- Banyak log sources.
- Banyak alert rules.

## 16. API Contract Draft

### 16.1 Dashboard

- `GET /api/health`
- `GET /api/overview`
- `GET /api/events/realtime`
- `GET /api/search?q=`

### 16.2 Servers

- `GET /api/servers`
- `GET /api/servers/:id`
- `GET /api/servers/:id/metrics`
- `GET /api/servers/:id/services`
- `POST /api/servers/:id/sync`

### 16.3 Projects

- `GET /api/projects`
- `GET /api/projects/:id`
- `POST /api/projects`
- `PATCH /api/projects/:id`
- `GET /api/projects/:id/timeline`
- `GET /api/projects/:id/logs`

### 16.4 Domains

- `GET /api/domains`
- `GET /api/domains/:id`
- `POST /api/domains/:id/check`
- `GET /api/domains/:id/checks`

### 16.5 Docker

- `GET /api/docker/summary`
- `GET /api/docker/containers`
- `GET /api/docker/containers/:id`
- `GET /api/docker/containers/:id/stats`
- `GET /api/docker/containers/:id/logs`
- `POST /api/docker/containers/:id/start`
- `POST /api/docker/containers/:id/stop`
- `POST /api/docker/containers/:id/restart`
- `GET /api/docker/images`
- `GET /api/docker/volumes`
- `GET /api/docker/networks`

### 16.6 GitHub/CI-CD

- `GET /api/github/repos`
- `POST /api/github/sync`
- `GET /api/github/repos/:id/workflows`
- `GET /api/github/repos/:id/runs`
- `GET /api/github/runs/:runId/jobs`
- `POST /api/github/workflows/:workflowId/dispatch`
- `POST /api/github/webhooks`

### 16.7 Alerts And Actions

- `GET /api/alerts`
- `POST /api/alerts/:id/ack`
- `POST /api/alerts/:id/resolve`
- `GET /api/runbooks`
- `POST /api/runbooks/:id/execute`
- `GET /api/actions/:id`
- `GET /api/audit-logs`

## 17. Alert Matrix Awal

| Source | Condition | Severity |
| --- | --- | --- |
| VM | Agent offline >10m | Critical |
| VM | Disk root >=85% | Critical |
| VM | Disk root >=75% | Warning |
| VM | Swap usage >=70% | Critical |
| VM | Swap usage >=40% | Warning |
| Nginx | Service inactive | Critical |
| MySQL | Service inactive | Critical |
| Docker | Service inactive | High |
| PHP-FPM | Service inactive | High |
| Domain | HTTP 5xx repeated | Critical |
| Domain | SSL <=3 days | Critical |
| Domain | SSL <=14 days | Warning |
| GitHub | Default branch workflow failed | High |
| Docker | Container unhealthy | High |
| Docker | Container restart loop | Critical |
| Backup | Last backup stale | High |

## 18. Permission Model

| Role | Capabilities |
| --- | --- |
| Owner | Semua akses, manage integrations, manage roles, execute all runbooks |
| Admin | Manage projects, domains, alerts, runbooks non-destructive |
| Operator | View all, acknowledge alerts, execute approved safe actions |
| Viewer | Read-only dashboard, logs terbatas, no secret, no action |

Action risk levels:

- Level 0: read-only sync/check.
- Level 1: low-risk refresh/retry.
- Level 2: restart service/container.
- Level 3: deployment/rollback.
- Level 4: destructive action, disabled by default.

## 19. Implementation Phases

### Phase 0: Discovery And Foundation

- Finalisasi stack.
- Buat repo project.
- Setup auth dan RBAC basic.
- Setup database schema awal.
- Setup VM agent prototype read-only.
- Seed VM `43.133.155.252` dan project awal.
- Confirm Node/runtime target di VM.

Exit criteria:

- Dashboard bisa login.
- VM heartbeat tampil.
- Project inventory awal tampil.

### Phase 1: Read-Only Monitoring MVP

- Overview dashboard.
- VM metrics.
- Service status.
- Domain/SSL checks.
- Docker inventory read-only.
- GitHub repo sync.
- GitHub Actions workflow runs/jobs read-only.
- Basic alert rules.
- Audit logs.

Exit criteria:

- Bisa mengetahui VM sehat/tidak tanpa SSH.
- Bisa mengetahui CI/CD gagal tanpa buka GitHub.
- Bisa mengetahui domain/SSL bermasalah dari dashboard.

### Phase 2: Logs, Docker Detail, And Incident Flow

- Log sources allowlist.
- Real-time event panel.
- Docker stats/logs/events.
- Incident lifecycle.
- Notification channel Telegram/email.
- Backup monitoring.

Exit criteria:

- Debugging basic bisa dilakukan dari dashboard.
- Alert bisa diacknowledge dan resolve.

### Phase 3: Safe Actions And CI/CD Control

- Runbook engine.
- Docker start/stop/restart.
- Service restart approved list.
- GitHub workflow dispatch.
- Deployment history.
- Post-deploy checks.

Exit criteria:

- Operator bisa menjalankan action aman dengan audit penuh.

### Phase 4: Advanced Operations

- Multi-VM enrollment.
- Prometheus/VictoriaMetrics compatible metrics backend.
- Docker Compose deploy.
- Rollback workflows.
- AI incident summary.
- SLO/SLA reporting.

## 20. Testing Strategy

### 20.1 Unit Tests

- Metrics parser.
- Docker mapper.
- GitHub workflow mapper.
- Domain/SSL checker.
- Alert rule evaluator.
- Log redaction.
- RBAC permission checks.

### 20.2 Integration Tests

- Agent to backend heartbeat.
- GitHub webhook signature validation.
- Docker API mock.
- Domain check worker.
- Alert creation and deduplication.
- Notification delivery mock.

### 20.3 End-to-End Tests

- Login and overview load.
- View VM details.
- View Docker inventory.
- View GitHub workflow failure.
- Acknowledge and resolve alert.
- Search project/domain/repo.
- Permission denied for Viewer action.

### 20.4 Security Tests

- Secret redaction test with fake `.env` values.
- GitHub webhook invalid signature rejected.
- Viewer cannot execute action.
- Docker destructive action disabled.
- Audit log written for every action.

### 20.5 Visual QA

- Desktop 1440px.
- Laptop 1280px.
- Tablet 768px.
- Mobile 390px.
- Dark mode contrast.
- Reduced motion.
- Long table overflow.
- Empty/error/loading states.

## 21. Risks Dan Mitigation

| Risk | Mitigation |
| --- | --- |
| VPS resource kecil | Agent ringan, sampling rendah, cache snapshot, avoid heavy Prometheus in MVP |
| Docker socket root-level risk | Gunakan agent allowlist, jangan expose socket ke web |
| Secret leakage dari logs | Redaction sebelum tampil/export |
| GitHub API rate limit | Cache, webhook-first sync, backoff |
| Action salah target | Resource mapping jelas, confirmation, audit, dry-run |
| Data inventory belum lengkap | Badge `UNMAPPED`, discovery checklist, no false healthy state |
| Dashboard down saat incident | Self-health, simple fallback page, lightweight deploy |
| CI/CD action berbahaya | Role, environment protection, manual approval |

## 22. Open Questions

- Apakah dashboard ini akan menggantikan `server-monitoring.service` yang sudah ada, atau berjalan paralel dulu?
- Apakah target deploy dashboard tetap di `monitor.takahashiumaru.web.id`?
- Apakah database dashboard memakai MySQL di VM yang sama atau database terpisah?
- Apakah GitHub integration memakai GitHub App atau fine-grained PAT?
- Apakah notification utama mau Telegram, email, atau dua-duanya?
- Apakah action restart/deploy boleh tersedia di MVP, atau read-only dulu sampai semua runbook matang?

## 23. Success Metrics

| Metric | Target |
| --- | --- |
| Time to know VM status | <5 detik dari buka dashboard |
| Time to identify failed CI | <10 detik |
| Time to map domain to project | <10 detik |
| Manual SSH checks berkurang | >60% setelah Phase 2 |
| Secret leakage incident | 0 |
| False healthy unmapped project | 0 |
| Critical alert delivery | <60 detik dari detection |

## 24. MVP Definition Of Done

MVP dianggap selesai jika:

- User bisa login dan membuka Overview.
- VM `43.133.155.252` tampil dengan metrics dan service status aktual.
- Domain awal tampil dengan SSL dan HTTP status.
- Project awal tampil dengan mapped/unmapped state.
- Docker engine dan inventory tampil walaupun container kosong.
- GitHub repo awal tersinkron dan workflow run/job tampil bila tersedia.
- Alert default berjalan.
- Log viewer basic berjalan dengan redaction.
- UI mengikuti dark tactical telemetry reference dan responsive.
- Tidak ada secret yang tampil di UI, logs, export, atau audit.
- Semua mutating action disabled atau guarded sampai runbook siap.
