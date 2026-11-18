import type { ReactNode } from "react";
import { LegalFooter, SocialLinks } from "../shared/blocks.js";
import { cn } from "../shared/cn.js";
import { fullAddress, initials, telHref } from "../shared/format.js";
import { PhoneIcon } from "../shared/icons.js";
import { navItems } from "../shared/nav.js";
import { Button, MenuIcon } from "../shared/ui.js";
import type { SitePageProps } from "../types.js";
import { pill, statusOf, Wrap } from "./sections.js";

// Norte: a floating white bar (monogram + name, pages, phone, "Reservar
// cita") over the grey page, and a footer that is one more rounded panel.
// Phones: the menu opens from a <details> (no JavaScript)
export default function Layout({ props, children }: { props: SitePageProps; children: ReactNode }) {
  const { clinic, content, img, link, bookingUrl, page } = props;
  const logo = img(content.logoId);
  const c = content.contact;
  const items = navItems(props);
  const status = statusOf(props);
  const address = fullAddress(c);

  const Brand = (
    <a href={link("/")} className="flex min-w-0 items-center gap-2.5 text-ink no-underline">
      {logo ? (
        <img src={logo} alt={clinic.name} className="block max-h-9 max-w-40 object-contain" />
      ) : (
        <>
          <span className="nt-num flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-[.9rem] text-primary-foreground">{initials(clinic.name)}</span>
          <span className="truncate text-[1.02rem] font-semibold tracking-[-.01em]">{clinic.name}</span>
        </>
      )}
    </a>
  );

  return (
    <div className="nt-root min-h-screen">
      <a href="#contenido" className="kf-skip">
        Saltar al contenido
      </a>

      <header className="sticky top-0 z-50 pt-3 pb-3 md:pb-4">
        <Wrap>
          <div className="flex h-16 items-center justify-between gap-4 rounded-full bg-white/90 pr-2.5 pl-3 shadow-[0_1px_2px_rgba(16,24,40,.05),0_8px_24px_-12px_rgba(16,24,40,.12)] backdrop-blur-md md:pl-5">
            {Brand}
            <nav className="hidden items-center gap-1 lg:flex" aria-label="Páginas">
              {items.map((i) => (
                <a
                  key={i.href}
                  href={i.href}
                  aria-current={i.current ? "page" : undefined}
                  className={cn("rounded-full px-4 py-2 text-[.9rem] font-medium no-underline transition-colors", i.current ? "bg-(--nt-soft) text-ink" : "text-muted hover:text-ink")}
                >
                  {i.label}
                </a>
              ))}
            </nav>
            <div className="flex shrink-0 items-center gap-2">
              {c.phone && (
                <a href={telHref(c.phone)} className="hidden items-center gap-2 rounded-full px-3 py-2 text-[.88rem] font-medium text-ink no-underline hover:bg-(--nt-soft) xl:inline-flex [&_svg]:size-4">
                  <PhoneIcon /> {c.phone}
                </a>
              )}
              {bookingUrl && (
                <Button href={link(bookingUrl)} className={cn(pill, "hidden sm:inline-flex")}>
                  Reservar cita
                </Button>
              )}
              <details className="nt-menu relative lg:hidden">
                <summary aria-label="Abrir menú" className="flex size-11 cursor-pointer list-none items-center justify-center rounded-full bg-(--nt-soft) text-ink [&::-webkit-details-marker]:hidden">
                  <MenuIcon />
                </summary>
                <nav
                  className="absolute top-[calc(100%+.9rem)] right-0 flex w-[min(20rem,calc(100vw-1.5rem))] flex-col gap-1 rounded-[1.5rem] bg-white p-3 shadow-[0_24px_48px_-20px_rgba(16,24,40,.3)]"
                  aria-label="Páginas"
                >
                  <a href={link("/")} aria-current={page === "home" ? "page" : undefined} className={cn("rounded-xl px-4 py-3 font-medium text-ink no-underline hover:bg-(--nt-soft)", page === "home" && "bg-(--nt-soft)")}>
                    Inicio
                  </a>
                  {items.map((i) => (
                    <a key={i.href} href={i.href} aria-current={i.current ? "page" : undefined} className={cn("rounded-xl px-4 py-3 font-medium text-ink no-underline hover:bg-(--nt-soft)", i.current && "bg-(--nt-soft)")}>
                      {i.label}
                    </a>
                  ))}
                  {bookingUrl && (
                    <Button href={link(bookingUrl)} className={cn(pill, "mt-2 h-12")}>
                      Reservar cita
                    </Button>
                  )}
                  {c.phone && (
                    <Button href={telHref(c.phone)} variant="outline" className={cn(pill, "h-12 border-(--nt-line)")}>
                      <PhoneIcon /> {c.phone}
                    </Button>
                  )}
                </nav>
              </details>
            </div>
          </div>
        </Wrap>
      </header>

      <main id="contenido" className="nt-main">
        {children}
      </main>

      <footer className="pb-3 md:pb-4">
        <Wrap>
          <div className="rounded-[1.75rem] bg-white p-7 md:rounded-[2rem] md:p-12">
            <div className="grid gap-10 border-b border-(--nt-line) pb-10 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1.3fr_1fr]">
              <div className="max-w-[22rem]">
                {Brand}
                {content.hero.subtitle && <p className="mt-5 mb-0 text-[.92rem] leading-relaxed text-muted">{content.hero.subtitle}</p>}
                {status && (
                  <p className="mt-5 mb-0 inline-flex items-center gap-2 text-[.86rem] font-medium text-ink">
                    <span className={cn("nt-dot", status.open && "nt-dot-open")} aria-hidden="true" />
                    {status.label}
                  </p>
                )}
              </div>
              <nav className="flex flex-col items-start gap-2.5" aria-label="Páginas del pie">
                <p className="nt-foot-label">Clínica</p>
                <a href={link("/")} className="nt-foot-link">
                  Inicio
                </a>
                {items.map((i) => (
                  <a key={i.href} href={i.href} className="nt-foot-link">
                    {i.label}
                  </a>
                ))}
              </nav>
              <div className="flex flex-col items-start gap-2.5">
                <p className="nt-foot-label">Contacto</p>
                {c.phone && (
                  <a href={telHref(c.phone)} className="nt-foot-link">
                    {c.phone}
                  </a>
                )}
                {c.email && (
                  <a href={`mailto:${c.email}`} className="nt-foot-link break-all">
                    {c.email}
                  </a>
                )}
                {address && <span className="text-[.92rem] leading-relaxed text-muted">{address}</span>}
                <SocialLinks content={content} />
              </div>
              {bookingUrl && (
                <div className="flex flex-col items-start gap-3">
                  <p className="nt-foot-label">Cita online</p>
                  <p className="m-0 text-[.92rem] leading-relaxed text-muted">Reserva en un minuto, las 24 horas.</p>
                  <Button href={link(bookingUrl)} className={pill}>
                    Reservar cita
                  </Button>
                </div>
              )}
            </div>
            <div className="nt-legal pt-6 text-[.84rem] text-muted">
              <LegalFooter props={props} />
            </div>
          </div>
        </Wrap>
      </footer>
    </div>
  );
}
