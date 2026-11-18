import { createHash } from "node:crypto";
import { renderToStaticMarkup } from "react-dom/server";
import type { SiteFont } from "../lib/site.js";
import type { PageData } from "./data.js";
import { appOrigin, env } from "./env.js";
import BookingPage from "./pages/BookingPage.js";
import { CookiesPolicy, LegalNotice, PrivacyPolicy } from "./pages/LegalPages.js";
import { getTemplate } from "./templates/index.js";
import { fullAddress, SCHEMA_DAYS } from "./templates/shared/format.js";
import type { SitePage, SitePageProps } from "./templates/types.js";

// A whole page as HTML: React renders it once on the server (no JavaScript in
// the browser except the booking frame's resize script). Every clinic text
// goes through React, which escapes it.

// The only script on clinic sites: on /reservar, resize the booking frame
// with the height that kineflow.es reports. Only messages from the app and
// from that frame count
export const BOOKING_SCRIPT = `(function(){var f=document.getElementById("kf-booking");if(!f)return;window.addEventListener("message",function(e){if(e.origin!==${JSON.stringify(appOrigin)}||e.source!==f.contentWindow)return;var d=e.data;if(d&&d.type==="kineflow:height"&&typeof d.height==="number"){f.style.height=Math.max(420,Math.ceil(d.height))+"px"}})})();`;
// Allowed by its hash in the Content-Security-Policy (no 'unsafe-inline')
export const BOOKING_SCRIPT_HASH = `'sha256-${createHash("sha256").update(BOOKING_SCRIPT).digest("base64")}'`;

// The JSON-LD block is inline too (data, not code), allowed the same way per page
export const scriptHash = (code: string) =>
  `'sha256-${createHash("sha256").update(code).digest("base64")}'`;

const PAGE_PATHS: Record<SitePage, string> = {
  home: "/",
  reservar: "/reservar",
  "aviso-legal": "/aviso-legal",
  privacidad: "/privacidad",
  cookies: "/cookies",
};

const PAGE_TITLES: Partial<Record<SitePage, string>> = {
  reservar: "Reservar cita",
  "aviso-legal": "Aviso legal",
  privacidad: "Política de privacidad",
  cookies: "Política de cookies",
};

// ---------- Fonts and colours ----------

const FONT_FILES = {
  geist: { family: "Geist", files: ["geist-latin-wght-normal", "geist-latin-ext-wght-normal"], weight: "100 900" },
  instrument: {
    family: "Instrument Serif",
    files: ["instrument-serif-latin-400-normal", "instrument-serif-latin-ext-400-normal"],
    weight: "400",
  },
  nunito: { family: "Nunito", files: ["nunito-latin-wght-normal", "nunito-latin-ext-wght-normal"], weight: "200 1000" },
} as const;

// Each letter style in Mi web: heading font, body font, heading weight
const FONT_STYLES: Record<SiteFont, { heading: keyof typeof FONT_FILES; body: keyof typeof FONT_FILES; weight: number }> = {
  moderna: { heading: "geist", body: "geist", weight: 650 },
  clasica: { heading: "instrument", body: "geist", weight: 400 },
  redondeada: { heading: "nunito", body: "nunito", weight: 800 },
};

// Latin first, latin-ext (ñ is in latin; ŀ, ő… in ext) only when needed
const UNICODE = [
  "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD",
  "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF",
];

function fontFaces(font: SiteFont) {
  const style = FONT_STYLES[font] ?? FONT_STYLES.moderna;
  const used = [...new Set([style.heading, style.body])];
  const faces = used.flatMap((key) =>
    FONT_FILES[key].files.map(
      (file, i) =>
        `@font-face{font-family:"${FONT_FILES[key].family}";font-style:normal;font-display:swap;font-weight:${FONT_FILES[key].weight};src:url(/_fonts/${file}.woff2) format("woff2");unicode-range:${UNICODE[i]}}`,
    ),
  );
  const fallbackSerif = style.heading === "instrument" ? "Georgia, serif" : "system-ui, sans-serif";
  return {
    css: faces.join("\n"),
    vars: `--font-heading:"${FONT_FILES[style.heading].family}",${fallbackSerif};--font-body:"${FONT_FILES[style.body].family}",system-ui,-apple-system,"Segoe UI",sans-serif;--heading-weight:${style.weight};`,
    preload: `/_fonts/${FONT_FILES[style.heading].files[0]}.woff2`,
  };
}

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];

