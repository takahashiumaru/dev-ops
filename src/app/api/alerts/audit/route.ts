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

async function resolvesPublicly(domain: string) {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("DNS lookup timed out")), 5_000),
  );
  const lookup = Promise.any([
    resolve4(domain).then((records) => records.length > 0),
    resolve6(domain).then((records) => records.length > 0),
    resolveCname(domain).then((records) => records.length > 0),
  ]).catch(() => false);
  return Promise.race([lookup, timeout]).catch(() => false);
}

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const checks = await Promise.all(
    auditedDomains.map(async (domain) => ({
      domain,
      resolved: await resolvesPublicly(domain),
    })),
  );

  return NextResponse.json(
    {
      unresolvedDomains: checks.filter((item) => !item.resolved).map((item) => item.domain),
      checks,
      checkedAt: new Date().toISOString(),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
