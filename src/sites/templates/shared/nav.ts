import type { SitePageProps } from "../types.js";
import { availablePages, CONTENT_PAGE_META } from "./pages.js";

export type NavItem = { href: string; label: string; current: boolean };

// The site's menu: one link per content page that exists for this clinic.
// In the preview, link() gives "#" and pages don't navigate, so the menu
// points at the home page's sections instead
export function navItems(props: SitePageProps): NavItem[] {
  const preview = props.link("/") === "#";
  return availablePages(props).map((p) => {
    const meta = CONTENT_PAGE_META[p];
    return { href: preview ? meta.anchor : props.link(meta.path), label: meta.label, current: props.page === p };
  });
}
