import { Fragment, type ReactNode } from "react";
import type { SitePageProps } from "../types.js";
import { About, Faq, Hero, homeSections, Method, Prices, Team, Ticker, Treatments, type HomeSection } from "./sections.js";

const HOME_SERVICES = 6;
const HOME_TEAM = 3;

// Zona's home page, in the design's order: "¿Dónde te duele?" with the zone
// selector, the conditions ticker, then the numbered sections (treatments,
// method, questions, team, about us, prices). The closing (booking, contact,
// legal) comes from Layout. Numbers follow what's shown: a hidden section
// doesn't leave a gap
export default function Home({ props }: { props: SitePageProps }) {
  const sections = homeSections(props);
  const n = (s: HomeSection) => sections.indexOf(s) + 1;
  const render: Record<HomeSection, () => ReactNode> = {
    treatments: () => <Treatments props={props} n={n("treatments")} limit={HOME_SERVICES} />,
    method: () => <Method n={n("method")} />,
    faq: () => <Faq props={props} n={n("faq")} />,
    team: () => <Team props={props} n={n("team")} limit={HOME_TEAM} />,
    about: () => <About props={props} n={n("about")} />,
    prices: () => <Prices props={props} n={n("prices")} />,
  };
  return (
    <>
      <Hero props={props} />
      <Ticker />
      {sections.map((s) => (
        <Fragment key={s}>{render[s]()}</Fragment>
      ))}
    </>
  );
}
