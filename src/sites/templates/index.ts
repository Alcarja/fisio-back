import ClaraHome from "./clara/Home.js";
import ClaraLayout from "./clara/Layout.js";
import claraCss from "./clara/style.js";
import type { SiteTemplateModule } from "./types.js";

// Template key (lib/siteTemplates.ts) → its design. A key without a design
// yet (e.g. "serena", Phase 5) falls back to Clara, so a clinic that picks it
// still gets a working site
const clara: SiteTemplateModule = { Layout: ClaraLayout, Home: ClaraHome, css: claraCss };

const TEMPLATES: Record<string, SiteTemplateModule> = {
  clara,
};

export const getTemplate = (key: string): SiteTemplateModule => TEMPLATES[key] ?? clara;
