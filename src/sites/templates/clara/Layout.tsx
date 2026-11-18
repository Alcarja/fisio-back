import type { ReactNode } from "react";
import { ContactList, LegalFooter, SocialLinks } from "../shared/blocks.js";
import { telHref } from "../shared/format.js";
import { CalendarIcon, PhoneIcon } from "../shared/icons.js";
import { navItems } from "../shared/nav.js";
import { MenuIcon } from "../shared/ui.js";
import type { SitePageProps } from "../types.js";

// Big enough to fill the width, small enough that long names still fit
const wordmarkSize = (name: string) => `min(10.5rem, ${(165 / Math.max(name.length + 1, 8)).toFixed(2)}vw)`;
import { Brand, Btn, HoursBoard, Plus } from "./sections.js";

// Clara: a floating pill bar (brand, menu, a loud button); the footer opens
// with the giant call to action, on every page, then the dark footer with
// the clinic's name huge in its colour. Phones: <details> menu, no JavaScript
export default function Layout({ props, children }: { props: SitePageProps; children: ReactNode }) {
  const { clinic, content, link, bookingUrl, hours, page } = props;
  const phone = content.contact.phone;
  const items = navItems(props);
  const cta = bookingUrl
    ? { href: link(bookingUrl), label: "Reservar" }
    : phone
      ? { href: telHref(phone), label: "Llamar" }
      : null;
  const showCta = page !== "reservar" && (bookingUrl || phone);

  return (
    <>
      <a href="#contenido" className="kf-skip">
        Saltar al contenido
      </a>
      <header className="cl-header">
        <div className="kf-wrap">
          <div className="cl-pill">
            <Brand props={props} />
            <nav className="cl-nav" aria-label="Páginas">
              {items.map((i) => (
                <a key={i.href} href={i.href} aria-current={i.current ? "page" : undefined}>
                  {i.label}
                </a>
              ))}
            </nav>
            <div className="cl-pill-end">
              {cta && (
                <a href={cta.href} className="cl-pill-cta">
                  {cta.label}
                  <Plus />
                </a>
              )}
              <details className="cl-mobile">
                <summary aria-label="Abrir menú" className="cl-menu-btn">
                  <MenuIcon />
                </summary>
                <nav className="cl-mobile-panel" aria-label="Páginas">
                  <a href={link("/")} aria-current={page === "home" ? "page" : undefined}>
                    Inicio
                  </a>
                  {items.map((i) => (
                    <a key={i.href} href={i.href} aria-current={i.current ? "page" : undefined}>
                      {i.label}
                    </a>
                  ))}
                  {cta && <Btn href={cta.href}>{cta.label}</Btn>}
                </nav>
              </details>
            </div>
          </div>
        </div>
      </header>

      <main id="contenido">{children}</main>

      <footer className="cl-footer">
        {showCta && (
          <div className="cl-cta">
            <Plus className="cl-cta-plus cl-cta-plus-a" />
            <Plus className="cl-cta-plus cl-cta-plus-b" />
            <div className="kf-wrap cl-cta-inner">
              <p className="cl-cta-big">
                Deja de
                <br />
                aguantar el dolor.
              </p>
              <div className="cl-cta-side">
                <p>Una valoración a tiempo te ahorra meses de molestias. Reserva hoy y empezamos.</p>
                <div className="cl-actions">
                  {bookingUrl && (
                    <Btn href={link(bookingUrl)} tone="ink">
                      <CalendarIcon />
                      Reservar cita
                    </Btn>
                  )}
                  {phone && (
                    <Btn href={telHref(phone)} tone="paper">
                      <PhoneIcon />
                      {phone}
                    </Btn>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        <div className="cl-footer-dark">
          <div className="kf-wrap">
            <div className="cl-footer-grid">
              <div className="cl-footer-brand">
                <Brand props={props} invert />
                {content.hero.subtitle && <p>{content.hero.subtitle}</p>}
                {content.healthRegistry && <p className="cl-footer-small">Nº de registro sanitario {content.healthRegistry}</p>}
                <SocialLinks content={content} />
              </div>
              <nav className="cl-footer-col" aria-label="Páginas">
                <p className="cl-footer-label">Navega</p>
                <a href={link("/")}>Inicio</a>
                {items.map((i) => (
                  <a key={i.href} href={i.href}>
                    {i.label}
                  </a>
                ))}
                {bookingUrl && <a href={link(bookingUrl)}>Reservar cita</a>}
              </nav>
              <div className="cl-footer-col">
                <p className="cl-footer-label">Contacto</p>
                <ContactList content={content} />
              </div>
              {content.sections.hours && hours.length > 0 && (
                <div className="cl-footer-col">
                  <p className="cl-footer-label">Horario</p>
                  <HoursBoard hours={hours} />
                </div>
              )}
            </div>
            <LegalFooter props={props} />
          </div>
          <p className="cl-wordmark" aria-hidden="true" style={{ fontSize: wordmarkSize(clinic.name) }}>
            {clinic.name}
            <Plus />
          </p>
        </div>
      </footer>
    </>
  );
}
