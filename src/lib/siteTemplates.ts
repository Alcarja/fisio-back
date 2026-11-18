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
    description:
      "Moderna y atrevida: titulares enormes, bloques de color y mucha personalidad. Para clínicas que quieren destacar.",
    public: true,
  },
  {
    key: "serena",
    label: "Serena",
    description:
      "Limpia y cercana, con horario en directo, tu equipo en primer plano y una columna dibujada en tu color. Encaja con casi cualquier clínica.",
    public: true,
  },
  {
    key: "vital",
    label: "Vital",
    description:
      "Enérgica y atrevida, con titulares grandes y fondo oscuro. Pensada para fisioterapia deportiva.",
    public: true,
  },
  {
    key: "pulso",
    label: "Pulso",
    description:
      "Limpia y segura, estilo agencia: titulares enormes en dos tonos, filas numeradas y un toque de color neón.",
    // Private until it's offered to everyone: only clinics with customTemplate = "pulso"
    public: true,
  },
];

export const DEFAULT_TEMPLATE = "clara";

// The templates a clinic can choose: the public ones and its own custom design
export const templatesFor = (customTemplate: string | null) =>
  SITE_TEMPLATES.filter((t) => t.public || t.key === customTemplate);

export const isTemplateAllowed = (
  key: unknown,
  customTemplate: string | null,
) =>
  typeof key === "string" &&
  templatesFor(customTemplate).some((t) => t.key === key);