// Dark text on light colours, white on dark ones (readable buttons)
function contrastText(hex: string) {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.45 ? "#1d2422" : "#ffffff";
}

// The colour mixed with white (backgrounds of tinted sections)
function soft(hex: string, amount = 0.08) {
  const [r, g, b] = rgb(hex).map((v) => Math.round(255 - (255 - v) * amount));
  return `rgb(${r},${g},${b})`;
}

// Shared by every template: reset, typography, the kf- blocks
const BASE_CSS = `
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
body{margin:0;font-family:var(--font-body);color:var(--ink);background:#fff;line-height:1.6;font-size:1.0625rem;-webkit-font-smoothing:antialiased}
h1,h2,h3{font-family:var(--font-heading);font-weight:var(--heading-weight);line-height:1.15;letter-spacing:-.01em;color:var(--ink)}
img{max-width:100%;height:auto}
a{color:var(--primary)}
.icon{width:1.15rem;height:1.15rem;flex:none}
.kf-contact{list-style:none;padding:0;margin:0;display:grid;gap:.85rem}
.kf-contact li{display:flex;gap:.75rem;align-items:flex-start}
.kf-contact .icon{margin-top:.25rem;color:var(--primary)}
.kf-hours{border-collapse:collapse;width:100%;max-width:28rem}
.kf-hours th,.kf-hours td{text-align:left;padding:.55rem 0;border-bottom:1px solid var(--line);font-weight:400;vertical-align:top}
.kf-hours th{padding-right:1.5rem;white-space:nowrap}
.kf-closed td{color:var(--muted)}
.kf-social{display:flex;gap:.5rem;margin-top:1.25rem}
.kf-social a{display:flex;align-items:center;justify-content:center;width:2.5rem;height:2.5rem;border-radius:999px;border:1px solid currentColor;opacity:.85}
.kf-legal{font-size:.9rem}
.kf-legal p{margin:0 0 .5rem}
.kf-legal nav{display:flex;flex-wrap:wrap;gap:1rem;margin:.5rem 0}
.kf-credit{opacity:.7}
.kf-booking-frame{display:block;width:100%;height:720px;border:0;background:transparent}
.kf-legal-page h2{font-size:1.35rem;margin:2rem 0 .5rem}
.kf-legal-page li{margin:.35rem 0}
`;

// ---------- The page ----------

type RenderOptions = {
  data: PageData;
  page: SitePage;
  // https://activapilates.sites.kineflow.es (canonical links, Open Graph)
  origin: string;
  // The preview of the draft: not indexed, links don't navigate, images
  // carry the token
  previewToken?: string;
};

