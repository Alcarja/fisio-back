// The sites service (Phase 3) keeps each clinic's published site in memory for
// 60 s. After publishing, unpublishing or changing the address, the API asks
// it to forget that clinic so the change shows at once. If the service is down
// or not running yet, nothing happens: the cache expires by itself.

const SITES_URL = process.env.SITES_INTERNAL_URL ?? "http://127.0.0.1:3001";

export async function purgeSitesCache(clinicId: string): Promise<void> {
  const key = process.env.SITES_PREVIEW_SECRET;
  if (!key) return;
  try {
    await fetch(`${SITES_URL}/_purge`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Purge-Key": key },
      body: JSON.stringify({ clinicId }),
      signal: AbortSignal.timeout(2000),
    });
  } catch {
    // Sites service down: the cache expires in 60 s anyway
  }
}

// The domain the free addresses hang from: <subdomain>.sites.kineflow.es.
// The base itself (sites.kineflow.es) is the preview host and the CNAME target
// for clinics' own domains. To move to a separate domain: WEBS.md 6.2
export const siteBaseDomain = () => process.env.SITES_BASE_DOMAIN ?? "sites.kineflow.es";

// https in production. Locally SITES_PUBLIC_PROTOCOL=http and
// SITES_PUBLIC_PORT=3001 (the sites service: http://demo.localhost:3001)
const publicSuffix = () => (process.env.SITES_PUBLIC_PORT ? `:${process.env.SITES_PUBLIC_PORT}` : "");
const publicProtocol = () => process.env.SITES_PUBLIC_PROTOCOL ?? "https";

export const subdomainUrl = (subdomain: string) =>
  `${publicProtocol()}://${subdomain}.${siteBaseDomain()}${publicSuffix()}`;

// Where the preview is served: the base host itself (https://sites.kineflow.es)
export const previewOrigin = () => `${publicProtocol()}://${siteBaseDomain()}${publicSuffix()}`;

// A clinic's own connected domain (https://activapilates.es). No port: own
// domains only exist behind Caddy
export const domainUrl = (hostname: string) => `${publicProtocol()}://${hostname}`;
