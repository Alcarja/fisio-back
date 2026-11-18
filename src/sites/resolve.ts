import { and, eq } from "drizzle-orm";
import { TtlCache } from "./cache.js";
import { clinicFeature, clinicSite, clinicSiteDomain, db, organization } from "./db.js";
import { env } from "./env.js";

// Which clinic a hostname belongs to (WEBS.md 3.5). The base domain and the
// subdomain rule live only here, so moving to a separate domain (6.2) is a
// configuration change plus one redirect.

export type Resolved =
  // sites.kineflow.es itself: the preview host and CNAME target, not a clinic
  | { kind: "base" }
  // A live clinic site. redirectTo: the same page on its primary host
  | { kind: "clinic"; clinicId: string; primaryHost: string; redirectTo?: string }
  | { kind: "none" };

// Also "not found", so random hostnames don't hit the database each time
const cache = new TtlCache<Resolved>(60_000);

export const purgeResolved = (clinicId: string) => cache.purge(clinicId);

// Lowercase, without port or trailing dot
export function normalizeHost(raw: string | undefined): string {
  return (raw ?? "").toLowerCase().replace(/:\d+$/, "").replace(/\.$/, "");
}

// The public address of a subdomain
export const subdomainHost = (subdomain: string) => `${subdomain}.${env.baseDomain}`;

export async function resolveHost(host: string): Promise<Resolved> {
  if (host === env.baseDomain) return { kind: "base" };
  const cached = cache.get(host);
  if (cached) return cached;

  const result = await lookup(host);
  cache.set(host, result, result.kind === "clinic" ? result.clinicId : null);
  return result;
}

async function lookup(host: string): Promise<Resolved> {
  let clinicId: string | undefined;

  if (host.endsWith(`.${env.baseDomain}`)) {
    const sub = host.slice(0, -(env.baseDomain.length + 1));
    // One label only: a.b.sites.kineflow.es is nobody
    if (!sub || sub.includes(".")) return { kind: "none" };
    const [row] = await db
      .select({ id: clinicSite.organizationId })
      .from(clinicSite)
      .where(eq(clinicSite.subdomain, sub))
      .limit(1);
    clinicId = row?.id;
  } else {
    // An own domain (Phase 4): only once verified
    const [row] = await db
      .select({ id: clinicSiteDomain.organizationId })
      .from(clinicSiteDomain)
      .where(and(eq(clinicSiteDomain.hostname, host), eq(clinicSiteDomain.status, "verified")))
      .limit(1);
    clinicId = row?.id;
  }
  if (!clinicId) return { kind: "none" };

  const live = await liveSite(clinicId);
  if (!live) return { kind: "none" };

  // Every page has one address: the verified primary own domain if there is
  // one, otherwise the subdomain
  const domains = await db
    .select({ hostname: clinicSiteDomain.hostname, isPrimary: clinicSiteDomain.isPrimary })
    .from(clinicSiteDomain)
    .where(and(eq(clinicSiteDomain.organizationId, clinicId), eq(clinicSiteDomain.status, "verified")));
  const primaryHost = domains.find((d) => d.isPrimary)?.hostname ?? subdomainHost(live.subdomain);

  return {
    kind: "clinic",
    clinicId,
    primaryHost,
    redirectTo: host === primaryHost ? undefined : primaryHost,
  };
}

// The clinic's site, if visitors may see it: clinic active, "website" feature
// on, site published
export async function liveSite(clinicId: string) {
  const [row] = await db
    .select({
      subdomain: clinicSite.subdomain,
      status: clinicSite.status,
      clinicStatus: organization.status,
      feature: clinicFeature.feature,
    })
    .from(clinicSite)
    .innerJoin(organization, eq(organization.id, clinicSite.organizationId))
    .leftJoin(
      clinicFeature,
      and(eq(clinicFeature.organizationId, clinicSite.organizationId), eq(clinicFeature.feature, "website")),
    )
    .where(eq(clinicSite.organizationId, clinicId))
    .limit(1);
  if (!row || row.status !== "published" || row.clinicStatus === "inactive" || !row.feature) return null;
  return row;
}