export function renderPage({ data, page, origin, previewToken }: RenderOptions): { html: string; scriptHashes: string[] } {
  const { content } = data;
  const template = getTemplate(data.template);
  const img = (id?: string) =>
    id ? `/_img/${id}${previewToken ? `?t=${encodeURIComponent(previewToken)}` : ""}` : undefined;

  const props: SitePageProps = {
    clinic: { name: data.clinic.name, slug: data.clinic.slug },
    content,
    services: data.services,
    team: data.team.map(({ photoId, ...m }) => ({ ...m, photoUrl: img(photoId) })),
    hours: data.hours,
    legal: data.legal,
    bookingUrl: data.bookingEnabled ? "/reservar" : null,
    img,
    link: (path) => (previewToken ? "#" : path),
    showKineflowCredit: data.showKineflowCredit,
    appUrl: env.appUrl,
    page,
  };

  const body =
    page === "home" ? (
      <template.Home props={props} />
    ) : page === "reservar" ? (
      <BookingPage props={props} />
    ) : page === "aviso-legal" ? (
      <LegalNotice props={props} />
    ) : page === "privacidad" ? (
      <PrivacyPolicy props={props} />
    ) : (
      <CookiesPolicy props={props} />
    );

  const city = content.contact.city;
  const baseTitle = content.seo.title || (city ? `${data.clinic.name} · Fisioterapia en ${city}` : data.clinic.name);
  const title = PAGE_TITLES[page] ? `${PAGE_TITLES[page]} · ${data.clinic.name}` : baseTitle;
  const description = content.seo.description || content.hero.subtitle || content.hero.title;
  const canonical = `${origin}${PAGE_PATHS[page]}`;
  const cover = content.coverId ? `${origin}/_img/${content.coverId}` : undefined;
  const logo = img(content.logoId);

  const fonts = fontFaces(content.theme.font);
  const primary = content.theme.primary;
  const vars = `:root{--primary:${primary};--primary-contrast:${contrastText(primary)};--primary-soft:${soft(primary)};--accent:${content.theme.accent ?? primary};--ink:#1d2422;--muted:#5b6461;--line:#e4e7e5;${fonts.vars}}`;

  const jsonLd = page === "home" ? JSON.stringify(localBusiness(data, origin, cover)).replace(/</g, "\\u003c") : null;
  const scripts = [
    ...(jsonLd ? [jsonLd] : []),
    ...(page === "reservar" && data.bookingEnabled && !previewToken ? [BOOKING_SCRIPT] : []),
  ];

  const html = renderToStaticMarkup(
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>{title}</title>
        {description && <meta name="description" content={description} />}
        {previewToken ? <meta name="robots" content="noindex, nofollow" /> : <link rel="canonical" href={canonical} />}
        <meta property="og:type" content="website" />
        <meta property="og:locale" content="es_ES" />
        <meta property="og:site_name" content={data.clinic.name} />
        <meta property="og:title" content={title} />
        {description && <meta property="og:description" content={description} />}
        <meta property="og:url" content={canonical} />
        {cover && <meta property="og:image" content={cover} />}
        {logo && <link rel="icon" href={logo} />}
        <meta name="theme-color" content={primary} />
        <link rel="preload" href={fonts.preload} as="font" type="font/woff2" crossOrigin="anonymous" />
        <style dangerouslySetInnerHTML={{ __html: `${fonts.css}\n${vars}\n${BASE_CSS}\n${template.css}` }} />
        {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd }} />}
      </head>
      <body>
        <template.Layout props={props}>{body}</template.Layout>
        {page === "reservar" && data.bookingEnabled && !previewToken && (
          <script dangerouslySetInnerHTML={{ __html: BOOKING_SCRIPT }} />
        )}
      </body>
    </html>,
  );
  return { html: `<!doctype html>${html}`, scriptHashes: scripts.map(scriptHash) };
}

// Google's local business data (schema.org/Physiotherapy)
function localBusiness(data: PageData, origin: string, image?: string) {
  const c = data.content.contact;
  const days = new Map<string, { opens: string; closes: string; days: string[] }>();
  for (const h of data.hours) {
    const key = `${h.start}-${h.end}`;
    const entry = days.get(key) ?? { opens: h.start, closes: h.end, days: [] };
    entry.days.push(`https://schema.org/${SCHEMA_DAYS[h.weekday - 1]}`);
    days.set(key, entry);
  }
  return {
    "@context": "https://schema.org",
    "@type": "Physiotherapy",
    name: data.clinic.name,
    url: `${origin}/`,
    ...(c.phone && { telephone: c.phone }),
    ...(c.email && { email: c.email }),
    ...(image && { image }),
    ...(data.content.hero.subtitle && { description: data.content.hero.subtitle }),
    ...(fullAddress(c) && {
      address: {
        "@type": "PostalAddress",
        ...(c.address && { streetAddress: c.address }),
        ...(c.postalCode && { postalCode: c.postalCode }),
        ...(c.city && { addressLocality: c.city }),
        addressCountry: "ES",
      },
    }),
    ...(days.size && {
      openingHoursSpecification: [...days.values()].map((d) => ({
        "@type": "OpeningHoursSpecification",
        dayOfWeek: d.days,
        opens: d.opens,
        closes: d.closes,
      })),
    }),
    ...([c.instagram, c.facebook, c.linkedin].some(Boolean) && {
      sameAs: [c.instagram, c.facebook, c.linkedin].filter(Boolean),
    }),
  };
}
