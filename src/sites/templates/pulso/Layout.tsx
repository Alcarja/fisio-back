import type { ReactNode } from "react";
import { ContactList, LegalFooter, SocialLinks } from "../shared/blocks.js";
import { cn } from "../shared/cn.js";
import { telHref } from "../shared/format.js";
import { navItems } from "../shared/nav.js";
import { MenuIcon } from "../shared/ui.js";
import type { SitePageProps } from "../types.js";
import { Bars, StatusDot, statusOf, Wrap } from "./sections.js";

// Pulso: a white bar with wide-tracked uppercase links and an outlined pill
// with an offset mint shadow; a quiet footer under a three-colour line.
// Phones: the menu opens from a <details> (no JavaScript)
export default function Layout({ props, children }: { props: SitePageProps; children: ReactNode }) {
  const { clinic, content, img, link, bookingUrl, page } = props;
  const logo = img(content.logoId);
  const phone = content.contact.phone;
  const items = navItems(props);
  const status = statusOf(props);
  const cta = bookingUrl ? { href: link(bookingUrl), label: "Pide cita" } : phone ? { href: telHref(phone), label: "Llámanos" } : null;

  const brand = (
    <a href={link("/")} className="flex min-w-0 items-center gap-3 text-ink no-underline">
      {logo ? (
        <img src={logo} alt={clinic.name} className="block max-h-12 max-w-40 object-contain" />
      ) : (
        <>
          <Bars className="text-[1.6rem]" />
          <span className="truncate text-[1.05rem] leading-tight font-semibold tracking-[-.01em]">{clinic.name}</span>
        </>
      )}
    </a>
  );

  return (
    <>
      <a href="#contenido" className="kf-skip">
        Saltar al contenido
      </a>
      <header className="sticky top-0 z-50 border-b border-(--line) bg-white/95 backdrop-blur">
        <Wrap className="flex h-20 items-center justify-between gap-6 md:h-24">
          {brand}
          <nav className="hidden items-center gap-9 lg:flex" aria-label="Páginas">
            {items.map((i) => (
              <a
                key={i.href}
                href={i.href}
                aria-current={i.current ? "page" : undefined}
                className={cn(
                  "relative text-[.8rem] font-medium tracking-[.14em] text-ink uppercase no-underline after:absolute after:-bottom-2 after:left-0 after:h-0.5 after:w-0 after:bg-primary after:transition-all hover:after:w-full",
                  i.current && "after:w-full",
                )}
              >
                {i.label}
              </a>
            ))}
          </nav>
          <div className="flex shrink-0 items-center gap-3">
            {cta && (
              <a
                href={cta.href}
                className="hidden h-14 items-center gap-3 rounded-full border-2 border-ink bg-white px-7 text-[.84rem] font-medium tracking-[.14em] text-ink uppercase no-underline shadow-[4px_5px_0_var(--pu-mint)] transition-transform hover:-translate-y-0.5 sm:inline-flex"
              >
                <Bars className="text-[1.05rem]" />
                {cta.label}
              </a>
            )}
            <details className="group relative lg:hidden">
              <summary
                aria-label="Abrir menú"
                className="flex size-12 cursor-pointer list-none items-center justify-center rounded-full border-2 border-ink text-ink group-open:bg-ink group-open:text-white [&::-webkit-details-marker]:hidden"
              >
                <MenuIcon />
              </summary>
              <nav
                className="absolute top-[calc(100%+.75rem)] right-0 flex w-[min(18rem,calc(100vw-2.5rem))] flex-col gap-1 rounded-2xl border border-(--line) bg-white p-3 shadow-[0_20px_40px_-16px_rgba(0,0,0,.25)]"
                aria-label="Páginas"
              >
                <a href={link("/")} aria-current={page === "home" ? "page" : undefined} className="rounded-xl px-4 py-3 text-[.85rem] font-medium tracking-[.12em] text-ink uppercase no-underline hover:bg-(--pu-gray)">
                  Inicio
                </a>
                {items.map((i) => (
                  <a
                    key={i.href}
                    href={i.href}
                    aria-current={i.current ? "page" : undefined}
                    className={cn("rounded-xl px-4 py-3 text-[.85rem] font-medium tracking-[.12em] text-ink uppercase no-underline hover:bg-(--pu-gray)", i.current && "text-primary")}
                  >
                    {i.label}
                  </a>
                ))}
                {cta && (
                  <a href={cta.href} className="mt-2 inline-flex h-12 items-center justify-center gap-3 rounded-full bg-primary text-[.84rem] font-medium tracking-[.14em] text-primary-foreground uppercase no-underline">
                    <Bars className="text-[1rem]" />
                    {cta.label}
                  </a>
                )}
              </nav>
            </details>
          </div>
        </Wrap>
      </header>

      <main id="contenido">{children}</main>

      <footer className="bg-(--pu-gray) text-[#4a4a4a]">
        <div className="h-[3px] bg-[linear-gradient(90deg,var(--pu-lime),var(--pu-mint),var(--pu-violet))]" aria-hidden="true" />
        <Wrap className="py-16">
          <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1.2fr]">
            <div>
              {brand}
              {content.hero.subtitle && <p className="m-0 mt-5 max-w-sm text-[.95rem] leading-relaxed">{content.hero.subtitle}</p>}
              {status && (
                <p className="m-0 mt-5 inline-flex items-center gap-2.5 text-[.92rem] font-medium text-ink">
                  <StatusDot open={status.open} />
                  {status.label}
                </p>
              )}
              {content.healthRegistry && <p className="m-0 mt-3 text-[.82rem] text-[#7a7a7a]">Nº de registro sanitario {content.healthRegistry}</p>}
              <SocialLinks content={content} />
            </div>
            <nav className="flex flex-col gap-3" aria-label="Páginas">
              <p className="m-0 mb-1 text-[.72rem] font-semibold tracking-[.2em] text-primary uppercase">Páginas</p>
              <a href={link("/")} className="w-fit text-[.95rem] text-ink no-underline hover:text-primary">
                Inicio
              </a>
              {items.map((i) => (
                <a key={i.href} href={i.href} className="w-fit text-[.95rem] text-ink no-underline hover:text-primary">
                  {i.label}
                </a>
              ))}
              {bookingUrl && (
                <a href={link(bookingUrl)} className="w-fit text-[.95rem] text-ink no-underline hover:text-primary">
                  Reservar cita
                </a>
              )}
            </nav>
            <div>
              <p className="m-0 mb-4 text-[.72rem] font-semibold tracking-[.2em] text-primary uppercase">Contacto</p>
              <div className="text-[.95rem] [&_.kf-contact]:gap-2.5 [&_a]:text-ink [&_a]:no-underline [&_a:hover]:text-primary">
                <ContactList content={content} />
              </div>
            </div>
          </div>
          <div className="mt-12 border-t border-[#dcdcd8] pt-6 text-[.82rem] [&_a]:text-[#4a4a4a]">
            <LegalFooter props={props} />
          </div>
        </Wrap>
      </footer>
    </>
  );
}
