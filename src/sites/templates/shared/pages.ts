import type { SiteContent } from "../../../lib/site.js";

// The content pages every template draws (besides home, booking and legal).
// A page only exists when the clinic has something to show on it: otherwise
// its URL is a 404 and it's left out of the menu and the sitemap.

export const CONTENT_PAGES = ["servicios", "equipo", "nosotros", "contacto"] as const;
export type ContentPage = (typeof CONTENT_PAGES)[number];

export const CONTENT_PAGE_META: Record<ContentPage, { path: string; title: string; label: string; anchor: string }> = {
  servicios: { path: "/servicios", title: "Servicios", label: "Servicios", anchor: "#servicios" },
  equipo: { path: "/equipo", title: "Equipo", label: "Equipo", anchor: "#equipo" },
  nosotros: { path: "/nosotros", title: "Nosotros", label: "Nosotros", anchor: "#nosotros" },
  contacto: { path: "/contacto", title: "Contacto", label: "Contacto", anchor: "#contacto" },
};

export const isContentPage = (page: string): page is ContentPage =>
  (CONTENT_PAGES as readonly string[]).includes(page);

type PageInput = { content: SiteContent; services: unknown[]; team: unknown[] };

export function pageAvailable(page: ContentPage, { content, services, team }: PageInput) {
  const s = content.sections;
  switch (page) {
    case "servicios":
      return s.services && services.length > 0;
    case "equipo":
      return s.team && team.length > 0;
    case "nosotros":
      return (s.about && !!content.about?.text) || (s.gallery && content.galleryIds.length > 0);
    case "contacto":
      return true;
  }
}

export const availablePages = (input: PageInput) => CONTENT_PAGES.filter((p) => pageAvailable(p, input));
