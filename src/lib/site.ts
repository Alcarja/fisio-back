// The content of a clinic's website (WEBS.md 2.2): everything the clinic edits
// in Admin → Mi web, the same shape for every template, so a clinic can switch
// templates without losing anything. Stored in clinic_site.draft and
// clinic_site.published. Mirrored in front/src/adapters/api.ts (SiteContent).
//
// Security: every text is plain text (never HTML; the templates escape it and
// turn line breaks into paragraphs), colours are #rrggbb, URLs are http(s)
// only. This parser is the only way content gets in.
//
// No patient data here, ever: it's public and read by the sites service.

export const SITE_FONTS = ["moderna", "clasica", "redondeada"] as const;
export type SiteFont = (typeof SITE_FONTS)[number];

export const SITE_SECTIONS = ["services", "team", "about", "gallery", "faq", "hours"] as const;
export type SiteSection = (typeof SITE_SECTIONS)[number];

export type SiteContent = {
  theme: { primary: string; accent?: string; font: SiteFont };
  logoId?: string;
  coverId?: string;
  galleryIds: string[];
  hero: { title: string; subtitle?: string };
  about?: { title?: string; text: string };
  // "Por qué nosotros"
  highlights: { title: string; text?: string }[];
  faq: { q: string; a: string }[];
  contact: {
    phone?: string;
    whatsapp?: string;
    email?: string;
    address?: string;
    postalCode?: string;
    city?: string;
    mapsUrl?: string;
    instagram?: string;
    facebook?: string;
    linkedin?: string;
  };
  // Health centre registration ("Nº Registro Sanitario CS-12345"): required in
  // health advertising in most comunidades autónomas
  healthRegistry?: string;
  sections: Record<SiteSection, boolean>;
  seo: { title?: string; description?: string };
};

export const SITE_LIMITS = {
  heroTitle: 80,
  heroSubtitle: 200,
  aboutTitle: 80,
  aboutText: 2000,
  highlights: 6,
  highlightTitle: 80,
  highlightText: 300,
  faq: 12,
  faqQuestion: 200,
  faqAnswer: 1000,
  gallery: 8,
  address: 200,
  postalCode: 10,
  city: 80,
  url: 500,
  healthRegistry: 100,
  seoTitle: 70,
  seoDescription: 160,
};

const COLOR = /^#[0-9a-f]{6}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
// Same rule as the booking form's phone
const PHONE = /^[\d\s+().-]{6,30}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);

// Thrown inside the parser with the message for the clinic; caught at the top
class Invalid extends Error {}
const fail = (message: string): never => {
  throw new Invalid(message);
};

// Trimmed text up to `max` characters; "" or missing = undefined
function text(value: unknown, max: number, what: string): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") fail(`${what} no es válido`);
  const t = (value as string).trim();
  if (t.length > max) fail(`${what}: máximo ${max} caracteres`);
  return t || undefined;
}

// An http(s) URL, or a failure. Never javascript:, data: or anything else
function url(value: unknown, what: string, httpsOnly = false): string | undefined {
  const raw = text(value, SITE_LIMITS.url, what);
  if (!raw) return undefined;
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return fail(`${what}: no es un enlace válido (debe empezar por https://)`);
  }
  const allowed = httpsOnly ? ["https:"] : ["https:", "http:"];
  if (!allowed.includes(parsed.protocol)) fail(`${what}: el enlace debe empezar por https://`);
  return parsed.toString();
}

// A social profile: "@handle", "handle" or a URL of that network → its URL
function social(value: unknown, what: string, base: string, hosts: string[], handles: boolean) {
  const raw = text(value, SITE_LIMITS.url, what);
  if (!raw) return undefined;
  if (/^https?:\/\//i.test(raw)) {
    const link = url(raw, what)!;
    const host = new URL(link).hostname.replace(/^www\./, "");
    if (!hosts.includes(host)) fail(`${what}: el enlace debe ser de ${hosts[0]}`);
    return link;
  }
  const handle = raw.replace(/^@/, "");
  if (!handles || !/^[A-Za-z0-9._-]{1,60}$/.test(handle)) {
    fail(`${what}: pega el enlace a tu perfil (https://…)`);
  }
  return `${base}${handle}`;
}

function phone(value: unknown, what: string) {
  const t = text(value, 30, what);
  if (t && !PHONE.test(t)) fail(`${what}: solo números, espacios y los signos + ( ) . -`);
  return t;
}

