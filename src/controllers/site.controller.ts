import type { Request, Response } from "express";
import { and, asc, eq, inArray, lt, ne, notInArray, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import {
  clinicLegal,
  clinicSite,
  clinicSiteDomain,
  clinicSiteImage,
  member,
  memberPublicProfile,
  organization,
  user,
} from "../db/schema.js";
import { optionalText } from "../lib/exercises.js";
import { readUploadedImage } from "../lib/images.js";
import {
  emptySiteContent,
  missingLegal,
  parseSiteContent,
  publishProblems,
  siteImageIds,
  type SiteContent,
  type SiteLegal,
} from "../lib/site.js";
import { checkClinicDomain, domainsConfigured, newVerifyToken, parseDomain, serverIpv4 } from "../lib/domains.js";
import { domainUrl, previewOrigin, purgeSitesCache, siteBaseDomain, subdomainUrl } from "../lib/sitesCache.js";
import { DEFAULT_TEMPLATE, isTemplateAllowed, templatesFor } from "../lib/siteTemplates.js";
import { makePreviewToken, previewConfigured } from "../lib/siteTokens.js";

// Mi web of the active clinic (site.routes.ts): owners and admins, in clinics
// with the "website" feature. The clinic is always req.clinicId (from the
// session), so nobody reaches another clinic's site by changing an id.
// What visitors see is served by the sites service (Phase 3), not from here.

const send = (res: Response, status: number, code: string, message: string) =>
  res.status(status).json({ error: { code, message } });

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ---------- Subdomains ----------

const SUBDOMAIN_PATTERN = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/;

// Addresses we may need ourselves, or that would look official
const RESERVED_SUBDOMAINS = new Set([
  "www", "sites", "site", "app", "api", "admin", "mail", "email", "smtp", "imap", "pop",
  "webmail", "preview", "static", "cdn", "assets", "img", "status", "help", "ayuda",
  "soporte", "support", "blog", "docs", "dev", "test", "staging", "demo", "ftp", "ns1",
  "ns2", "autodiscover", "login", "cuenta", "reservar", "web",
]);

function subdomainProblem(subdomain: string): string | null {
  if (!SUBDOMAIN_PATTERN.test(subdomain)) {
    return "Usa solo letras minúsculas, números y guiones (no al principio ni al final), hasta 63 caracteres";
  }
  if (RESERVED_SUBDOMAINS.has(subdomain) || subdomain.includes("kineflow")) {
    return "Esa dirección está reservada. Elige otra.";
  }
  return null;
}

// The clinic's slug as a valid subdomain ("Clínica Ñandú" → "clinica-nandu")
function slugToSubdomain(slug: string) {
  const s = slug
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .slice(0, 55)
    .replace(/-+$/, "");
  return s && !subdomainProblem(s) ? s : "clinica";
}

// ---------- Loading ----------

const siteColumns = {
  subdomain: clinicSite.subdomain,
  template: clinicSite.template,
  customTemplate: clinicSite.customTemplate,
  draft: clinicSite.draft,
  published: clinicSite.published,
  publishedTemplate: clinicSite.publishedTemplate,
  status: clinicSite.status,
  publishedAt: clinicSite.publishedAt,
  showKineflowCredit: clinicSite.showKineflowCredit,
  updatedAt: clinicSite.updatedAt,
  // jsonb compares by value, so key order doesn't matter
  hasUnpublishedChanges: sql<boolean>`(${clinicSite.draft} is distinct from ${clinicSite.published} or ${clinicSite.template} is distinct from ${clinicSite.publishedTemplate})`,
};

type Site = Awaited<ReturnType<typeof loadSite>>;

async function loadSite(clinicId: string) {
  const [site] = await db
    .select(siteColumns)
    .from(clinicSite)
    .where(eq(clinicSite.organizationId, clinicId))
    .limit(1);
  return site;
}

// The clinic's site, created the first time with example texts and the
// clinic's slug as its address (slug-2, slug-3… if taken)
async function ensureSite(clinicId: string): Promise<NonNullable<Site>> {
  const existing = await loadSite(clinicId);
  if (existing) return existing;

  const [clinic] = await db
    .select({ name: organization.name, slug: organization.slug })
    .from(organization)
    .where(eq(organization.id, clinicId))
    .limit(1);
  const base = slugToSubdomain(clinic!.slug);

  for (let i = 1; i <= 50; i++) {
    const subdomain = i === 1 ? base : `${base}-${i}`;
    // Conflicts on the clinic (created meanwhile) or the subdomain (taken)
    await db
      .insert(clinicSite)
      .values({
        organizationId: clinicId,
        subdomain,
        template: DEFAULT_TEMPLATE,
        draft: emptySiteContent(clinic!.name),
      })
      .onConflictDoNothing();
    const created = await loadSite(clinicId);
    if (created) return created;
  }
  throw new Error("No free subdomain for the clinic's site");
}

async function loadLegal(clinicId: string): Promise<SiteLegal | null> {
  const [legal] = await db
    .select({
      legalName: clinicLegal.legalName,
      taxId: clinicLegal.taxId,
      address: clinicLegal.address,
      postalCode: clinicLegal.postalCode,
      city: clinicLegal.city,
    })
    .from(clinicLegal)
    .where(eq(clinicLegal.organizationId, clinicId))
    .limit(1);
  return legal ?? null;
}

// ---------- Own domain (WEBS.md Phase 4) ----------

// The clinic's domain as Mi web shows it: the hostnames with their status and
// the DNS records to add. null without a domain
async function loadDomain(clinicId: string) {
  const rows = await db
    .select({
      hostname: clinicSiteDomain.hostname,
      isPrimary: clinicSiteDomain.isPrimary,
      status: clinicSiteDomain.status,
      lastError: clinicSiteDomain.lastError,
      lastCheckedAt: clinicSiteDomain.lastCheckedAt,
      verifiedAt: clinicSiteDomain.verifiedAt,
      verifyToken: clinicSiteDomain.verifyToken,
    })
    .from(clinicSiteDomain)
    .where(eq(clinicSiteDomain.organizationId, clinicId));
  if (!rows.length) return null;
  const apex = rows.map((r) => r.hostname).sort((a, b) => a.length - b.length)[0]!;
  const primary = rows.find((r) => r.isPrimary)?.hostname ?? apex;
  return {
    apex,
    primary: primary === apex ? ("apex" as const) : ("www" as const),
    hosts: rows
      .sort((a, b) => a.hostname.length - b.hostname.length)
      .map(({ verifyToken: _token, ...r }) => r),
    records: [
      { type: "A", name: "@", value: serverIpv4() ?? "" },
      { type: "CNAME", name: "www", value: siteBaseDomain() },
      { type: "TXT", name: "_kineflow", value: rows[0]!.verifyToken },
    ],
  };
}

// The address visitors see: the connected primary domain, or the subdomain
function publicUrlOf(subdomain: string, domain: Awaited<ReturnType<typeof loadDomain>>) {
  const primary = domain?.hosts.find((h) => h.isPrimary && h.status === "verified");
  return primary ? domainUrl(primary.hostname) : subdomainUrl(subdomain);
}

// What every Mi web call answers with: the site and everything the editor needs
async function siteResponse(clinicId: string) {
  const site = await ensureSite(clinicId);
  const [legal, domain] = await Promise.all([loadLegal(clinicId), loadDomain(clinicId)]);
  return {
    site,
    templates: templatesFor(site.customTemplate),
    legal,
    legalMissing: missingLegal(legal),
    problems: publishProblems(site.draft, legal),
    publicUrl: publicUrlOf(site.subdomain, domain),
    subdomainUrl: subdomainUrl(site.subdomain),
    previewAvailable: previewConfigured(),
    domainsAvailable: domainsConfigured(),
    domain,
  };
}

// ---------- Site ----------

// GET /clinic/site -> { site, templates, legal, legalMissing, problems, publicUrl, previewAvailable }
export const getSite = async (req: Request, res: Response) => {
  res.json(await siteResponse(req.clinicId!));
};

// The content's images exist, belong to this clinic and are of the right kind
async function imagesProblem(clinicId: string, content: SiteContent): Promise<string | null> {
  const byKind = siteImageIds(content);
  const ids = [...byKind.logo, ...byKind.cover, ...byKind.gallery];
  if (!ids.length) return null;
  const found = await db
    .select({ id: clinicSiteImage.id, kind: clinicSiteImage.kind })
    .from(clinicSiteImage)
    .where(and(eq(clinicSiteImage.organizationId, clinicId), inArray(clinicSiteImage.id, ids)));
  const kindOf = new Map(found.map((i) => [i.id, i.kind]));
  for (const [kind, list] of Object.entries(byKind)) {
    if (list.some((id) => kindOf.get(id) !== kind)) {
      return "Una de las fotos ya no existe. Vuelve a subirla.";
    }
  }
  return null;
}

// PUT /clinic/site/draft -> the same as GET. body: { content, template? }
// Saves what the clinic is editing; visitors don't see it until it's published
export const saveDraft = async (req: Request, res: Response) => {
  const clinicId = req.clinicId!;
  const site = await ensureSite(clinicId);
  const parsed = parseSiteContent(req.body?.content);
  if (!parsed.ok) return send(res, 400, "INVALID_CONTENT", parsed.error);

  const template = req.body?.template;
  if (template !== undefined && !isTemplateAllowed(template, site.customTemplate)) {
    return send(res, 400, "INVALID_TEMPLATE", "Esa plantilla no está disponible");
  }
  const problem = await imagesProblem(clinicId, parsed.value);
  if (problem) return send(res, 400, "INVALID_IMAGE", problem);

  await db
    .update(clinicSite)
    .set({
      draft: parsed.value,
      ...(template !== undefined && { template: template as string }),
      updatedBy: req.user!.id,
    })
    .where(eq(clinicSite.organizationId, clinicId));
  res.json(await siteResponse(clinicId));
};

// PUT /clinic/site/subdomain -> the same as GET. body: { subdomain }
export const changeSubdomain = async (req: Request, res: Response) => {
  const clinicId = req.clinicId!;
  const site = await ensureSite(clinicId);
  const raw = req.body?.subdomain;
  const subdomain = typeof raw === "string" ? raw.trim().toLowerCase() : "";
  const problem = subdomainProblem(subdomain);
  if (problem) return send(res, 400, "INVALID_SUBDOMAIN", problem);
  if (subdomain === site.subdomain) return res.json(await siteResponse(clinicId));

  const taken = () => send(res, 409, "SUBDOMAIN_TAKEN", "Esa dirección ya la usa otra clínica");
  const [other] = await db
    .select({ id: clinicSite.organizationId })
    .from(clinicSite)
    .where(and(eq(clinicSite.subdomain, subdomain), ne(clinicSite.organizationId, clinicId)))
    .limit(1);
  if (other) return taken();

  try {
    await db
      .update(clinicSite)
      .set({ subdomain, updatedBy: req.user!.id })
      .where(eq(clinicSite.organizationId, clinicId));
  } catch (error) {
    // Taken by another clinic between the check and the update
    if ((error as { cause?: { code?: string } }).cause?.code === "23505") return taken();
    throw error;
  }
  console.log(`[site] subdomain changed clinic=${clinicId} by=${req.user!.id}`);
  // The old address stops working at once
  await purgeSitesCache(clinicId);
  res.json(await siteResponse(clinicId));
};

// POST /clinic/site/publish -> the same as GET
// 400 CANNOT_PUBLISH with { problems } if something's missing
export const publishSite = async (req: Request, res: Response) => {
  const clinicId = req.clinicId!;
  const site = await ensureSite(clinicId);
  const problems = publishProblems(site.draft, await loadLegal(clinicId));
  if (!isTemplateAllowed(site.template, site.customTemplate)) problems.push("Elige una plantilla.");
  if (problems.length) {
    return res.status(400).json({
      error: { code: "CANNOT_PUBLISH", message: problems.join(" "), problems },
    });
  }

  await db
    .update(clinicSite)
    .set({
      published: sql`${clinicSite.draft}`,
      publishedTemplate: sql`${clinicSite.template}`,
      status: "published",
      publishedAt: new Date(),
      updatedBy: req.user!.id,
    })
    .where(eq(clinicSite.organizationId, clinicId));
  // Not clinical: the server log is enough (never the content)
  console.log(`[site] published clinic=${clinicId} by=${req.user!.id}`);
  await deleteUnusedImages(clinicId);
  await purgeSitesCache(clinicId);
  res.json(await siteResponse(clinicId));
};

// POST /clinic/site/unpublish -> the same as GET. The site goes offline
// (visitors get a "not found" page) until it's published again
export const unpublishSite = async (req: Request, res: Response) => {
  const clinicId = req.clinicId!;
  const site = await ensureSite(clinicId);
  if (site.status !== "published") {
    return send(res, 400, "NOT_PUBLISHED", "Tu web no está publicada");
  }
  await db
    .update(clinicSite)
    .set({ status: "offline", updatedBy: req.user!.id })
    .where(eq(clinicSite.organizationId, clinicId));
  console.log(`[site] unpublished clinic=${clinicId} by=${req.user!.id}`);
  await purgeSitesCache(clinicId);
  res.json(await siteResponse(clinicId));
};

// POST /clinic/site/preview-token -> { url, expiresAt }
// A link to see the draft for 15 minutes (served by the sites service)
export const createPreviewToken = async (req: Request, res: Response) => {
  if (!previewConfigured()) {
    return send(res, 503, "PREVIEW_UNAVAILABLE", "La vista previa aún no está disponible");
  }
  await ensureSite(req.clinicId!);
  const { token, expiresAt } = makePreviewToken(req.clinicId!);
  res.json({ url: `${previewOrigin()}/_preview?t=${encodeURIComponent(token)}`, expiresAt });
};

// ---------- Images ----------

export const SITE_IMAGE_KINDS = ["logo", "cover", "gallery", "team"] as const;
type SiteImageKind = (typeof SITE_IMAGE_KINDS)[number];

// Stored images per kind: what the draft uses plus what the published version
// still shows until the next publish (then the unused ones are deleted)
const IMAGE_LIMITS: Record<SiteImageKind, number> = { logo: 4, cover: 4, gallery: 20, team: 100 };

// Just uploaded and not saved in the draft yet: not unused
const UNUSED_AFTER_MS = 60 * 60 * 1000;

// Deletes the clinic's images that nothing uses any more: not in the draft,
// not in the published version, not a professional's photo
async function deleteUnusedImages(clinicId: string) {
  const site = await loadSite(clinicId);
  const profiles = await db
    .select({ photoId: memberPublicProfile.photoId })
    .from(memberPublicProfile)
    .where(eq(memberPublicProfile.organizationId, clinicId));
  const used = new Set<string>();
  for (const content of [site?.draft, site?.published]) {
    if (!content) continue;
    const ids = siteImageIds(content);
    [...ids.logo, ...ids.cover, ...ids.gallery].forEach((id) => used.add(id));
  }
  profiles.forEach((p) => p.photoId && used.add(p.photoId));

  await db
    .delete(clinicSiteImage)
    .where(
      and(
        eq(clinicSiteImage.organizationId, clinicId),
        lt(clinicSiteImage.createdAt, new Date(Date.now() - UNUSED_AFTER_MS)),
        used.size ? notInArray(clinicSiteImage.id, [...used]) : undefined,
      ),
    );
}

// GET /clinic/site/images/:imageId -> the image (thumbnails in the editor)
export const getSiteImage = async (req: Request<{ imageId: string }>, res: Response) => {
  const { imageId } = req.params;
  const [found] = UUID_PATTERN.test(imageId)
    ? await db
        .select({ mimeType: clinicSiteImage.mimeType, data: clinicSiteImage.data })
        .from(clinicSiteImage)
        .where(and(eq(clinicSiteImage.id, imageId), eq(clinicSiteImage.organizationId, req.clinicId!)))
        .limit(1)
    : [];
  if (!found) return send(res, 404, "IMAGE_NOT_FOUND", "Esta foto no existe");
  res.setHeader("Content-Type", found.mimeType);
  res.setHeader("X-Content-Type-Options", "nosniff");
  // An id's image never changes: a new photo is a new id
  res.setHeader("Cache-Control", "private, max-age=604800, immutable");
  res.end(found.data);
};

// POST /clinic/site/images?kind=logo|cover|gallery|team -> 201 { image: { id, kind } }
// The body is the image (JPG, PNG or WebP, up to 2 MB), read by express.raw.
// Uploading doesn't change the draft: the editor saves the new id in it
export const uploadSiteImage = async (req: Request, res: Response) => {
  const clinicId = req.clinicId!;
  const kind = req.query.kind;
  if (!SITE_IMAGE_KINDS.includes(kind as SiteImageKind)) {
    return send(res, 400, "INVALID_KIND", "El tipo de foto no es válido");
  }
  const image = readUploadedImage(req);
  if (typeof image === "string") return send(res, 400, "INVALID_IMAGE", image);

  const count = async () => {
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(clinicSiteImage)
      .where(and(eq(clinicSiteImage.organizationId, clinicId), eq(clinicSiteImage.kind, kind as string)));
    return row!.n;
  };
  if ((await count()) >= IMAGE_LIMITS[kind as SiteImageKind]) {
    await deleteUnusedImages(clinicId);
    if ((await count()) >= IMAGE_LIMITS[kind as SiteImageKind]) {
      return send(res, 409, "TOO_MANY_IMAGES", "Has llegado al máximo de fotos de este tipo. Borra alguna o publica los cambios antes de subir otra.");
    }
  }

  const [created] = await db
    .insert(clinicSiteImage)
    .values({ organizationId: clinicId, kind: kind as string, mimeType: image.type, data: image.data })
    .returning({ id: clinicSiteImage.id, kind: clinicSiteImage.kind });
  res.status(201).json({ image: created });
};

// DELETE /clinic/site/images/:imageId -> 204
// Removed from the draft (and from a professional's profile) at once. If the
// published version still shows it, it's kept until the next publish
export const deleteSiteImage = async (req: Request<{ imageId: string }>, res: Response) => {
  const clinicId = req.clinicId!;
  const { imageId } = req.params;
  const [found] = UUID_PATTERN.test(imageId)
    ? await db
        .select({ id: clinicSiteImage.id })
        .from(clinicSiteImage)
        .where(and(eq(clinicSiteImage.id, imageId), eq(clinicSiteImage.organizationId, clinicId)))
        .limit(1)
    : [];
  if (!found) return send(res, 404, "IMAGE_NOT_FOUND", "Esta foto no existe");

  const site = await loadSite(clinicId);
  await db.transaction(async (tx) => {
    if (site) {
      const draft = { ...site.draft };
      if (draft.logoId === imageId) delete draft.logoId;
      if (draft.coverId === imageId) delete draft.coverId;
      draft.galleryIds = draft.galleryIds.filter((id) => id !== imageId);
      await tx.update(clinicSite).set({ draft }).where(eq(clinicSite.organizationId, clinicId));
    }
    await tx
      .update(memberPublicProfile)
      .set({ photoId: null })
      .where(eq(memberPublicProfile.photoId, imageId));

    const published = site?.published ? siteImageIds(site.published) : null;
    const stillShown =
      published && site?.status === "published" && Object.values(published).some((ids) => ids.includes(imageId));
    if (!stillShown) await tx.delete(clinicSiteImage).where(eq(clinicSiteImage.id, imageId));
  });
  res.status(204).end();
};

// ---------- Team ----------

// Who can appear on the website: everyone except receptionists
const PROFESSIONAL_ROLES = ["owner", "admin", "physio"];

const TEAM_LIMITS = { displayName: 80, headline: 120, bio: 1500, licenseNumber: 40 };

// GET /clinic/site/team -> { team: [{ memberId, name, role, visible, … }] }
// Professionals without a profile yet aren't shown on the website (visible false)
export const getSiteTeam = async (req: Request, res: Response) => {
  const rows = await db
    .select({
      memberId: member.id,
      name: user.name,
      role: member.role,
      visible: memberPublicProfile.visible,
      displayName: memberPublicProfile.displayName,
      headline: memberPublicProfile.headline,
      bio: memberPublicProfile.bio,
      licenseNumber: memberPublicProfile.licenseNumber,
      photoId: memberPublicProfile.photoId,
      sortOrder: memberPublicProfile.sortOrder,
    })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .leftJoin(memberPublicProfile, eq(memberPublicProfile.memberId, member.id))
    .where(and(eq(member.organizationId, req.clinicId!), inArray(member.role, PROFESSIONAL_ROLES)))
    .orderBy(asc(sql`coalesce(${memberPublicProfile.sortOrder}, 1000)`), asc(user.name));
  res.json({
    team: rows.map((r) => ({ ...r, visible: r.visible ?? false, sortOrder: r.sortOrder ?? 0 })),
  });
};

// PUT /clinic/site/team/:memberId -> 204
// body: { visible, displayName?, headline?, bio?, licenseNumber?, photoId?, sortOrder? }
// Live on the website at once (not part of the draft)
export const updateSiteTeamMember = async (req: Request<{ memberId: string }>, res: Response) => {
  const clinicId = req.clinicId!;
  const { memberId } = req.params;
  const [target] = await db
    .select({ id: member.id })
    .from(member)
    .where(
      and(
        eq(member.id, memberId),
        eq(member.organizationId, clinicId),
        inArray(member.role, PROFESSIONAL_ROLES),
      ),
    )
    .limit(1);
  if (!target) return send(res, 404, "MEMBER_NOT_FOUND", "Este profesional no está en tu clínica");

  const b = (req.body ?? {}) as Record<string, unknown>;
  if (typeof b.visible !== "boolean") return send(res, 400, "INVALID_PROFILE", "Indica si aparece en la web");
  const fields = {
    displayName: optionalText(b.displayName, TEAM_LIMITS.displayName),
    headline: optionalText(b.headline, TEAM_LIMITS.headline),
    bio: optionalText(b.bio, TEAM_LIMITS.bio),
    licenseNumber: optionalText(b.licenseNumber, TEAM_LIMITS.licenseNumber),
  };
  const labels = { displayName: "El nombre", headline: "La especialidad", bio: "La presentación", licenseNumber: "El nº de colegiado" };
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) {
      const k = key as keyof typeof TEAM_LIMITS;
      return send(res, 400, "INVALID_PROFILE", `${labels[k]}: máximo ${TEAM_LIMITS[k]} caracteres`);
    }
  }
  const sortOrder = b.sortOrder ?? 0;
  if (!Number.isInteger(sortOrder) || (sortOrder as number) < 0 || (sortOrder as number) > 999) {
    return send(res, 400, "INVALID_PROFILE", "El orden no es válido");
  }

  const photoId = b.photoId ?? null;
  if (photoId !== null) {
    const [photo] =
      typeof photoId === "string" && UUID_PATTERN.test(photoId)
        ? await db
            .select({ id: clinicSiteImage.id })
            .from(clinicSiteImage)
            .where(
              and(
                eq(clinicSiteImage.id, photoId),
                eq(clinicSiteImage.organizationId, clinicId),
                eq(clinicSiteImage.kind, "team"),
              ),
            )
            .limit(1)
        : [];
    if (!photo) return send(res, 400, "INVALID_IMAGE", "Esa foto ya no existe. Vuelve a subirla.");
  }

  const values = {
    visible: b.visible,
    displayName: fields.displayName ?? null,
    headline: fields.headline ?? null,
    bio: fields.bio ?? null,
    licenseNumber: fields.licenseNumber ?? null,
    photoId: photoId as string | null,
    sortOrder: sortOrder as number,
  };
  await db
    .insert(memberPublicProfile)
    .values({ memberId, organizationId: clinicId, ...values })
    .onConflictDoUpdate({ target: memberPublicProfile.memberId, set: values });
  await purgeSitesCache(clinicId);
  res.status(204).end();
};

