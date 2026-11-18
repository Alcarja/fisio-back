import type { ReactNode } from "react";
import { ContactList, LegalFooter, SocialLinks } from "../shared/blocks.js";
import { cn } from "../shared/cn.js";
import { telHref } from "../shared/format.js";
import { navItems } from "../shared/nav.js";
import { ArrowUpRight, MenuIcon } from "../shared/ui.js";
import type { SitePageProps } from "../types.js";
import { HoursList, Mark, secondColorClass, statusOf, Wrap } from "./sections.js";

// Big enough to fill the panel, small enough that long names still fit
const logoSize = (name: string) => `min(9rem, ${(150 / Math.max(name.length + 2, 8)).toFixed(2)}vw)`;

// Pulso: a light bar (mark + name, links, "Pide cita ↗", the open status);
// the footer is a cream panel with the name huge, pages, contact and hours.
// Phones: the menu opens from a <details> (no JavaScript)
export default function Layout({ props, children }: { props: SitePageProps; children: ReactNode }) {
  const { clinic, content, img, link, bookingUrl, hours, page } = props;
  const logo = img(content.logoId);
  const phone = content.contact.phone;
  const items = navItems(props);
  const status = statusOf(props);
  const cta = bookingUrl ? { href: link(bookingUrl), label: "Pide cita" } : phone ? { href: telHref(phone), label: "Llámanos" } : null;

  return (
    <div className={cn("s8-root min-h-screen", secondColorClass(props))}>
      <a href="#contenido" className="kf-skip">
        Saltar al contenido
      </a>
      <header className="sticky top-0 z-50 bg-(--s8-paper)/90 backdrop-blur-md">
        <Wrap className="flex h-20 items-center justify-between gap-6 md:h-[7.5rem]">
          <a href={link("/")} className="flex min-w-0 items-center gap-2.5 text-ink no-underline">
            {logo ? (
              <img src={logo} alt={clinic.name} className="block max-h-11 max-w-40 object-contain" />
            ) : (
              <>
                <Mark className="text-[1.7rem]" />
                <span className="s8-display truncate text-[1.6rem] leading-none">{clinic.name}</span>
              </>
            )}
          </a>
          <div className="flex shrink-0 items-center gap-8">
            <nav className="hidden items-center gap-8 lg:flex" aria-label="Páginas">
              {items.map((i) => (
                <a
                  key={i.href}
                  href={i.href}
                  aria-current={i.current ? "page" : undefined}
                  className={cn("text-[1.02rem] text-ink no-underline hover:text-primary", i.current && "underline decoration-2 underline-offset-8")}
                >
                  {i.label}
                </a>
              ))}
              {cta && (
                <a href={cta.href} className="inline-flex items-center gap-1 text-[1.02rem] font-semibold text-ink no-underline hover:text-primary">
                  {cta.label}
                  <span className="text-(--s8-second)">
                    <ArrowUpRight />
                  </span>
                </a>
              )}
            </nav>
            {status && (
              <span className="hidden h-9 items-center gap-2 rounded-full border border-[#cfccc5] px-1 pr-3 text-[.75rem] md:inline-flex">
                <span className={cn("rounded-full px-2.5 py-1 font-medium text-white", status.open ? "bg-ink" : "bg-[#8a8781]")}>
                  {status.open ? "Abierto" : "Cerrado"}
                </span>
                <span className="text-[#6b6964]">{status.label.split("·")[1]?.trim()}</span>
              </span>
            )}
            <details className="group relative lg:hidden">
              <summary
                aria-label="Abrir menú"
                className="flex size-11 cursor-pointer list-none items-center justify-center rounded-full bg-ink text-white [&::-webkit-details-marker]:hidden"
              >
                <MenuIcon />
              </summary>
              <nav
                className="absolute top-[calc(100%+.75rem)] right-0 flex w-[min(18rem,calc(100vw-2.5rem))] flex-col rounded-[1.25rem] bg-(--s8-cream) p-3 shadow-[0_24px_48px_-20px_rgba(0,0,0,.3)]"
                aria-label="Páginas"
              >
                <a href={link("/")} aria-current={page === "home" ? "page" : undefined} className="rounded-xl px-4 py-3 text-[1.05rem] text-ink no-underline hover:bg-black/5">
                  Inicio
                </a>
                {items.map((i) => (
                  <a
                    key={i.href}
                    href={i.href}
                    aria-current={i.current ? "page" : undefined}
                    className={cn("rounded-xl px-4 py-3 text-[1.05rem] text-ink no-underline hover:bg-black/5", i.current && "font-semibold")}
                  >
                    {i.label}
                  </a>
                ))}
                {cta && (
                  <a href={cta.href} className="mt-2 inline-flex h-12 items-center justify-center rounded-full bg-ink text-[.84rem] font-medium tracking-[.08em] text-white uppercase no-underline">
                    {cta.label}
                  </a>
                )}
              </nav>
            </details>
          </div>
        </Wrap>
      </header>

      <main id="contenido">{children}</main>

      <footer className="px-2.5 pb-2.5 md:px-5 md:pb-5">
        <div className="rounded-[1.75rem] bg-(--s8-cream) px-6 pt-14 pb-8 md:px-[3.75rem] md:pt-20">
          <div className="flex flex-col gap-14 border-b border-[#dedbd4] pb-12">
            <a href={link("/")} className="flex items-center gap-[.15em] text-ink no-underline" style={{ fontSize: logoSize(clinic.name) }}>
              <Mark />
              <span className="s8-display leading-[.85]">{clinic.name}</span>
            </a>
            <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1fr_1.4fr_1.4fr] lg:gap-16">
              <nav className="flex flex-col gap-2.5" aria-label="Páginas">
                <p className="m-0 mb-1 text-[.72rem] tracking-[.1em] text-[#7a7873] uppercase">Clínica</p>
                <a href={link("/")} className="text-[1.02rem] text-ink no-underline hover:text-primary">
                  Inicio
                </a>
                {items.map((i) => (
                  <a key={i.href} href={i.href} className="text-[1.02rem] text-ink no-underline hover:text-primary">
                    {i.label}
                  </a>
                ))}
              </nav>
              <div>
                <p className="m-0 mb-3.5 text-[.72rem] tracking-[.1em] text-[#7a7873] uppercase">Contacto</p>
                <div className="text-[.98rem] [&_.kf-contact]:gap-2.5 [&_a]:text-ink [&_a]:no-underline [&_a:hover]:text-primary">
                  <ContactList content={content} />
                </div>
                <SocialLinks content={content} />
              </div>
              {content.sections.hours && hours.length > 0 && (
                <div className="w-full max-w-[22rem]">
                  <p className="m-0 mb-2 text-[.72rem] tracking-[.1em] text-[#7a7873] uppercase">Horario</p>
                  <HoursList hours={hours} className="[&_li]:py-1.5 [&_li]:text-[.86rem]" />
                </div>
              )}
            </div>
          </div>
          <div className="pt-6 text-[.86rem] text-[#6b6964] [&_a]:text-[#6b6964] [&_.kf-legal_nav]:gap-5">
            <LegalFooter props={props} />
          </div>
        </div>
      </footer>
    </div>
  );
}
