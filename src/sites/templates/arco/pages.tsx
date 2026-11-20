import { HoursTable } from "../shared/blocks.js";
import type { SitePageProps } from "../types.js";
import { About, Band, Contact, Faq, Gallery, Manifesto, Method, PageHead, Prices, Status, Team } from "./sections.js";

// Arco's inner pages: a title band with a breadcrumb, then the home page's
// sections at full length and the manifesto band as the closing call

type Page = { props: SitePageProps };

const hasFaq = ({ content }: SitePageProps) => content.sections.faq && content.faq.length > 0;

export function Servicios({ props }: Page) {
  const { services } = props;
  const single = services.filter((s) => !s.isGroup);
  const group = services.filter((s) => s.isGroup);
  const split = single.length > 0 && group.length > 0;
  return (
    <>
      <PageHead
        props={props}
        crumb="Tratamientos"
        title="Tratamientos y tarifas."
        lead="Todo lo que hacemos, lo que dura y lo que cuesta. Si no sabes cuál es el tuyo, empieza por una valoración y te orientamos."
      />
      {split ? (
        <>
          <Prices props={props} list={single} id="individual" tone="page" eyebrow="Sesiones individuales" title="Uno a uno, con tu fisioterapeuta." lead="Un fisioterapeuta, un paciente y todo el tiempo de la sesión para ti." />
          <Prices props={props} list={group} id="grupos" eyebrow="Grupos reducidos" title="Ejercicio terapéutico en grupo." lead="Clases guiadas por fisioterapeutas, con plazas limitadas." />
        </>
      ) : (
        <Prices props={props} list={services} id="todos" tone="page" eyebrow="Tarifas" title="Precios claros, sin sorpresas." />
      )}
      <Method />
      {hasFaq(props) && <Faq props={props} tone="page" />}
      <Manifesto props={props} />
    </>
  );
}

export function Equipo({ props }: Page) {
  const { clinic } = props;
  return (
    <>
      <PageHead props={props} crumb="Equipo" title="Siempre la misma persona." lead={`Fisioterapeutas colegiados, cada uno con su especialidad. Así es el equipo de ${clinic.name}.`} />
      <Team props={props} full />
      <Manifesto props={props} />
    </>
  );
}

export function Nosotros({ props }: Page) {
  const { content, img, clinic } = props;
  const gallery = content.sections.gallery ? content.galleryIds.map((id) => img(id)).filter((u): u is string => !!u) : [];
  return (
    <>
      <PageHead props={props} crumb="Nosotros" title={`Esto es ${clinic.name}.`} lead={content.hero.subtitle} />
      <About props={props} full />
      {gallery.length > 0 && (
        <Band tone="white" label="El centro">
          <div className="flex flex-col gap-3.5">
            <p className="ar-eyebrow">El centro</p>
            <h2 className="ar-display ar-h2 m-0 text-[clamp(34px,4.2vw,54px)]">Instalaciones.</h2>
          </div>
          <Gallery images={gallery} />
        </Band>
      )}
      <Method />
      <Manifesto props={props} />
    </>
  );
}

export function Contacto({ props }: Page) {
  const { content, hours } = props;
  const city = content.contact.city;
  const showHours = content.sections.hours && hours.length > 0;
  return (
    <>
      <PageHead props={props} crumb="Contacto" title="Ven a vernos." lead={`Llámanos, escríbenos o pásate por la clínica${city ? ` en ${city}` : ""}. Te atendemos con cita previa.`} />
      <Contact props={props} withHeader={false} />
      {showHours && (
        <Band tone="white" id="horario">
          <div className="flex flex-wrap items-start gap-x-14 gap-y-8">
            <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-3.5">
              <p className="ar-eyebrow">Horario</p>
              <h2 className="ar-display ar-h2 m-0 text-[clamp(34px,4.2vw,54px)]">Cuándo abrimos.</h2>
              <Status props={props} className="mt-2" />
            </div>
            <div className="min-w-0 flex-[2_1_420px] rounded-[28px] bg-(--ar-bg) px-8 py-4">
              <HoursTable hours={hours} />
            </div>
          </div>
        </Band>
      )}
      {hasFaq(props) && <Faq props={props} tone="page" />}
    </>
  );
}
