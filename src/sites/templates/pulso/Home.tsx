import type { SitePageProps } from "../types.js";
import {
  ArrowLink,
  BigCta,
  FaqPanel,
  NameStrip,
  Panel,
  PillLink,
  ServicesPanel,
  SplitTitle,
  Statement,
  StatusLine,
  TeamSection,
  Wrap,
} from "./sections.js";

const HOME_SERVICES = 4;

// Pulso: a giant condensed headline with a circle in the clinic's colour, the
// live status and a few facts, the treatments strip, a dark panel with the
// treatments as project cards and the clinic's statement, the team as quote
// cards, the questions in a cream panel and a huge call to action
export default function Home({ props }: { props: SitePageProps }) {
  const { content, services, team, link, bookingUrl } = props;
  const { sections, hero, about, faq, contact, highlights } = content;
  const showServices = sections.services && services.length > 0;
  const showTeam = sections.team && team.length > 0;
  const showStatement = (sections.about && !!about?.text) || highlights.length > 0 || !!content.coverId;

  const facts = [
    showServices && { label: "Tratamientos", value: String(services.length) },
    showTeam && { label: "Equipo", value: team.length === 1 ? "1 fisio" : `${team.length} fisios` },
    contact.city && { label: "Dónde", value: contact.city },
  ].filter((f): f is { label: string; value: string } => !!f);

  return (
    <>
      <section className="relative overflow-hidden pt-10 md:pt-16">
        <Wrap className="relative">
          <span className="s8-grain s8-circle pointer-events-none absolute top-[-2.5rem] right-[-3.5rem] z-10 aspect-square w-[clamp(10rem,31vw,28rem)] rounded-full bg-primary mix-blend-multiply md:top-[4%] md:right-0" aria-hidden="true" />
          <h1 className="s8-display relative m-0 max-w-[12ch] text-[clamp(3.6rem,12.4vw,12.5rem)] leading-[.86] text-ink">
            <SplitTitle text={hero.title} />
          </h1>
          <div className="mt-12 border-t border-[#cfccc5] pt-4">
            <StatusLine props={props} />
          </div>
          <div className="grid gap-12 pt-10 pb-6 lg:grid-cols-[1fr_auto] lg:items-end">
            {facts.length > 0 && (
              <dl className="m-0 flex flex-wrap gap-x-16 gap-y-6">
                {facts.map((f) => (
                  <div key={f.label} className="flex flex-col-reverse gap-2">
                    <dd className="s8-serif m-0 text-[clamp(1.6rem,2.4vw,2.1rem)] leading-none text-ink">{f.value}</dd>
                    <dt className="text-[.72rem] tracking-[.1em] text-[#6b6964] uppercase">{f.label}</dt>
                  </div>
                ))}
              </dl>
            )}
            <div className="max-w-[30rem]">
              {hero.subtitle && <p className="m-0 text-[1.15rem] leading-relaxed text-ink">{hero.subtitle}</p>}
              <div className="mt-6 flex flex-wrap items-center gap-6">
                {bookingUrl && <PillLink href={link(bookingUrl)}>Reserva tu cita</PillLink>}
                {showServices && <ArrowLink href={link("/servicios")}>Nuestros tratamientos</ArrowLink>}
              </div>
            </div>
          </div>
        </Wrap>
        {showServices && <NameStrip names={services.map((s) => s.name)} />}
      </section>

      {(showServices || showStatement) && (
        <Panel tone="dark" id="servicios">
          {showServices && <ServicesPanel props={props} services={services.slice(0, HOME_SERVICES)} more />}
          {showServices && showStatement && <div className="mx-5 my-20 border-t border-white/12 md:mx-[3.75rem] md:my-28" />}
          {showStatement && (
            <div id="nosotros">
              <Statement props={props} more />
            </div>
          )}
        </Panel>
      )}

      {showTeam && <TeamSection props={props} max={3} />}

      {sections.faq && faq.length > 0 && <FaqPanel props={props} />}

      <BigCta props={props} />
    </>
  );
}
