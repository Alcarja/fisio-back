import type { FC, ReactNode } from "react";
import type { SiteContent } from "../../lib/site.js";

// What every template receives (WEBS.md 3.9). Only public data: never
// anything about patients.

export type SiteService = {
  name: string;
  durationMinutes: number;
  priceCents: number;
  isGroup: boolean;
  description?: string;
};

export type SiteTeamMember = {
  name: string;
  headline?: string;
  bio?: string;
  licenseNumber?: string;
  photoUrl?: string;
};

export type SiteHours = { weekday: number; start: string; end: string }; // 1 = Monday, "09:00"

export type SiteLegalDetails = {
  legalName: string | null;
  taxId: string | null;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  privacyEmail: string | null;
};

export type SitePage = "home" | "reservar" | "aviso-legal" | "privacidad" | "cookies";

export type SitePageProps = {
  clinic: { name: string; slug: string };
  content: SiteContent; // published (or the draft, in the preview)
  services: SiteService[];
  team: SiteTeamMember[];
  hours: SiteHours[];
  legal: SiteLegalDetails;
  bookingUrl: string | null; // "/reservar", or null if online booking is off
  img: (id?: string) => string | undefined; // image id → its URL
  link: (path: string) => string; // a page of the site ("#" in the preview)
  showKineflowCredit: boolean;
  appUrl: string; // https://kineflow.es
  page: SitePage;
};

// A template: the page frame (header + footer) and the home page. The other
// pages (booking, legal) are shared and drawn inside the frame
export type SiteTemplateModule = {
  Layout: FC<{ props: SitePageProps; children: ReactNode }>;
  Home: FC<{ props: SitePageProps }>;
  css: string;
};