function imageId(value: unknown, what: string) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string" || !UUID.test(value)) fail(`${what} no es válida`);
  return value as string;
}

function list<T>(value: unknown, max: number, what: string, item: (v: unknown) => T | undefined) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) fail(`${what} no es válido`);
  // Fully empty rows are dropped; the limit counts what's left
  const items = (value as unknown[]).map(item).filter((v): v is T => v !== undefined);
  if (items.length > max) fail(`${what}: máximo ${max}`);
  return items;
}

// Drops undefined fields, so the stored JSON only has what's filled in
function compact<T extends Obj>(o: T): T {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as T;
}

function parse(body: unknown): SiteContent {
  if (!isObj(body)) fail("El contenido de la web no es válido");
  const b = body as Obj;

  const theme = isObj(b.theme) ? b.theme : fail("Elige los colores y la letra de tu web");
  const color = (v: unknown, what: string) => {
    if (v === undefined || v === null || v === "") return undefined;
    const c = typeof v === "string" ? v.trim().toLowerCase() : "";
    if (!COLOR.test(c)) fail(`${what} debe tener el formato #rrggbb`);
    return c;
  };
  const primary = color(theme.primary, "El color principal") ?? fail("Elige el color principal");
  const font = SITE_FONTS.includes(theme.font as SiteFont)
    ? (theme.font as SiteFont)
    : fail("Elige el estilo de letra");

  const hero = isObj(b.hero) ? b.hero : {};
  const about = isObj(b.about) ? b.about : {};
  const aboutText = text(about.text, SITE_LIMITS.aboutText, "El texto de «Quiénes somos»");
  const aboutTitle = text(about.title, SITE_LIMITS.aboutTitle, "El título de «Quiénes somos»");

  const gallery = list(b.galleryIds, SITE_LIMITS.gallery, "Las fotos de la galería", (v) =>
    imageId(v, "Una foto de la galería"),
  );

  const highlights = list(b.highlights, SITE_LIMITS.highlights, "Los puntos de «Por qué nosotros»", (v) => {
    if (!isObj(v)) return fail("Un punto de «Por qué nosotros» no es válido");
    const title = text(v.title, SITE_LIMITS.highlightTitle, "El título de un punto");
    const body = text(v.text, SITE_LIMITS.highlightText, "El texto de un punto");
    if (!title && !body) return undefined;
    if (!title) fail("Cada punto de «Por qué nosotros» necesita un título");
    return compact({ title: title!, text: body });
  });

  const faq = list(b.faq, SITE_LIMITS.faq, "Las preguntas frecuentes", (v) => {
    if (!isObj(v)) return fail("Una pregunta frecuente no es válida");
    const q = text(v.q, SITE_LIMITS.faqQuestion, "Una pregunta");
    const a = text(v.a, SITE_LIMITS.faqAnswer, "Una respuesta");
    if (!q && !a) return undefined;
    if (!q || !a) fail("Cada pregunta frecuente necesita la pregunta y la respuesta");
    return { q: q!, a: a! };
  });

  const c = isObj(b.contact) ? b.contact : {};
  const email = text(c.email, 200, "El email");
  if (email && !EMAIL.test(email)) fail("El email no es válido");

  const sectionsIn = isObj(b.sections) ? b.sections : {};
  const sections = Object.fromEntries(
    SITE_SECTIONS.map((s) => {
      const v = sectionsIn[s];
      if (v !== undefined && typeof v !== "boolean") fail("Las secciones no son válidas");
      return [s, v !== false];
    }),
  ) as Record<SiteSection, boolean>;

  const seo = isObj(b.seo) ? b.seo : {};

  return compact({
    theme: compact({ primary, accent: color(theme.accent, "El color secundario"), font }),
    logoId: imageId(b.logoId, "El logo"),
    coverId: imageId(b.coverId, "La foto de portada"),
    galleryIds: [...new Set(gallery)],
    hero: compact({
      // May be empty while editing; publishing requires it (publishProblems)
      title: text(hero.title, SITE_LIMITS.heroTitle, "El título principal") ?? "",
      subtitle: text(hero.subtitle, SITE_LIMITS.heroSubtitle, "El subtítulo"),
    }),
    about: aboutText ? compact({ title: aboutTitle, text: aboutText }) : undefined,
    highlights,
    faq,
    contact: compact({
      phone: phone(c.phone, "El teléfono"),
      whatsapp: phone(c.whatsapp, "El WhatsApp"),
      email,
      address: text(c.address, SITE_LIMITS.address, "La dirección"),
      postalCode: text(c.postalCode, SITE_LIMITS.postalCode, "El código postal"),
      city: text(c.city, SITE_LIMITS.city, "La ciudad"),
      mapsUrl: url(c.mapsUrl, "El enlace de Google Maps", true),
      instagram: social(c.instagram, "Instagram", "https://www.instagram.com/", ["instagram.com"], true),
      facebook: social(c.facebook, "Facebook", "https://www.facebook.com/", ["facebook.com", "fb.com", "m.facebook.com"], true),
      linkedin: social(c.linkedin, "LinkedIn", "", ["linkedin.com", "es.linkedin.com"], false),
    }),
    healthRegistry: text(b.healthRegistry, SITE_LIMITS.healthRegistry, "El nº de registro sanitario"),
    sections,
    seo: compact({
      title: text(seo.title, SITE_LIMITS.seoTitle, "El título para Google"),
      description: text(seo.description, SITE_LIMITS.seoDescription, "La descripción para Google"),
    }),
  });
}

