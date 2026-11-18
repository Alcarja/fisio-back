import type { ReactNode } from "react";
import { FooterNav, LegalFooter, SocialLinks } from "../shared/blocks.js";
import { telHref } from "../shared/format.js";
import { navItems } from "../shared/nav.js";
import type { SitePageProps } from "../types.js";

// Vital: bold and sporty. Dark bar on top, big footer with the name
export default function Layout({ props, children }: { props: SitePageProps; children: ReactNode }) {
  const { clinic, content, img, link, bookingUrl } = props;
  const logo = img(content.logoId);
  const phone = content.contact.phone;
  return (
    <>
      <a href="#contenido" className="kf-skip">
        Saltar al contenido
      </a>
      <header className="vi-header">
        <div className="kf-wrap vi-header-row">
          <a href={link("/")} className="vi-brand">
            {logo ? <img src={logo} alt={clinic.name} className="vi-logo" /> : clinic.name}
          </a>
          <nav className="vi-nav" aria-label="Secciones">
            {navItems(props).map((i) => (
              <a key={i.href} href={i.href} aria-current={i.current ? "page" : undefined}>
                {i.label}
              </a>
            ))}
          </nav>
          {bookingUrl ? (
            <a href={link(bookingUrl)} className="vi-btn vi-btn-sm">
              Reservar
            </a>
          ) : (
            phone && (
              <a href={telHref(phone)} className="vi-btn vi-btn-sm">
                Llamar
              </a>
            )
          )}
        </div>
      </header>

      <main id="contenido">{children}</main>

      <footer className="vi-footer">
        <div className="kf-wrap">
          <p className="vi-footer-name">{clinic.name}</p>
          <div className="vi-footer-grid">
            <FooterNav items={navItems(props)} />
            <SocialLinks content={content} />
          </div>
          <LegalFooter props={props} />
        </div>
      </footer>
    </>
  );
}
