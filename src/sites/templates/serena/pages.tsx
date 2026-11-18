import { Paragraphs } from "../shared/blocks.js";
import type { SitePageProps, SiteService } from "../types.js";
import {
  CtaBand,
  Faq,
  FirstVisit,
  Gallery,
  Highlights,
  Location,
  MoreLink,
  PageHeader,
  SectionHead,
  ServiceCard,
  TeamCard,
} from "./sections.js";

// Serena's inner pages. Each opens with the same header (breadcrumb, title,
// the spine) and closes with the invitation to book

type Page = { props: SitePageProps };

export function Servicios({ props }: Page) {
  const { services, content } = props;
  // Individual sessions and group classes apart, when there are both
  const groups: [string, SiteService[]][] = [
    ["Sesiones individuales", services.filter((s) => !s.isGroup)],
    ["Clases en grupo", services.filter((s) => s.isGroup)],
  ];
  const split = groups.every(([, list]) => list.length > 0);
  return (
    <>
      <PageHeader
        props={props}
        crumb="Tratamientos"
        title="Tratamientos y tarifas"
        lead="Todo lo que hacemos, cuánto dura cada sesión y lo que cuesta. Si no sabes cuál elegir, empieza por una valoración y te orientamos."
      />
      <section className="se-section se-tight">
        <div className="kf-wrap">
          {(split ? groups : [["", services] as [string, SiteService[]]]).map(([title, list]) => (
            <div key={title} className="se-group">
              {title && <h2 className="se-group-title">{title}</h2>}
              <div className="se-service-grid">
                {list.map((s) => (
                  <ServiceCard key={s.name} service={s} props={props} full />
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
      <FirstVisit props={props} />
      {content.sections.faq && content.faq.length > 0 && (
        <section className="se-section se-tight">
          <div className="kf-wrap">
            <Faq props={props} />
          </div>
        </section>
      )}
      <CtaBand props={props} />
    </>
  );
}

export function Equipo({ props }: Page) {
  const { team, clinic } = props;
  return (
    <>
      <PageHeader
        props={props}
        crumb="Equipo"
        title="Nuestro equipo de fisioterapeutas"
        lead={`Profesionales sanitarios colegiados, cada uno con su especialidad. Este es el equipo de ${clinic.name}.`}
      />
      <section className="se-section se-tight">
        <div className="kf-wrap">
          <div className="se-team-grid">
            {team.map((m) => (
              <TeamCard key={m.name} member={m} full />
            ))}
          </div>
        </div>
      </section>
      <CtaBand props={props} />
    </>
  );
}

export function Nosotros({ props }: Page) {
  const { content, img, link, clinic, team } = props;
  const { about, highlights, sections } = content;
  const gallery = content.galleryIds.map((id) => img(id)).filter((u): u is string => !!u);
  const showAbout = sections.about && !!about?.text;
  const photo = img(content.coverId) ?? gallery[0];
  return (
    <>
      <PageHeader props={props} crumb="Nosotros" title={about?.title || `Conoce ${clinic.name}`} lead={content.hero.subtitle} />
      {showAbout && (
        <section className="se-section se-tight">
          <div className={`kf-wrap ${photo ? "se-story" : "kf-narrow"}`}>
            <div className="se-prose">
              <Paragraphs text={about?.text} />
            </div>
            {photo && (
              <div className="se-story-photo">
                <img src={photo} alt="" loading="lazy" />
              </div>
            )}
          </div>
        </section>
      )}
      {highlights.length > 0 && (
        <section className="se-section se-tint">
          <div className="kf-wrap">
            <SectionHead eyebrow="Por qué elegirnos" title="Lo que nos hace diferentes" />
            <Highlights items={highlights} />
          </div>
        </section>
      )}
      {sections.gallery && gallery.length > 0 && (
        <section className="se-section">
          <div className="kf-wrap">
            <SectionHead eyebrow="Instalaciones" title="Un espacio pensado para tu recuperación" />
            <Gallery images={gallery} />
          </div>
        </section>
      )}
      {sections.team && team.length > 0 && (
        <section className="se-section se-tight">
          <div className="kf-wrap">
            <SectionHead
              eyebrow="Equipo"
              title="Quién te va a tratar"
              action={<MoreLink href={link("/equipo")}>Conoce al equipo</MoreLink>}
            />
            <div className="se-team-grid">
              {team.slice(0, 3).map((m) => (
                <TeamCard key={m.name} member={m} />
              ))}
            </div>
          </div>
        </section>
      )}
      <CtaBand props={props} />
    </>
  );
}

export function Contacto({ props }: Page) {
  const { content } = props;
  const city = content.contact.city;
  return (
    <>
      <PageHeader
        props={props}
        crumb="Contacto"
        title="Contacto y horario"
        lead={`Llámanos, escríbenos o pásate por el centro${city ? ` en ${city}` : ""}. Te atendemos con cita previa.`}
      />
      <section className="se-section se-tight">
        <div className="kf-wrap">
          <Location props={props} />
        </div>
      </section>
      {content.sections.faq && content.faq.length > 0 && (
        <section className="se-section se-tight">
          <div className="kf-wrap">
            <Faq props={props} />
          </div>
        </section>
      )}
      <CtaBand props={props} />
    </>
  );
}
