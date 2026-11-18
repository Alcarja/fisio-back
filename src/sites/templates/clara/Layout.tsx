import type { ReactNode } from "react";
import { ContactList, LegalFooter, SocialLinks } from "../shared/blocks.js";
import type { SitePageProps } from "../types.js";

// Clara: the frame of every page. Header with logo/name and "Reservar cita",
// footer with contact and legal links
export default function Layout({ props, children }: { props: SitePageProps; children: ReactNode }) {
  const { clinic, content, img, link, bookingUrl } = props;
  const logo = img(content.logoId);
  return (
    <>
      <header className="cl-header">
        <div className="cl-wrap cl-header-row">
          <a href={link("/")} className="cl-brand">
            {logo ? <img src={logo} alt={clinic.name} className="cl-logo" /> : <span>{clinic.name}</span>}
          </a>
          {bookingUrl ? (
            <a href={link(bookingUrl)} className="cl-btn cl-btn-small">
              Reservar cita
            </a>
          ) : (
            content.contact.phone && (
              <a href={`tel:${content.contact.phone.replace(/[^\d+]/g, "")}`} className="cl-btn cl-btn-small">
                Llamar
              </a>
            )
          )}
        </div>
      </header>

      <main>{children}</main>

      <footer className="cl-footer">
        <div className="cl-wrap cl-footer-grid">
          <div>
            <p className="cl-footer-name">{clinic.name}</p>
            <ContactList content={content} />
            <SocialLinks content={content} />
          </div>
          <LegalFooter props={props} />
        </div>
      </footer>
    </>
  );
}
