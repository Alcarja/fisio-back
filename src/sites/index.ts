// Must be first: refuses to start with the API's secrets
import { env, appOrigin } from "./env.js";
import { timingSafeEqual } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import express, { type NextFunction, type Request, type Response } from "express";
import { and, eq } from "drizzle-orm";
import { readPreviewToken } from "../lib/siteTokens.js";
import { TtlCache } from "./cache.js";
import { loadPageData } from "./data.js";
import { clinicSiteImage, db, pool } from "./db.js";
import { notFoundHtml } from "./pages/NotFound.js";
import { PAGE_PATHS, renderPage } from "./render.js";
import { normalizeHost, purgeResolved, resolveHost, type Resolved } from "./resolve.js";
import { CONTENT_PAGES, pageAvailable } from "./templates/shared/pages.js";
import type { SitePage } from "./templates/types.js";

// The sites service (WEBS.md Phase 3): serves the clinics' published websites
// on <subdomain>.sites.kineflow.es and their own domains, and the draft preview
// on sites.kineflow.es/_preview. Its own process on 127.0.0.1:3001, behind
// Caddy, with a read-only database user. Run: node dist/sites/index.js

const app = express();
app.disable("x-powered-by");

// Path → page (render.tsx PAGE_PATHS, read the other way)
const PAGES: Record<string, SitePage> = Object.fromEntries(
  Object.entries(PAGE_PATHS).map(([page, path]) => [path, page as SitePage]),
);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Rendered pages, 60 s per host + path (emptied per clinic by /_purge)
const pageCache = new TtlCache<{ html: string; scriptHashes: string[] }>(60_000, 2000);

// The self-hosted fonts, read once at startup (a fixed list: no paths from the URL)
const fontsDir = new URL("../../sites-assets/fonts/", import.meta.url);
const fonts = new Map(
  readdirSync(fontsDir)
    .filter((f) => f.endsWith(".woff2"))
    .map((f) => [f, readFileSync(new URL(f, fontsDir))]),
);

const publicOrigin = (host: string) => `${env.publicProtocol}://${host}${env.publicPort}`;

// Headers on every response
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});

function csp(scriptHashes: string[], frameAncestors: string) {
  return [
    "default-src 'self'",
    "img-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    `frame-src ${appOrigin}`,
    `script-src ${scriptHashes.length ? scriptHashes.join(" ") : "'none'"}`,
    `frame-ancestors ${frameAncestors}`,
    "base-uri 'none'",
    "form-action 'none'",
    "object-src 'none'",
  ].join("; ");
}

function sendNotFound(res: Response) {
  res.status(404);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=60");
  res.setHeader("X-Robots-Tag", "noindex");
  res.setHeader("Content-Security-Policy", csp([], "'none'"));
  res.send(notFoundHtml(env.appUrl));
}

// Internal routes: only from this machine, never through Caddy (which adds
// X-Forwarded-For to everything it proxies)
function fromThisMachine(req: Request) {
  const ip = req.socket.remoteAddress ?? "";
  const local = ip === "127.0.0.1" || ip === "::1" || ip === "::ffff:127.0.0.1";
  return local && !req.headers["x-forwarded-for"];
}

// ---------- Internal ----------

// GET /_domain-check?domain= → 200 if Caddy may get a certificate for it
// (WEBS.md 3.7): the base host, a live clinic subdomain, a verified own domain
app.get("/_domain-check", async (req, res, next) => {
  try {
    if (!fromThisMachine(req)) return sendNotFound(res);
    const domain = normalizeHost(typeof req.query.domain === "string" ? req.query.domain : "");
    const resolved = domain ? await resolveHost(domain) : { kind: "none" as const };
    res.status(resolved.kind === "none" ? 404 : 200).end();
  } catch (error) {
    next(error);
  }
});

// POST /_purge { clinicId } with X-Purge-Key → forget that clinic now (API, 2.7)
app.post("/_purge", express.json({ limit: "1kb" }), (req, res) => {
  const key = process.env.SITES_PREVIEW_SECRET ?? "";
  const given = String(req.headers["x-purge-key"] ?? "");
  const valid =
    fromThisMachine(req) &&
    key.length >= 32 &&
    given.length === key.length &&
    timingSafeEqual(Buffer.from(given), Buffer.from(key));
  if (!valid) return sendNotFound(res);
  const clinicId = req.body?.clinicId;
  if (typeof clinicId === "string") {
    purgeResolved(clinicId);
    pageCache.purge(clinicId);
  }
  res.status(204).end();
});

// ---------- Assets ----------

app.get("/_fonts/:file", (req, res) => {
  const font = fonts.get(req.params.file);
  if (!font) return res.status(404).end();
  res.setHeader("Content-Type", "font/woff2");
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.end(font);
});

