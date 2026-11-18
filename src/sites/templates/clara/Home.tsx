import { initials, telHref } from "../shared/format.js";
import { CalendarIcon, PhoneIcon, ShieldCheckIcon } from "../shared/icons.js";
import { ArrowUpRight, Avatar } from "../shared/ui.js";
import type { SitePageProps } from "../types.js";
import {
  Bento,
  counter,
  Marker,
  Plus,
  ServiceBoard,
  ServicesSplit,
  StatusPill,
  statusOf,
  Tag,
  Talk,
  TeamRail,
  Ticker,
  Timeline,
} from "./sections.js";

const HOME_SERVICES = 6;

// Clara: bold and modern, with its own structure. A giant headline over a
// grid of tiles (photo, intro, book, call), the treatments ticker, a split
// services board, the team rail, a dark timeline, the "Así somos" bento and
// "Hablemos" (FAQ + contact). The call to action lives in the footer.
// Every block is built from the clinic's data and hides itself when empty
export default function Home({ props }: { props: SitePageProps }) {
  const { clinic, content, services, team, img, link, bookingUrl } = props;
  const { sections, hero, highlights, about, galleryIds, contact } = content;
  const cover = img(content.coverId);
  const showServices = sections.services && services.length > 0;
  const showTeam = sections.team && team.length > 0;
  const status = statusOf(props);
  const licensed = showTeam && team.some((m) => m.licenseNumber);
  const next = counter();
  const showBento = (sections.about && !!about?.text) || highlights.length > 0 || (sections.gallery && galleryIds.length > 0);

  return (
    <>
      <section className="cl-hero">
        <div className="kf-wrap">
          <div className="cl-hero-top">
            <Tag>Fisioterapia{contact.city ? ` · ${contact.city}` : ""}</Tag>
            {status && <StatusPill status={status} />}
          </div>
          <h1 className="cl-hero-title">
            <Marker text={hero.title} />
          </h1>

          <div className="cl-hero-tiles">
            <div className={`cl-tile cl-tile-photo${cover ? "" : " cl-tile-art"}`}>
              {cover ? (
                <img src={cover} alt="" />
              ) : (
                <>
                  <Plus className="cl-art-plus cl-art-plus-a" />
                  <Plus className="cl-art-plus cl-art-plus-b" />
                  <Plus className="cl-art-plus cl-art-plus-c" />
                  <span className="cl-art-monogram">{initials(clinic.name)}</span>
                </>
              )}
              {licensed && (
                <span className="cl-sticker">
                  <ShieldCheckIcon />
                  Fisios colegiados
                </span>
              )}
            </div>

            <div className="cl-tile cl-tile-intro">
              {hero.subtitle && <p>{hero.subtitle}</p>}
              {showTeam && (
                <span className="cl-faces">
                  <span className="cl-faces-stack">
                    {team.slice(0, 4).map((m) => (
                      <Avatar key={m.name} src={m.photoUrl} alt="" fallback={initials(m.name)} size="sm" />
                    ))}
                  </span>
                  {team.length === 1 ? "1 fisioterapeuta" : `${team.length} fisioterapeutas`}
                </span>
              )}
            </div>

            {bookingUrl && (
              <a href={link(bookingUrl)} className="cl-tile cl-tile-book">
                <span className="cl-tile-icon">
                  <CalendarIcon />
                </span>
                <span className="cl-tile-big">Reserva online</span>
                <span className="cl-tile-small">Elige día y hora en un minuto</span>
                <span className="cl-tile-go" aria-hidden="true">
                  <ArrowUpRight />
                </span>
              </a>
            )}

            {contact.phone && (
              <a href={telHref(contact.phone)} className="cl-tile cl-tile-call">
                <span className="cl-tile-icon">
                  <PhoneIcon />
                </span>
                <span className="cl-tile-small">¿Prefieres llamar?</span>
                <span className="cl-tile-big">{contact.phone}</span>
              </a>
            )}
          </div>
        </div>
      </section>

      <Ticker items={showServices ? services.map((s) => s.name) : highlights.map((h) => h.title)} />

      {showServices && (
        <section className="cl-section" id="servicios">
          <div className="kf-wrap">
            <ServicesSplit props={props} index={next()} title={<Marker text="Lo que hacemos por ti" />} more>
              <ServiceBoard services={services.slice(0, HOME_SERVICES)} props={props} />
            </ServicesSplit>
          </div>
        </section>
      )}

      {showTeam && <TeamRail props={props} index={next()} />}

      <Timeline props={props} index={next()} />

      {showBento && <Bento props={props} index={next()} withText />}

      <Talk props={props} index={next()} />
    </>
  );
}
