// The website templates (WEBS.md). Metadata only, no React, so both the API
// and the sites service can import it. The designs themselves live in
// src/sites/templates/<key>/ (Phase 3); preview images in
// front/public/site-templates/<key>.webp.
//
// To add one: add it here, build it in src/sites/templates/, add its preview.
// A custom design for one clinic: public: false, and the super-admin sets that
// clinic's customTemplate to its key.

export type SiteTemplate = {
  key: string;
  label: string;
  description: string;
  public: boolean;
};

export const SITE_TEMPLATES: readonly SiteTemplate[] = [
  {
    key: "clara",
    label: "Clara",
    description: "Luminosa y limpia, con mucho espacio en blanco.",
    public: true,
  },
  {
    key: "serena",
    label: "Serena",
    description: "Cálida, con fotos grandes y tonos suaves.",
    public: true,
  },
];

export const DEFAULT_TEMPLATE = "clara";

// The templates a clinic can choose: the public ones and its own custom design
export const templatesFor = (customTemplate: string | null) =>
  SITE_TEMPLATES.filter((t) => t.public || t.key === customTemplate);

export const isTemplateAllowed = (key: unknown, customTemplate: string | null) =>
  typeof key === "string" && templatesFor(customTemplate).some((t) => t.key === key);
