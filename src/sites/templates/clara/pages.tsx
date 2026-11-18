import { Paragraphs } from "../shared/blocks.js";
import { firstSentence } from "../shared/format.js";
import { availablePages, type ContentPage } from "../shared/pages.js";
import type { SitePageProps, SiteService } from "../types.js";
import { Bento, Console, Marker, PageHead, Plus, ServiceBoard, ServicesSplit, Talk, TeamRail, TeamZigzag, Timeline } from "./sections.js";

// Clara's inner pages. Each has its own layout: the services board with a
// sticky index, zig-zag team rows, the story + bento, the big contact
// console. The call to action is in the footer, on every page

type Page = { props: SitePageProps };

// "02/04": this page's place among the pages the clinic has
function pageNumber(props: SitePageProps, page: ContentPage) {
  const pages = availablePages(props);
  const i = pages.indexOf(page);
  return i < 0 ? undefined : `${String(i + 1).padStart(2, "0")}/${String(pages.length).padStart(2, "0")}`;
}

export function Servicios({ props }: Page) {
  const { services, link } = props;
  const groups: [string, string, SiteService[]][] = [
    ["individual", "Sesiones individuales", services.filter((s) => !s.isGroup)],
    ["grupo", "Clases en grupo", services.filter((s) => s.isGroup)],
  ];
  const split = groups.every(([, , list]) => list.length > 0);
  return (
    <>
      <PageHead
        props={props}
        tag="Tratamientos"
        title="Tratamientos y precios"
        lead="Todo lo que hacemos, lo que dura y lo que cuesta. ¿No sabes cuál es el tuyo? Empieza por una valoración."
        number={pageNumber(props, "servicios")}
      />
      <section className="cl-section">
        <div className="kf-wrap">
          <ServicesSplit
            props={props}
            title={<Marker text="Elige el tuyo" />}
            aside={
              split ? (
                <nav className="cl-jump" aria-label="Tipos de sesión">
                  {groups.map(([id, label, list]) => (
                    <a key={id} href={props.link("/") === "#" ? "#" : `${link("/servicios")}#${id}`}>
                      {label}
                      <span>{list.length}</span>
                    </a>
                  ))}
                </nav>
              ) : undefined
            }
          >
            {split ? (
              groups.map(([id, label, list]) => (
                <div key={id} id={id} className="cl-group">
                  <h2 className="cl-group-title">{label}</h2>
                  <ServiceBoard services={list} props={props} full />
                </div>
              ))
            ) : (
              <ServiceBoard services={services} props={props} full />
            )}
          </ServicesSplit>
        </div>
      </section>
      <Timeline props={props} />
    </>
  );
}

export function Equipo({ props }: Page) {
  const { team, clinic } = props;
  return (
    <>
      <PageHead
        props={props}
        tag="Equipo"
        title="El equipo de fisioterapeutas"
        lead={`Colegiados, especializados y con ganas de verte mejorar. Así es el equipo de ${clinic.name}.`}
        number={pageNumber(props, "equipo")}
      />
      <section className="cl-section">
        <div className="kf-wrap">
          <TeamZigzag team={team} />
        </div>
      </section>
    </>
  );
}

export function Nosotros({ props }: Page) {
  const { content, clinic, team } = props;
  const { about, sections } = content;
  const showAbout = sections.about && !!about?.text;
  const quote = firstSentence(about?.text);
  const rest = (about?.text ?? "").trim().slice(quote.length).trim();
  return (
    <>
      <PageHead
        props={props}
        tag="Nosotros"
        title={about?.title || `Esto es ${clinic.name}`}
        lead={content.hero.subtitle}
        number={pageNumber(props, "nosotros")}
      />
      {showAbout && (
        <section className="cl-section">
          <div className="kf-wrap cl-story">
            <p className="cl-story-quote">
              <Plus />
              {quote}
            </p>
            {rest && (
              <div className="cl-prose">
                <Paragraphs text={rest} />
              </div>
            )}
          </div>
        </section>
      )}
      <Bento props={props} withQuote={false} />
      {sections.team && team.length > 0 && <TeamRail props={props} />}
    </>
  );
}

export function Contacto({ props }: Page) {
  const { content } = props;
  const city = content.contact.city;
  return (
    <>
      <PageHead
        props={props}
        tag="Contacto"
        title="Contacto y horario"
        lead={`Llama, escribe o ven${city ? ` a vernos en ${city}` : ""}. Atendemos con cita previa.`}
        number={pageNumber(props, "contacto")}
      />
      <section className="cl-section">
        <div className="kf-wrap">
          <Console props={props} big />
        </div>
      </section>
      {content.sections.faq && content.faq.length > 0 && <Talk props={props} faqOnly />}
    </>
  );
}
