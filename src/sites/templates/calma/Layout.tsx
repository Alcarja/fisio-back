import type { CSSProperties, ReactNode } from "react";
import { cn } from "../shared/cn.js";
import { telHref } from "../shared/format.js";
import { navItems } from "../shared/nav.js";
import { MenuIcon } from "../shared/ui.js";
import type { SitePageProps } from "../types.js";
import { bookTarget, Btn, calmaPrimary, Logo, PhoneIcon, TopBar, Wrap } from "./sections.js";

// Calma: a top bar in the clinic's colour (opening hours, address), a white
// header where the phone and "Pedir cita" never go away, a fixed call / book
// bar on phones and a dark footer with the health registration. The menu
// opens from a <details> on phones (no JavaScript)
export default function Layout({ props, children }: { props: SitePageProps; children: ReactNode }) {
  const { content, link, bookingUrl, page, clinic, showKineflowCredit, appUrl } = props;
  const c = content.contact;
  const items = navItems(props);
  const primary = calmaPrimary(content.theme.primary);
  const target = bookTarget(props);
  const bar = !!(c.phone || bookingUrl) && page !== "reservar";

  return (
    <div className={cn("cl-root min-h-screen", bar && "cl-has-bar")} style={{ "--cl-primary": primary } as CSSProperties}>
      <a href="#contenido" className="kf-skip">
        Saltar al contenido
      </a>

      <TopBar props={props} />

      <header className="sticky top-0 z-50 border-x-0 border-t-0 border-b border-solid border-(--cl-line) bg-white/95 backdrop-blur-md">
        <Wrap className="flex min-h-[76px] items-center justify-between gap-x-8 gap-y-2 py-3.5">
          <Logo props={props} />
          <nav aria-label="Principal" className="hidden flex-wrap gap-x-7 text-base font-medium lg:flex">
            {items.map((i) => (
              <a
                key={i.href}
                href={i.href}
                aria-current={i.current ? "page" : undefined}
                className={cn("py-3 text-(--cl-ink) no-underline hover:text-(--cl-primary)", i.current && "text-(--cl-primary) underline underline-offset-8")}
              >
                {i.label}
              </a>
            ))}
          </nav>
          <div className="flex shrink-0 items-center gap-3">
            {c.phone && (
              <Btn href={telHref(c.phone)} tone="outline" size="md" className="hidden md:inline-flex">
                <PhoneIcon /> {c.phone}
              </Btn>
            )}
            {target && (
              <Btn href={target.href} tone="ink" size="md" className="hidden px-[22px] sm:inline-flex">
                Pedir cita
              </Btn>
            )}
            <details className="relative lg:hidden">
              <summary aria-label="Abrir menú" className="flex size-12 cursor-pointer list-none items-center justify-center rounded-[12px] border border-solid border-(--cl-line) text-(--cl-ink) [&::-webkit-details-marker]:hidden">
                <MenuIcon />
              </summary>
              <nav
                aria-label="Menú"
                className="absolute top-[calc(100%+.75rem)] right-0 box-border flex w-[min(20rem,calc(100vw-2.5rem))] flex-col gap-1 rounded-[20px] border border-solid border-(--cl-line) bg-white p-3 shadow-[0_12px_32px_rgba(15,31,28,.12)]"
              >
                <a href={link("/")} aria-current={page === "home" ? "page" : undefined} className={cn("rounded-[12px] px-4 py-3 font-medium text-(--cl-ink) no-underline hover:bg-(--cl-tint)", page === "home" && "bg-(--cl-tint)")}>
                  Inicio
                </a>
                {items.map((i) => (
                  <a key={i.href} href={i.href} aria-current={i.current ? "page" : undefined} className={cn("rounded-[12px] px-4 py-3 font-medium text-(--cl-ink) no-underline hover:bg-(--cl-tint)", i.current && "bg-(--cl-tint)")}>
                    {i.label}
                  </a>
                ))}
              </nav>
            </details>
          </div>
        </Wrap>
      </header>

      <main id="contenido" className="cl-main">
        {children}
      </main>

      <footer className="cl-dark bg-(--cl-ink) text-sm text-(--cl-on-dark-muted)">
        <Wrap className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4 py-10">
          <span className="text-lg font-bold text-white">{clinic.name} · Clínica de fisioterapia</span>
          {content.healthRegistry && <span>Centro sanitario autorizado · Nº registro {content.healthRegistry}</span>}
          <nav aria-label="Información legal" className="flex flex-wrap gap-x-6">
            {[
              ["/aviso-legal", "Aviso legal"],
              ["/privacidad", "Privacidad"],
              ["/cookies", "Cookies"],
            ].map(([path, label]) => (
              <a key={path} href={link(path!)} className="py-3 text-(--cl-on-dark-muted) no-underline hover:text-white hover:underline">
                {label}
              </a>
            ))}
          </nav>
          <p className="m-0 basis-full border-x-0 border-t border-b-0 border-solid border-(--cl-on-dark-line) pt-4 text-[13px]">
            © {new Date().getFullYear()} {clinic.name}
            {showKineflowCredit && (
              <>
                {" · "}Reservas con{" "}
                <a href={appUrl} target="_blank" rel="noopener" className="text-white">
                  Kineflow
                </a>
              </>
            )}
          </p>
        </Wrap>
      </footer>

      {bar && (
        <nav aria-label="Pedir cita" className="fixed inset-x-0 bottom-0 z-50 flex gap-2.5 border-x-0 border-t border-b-0 border-solid border-(--cl-line) bg-white/95 p-3 backdrop-blur-md lg:hidden">
          {c.phone && (
            <Btn href={telHref(c.phone)} tone="outline" size="md" className="flex-1">
              <PhoneIcon /> Llamar
            </Btn>
          )}
          {target && bookingUrl && (
            <Btn href={target.href} tone="primary" size="md" className="flex-1">
              Pedir cita
            </Btn>
          )}
        </nav>
      )}
    </div>
  );
}
