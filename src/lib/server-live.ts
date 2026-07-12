import { Client } from "ssh2";

export type LiveServerData = {
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

function connectConfig() {
  const host = process.env.VPS_HOST;
  const password = process.env.VPS_PASSWORD;
  if (!host || !password) throw new Error("VPS connection is not configured");

  const trustedFingerprints = new Set(
    (process.env.VPS_HOST_FINGERPRINTS || "")
      .split(",")
      .map((fingerprint) => fingerprint.trim().toLowerCase())
      .filter(Boolean),
  );
  if (process.env.NODE_ENV === "production" && trustedFingerprints.size === 0) {
    throw new Error("VPS host verification is not configured");
  }

  return {
    host,
    port: Number(process.env.VPS_PORT || 22),
    username: process.env.VPS_USER || "ubuntu",
    password,
    readyTimeout: 12_000,
    ...(trustedFingerprints.size > 0
      ? {
          hostHash: "sha256",
          hostVerifier: (fingerprint: string) =>
            trustedFingerprints.has(fingerprint.toLowerCase()),
        }
      : {}),
  };
}

export function runRemote(command: string) {
  return new Promise<string>((resolve, reject) => {
    const client = new Client();
    const timeout = setTimeout(() => {
      client.end();
      reject(new Error("VPS request timed out"));
    }, 15_000);

    client
      .on("ready", () => {
        client.exec(command, (error, stream) => {
          if (error) {
            clearTimeout(timeout);
            client.end();
            reject(error);
            return;
          }
          let stdout = "";
          let stderr = "";
          stream.on("data", (chunk: Buffer) => {
            stdout += chunk.toString();
          });
          stream.stderr.on("data", (chunk: Buffer) => {
            stderr += chunk.toString();
          });
          stream.on("close", (code: number) => {
            clearTimeout(timeout);
            client.end();
            if (code !== 0)
              reject(
                new Error(
                  stderr.trim().slice(0, 500) ||
                    `Remote command failed (${code})`,
                ),
              );
            else resolve(stdout.trim());
          });
        });
      })
      .on("error", (error) => {
        clearTimeout(timeout);
        reject(error);
      })
      .connect(connectConfig());
  });
}

function percent(used: number, total: number) {
  return total > 0 ? Math.round((used / total) * 1000) / 10 : 0;
}

export async function getLiveServerData(): Promise<LiveServerData> {
  const command = String.raw`bash -lc '
echo __HOST__; hostname
echo __OS__; . /etc/os-release; echo "$PRETTY_NAME"
echo __KERNEL__; uname -r
echo __UPTIME__; uptime -p
echo __LOAD__; cat /proc/loadavg | cut -d" " -f1-3
echo __CORES__; nproc
echo __CPU__; read id1 t1 < <(awk '\''/^cpu / {t=$2+$3+$4+$5+$6+$7+$8+$9; id=$5+$6; print id, t; exit}'\'' /proc/stat); sleep 0.25; read id2 t2 < <(awk '\''/^cpu / {t=$2+$3+$4+$5+$6+$7+$8+$9; id=$5+$6; print id, t; exit}'\'' /proc/stat); awk -v id1="$id1" -v t1="$t1" -v id2="$id2" -v t2="$t2" '\''BEGIN { dt=t2-t1; did=id2-id1; if (dt>0) print sprintf("%.1f", (1 - did/dt)*100); else print "0.0" }'\''
echo __MEM__; free -b | tail -n +2 | head -n 2
echo __DISK__; df -B1 / | tail -n 1
echo __SERVICES__; for s in nginx php8.3-fpm mysql docker supervisor cron hermes-dashboard.service mnemosyne-dashboard.service; do printf "%s=" "$s"; systemctl is-active "$s" 2>/dev/null || true; done
for s in taka-fintrack.service 9router.service hermes-gateway.service server-monitoring.service taka-school.service; do printf "%s=" "$s"; systemctl --user is-active "$s" 2>/dev/null || true; done
echo __DOCKER_VERSION__; docker version --format "{{.Server.Version}}" 2>/dev/null || echo unavailable
echo __CONTAINERS__; docker ps -a --format "{{json .}}" 2>/dev/null || true
'`;
  const output = await runRemote(command);
  const sections = new Map<string, string[]>();
  let current = "";
  for (const line of output.split("\n")) {
    if (/^__[A-Z_]+__$/.test(line)) {
      current = line.slice(2, -2);
      sections.set(current, []);
    } else if (current) {
      sections.get(current)?.push(line);
    }
  }

  const memoryLines = sections.get("MEM") ?? [];
  const memoryParts = (memoryLines[0] ?? "").trim().split(/\s+/);
  const swapParts = (memoryLines[1] ?? "").trim().split(/\s+/);
  const diskParts = (sections.get("DISK")?.[0] ?? "").trim().split(/\s+/);
  const cores = Number(sections.get("CORES")?.[0] ?? 1);
  const memoryTotal = Number(memoryParts[1] ?? 0);
  const memoryUsed = Number(memoryParts[2] ?? 0);
  const memoryAvailable = Number(memoryParts[6] ?? 0);
  const swapTotal = Number(swapParts[1] ?? 0);
  const swapUsed = Number(swapParts[2] ?? 0);
  const diskTotal = Number(diskParts[1] ?? 0);
  const diskUsed = Number(diskParts[2] ?? 0);
  const diskAvailable = Number(diskParts[3] ?? 0);
  const services = (sections.get("SERVICES") ?? []).map((line) => {
    const [name, status] = line.split("=");
    return { name, status: status || "unknown" };
  });
  const containers = (sections.get("CONTAINERS") ?? []).flatMap((line) => {
    try {
      return [JSON.parse(line) as Record<string, string>];
    } catch {
      return [];
    }
  });

  return {
    hostname: sections.get("HOST")?.[0] ?? "unknown",
    os: sections.get("OS")?.[0] ?? "unknown",
    kernel: sections.get("KERNEL")?.[0] ?? "unknown",
    uptime: sections.get("UPTIME")?.[0] ?? "unknown",
    load: (sections.get("LOAD")?.[0] ?? "0 0 0").split(" ").map(Number),
    cpuPercent: Number(sections.get("CPU")?.[0] ?? 0),
    cores,
    memory: {
      total: memoryTotal,
      used: memoryUsed,
      available: memoryAvailable,
      percent: percent(memoryUsed, memoryTotal),
    },
    swap: {
      total: swapTotal,
      used: swapUsed,
      percent: percent(swapUsed, swapTotal),
    },
    disk: {
      total: diskTotal,
      used: diskUsed,
      available: diskAvailable,
      percent: percent(diskUsed, diskTotal),
    },
    services,
    docker: {
      version: sections.get("DOCKER_VERSION")?.[0] ?? "unavailable",
      containers,
    },
    checkedAt: new Date().toISOString(),
  };
}
