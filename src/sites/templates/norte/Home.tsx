import { pageAvailable } from "../shared/pages.js";
import type { SitePageProps } from "../types.js";
import { About, ContactCard, Cta, Faq, Head, Hero, MoreLink, Panel, Process, ServiceGrid, TeamGrid, Wrap } from "./sections.js";

const HOME_SERVICES = 6;
const HOME_TEAM = 3;

// Norte's home page: a bento hero (headline + booking, photo, key numbers),
// then straight to treatments and prices, the clinic, how it works (dark),
// the team, questions next to contact, and a call to action
export default function Home({ props }: { props: SitePageProps }) {
  const { content, services, team, link } = props;
  const { sections, faq } = content;
  const showServices = sections.services && services.length > 0;
  const showTeam = sections.team && team.length > 0;
  const showFaq = sections.faq && faq.length > 0;

  return (
    <Wrap className="grid gap-3 pb-3 md:gap-4 md:pb-4">
      <Hero props={props} />

      {showServices && (
        <Panel className="p-7 md:p-12" id="servicios">
          <Head
            eyebrow="Tratamientos y precios"
            title="Qué tratamos y cuánto cuesta"
            intro="Precios claros por sesión, sin sorpresas. Elige el tuyo y reserva directamente."
            action={pageAvailable("servicios", props) && <MoreLink href={link("/servicios")}>{services.length > HOME_SERVICES ? `Ver los ${services.length}` : "Ver detalles"}</MoreLink>}
          />
          <ServiceGrid services={services.slice(0, HOME_SERVICES)} props={props} />
        </Panel>
      )}

      <About props={props} />

      <Process props={props} />

      {showTeam && (
        <Panel className="p-7 md:p-12" id="equipo">
          <Head
            eyebrow="Equipo"
            title="Profesionales colegiados"
            intro="Cada paciente tiene un fisioterapeuta de referencia que conoce su caso."
            action={team.length > HOME_TEAM && pageAvailable("equipo", props) && <MoreLink href={link("/equipo")}>Todo el equipo</MoreLink>}
          />
          <TeamGrid team={team.slice(0, HOME_TEAM)} />
        </Panel>
      )}

      <div className="grid gap-3 md:gap-4 lg:grid-cols-12">
        {showFaq && <Faq props={props} className="lg:col-span-7" />}
        <ContactCard props={props} className={showFaq ? "lg:col-span-5" : "lg:col-span-12"} />
      </div>

      <Cta props={props} />
    </Wrap>
  );
}
