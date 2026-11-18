import type { ReactNode } from "react";
import { ContactList, LegalFooter, SocialLinks } from "../shared/blocks.js";
import { fullAddress, telHref } from "../shared/format.js";
import { CalendarIcon, MapPinIcon, PhoneIcon } from "../shared/icons.js";
import { navItems } from "../shared/nav.js";
import { Button, MenuIcon } from "../shared/ui.js";
import type { SitePageProps } from "../types.js";

// Big enough to fill the width, small enough that long names still fit
const wordmarkSize = (name: string) => `min(10.5rem, ${(165 / Math.max(name.length + 1, 8)).toFixed(2)}vw)`;
import { Brand, HoursList, Status, statusOf } from "./sections.js";

// Serena: a thin bar with what patients check first (open now, address,
// phone), the clinic's brand and menu, and a full footer with the hours.
// On phones the menu opens from a <details> (no JavaScript)
export default function Layout({ props, children }: { props: SitePageProps; children: ReactNode }) {
  const { clinic, content, link, bookingUrl, hours } = props;
  const { phone } = content.contact;
  const address = fullAddress(content.contact);
  const status = statusOf(props);
  const items = navItems(props);
  const cta = bookingUrl
    ? { href: link(bookingUrl), label: "Pedir cita" }
    : phone
      ? { href: telHref(phone), label: "Llamar" }
      : null;

  return (
    <>
      <a href="#contenido" className="kf-skip">
        Saltar al contenido
      </a>
      {(status || address || phone) && (
        <div className="se-topbar">
          <div className="kf-wrap se-topbar-row">
            <span className="se-topbar-left">
              {status && <Status status={status} />}
              {address && (
                <span className="se-topbar-address">
                  <MapPinIcon />
                  {address}
                </span>
              )}
            </span>
            {phone && (
              <a href={telHref(phone)} className="se-topbar-phone">
                <PhoneIcon />
                {phone}
              </a>
            )}
          </div>
        </div>
      )}
      <header className="se-header">
        <div className="kf-wrap se-header-row">
          <Brand props={props} />
          <nav className="se-nav" aria-label="Páginas">
            <a href={link("/")} aria-current={props.page === "home" ? "page" : undefined}>
              Inicio
            </a>
            {items.map((i) => (
              <a key={i.href} href={i.href} aria-current={i.current ? "page" : undefined}>
                {i.label}
              </a>
            ))}
          </nav>
          <div className="se-header-end">
            {cta && (
              <Button href={cta.href} className="se-header-cta">
                {bookingUrl && <CalendarIcon />}
                {cta.label}
              </Button>
            )}
            <details className="se-mobile">
              <summary aria-label="Abrir menú" className="ui-btn ui-btn-outline ui-btn-size-icon">
                <MenuIcon />
              </summary>
              <nav className="se-mobile-panel" aria-label="Páginas">
                <a href={link("/")} aria-current={props.page === "home" ? "page" : undefined}>
                  Inicio
                </a>
                {items.map((i) => (
                  <a key={i.href} href={i.href} aria-current={i.current ? "page" : undefined}>
                    {i.label}
                  </a>
                ))}
                {cta && (
                  <Button href={cta.href} className="se-mobile-cta">
                    {cta.label}
                  </Button>
                )}
              </nav>
            </details>
          </div>
        </div>
      </header>

      <main id="contenido">{children}</main>

      <footer className="se-footer">
        <div className="kf-wrap">
          <div className="se-footer-grid">
            <div className="se-footer-brand">
              <Brand props={props} inverted />
              {content.hero.subtitle && <p>{content.hero.subtitle}</p>}
              {content.healthRegistry && <p className="se-footer-registry">Nº de registro sanitario {content.healthRegistry}</p>}
              <SocialLinks content={content} />
            </div>
            <nav className="se-footer-col" aria-label="Páginas">
              <p className="se-footer-label">{clinic.name}</p>
              <a href={link("/")}>Inicio</a>
              {items.map((i) => (
                <a key={i.href} href={i.href}>
                  {i.label}
                </a>
              ))}
              {bookingUrl && <a href={link(bookingUrl)}>Reservar cita</a>}
            </nav>
            <div className="se-footer-col">
              <p className="se-footer-label">Contacto</p>
              <ContactList content={content} />
            </div>
            {content.sections.hours && hours.length > 0 && (
              <div className="se-footer-col">
                <p className="se-footer-label">Horario</p>
                <HoursList hours={hours} />
              </div>
            )}
          </div>
          <LegalFooter props={props} />
        </div>
        <p className="se-wordmark" aria-hidden="true" style={{ fontSize: wordmarkSize(clinic.name) }}>
          {clinic.name}
        </p>
      </footer>
    </>
  );
}
