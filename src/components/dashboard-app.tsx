"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  ArrowClockwise,
  ArrowSquareOut,
  Bell,
  CaretLeft,
  CheckCircle,
  ClockCounterClockwise,
  Code,
  Cpu,
  Cube,
  Database,
  DesktopTower,
  FileText,
  Gear,
  GitBranch,
  GithubLogo,
  Globe,
  HardDrives,
  Info,
  List,
  ListMagnifyingGlass,
  MagnifyingGlass,
  Memory,
  Moon,
  Play,
  Power,
  Pulse,
  RocketLaunch,
  SignOut,
  SquaresFour,
  Stack,
  Stop,
  Sun,
  TerminalWindow,
  Warning,
  X,
  XCircle,
} from "@phosphor-icons/react";
import {
  deliveryWorkflowRepositories,
  deployments,
  navGroups,
  pageMeta,
  projects,
  serviceInventory,
  type ModuleName,
} from "@/lib/dashboard-data";

type InfrastructureAlert = {
  severity: "warning" | "critical";
  title: string;
  source: string;
  age: string;
  detail: string;
};

export type SessionUser = {
  id: number;
  name: string;
  email: string;
  role: "owner" | "admin" | "operator" | "viewer";
  status: string;
  actionToken: string;
};
type Project = {
  id: string;
  name: string;
  domain: string;
  state: "online" | "warning" | "critical";
  uptime: string;
  port: number;
};
type Repository = {
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
  pushed_at: string | null;
  synced_at: string;
};
type WorkflowRun = {
  id: number;
  github_id: number;
  full_name: string;
  workflow_name: string;
  event_name: string;
  branch: string | null;
  head_sha: string | null;
  run_number: number;
  status: string;
  conclusion: string | null;
  actor_login: string | null;
  html_url: string;
  started_at: string;
  completed_at: string | null;
};
type AuditEntry = {
  id: number;
  user_name: string;
  user_role: string;
  action_name: string;
  target_type: string;
  target_name: string;
  status: "running" | "scheduled" | "success" | "failed";
  message: string | null;
  started_at: string;
  finished_at: string | null;
};
type Sync = {
  status: string;
  items_synced: number;
  message: string | null;
  started_at: string;
  finished_at: string | null;
};
type DashboardData = {
  repositories: Array<{
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
    pushed_at: string | null;
    synced_at: string;
  }>;
  workflowRuns: WorkflowRun[];
  syncs: Sync[];
  metricHistory: Array<{
    cpu_percent: number | null;
    memory_percent: number | null;
    swap_percent: number | null;
    disk_percent: number | null;
    load_1m: number | null;
    captured_at: string;
  }>;
  auditLog: AuditEntry[];
  source: string;
  fetchedAt: string;
};

type OperationRequest = {
  endpoint: "/api/operations/action" | "/api/github/runs/rerun";
  title: string;
  description: string;
  target: string;
  action: string;
  body: Record<string, unknown>;
  confirmationText?: string;
  buttonLabel?: string;
  danger?: boolean;
};
type LiveData = {
  hostname: string;
  os: string;
  kernel: string;
  uptime: string;
  load: number[];
  cpuPercent: number;
  cores: number;
  memory: { total: number; used: number; available: number; percent: number };
  swap: { total: number; used: number; percent: number };
  disk: { total: number; used: number; available: number; percent: number };
  services: Array<{ name: string; status: string }>;
  docker: { version: string; containers: Array<Record<string, string>> };
  checkedAt: string;
};

const icons: Record<ModuleName, typeof SquaresFour> = {
  Overview: SquaresFour,
  Servers: DesktopTower,
  Services: Pulse,
  Projects: Stack,
  Docker: Cube,
  Logs: TerminalWindow,
  "CI/CD": GitBranch,
  Deployments: RocketLaunch,
  Alerts: Warning,
  Settings: Gear,
};

function Badge({
  tone,
  children,
}: {
  tone: string;
  children: React.ReactNode;
}) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

function projectTone(state: string) {
  if (state === "online") return "success";
  if (state === "critical") return "danger";
  return "warning";
}

function formatBytes(value = 0) {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(
    Math.floor(Math.log(value) / Math.log(1024)),
    units.length - 1,
  );
  return `${(value / 1024 ** index).toFixed(index > 2 ? 1 : 0)} ${units[index]}`;
}

function formatBytesCompact(value = 0) {
  if (!Number.isFinite(value) || value <= 0) return "0B";
  const units = ["B", "K", "M", "G", "T"];
  const index = Math.min(
    Math.floor(Math.log(value) / Math.log(1024)),
    units.length - 1,
  );
  const num = value / 1024 ** index;
  const formatted = num % 1 === 0 || index < 2 ? num.toFixed(0) : num.toFixed(1);
  return `${formatted}${units[index]}`;
}

function timeAgo(value?: string | null) {
  if (!value) return "Belum ada";
  const seconds = Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / 1000),
  );
  if (seconds < 60) return `${seconds} dtk lalu`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} mnt lalu`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} jam lalu`;
  return `${Math.floor(seconds / 86400)} hari lalu`;
}

function ResourceBar({
  label,
  value,
  detail,
  tone = "green",
}: {
  label: string;
  value: number;
  detail: string;
  tone?: string;
}) {
  const safe = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));
  return (
    <div className="resource-meter">
      <div>
        <span>{label}</span>
        <strong>{safe.toFixed(1)}%</strong>
      </div>
      <div className="meter-track">
        <span className={`meter-fill ${tone}`} style={{ width: `${safe}%` }} />
      </div>
      <small>{detail}</small>
    </div>
  );
}

function EmptyState({
  icon: Icon = ListMagnifyingGlass,
  title,
  detail,
}: {
  icon?: typeof ListMagnifyingGlass;
  title: string;
  detail: string;
}) {
  return (
    <div className="empty-state">
      <Icon size={24} />
      <strong>{title}</strong>
      <p>{detail}</p>
    </div>
  );
}

function OperationDialog({
  operation,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  operation: OperationRequest | null;
  busy: boolean;
  error: string;
  onCancel: () => void;
  onConfirm: (confirmation: string) => void;
}) {
  const [confirmation, setConfirmation] = useState("");
  const confirmButton = useRef<HTMLButtonElement>(null);
  const confirmationInput = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLElement>(null);
  const previousFocus = useRef<HTMLElement | null>(null);
  const busyRef = useRef(busy);

  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  useEffect(() => {
    setConfirmation("");
    if (!operation) return;
    previousFocus.current = document.activeElement as HTMLElement | null;
    const timeout = window.setTimeout(() => {
      if (operation.confirmationText) confirmationInput.current?.focus();
      else confirmButton.current?.focus();
    }, 20);
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !busyRef.current) onCancel();
      if (event.key !== "Tab" || !dialog.current) return;
      const focusable = Array.from(
        dialog.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ),
      );
      const first = focusable[0];
      const last = focusable.at(-1);
      if (!first || !last) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      window.clearTimeout(timeout);
      document.removeEventListener("keydown", closeOnEscape);
      previousFocus.current?.focus();
    };
  }, [operation, onCancel]);

  if (!operation) return null;
  const confirmationMatches = operation.confirmationText
    ? confirmation === operation.confirmationText
    : true;

  return (
    <div className="dialog-backdrop" role="presentation">
      <section
        ref={dialog}
        className="operation-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="operation-dialog-title"
        aria-describedby="operation-dialog-description"
      >
        <header>
          <span className={operation.danger ? "dialog-icon danger" : "dialog-icon"}>
            {operation.danger ? <Warning /> : <ArrowClockwise />}
          </span>
          <div>
            <span className="dialog-kicker">Konfirmasi tindakan</span>
            <h2 id="operation-dialog-title">{operation.title}</h2>
          </div>
          <button
            className="icon-button"
            onClick={onCancel}
            disabled={busy}
            aria-label="Tutup dialog"
          >
            <X />
          </button>
        </header>
        <p id="operation-dialog-description">{operation.description}</p>
        <dl className="operation-summary">
          <div>
            <dt>Target</dt>
            <dd>{operation.target}</dd>
          </div>
          <div>
            <dt>Action</dt>
            <dd>{operation.action}</dd>
          </div>
          <div>
            <dt>Audit</dt>
            <dd>Nama operator, target, hasil, dan waktu akan disimpan.</dd>
          </div>
        </dl>
        {operation.confirmationText ? (
          <label className="confirmation-field">
            Ketik <strong>{operation.confirmationText}</strong> untuk melanjutkan
            <input
              ref={confirmationInput}
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="off"
              disabled={busy}
            />
          </label>
        ) : null}
        {error ? (
          <p className="dialog-error" role="alert">
            <Warning /> {error}
          </p>
        ) : null}
        <footer>
          <button className="quiet-button" onClick={onCancel} disabled={busy}>
            Batal
          </button>
          <button
            ref={confirmButton}
            className={operation.danger ? "danger-button" : "primary-button"}
            onClick={() => onConfirm(confirmation)}
            disabled={busy || !confirmationMatches}
          >
            <ArrowClockwise className={busy ? "spin" : ""} />
            {busy ? "Menjalankan..." : operation.buttonLabel || "Jalankan"}
          </button>
        </footer>
      </section>
    </div>
  );
}