// GET /_img/:id → an image of THIS clinic only. In the preview (base host)
// the token says which clinic
app.get("/_img/:id", async (req, res, next) => {
  try {
    const host = normalizeHost(req.headers.host);
    const resolved = await resolveHost(host);
    const token = typeof req.query.t === "string" ? req.query.t : null;
    const clinicId =
      resolved.kind === "clinic" ? resolved.clinicId : resolved.kind === "base" && token ? readPreviewToken(token) : null;
    if (!clinicId || !UUID.test(req.params.id)) return res.status(404).end();

    const [image] = await db
      .select({ mimeType: clinicSiteImage.mimeType, data: clinicSiteImage.data })
      .from(clinicSiteImage)
      .where(and(eq(clinicSiteImage.id, req.params.id), eq(clinicSiteImage.organizationId, clinicId)))
      .limit(1);
    if (!image) return res.status(404).end();
    res.setHeader("Content-Type", image.mimeType);
    // An id's image never changes. Preview images aren't public yet
    res.setHeader("Cache-Control", token ? "private, no-store" : "public, max-age=31536000, immutable");
    res.end(image.data);
  } catch (error) {
    next(error);
  }
});

// ---------- Preview ----------

// GET /_preview?t= on the base host → the clinic's DRAFT, for the Mi web
// editor's frame (only kineflow.es may frame it)
app.get("/_preview", async (req, res, next) => {
  try {
    const host = normalizeHost(req.headers.host);
    const token = typeof req.query.t === "string" ? req.query.t : "";
    const clinicId = host === env.baseDomain ? readPreviewToken(token) : null;
    const data = clinicId ? await loadPageData(clinicId, "draft") : null;
    if (!data) return sendNotFound(res);

    const { html, scriptHashes } = renderPage({ data, page: "home", origin: publicOrigin(host), previewToken: token })!;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Robots-Tag", "noindex, nofollow");
    res.setHeader("Content-Security-Policy", csp(scriptHashes, appOrigin));
    res.send(html);
  } catch (error) {
    next(error);
  }
});

// ---------- Clinic sites ----------

// The clinic of this request, or an answer already sent (404 or redirect)
async function clinicFor(req: Request, res: Response): Promise<Extract<Resolved, { kind: "clinic" }> | null> {
  const resolved = await resolveHost(normalizeHost(req.headers.host));
  if (resolved.kind === "base") {
    // sites.kineflow.es itself isn't a website
    res.redirect(301, env.appUrl);
    return null;
  }
  if (resolved.kind === "none") {
    sendNotFound(res);
    return null;
  }
  if (resolved.redirectTo) {
    res.redirect(301, `${publicOrigin(resolved.redirectTo)}${req.originalUrl}`);
    return null;
  }
  return resolved;
}

app.get("/robots.txt", async (req, res, next) => {
  try {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    const resolved = await resolveHost(normalizeHost(req.headers.host));
    if (resolved.kind !== "clinic" || resolved.redirectTo) {
      return res.send("User-agent: *\nDisallow: /\n");
    }
    res.send(`User-agent: *\nAllow: /\nDisallow: /_preview\n\nSitemap: ${publicOrigin(resolved.primaryHost)}/sitemap.xml\n`);
  } catch (error) {
    next(error);
  }
});

app.get("/sitemap.xml", async (req, res, next) => {
  try {
    const clinic = await clinicFor(req, res);
    if (!clinic) return;
    const origin = publicOrigin(clinic.primaryHost);
    const data = await loadPageData(clinic.clinicId, "published");
    if (!data) return sendNotFound(res);
    // Only the content pages this clinic has something for
    const paths = Object.entries(PAGES)
      .filter(([, page]) => !(CONTENT_PAGES as readonly string[]).includes(page) || pageAvailable(page as (typeof CONTENT_PAGES)[number], data))
      .map(([path]) => path);
    const urls = paths.map((path) => `<url><loc>${origin}${path}</loc></url>`);
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.join("")}</urlset>\n`);
  } catch (error) {
    next(error);
  }
});

app.get(Object.keys(PAGES), async (req, res, next) => {
  try {
    const clinic = await clinicFor(req, res);
    if (!clinic) return;
    const page = PAGES[req.path]!;
    const key = `${clinic.primaryHost}${req.path}`;

    let rendered = pageCache.get(key);
    if (!rendered) {
      const data = await loadPageData(clinic.clinicId, "published");
      if (!data) return sendNotFound(res);
      const page_ = renderPage({ data, page, origin: publicOrigin(clinic.primaryHost) });
      if (!page_) return sendNotFound(res);
      rendered = page_;
      pageCache.set(key, rendered, clinic.clinicId);
    }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=60");
    res.setHeader("Content-Security-Policy", csp(rendered.scriptHashes, "'none'"));
    res.send(rendered.html);
  } catch (error) {
    next(error);
  }
});

// Anything else
app.use((_req, res) => sendNotFound(res));

// Errors: the path and the error in the log (no visitor data), a plain page
// to the visitor
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((error: unknown, req: Request, res: Response, _next: NextFunction) => {
  console.error(`[sites] ${req.method} ${req.path} failed:`, error instanceof Error ? error.message : error);
  if (res.headersSent) return;
  res.status(500).setHeader("Content-Type", "text/plain; charset=utf-8").send("Algo ha fallado. Inténtalo de nuevo en un momento.");
});

pool.on("error", (error) => console.error("[sites] database pool error:", error.message));

app.listen(env.port, env.host, () => {
  console.log(`Sites service on http://${env.host}:${env.port} (base domain ${env.baseDomain})`);
});
