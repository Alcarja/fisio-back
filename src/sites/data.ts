import { and, asc, eq, inArray } from "drizzle-orm";
import type { SiteContent } from "../lib/site.js";
import {
  clinicFeature,
  clinicLegal,
  clinicOnlineBooking,
  clinicOpeningHours,
  clinicSite,
  db,
  member,
  memberPublicProfile,
  organization,
  service,
  user,
} from "./db.js";
import type { SiteHours, SiteLegalDetails, SiteService, SiteTeamMember } from "./templates/types.js";

// Everything a page needs, read with the read-only user (explicit columns
// only: WEBS.md 3.2 lists what it may read)

export type PageData = {
  clinic: { id: string; name: string; slug: string };
  content: SiteContent;
  template: string;
  services: SiteService[];
  team: (SiteTeamMember & { photoId?: string })[];
  hours: SiteHours[];
  legal: SiteLegalDetails;
  bookingEnabled: boolean;
  showKineflowCredit: boolean;
};

// published: what visitors see. draft: the preview of what's being edited
export async function loadPageData(clinicId: string, version: "published" | "draft"): Promise<PageData | null> {
  const [site] = await db
    .select({
      name: organization.name,
      slug: organization.slug,
      draft: clinicSite.draft,
      published: clinicSite.published,
      template: clinicSite.template,
      publishedTemplate: clinicSite.publishedTemplate,
      showKineflowCredit: clinicSite.showKineflowCredit,
    })
    .from(clinicSite)
    .innerJoin(organization, eq(organization.id, clinicSite.organizationId))
    .where(eq(clinicSite.organizationId, clinicId))
    .limit(1);
  if (!site) return null;
  const content = version === "draft" ? site.draft : site.published;
  const template = version === "draft" ? site.template : site.publishedTemplate;
  if (!content || !template) return null;

  const [services, team, hours, legal, booking] = await Promise.all([
    db
      .select({
        name: service.name,
        durationMinutes: service.durationMinutes,
        priceCents: service.priceCents,
        isGroup: service.isGroup,
        description: service.publicDescription,
      })
      .from(service)
      .where(and(eq(service.organizationId, clinicId), eq(service.isActive, true), eq(service.showOnWeb, true)))
      .orderBy(asc(service.name)),
    db
      .select({
        userName: user.name,
        displayName: memberPublicProfile.displayName,
        headline: memberPublicProfile.headline,
        bio: memberPublicProfile.bio,
        licenseNumber: memberPublicProfile.licenseNumber,
        photoId: memberPublicProfile.photoId,
      })
      .from(memberPublicProfile)
      .innerJoin(member, eq(member.id, memberPublicProfile.memberId))
      .innerJoin(user, eq(user.id, member.userId))
      .where(
        and(
          eq(memberPublicProfile.organizationId, clinicId),
          eq(member.organizationId, clinicId),
          eq(memberPublicProfile.visible, true),
          // Receptionists never appear, even with an old profile
          inArray(member.role, ["owner", "admin", "physio"]),
        ),
      )
      .orderBy(asc(memberPublicProfile.sortOrder), asc(user.name)),
    db
      .select({
        weekday: clinicOpeningHours.weekday,
        start: clinicOpeningHours.startTime,
        end: clinicOpeningHours.endTime,
      })
      .from(clinicOpeningHours)
      .where(eq(clinicOpeningHours.organizationId, clinicId))
      .orderBy(asc(clinicOpeningHours.weekday), asc(clinicOpeningHours.startTime)),
    db
      .select({
        legalName: clinicLegal.legalName,
        taxId: clinicLegal.taxId,
        address: clinicLegal.address,
        postalCode: clinicLegal.postalCode,
        city: clinicLegal.city,
        privacyEmail: clinicLegal.privacyContactEmail,
      })
      .from(clinicLegal)
      .where(eq(clinicLegal.organizationId, clinicId))
      .limit(1),
    bookingEnabled(clinicId),
  ]);

  return {
    clinic: { id: clinicId, name: site.name, slug: site.slug },
    content,
    template,
    services: services.map((s) => ({ ...s, description: s.description ?? undefined })),
    team: team.map((t) => ({
      name: t.displayName || t.userName,
      headline: t.headline ?? undefined,
      bio: t.bio ?? undefined,
      licenseNumber: t.licenseNumber ?? undefined,
      photoId: t.photoId ?? undefined,
    })),
    hours: hours.map((h) => ({ weekday: h.weekday, start: h.start.slice(0, 5), end: h.end.slice(0, 5) })),
    legal: legal[0] ?? { legalName: null, taxId: null, address: null, postalCode: null, city: null, privacyEmail: null },
    bookingEnabled: booking,
    showKineflowCredit: site.showKineflowCredit,
  };
}

// The same rule as the API's lib/onlineBooking.ts (which this process can't
// import): the "online_booking" feature on AND the clinic's own switch on
async function bookingEnabled(clinicId: string) {
  const [row] = await db
    .select({ enabled: clinicOnlineBooking.enabled, feature: clinicFeature.feature })
    .from(clinicOnlineBooking)
    .leftJoin(
      clinicFeature,
      and(
        eq(clinicFeature.organizationId, clinicOnlineBooking.organizationId),
        eq(clinicFeature.feature, "online_booking"),
      ),
    )
    .where(eq(clinicOnlineBooking.organizationId, clinicId))
    .limit(1);
  return !!row?.enabled && !!row.feature;
}