function OperationNotice({
  notice,
  onClose,
}: {
  notice: { tone: "success" | "danger"; message: string; auditId?: number } | null;
  onClose: () => void;
}) {
  if (!notice) return null;
  return (
    <div className={`operation-notice ${notice.tone}`} role="status" aria-live="polite">
      {notice.tone === "success" ? <CheckCircle /> : <XCircle />}
      <div>
        <strong>{notice.tone === "success" ? "Action accepted" : "Action failed"}</strong>
        <span>{notice.message}</span>
        {notice.auditId ? <small>Audit #{notice.auditId}</small> : null}
      </div>
      <button onClick={onClose} aria-label="Tutup notifikasi">
        <X />
      </button>
    </div>
  );
}

function OverviewPage({
  data,
  live,
  liveError,
  onNavigate,
}: {
  data: DashboardData | null;
  live: LiveData | null;
  liveError: string;
  onNavigate: (page: ModuleName) => void;
}) {
  const failedRuns =
    data?.workflowRuns.filter((run) => run.conclusion === "failure").length ??
    0;
  const activeServices =
    live?.services.filter((service) => service.status === "active").length ?? 0;
  const statCards = [
    {
      label: "Server",
      value: live ? "Online" : "Checking",
      note: live?.hostname ?? (liveError || "Menunggu VPS"),
      icon: DesktopTower,
      tone: live ? "success" : "warning",
    },
    {
      label: "Projects",
      value: String(projects.length),
      note: `${projects.filter((project) => project.state !== "online").length} perlu perhatian`,
      icon: Stack,
      tone: "neutral",
    },
    {
      label: "Repositories",
      value: String(data?.repositories.length ?? 0),
      note: data ? "cache MySQL" : "menunggu sync",
      icon: GithubLogo,
      tone: "neutral",
    },
    {
      label: "Failed actions",
      value: String(failedRuns),
      note: "dari workflow tersimpan",
      icon: GitBranch,
      tone: failedRuns ? "danger" : "success",
    },
  ];

  return (
    <div className="page-stack">
      <section className="status-grid">
        {statCards.map(({ label, value, note, icon: Icon, tone }) => (
          <article className="stat-card" key={label}>
            <div className={`stat-icon ${tone}`}>
              <Icon size={18} />
            </div>
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{note}</small>
          </article>
        ))}
      </section>

      <section className="overview-grid">
        <article className="panel server-spotlight">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Live VPS</span>
              <h2>Resource pressure</h2>
            </div>
            <Badge tone={live ? "success" : "warning"}>
              {live ? "LIVE" : "CONNECTING"}
            </Badge>
          </div>
          {live ? (
            <div className="resource-list">
              <ResourceBar
                label="CPU"
                value={live.cpuPercent}
                detail={`Load ${live.load.join(" / ")}`}
              />
              <ResourceBar
                label="Memory"
                value={live.memory.percent}
                detail={`${formatBytes(live.memory.used)} / ${formatBytes(live.memory.total)}`}
                tone={live.memory.percent >= 80 ? "amber" : "green"}
              />
              <ResourceBar
                label="Swap"
                value={live.swap.percent}
                detail={`${formatBytes(live.swap.used)} / ${formatBytes(live.swap.total)}`}
                tone={live.swap.percent >= 40 ? "amber" : "green"}
              />
              <ResourceBar
                label="Root disk"
                value={live.disk.percent}
                detail={`${formatBytes(live.disk.available)} available`}
                tone={live.disk.percent >= 75 ? "amber" : "green"}
              />
            </div>
          ) : (
            <EmptyState
              icon={DesktopTower}
              title="Menghubungkan ke VPS"
              detail={
                liveError ||
                "Metric live hanya diminta saat layar monitoring dibuka."
              }
            />
          )}
          <button className="text-action" onClick={() => onNavigate("Servers")}>
            Lihat detail server <span>→</span>
          </button>
        </article>

        <article className="panel service-spotlight">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Runtime</span>
              <h2>Critical services</h2>
            </div>
            <span className="panel-count">
              {activeServices}/{live?.services.length ?? 6}
            </span>
          </div>
          <div className="compact-list">
            {(
              live?.services ??
              serviceInventory
                .slice(0, 6)
                .map((s) => ({ name: s.name, status: "pending" }))
            ).map((service) => (
              <div key={service.name}>
                <span className={`signal ${service.status}`} />
                <strong>{service.name}</strong>
                <Badge
                  tone={
                    service.status === "active"
                      ? "success"
                      : service.status === "pending"
                        ? "neutral"
                        : "danger"
                  }
                >
                  {service.status}
                </Badge>
              </div>
            ))}
          </div>
          <button
            className="text-action"
            onClick={() => onNavigate("Services")}
          >
            Buka service inventory <span>→</span>
          </button>
        </article>
      </section>

      <section className="split-grid">
        <article className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Application map</span>
              <h2>Production projects</h2>
            </div>
            <button
              className="quiet-button"
              onClick={() => onNavigate("Projects")}
            >
              View all
            </button>
          </div>
          <div className="project-list">
            {projects.slice(0, 5).map((project) => (
              <div key={project.id}>
                <span className={`project-glyph state-${project.state}`}>
                  {project.name.slice(0, 2).toUpperCase()}
                </span>
                <div>
                  <strong>{project.name}</strong>
                  <small>{project.domain}</small>
                </div>
                <div className="row-meta">
                  <span>{project.runtime}</span>
                  <Badge tone={projectTone(project.state)}>
                    {project.state}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </article>
        <article className="panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Delivery</span>
              <h2>Latest workflow runs</h2>
            </div>
            <button
              className="quiet-button"
              onClick={() => onNavigate("CI/CD")}
            >
              Open CI/CD
            </button>
          </div>
          {data?.workflowRuns.length ? (
            <div className="run-list">
              {data.workflowRuns.slice(0, 6).map((run) => (
                <a
                  key={run.id}
                  href={run.html_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  <span className={`run-icon ${run.conclusion ?? run.status}`}>
                    {run.conclusion === "success" ? (
                      <CheckCircle />
                    ) : run.conclusion === "failure" ? (
                      <XCircle />
                    ) : (
                      <ClockCounterClockwise />
                    )}
                  </span>
                  <div>
                    <strong>{run.workflow_name}</strong>
                    <small>
                      {run.full_name} / #{run.run_number}
                    </small>
                  </div>
                  <time>{timeAgo(run.started_at)}</time>
                </a>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={GitBranch}
              title="Belum ada workflow di cache"
              detail="Jalankan GitHub sync dari halaman CI/CD atau Settings."
            />
          )}
        </article>
      </section>
    </div>
  );
}

function TelemetryChart({
  history,
  live,
}: {
  history: DashboardData["metricHistory"];
  live: LiveData | null;
}) {
  const samples = history.length
    ? history
    : live
      ? [
          {
            cpu_percent: live.cpuPercent,
            memory_percent: live.memory.percent,
            swap_percent: live.swap.percent,
            disk_percent: live.disk.percent,
            load_1m: live.load[0],
            captured_at: live.checkedAt,
          },
        ]
      : [];
  const [hovered, setHovered] = useState<number | null>(null);
  const width = 860;
  const height = 238;
  const top = 14;
  const bottom = 28;
  const chartHeight = height - top - bottom;
  const pointX = (index: number) =>
    samples.length <= 1 ? width / 2 : (index / (samples.length - 1)) * width;
  const pointY = (value: number | null) =>
    top +
    chartHeight -
    (Math.max(0, Math.min(100, Number(value ?? 0))) / 100) * chartHeight;
  const points = (key: "cpu_percent" | "memory_percent" | "disk_percent") =>
    samples
      .map((sample, index) => `${pointX(index)},${pointY(sample[key])}`)
      .join(" ");
  const activeSample = hovered !== null ? samples[hovered] : null;
  const activeX = hovered !== null ? pointX(hovered) : 0;

  function moveCursor(event: React.MouseEvent<SVGSVGElement>) {
    if (samples.length < 2) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const ratio = Math.max(
      0,
      Math.min(1, (event.clientX - bounds.left) / bounds.width),
    );
    setHovered(Math.round(ratio * (samples.length - 1)));
  }

  return (
    <div className="telemetry-chart-wrap">
      <div className="chart-legend">
        <span className="cpu">CPU</span>
        <span className="memory">MEMORY</span>
        <span className="disk">ROOT DISK</span>
        <span className="sample-count">{samples.length} STORED SAMPLES</span>
      </div>
      {samples.length ? (
        <div className="chart-stage">
          <svg
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label="Server resource history"
            onMouseMove={moveCursor}
            onMouseLeave={() => setHovered(null)}
          >
            {[0, 25, 50, 75, 100].map((tick) => {
              const y = pointY(tick);
              return (
                <g key={tick}>
                  <line
                    className="telemetry-grid-line"
                    x1="0"
                    x2={width}
                    y1={y}
                    y2={y}
                  />
                  <text className="telemetry-axis-label" x="4" y={y - 5}>
                    {tick}%
                  </text>
                </g>
              );
            })}
            {samples.length > 1 && [0, Math.floor(samples.length / 3), Math.floor((2 * samples.length) / 3), samples.length - 1].map((index) => {
              const sample = samples[index];
              if (!sample) return null;
              const x = pointX(index);
              const date = new Date(sample.captured_at);
              const timeStr = date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
              const dateStr = date.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
              const label = `${dateStr} ${timeStr}`;
              return (
                <g key={index}>
                  <line
                    className="telemetry-grid-line"
                    x1={x}
                    x2={x}
                    y1={top}
                    y2={height - bottom}
                    style={{ strokeDasharray: "2 2", opacity: 0.2 }}
                  />
                  <text
                    className="telemetry-axis-label"
                    x={x}
                    y={height - 10}
                    textAnchor={index === 0 ? "start" : index === samples.length - 1 ? "end" : "middle"}
                  >
                    {label}
                  </text>
                </g>
              );
            })}
            <polyline
              className="telemetry-line cpu"
              points={points("cpu_percent")}
            />
            <polyline
              className="telemetry-line memory"
              points={points("memory_percent")}
            />
            <polyline
              className="telemetry-line disk"
              points={points("disk_percent")}
            />
            {hovered !== null && activeSample ? (
              <>
                <line
                  className="telemetry-crosshair"
                  x1={activeX}
                  x2={activeX}
                  y1={top}
                  y2={height - bottom}
                />
                <circle
                  className="telemetry-focus"
                  cx={activeX}
                  cy={pointY(activeSample.cpu_percent)}
                  r="4"
                />
              </>
            ) : null}
          </svg>
          {hovered !== null && activeSample ? (
            <div
              className="telemetry-tooltip"
              style={{
                left: `${Math.max(8, Math.min(72, (activeX / width) * 100))}%`,
              }}
            >
              <time>
                {new Date(activeSample.captured_at).toLocaleString("id-ID")}
              </time>
              <span>
                <i className="cpu" />
                CPU <b>{Number(activeSample.cpu_percent ?? 0).toFixed(1)}%</b>
              </span>
              <span>
                <i className="memory" />
                MEM{" "}
                <b>{Number(activeSample.memory_percent ?? 0).toFixed(1)}%</b>
              </span>
              <span>
                <i className="disk" />
                DISK <b>{Number(activeSample.disk_percent ?? 0).toFixed(1)}%</b>
              </span>
            </div>
          ) : null}
        </div>
      ) : (
        <EmptyState
          icon={Pulse}
          title="Belum ada histori metric"
          detail="Buka halaman server untuk mulai menyimpan sample."
        />
      )}
    </div>
  );
}

function TacticalOverviewPage({
  data,
  live,
  alerts,
  liveError,
  onNavigate,
  onOpenLogs,
  metricRange,
  setMetricRange,
}: {
  data: DashboardData | null;
  live: LiveData | null;
  alerts: InfrastructureAlert[];
  liveError: string;
  onNavigate: (page: ModuleName) => void;
  onOpenLogs: (projectId: string) => void;
  metricRange: "recent" | "day" | "week" | "month";
  setMetricRange: (range: "recent" | "day" | "week" | "month") => void;
}) {
  const repositories = new Map(
    (data?.repositories ?? []).map((repo) => [repo.full_name, repo]),
  );
  const latestRuns = new Map<string, WorkflowRun>();
  for (const run of data?.workflowRuns ?? []) {
    if (!latestRuns.has(run.full_name)) latestRuns.set(run.full_name, run);
  }
  const activeServices =
    live?.services.filter((service) => service.status === "active").length ?? 0;
  const failedRuns =
    data?.workflowRuns.filter((run) => run.conclusion === "failure").length ??
    0;

  return (
    <div className="tactical-overview">
      <section className="kpi-grid-redesign" aria-label="Global infrastructure health">
        {/* CPU Card */}
        <article className="stat-card-redesign">
          <div className="card-header">
            <Cpu size={16} />
            <span>CPU</span>
          </div>
          <div className="card-body">
            <strong>{live ? `${live.cpuPercent.toFixed(1)}%` : "-"} <small>Used</small></strong>
            <div className="card-progress">
              <div className="progress-fill green" style={{ width: live ? `${live.cpuPercent}%` : "0%" }}></div>
            </div>
            <div className="card-footer-detail">
              {live ? `${((live.cores * live.cpuPercent) / 100).toFixed(1)} / ${live.cores} Cores` : "-"}
            </div>
          </div>
        </article>

        {/* RAM Card */}
        <article className="stat-card-redesign">
          <div className="card-header">
            <Memory size={16} />
            <span>RAM</span>
          </div>
          <div className="card-body">
            <strong>{live ? `${live.memory.percent.toFixed(0)}%` : "-"} <small>Used</small></strong>
            <div className="card-progress">
              <div className="progress-fill purple" style={{ width: live ? `${live.memory.percent}%` : "0%" }}></div>
            </div>
            <div className="card-footer-detail">
              {live ? `${formatBytesCompact(live.memory.used)} / ${formatBytesCompact(live.memory.total)}` : "-"}
            </div>
          </div>
        </article>

        {/* SWAP Card */}
        <article className="stat-card-redesign">
          <div className="card-header">
            <Pulse size={16} />
            <span>SWAP</span>
          </div>
          <div className="card-body">
            <strong>{live ? `${live.swap.percent.toFixed(0)}%` : "-"} <small>Used</small></strong>
            <div className="card-progress">
              <div className="progress-fill violet" style={{ width: live ? `${live.swap.percent}%` : "0%" }}></div>
            </div>
            <div className="card-footer-detail">
              {live ? `${formatBytesCompact(live.swap.used)} / ${formatBytesCompact(live.swap.total)}` : "-"}
            </div>
          </div>
        </article>

        {/* DISK Card */}
        <article className="stat-card-redesign">
          <div className="card-header">
            <HardDrives size={16} />
            <span>DISK (/)</span>
          </div>
          <div className="card-body">
            <strong>{live ? `${live.disk.percent.toFixed(0)}%` : "-"} <small>Used</small></strong>
            <div className="card-progress">
              <div className="progress-fill blue" style={{ width: live ? `${live.disk.percent}%` : "0%" }}></div>
            </div>
            <div className="card-footer-detail">
              {live ? `${formatBytesCompact(live.disk.used)} / ${formatBytesCompact(live.disk.total)}` : "-"}
            </div>
          </div>
        </article>

        {/* LOAD AVG Card */}
        <article className="stat-card-redesign">
          <div className="card-header">
            <List size={16} />
            <span>LOAD AVG</span>
          </div>
          <div className="card-body-load">
            <div className="load-col">
              <span className="load-label">1M</span>
              <span className="load-value">{live ? live.load[0].toFixed(2) : "-"}</span>
            </div>
            <div className="load-col">
              <span className="load-label">5M</span>
              <span className="load-value">{live ? live.load[1].toFixed(2) : "-"}</span>
            </div>
            <div className="load-col">
              <span className="load-label">15M</span>
              <span className="load-value">{live ? live.load[2].toFixed(2) : "-"}</span>
            </div>
          </div>
        </article>

        {/* SYSTEM Card */}
        <article className="stat-card-redesign">
          <div className="card-header">
            <Info size={16} />
            <span>SYSTEM</span>
          </div>
          <div className="card-body-system">
            <strong className="sys-os">{live ? live.os : "-"}</strong>
            <span className="sys-docker">Docker {live ? live.docker.version : "-"}</span>
            <span className="sys-uptime">{live ? live.uptime : "-"}</span>
          </div>
        </article>
      </section>

      <section className="telemetry-grid panel-frame-technical">
        <article className="history-panel">
          <header className="technical-heading">
            <div>
              <Pulse />
              <h2>RESOURCE HISTORY</h2>
            </div>
            <div className="range-switch">
              <button
                className={metricRange === "recent" ? "active" : ""}
                onClick={() => setMetricRange("recent")}
              >
                RECENT
              </button>
              <button
                className={metricRange === "day" ? "active" : ""}
                onClick={() => setMetricRange("day")}
              >
                DAY
              </button>
              <button
                className={metricRange === "week" ? "active" : ""}
                onClick={() => setMetricRange("week")}
              >
                WEEK
              </button>
              <button
                className={metricRange === "month" ? "active" : ""}
                onClick={() => setMetricRange("month")}
              >
                MONTH
              </button>
              <button onClick={() => onNavigate("Servers")}>DETAIL</button>
            </div>
          </header>
          <TelemetryChart history={data?.metricHistory ?? []} live={live} />
        </article>
        <aside className="resource-rail">
          <header className="technical-heading">
            <div>
              <HardDrives />
              <h2>RESOURCE USAGE</h2>
            </div>
            <span>LIVE</span>
          </header>
          <div className="resource-rail-body">
            <ResourceBar
              label="CPU LOAD"
              value={live?.cpuPercent ?? 0}
              detail="current sample"
            />
            <ResourceBar
              label="MEMORY"
              value={live?.memory.percent ?? 0}
              detail={
                live ? `${formatBytes(live.memory.used)} used` : "pending"
              }
              tone={(live?.memory.percent ?? 0) > 80 ? "red" : "orange"}
            />
            <ResourceBar
              label="SWAP"
              value={live?.swap.percent ?? 0}
              detail={live ? `${formatBytes(live.swap.used)} used` : "pending"}
              tone={(live?.swap.percent ?? 0) > 40 ? "red" : "orange"}
            />
            <ResourceBar
              label="ROOT DISK"
              value={live?.disk.percent ?? 0}
              detail={live ? `${formatBytes(live.disk.used)} used` : "pending"}
              tone={(live?.disk.percent ?? 0) > 75 ? "red" : "orange"}
            />
            <div className="anomaly-box">
              <Warning />
              <div>
                <strong>{alerts.length} ACTIVE SIGNALS</strong>
                <span>
                  {alerts.length
                    ? alerts.map((alert) => alert.source).join(" / ")
                    : "DNS and monitored services are healthy"}
                </span>
              </div>
            </div>
          </div>
        </aside>
      </section>

      <section className="program-summary panel-frame-technical">
        <header className="technical-heading">
          <div>
            <Stack />
            <h2>PROGRAM &amp; DOMAIN SUMMARY</h2>
            <span>{projects.length} TARGETS</span>
          </div>
          <div className="table-tools">
            <button onClick={() => onNavigate("Projects")}>FILTER</button>
            <button onClick={() => onNavigate("Logs")}>LOG STREAM</button>
          </div>
        </header>
        <div className="table-scroll">
          <table className="operations-table">
            <thead>
              <tr>
                <th>Program / domain</th>
                <th>Status</th>
                <th>Runtime / target</th>
                <th>Repository / revision</th>
                <th>Latest action</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((project) => {
                const repository = repositories.get(project.repo);
                const run = latestRuns.get(project.repo);
                return (
                  <tr key={project.id}>
                    <td>
                      <strong>{project.name}</strong>
                      <small>{project.domain}</small>
                    </td>
                    <td>
                      <Badge tone={projectTone(project.state)}>
                        {project.state}
                      </Badge>
                    </td>
                    <td>
                      <strong>{project.runtime}</strong>
                      <small>{project.target}</small>
                    </td>
                    <td>
                      <strong>{project.repo}</strong>
                      <small>
                        {repository?.default_branch ?? "-"} / {project.commit}
                      </small>
                    </td>
                    <td>
                      {run ? (
                        <>
                          <Badge
                            tone={
                              run.conclusion === "success"
                                ? "success"
                                : run.conclusion === "failure"
                                  ? "danger"
                                  : "warning"
                            }
                          >
                            {run.conclusion ?? run.status}
                          </Badge>
                          <small>
                            {run.workflow_name} / {timeAgo(run.started_at)}
                          </small>
                        </>
                      ) : (
                        <>
                          <Badge tone="neutral">NO ACTION</Badge>
                          <small>Not available in cache</small>
                        </>
                      )}
                    </td>
                    <td>
                      <div className="operation-actions">
                        <a
                          href={`https://${project.domains[0]}`}
                          target="_blank"
                          rel="noreferrer"
                          title="Open domain"
                        >
                          ↗
                        </a>
                        {repository ? (
                          <a
                            href={repository.html_url}
                            target="_blank"
                            rel="noreferrer"
                            title="Open GitHub"
                          >
                            GH
                          </a>
                        ) : null}
                        <button onClick={() => onOpenLogs(project.id)}>
                          LOG
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function ServersPage({
  live,
  error,
  refresh,
  refreshing,
  onOperation,
  canReboot,
}: {
  live: LiveData | null;
  error: string;
  refresh: () => void;
  refreshing: boolean;
  onOperation: (operation: OperationRequest) => void;
  canReboot: boolean;
}) {
  return (
    <div className="page-stack">
      <section className="panel host-header">
        <div className="host-identity">
          <span className="host-mark">
            <DesktopTower size={28} />
          </span>
          <div>
            <span className="eyebrow">Primary host</span>
            <h2>{live?.hostname ?? "VM-0-5-ubuntu"}</h2>
            <p>
              {live?.os ?? "Ubuntu 24.04 LTS"} / kernel {live?.kernel ?? "6.8"}
            </p>
          </div>
        </div>
        <div className="host-facts">
          <div>
            <span>Public IP</span>
            <strong>43.133.155.252</strong>
          </div>
          <div>
            <span>Uptime</span>
            <strong>{live?.uptime ?? "-"}</strong>
          </div>
          <div>
            <span>Sample</span>
            <strong>{live ? timeAgo(live.checkedAt) : "-"}</strong>
          </div>
        </div>
        <div className="host-actions">
          <button
            className="icon-button"
            onClick={refresh}
            disabled={refreshing}
            aria-label="Refresh server"
          >
            <ArrowClockwise className={refreshing ? "spin" : ""} />
          </button>
          {canReboot ? (
            <button
              className="danger-button compact"
              onClick={() =>
                onOperation({
                  endpoint: "/api/operations/action",
                  title: "Restart primary VPS",
                  description:
                    "Seluruh aplikasi akan tidak tersedia sementara. Systemd akan menyalakan service kembali setelah server boot.",
                  target: live?.hostname || "VM-0-5-ubuntu",
                  action: "reboot",
                  body: { type: "server", action: "reboot" },
                  confirmationText: live?.hostname || "VM-0-5-ubuntu",
                  buttonLabel: "Restart server",
                  danger: true,
                })
              }
            >
              <Power /> Restart server
            </button>
          ) : null}
        </div>
      </section>
      {error && !live ? (
        <div className="inline-error">
          <Warning /> {error}
        </div>
      ) : null}
      <section className="server-detail-grid">
        <article className="panel resource-card">
          <Cpu />
          <span>CPU utilization</span>
          <strong>
            {live?.cpuPercent.toFixed(1) ?? "-"}
            <small>%</small>
          </strong>
          <ResourceBar
            label="Current sample"
            value={live?.cpuPercent ?? 0}
            detail={`Load average ${live?.load.join(" / ") ?? "-"}`}
          />
        </article>
        <article className="panel resource-card">
          <Memory />
          <span>Memory pressure</span>
          <strong>
            {live?.memory.percent.toFixed(1) ?? "-"}
            <small>%</small>
          </strong>
          <ResourceBar
            label="RAM"
            value={live?.memory.percent ?? 0}
            detail={
              live
                ? `${formatBytes(live.memory.available)} available`
                : "Waiting for sample"
            }
            tone={(live?.memory.percent ?? 0) > 80 ? "amber" : "green"}
          />
        </article>
        <article className="panel resource-card">
          <Pulse />
          <span>Swap usage</span>
          <strong>
            {live?.swap.percent.toFixed(1) ?? "-"}
            <small>%</small>
          </strong>
          <ResourceBar
            label="Swap"
            value={live?.swap.percent ?? 0}
            detail={
              live
                ? `${formatBytes(live.swap.used)} used`
                : "Waiting for sample"
            }
            tone={(live?.swap.percent ?? 0) > 40 ? "amber" : "green"}
          />
        </article>
        <article className="panel resource-card">
          <HardDrives />
          <span>Root filesystem</span>
          <strong>
            {live?.disk.percent.toFixed(1) ?? "-"}
            <small>%</small>
          </strong>
          <ResourceBar
            label="Disk"
            value={live?.disk.percent ?? 0}
            detail={
              live
                ? `${formatBytes(live.disk.used)} / ${formatBytes(live.disk.total)}`
                : "Waiting for sample"
            }
            tone={(live?.disk.percent ?? 0) > 75 ? "amber" : "green"}
          />
        </article>
      </section>
      <section className="panel data-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Sampling policy</span>
            <h2>What stays live</h2>
          </div>
          <Badge tone="success">15-30 SEC</Badge>
        </div>
        <div className="policy-grid">
          <div>
            <Cpu />
            <strong>Live on this page</strong>
            <p>
              CPU, RAM, swap, disk, load, uptime, service state, dan container
              state.
            </p>
          </div>
          <div>
            <Database />
            <strong>Stored as snapshots</strong>
            <p>
              Sample ringkas masuk MySQL untuk histori dan chart, dengan
              retention yang dapat dibatasi.
            </p>
          </div>
          <div>
            <GithubLogo />
            <strong>Never requested here</strong>
            <p>
              Halaman server tidak memanggil API GitHub. Repository dibaca dari
              cache database.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}

function ServicesPage({
  live,
  onLogs,
  onOperation,
  role,
}: {
  live: LiveData | null;
  onLogs: (service: string) => void;
  onOperation: (operation: OperationRequest) => void;
  role: SessionUser["role"];
}) {
  const statusMap = new Map(
    live?.services.map((service) => [service.name, service.status]),
  );
  return (
    <section className="panel data-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Service inventory</span>
          <h2>Runtime linked to projects</h2>
        </div>
        <Badge tone={live ? "success" : "neutral"}>
          {live ? "LIVE STATUS" : "WAITING"}
        </Badge>
      </div>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Service</th>
              <th>Role</th>
              <th>Linked workload</th>
              <th>Port</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {serviceInventory.map((service) => {
              const status =
                statusMap.get(service.name) ?? "pending";
              const ownerOnly = ["mysql", "docker"].includes(service.name);
              const adminService = [
                "nginx",
                "php8.3-fpm",
                "supervisor",
                "cron",
                "hermes-dashboard.service",
                "mnemosyne-dashboard.service",
              ].includes(service.name);
              const canOperate =
                role === "owner" ||
                (!ownerOnly && role === "admin") ||
                (!ownerOnly && !adminService && role === "operator");
              const canStop =
                canOperate &&
                !["nginx", "php8.3-fpm", "mysql", "docker"].includes(
                  service.name,
                );
              const openServiceAction = (
                action: "start" | "stop" | "restart",
              ) =>
                onOperation({
                  endpoint: "/api/operations/action",
                  title: `${action === "restart" ? "Restart" : action === "start" ? "Start" : "Stop"} ${service.name}`,
                  description:
                    action === "stop"
                      ? "Service akan dihentikan dan workload terkait tidak dapat menerima traffic sampai dinyalakan kembali."
                      : "Opsdeck akan menjalankan action melalui policy allowlist lalu memeriksa status service.",
                  target: service.name,
                  action,
                  body: { type: "service", action, target: service.name },
                  confirmationText:
                    action === "stop" ||
                    (service.name === "docker" && action === "restart")
                      ? service.name
                      : undefined,
                  buttonLabel:
                    action === "restart"
                      ? "Restart service"
                      : action === "start"
                        ? "Start service"
                        : "Stop service",
                  danger: action === "stop" || service.name === "docker",
                });
              return (
                <tr key={service.name}>
                  <td>
                    <span className={`service-dot ${status}`} />
                    <strong>{service.name}</strong>
                  </td>
                  <td>{service.kind}</td>
                  <td>{service.project}</td>
                  <td>
                    <code>{service.port}</code>
                  </td>
                  <td>
                    <Badge
                      tone={
                        status === "active"
                          ? "success"
                          : status === "failed"
                            ? "danger"
                            : "neutral"
                      }
                    >
                      {status}
                    </Badge>
                  </td>
                  <td>
                    <div className="row-actions">
                      <button
                        className="row-action"
                        onClick={() => onLogs(service.name)}
                      >
                        Logs
                      </button>
                      {canOperate ? (
                        status !== "inactive" && status !== "failed" ? (
                          <>
                            <button
                              className="row-action action-primary"
                              onClick={() => openServiceAction("restart")}
                              aria-label={`Restart ${service.name}`}
                            >
                              <ArrowClockwise /> Restart
                            </button>
                            {canStop ? (
                              <button
                                className="row-action action-danger"
                                onClick={() => openServiceAction("stop")}
                                aria-label={`Stop ${service.name}`}
                              >
                                <Stop /> Stop
                              </button>
                            ) : null}
                          </>
                        ) : (
                          <button
                            className="row-action action-primary"
                            onClick={() => openServiceAction("start")}
                            aria-label={`Start ${service.name}`}
                          >
                            <Play /> Start
                          </button>
                        )
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ProjectsPage({
  onLogs,
  query = "",
}: {
  onLogs: (projectId: string) => void;
  query?: string;
}) {
  const [selected, setSelected] = useState<(typeof projects)[number]>(
    projects[0],
  );
  const normalizedQuery = query.trim().toLowerCase();
  const visibleProjects = normalizedQuery
    ? projects.filter((project) =>
        [project.name, project.domain, project.repo, project.runtime].some(
          (value) => value.toLowerCase().includes(normalizedQuery),
        ),
      )
    : projects;
  return (
    <div className="projects-layout">
      <section className="panel data-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">{visibleProjects.length} workloads</span>
            <h2>Project inventory</h2>
          </div>
          <div className="filter-chip">All environments</div>
        </div>
        <div className="project-catalog">
          {visibleProjects.map((project) => (
            <button
              key={project.id}
              className={selected.id === project.id ? "selected" : ""}
              onClick={() => setSelected(project)}
            >
              <span className={`project-glyph state-${project.state}`}>
                {project.name.slice(0, 2).toUpperCase()}
              </span>
              <div>
                <strong>{project.name}</strong>
                <small>{project.repo}</small>
              </div>
              <Badge tone={projectTone(project.state)}>{project.state}</Badge>
            </button>
          ))}
        </div>
      </section>
      <aside className="panel project-detail">
        <div className="project-detail-head">
          <span className={`project-glyph large state-${selected.state}`}>
            {selected.name.slice(0, 2).toUpperCase()}
          </span>
          <div>
            <span className="eyebrow">{selected.area}</span>
            <h2>{selected.name}</h2>
          </div>
        </div>
        <a
          className="domain-link"
          href={`https://${selected.domain.split(" / ")[0]}`}
          target="_blank"
          rel="noreferrer"
        >
          <Globe /> {selected.domain}
        </a>
        <dl>
          <div>
            <dt>Repository</dt>
            <dd>{selected.repo}</dd>
          </div>
          <div>
            <dt>Runtime</dt>
            <dd>{selected.runtime}</dd>
          </div>
          <div>
            <dt>Traffic target</dt>
            <dd>{selected.target}</dd>
          </div>
          <div>
            <dt>Deploy path</dt>
            <dd>{selected.path}</dd>
          </div>
          <div>
            <dt>Service</dt>
            <dd>{selected.service}</dd>
          </div>
          <div>
            <dt>Database</dt>
            <dd>{selected.database}</dd>
          </div>
        </dl>
        <div className="request-flow">
          <span>Internet</span>
          <i>→</i>
          <span>Nginx</span>
          <i>→</i>
          <span>{selected.runtime.split(" / ")[0]}</span>
          <i>→</i>
          <span>Database</span>
        </div>
        <div className="project-detail-actions">
          <button
            className="primary-button"
            onClick={() => onLogs(selected.id)}
          >
            <TerminalWindow /> VIEW LIVE LOGS
          </button>
          {selected.repo.includes("/") ? (
            <a
              className="quiet-button"
              href={`https://github.com/${selected.repo}`}
              target="_blank"
              rel="noreferrer"
            >
              <GithubLogo /> OPEN GITHUB
            </a>
          ) : null}
        </div>
      </aside>
    </div>
  );
}

function DockerPage({
  live,
  onLogs,
  onOperation,
  role,
}: {
  live: LiveData | null;
  onLogs: (container: string) => void;
  onOperation: (operation: OperationRequest) => void;
  role: SessionUser["role"];
}) {
  const containers = live?.docker.containers ?? [];
  const canRestartEngine = role === "owner";
  return (
    <div className="page-stack">
      <section className="docker-summary">
        <article className="panel docker-engine-card">
          <Cube />
          <span>Engine</span>
          <strong>{live?.docker.version ?? "-"}</strong>
          <Badge tone={live?.docker.version ? "success" : "neutral"}>
            server version
          </Badge>
          {canRestartEngine ? (
            <button
              className="row-action action-danger"
              onClick={() =>
                onOperation({
                  endpoint: "/api/operations/action",
                  title: "Restart Docker engine",
                  description:
                    "Semua container akan berhenti sementara. Opsdeck akan kembali melalui systemd setelah Docker aktif.",
                  target: "docker",
                  action: "restart",
                  body: { type: "service", action: "restart", target: "docker" },
                  confirmationText: "docker",
                  buttonLabel: "Restart Docker",
                  danger: true,
                })
              }
            >
              <ArrowClockwise /> Restart engine
            </button>
          ) : null}
        </article>
        <article className="panel">
          <Stack />
          <span>Containers</span>
          <strong>{containers.length}</strong>
          <Badge tone={containers.length ? "success" : "neutral"}>
            inventory live
          </Badge>
        </article>
        <article className="panel">
          <Pulse />
          <span>Running</span>
          <strong>
            {
              containers.filter((container) => container.State === "running")
                .length
            }
          </strong>
          <Badge tone="success">current state</Badge>
        </article>
      </section>
      <section className="panel data-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Docker host</span>
            <h2>Container inventory</h2>
          </div>
          <Badge tone="success">ON DEMAND</Badge>
        </div>
        {containers.length ? (
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Container</th>
                  <th>Image</th>
                  <th>State</th>
                  <th>Ports</th>
                  <th>Age</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {containers.map((container) => (
                  <tr key={container.ID}>
                    <td>
                      <strong>{container.Names}</strong>
                      <small className="cell-sub">
                        {container.ID?.slice(0, 12)}
                      </small>
                    </td>
                    <td>{container.Image}</td>
                    <td>
                      <Badge
                        tone={
                          container.State === "running" ? "success" : "neutral"
                        }
                      >
                        {container.Status}
                      </Badge>
                    </td>
                    <td>
                      <code>{container.Ports || "-"}</code>
                    </td>
                    <td>{container.CreatedAt || "-"}</td>
                    <td>
                      <div className="row-actions">
                        <button
                          className="row-action"
                          onClick={() => onLogs(container.Names)}
                        >
                          View logs
                        </button>
                        {container.Names === "dev-ops-dashboard" &&
                        role !== "viewer" ? (
                          <button
                            className="row-action action-primary"
                            onClick={() =>
                              onOperation({
                                endpoint: "/api/operations/action",
                                title: "Restart Opsdeck container",
                                description:
                                  "Restart dijadwalkan melalui service induk agar dashboard dapat pulih otomatis.",
                                target: container.Names,
                                action: "restart",
                                body: {
                                  type: "container",
                                  action: "restart",
                                  target: container.Names,
                                },
                                buttonLabel: "Restart container",
                              })
                            }
                          >
                            <ArrowClockwise /> Restart
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={Cube}
            title="Tidak ada container"
            detail="Docker engine aktif, tetapi host saat ini belum memiliki container. Inventory akan muncul otomatis ketika container tersedia."
          />
        )}
      </section>
    </div>
  );
}

function CiCdPage({
  data,
  onSync,
  syncing,
  onRerun,
  canRerun,
  canManage,
}: {
  data: DashboardData | null;
  onSync: () => void;
  syncing: boolean;
  onRerun: (run: WorkflowRun) => void;
  canRerun: boolean;
  canManage: boolean;
}) {
  const repos = data?.repositories ?? [];
  const runs = data?.workflowRuns ?? [];
  const [repoQuery, setRepoQuery] = useState("");
  const [selectedRepo, setSelectedRepo] = useState("");
  useEffect(() => {
    if (!selectedRepo) {
      const firstRepoWithRuns = runs[0]?.full_name;
      if (firstRepoWithRuns) setSelectedRepo(firstRepoWithRuns);
      else if (repos[0]) setSelectedRepo(repos[0].full_name);
    }
  }, [repos, runs, selectedRepo]);
  const visibleRepos = repoQuery
    ? repos.filter((repo) =>
        repo.full_name.toLowerCase().includes(repoQuery.toLowerCase()),
      )
    : repos;
  const filteredRuns = selectedRepo
    ? runs.filter((run) => run.full_name === selectedRepo)
    : runs;
  return (
    <div className="page-stack">
      <section className="ci-toolbar panel">
        <div>
          <GithubLogo size={24} />
          <div>
            <span className="eyebrow">GitHub cache</span>
            <strong>
              {repos.length} repositories / {runs.length} workflow runs
            </strong>
          </div>
        </div>
        <div>
          <span>Last database sync</span>
          <strong>{timeAgo(data?.syncs[0]?.finished_at)}</strong>
          {canManage ? (
            <button
              className="primary-button"
              onClick={onSync}
              disabled={syncing}
            >
              <ArrowClockwise className={syncing ? "spin" : ""} />{" "}
              {syncing ? "Syncing…" : "Sync GitHub"}
            </button>
          ) : (
            <Badge tone="neutral">READ ONLY</Badge>
          )}
        </div>
      </section>
      <section className="ci-layout">
        <article className="panel data-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Repository registry</span>
              <h2>Imported repositories</h2>
            </div>
            <span className="source-label">
              <Database /> MySQL
            </span>
          </div>
          <label className="repo-filter">
            <MagnifyingGlass />
            <input
              value={repoQuery}
              onChange={(event) => setRepoQuery(event.target.value)}
              placeholder="FILTER REPOSITORIES..."
            />
          </label>
          {repos.length ? (
            <div className="repo-list">
              {visibleRepos.map((repo) => (
                <button
                  key={repo.id}
                  type="button"
                  className={selectedRepo === repo.full_name ? "selected" : ""}
                  onClick={() => setSelectedRepo(repo.full_name)}
                >
                  <span className="repo-icon">
                    <Code />
                  </span>
                  <div>
                    <strong>{repo.full_name}</strong>
                    <small>
                      {repo.language ?? "No language"} / {repo.default_branch}
                    </small>
                  </div>
                  <Badge
                    tone={repo.visibility === "private" ? "neutral" : "success"}
                  >
                    {repo.visibility}
                  </Badge>
                  <time>{timeAgo(repo.pushed_at)}</time>
                </button>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={GithubLogo}
              title="Repository belum diimpor"
              detail="Klik Sync GitHub. Data akan disimpan ke MySQL lalu halaman membaca cache ini."
            />
          )}
        </article>
        <article className="panel data-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Actions</span>
              <h2>{selectedRepo || "Recent workflow runs"}</h2>
            </div>
            <Badge tone="neutral">LATEST 80</Badge>
          </div>
          {filteredRuns.length ? (
            <div className="workflow-table">
              {filteredRuns.map((run) => (
                <div className="workflow-run-row" key={run.id}>
                  <span className={`run-icon ${run.conclusion ?? run.status}`}>
                    {run.conclusion === "success" ? (
                      <CheckCircle />
                    ) : run.conclusion === "failure" ? (
                      <XCircle />
                    ) : (
                      <ClockCounterClockwise />
                    )}
                  </span>
                  <div>
                    <strong>{run.workflow_name}</strong>
                    <small>
                      {run.full_name} / {run.branch ?? "-"}
                    </small>
                  </div>
                  <code>{run.head_sha?.slice(0, 7) ?? "-"}</code>
                  <Badge
                    tone={
                      run.conclusion === "success"
                        ? "success"
                        : run.conclusion === "failure"
                          ? "danger"
                          : "warning"
                    }
                  >
                    {run.conclusion ?? run.status}
                  </Badge>
                  <time>{timeAgo(run.started_at)}</time>
                  <div className="run-actions">
                    <a
                      href={run.html_url}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Open ${run.workflow_name} on GitHub`}
                    >
                      <ArrowSquareOut />
                    </a>
                    {canRerun && Boolean(run.conclusion) ? (
                      <button
                        onClick={() => onRerun(run)}
                        aria-label={`Retry ${run.workflow_name}`}
                      >
                        <ArrowClockwise /> Retry
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={GitBranch}
              title="Belum ada Actions run"
              detail="Repo tanpa workflow tetap terdaftar. Workflow run akan muncul setelah GitHub sync."
            />
          )}
        </article>
      </section>
    </div>
  );
}

function DeploymentsPage({
  runs,
  onRerun,
  canRerun,
}: {
  runs: WorkflowRun[];
  onRerun: (run: WorkflowRun) => void;
  canRerun: boolean;
}) {
  const deliveryRuns = runs.filter(
    (run) =>
      (deliveryWorkflowRepositories as readonly string[]).includes(
        run.full_name,
      ) && /deploy|release|production/i.test(run.workflow_name),
  );
  return (
    <div className="page-stack">
      <section className="panel data-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Environment map</span>
            <h2>Production targets</h2>
          </div>
          <Badge tone={canRerun ? "success" : "neutral"}>
            {canRerun ? "ACTIONS ENABLED" : "READ ONLY"}
          </Badge>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Project</th>
                <th>Environment</th>
                <th>Delivery method</th>
                <th>Runtime target</th>
                <th>Post-check</th>
                <th>Readiness</th>
              </tr>
            </thead>
            <tbody>
              {deployments.map((item) => (
                <tr key={item.project}>
                  <td>
                    <strong>{item.project}</strong>
                  </td>
                  <td>
                    <Badge
                      tone={
                        item.environment === "production"
                          ? "success"
                          : "neutral"
                      }
                    >
                      {item.environment}
                    </Badge>
                  </td>
                  <td>{item.method}</td>
                  <td>
                    <code>{item.target}</code>
                  </td>
                  <td>{item.health}</td>
                  <td>
                    <Badge
                      tone={
                        item.state === "blocked"
                          ? "danger"
                          : item.state === "ready"
                            ? "success"
                            : "warning"
                      }
                    >
                      {item.state}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="panel deployment-feed">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Release evidence</span>
            <h2>Latest GitHub delivery activity</h2>
          </div>
        </div>
        {deliveryRuns.length ? (
          deliveryRuns.slice(0, 10).map((run) => (
            <div className="deployment-row" key={run.id}>
              <span
                className={`timeline-mark ${run.conclusion ?? run.status}`}
              />
              <div>
                <strong>{run.full_name}</strong>
                <p>
                  {run.workflow_name} on <code>{run.branch}</code>
                </p>
              </div>
              <Badge
                tone={
                  run.conclusion === "success"
                    ? "success"
                    : run.conclusion === "failure"
                      ? "danger"
                      : "warning"
                }
              >
                {run.conclusion ?? run.status}
              </Badge>
              <time>{timeAgo(run.started_at)}</time>
              {canRerun && Boolean(run.conclusion) ? (
                <button
                  className="row-action action-primary"
                  onClick={() => onRerun(run)}
                >
                  <ArrowClockwise /> Retry deploy
                </button>
              ) : (
                <a
                  className="row-action"
                  href={run.html_url}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ArrowSquareOut /> Details
                </a>
              )}
            </div>
          ))
        ) : (
          <EmptyState
            icon={RocketLaunch}
            title="Belum ada release evidence"
            detail="Workflow run yang tersinkron akan menjadi dasar histori deployment."
          />
        )}
      </section>
    </div>
  );
}

function LogsPage({
  initialSource = "nginx-error",
  initialTarget = "nginx",
}: {
  initialSource?: string;
  initialTarget?: string;
}) {
  const [source, setSource] = useState(initialSource);
  const [target, setTarget] = useState(initialTarget);
  const [lines, setLines] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/vps/logs?source=${encodeURIComponent(source)}&target=${encodeURIComponent(target)}`,
        { cache: "no-store" },
      );
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to read logs");
      setLines(payload.lines ?? []);
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : "Unable to read logs",
      );
    } finally {
      setLoading(false);
    }
  }, [source, target]);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [lines]);

  useEffect(() => {
    load();
  }, [load]);
  return (
    <section className="panel logs-shell">
      <div className="logs-toolbar">
        <div>
          <label>
            Source
            <select
              value={source}
              onChange={(event) => setSource(event.target.value)}
            >
              <option value="nginx-error">Nginx errors</option>
              <option value="nginx-access">Nginx access</option>
              <option value="service">Systemd service</option>
              <option value="docker">Docker container</option>
            </select>
          </label>
          {source === "service" || source === "docker" ? (
            <label>
              Target
              <input
                value={target}
                onChange={(event) => setTarget(event.target.value)}
                placeholder={source === "docker" ? "container name" : "nginx"}
              />
            </label>
          ) : null}
        </div>
        <button className="quiet-button" onClick={load} disabled={loading}>
          <ArrowClockwise className={loading ? "spin" : ""} /> Refresh
        </button>
      </div>
      <div className="terminal-head">
        <span>
          <i /> Live read / last 120 lines
        </span>
        <Badge tone="success">REDACTED SOURCE</Badge>
      </div>
      <div className="terminal-body" ref={bodyRef}>
        {error ? (
          <div className="terminal-error">{error}</div>
        ) : lines.length ? (
          lines.map((line, index) => (
            <div key={`${index}-${line}`}>
              <span>{String(index + 1).padStart(3, "0")}</span>
              <code>{line}</code>
            </div>
          ))
        ) : (
          <EmptyState
            icon={FileText}
            title="Log kosong"
            detail="Tidak ada baris pada source yang dipilih."
          />
        )}
      </div>
    </section>
  );
}

function ProjectLogsPage({
  initialSource = "project",
  initialTarget = "fintrack",
}: {
  initialSource?: string;
  initialTarget?: string;
}) {
  const initialProject =
    projects.find((project) => project.id === initialTarget) ?? projects[0];
  const [source, setSource] = useState(initialSource);
  const [target, setTarget] = useState(initialTarget);
  const [stream, setStream] = useState<string>(
    initialProject.logStreams[0] ?? "access",
  );
  const [lines, setLines] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [follow, setFollow] = useState(true);
  const [search, setSearch] = useState("");
  const [metadata, setMetadata] = useState<{
    project?: string;
    domain?: string;
    streamLabel?: string;
    shared?: boolean;
    checkedAt?: string;
  }>({});
  const logRequest = useRef<AbortController | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const selectedProject = projects.find((project) => project.id === target);

  const load = useCallback(async () => {
    logRequest.current?.abort();
    const controller = new AbortController();
    logRequest.current = controller;
    let timedOut = false;
    const timeout = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 12_000);
    setLoading(true);
    setError("");
    try {
      const response = await fetch(
        `/api/vps/logs?source=${encodeURIComponent(source)}&target=${encodeURIComponent(target)}&stream=${encodeURIComponent(stream)}`,
        { cache: "no-store", signal: controller.signal },
      );
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to read logs");
      setLines(payload.lines ?? []);
      setMetadata(payload);
    } catch (nextError) {
      if (timedOut) {
        setError("Log request timed out. Try again in a moment.");
      } else if (!controller.signal.aborted) {
        setError(
          nextError instanceof Error ? nextError.message : "Unable to read logs",
        );
      }
    } finally {
      window.clearTimeout(timeout);
      if (logRequest.current === controller) {
        logRequest.current = null;
        setLoading(false);
      }
    }
  }, [source, target, stream]);

  useEffect(() => {
    load();
    return () => logRequest.current?.abort();
  }, [load]);

  useEffect(() => {
    if (!follow) return;
    const refresh = () => {
      if (!document.hidden && !logRequest.current) load();
    };
    const interval = window.setInterval(refresh, 30_000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [follow, load]);

  const visibleLines = search
    ? lines.filter((line) => line.toLowerCase().includes(search.toLowerCase()))
    : lines;

  const scrollToLatest = useCallback(() => {
    const body = bodyRef.current;
    if (!body) return;
    body.scrollTop = body.scrollHeight;
  }, []);

  useLayoutEffect(() => {
    if (!follow) return;
    scrollToLatest();
    const frame = window.requestAnimationFrame(scrollToLatest);
    return () => window.cancelAnimationFrame(frame);
  }, [follow, lines.length, search, scrollToLatest]);

  function selectProject(project: (typeof projects)[number]) {
    setSource("project");
    setTarget(project.id);
    setStream(project.logStreams[0] ?? "access");
  }

  async function copyLogs() {
    await navigator.clipboard.writeText(visibleLines.join("\n"));
  }

  function exportLogs() {
    const blob = new Blob([visibleLines.join("\n")], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${target}-${stream}-${new Date().toISOString().slice(0, 19)}.log`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="log-explorer panel-frame-technical">
      <aside className="log-targets">
        <header>
          <span>PROGRAM TARGETS</span>
          <b>{projects.length}</b>
        </header>
        <div className="log-target-list">
          {projects.map((project) => (
            <button
              key={project.id}
              className={
                source === "project" && target === project.id ? "active" : ""
              }
              onClick={() => selectProject(project)}
            >
              <span className={`target-status ${projectTone(project.state)}`} />
              <div>
                <strong>{project.name}</strong>
                <small>{project.domains[0]}</small>
              </div>
              <em>{project.logStreams.length}</em>
            </button>
          ))}
        </div>
        <header>
          <span>SYSTEM SOURCES</span>
        </header>
        <button
          className={`system-log-target ${source === "service" ? "active" : ""}`}
          onClick={() => {
            setSource("service");
            setTarget("nginx");
          }}
        >
          SYSTEMD SERVICES
        </button>
        <button
          className={`system-log-target ${source === "nginx-error" ? "active" : ""}`}
          onClick={() => {
            setSource("nginx-error");
            setTarget("nginx");
          }}
        >
          NGINX GLOBAL
        </button>
        <button
          className={`system-log-target ${source === "docker" ? "active" : ""}`}
          onClick={() => {
            setSource("docker");
            setTarget("container");
          }}
        >
          DOCKER CONTAINER
        </button>
      </aside>
      <div className="log-console">
        <header className="log-console-toolbar">
          <div>
            <span className="eyebrow">
              {metadata.domain ?? selectedProject?.domains[0] ?? source}
            </span>
            <h2>
              {metadata.project ?? selectedProject?.name ?? "SYSTEM LOG STREAM"}
            </h2>
          </div>
          <div className="log-source-controls">
            {source === "project" && selectedProject ? (
              <div className="stream-tabs">
                {selectedProject.logStreams.map((item) => (
                  <button
                    key={item}
                    className={stream === item ? "active" : ""}
                    onClick={() => setStream(item)}
                  >
                    {item.toUpperCase()}
                  </button>
                ))}
              </div>
            ) : source === "service" ? (
              <select
                value={target}
                onChange={(event) => setTarget(event.target.value)}
              >
                {serviceInventory.map((service) => (
                  <option key={service.name} value={service.name}>
                    {service.name}
                  </option>
                ))}
              </select>
            ) : source === "docker" ? (
              <input
                value={target}
                onChange={(event) => setTarget(event.target.value)}
                placeholder="container name"
              />
            ) : null}
            <button
              className={follow ? "active" : ""}
              onClick={() => setFollow((value) => !value)}
            >
              {follow ? "Ⅱ PAUSE" : "▶ FOLLOW"}
            </button>
            <button onClick={load} disabled={loading}>
              <ArrowClockwise className={loading ? "spin" : ""} /> REFRESH
            </button>
          </div>
        </header>
        <div className="log-filter-bar">
          <label>
            <MagnifyingGlass />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="FILTER CURRENT LOG OUTPUT..."
            />
          </label>
          <span>
            {visibleLines.length}/{lines.length} LINES
          </span>
          {metadata.shared ? (
            <Badge tone="warning">SHARED NGINX LOG</Badge>
          ) : (
            <Badge tone="success">SERVER REDACTED</Badge>
          )}
          <button onClick={copyLogs}>COPY</button>
          <button onClick={exportLogs}>EXPORT</button>
          <button className="latest-log-button" onClick={scrollToLatest}>↓ LATEST</button>
        </div>
        <div className="terminal-head">
          <span>
            <i /> {follow ? "LIVE FOLLOW / 30S" : "PAUSED"} /{" "}
            {metadata.streamLabel ?? stream.toUpperCase()}
          </span>
          <time>
            {metadata.checkedAt ? timeAgo(metadata.checkedAt) : "pending"}
          </time>
        </div>
        <div className="terminal-body tactical-terminal" ref={bodyRef}>
          {error ? (
            <div className="terminal-error">{error}</div>
          ) : visibleLines.length ? (
            visibleLines.map((line, index) => {
              const level = /error|fatal|exception|critical|failed/i.test(line)
                ? "error"
                : /warn|notice|deprecated/i.test(line)
                  ? "warning"
                  : "normal";
              return (
                <div className={`log-line ${level}`} key={`${index}-${line}`}>
                  <span>{String(index + 1).padStart(3, "0")}</span>
                  <code>{line}</code>
                </div>
              );
            })
          ) : (
            <EmptyState
              icon={FileText}
              title="LOG STREAM EMPTY"
              detail="Source tersedia tetapi belum menghasilkan baris log."
            />
          )}
        </div>
      </div>
    </section>
  );
}

function AlertsPage({
  alerts,
  onRefresh,
  refreshing,
  checkedAt,
}: {
  alerts: InfrastructureAlert[];
  onRefresh: () => void;
  refreshing: boolean;
  checkedAt: string | null;
}) {
  const [acknowledged, setAcknowledged] = useState<Set<string>>(
    () => new Set(),
  );
  function acknowledge(title: string) {
    setAcknowledged((current) => {
      const next = new Set(current);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  }
  return (
    <div className="alerts-layout">
      <section className="alert-queue">
        <div className="alert-summary">
          <div>
            <span>{alerts.length}</span>
            <strong>Open signals</strong>
          </div>
          <div>
            <span>{alerts.filter((alert) => alert.severity === "critical").length}</span>
            <strong>Critical</strong>
          </div>
          <div>
            <span>{alerts.filter((alert) => alert.severity === "warning").length}</span>
            <strong>Warning</strong>
          </div>
        </div>
        <div className="alert-audit-toolbar">
          <span>{checkedAt ? `Last checked ${timeAgo(checkedAt)}` : "Audit not checked yet"}</span>
          <button className="quiet-button" onClick={onRefresh} disabled={refreshing}>
            <ArrowClockwise className={refreshing ? "spin" : ""} />
            {refreshing ? "Checking…" : "Refresh audit"}
          </button>
        </div>
        {alerts.map((alert) => (
          <article
            className={`panel alert-card ${alert.severity} ${acknowledged.has(alert.title) ? "acknowledged" : ""}`}
            key={alert.title}
          >
            <span className="alert-symbol">
              <Warning />
            </span>
            <div>
              <div>
                <Badge
                  tone={alert.severity === "critical" ? "danger" : "warning"}
                >
                  {alert.severity}
                </Badge>
                <span className="alert-source">{alert.source}</span>
              </div>
              <h2>{alert.title}</h2>
              <p>{alert.detail}</p>
            </div>
            <time>{alert.age}</time>
            <button
              className="row-action"
              onClick={() => acknowledge(alert.title)}
              title="Review marker is stored for this browser session only"
            >
              {acknowledged.has(alert.title) ? "Mark unreviewed" : "Mark reviewed"}
            </button>
          </article>
        ))}
        {!alerts.length ? (
          <div className="panel alerts-clear-state">
            <CheckCircle />
            <strong>No active infrastructure alerts</strong>
            <span>DNS aliases resolve and the monitored service is active.</span>
          </div>
        ) : null}
      </section>
      <aside className="panel thresholds">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Guardrails</span>
            <h2>Server thresholds</h2>
          </div>
        </div>
        {[
          { label: "Root disk", warn: "≥ 75%", critical: "≥ 85%" },
          { label: "RAM available", warn: "≤ 20%", critical: "≤ 10%" },
          { label: "Swap used", warn: "≥ 40%", critical: "≥ 70%" },
          { label: "Agent stale", warn: "> 2 min", critical: "> 10 min" },
        ].map((item) => (
          <div className="threshold-row" key={item.label}>
            <strong>{item.label}</strong>
            <span>
              Warning <b>{item.warn}</b>
            </span>
            <span>
              Critical <b>{item.critical}</b>
            </span>
          </div>
        ))}
      </aside>
    </div>
  );
}

function SettingsPage({
  data,
  live,
  onSync,
  syncing,
  user,
  canManageGitHub,
}: {
  data: DashboardData | null;
  live: LiveData | null;
  onSync: () => void;
  syncing: boolean;
  user: SessionUser;
  canManageGitHub: boolean;
}) {
  return (
    <div className="page-stack">
      <section className="integration-grid">
        <article className="panel integration-card">
          <span className="integration-icon">
            <GithubLogo />
          </span>
          <div>
            <h2>GitHub</h2>
            <p>Repo, branches, metadata, dan Actions disimpan di MySQL.</p>
          </div>
          <Badge tone={data ? "success" : "warning"}>
            {data ? "CONNECTED" : "NO CACHE"}
          </Badge>
          <dl>
            <div>
              <dt>Repositories</dt>
              <dd>{data?.repositories.length ?? 0}</dd>
            </div>
            <div>
              <dt>Last sync</dt>
              <dd>{timeAgo(data?.syncs[0]?.finished_at)}</dd>
            </div>
          </dl>
          {canManageGitHub ? (
            <button
              className="primary-button"
              onClick={onSync}
              disabled={syncing}
            >
              <ArrowClockwise className={syncing ? "spin" : ""} /> Sync now
            </button>
          ) : (
            <Badge tone="neutral">READ ONLY</Badge>
          )}
        </article>
        <article className="panel integration-card">
          <span className="integration-icon">
            <DesktopTower />
          </span>
          <div>
            <h2>Primary VPS</h2>
            <p>
              SSH terverifikasi untuk metric/log read-only dan action terbatas
              oleh role serta allowlist.
            </p>
          </div>
          <Badge tone={live ? "success" : "warning"}>
            {live ? "LIVE" : "CHECKING"}
          </Badge>
          <dl>
            <div>
              <dt>Host</dt>
              <dd>{live?.hostname ?? "Configured"}</dd>
            </div>
            <div>
              <dt>Polling</dt>
              <dd>Active pages only</dd>
            </div>
          </dl>
        </article>
        <article className="panel integration-card">
          <span className="integration-icon">
            <Database />
          </span>
          <div>
            <h2>MySQL cache</h2>
            <p>Source utama UI untuk data historis dan metadata integration.</p>
          </div>
          <Badge tone={data ? "success" : "warning"}>
            {data ? "ONLINE" : "UNAVAILABLE"}
          </Badge>
          <dl>
            <div>
              <dt>Strategy</dt>
              <dd>Upsert</dd>
            </div>
            <div>
              <dt>UI source</dt>
              <dd>Database first</dd>
            </div>
          </dl>
        </article>
      </section>
      <section className="settings-grid">
        <article className="panel data-policy">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Data policy</span>
              <h2>Fetch and retention</h2>
            </div>
          </div>
          <div className="policy-table">
            <div>
              <strong>GitHub repositories</strong>
              <span>MySQL</span>
              <span>Manual / scheduled 5-15 min</span>
              <span>Latest state</span>
            </div>
            <div>
              <strong>Workflow runs</strong>
              <span>MySQL</span>
              <span>Webhook or scheduled</span>
              <span>90 days</span>
            </div>
            <div>
              <strong>CPU / RAM / disk</strong>
              <span>VPS live</span>
              <span>15-30 sec on active page</span>
              <span>Downsample 30 days</span>
            </div>
            <div>
              <strong>Docker / system logs</strong>
              <span>VPS live</span>
              <span>On demand only</span>
              <span>Not persisted by default</span>
            </div>
          </div>
        </article>
        <article className="panel operator-card">
          <span className="avatar">{user.name.slice(0, 2).toUpperCase()}</span>
          <div>
            <span className="eyebrow">Current operator</span>
            <h2>{user.name}</h2>
            <p>{user.email}</p>
          </div>
          <Badge tone="success">{user.role}</Badge>
        </article>
      </section>
      <section className="panel audit-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Operation history</span>
            <h2>Recent audited actions</h2>
          </div>
          <Badge tone="neutral">LATEST 30</Badge>
        </div>
        {data?.auditLog?.length ? (
          <div className="audit-list">
            {data.auditLog.map((entry) => (
              <article key={entry.id}>
                <span className={`audit-state ${entry.status}`}>
                  {entry.status === "failed" ? (
                    <XCircle />
                  ) : entry.status === "success" ? (
                    <CheckCircle />
                  ) : (
                    <ClockCounterClockwise />
                  )}
                </span>
                <div>
                  <strong>
                    {entry.action_name} {entry.target_name}
                  </strong>
                  <small>
                    {entry.user_name} / {entry.user_role} / {timeAgo(entry.started_at)}
                  </small>
                </div>
                <Badge
                  tone={
                    entry.status === "failed"
                      ? "danger"
                      : entry.status === "running" || entry.status === "scheduled"
                        ? "warning"
                        : "success"
                  }
                >
                  {entry.status}
                </Badge>
                <span className="audit-message">
                  {entry.message || "Action accepted"}
                </span>
              </article>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={ClockCounterClockwise}
            title="Belum ada action"
            detail="Restart service, container, server, dan retry workflow akan tercatat di sini."
          />
        )}
      </section>
    </div>
  );
}

function EventRail({
  data,
  live,
  alerts,
  stale,
  onOpenLogs,
}: {
  data: DashboardData | null;
  live: LiveData | null;
  alerts: InfrastructureAlert[];
  stale: boolean;
  onOpenLogs: (projectId: string) => void;
}) {
  const [criticalOnly, setCriticalOnly] = useState(false);
  const [expanded, setExpanded] = useState("alert-0");
  const failedRuns = (data?.workflowRuns ?? [])
    .filter((run) => run.conclusion === "failure")
    .slice(0, 4);
  const events = [
    ...alerts.map((alert, index) => ({
      id: `alert-${index}`,
      severity: alert.severity,
      title: alert.title,
      source: alert.source,
      time: alert.age,
      body: alert.detail,
      raw: {
        type: "infrastructure_alert",
        source: alert.source,
        status: "open",
      },
      projectId: projects.find(
        (project) =>
          project.domain.includes(alert.source) ||
          String(project.service) === alert.source,
      )?.id,
    })),
    ...failedRuns.map((run) => ({
      id: `run-${run.id}`,
      severity: "critical",
      title: run.workflow_name,
      source: run.full_name,
      time: timeAgo(run.started_at),
      body: `GitHub Actions run #${run.run_number} failed on ${run.branch ?? "unknown branch"}.`,
      raw: {
        type: "github_workflow",
        sha: run.head_sha,
        event: run.event_name,
        actor: run.actor_login,
      },
      projectId: projects.find((project) => project.repo === run.full_name)?.id,
    })),
  ];
  const visibleEvents = criticalOnly
    ? events.filter((event) => event.severity === "critical")
    : events;

  return (
    <aside className="event-rail">
      <header className="event-rail-header">
        <div>
          <span className={stale ? "paused" : "live-dot"} />
          <div>
            <p>RECENT EVENTS</p>
            <strong>{visibleEvents.length} OPEN SIGNALS</strong>
          </div>
        </div>
        <div>
          <button
            onClick={() => setCriticalOnly((value) => !value)}
            title={criticalOnly ? "Show all events" : "Show critical events"}
            aria-pressed={criticalOnly}
          >
            {criticalOnly ? "ALL" : "CRIT"}
          </button>
        </div>
      </header>
      <div className="event-rail-system">
        <span>HOST</span>
        <strong>{live?.hostname ?? "VPS PENDING"}</strong>
        <Badge tone={live && !stale ? "success" : "warning"}>
          {live && !stale ? "ONLINE" : live ? "STALE" : "OFFLINE"}
        </Badge>
      </div>
      <div className="event-feed">
        {visibleEvents.map((event) => {
          const isExpanded = expanded === event.id;
          return (
            <article
              className={`event-item ${event.severity} ${isExpanded ? "expanded" : ""}`}
              key={event.id}
            >
              <button
                className="event-summary"
                onClick={() => setExpanded(isExpanded ? "" : event.id)}
                aria-expanded={isExpanded}
              >
                <span>{isExpanded ? "▾" : "▸"}</span>
                <div>
                  <strong>{event.title}</strong>
                  <small>
                    {event.source} / {event.time}
                  </small>
                </div>
                <Badge
                  tone={event.severity === "critical" ? "danger" : "warning"}
                >
                  {event.severity}
                </Badge>
              </button>
              {isExpanded ? (
                <div className="event-detail">
                  <p>{event.body}</p>
                  <pre>{JSON.stringify(event.raw, null, 2)}</pre>
                  {event.projectId ? (
                    <button onClick={() => onOpenLogs(event.projectId!)}>
                      OPEN PROGRAM LOGS →
                    </button>
                  ) : null}
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
    </aside>
  );
}

function LoginScreen({ onLogin }: { onLogin: (user: SessionUser) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    startTransition(async () => {
      try {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || "Login failed");
        onLogin(payload.user);
      } catch (nextError) {
        setError(
          nextError instanceof Error ? nextError.message : "Login failed",
        );
      }
    });
  }
  return (
    <main className="login-page">
      <section className="login-visual">
        <div className="brand">
          <span className="brand-mark">
            <img src="/icon.svg" alt="" aria-hidden="true" />
          </span>
          <div>
            <strong>Opsdeck</strong>
            <small>Private infrastructure console</small>
          </div>
        </div>
        <div className="login-copy">
          <span className="eyebrow">43.133.155.252 / Jakarta</span>
          <h1>
            Clear operations.
            <br />
            Less noise.
          </h1>
          <p>
            Monitor server, project, Docker, dan delivery dari satu kontrol
            panel yang ringan.
          </p>
        </div>
        <div className="login-telemetry">
          <span>
            <i className="online" /> VPS configured
          </span>
          <span>
            <i className="online" /> MySQL connected
          </span>
          <span>
            <i /> GitHub cache ready
          </span>
        </div>
      </section>
      <section className="login-form-wrap">
        <form onSubmit={submit}>
          <div className="login-form-brand">
            <span className="brand-mark">
              <img src="/icon.svg" alt="" aria-hidden="true" />
            </span>
            <div>
              <strong>Opsdeck</strong>
              <small>Infrastructure console</small>
            </div>
          </div>
          <div>
            <span className="eyebrow">Operator access</span>
            <h2>Sign in to Opsdeck</h2>
            <p>
              Gunakan akun dashboard Anda. Credential integration tidak pernah
              dikirim ke browser.
            </p>
          </div>
          <label>
            Email address
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              autoComplete="email"
              placeholder="operator@example.com"
              required
            />
          </label>
          <label>
            Password
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              required
            />
          </label>
          {error ? (
            <p className="form-error">
              <Warning /> {error}
            </p>
          ) : null}
          <button className="login-button" type="submit" disabled={isPending}>
            {isPending ? "Checking access…" : "Continue"}
          </button>
        </form>
      </section>
    </main>
  );
}

export function DashboardApp() {
  const [active, setActive] = useState<ModuleName>(() => {
    if (typeof window === "undefined") return "Overview";
    const hash = decodeURIComponent(window.location.hash.slice(1));
    return Object.prototype.hasOwnProperty.call(pageMeta, hash)
      ? (hash as ModuleName)
      : "Overview";
  });
  const [user, setUser] = useState<SessionUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [dataError, setDataError] = useState("");
  const [live, setLive] = useState<LiveData | null>(null);
  const [liveError, setLiveError] = useState("");
  const [liveLoading, setLiveLoading] = useState(false);
  const [dnsAudit, setDnsAudit] = useState<{ unresolvedDomains: string[]; checkedAt: string } | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [globalSearch, setGlobalSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [eventRailOpen, setEventRailOpen] = useState(false);
  const [themeReady, setThemeReady] = useState(false);
  const [metricRange, setMetricRange] = useState<"recent" | "day" | "week" | "month">("recent");
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    if (typeof document === "undefined") return "light";
    return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
  });
  const [pendingOperation, setPendingOperation] =
    useState<OperationRequest | null>(null);
  const [operationBusy, setOperationBusy] = useState(false);
  const [operationError, setOperationError] = useState("");
  const [operationNotice, setOperationNotice] = useState<{
    tone: "success" | "danger";
    message: string;
    auditId?: number;
  } | null>(null);
  const [logPreset, setLogPreset] = useState({
    source: "project",
    target: "fintrack",
    key: 0,
  });
  const searchInput = useRef<HTMLInputElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const sidebarCloseButton = useRef<HTMLButtonElement>(null);
  const notificationButton = useRef<HTMLButtonElement>(null);
  const eventRailCloseButton = useRef<HTMLButtonElement>(null);
  const sidebarWasOpen = useRef(false);
  const eventRailWasOpen = useRef(false);
  const dataRequest = useRef<AbortController | null>(null);
  const liveRequest = useRef<AbortController | null>(null);
  const meta = pageMeta[active];
  const NavIcon = icons[active];
  const activeAlerts = useMemo<InfrastructureAlert[]>(() => {
    const next: InfrastructureAlert[] = [];
    if (dnsAudit?.unresolvedDomains.length) {
      next.push({
        severity: "warning",
        title: "Beberapa alias domain tidak memiliki DNS",
        source: "DNS inventory",
        age: "Live audit",
        detail: `${dnsAudit.unresolvedDomains.join(", ")} tidak resolve dari publik.`,
      });
    }
    const schoolStatus = live?.services.find((service) => service.name === "taka-school.service")?.status;
    if (schoolStatus && schoolStatus !== "active") {
      next.push({
        severity: schoolStatus === "failed" ? "critical" : "warning",
        title: "Taka School membutuhkan perhatian",
        source: "taka-school.service",
        age: "Live systemd",
        detail: `Status service terbaru: ${schoolStatus}. Alert akan hilang otomatis setelah service kembali active.`,
      });
    }
    return next;
  }, [dnsAudit, live]);

  const searchResults = useMemo(() => {
    const query = globalSearch.trim().toLowerCase();
    const menuResults = navGroups.flatMap((group) =>
      group.items.map((item) => ({
        id: `menu-${item}`,
        type: "Menu",
        title: item,
        detail: pageMeta[item].description,
        page: item as ModuleName,
        query: "",
      })),
    );
    const projectResults = projects.map((project) => ({
      id: `project-${project.id}`,
      type: "Project",
      title: project.name,
      detail: `${project.domain} · ${project.runtime}`,
      page: "Projects" as ModuleName,
      query: project.name,
    }));
    const serviceResults = serviceInventory.map((service) => ({
      id: `service-${service.name}`,
      type: "Service",
      title: service.name,
      detail: `${service.kind} · ${service.project}`,
      page: "Services" as ModuleName,
      query: service.name,
    }));
    const repositoryResults = (data?.repositories ?? []).map((repository) => ({
      id: `repository-${repository.id}`,
      type: "Repository",
      title: repository.full_name,
      detail: repository.description || `${repository.language ?? "Repository"} · ${repository.default_branch}`,
      page: "CI/CD" as ModuleName,
      query: repository.full_name,
    }));
    const allResults = [
      ...menuResults,
      ...projectResults,
      ...serviceResults,
      ...repositoryResults,
    ];
    if (!query) return allResults.slice(0, 10);
    return allResults
      .filter((item) =>
        `${item.title} ${item.detail} ${item.type}`.toLowerCase().includes(query),
      )
      .slice(0, 12);
  }, [data?.repositories, globalSearch]);

  const navigate = useCallback((page: ModuleName) => {
    setActive(page);
    setSidebarOpen(false);
    setEventRailOpen(false);
    const nextHash = `#${encodeURIComponent(page)}`;
    if (window.location.hash !== nextHash) {
      window.history.pushState(null, "", nextHash);
    }
  }, []);

  const selectSearchResult = useCallback(
    (result: (typeof searchResults)[number]) => {
      setGlobalSearch(result.query);
      setSearchOpen(false);
      navigate(result.page);
    },
    [navigate, searchResults],
  );

  const loadData = useCallback(async () => {
    dataRequest.current?.abort();
    const controller = new AbortController();
    dataRequest.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 20_000);
    setDataLoading(true);
    try {
      const response = await fetch(`/api/dashboard?range=${metricRange}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to load cache");
      setData(payload);
      setDataError("");
    } catch (error) {
      if (!controller.signal.aborted) {
        setDataError(
          error instanceof Error ? error.message : "Unable to load cache",
        );
      }
    } finally {
      window.clearTimeout(timeout);
      if (dataRequest.current === controller) {
        dataRequest.current = null;
        setDataLoading(false);
      }
    }
  }, [metricRange]);

  const loadLive = useCallback(async (force = false) => {
    if (liveRequest.current || document.hidden) return;
    const controller = new AbortController();
    liveRequest.current = controller;
    const timeout = window.setTimeout(() => controller.abort(), 18_000);
    setLiveLoading(true);
    try {
      const response = await fetch(`/api/vps/live${force ? "?refresh=1" : ""}`, {
        cache: "no-store",
        signal: controller.signal,
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to reach VPS");
      setLive(payload);
      setLiveError("");
    } catch (error) {
      setLiveError(
        controller.signal.aborted
          ? "Live check timed out. Last good data is still shown."
          : error instanceof Error
            ? error.message
            : "Unable to reach VPS",
      );
    } finally {
      window.clearTimeout(timeout);
      if (liveRequest.current === controller) liveRequest.current = null;
      setLiveLoading(false);
    }
  }, []);

  const loadAlertAudit = useCallback(async (force = false) => {
    setAuditLoading(true);
    try {
      const response = await fetch(`/api/alerts/audit${force ? "?refresh=1" : ""}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Unable to refresh audit");
      setDnsAudit(payload);
    } catch (error) {
      setDataError(error instanceof Error ? error.message : "Unable to refresh audit");
    } finally {
      setAuditLoading(false);
    }
  }, []);

  const refreshInfrastructureAudit = useCallback(() => {
    void Promise.all([loadAlertAudit(true), loadLive(true), loadData()]);
  }, [loadAlertAudit, loadLive, loadData]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/me", { cache: "no-store" })
      .then(async (response) =>
        response.ok ? (await response.json()).user : null,
      )
      .then((nextUser) => {
        if (!cancelled) setUser(nextUser);
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setAuthLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (user) {
      loadData();
      loadAlertAudit();
    }
  }, [user, loadData, loadAlertAudit]);

  useEffect(() => {
    function readNavigation() {
      const hash = decodeURIComponent(window.location.hash.slice(1));
      if (Object.prototype.hasOwnProperty.call(pageMeta, hash)) {
        setActive(hash as ModuleName);
      }
    }
    window.addEventListener("popstate", readNavigation);
    window.addEventListener("hashchange", readNavigation);
    return () => {
      window.removeEventListener("popstate", readNavigation);
      window.removeEventListener("hashchange", readNavigation);
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
    localStorage.setItem("opsdeck-theme", theme);
    setThemeReady(true);
  }, [theme]);

  useEffect(() => {
    if (sidebarOpen) {
      window.setTimeout(() => sidebarCloseButton.current?.focus(), 20);
    } else if (sidebarWasOpen.current) {
      menuButton.current?.focus();
    }
    sidebarWasOpen.current = sidebarOpen;
  }, [sidebarOpen]);

  useEffect(() => {
    if (eventRailOpen) {
      window.setTimeout(() => eventRailCloseButton.current?.focus(), 20);
    } else if (eventRailWasOpen.current) {
      notificationButton.current?.focus();
    }
    eventRailWasOpen.current = eventRailOpen;
  }, [eventRailOpen]);

  useEffect(() => {
    function closeDrawers(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setSidebarOpen(false);
      setEventRailOpen(false);
      setSearchOpen(false);
      setLogoutConfirmOpen(false);
    }
    document.addEventListener("keydown", closeDrawers);
    return () => document.removeEventListener("keydown", closeDrawers);
  }, []);

  useEffect(() => {
    function focusSearch(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
        searchInput.current?.focus();
      }
    }
    document.addEventListener("keydown", focusSearch);
    return () => document.removeEventListener("keydown", focusSearch);
  }, []);

  const livePages = useMemo(
    () =>
      new Set<ModuleName>([
        "Overview",
        "Servers",
        "Services",
        "Docker",
        "Settings",
      ]),
    [],
  );

  useEffect(() => {
    if (!user || !livePages.has(active)) return;
    const refresh = () => {
      if (!document.hidden) loadLive();
    };
    refresh();
    const interval = window.setInterval(
      refresh,
      active === "Overview" ? 60_000 : 45_000,
    );
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [user, active, livePages, loadLive]);

  useEffect(
    () => () => {
      dataRequest.current?.abort();
      liveRequest.current?.abort();
    },
    [],
  );

  const openOperation = useCallback((operation: OperationRequest) => {
    setOperationError("");
    setPendingOperation(operation);
  }, []);

  const closeOperation = useCallback(() => {
    if (operationBusy) return;
    setOperationError("");
    setPendingOperation(null);
  }, [operationBusy]);

  async function executeOperation(confirmation: string) {
    if (!pendingOperation || !user) return;
    setOperationBusy(true);
    setOperationError("");
    try {
      const response = await fetch(pendingOperation.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Opsdeck-Action": "1",
          "X-Opsdeck-CSRF": user.actionToken,
          "X-Opsdeck-Request-Id": crypto.randomUUID(),
        },
        body: JSON.stringify({ ...pendingOperation.body, confirmation }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Action failed");
      setPendingOperation(null);
      setOperationNotice({
        tone: "success",
        message: payload.message || "Action accepted",
        auditId: payload.auditId,
      });
      await Promise.all([loadData(), loadLive(true)]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Action failed";
      setOperationError(message);
      setOperationNotice({ tone: "danger", message });
    } finally {
      setOperationBusy(false);
    }
  }

  async function syncGitHub() {
    if (!user) return;
    setSyncing(true);
    try {
      const response = await fetch("/api/github/sync", {
        method: "POST",
        headers: {
          "X-Opsdeck-Action": "1",
          "X-Opsdeck-CSRF": user.actionToken,
        },
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Sync failed");
      await loadData();
    } catch (error) {
      setDataError(error instanceof Error ? error.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }

  const rerunWorkflow = useCallback(
    (run: WorkflowRun) => {
      openOperation({
        endpoint: "/api/github/runs/rerun",
        title: `Retry ${run.workflow_name}`,
        description:
          "GitHub akan menjalankan ulang job yang gagal. Status terbaru akan masuk ke cache saat sinkronisasi berikutnya.",
        target: `${run.full_name} #${run.run_number}`,
        action: "retry workflow",
        body: { runId: run.id },
        buttonLabel: "Retry deploy",
      });
    },
    [openOperation],
  );

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
  }

  function openLogs(target: string, source = "service") {
    setLogPreset({ source, target, key: Date.now() });
    navigate("Logs");
  }

  function openProjectLogs(projectId: string) {
    openLogs(projectId, "project");
  }

  if (authLoading) {
    return (
      <main className="loading-page">
        <span className="loading-mark">
          <Pulse weight="fill" />
        </span>
        <div>
          <strong>Opening Opsdeck</strong>
          <span>Checking your session and data sources</span>
        </div>
      </main>
    );
  }
  if (!user) return <LoginScreen onLogin={setUser} />;

  const canRerun = user.role === "owner" || user.role === "admin";
  const visibleTheme = themeReady ? theme : "light";
  let page: React.ReactNode;
  if (active === "Overview") {
    page = (
      <TacticalOverviewPage
        data={data}
        live={live}
        alerts={activeAlerts}
        liveError={liveError}
        onNavigate={navigate}
        onOpenLogs={openProjectLogs}
        metricRange={metricRange}
        setMetricRange={setMetricRange}
      />
    );
  } else if (active === "Servers") {
    page = (
      <ServersPage
        live={live}
        error={liveError}
        refresh={() => loadLive(true)}
        refreshing={liveLoading}
        onOperation={openOperation}
        canReboot={user.role === "owner"}
      />
    );
  } else if (active === "Services") {
    page = (
      <ServicesPage
        live={live}
        onLogs={(target) => openLogs(target)}
        onOperation={openOperation}
        role={user.role}
      />
    );
  } else if (active === "Projects") {
    page = <ProjectsPage onLogs={openProjectLogs} query={globalSearch} />;
  } else if (active === "Docker") {
    page = (
      <DockerPage
        live={live}
        onLogs={(target) => openLogs(target, "docker")}
        onOperation={openOperation}
        role={user.role}
      />
    );
  } else if (active === "Logs") {
    page = (
      <ProjectLogsPage
        key={logPreset.key}
        initialSource={logPreset.source}
        initialTarget={logPreset.target}
      />
    );
  } else if (active === "CI/CD") {
    page = (
      <CiCdPage
        data={data}
        onSync={syncGitHub}
        syncing={syncing}
        onRerun={rerunWorkflow}
        canRerun={canRerun}
        canManage={canRerun}
      />
    );
  } else if (active === "Deployments") {
    page = (
      <DeploymentsPage
        runs={data?.workflowRuns ?? []}
        onRerun={rerunWorkflow}
        canRerun={canRerun}
      />
    );
  } else if (active === "Alerts") {
    page = (
      <AlertsPage
        alerts={activeAlerts}
        onRefresh={refreshInfrastructureAudit}
        refreshing={auditLoading || liveLoading || dataLoading}
        checkedAt={dnsAudit?.checkedAt ?? live?.checkedAt ?? null}
      />
    );
  } else {
    page = (
      <SettingsPage
        data={data}
        live={live}
        onSync={syncGitHub}
        syncing={syncing}
        user={user}
        canManageGitHub={canRerun}
      />
    );
  }

  return (
    <main className={`app-shell${sidebarCollapsed ? ' sidebar-collapsed' : ''}${eventRailOpen ? '' : ''}`}>
      <button
        className={`sidebar-scrim ${sidebarOpen ? "visible" : ""}`}
        onClick={() => setSidebarOpen(false)}
        aria-label="Tutup navigasi"
        aria-hidden={!sidebarOpen}
        tabIndex={sidebarOpen ? 0 : -1}
      />
      <aside
        id="primary-navigation"
        className={`sidebar ${sidebarOpen ? "open" : ""}`}
      >
        <div className="brand">
          <span className="brand-mark">
            <img src="/icon.svg" alt="" aria-hidden="true" />
          </span>
          <div>
            <strong>Opsdeck</strong>
            <small>Infrastructure console</small>
          </div>
          <button
            ref={sidebarCloseButton}
            className="sidebar-close"
            onClick={() => setSidebarOpen(false)}
            aria-label="Tutup navigasi"
          >
            <X />
          </button>
        </div>
        <div className="workspace">
          <span className="workspace-avatar">SP</span>
          <div>
            <strong>Shared production</strong>
            <small>1 VPS / {projects.length} projects</small>
          </div>
          <i className={live ? "online" : ""} />
        </div>
        <nav aria-label="Main navigation">
          {navGroups.map((group) => (
            <div className="nav-group" key={group.label}>
              <p>{group.label}</p>
              {group.items.map((item) => {
                const Icon = icons[item];
                return (
                  <button
                    className={active === item ? "active" : ""}
                    data-nav-active={active === item ? "true" : undefined}
                    onClick={() => navigate(item)}
                    aria-current={active === item ? "page" : undefined}
                    key={item}
                  >
                    <Icon size={18} />
                    <span>{item}</span>
                    {item === "Alerts" && activeAlerts.length ? <b>{activeAlerts.length}</b> : null}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div>
            <div>
              <strong>{user.name}</strong>
              <small>{user.role}</small>
            </div>
          </div>
          <button onClick={() => setLogoutConfirmOpen(true)} aria-label="Sign out">
            <SignOut />
          </button>
        </div>
      </aside>
      <section className="workspace-main" id="main-content">
        <header className="topbar">
          <button
            ref={menuButton}
            className="mobile-menu-button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Buka navigasi"
            aria-controls="primary-navigation"
            aria-expanded={sidebarOpen}
          >
            <List />
          </button>
          <button
            className="sidebar-toggle"
            onClick={() => setSidebarCollapsed((prev) => !prev)}
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <CaretLeft />
          </button>
          <label className="global-search">
            <MagnifyingGlass />
            <input
              ref={searchInput}
              value={globalSearch}
              onFocus={() => setSearchOpen(true)}
              onChange={(event) => {
                setGlobalSearch(event.target.value);
                setSearchOpen(true);
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter" && searchResults[0]) {
                  event.preventDefault();
                  selectSearchResult(searchResults[0]);
                }
              }}
              placeholder="Search projects, domains, services..."
              aria-label="Search projects, domains, and services"
            />
            <kbd>⌘ K</kbd>
          </label>
          <div className="top-actions">
            <span className="live-indicator">
              <i className={live && !liveError ? "online" : ""} />
              {live && !liveError
                ? "VPS live"
                : live
                  ? "VPS stale"
                  : liveLoading
                    ? "Checking"
                    : "VPS offline"}
            </span>
            <button
              aria-label={`Switch to ${visibleTheme === "light" ? "dark" : "light"} mode`}
              onClick={() =>
                setTheme(visibleTheme === "light" ? "dark" : "light")
              }
              title={`Switch to ${visibleTheme === "light" ? "dark" : "light"} mode`}
            >
              {visibleTheme === "light" ? <Moon /> : <Sun />}
            </button>
            <button
              ref={notificationButton}
              aria-label="Open notifications"
              onClick={() => setEventRailOpen(true)}
              aria-controls="notification-drawer"
              aria-expanded={eventRailOpen}
            >
              <Bell />
              {activeAlerts.length ? <b className="notification-count">{activeAlerts.length}</b> : null}
            </button>
          </div>
        </header>
        {searchOpen ? (
          <div className="command-palette-layer" role="presentation">
            <button
              className="command-palette-scrim"
              onClick={() => setSearchOpen(false)}
              aria-label="Close search"
            />
            <section className="command-palette" role="dialog" aria-modal="true" aria-label="Search Opsdeck">
              <div className="command-palette-input">
                <MagnifyingGlass />
                <input
                  value={globalSearch}
                  onChange={(event) => setGlobalSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && searchResults[0]) {
                      event.preventDefault();
                      selectSearchResult(searchResults[0]);
                    }
                  }}
                  placeholder="Search menus, projects, domains, services, repositories..."
                  autoFocus
                />
                <button onClick={() => setSearchOpen(false)} aria-label="Close search">
                  <X />
                </button>
              </div>
              <div className="command-results" role="listbox">
                {searchResults.length ? searchResults.map((result) => (
                  <button
                    key={result.id}
                    role="option"
                    aria-selected="false"
                    onClick={() => selectSearchResult(result)}
                  >
                    <span className="command-result-icon">
                      {result.type === "Menu" ? <SquaresFour /> : result.type === "Project" ? <Stack /> : result.type === "Service" ? <Pulse /> : <GitBranch />}
                    </span>
                    <span>
                      <strong>{result.title}</strong>
                      <small>{result.detail}</small>
                    </span>
                    <em>{result.type}</em>
                  </button>
                )) : (
                  <div className="command-empty">
                    <MagnifyingGlass />
                    <strong>No results found</strong>
                    <span>Try a project, domain, service, repository, or menu name.</span>
                  </div>
                )}
              </div>
              <footer>
                <span><kbd>Enter</kbd> open first result</span>
                <span><kbd>Esc</kbd> close</span>
              </footer>
            </section>
          </div>
        ) : null}
        <div className="workspace-content">
          <header className="page-header">
            <div className="page-title-icon">
              <NavIcon />
            </div>
            <div>
              <span className="eyebrow">{meta.eyebrow}</span>
              <h1>{meta.title}</h1>
              <p>{meta.description}</p>
            </div>
            <div className="page-actions">
              {dataError ? (
                <span className="sync-error">
                  <Warning /> {dataError}
                </span>
              ) : (
                <span className="sync-note">
                  <Database /> {dataLoading ? "Refreshing cache" : `Updated ${timeAgo(data?.fetchedAt)}`}
                </span>
              )}
            </div>
          </header>
          {liveError ? (
            <div className="stale-banner" role="status">
              <Warning />
              <span>{liveError}</span>
              {!live ? (
                <button
                  className="quiet-button"
                  onClick={() => loadLive(true)}
                  disabled={liveLoading}
                >
                  <ArrowClockwise className={liveLoading ? "spin" : ""} />
                  Retry
                </button>
              ) : null}
            </div>
          ) : null}
          {page}
        </div>
      </section>
      <div
        id="notification-drawer"
        className={`event-rail-drawer ${eventRailOpen ? "open" : ""}`}
      >
        <button
          ref={eventRailCloseButton}
          className="event-rail-close"
          onClick={() => setEventRailOpen(false)}
          aria-label="Tutup notifications"
        >
          <X />
        </button>
        <EventRail
          data={data}
          live={live}
          alerts={activeAlerts}
          stale={Boolean(liveError)}
          onOpenLogs={openProjectLogs}
        />
      </div>
      <OperationDialog
        operation={pendingOperation}
        busy={operationBusy}
        error={operationError}
        onCancel={closeOperation}
        onConfirm={executeOperation}
      />
      {logoutConfirmOpen ? (
        <div className="logout-dialog-backdrop" role="presentation">
          <section
            className="logout-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="logout-dialog-title"
            aria-describedby="logout-dialog-description"
          >
            <span className="logout-dialog-icon"><SignOut /></span>
            <div>
              <span className="eyebrow">End session</span>
              <h2 id="logout-dialog-title">Are you sure you want to log out?</h2>
              <p id="logout-dialog-description">
                You will need to sign in again to access the infrastructure console.
              </p>
            </div>
            <footer>
              <button className="quiet-button" onClick={() => setLogoutConfirmOpen(false)} autoFocus>
                Cancel
              </button>
              <button className="logout-confirm-button" onClick={logout}>
                <SignOut /> Log out
              </button>
            </footer>
          </section>
        </div>
      ) : null}
      <OperationNotice
        notice={operationNotice}
        onClose={() => setOperationNotice(null)}
      />
    </main>
  );
}
