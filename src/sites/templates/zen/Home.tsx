import { telHref } from "../shared/format.js";
import { pageAvailable } from "../shared/pages.js";
import type { SitePageProps } from "../types.js";
import {
  Accent,
  BreathCue,
  Closing,
  CoverDome,
  Enso,
  Eyebrow,
  GalleryFlow,
  Interlude,
  Journey,
  Philosophy,
  Pill,
  Principles,
  Questions,
  SectionHead,
  ServicesMenu,
  Status,
  Team,
  TextLink,
  Visit,
  Wrap,
} from "./sections.js";

const HOME_SERVICES = 6;
const HOME_TEAM = 3;
const HOME_GALLERY = 6;

// Zen's home page reads top to bottom like one slow breath: a centred title
// inside a breathing ensō, the cover in a dome, who we are and what matters
// to us, the treatments as a menu, a pause, the first visit along a curve,
// the team in arches, the centre, questions, where to find us and a last
// invitation
export default function Home({ props }: { props: SitePageProps }) {
  const { clinic, content, services, team, link, bookingUrl, img } = props;
  const { sections, hero, faq, contact } = content;
  const showServices = sections.services && services.length > 0;
  const showTeam = sections.team && team.length > 0;
  const gallery = sections.gallery ? content.galleryIds.map((id) => img(id)).filter((u): u is string => !!u) : [];
  const where = contact.address ? `${contact.address}${contact.city ? `, ${contact.city}` : ""}` : contact.city;

  return (
    <>
      <section className="relative overflow-hidden">
        {(clinic.name || contact.city) && (
          <p className="absolute top-1/2 left-6 m-0 hidden origin-left -translate-y-1/2 -rotate-90 text-[.66rem] tracking-[.32em] whitespace-nowrap text-muted uppercase xl:block" aria-hidden="true">
            {clinic.name}
            {contact.city && !clinic.name.includes(contact.city) && ` — ${contact.city}`}
          </p>
        )}
        <Wrap className="relative flex min-h-[calc(100svh-4rem)] flex-col items-center justify-center pt-16 pb-20 text-center md:pt-20">
          <div className="zen-breathe pointer-events-none absolute top-[42%] left-1/2 w-[min(48rem,108vw)] md:top-[45%] -translate-x-1/2 -translate-y-1/2 text-(--zen-accent) opacity-30">
            <Enso draw />
          </div>
          <div className="zen-rise relative">
            <Eyebrow numbered={false} center>
              Fisioterapia{contact.city ? ` en ${contact.city}` : ""}
            </Eyebrow>
          </div>
          <h1 className="zen-h1 zen-rise zen-rise-2 relative mx-auto mt-10 mb-0 max-w-[15ch] text-[clamp(3.1rem,8.4vw,8.6rem)]">
            <Accent text={hero.title} />
          </h1>
          {hero.subtitle && <p className="zen-rise zen-rise-3 relative mx-auto mt-9 mb-0 max-w-[34rem] text-[1.12rem] leading-[1.8] text-muted">{hero.subtitle}</p>}
          <div className="zen-rise zen-rise-4 relative mt-12 flex flex-wrap items-center justify-center gap-x-10 gap-y-6">
            {bookingUrl ? <Pill href={link(bookingUrl)}>Reserva tu cita</Pill> : contact.phone && <Pill href={telHref(contact.phone)}>Llámanos</Pill>}
            {showServices && <TextLink href={pageAvailable("servicios", props) ? link("/servicios") : "#servicios"}>Ver tratamientos</TextLink>}
          </div>
        </Wrap>
        <Wrap>
          <div className="zen-rise zen-rise-4 grid gap-4 border-t border-(--zen-stone) py-6 text-[.86rem] text-muted md:grid-cols-3 md:items-center">
            <Status props={props} className="text-ink" />
            <BreathCue className="hidden justify-self-center md:inline-flex" />
            {where && <span className="md:justify-self-end">{where}</span>}
          </div>
        </Wrap>
      </section>

      <CoverDome props={props} />

      <Philosophy props={props} more />
      <Principles props={props} />

      {showServices && (
        <section className="zen-section pt-0" id="servicios">
          <Wrap>
            <SectionHead
              label="Tratamientos"
              title="Cuidamos cómo te mueves"
              intro="Cada sesión empieza escuchándote. Después, las manos, el ejercicio y el tiempo que haga falta."
            />
            <ServicesMenu props={props} services={services.slice(0, HOME_SERVICES)} />
            {pageAvailable("servicios", props) && (
              <div className="mt-12 flex justify-end">
                <TextLink href={link("/servicios")}>{services.length > HOME_SERVICES ? `Ver los ${services.length} tratamientos` : "Tratamientos y precios"}</TextLink>
              </div>
            )}
          </Wrap>
        </section>
      )}

      <Interlude>
        Escuchar primero. Tratar después. <em className="zen-em">Acompañarte siempre.</em>
      </Interlude>

      <Journey />

      {showTeam && (
        <section className="zen-section pt-0" id="equipo">
          <Wrap>
            <SectionHead
              label="Equipo"
              title="Las manos que te cuidan"
              intro={team.length === 1 ? "Una fisioterapeuta colegiada que te acompaña de principio a fin." : "Fisioterapeutas colegiados, cada uno con su especialidad, y siempre la misma persona contigo."}
            />
            <Team props={props} max={HOME_TEAM} />
            {team.length > HOME_TEAM && pageAvailable("equipo", props) && (
              <div className="mt-16 flex justify-center">
                <TextLink href={link("/equipo")}>Conoce a todo el equipo</TextLink>
              </div>
            )}
          </Wrap>
        </section>
      )}

      {gallery.length > 0 && (
        <section className="zen-section pt-0" aria-label="El centro">
          <Wrap>
            <SectionHead label="El centro" title="Un lugar para bajar el ritmo" />
            <GalleryFlow images={gallery.slice(0, HOME_GALLERY)} />
          </Wrap>
        </section>
      )}

      {sections.faq && faq.length > 0 && <Questions props={props} />}

      <Visit props={props} />

      <Closing props={props} />
    </>
  );
}