// The whole content, checked and cleaned. Image ids are only checked for
// format here: the controller checks they belong to the clinic (siteImageIds)
export function parseSiteContent(
  body: unknown,
): { ok: true; value: SiteContent } | { ok: false; error: string } {
  try {
    return { ok: true, value: parse(body) };
  } catch (error) {
    if (error instanceof Invalid) return { ok: false, error: error.message };
    throw error;
  }
}

// The images the content uses, by the kind they must be
export const siteImageIds = (c: SiteContent) => ({
  logo: c.logoId ? [c.logoId] : [],
  cover: c.coverId ? [c.coverId] : [],
  gallery: c.galleryIds,
});

// A new clinic's starting point: example texts for the clinic to edit
export function emptySiteContent(clinicName: string): SiteContent {
  return {
    theme: { primary: "#1f5144", font: "moderna" },
    galleryIds: [],
    hero: {
      title: "Fisioterapia que te pone en movimiento",
      subtitle: `En ${clinicName} te ayudamos a recuperarte de lesiones, aliviar el dolor y moverte mejor.`,
    },
    about: {
      title: "Quiénes somos",
      text: `${clinicName} es un centro de fisioterapia donde cada tratamiento se adapta a ti.\nEscuchamos, valoramos y te acompañamos hasta que vuelvas a hacer lo que te gusta.`,
    },
    highlights: [
      { title: "Atención personalizada", text: "Cada sesión se adapta a tu caso y a tus objetivos." },
      { title: "Profesionales colegiados", text: "Un equipo con formación continua en las últimas técnicas." },
      { title: "Reserva online", text: "Pide tu cita en un minuto, a cualquier hora." },
    ],
    faq: [
      {
        q: "¿Necesito una prescripción médica?",
        a: "No. Puedes venir directamente: en la primera sesión valoramos tu caso.",
      },
      {
        q: "¿Cuánto dura una sesión?",
        a: "Depende del tratamiento. Lo verás al elegir el servicio en la reserva online.",
      },
      {
        q: "¿Qué ropa debo llevar?",
        a: "Ropa cómoda que te permita moverte y dejar al descubierto la zona a tratar.",
      },
    ],
    contact: {},
    sections: { services: true, team: true, about: true, gallery: true, faq: true, hours: true },
    seo: {},
  };
}

// The legal details the legal notice needs (clinic_legal)
export type SiteLegal = {
  legalName: string | null;
  taxId: string | null;
  address: string | null;
  postalCode: string | null;
  city: string | null;
};

export const missingLegal = (legal: SiteLegal | null) =>
  [
    !legal?.legalName && "titular",
    !legal?.taxId && "NIF/CIF",
    !legal?.address && "dirección",
  ].filter((m): m is string => !!m);

// What stops the clinic from publishing. Empty = it can publish
export function publishProblems(c: SiteContent, legal: SiteLegal | null): string[] {
  const problems: string[] = [];
  if (!c.hero.title) problems.push("Escribe el título principal de tu web.");
  if (!c.contact.phone && !c.contact.email) {
    problems.push("Añade un teléfono o un email de contacto.");
  }
  const legalMissing = missingLegal(legal);
  if (legalMissing.length) {
    problems.push(
      `Faltan datos legales de la clínica (${legalMissing.join(", ")}), necesarios para el aviso legal. Escríbenos para completarlos.`,
    );
  }
  return problems;
}
