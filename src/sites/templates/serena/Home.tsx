import { initials, paragraphs, telHref } from "../shared/format.js";
import { CalendarIcon, ClockIcon, PhoneIcon } from "../shared/icons.js";
import { Badge, Button } from "../shared/ui.js";
import type { SitePageProps } from "../types.js";
import {
  AvatarStack,
  counter,
  CtaBand,
  Emphasis,
  Eyebrow,
  Faq,
  FirstVisit,
  Gallery,
  Highlights,
  Location,
  Marquee,
  MoreLink,
  QuoteCard,
  SectionHead,
  ServiceCard,
  Spine,
  Status,
  Sticker,
  statusOf,
  TeamCard,
  TrustBar,
} from "./sections.js";

// How many services and people the home page shows before "Ver todos"
const HOME_SERVICES = 6;
const HOME_TEAM = 3;

// Serena: a physiotherapy clinic's home page. What patients look for, in the
// order they look for it: can I book, is it open, what do you treat, how
// does it work, who will treat me, where are you. Every block is built from
// the clinic's data and hides itself when it's off in Mi web or empty
export default function Home({ props }: { props: SitePageProps }) {
  const { clinic, content, services, team, img, link, bookingUrl } = props;
  const { sections, hero, about, highlights, faq, contact } = content;
  const cover = img(content.coverId);
  const gallery = content.galleryIds.map((id) => img(id)).filter((u): u is string => !!u);
  const showServices = sections.services && services.length > 0;
  const showTeam = sections.team && team.length > 0;
  const showAbout = sections.about && !!about?.text;
  const status = statusOf(props);
  const aboutParas = paragraphs(about?.text);
  const next = counter();
  const sticker = `${bookingUrl ? "Reserva online" : "Fisioterapia"} · ${contact.city || clinic.name} · `;

  return (
    <>
      <section className="se-hero">
        <div className="kf-wrap se-hero-grid">
          <div className="se-hero-text">
            <Badge variant="secondary" className="se-hero-badge">
              Fisioterapia{contact.city ? ` en ${contact.city}` : ""}
            </Badge>
            <h1>
              <Emphasis text={hero.title} />
            </h1>
            {hero.subtitle && <p className="se-lead">{hero.subtitle}</p>}
            <div className="se-actions">
              {bookingUrl && (
                <Button size="lg" href={link(bookingUrl)}>
                  <CalendarIcon />
                  Reservar cita
                </Button>
              )}
              {contact.phone && (
                <Button size="lg" variant={bookingUrl ? "outline" : "default"} href={telHref(contact.phone)}>
                  <PhoneIcon />
                  {contact.phone}
                </Button>
              )}
            </div>
            {showTeam && (
              <p className="se-hero-team">
                <AvatarStack team={team} />
                <span>
                  <strong>{team.length === 1 ? "1 fisioterapeuta" : `${team.length} fisioterapeutas`}</strong> te
                  esperan
                </span>
              </p>
            )}
          </div>

          <div className="se-hero-visual">
            <div className={`se-hero-frame${cover ? "" : " se-hero-frame-art"}`}>
              {cover ? <img src={cover} alt="" /> : <Spine />}
            </div>
            <Sticker text={sticker} href={bookingUrl ? link(bookingUrl) : undefined}>
              {bookingUrl ? <CalendarIcon /> : initials(clinic.name)}
            </Sticker>
            {status && (
              <div className="se-float se-float-status">
                <span className="se-float-icon">
                  <ClockIcon />
                </span>
                <span>
                  <small>Horario de hoy</small>
                  <Status status={status} />
                </span>
              </div>
            )}
            {bookingUrl && (
              <a href={link(bookingUrl)} className="se-float se-float-book">
                <span className="se-float-icon se-float-icon-solid">
                  <CalendarIcon />
                </span>
                <span>
                  <small>Cita online</small>
                  <strong>Elige día y hora</strong>
                </span>
              </a>
            )}
          </div>
        </div>
      </section>

      <TrustBar props={props} />

      {showServices && <Marquee items={services.map((s) => s.name)} />}

      {showServices && (
        <section className="se-section" id="servicios">
          <div className="kf-wrap">
            <SectionHead
              index={next()}
              eyebrow="Tratamientos"
              title={<Emphasis text="¿En qué te podemos ayudar?" />}
              lead="Sesiones personalizadas, con la duración y el precio claros desde el principio."
              action={services.length > HOME_SERVICES ? <MoreLink href={link("/servicios")}>Ver todos</MoreLink> : undefined}
            />
            <div className="se-service-grid">
              {services.slice(0, HOME_SERVICES).map((s, i) => (
                <ServiceCard key={s.name} service={s} props={props} index={i} />
              ))}
            </div>
          </div>
        </section>
      )}

      <FirstVisit props={props} index={next()} />

      {(showAbout || highlights.length > 0) && (
        <section className="se-section" id="nosotros">
          <div className={`kf-wrap ${showAbout && highlights.length ? "se-about" : "kf-narrow"}`}>
            {showAbout && (
              <div className="se-about-text">
                <Eyebrow index={next()}>Sobre nosotros</Eyebrow>
                <h2>{about?.title || "Quiénes somos"}</h2>
                {aboutParas.slice(0, 2).map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
                <MoreLink href={link("/nosotros")}>Conoce el centro</MoreLink>
              </div>
            )}
            {showAbout && !highlights.length && <QuoteCard props={props} />}
            {highlights.length > 0 && (
              <div className="se-about-side">
                {showAbout ? (
                  <QuoteCard props={props} />
                ) : (
                  <SectionHead index={next()} eyebrow="Por qué elegirnos" title="Lo que nos hace diferentes" />
                )}
                <Highlights items={highlights} />
              </div>
            )}
          </div>
        </section>
      )}

      {showTeam && (
        <section className="se-section se-tint" id="equipo">
          <div className="kf-wrap">
            <SectionHead
              index={next()}
              eyebrow="Equipo"
              title={<Emphasis text="Quién te va a tratar" />}
              lead="Fisioterapeutas colegiados que se toman el tiempo de escucharte."
              action={<MoreLink href={link("/equipo")}>Conoce al equipo</MoreLink>}
            />
            <div className="se-team-grid">
              {team.slice(0, HOME_TEAM).map((m) => (
                <TeamCard key={m.name} member={m} />
              ))}
            </div>
          </div>
        </section>
      )}

      {sections.gallery && gallery.length > 0 && (
        <section className="se-section">
          <div className="kf-wrap">
            <SectionHead index={next()} eyebrow="Instalaciones" title="Un espacio pensado para tu recuperación" />
            <Gallery images={gallery} />
          </div>
        </section>
      )}

      {sections.faq && faq.length > 0 && (
        <section className="se-section se-tight" id="preguntas">
          <div className="kf-wrap">
            <Faq props={props} index={next()} />
          </div>
        </section>
      )}

      <CtaBand props={props} />

      <section className="se-section" id="contacto">
        <div className="kf-wrap">
          <SectionHead index={next()} eyebrow="Contacto" title={<Emphasis text="Ven a vernos" />} />
          <Location props={props} />
        </div>
      </section>
    </>
  );
}
