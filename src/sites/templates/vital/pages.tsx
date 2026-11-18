import type { SitePageProps } from "../types.js";
import { About, Contact, Cta, Faq, Gallery, PageHead, Points, Services, Team } from "./sections.js";

// Vital's inner pages: a dark title band, then the same bold sections as the
// home page

type Page = { props: SitePageProps };

export function Servicios({ props }: Page) {
  return (
    <>
      <PageHead props={props} kicker="Servicios" title="Servicios" lead="Todo lo que hacemos para que vuelvas a rendir." />
      <Services props={props} heading={false} />
      <Faq props={props} />
      <Cta props={props} />
    </>
  );
}

export function Equipo({ props }: Page) {
  return (
    <>
      <PageHead props={props} kicker="Equipo" title="Equipo" lead={`Los fisios de ${props.clinic.name}.`} />
      <Team props={props} heading={false} />
      <Cta props={props} />
    </>
  );
}

export function Nosotros({ props }: Page) {
  return (
    <>
      <PageHead props={props} kicker="Nosotros" title="Nosotros" lead={props.content.hero.subtitle} />
      <Points props={props} />
      <About props={props} />
      <Gallery props={props} />
      <Cta props={props} />
    </>
  );
}

export function Contacto({ props }: Page) {
  const city = props.content.contact.city;
  return (
    <>
      <PageHead props={props} kicker="Contacto" title="Contacto" lead={city ? `Te esperamos en ${city}.` : "Te esperamos."} />
      <Contact props={props} />
      <Faq props={props} />
      <Cta props={props} />
    </>
  );
}
