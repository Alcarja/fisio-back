import ClaraHome from "./clara/Home.js";
import ClaraLayout from "./clara/Layout.js";
import * as claraPages from "./clara/pages.js";
import claraCss from "./clara/style.js";
import SerenaHome from "./serena/Home.js";
import SerenaLayout from "./serena/Layout.js";
import * as serenaPages from "./serena/pages.js";
import serenaCss from "./serena/style.js";
import PulsoHome from "./pulso/Home.js";
import PulsoLayout from "./pulso/Layout.js";
import * as pulsoPages from "./pulso/pages.js";
import pulsoCss from "./pulso/style.js";
import type { SiteTemplateModule } from "./types.js";
import VitalHome from "./vital/Home.js";
import VitalLayout from "./vital/Layout.js";
import * as vitalPages from "./vital/pages.js";
import vitalCss from "./vital/style.js";
import NorteHome from "./norte/Home.js";
import NorteLayout from "./norte/Layout.js";
import * as nortePages from "./norte/pages.js";
import norteCss from "./norte/style.js";
import ZenHome from "./zen/Home.js";
import ZenLayout from "./zen/Layout.js";
import * as zenPages from "./zen/pages.js";
import zenCss from "./zen/style.js";

// Template key (lib/siteTemplates.ts) → its design. A key without a design
// falls back to Clara, so a clinic always gets a working site.
// To add one: a folder with Layout.tsx, Home.tsx, pages.tsx (one component
// per content page, shared/pages.ts) and style.ts, an entry here and in
// lib/siteTemplates.ts, and front/public/site-templates/<key>.webp
const pagesOf = (p: typeof claraPages): SiteTemplateModule["pages"] => ({
  servicios: p.Servicios,
  equipo: p.Equipo,
  nosotros: p.Nosotros,
  contacto: p.Contacto,
});

const clara: SiteTemplateModule = { Layout: ClaraLayout, Home: ClaraHome, pages: pagesOf(claraPages), css: claraCss };

const TEMPLATES: Record<string, SiteTemplateModule> = {
  clara,
  serena: { Layout: SerenaLayout, Home: SerenaHome, pages: pagesOf(serenaPages), css: serenaCss },
  vital: { Layout: VitalLayout, Home: VitalHome, pages: pagesOf(vitalPages), css: vitalCss },
  pulso: { Layout: PulsoLayout, Home: PulsoHome, pages: pagesOf(pulsoPages), css: pulsoCss },
  norte: { Layout: NorteLayout, Home: NorteHome, pages: pagesOf(nortePages), css: norteCss },
  zen: { Layout: ZenLayout, Home: ZenHome, pages: pagesOf(zenPages), css: zenCss },
};

export const getTemplate = (key: string): SiteTemplateModule => TEMPLATES[key] ?? clara;
