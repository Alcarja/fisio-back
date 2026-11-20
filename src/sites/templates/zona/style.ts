import { ZONES } from "./zones.js";

// Zona: the markup is styled with Tailwind; this is what Tailwind can't do on
// its own: the fonts (Archivo + JetBrains Mono, self-hosted in
// sites-assets/fonts), the tones derived from the clinic's colour, the zone
// selector and FAQ without JavaScript, the ticker and restyling the shared
// parts (booking and legal pages).
//
// Colour: Layout.tsx sets --zn-accent (the clinic's main colour, darkened
// until white text reads well on it). The design is one accent on white and
// black; the second colour isn't used.

const latin =
  "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD";
const latinExt =
  "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF";

const face = (family: string, file: string, weight: string) =>
  [
    `@font-face{font-family:"${family}";font-style:normal;font-display:swap;font-weight:${weight};src:url(/_fonts/${file.replace("{set}", "latin")}.woff2) format("woff2");unicode-range:${latin}}`,
    `@font-face{font-family:"${family}";font-style:normal;font-display:swap;font-weight:${weight};src:url(/_fonts/${file.replace("{set}", "latin-ext")}.woff2) format("woff2");unicode-range:${latinExt}}`,
  ].join("\n");

const sans = `"Archivo",system-ui,-apple-system,"Segoe UI",sans-serif`;
const mono = `"JetBrains Mono",ui-monospace,SFMono-Regular,Menlo,monospace`;

// The selected zone's panel: one rule per zone (radio checked → its panel)
const zonePanels = ZONES.map((z) => `.zn-hero:has(#zn-z-${z.id}:checked) .zn-panel[data-zone="${z.id}"]`).join(",");

