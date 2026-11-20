import type { CSSProperties, ReactNode } from "react";
import { cn } from "../shared/cn.js";
import { telHref } from "../shared/format.js";
import { navItems } from "../shared/nav.js";
import { MenuIcon } from "../shared/ui.js";
import type { SitePageProps } from "../types.js";
import { ArrowDiag, Btn, Closing, homeSections, Wordmark, Wrap, zonaAccent } from "./sections.js";

// Zona: a white header (wordmark, numbered mono menu, "Reservar cita ↗") and
// the closing block in the clinic's colour as the footer of every page. On
// the booking page the big call to action is left out (you're already there).
// Phones: the menu opens from a <details> (no JavaScript)
export default function Layout({ props, children }: { props: SitePageProps; children: ReactNode }) {
  const { content, link, bookingUrl, page } = props;
  const c = content.contact;
  const items = navItems(props);
  const accent = zonaAccent(content.theme.primary);
  const closingNumber = page === "home" ? homeSections(props).length + 1 : undefined;

  return (
    <div className="zn-root min-h-screen" style={{ "--zn-accent": accent } as CSSProperties}>
      <a href="#contenido" className="kf-skip">
        Saltar al contenido
      </a>

      <header className="sticky top-0 z-50 border-x-0 border-t-0 border-b border-solid border-(--zn-line) bg-white/95 backdrop-blur-md">
        <Wrap className="flex min-h-[72px] items-center justify-between gap-x-8 gap-y-2">
          <Wordmark props={props} />
          <nav aria-label="Principal" className="zn-mono hidden flex-wrap gap-x-7 text-[13px] tracking-[.04em] lg:flex">
            {items.map((i, n) => (
              <a
                key={i.href}
                href={i.href}
                aria-current={i.current ? "page" : undefined}
                className={cn("py-3.5 text-(--zn-ink) no-underline hover:text-(--zn-accent)", i.current && "text-(--zn-accent) underline underline-offset-8")}
              >
                {String(n + 1).padStart(2, "0")} {i.label}
              </a>
            ))}
          </nav>
          <div className="flex shrink-0 items-center gap-3">
            {bookingUrl && (
              <Btn href={link(bookingUrl)} tone="accent" className="hidden min-h-12 px-5 text-[15px] sm:inline-flex">
                Reservar cita <ArrowDiag />
              </Btn>
            )}
            <details className="relative lg:hidden">
              <summary aria-label="Abrir menú" className="flex size-12 cursor-pointer list-none items-center justify-center rounded-[6px] border border-solid border-(--zn-ink) text-(--zn-ink) [&::-webkit-details-marker]:hidden">
                <MenuIcon />
              </summary>
              <nav
                aria-label="Menú"
                className="absolute top-[calc(100%+.75rem)] right-0 box-border flex w-[min(20rem,calc(100vw-2.5rem))] flex-col rounded-[10px] border border-solid border-(--zn-ink) bg-white p-2 shadow-[0_24px_48px_-24px_rgba(0,0,0,.35)]"
              >
                <a href={link("/")} aria-current={page === "home" ? "page" : undefined} className={cn("zn-mono rounded-[6px] px-3 py-3.5 text-[13px] text-(--zn-ink) no-underline hover:bg-(--zn-tint)", page === "home" && "text-(--zn-accent)")}>
                  00 Inicio
                </a>
                {items.map((i, n) => (
                  <a key={i.href} href={i.href} aria-current={i.current ? "page" : undefined} className={cn("zn-mono rounded-[6px] px-3 py-3.5 text-[13px] text-(--zn-ink) no-underline hover:bg-(--zn-tint)", i.current && "text-(--zn-accent)")}>
                    {String(n + 1).padStart(2, "0")} {i.label}
                  </a>
                ))}
                {bookingUrl && (
                  <Btn href={link(bookingUrl)} tone="accent" className="mt-2">
                    Reservar cita <ArrowDiag />
                  </Btn>
                )}
                {c.phone && (
                  <Btn href={telHref(c.phone)} tone="outline" className="mt-2">
                    Llamar · {c.phone}
                  </Btn>
                )}
              </nav>
            </details>
          </div>
        </Wrap>
      </header>

      <main id="contenido" className="zn-main">
        {children}
      </main>

      <Closing props={props} n={closingNumber} cta={page !== "reservar"} />
    </div>
  );
}