// ---------- Own domain ----------

const domainsOff = (res: Response) =>
  send(res, 503, "DOMAINS_UNAVAILABLE", "Los dominios propios aún no están disponibles");

// POST /clinic/site/domains -> SiteData. body: { domain, primary: "apex" | "www" }
// One domain per clinic: its apex and www, with the same TXT token
export const addDomain = async (req: Request, res: Response) => {
  if (!domainsConfigured()) return domainsOff(res);
  const clinicId = req.clinicId!;
  await ensureSite(clinicId);
  const parsed = parseDomain(req.body?.domain);
  if (!parsed.ok) return send(res, 400, "INVALID_DOMAIN", parsed.error);
  const primary = req.body?.primary === "www" ? "www" : "apex";
  const { apex } = parsed;
  const www = `www.${apex}`;

  const [existing] = await db
    .select({ id: clinicSiteDomain.id })
    .from(clinicSiteDomain)
    .where(eq(clinicSiteDomain.organizationId, clinicId))
    .limit(1);
  if (existing) return send(res, 409, "DOMAIN_EXISTS", "Ya tienes un dominio. Quítalo antes de añadir otro.");

  const taken = () =>
    send(res, 409, "DOMAIN_TAKEN", "Este dominio ya está conectado a otra clínica. Escríbenos si es tuyo.");
  const token = newVerifyToken();
  try {
    await db.insert(clinicSiteDomain).values([
      { organizationId: clinicId, hostname: apex, isPrimary: primary === "apex", verifyToken: token },
      { organizationId: clinicId, hostname: www, isPrimary: primary === "www", verifyToken: token },
    ]);
  } catch (error) {
    if ((error as { cause?: { code?: string } }).cause?.code === "23505") return taken();
    throw error;
  }
  console.log(`[site] domain added clinic=${clinicId} domain=${apex} by=${req.user!.id}`);
  res.status(201).json(await siteResponse(clinicId));
};

