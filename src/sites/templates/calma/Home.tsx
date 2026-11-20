import type { SitePageProps } from "../types.js";
import { About, Conditions, Contact, Faq, FirstVisit, Hero, Prices, Team, Treatments } from "./sections.js";

const HOME_SERVICES = 6;
const HOME_TEAM = 3;

// Calma's home page, in the design's order: hero, "¿Qué te ocurre?",
// treatments, the first visit (dark), team, then the tint block (the design
// has patient reviews there; we only show real content, so it's the clinic's
// own "about us" and highlights), prices, questions and contact
export default function Home({ props }: { props: SitePageProps }) {
  const { content, services, team } = props;
  const { sections, faq } = content;
  const showServices = sections.services && services.length > 0;
  const showTeam = sections.team && team.length > 0;

  return (
    <>
      <Hero props={props} />
      <Conditions props={props} />
      {showServices && <Treatments props={props} limit={HOME_SERVICES} />}
      <FirstVisit props={props} />
      {showTeam && <Team props={props} limit={HOME_TEAM} />}
      <About props={props} />
      {showServices && <Prices props={props} />}
      {sections.faq && faq.length > 0 && <Faq props={props} />}
      <Contact props={props} />
    </>
  );
}
