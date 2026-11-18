import type { SitePageProps, SiteService } from "../types.js";
import { BigCta, ContactPanel, FaqPanel, Gallery, PageHead, Panel, SerifTitle, ServiceCards, Statement, TeamSection, Wrap } from "./sections.js";

// Pulso's inner pages: the giant condensed title, then the same panels as the
// home page at full length

type Page = { props: SitePageProps };

export function Servicios({ props }: Page) {
  const { services, content } = props;
  const groups: [string, SiteService[]][] = [
    ["Sesiones individuales", services.filter((s) => !s.isGroup)],
    ["Clases en grupo", services.filter((s) => s.isGroup)],
  ];
  const split = groups.every(([, list]) => list.length > 0);
  return (
    <>
      <PageHead
        props={props}
        tag="Tratamientos"
        title="Tratamientos y precios"
        lead="Todo lo que hacemos, lo que dura y lo que cuesta. Si no sabes cuál es el tuyo, empieza por una valoración y te orientamos."
      />
      <Panel tone="dark">
        <Wrap className="px-5 md:px-[3.75rem]">
          {(split ? groups : [["", services] as [string, SiteService[]]]).map(([title, list]) => (
            <div key={title} className="mb-24 last:mb-0">
              {title && <SerifTitle className="mb-12 text-center text-[clamp(2.2rem,4.6vw,4rem)]">{title}</SerifTitle>}
              <ServiceCards services={list} props={props} full />
            </div>
          ))}
        </Wrap>
      </Panel>
      {content.sections.faq && content.faq.length > 0 && (
        <div className="mt-6">
          <FaqPanel props={props} />
        </div>
      )}
      <BigCta props={props} />
    </>
  );
}

export function Equipo({ props }: Page) {
  const { clinic } = props;
  return (
    <>
      <PageHead
        props={props}
        tag="Equipo"
        title="Nuestro equipo"
        lead={`Profesionales colegiados, cada uno con su especialidad. Así es el equipo de ${clinic.name}.`}
      />
      <TeamSection props={props} full />
      <BigCta props={props} />
    </>
  );
}

export function Nosotros({ props }: Page) {
  const { content, img, clinic } = props;
  const gallery = content.sections.gallery ? content.galleryIds.map((id) => img(id)).filter((u): u is string => !!u) : [];
  return (
    <>
      <PageHead props={props} tag="Nosotros" title={`Esto es ${clinic.name}`} lead={content.hero.subtitle} />
      <Panel tone="dark">
        <Statement props={props} />
      </Panel>
      {gallery.length > 0 && (
        <section className="py-24 md:py-32">
          <Wrap className="md:px-[3.75rem]">
            <SerifTitle className="mb-12">El centro.</SerifTitle>
            <Gallery images={gallery} />
          </Wrap>
        </section>
      )}
      <BigCta props={props} />
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
        lead={`Llámanos, escríbenos o ven a vernos${city ? ` en ${city}` : ""}. Te atendemos con cita previa.`}
      />
      <ContactPanel props={props} />
      {content.sections.faq && content.faq.length > 0 && (
        <div className="mt-6">
          <FaqPanel props={props} />
        </div>
      )}
      <BigCta props={props} />
    </>
  );
}
