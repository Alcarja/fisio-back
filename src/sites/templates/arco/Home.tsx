import type { SitePageProps } from "../types.js";
import { About, Contact, Faq, Hero, Manifesto, Method, Prices, Team, Treatments } from "./sections.js";

const HOME_SERVICES = 6;
const HOME_PRICES = 3;
const HOME_TEAM = 3;

// Arco's home page, in the design's order: hero with the dial, the method
// (0° · 90° · 180°), treatments, the manifesto band, team and prices. Then
// what the design leaves out but every clinic can fill in: about us, questions
// and contact. Bands alternate sage and white; a hidden section just closes up
export default function Home({ props }: { props: SitePageProps }) {
  const { content, services, team } = props;
  const { sections, faq } = content;
  const showServices = sections.services && services.length > 0;
  const showTeam = sections.team && team.length > 0;

  return (
    <>
      <Hero props={props} />
      <Method />
      {showServices && <Treatments props={props} limit={HOME_SERVICES} />}
      <Manifesto props={props} />
      {showTeam && <Team props={props} limit={HOME_TEAM} />}
      {showServices && <Prices props={props} list={services.slice(0, HOME_PRICES)} more={services.length > HOME_PRICES} />}
      <About props={props} />
      {sections.faq && faq.length > 0 && <Faq props={props} />}
      <Contact props={props} />
    </>
  );
}
