export type ProjectLogStream = "app" | "access" | "error";

type ProjectLogTarget = {
  label: string;
  domain: string;
  streams: Partial<
    Record<
      ProjectLogStream,
      { label: string; command: string; shared?: boolean }
    >
  >;
};

const tailFile = (path: string) =>
  `if sudo -n test -f ${path}; then sudo -n tail -n 160 -- ${path}; else printf '[INFO] log file belum tersedia: ${path}\\n'; fi`;

const userJournal = (unit: string) =>
  `journalctl --user -u ${unit} -n 160 --no-pager -o short-iso 2>/dev/null`;

const systemJournal = (unit: string) =>
  `sudo -n journalctl -u ${unit} -n 160 --no-pager -o short-iso 2>/dev/null`;

const sharedNginxAccess = {
  label: "Nginx access (shared)",
  command: tailFile("/var/log/nginx/access.log"),
  shared: true,
};
const sharedNginxError = {
  label: "Nginx error (shared)",
  command: tailFile("/var/log/nginx/error.log"),
  shared: true,
};

export const projectLogRegistry: Record<string, ProjectLogTarget> = {
  opsdeck: {
    label: "Opsdeck",
    domain: "dev-ops.takahashiumaru.my.id",
    streams: {
      app: {
        label: "Application journal",
        command: systemJournal("dev-ops-dashboard.service"),
      },
      access: sharedNginxAccess,
      error: sharedNginxError,
    },
  },
  fintrack: {
    label: "Taka FinTrack",
    domain: "takahashiumaru.my.id",
    streams: {
      app: {
        label: "Application journal",
        command: userJournal("taka-fintrack.service"),
      },
      access: sharedNginxAccess,
      error: sharedNginxError,
    },
  },
  "aps-one": {
    label: "APS One",
    domain: "apsone.web.id",
    streams: {
      app: {
        label: "Laravel",
        command: tailFile(
          "/home/ubuntu/project-work-uaps/storage/logs/laravel.log",
        ),
      },
      access: {
        label: "Nginx access",
        command: tailFile("/var/log/nginx/apsone.access.log"),
      },
      error: {
        label: "Nginx error",
        command: tailFile("/var/log/nginx/apsone.error.log"),
      },
    },
  },
  sips: {
    label: "SIPS Alhaq",
    domain: "sips-alhaq.studify.web.id",
    streams: {
      app: {
        label: "Laravel",
        command: tailFile("/home/ubuntu/sips/storage/logs/laravel.log"),
      },
      access: {
        label: "Nginx access",
        command: tailFile("/var/log/nginx/sips.access.log"),
      },
      error: {
        label: "Nginx error",
        command: tailFile("/var/log/nginx/sips.error.log"),
      },
    },
  },
  onigiri: {
    label: "Onigiri Shop",
    domain: "olshop-onigiri.studify.web.id",
    streams: {
      app: {
        label: "Laravel",
        command: tailFile(
          "/home/ubuntu/onigiri-online-shop/storage/logs/laravel.log",
        ),
      },
      access: {
        label: "Nginx access",
        command: tailFile("/var/log/nginx/olshop-onigiri.access.log"),
      },
      error: {
        label: "Nginx error",
        command: tailFile("/var/log/nginx/olshop-onigiri.error.log"),
      },
    },
  },
  router: {
    label: "9Router",
    domain: "takahashiumaru.web.id",
    streams: {
      app: {
        label: "Application journal",
        command: userJournal("9router.service"),
      },
      access: sharedNginxAccess,
      error: sharedNginxError,
    },
  },
  monitor: {
    label: "VPS Monitoring",
    domain: "monitor.takahashiumaru.web.id",
    streams: {
      app: {
        label: "Application journal",
        command: userJournal("server-monitoring.service"),
      },
      access: {
        label: "Nginx access",
        command: tailFile(
          "/var/log/nginx/monitor.takahashiumaru.web.id-access.log",
        ),
      },
      error: {
        label: "Nginx error",
        command: tailFile(
          "/var/log/nginx/monitor.takahashiumaru.web.id-error.log",
        ),
      },
    },
  },
  hermes: {
    label: "Hermes Dashboard",
    domain: "hermes.takahashiumaru.my.id",
    streams: {
      app: {
        label: "Application journal",
        command: systemJournal("hermes-dashboard.service"),
      },
      access: sharedNginxAccess,
      error: sharedNginxError,
    },
  },
  portfolio: {
    label: "Umar Portfolio",
    domain: "portofolio.takahashiumaru.my.id",
    streams: {
      access: {
        label: "Nginx access",
        command: tailFile("/var/log/nginx/umar-portfolio.access.log"),
      },
      error: {
        label: "Nginx error",
        command: tailFile("/var/log/nginx/umar-portfolio.error.log"),
      },
    },
  },
  grafana: {
    label: "Grafana Proxy",
    domain: "grafana.takahashiumaru.web.id",
    streams: {
      access: {
        label: "Nginx access",
        command: tailFile(
          "/var/log/nginx/grafana.takahashiumaru.web.id-access.log",
        ),
      },
      error: {
        label: "Nginx error",
        command: tailFile(
          "/var/log/nginx/grafana.takahashiumaru.web.id-error.log",
        ),
      },
    },
  },
  "umar-proxy": {
    label: "Umar App Proxy",
    domain: "umarmarufmutaqin.my.id",
    streams: {
      access: sharedNginxAccess,
      error: sharedNginxError,
    },
  },
};

export function getProjectLogTarget(projectId: string, stream: string) {
  if (!Object.prototype.hasOwnProperty.call(projectLogRegistry, projectId))
    return null;
  if (!(["app", "access", "error"] as string[]).includes(stream)) return null;
  const project = projectLogRegistry[projectId];
  const target = project.streams[stream as ProjectLogStream];
  return target
    ? { ...target, project: project.label, domain: project.domain, stream }
    : null;
}

export function redactLogLine(line: string) {
  return line
    .replace(
      /(authorization\s*[:=]\s*)(?:bearer\s+)?[^\s,;]+/gi,
      "$1[REDACTED]",
    )
    .replace(/(cookie\s*[:=]\s*)[^\r\n]+/gi, "$1[REDACTED]")
    .replace(
      /((?:password|passwd|token|secret|api[_-]?key|private[_-]?key)\s*[=:]\s*)[^\s,;&]+/gi,
      "$1[REDACTED]",
    )
    .replace(/([?&](?:token|key|secret|password)=)[^&\s]+/gi, "$1[REDACTED]")
    .replace(
      /\b(?:mysql|postgres(?:ql)?):\/\/[^\s]+/gi,
      "[REDACTED_DATABASE_URL]",
    );
}
