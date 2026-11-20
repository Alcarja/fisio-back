import { HoursTable } from "../shared/blocks.js";
import type { SitePageProps } from "../types.js";
import { About, Faq, Gallery, Label, Method, PageHead, Prices, statusOf, Team, Treatments, Wrap } from "./sections.js";

// Zona's inner pages: a title with a mono breadcrumb, then the home page's
// sections at full length. The closing block (Layout) ends every page

type Page = { props: SitePageProps };

const hasFaq = ({ content }: SitePageProps) => content.sections.faq && content.faq.length > 0;

export function Servicios({ props }: Page) {
  return (
    <>
      <PageHead props={props} crumb="Servicios" title="Tratamientos y tarifas." lead="Todo lo que hacemos, lo que dura y lo que cuesta. Si no sabes cuál es el tuyo, empieza por una valoración y te orientamos." />
      <Treatments props={props} n={1} />
      <Prices props={props} n={2} />
      <Method n={3} />
      {hasFaq(props) && <Faq props={props} n={4} />}
    </>
  );
}

export function Equipo({ props }: Page) {
  const { clinic } = props;
  return (
    <>
      <PageHead props={props} crumb="Equipo" title="Quién te va a tratar." lead={`Fisioterapeutas colegiados, cada uno con su especialidad. Así es el equipo de ${clinic.name}.`} />
      <Team props={props} full />
      <Method n={1} />
    </>
  );
}

export function Nosotros({ props }: Page) {
  const { content, img, clinic } = props;
  const gallery = content.sections.gallery ? content.galleryIds.map((id) => img(id)).filter((u): u is string => !!u) : [];
  return (
    <>
      <PageHead props={props} crumb="Nosotros" title={`Esto es ${clinic.name}.`} lead={content.hero.subtitle} />
      <About props={props} n={1} full />
      {gallery.length > 0 && (
        <section aria-label="El centro" className="border-x-0 border-t border-b-0 border-solid border-(--zn-line)">
          <Wrap className="flex flex-col gap-10 py-[clamp(64px,8vw,112px)]">
            <div className="flex flex-col gap-4">
              <Label n={2}>El centro</Label>
              <h2 className="zn-x m-0 text-[clamp(36px,4vw,56px)] leading-[.95] tracking-[-.045em]">Instalaciones.</h2>
            </div>
            <Gallery images={gallery} />
          </Wrap>
        </section>
      )}
      <Method n={gallery.length > 0 ? 3 : 2} />
    </>
  );
}

export function Contacto({ props }: Page) {
  const { content, hours } = props;
  const city = content.contact.city;
  const showHours = content.sections.hours && hours.length > 0;
  const status = statusOf(props);
  return (
    <>
      <PageHead props={props} crumb="Contacto" title="Ven a vernos." lead={`Llámanos, escríbenos o pásate por la clínica${city ? ` en ${city}` : ""}. Todos los datos, abajo.`} />
      {showHours && (
        <section id="horario" className="bg-(--zn-tint)">
          <Wrap className="flex flex-wrap gap-x-16 gap-y-8 py-[clamp(64px,8vw,112px)]">
            <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-4">
              <Label n={1}>Horario</Label>
              <h2 className="zn-x m-0 text-[clamp(36px,4vw,56px)] leading-[.95] tracking-[-.045em]">Cuándo abrimos.</h2>
              {status && <p className="zn-mono m-0 text-[13px] text-(--zn-ink)">{status.label}</p>}
            </div>
            <div className="min-w-0 flex-[999_1_640px] border-x-0 border-t border-b-0 border-solid border-(--zn-ink)">
              <HoursTable hours={hours} />
            </div>
          </Wrap>
        </section>
      )}
      {hasFaq(props) && <Faq props={props} n={showHours ? 2 : 1} />}
    </>
  );
}
