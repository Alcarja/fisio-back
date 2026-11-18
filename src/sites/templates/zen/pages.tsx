import type { SitePageProps, SiteService } from "../types.js";
import { Closing, CoverDome, GalleryFlow, Interlude, Journey, PageHead, Philosophy, Principles, Questions, SectionHead, ServicesMenu, Team, Visit, Wrap } from "./sections.js";

// Zen's inner pages: a centred title with a drop falling into the content,
// then the home page's sections at full length

type Page = { props: SitePageProps };

const hasFaq = ({ content }: SitePageProps) => content.sections.faq && content.faq.length > 0;

export function Servicios({ props }: Page) {
  const { services } = props;
  const groups: [string, string, SiteService[]][] = [
    ["Sesiones", "Uno a uno, a tu ritmo", services.filter((s) => !s.isGroup)],
    ["En grupo", "Clases reducidas, siempre guiadas", services.filter((s) => s.isGroup)],
  ];
  const split = groups.every(([, , list]) => list.length > 0);
  return (
    <>
      <PageHead
        label="Tratamientos"
        title="Tratamientos y precios"
        lead="Todo lo que hacemos, lo que dura y lo que cuesta. Si no sabes cuál es el tuyo, empieza por una valoración y te orientamos."
      />
      <section className="zen-section pt-0">
        <Wrap>
          {split ? (
            groups.map(([label, title, list]) => (
              <div key={label} className="mb-28 last:mb-0 md:mb-40">
                <SectionHead label={label} title={title} />
                <ServicesMenu props={props} services={list} />
              </div>
            ))
          ) : (
            <ServicesMenu props={props} services={services} />
          )}
        </Wrap>
      </section>
      <Journey />
      {hasFaq(props) && <Questions props={props} />}
      <Closing props={props} />
    </>
  );
}

export function Equipo({ props }: Page) {
  const { clinic, team } = props;
  return (
    <>
      <PageHead
        label="Equipo"
        title={team.length === 1 ? "Quién te va a cuidar" : "Las personas detrás de cada sesión"}
        lead={`Profesionales colegiados que se toman su tiempo contigo. Así es el equipo de ${clinic.name}.`}
      />
      <section className="zen-section pt-0">
        <Wrap>
          <Team props={props} full />
        </Wrap>
      </section>
      <Interlude>
        Siempre la misma persona, <em className="zen-em">de principio a fin.</em>
      </Interlude>
      <Principles props={props} className="pt-28 md:pt-44" />
      <Closing props={props} />
    </>
  );
}

export function Nosotros({ props }: Page) {
  const { content, img, clinic } = props;
  const gallery = content.sections.gallery ? content.galleryIds.map((id) => img(id)).filter((u): u is string => !!u) : [];
  return (
    <>
      <PageHead
        label="Nosotros"
        title={
          <>
            Esto es <em className="zen-em">{clinic.name}</em>
          </>
        }
        lead={content.hero.subtitle}
      />
      <CoverDome props={props} />
      <Philosophy props={props} />
      <Principles props={props} />
      {gallery.length > 0 && (
        <section className="zen-section pt-0" aria-label="El centro">
          <Wrap>
            <SectionHead label="El centro" title="Un lugar para bajar el ritmo" />
            <GalleryFlow images={gallery} />
          </Wrap>
        </section>
      )}
      <Closing props={props} />
    </>
  );
}

export function Contacto({ props }: Page) {
  const city = props.content.contact.city;
  return (
    <>
      <PageHead label="Contacto" title="Contacto y horario" lead={`Llámanos, escríbenos o ven a vernos${city ? ` en ${city}` : ""}. Te atendemos con cita previa.`} />
      <div className="[&>section]:pt-0">
        <Visit props={props} numbered={false} />
      </div>
      {hasFaq(props) && <Questions props={props} />}
      <Closing props={props} />
    </>
  );
}
