"use client";

import { useEffect, useState } from "react";

type HealthState = {
  ok: boolean;
  database?: {
    connected: boolean;
    name?: string | null;
    usersTable?: boolean;
    usersCount?: number;
  };
  latencyMs?: number;
  checkedAt?: string;
  error?: string;
};

export function LiveStatus() {
  const [health, setHealth] = useState<HealthState | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const response = await fetch("/api/health", { cache: "no-store" });
        const payload = (await response.json()) as HealthState;
        if (!cancelled) setHealth(payload);
      } catch (error) {
        if (!cancelled) {
          setHealth({ ok: false, error: error instanceof Error ? error.message : "Unable to reach API" });
        }
      }
    }

    load();
    const interval = window.setInterval(load, 120_000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  const online = Boolean(health?.ok && health.database?.connected);

  return (
    <section className="live-status panel-cut">
      <div>
        <p className="micro-label">Database link</p>
        <h3>{online ? "MYSQL ONLINE" : "MYSQL PENDING"}</h3>
      </div>
      <div className={online ? "status-light online" : "status-light warning"} aria-hidden="true" />
      <dl>
        <div>
          <dt>schema</dt>
          <dd>{health?.database?.name ?? "not connected"}</dd>
        </div>
        <div>
          <dt>users</dt>
          <dd>{typeof health?.database?.usersCount === "number" ? health.database.usersCount : "n/a"}</dd>
        </div>
        <div>
          <dt>latency</dt>
          <dd>{typeof health?.latencyMs === "number" ? `${health.latencyMs}ms` : "n/a"}</dd>
        </div>
      </dl>
      {!online ? <p className="status-note">Set DATABASE_URL at runtime after migration. Secrets are never exposed to the client.</p> : null}
    </section>
  );
}
