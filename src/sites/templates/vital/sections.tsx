import { ContactList, HoursTable, Paragraphs } from "../shared/blocks.js";
import { formatDuration, formatPrice, initials, telHref } from "../shared/format.js";
import type { SitePageProps } from "../types.js";

// Vital's sections, shared by the home page and the inner pages. Each one
// renders nothing when it's off in Mi web or has nothing to show

type P = { props: SitePageProps };

const Dot = () => <span className="vi-dot">.</span>;

// Inner pages: a dark band with a huge uppercase title
export function PageHead({ props, kicker, title, lead }: P & { kicker: string; title: string; lead?: string }) {
  return (
    <section className="vi-page-head">
      <div className="kf-wrap">
        <p className="vi-crumbs">
          <a href={props.link("/")}>Inicio</a> <span aria-hidden="true">/</span> {kicker}
        </p>
        <h1>
          {title}
          <Dot />
        </h1>
        {lead && <p className="vi-lead">{lead}</p>}
      </div>
    </section>
  );
}

export function Points({ props }: P) {
  const { highlights } = props.content;
  if (!highlights.some((h) => h.text)) return null;
  return (
    <section className="vi-section">
      <div className="kf-wrap">
        <ul className="vi-points">
          {highlights.map((h, i) => (
            <li key={i}>
              <span className="vi-index">/{String(i + 1).padStart(2, "0")}</span>
              <h3>{h.title}</h3>
              {h.text && <p>{h.text}</p>}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function Services({ props, heading = true }: P & { heading?: boolean }) {
  const { content, services } = props;
  if (!content.sections.services || !services.length) return null;
  return (
    <section className={`vi-section vi-dark${heading ? " vi-cut" : ""}`} id="servicios">
      <div className="kf-wrap">
        {heading && (
          <h2>
            Servicios
            <Dot />
          </h2>
        )}
        <ul className="vi-tiles">
          {services.map((s, i) => (
            <li key={s.name}>
              <span className="vi-tile-num">{String(i + 1).padStart(2, "0")}</span>
              <h3>{s.name}</h3>
              <p className="vi-tile-meta">
                {formatDuration(s.durationMinutes)}
                {s.isGroup && " · Grupo"}
                {s.priceCents > 0 && <strong>{formatPrice(s.priceCents)}</strong>}
              </p>
              {s.description && <Paragraphs text={s.description} className="vi-tile-desc" />}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function Team({ props, heading = true }: P & { heading?: boolean }) {
  const { content, team } = props;
  if (!content.sections.team || !team.length) return null;
  return (
    <section className="vi-section" id="equipo">
      <div className="kf-wrap">
        {heading && (
          <h2>
            Equipo
            <Dot />
          </h2>
        )}
        <ul className="vi-team">
          {team.map((m) => (
            <li key={m.name}>
              <div className="vi-photo">
                {m.photoUrl ? (
                  <img src={m.photoUrl} alt={m.name} loading="lazy" />
                ) : (
                  <span aria-hidden="true">{initials(m.name)}</span>
                )}
                {m.headline && <p className="vi-badge">{m.headline}</p>}
              </div>
              <h3>{m.name}</h3>
              {m.bio && <Paragraphs text={m.bio} className="vi-bio" />}
              {m.licenseNumber && <p className="vi-license">Col. nº {m.licenseNumber}</p>}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function About({ props }: P) {
  const { about, sections } = props.content;
  if (!sections.about || !about?.text) return null;
  return (
    <section className="vi-section vi-accent vi-cut" id="nosotros">
      <div className="kf-wrap vi-about">
        <h2>{about.title || "Quiénes somos"}</h2>
        <div>
          <Paragraphs text={about.text} />
        </div>
      </div>
    </section>
  );
}

export function Gallery({ props }: P) {
  const { content, img } = props;
  const gallery = content.galleryIds.map((id) => img(id)).filter((u): u is string => !!u);
  if (!content.sections.gallery || !gallery.length) return null;
  return (
    <section className="vi-gallery-wrap">
      <ul className="vi-gallery">
        {gallery.map((src) => (
          <li key={src}>
            <img src={src} alt="" loading="lazy" />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function Faq({ props }: P) {
  const { faq, sections } = props.content;
  if (!sections.faq || !faq.length) return null;
  return (
    <section className="vi-section" id="preguntas">
      <div className="kf-wrap vi-faq-grid">
        <h2>
          Preguntas
          <Dot />
        </h2>
        <div>
          {faq.map((f, i) => (
            // <details>: opens and closes without JavaScript
            <details key={i} className="vi-faq">
              <summary>{f.q}</summary>
              <Paragraphs text={f.a} />
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function Cta({ props }: P) {
  const { bookingUrl, link, content } = props;
  const phone = content.contact.phone;
  if (!bookingUrl && !phone) return null;
  return (
    <section className="vi-cta">
      <div className="kf-wrap">
        <p className="vi-cta-big">Vuelve a moverte.</p>
        <a href={bookingUrl ? link(bookingUrl) : telHref(phone!)} className="vi-btn vi-btn-dark">
          {bookingUrl ? "Reservar cita" : `Llamar al ${phone}`}
        </a>
      </div>
    </section>
  );
}

export function Contact({ props }: P) {
  const { content, hours } = props;
  return (
    <section className="vi-section" id="contacto">
      <div className="kf-wrap vi-contact">
        <div>
          <h2>
            Contacto
            <Dot />
          </h2>
          <ContactList content={content} />
        </div>
        {content.sections.hours && hours.length > 0 && (
          <div className="vi-hours">
            <h3>Horario</h3>
            <HoursTable hours={hours} />
          </div>
        )}
      </div>
    </section>
  );
}