// PUT /clinic/site/domains/primary -> SiteData. body: { primary: "apex" | "www" }
export const setPrimaryDomain = async (req: Request, res: Response) => {
  const clinicId = req.clinicId!;
  const domain = await loadDomain(clinicId);
  if (!domain) return send(res, 404, "NO_DOMAIN", "No tienes ningún dominio");
  const primary = req.body?.primary === "www" ? `www.${domain.apex}` : domain.apex;
  await db
    .update(clinicSiteDomain)
    .set({ isPrimary: sql`${clinicSiteDomain.hostname} = ${primary}` })
    .where(eq(clinicSiteDomain.organizationId, clinicId));
  await purgeSitesCache(clinicId);
  res.json(await siteResponse(clinicId));
};

// DELETE /clinic/site/domains -> SiteData. The site goes back to the subdomain
export const removeDomain = async (req: Request, res: Response) => {
  const clinicId = req.clinicId!;
  const removed = await db
    .delete(clinicSiteDomain)
    .where(eq(clinicSiteDomain.organizationId, clinicId))
    .returning({ hostname: clinicSiteDomain.hostname });
  if (removed.length) {
    console.log(`[site] domain removed clinic=${clinicId} by=${req.user!.id}`);
    await purgeSitesCache(clinicId);
  }
  res.json(await siteResponse(clinicId));
};

// The clinic asked a minute ago: once per 30 s each, in this process
const lastManualCheck = new Map<string, number>();
const CHECK_EVERY_MS = 30_000;

// POST /clinic/site/domains/check -> SiteData. Checks the DNS now
export const checkDomain = async (req: Request, res: Response) => {
  if (!domainsConfigured()) return domainsOff(res);
  const clinicId = req.clinicId!;
  const last = lastManualCheck.get(clinicId) ?? 0;
  if (Date.now() - last < CHECK_EVERY_MS) {
    return send(res, 429, "TOO_SOON", "Acabamos de comprobarlo. Espera unos segundos y vuelve a intentarlo.");
  }
  lastManualCheck.set(clinicId, Date.now());
  const done = await checkClinicDomain(clinicId);
  if (!done) return send(res, 503, "DNS_UNAVAILABLE", "No hemos podido consultar los DNS ahora mismo. Inténtalo en un momento.");
  res.json(await siteResponse(clinicId));
};
