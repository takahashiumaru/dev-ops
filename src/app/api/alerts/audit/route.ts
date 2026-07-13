import { resolve4, resolve6, resolveCname } from "node:dns/promises";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const auditedDomains = [
  "apsone.app",
  "hermes.takahashiumaru.my.id",
  "sips.takahashiumaru.my.id",
  "umarmarufmutaqin.my.id",
];

type AuditPayload = {
  unresolvedDomains: string[];
  checks: Array<{ domain: string; resolved: boolean }>;
  checkedAt: string;
};

const globalAudit = globalThis as typeof globalThis & {
  __opsDnsAudit?: { payload?: AuditPayload; expiresAt?: number; pending?: Promise<AuditPayload> };
};

async function resolvesPublicly(domain: string) {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<boolean>((resolve) => {
    timeoutId = setTimeout(() => resolve(false), 5_000);
  });
  const lookup = Promise.any([
    resolve4(domain).then((records) => records.length > 0),
    resolve6(domain).then((records) => records.length > 0),
    resolveCname(domain).then((records) => records.length > 0),
  ]).catch(() => false);
  return Promise.race([lookup, timeout])
    .catch(() => false)
    .finally(() => timeoutId && clearTimeout(timeoutId));
}

async function runAudit(): Promise<AuditPayload> {
  const checks = await Promise.all(
    auditedDomains.map(async (domain) => ({ domain, resolved: await resolvesPublicly(domain) })),
  );
  return {
    unresolvedDomains: checks.filter((item) => !item.resolved).map((item) => item.domain),
    checks,
    checkedAt: new Date().toISOString(),
  };
}

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const force = new URL(request.url).searchParams.get("refresh") === "1";
  globalAudit.__opsDnsAudit ??= {};
  const cache = globalAudit.__opsDnsAudit;
  if (!force && cache.payload && (cache.expiresAt ?? 0) > Date.now()) {
    return NextResponse.json(cache.payload, { headers: { "Cache-Control": "private, max-age=60" } });
  }

  cache.pending ??= runAudit().finally(() => {
    cache.pending = undefined;
  });
  const payload = await cache.pending;
  cache.payload = payload;
  cache.expiresAt = Date.now() + 5 * 60_000;

  return NextResponse.json(
    payload,
    { headers: { "Cache-Control": "no-store" } },
  );
}
