import { ContactList, HoursTable, Paragraphs } from "../shared/blocks.js";
import { formatDuration, formatPrice, telHref } from "../shared/format.js";
import { CheckIcon, ClockIcon } from "../shared/icons.js";
import type { SitePageProps } from "../types.js";

// Clara: light and clean, lots of white space. Every section hides itself
// when it's switched off in Mi web or has nothing to show
export default function Home({ props }: { props: SitePageProps }) {
  const { content, services, team, hours, img, link, bookingUrl } = props;
  const { sections, hero, about, highlights, faq } = content;
  const cover = img(content.coverId);
  const gallery = content.galleryIds.map((id) => img(id)).filter((u): u is string => !!u);
  const phone = content.contact.phone;

  return (
    <>
      <section className={`cl-hero${cover ? " cl-hero-photo" : ""}`}>
        <div className="cl-wrap cl-hero-grid">
          <div className="cl-hero-text">
            <h1>{hero.title}</h1>
            {hero.subtitle && <p className="cl-lead">{hero.subtitle}</p>}
            <div className="cl-actions">
              {bookingUrl && (
                <a href={link(bookingUrl)} className="cl-btn">
                  Reservar cita
                </a>
              )}
              {phone && (
                <a href={telHref(phone)} className={bookingUrl ? "cl-btn cl-btn-ghost" : "cl-btn"}>
                  Llamar al {phone}
                </a>
              )}
            </div>
          </div>
          {cover && <img src={cover} alt="" className="cl-hero-img" />}
        </div>
      </section>

      {highlights.length > 0 && (
        <section className="cl-section">
          <div className="cl-wrap">
            <h2>Por qué elegirnos</h2>
            <ul className="cl-highlights">
              {highlights.map((h, i) => (
                <li key={i}>
                  <span className="cl-check">
                    <CheckIcon />
                  </span>
                  <div>
                    <h3>{h.title}</h3>
                    {h.text && <p>{h.text}</p>}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {sections.services && services.length > 0 && (
        <section className="cl-section cl-tint" id="servicios">
          <div className="cl-wrap">
            <h2>Servicios</h2>
            <ul className="cl-services">
              {services.map((s) => (
                <li key={s.name} className="cl-card">
                  <div className="cl-service-head">
                    <h3>{s.name}</h3>
                    {s.priceCents > 0 && <span className="cl-price">{formatPrice(s.priceCents)}</span>}
                  </div>
                  <p className="cl-meta">
                    {formatDuration(s.durationMinutes)}
                    {s.isGroup && " · En grupo"}
                  </p>
                  {s.description && <Paragraphs text={s.description} />}
                </li>
              ))}
            </ul>
            {bookingUrl && (
              <p className="cl-center">
                <a href={link(bookingUrl)} className="cl-btn">
                  Reservar cita
                </a>
              </p>
            )}
          </div>
        </section>
      )}

      {sections.team && team.length > 0 && (
        <section className="cl-section" id="equipo">
          <div className="cl-wrap">
            <h2>Nuestro equipo</h2>
            <ul className="cl-team">
              {team.map((m) => (
                <li key={m.name} className="cl-person">
                  {m.photoUrl ? (
                    <img src={m.photoUrl} alt={m.name} loading="lazy" className="cl-avatar" />
                  ) : (
                    <span className="cl-avatar cl-avatar-empty" aria-hidden="true">
                      {m.name.charAt(0)}
                    </span>
                  )}
                  <h3>{m.name}</h3>
                  {m.headline && <p className="cl-meta">{m.headline}</p>}
                  {m.licenseNumber && <p className="cl-small">Nº de colegiado {m.licenseNumber}</p>}
                  {m.bio && <Paragraphs text={m.bio} className="cl-bio" />}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {sections.about && about?.text && (
        <section className="cl-section cl-tint" id="nosotros">
          <div className="cl-wrap cl-narrow">
            <h2>{about.title || "Quiénes somos"}</h2>
            <Paragraphs text={about.text} />
          </div>
        </section>
      )}

      {sections.gallery && gallery.length > 0 && (
        <section className="cl-section">
          <div className="cl-wrap">
            <h2>Nuestras instalaciones</h2>
            <ul className="cl-gallery">
              {gallery.map((src) => (
                <li key={src}>
                  <img src={src} alt="" loading="lazy" />
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {sections.faq && faq.length > 0 && (
        <section className="cl-section cl-tint" id="preguntas">
          <div className="cl-wrap cl-narrow">
            <h2>Preguntas frecuentes</h2>
            {/* <details>: opens and closes without JavaScript */}
            {faq.map((f, i) => (
              <details key={i} className="cl-faq">
                <summary>{f.q}</summary>
                <Paragraphs text={f.a} />
              </details>
            ))}
          </div>
        </section>
      )}

      <section className="cl-section" id="contacto">
        <div className="cl-wrap cl-contact-grid">
          <div>
            <h2>Contacto</h2>
            <ContactList content={content} />
          </div>
          {sections.hours && hours.length > 0 && (
            <div>
              <h2 className="cl-h-icon">
                <ClockIcon />
                Horario
              </h2>
              <HoursTable hours={hours} />
            </div>
          )}
        </div>
      </section>
    </>
  );
}
