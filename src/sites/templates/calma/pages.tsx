import type { SitePageProps } from "../types.js";
import { About, Contact, Faq, FirstVisit, Gallery, PageHead, Prices, Team, Treatments, Wrap } from "./sections.js";

// Calma's inner pages: a title with a breadcrumb, then the home page's
// sections at full length

type Page = { props: SitePageProps };

const hasFaq = ({ content }: SitePageProps) => content.sections.faq && content.faq.length > 0;

export function Servicios({ props }: Page) {
  return (
    <>
      <PageHead props={props} crumb="Tratamientos" title="Tratamientos y tarifas." lead="Todo lo que hacemos, lo que dura y lo que cuesta. Si no sabes cuál es el tuyo, pide una valoración inicial y te orientamos." />
      <Treatments props={props} full />
      <FirstVisit props={props} />
      <Prices props={props} />
      {hasFaq(props) && <Faq props={props} />}
    </>
  );
}

export function Equipo({ props }: Page) {
  const { clinic } = props;
  return (
    <>
      <PageHead props={props} crumb="Equipo" title="Fisioterapeutas colegiados, especializados por áreas." lead={`Así es el equipo de ${clinic.name}.`} />
      <Team props={props} full />
      <FirstVisit props={props} />
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
        <section aria-label="La clínica">
          <Wrap className="flex flex-col gap-10 py-[clamp(72px,9vw,128px)]">
            <div className="flex flex-col gap-3.5">
              <p className="m-0 text-[15px] font-semibold text-(--cl-primary)">La clínica</p>
              <h2 className="cl-x m-0 text-[clamp(34px,3.8vw,52px)] leading-[1.08] tracking-[-.03em]">Instalaciones.</h2>
            </div>
            <Gallery images={gallery} />
          </Wrap>
        </section>
      )}
      <FirstVisit props={props} />
    </>
  );
}

export function Contacto({ props }: Page) {
  const { content } = props;
  const city = content.contact.city;
  return (
    <>
      <PageHead props={props} crumb="Contacto" title="Pide tu cita." lead={`Llámanos, escríbenos o ven a vernos${city ? ` en ${city}` : ""}. Te atendemos con cita previa.`} />
      <Contact props={props} withHeader={false} />
      {hasFaq(props) && <Faq props={props} />}
    </>
  );
}