export default `
${face("Archivo", "archivo-{set}-wght-normal", "100 900")}
${face("JetBrains Mono", "jetbrains-mono-{set}-wght-normal", "100 800")}
:root{
  --font-heading:${sans};--font-body:${sans};--heading-weight:800;
}
.zn-root{
  --zn-ink:#0a0a0a;--zn-text2:#3f3f3c;--zn-line:#e2e2de;
  --zn-tint:color-mix(in srgb,var(--zn-accent) 6%,#fff);
  --zn-tint-line:color-mix(in srgb,var(--zn-accent) 20%,#e4e4e0);
  --zn-on-dark-label:color-mix(in srgb,var(--zn-accent) 35%,#fff);
  --zn-on-dark-2:#bdbdb8;
  --ink:var(--zn-ink);--muted:#5b5b57;--line:var(--zn-line);--background:#fff;--foreground:var(--zn-ink);--card:#fff;--muted-foreground:#5b5b57;--border:var(--zn-line);--ring:var(--zn-accent);--radius:6px;
  background:#fff;color:var(--zn-ink);font-family:${sans};font-size:1rem;line-height:1.5
}
body{background:#fff}
::selection{background:var(--zn-accent);color:#fff}
.zn-root :focus-visible{outline:3px solid var(--zn-accent);outline-offset:2px}
.zn-on-color :focus-visible{outline-color:#fff}

/* Type */
.zn-mono{font-family:${mono};letter-spacing:.06em;text-transform:uppercase}
.zn-x{font-family:${sans};font-weight:800;color:inherit;text-wrap:balance}

/* Zone selector: radios (keyboard arrows for free), panels shown with :has() */
.zn-radio{position:absolute;opacity:0;width:1px;height:1px;margin:0;pointer-events:none}
.zn-zone{color:rgba(255,255,255,.56);cursor:pointer}
.zn-zone:hover{color:rgba(255,255,255,.8)}
.zn-zone .zn-arrow{opacity:0;transform:translateX(-8px);transition:opacity .2s,transform .2s}
.zn-radio:checked+.zn-zone{color:#fff}
.zn-radio:checked+.zn-zone .zn-arrow{opacity:1;transform:none}
.zn-radio:focus-visible+.zn-zone{outline:3px solid #fff;outline-offset:2px}
.zn-panel{display:none}
${zonePanels}{display:flex}
@supports not selector(:has(*)){.zn-panel[data-zone="rodilla"]{display:flex}}

/* Ticker: two copies scrolling (stopped with reduced motion by the base CSS) */
.zn-ticker-track{display:inline-flex;animation:zn-marquee 60s linear infinite}
@keyframes zn-marquee{to{transform:translateX(-50%)}}

/* FAQ: <details>, one open at a time (same name), "+" turning into "×" */
.zn-faq summary{list-style:none;cursor:pointer}
.zn-faq summary::-webkit-details-marker{display:none}
.zn-faq .zn-plus{border:1px solid var(--zn-ink);transition:background-color .2s}
.zn-faq .zn-plus svg{transition:transform .2s}
.zn-faq details[open] .zn-plus{background:var(--zn-accent);border-color:var(--zn-accent);color:#fff}
.zn-faq details[open] .zn-plus svg{transform:rotate(45deg)}

/* Hours table (contact page) */
.zn-root .kf-hours{max-width:none;font-size:1rem}
.zn-root .kf-hours th,.zn-root .kf-hours td{border-color:var(--zn-tint-line);padding:.9rem 0}
.zn-root .kf-hours th{font-weight:700}
.zn-root .kf-hours td{text-align:right;font-variant-numeric:tabular-nums}

/* Social links on the accent closing */
.zn-root .kf-social{margin-top:0}
.zn-root .kf-social a{width:2.75rem;height:2.75rem;border-radius:6px;border:1px solid rgba(255,255,255,.5);color:#fff;opacity:1}
.zn-root .kf-social a:hover{background:#fff;color:var(--zn-accent)}

/* Booking (shared: pages/BookingPage.tsx) and legal pages */
.zn-main>.kf-page{padding:clamp(2rem,5vw,4rem) 0 5rem}
.zn-main .kf-wrap{max-width:82.5rem;padding:0 clamp(20px,4vw,40px)}
.kf-page h1{font-family:${sans};font-weight:800;letter-spacing:-.05em;line-height:.92;font-size:clamp(2.75rem,6vw,5.5rem)}
.kf-booking-kicker{font-family:${mono};text-transform:uppercase;letter-spacing:.06em;font-size:.8rem;font-weight:400;color:var(--zn-accent)}
.kf-booking-lead{font-size:1.125rem;color:var(--zn-text2)}
.kf-booking-frame{border:1px solid var(--zn-ink);border-radius:10px;background:#fff}
.kf-booking-card,.kf-booking-offline{background:#fff;border:1px solid var(--zn-line);border-radius:12px;padding:1.5rem}
.kf-booking-card h2{font-family:${sans};font-weight:700;letter-spacing:-.02em;font-size:1.375rem}
.kf-booking-card .kf-hours th,.kf-booking-card .kf-hours td{border-color:var(--zn-line);padding:.55rem 0;font-weight:400}
.kf-booking-aside>.kf-booking-card:first-child{background:var(--zn-ink);border-color:var(--zn-ink);color:#fff}
.kf-booking-aside>.kf-booking-card:first-child h2,.kf-booking-aside>.kf-booking-card:first-child a{color:#fff}
.kf-booking-aside>.kf-booking-card:first-child .icon{color:var(--zn-on-dark-label)}
.kf-booking-aside>.kf-booking-card:first-child .kf-hours th,.kf-booking-aside>.kf-booking-card:first-child .kf-hours td{border-color:rgba(255,255,255,.15)}
.kf-booking-aside>.kf-booking-card:first-child .kf-closed td,.kf-booking-aside>.kf-booking-card:first-child .kf-status{color:var(--zn-on-dark-2)}
.kf-booking-aside>.kf-booking-card:first-child .kf-booking-call{border-color:rgba(255,255,255,.15)}
.kf-booking-steps .icon,.kf-contact .icon{color:var(--zn-accent)}
.kf-legal-page h2{font-family:${sans};font-weight:800;letter-spacing:-.035em}
.kf-legal-page a{color:var(--zn-accent)}
`;
