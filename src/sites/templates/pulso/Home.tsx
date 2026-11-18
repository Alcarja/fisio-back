import { firstSentence, paragraphs, telHref } from "../shared/format.js";
import type { SitePageProps } from "../types.js";
import {
  AboutSection,
  Badges,
  counter,
  FaqDark,
  LineArt,
  Pill,
  ServicesSection,
  StackBars,
  TeamSection,
  TwoTone,
  VisitSection,
  Wrap,
} from "./sections.js";

const HOME_SERVICES = 6;

// Pulso: a huge two-tone headline over a line drawing, a full-bleed photo,
// a two-tone statement with badges, the questions in a dark section, the
// treatments as numbered rows, the team in grey, "nosotros" on a fresh
// gradient and the visit cards. Every block hides itself when it's empty
export default function Home({ props }: { props: SitePageProps }) {
  const { content, services, team, img, link, bookingUrl } = props;
  const { sections, hero, about, faq, contact, highlights } = content;
  const cover = img(content.coverId);
  const next = counter();
  const showServices = sections.services && services.length > 0;
  const showTeam = sections.team && team.length > 0;
  const showAbout = (sections.about && !!about?.text) || highlights.length > 0;

  // The statement: the first sentence dark, the next one grey
  const story = sections.about && about?.text ? paragraphs(about.text)[0]! : hero.subtitle ?? "";
  const strong = firstSentence(story);
  const soft = story.slice(strong.length).trim();

  return (
    <>
      <section className="relative overflow-hidden pt-16 md:pt-24">
        <Wrap>
          <h1 className="m-0 text-[clamp(2.7rem,8.6vw,8.2rem)] leading-[.98] font-semibold tracking-[-.035em]">
            <TwoTone text={hero.title} />
          </h1>
        </Wrap>
        <Wrap className="relative mt-12 grid items-end gap-10 pb-12 lg:mt-16 lg:grid-cols-[1.3fr_1fr]">
          <div>
            <p className="m-0 text-[clamp(1.5rem,3vw,2.6rem)] leading-[1.15] font-normal tracking-[.04em] text-ink uppercase">
              Fisioterapia{contact.city ? ` en ${contact.city}` : ""}.
            </p>
            <div className="mt-2 flex items-center gap-6">
              <StackBars />
              <p className="m-0 text-[clamp(1.5rem,3vw,2.6rem)] leading-[1.15] font-normal tracking-[.04em] text-ink uppercase">A tu ritmo.</p>
            </div>
            <div className="mt-10 flex flex-wrap gap-4">
              {bookingUrl && <Pill href={link(bookingUrl)}>Pide cita</Pill>}
              {contact.phone && (
                <Pill href={telHref(contact.phone)} tone={bookingUrl ? "outline" : "primary"}>
                  {contact.phone}
                </Pill>
              )}
            </div>
          </div>
          <LineArt className="w-full max-w-[40rem] justify-self-end" />
        </Wrap>
      </section>

      {cover ? (
        <div className="h-[clamp(16rem,38vw,34rem)] w-full overflow-hidden">
          <img src={cover} alt="" className="size-full object-cover" />
        </div>
      ) : (
        <div className="pu-band h-[clamp(10rem,22vw,18rem)] w-full" aria-hidden="true" />
      )}

      {story && (
        <section className="py-20 md:py-28">
          <Wrap className="grid items-center gap-12 lg:grid-cols-[1.4fr_1fr] lg:gap-24">
            <div>
              <p className="m-0 text-[clamp(1.4rem,2.4vw,2.05rem)] leading-[1.35] font-semibold text-ink">
                {strong} {soft && <span className="text-[#7a7a7a]">{soft}</span>}
              </p>
              {bookingUrl && (
                <div className="mt-10">
                  <Pill href={link(bookingUrl)}>Reserva tu cita</Pill>
                </div>
              )}
            </div>
            <div className="lg:justify-self-end">
              <Badges props={props} />
            </div>
          </Wrap>
        </section>
      )}

      {sections.faq && faq.length > 0 && <FaqDark props={props} index={next()} />}

      {showServices && <ServicesSection props={props} index={next()} services={services.slice(0, HOME_SERVICES)} more />}

      {showTeam && <TeamSection props={props} index={next()} />}

      {showAbout && <AboutSection props={props} index={next()} more />}

      <VisitSection props={props} index={next()} />
    </>
  );
}
