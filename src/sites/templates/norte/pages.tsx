import { formatPrice } from "../shared/format.js";
import type { SitePageProps, SiteService } from "../types.js";
import { About, ContactCard, Cta, FactTile, Faq, Gallery, Head, PageHead, Panel, Process, ServiceGrid, statusOf, TeamGrid, todayHours, Wrap } from "./sections.js";

// Norte's inner pages: a title panel with a breadcrumb and a few key numbers
// beside it, then the home page's panels at full length

type Page = { props: SitePageProps };

const hasFaq = ({ content }: SitePageProps) => content.sections.faq && content.faq.length > 0;

export function Servicios({ props }: Page) {
  const { services } = props;
  const groups: [string, string, SiteService[]][] = [
    ["Sesiones individuales", "Uno a uno con tu fisioterapeuta.", services.filter((s) => !s.isGroup)],
    ["Clases en grupo", "Grupos reducidos y siempre guiados.", services.filter((s) => s.isGroup)],
  ];
  const split = groups.every(([, , list]) => list.length > 0);
  const from = Math.min(...services.map((s) => s.priceCents));
  return (
    <Wrap className="grid gap-3 pb-3 md:gap-4 md:pb-4">
      <PageHead
        props={props}
        crumb="Tratamientos"
        title="Tratamientos y precios"
        lead="Todo lo que hacemos, lo que dura y lo que cuesta. Si no sabes cuál es el tuyo, empieza por una valoración y te orientamos."
        aside={
          <>
            <FactTile value={String(services.length)} label={services.length === 1 ? "tratamiento" : "tratamientos"} />
            <FactTile value={formatPrice(from)} label="precio desde" brand />
          </>
        }
      />
      {(split ? groups : [["Todos los tratamientos", "", services] as [string, string, SiteService[]]]).map(([title, intro, list], i) => (
        <Panel key={title} className="p-7 md:p-12">
          <Head title={title} intro={intro || undefined} />
          <ServiceGrid services={list} props={props} help={i === 0} />
        </Panel>
      ))}
      <Process props={props} />
      {hasFaq(props) && <Faq props={props} />}
      <Cta props={props} />
    </Wrap>
  );
}

export function Equipo({ props }: Page) {
  const { team, clinic } = props;
  const licensed = team.filter((m) => m.licenseNumber).length;
  return (
    <Wrap className="grid gap-3 pb-3 md:gap-4 md:pb-4">
      <PageHead
        props={props}
        crumb="Equipo"
        title="Nuestro equipo"
        lead={`Profesionales colegiados, cada uno con su especialidad. Así es el equipo de ${clinic.name}.`}
        aside={
          <>
            <FactTile value={String(team.length)} label={team.length === 1 ? "fisioterapeuta" : "fisioterapeutas"} brand />
            {licensed > 0 && <FactTile value={licensed === team.length ? "100 %" : String(licensed)} label="colegiados" />}
          </>
        }
      />
      <Panel className="p-3 md:p-4">
        <TeamGrid team={team} full />
      </Panel>
      <Cta props={props} />
    </Wrap>
  );
}

export function Nosotros({ props }: Page) {
  const { content, img, clinic } = props;
  const gallery = content.sections.gallery ? content.galleryIds.map((id) => img(id)).filter((u): u is string => !!u) : [];
  return (
    <Wrap className="grid gap-3 pb-3 md:gap-4 md:pb-4">
      <PageHead props={props} crumb="Nosotros" title={`Esto es ${clinic.name}`} lead={content.hero.subtitle} />
      <About props={props} full />
      {gallery.length > 0 && (
        <Panel className="p-7 md:p-12" label="El centro">
          <Head eyebrow="El centro" title="Instalaciones" />
          <Gallery images={gallery} />
        </Panel>
      )}
      <Process props={props} />
      <Cta props={props} />
    </Wrap>
  );
}

export function Contacto({ props }: Page) {
  const { content, hours } = props;
  const city = content.contact.city;
  const status = statusOf(props);
  return (
    <Wrap className="grid gap-3 pb-3 md:gap-4 md:pb-4">
      <PageHead
        props={props}
        crumb="Contacto"
        title="Contacto y horario"
        lead={`Llámanos, escríbenos o ven a vernos${city ? ` en ${city}` : ""}. Te atendemos con cita previa.`}
        aside={status && <FactTile value={status.open ? "Abierto" : "Cerrado"} label={`Hoy: ${todayHours(hours)}`} brand />}
      />
      <div className="grid gap-3 md:gap-4 lg:grid-cols-12">
        <ContactCard props={props} className={hasFaq(props) ? "lg:col-span-5" : "lg:col-span-12"} />
        {hasFaq(props) && <Faq props={props} className="lg:col-span-7" />}
      </div>
      <Cta props={props} />
    </Wrap>
  );
}
