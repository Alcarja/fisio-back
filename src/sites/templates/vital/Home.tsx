import { initials, telHref } from "../shared/format.js";
import { CalendarIcon, PhoneIcon } from "../shared/icons.js";
import type { SitePageProps } from "../types.js";
import { About, Contact, Cta, Faq, Gallery, Points, Services, Team } from "./sections.js";

// Vital: bold and sporty. Dark hero with huge uppercase titles, a moving
// strip with the strengths, numbered service tiles, diagonal cuts. Every
// section hides itself when it's switched off in Mi web or has nothing to show
export default function Home({ props }: { props: SitePageProps }) {
  const { clinic, content, img, link, bookingUrl } = props;
  const { hero, highlights, contact } = content;
  const cover = img(content.coverId);
  // The strip repeats the strengths so it loops without a gap
  const strip = highlights.length ? highlights.map((h) => h.title) : [];

  return (
    <>
      <section className={`vi-hero${cover ? " vi-hero-photo" : ""}`}>
        {cover && <img src={cover} alt="" className="vi-hero-bg" />}
        {!cover && (
          <span className="vi-hero-mark" aria-hidden="true">
            {initials(clinic.name)}
          </span>
        )}
        <div className="kf-wrap vi-hero-inner">
          {contact.city && <p className="vi-kicker">Fisioterapia · {contact.city}</p>}
          <h1>{hero.title}</h1>
          {hero.subtitle && <p className="vi-lead">{hero.subtitle}</p>}
          <div className="vi-actions">
            {bookingUrl && (
              <a href={link(bookingUrl)} className="vi-btn">
                <CalendarIcon />
                Reservar cita
              </a>
            )}
            {contact.phone && (
              <a href={telHref(contact.phone)} className={bookingUrl ? "vi-btn vi-btn-ghost" : "vi-btn"}>
                <PhoneIcon />
                {contact.phone}
              </a>
            )}
          </div>
        </div>
      </section>

      {strip.length > 0 && (
        <div className="vi-strip">
          <div className="vi-strip-track">
            {[0, 1].map((copy) => (
              <ul key={copy} aria-hidden={copy === 1 ? "true" : undefined}>
                {[...strip, ...strip].map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            ))}
          </div>
        </div>
      )}

      <Points props={props} />
      <Services props={props} />
      <Team props={props} />
      <About props={props} />
      <Gallery props={props} />
      <Faq props={props} />
      <Cta props={props} />
      <Contact props={props} />
    </>
  );
}
