import type { CSSProperties, ReactNode } from "react";
import { FooterNav, LegalFooter } from "../shared/blocks.js";
import { cn } from "../shared/cn.js";
import { telHref } from "../shared/format.js";
import { navItems } from "../shared/nav.js";
import { MenuIcon } from "../shared/ui.js";
import type { SitePageProps } from "../types.js";
import { arcoColors, Brand, Btn, Wrap } from "./sections.js";

// Arco: a sticky header on the sage background (arc logo, pages, phone and
// "Reservar cita") and a deep footer. Phones: the menu opens from a <details>
// (no JavaScript). The two colours the design needs are set here (sections.tsx)
export default function Layout({ props, children }: { props: SitePageProps; children: ReactNode }) {
  const { content, link, bookingUrl, page } = props;
  const c = content.contact;
  const items = navItems(props);
  const { dark, hl } = arcoColors(content.theme.primary, content.theme.accent);
  const linkClass = (current: boolean) =>
    cn("py-3 text-[15px] font-medium text-ink no-underline hover:underline hover:underline-offset-8", current && "underline decoration-(--ar-hl) decoration-4 underline-offset-8");

  return (
    <div className="ar-root min-h-screen" style={{ "--ar-dark": dark, "--ar-hl": hl } as CSSProperties}>
      <a href="#contenido" className="kf-skip">
        Saltar al contenido
      </a>

      <header className="sticky top-0 z-50 border-x-0 border-t-0 border-b border-solid border-(--ar-line) bg-(--ar-bg)/95 backdrop-blur-md">
        <Wrap className="flex min-h-[76px] items-center justify-between gap-x-8 gap-y-2 py-3.5">
          <Brand props={props} />
          <nav className="hidden flex-wrap gap-x-7 lg:flex" aria-label="Principal">
            {items.map((i) => (
              <a key={i.href} href={i.href} aria-current={i.current ? "page" : undefined} className={linkClass(i.current)}>
                {i.label}
              </a>
            ))}
          </nav>
          <div className="flex shrink-0 items-center gap-5">
            {c.phone && (
              <a href={telHref(c.phone)} className="hidden py-3 text-[15px] font-semibold text-ink no-underline xl:inline">
                {c.phone}
              </a>
            )}
            {bookingUrl && (
              <Btn href={link(bookingUrl)} size="md" className="hidden sm:inline-flex">
                Reservar cita
              </Btn>
            )}
            <details className="relative lg:hidden">
              <summary aria-label="Abrir menú" className="flex size-12 cursor-pointer list-none items-center justify-center rounded-full border-[1.5px] border-solid border-ink text-ink [&::-webkit-details-marker]:hidden">
                <MenuIcon />
              </summary>
              <nav
                className="absolute top-[calc(100%+.9rem)] right-0 box-border flex w-[min(20rem,calc(100vw-2.5rem))] flex-col gap-1 rounded-[28px] border border-solid border-(--ar-line) bg-white p-3 shadow-[0_24px_48px_-20px_rgba(16,35,30,.35)]"
                aria-label="Menú"
              >
                <a href={link("/")} aria-current={page === "home" ? "page" : undefined} className={cn("rounded-2xl px-4 py-3 font-medium text-ink no-underline hover:bg-(--ar-bg)", page === "home" && "bg-(--ar-bg)")}>
                  Inicio
                </a>
                {items.map((i) => (
                  <a key={i.href} href={i.href} aria-current={i.current ? "page" : undefined} className={cn("rounded-2xl px-4 py-3 font-medium text-ink no-underline hover:bg-(--ar-bg)", i.current && "bg-(--ar-bg)")}>
                    {i.label}
                  </a>
                ))}
                {bookingUrl && (
                  <Btn href={link(bookingUrl)} className="mt-2">
                    Reservar cita
                  </Btn>
                )}
                {c.phone && (
                  <Btn href={telHref(c.phone)} tone="outline">
                    Llamar · {c.phone}
                  </Btn>
                )}
              </nav>
            </details>
          </div>
        </Wrap>
      </header>

      <main id="contenido" className="ar-main">
        {children}
      </main>

      <footer className="ar-foot bg-(--ar-dark-deep) text-(--ar-on-dark-muted)">
        <Wrap className="flex flex-col gap-6 py-12">
          <div className="flex flex-wrap items-center justify-between gap-6 [&_.kf-footer-nav_a]:py-3 [&_.kf-footer-nav_a]:text-(--ar-on-dark-muted)">
            <Brand props={props} light />
            <FooterNav items={[{ href: link("/"), label: "Inicio" }, ...items]} />
          </div>
          <div className="border-x-0 border-t border-b-0 border-solid border-white/10 pt-4">
            <LegalFooter props={props} />
          </div>
        </Wrap>
      </footer>
    </div>
  );
}
