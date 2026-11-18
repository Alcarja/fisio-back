import type { ReactNode } from "react";
import { LegalFooter, SocialLinks } from "../shared/blocks.js";
import { cn } from "../shared/cn.js";
import { fullAddress, telHref } from "../shared/format.js";
import { navItems } from "../shared/nav.js";
import type { SitePageProps } from "../types.js";
import { Enso, HoursList, Status, statusOf, Wrap } from "./sections.js";

// The footer's name fills the width without overflowing it
const wordmarkSize = (name: string) => `min(13rem, ${(165 / Math.max(name.length + 1, 6)).toFixed(2)}vw)`;

// Zen: a quiet bar (ensō + name, the pages, the open status and "Reservar"),
// the page, and a sand footer with the clinic's name pressed into it.
// Phones: the menu opens from a <details> (no JavaScript)
export default function Layout({ props, children }: { props: SitePageProps; children: ReactNode }) {
  const { clinic, content, img, link, bookingUrl, hours, page } = props;
  const logo = img(content.logoId);
  const c = content.contact;
  const items = navItems(props);
  const status = statusOf(props);
  const address = fullAddress(c);
  const cta = bookingUrl ? { href: link(bookingUrl), label: "Reservar" } : c.phone ? { href: telHref(c.phone), label: "Llamar" } : null;

  return (
    <div className="zen-root min-h-screen">
      {/* The brush texture every ensō uses */}
      <svg width="0" height="0" className="absolute" aria-hidden="true" focusable="false">
        <filter id="zen-brush" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency=".05" numOctaves={2} seed={7} />
          <feDisplacementMap in="SourceGraphic" scale={4} xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>
      <a href="#contenido" className="kf-skip">
        Saltar al contenido
      </a>

      <header className="sticky top-0 z-50 border-b border-(--zen-stone)/50 bg-(--zen-paper)/85 backdrop-blur-md">
        <Wrap className="flex h-14 items-center justify-between gap-6 md:h-16">
          <a href={link("/")} className="flex min-w-0 items-center gap-3 text-ink no-underline">
            {logo ? (
              <img src={logo} alt={clinic.name} className="block max-h-8 max-w-36 object-contain" />
            ) : (
              <>
                <span className="w-6 shrink-0 text-(--zen-accent)">
                  <Enso bold />
                </span>
                <span className="zen-serif truncate text-[1.3rem] leading-none">{clinic.name}</span>
              </>
            )}
          </a>

          <nav className="hidden items-center gap-10 lg:flex" aria-label="Páginas">
            {items.map((i) => (
              <a key={i.href} href={i.href} aria-current={i.current ? "page" : undefined} className={cn("zen-nav text-[.86rem] no-underline", i.current ? "text-ink" : "text-muted hover:text-ink")}>
                {i.label}
              </a>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-5">
            {status && (
              <span className="hidden items-center gap-2.5 text-[.8rem] text-muted xl:inline-flex" title={status.label}>
                <span className={cn("zen-dot", status.open && "zen-dot-open")} aria-hidden="true" />
                {status.open ? "Abierto ahora" : "Cerrado ahora"}
              </span>
            )}
            {cta && (
              <a
                href={cta.href}
                className="hidden h-9 items-center rounded-full border border-(--zen-stone) px-4 text-[.82rem] text-ink no-underline transition-colors duration-500 hover:border-ink hover:bg-ink hover:text-(--zen-paper) sm:inline-flex"
              >
                {cta.label}
              </a>
            )}
            <details className="zen-menu relative lg:hidden">
              <summary aria-label="Abrir menú" className="flex size-9 cursor-pointer list-none items-center justify-center rounded-full border border-(--zen-stone) text-ink [&::-webkit-details-marker]:hidden">
                <span className="zen-burger" aria-hidden="true" />
              </summary>
              <nav
                className="absolute top-[calc(100%+.75rem)] right-0 flex w-[min(20rem,calc(100vw-3rem))] flex-col rounded-[1.5rem] border border-(--zen-stone)/60 bg-(--zen-paper) p-4 shadow-[0_30px_60px_-30px_rgba(40,38,30,.35)]"
                aria-label="Páginas"
              >
                <a href={link("/")} aria-current={page === "home" ? "page" : undefined} className="zen-serif rounded-xl px-3 py-2.5 text-[1.7rem] text-ink no-underline hover:bg-(--zen-sand)">
                  Inicio
                </a>
                {items.map((i) => (
                  <a
                    key={i.href}
                    href={i.href}
                    aria-current={i.current ? "page" : undefined}
                    className={cn("zen-serif rounded-xl px-3 py-2.5 text-[1.7rem] text-ink no-underline hover:bg-(--zen-sand)", i.current && "italic text-(--zen-accent)")}
                  >
                    {i.label}
                  </a>
                ))}
                {status && <Status props={props} className="mt-3 border-t border-(--zen-stone) px-3 pt-4 text-[.82rem] text-muted" />}
                {cta && (
                  <a href={cta.href} className="mt-4 inline-flex h-12 items-center justify-center rounded-full bg-ink text-[.92rem] text-(--zen-paper) no-underline">
                    {bookingUrl ? "Reservar cita" : `Llamar al ${c.phone}`}
                  </a>
                )}
              </nav>
            </details>
          </div>
        </Wrap>
      </header>

      <main id="contenido" className="zen-main">
        {children}
      </main>

      <footer className="relative overflow-hidden rounded-t-[2.5rem] bg-(--zen-sand)">
        <Wrap className="relative pt-20 pb-8 md:pt-28">
          <div className="grid gap-14 border-b border-(--zen-stone) pb-16 sm:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1.2fr_1.3fr] lg:gap-12">
            <div>
              <a href={link("/")} className="inline-flex items-center gap-3 text-ink no-underline">
                <span className="w-9 text-(--zen-accent)">
                  <Enso bold />
                </span>
                <span className="zen-serif text-[1.8rem] leading-none">{clinic.name}</span>
              </a>
              {content.hero.subtitle && <p className="mt-6 mb-0 max-w-[22rem] text-[.95rem] leading-[1.8] text-muted">{content.hero.subtitle}</p>}
              {status && <Status props={props} className="mt-6 text-[.86rem] text-ink" />}
            </div>
            <nav className="flex flex-col items-start gap-3" aria-label="Páginas del pie">
              <p className="zen-foot-label">Páginas</p>
              <a href={link("/")} className="zen-foot-link">
                Inicio
              </a>
              {items.map((i) => (
                <a key={i.href} href={i.href} className="zen-foot-link">
                  {i.label}
                </a>
              ))}
              {bookingUrl && (
                <a href={link(bookingUrl)} className="zen-foot-link">
                  Reservar cita
                </a>
              )}
            </nav>
            <div className="flex flex-col items-start gap-3">
              <p className="zen-foot-label">Contacto</p>
              {c.phone && (
                <a href={telHref(c.phone)} className="zen-foot-link">
                  {c.phone}
                </a>
              )}
              {c.email && (
                <a href={`mailto:${c.email}`} className="zen-foot-link break-all">
                  {c.email}
                </a>
              )}
              {address && <span className="text-[.95rem] leading-[1.7] text-muted">{address}</span>}
              {c.mapsUrl && (
                <a href={c.mapsUrl} target="_blank" rel="noopener" className="zen-foot-link text-[.9rem] underline decoration-(--zen-stone) underline-offset-4">
                  Cómo llegar
                </a>
              )}
              <div className="zen-social">
                <SocialLinks content={content} />
              </div>
            </div>
            {content.sections.hours && hours.length > 0 && (
              <div>
                <p className="zen-foot-label">Horario</p>
                <HoursList hours={hours} compact className="mt-1 text-[.86rem] [&_li]:py-2" />
              </div>
            )}
          </div>

          <p className="zen-wordmark zen-serif m-0 mt-16 text-center leading-[.85] whitespace-nowrap italic select-none md:mt-20" style={{ fontSize: wordmarkSize(clinic.name) }} aria-hidden="true">
            {clinic.name}
          </p>

          <div className="mt-10 border-t border-(--zen-stone) pt-6 text-[.84rem] text-muted [&_.kf-legal_nav]:gap-6 [&_a]:text-muted [&_a]:no-underline [&_a:hover]:text-ink">
            <LegalFooter props={props} />
          </div>
        </Wrap>
      </footer>
    </div>
  );
}
