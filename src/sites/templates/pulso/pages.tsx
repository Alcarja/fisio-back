import { ContactList } from "../shared/blocks.js";
import type { SitePageProps, SiteService } from "../types.js";
import {
  AboutSection,
  CornerBars,
  Eyebrow,
  FaqDark,
  GalleryGrid,
  PageHead,
  Rule,
  ServiceRows,
  StatusDot,
  statusOf,
  TeamCards,
  TextLink,
  Title,
  VisitSection,
  Wrap,
} from "./sections.js";
import { HoursTable } from "../shared/blocks.js";

// Pulso's inner pages: a two-tone header, then the same sections as the home
// page at full length

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
        lead="Todo lo que hacemos, lo que dura y lo que cuesta. Si no sabes cuál es el tuyo, empieza por una valoración."
      />
      <section className="pu-blob relative overflow-hidden py-20 md:py-28">
        <Wrap className="relative">
          {(split ? groups : [["", services] as [string, SiteService[]]]).map(([title, list]) => (
            <div key={title} className="mb-16 last:mb-0">
              {title && <Eyebrow>{title}</Eyebrow>}
              <ServiceRows services={list} props={props} full />
            </div>
          ))}
          <CornerBars />
        </Wrap>
      </section>
      {content.sections.faq && content.faq.length > 0 && <FaqDark props={props} />}
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
        title="Nuestro equipo de fisioterapeutas"
        lead={`Profesionales colegiados, cada uno con su especialidad. Así es el equipo de ${clinic.name}.`}
      />
      <section className="bg-(--pu-gray) py-20 md:py-28">
        <Wrap>
          <TeamCards team={team} />
          <CornerBars />
        </Wrap>
      </section>
    </>
  );
}

export function Nosotros({ props }: Page) {
  const { content, img, clinic } = props;
  const gallery = content.sections.gallery ? content.galleryIds.map((id) => img(id)).filter((u): u is string => !!u) : [];
  return (
    <>
      <PageHead props={props} tag="Nosotros" title={content.about?.title || `Esto es ${clinic.name}`} lead={content.hero.subtitle} />
      <AboutSection props={props} />
      {gallery.length > 0 && (
        <section className="bg-(--pu-gray) py-20 md:py-28">
          <Wrap>
            <Eyebrow>El centro</Eyebrow>
            <Title>Un espacio pensado para tu recuperación.</Title>
            <Rule />
            <div className="mt-12">
              <GalleryGrid images={gallery} />
            </div>
          </Wrap>
        </section>
      )}
    </>
  );
}

export function Contacto({ props }: Page) {
  const { content, hours } = props;
  const city = content.contact.city;
  const status = statusOf(props);
  return (
    <>
      <PageHead
        props={props}
        tag="Contacto"
        title="Contacto y horario"
        lead={`Llámanos, escríbenos o ven a vernos${city ? ` en ${city}` : ""}. Te atendemos con cita previa.`}
      />
      <section className="py-20 md:py-28">
        <Wrap className="grid gap-12 lg:grid-cols-2 lg:gap-20">
          <div>
            <Eyebrow>Contacto</Eyebrow>
            <div className="text-[1.1rem] [&_.kf-contact]:gap-4 [&_a]:text-ink [&_a]:no-underline [&_a:hover]:text-primary">
              <ContactList content={content} />
            </div>
            {content.contact.mapsUrl && (
              <div className="mt-8">
                <TextLink href={content.contact.mapsUrl}>Cómo llegar</TextLink>
              </div>
            )}
          </div>
          {content.sections.hours && hours.length > 0 && (
            <div className="rounded-2xl border border-[#dcdcd8] p-7">
              <Eyebrow>Horario</Eyebrow>
              {status && (
                <p className="m-0 mb-5 inline-flex items-center gap-2.5 font-medium text-ink">
                  <StatusDot open={status.open} />
                  {status.label}
                </p>
              )}
              <div className="[&_.kf-hours]:max-w-none">
                <HoursTable hours={hours} />
              </div>
            </div>
          )}
        </Wrap>
      </section>
      {content.sections.faq && content.faq.length > 0 && <FaqDark props={props} />}
      <VisitSection props={props} />
    </>
  );
}
