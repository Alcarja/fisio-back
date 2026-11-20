// Arco: the markup is styled with Tailwind; this is what Tailwind can't do on
// its own: the fonts (Bricolage Grotesque + Inter, self-hosted in
// sites-assets/fonts), the neutral tones (tinted with the clinic's colour) and
// restyling the shared parts (accordion, booking and legal pages).
//
// Colours: Layout.tsx sets --ar-dark (the clinic's main colour, darkened when
// it's too light to carry white text) and --ar-hl (the highlight: the second
// colour when it's light enough, a pale tint of the main one otherwise).
// Text on the highlight is always --ar-dark.

const latin =
  "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD";
const latinExt =
  "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF";

const face = (family: string, file: string, weight: string) =>
  [
    `@font-face{font-family:"${family}";font-style:normal;font-display:swap;font-weight:${weight};src:url(/_fonts/${file.replace("{set}", "latin")}.woff2) format("woff2");unicode-range:${latin}}`,
    `@font-face{font-family:"${family}";font-style:normal;font-display:swap;font-weight:${weight};src:url(/_fonts/${file.replace("{set}", "latin-ext")}.woff2) format("woff2");unicode-range:${latinExt}}`,
  ].join("\n");

const display = `"Bricolage Grotesque",system-ui,sans-serif`;
const body = `"Inter",system-ui,-apple-system,"Segoe UI",sans-serif`;

export default `
${face("Bricolage Grotesque", "bricolage-grotesque-{set}-opsz-normal", "200 800")}
${face("Inter", "inter-{set}-wght-normal", "100 900")}
:root{
  --font-heading:${display};--font-body:${body};--heading-weight:700;
}
.ar-root{
  --ar-bg:color-mix(in srgb,var(--ar-dark) 4%,#f5f6f3);
  --ar-line:color-mix(in srgb,var(--ar-dark) 9%,#e2e5e0);
  --ar-line-strong:color-mix(in srgb,var(--ar-dark) 16%,#c3c8c2);
  --ar-tag:color-mix(in srgb,var(--ar-dark) 7%,#ebeee9);
  --ar-dark-deep:color-mix(in srgb,var(--ar-dark) 80%,#000);
  --ar-on-dark-muted:color-mix(in srgb,var(--ar-dark) 22%,#fff);
  --ink:color-mix(in srgb,var(--ar-dark) 30%,#101815);
  --muted:color-mix(in srgb,var(--ar-dark) 32%,#59605d);
  --line:var(--ar-line);--background:var(--ar-bg);--foreground:var(--ink);--card:#fff;--muted-foreground:var(--muted);--border:var(--ar-line);--ring:var(--ar-dark);--radius:1rem;
  background:var(--ar-bg);color:var(--ink);font-family:${body};font-size:1rem;line-height:1.5
}
body{background:var(--ar-bg)}
::selection{background:var(--ar-hl);color:var(--ar-dark)}
.ar-root :focus-visible{outline:3px solid var(--ar-dark);outline-offset:2px}

/* Type */
.ar-display{font-family:${display};font-weight:700;color:inherit;text-wrap:balance}
.ar-h1{line-height:.98;letter-spacing:-.04em}
.ar-h2{line-height:1.02;letter-spacing:-.035em}
.ar-h3{line-height:1.1;letter-spacing:-.02em}
.ar-num{font-family:${display};font-weight:700;letter-spacing:-.04em;line-height:.9;font-variant-numeric:tabular-nums}
.ar-eyebrow{margin:0;font-size:.875rem;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)}
.ar-mark{background:var(--ar-hl);color:var(--ar-dark);padding:0 .1em;border-radius:.12em;-webkit-box-decoration-break:clone;box-decoration-break:clone}

/* The map stand-in: a 40px grid (no embedded map: it would send data to Google) */
.ar-grid{background-color:var(--ar-line);background-image:linear-gradient(var(--ar-line-strong) 1px,transparent 1px),linear-gradient(90deg,var(--ar-line-strong) 1px,transparent 1px);background-size:40px 40px;background-position:-1px -1px}

/* Open status */
.ar-dot{width:8px;height:8px;flex:none;border-radius:50%;background:#9aa29f}
.ar-dot-open{background:#16a34a;box-shadow:0 0 0 3px rgba(22,163,74,.18)}

/* FAQ (shadcn accordion) */
.ar-faq{display:grid;gap:.75rem}
.ar-faq .ui-accordion-item{background:#fff;border:1px solid var(--ar-line);border-radius:1.25rem;padding:0 1.5rem}
.ar-faq .ui-accordion-item:last-child{border-bottom:1px solid var(--ar-line)}
.ar-faq .ui-accordion-item[open]{border-color:var(--ar-line-strong)}
.ar-faq .ui-accordion-trigger{font-family:${display};font-size:1.15rem;font-weight:700;letter-spacing:-.015em;padding:1.25rem 0;color:var(--ink);min-height:44px}
.ar-faq .ui-accordion-trigger:hover{text-decoration:none}
.ar-faq .ui-chevron{width:2.25rem;height:2.25rem;padding:.55rem;margin:0;border-radius:999px;background:var(--ar-tag);color:var(--ar-dark);flex:none}
.ar-faq .ui-accordion-item[open] .ui-chevron{background:var(--ar-hl)}
.ar-faq .ui-accordion-content{color:var(--muted);line-height:1.6;padding:0 2.75rem 1.25rem 0}
.ar-crumb .ui-breadcrumb-list{font-size:.9rem;color:var(--muted)}
.ar-crumb .ui-breadcrumb-link{color:var(--muted)}
.ar-crumb .ui-breadcrumb-page{color:var(--ink);font-weight:500}

/* Hours table (contact page) */
.ar-root .kf-hours{max-width:none;font-size:.95rem}
.ar-root .kf-hours th,.ar-root .kf-hours td{border-color:var(--ar-line);padding:.7rem 0}
.ar-root .kf-hours td{text-align:right;font-variant-numeric:tabular-nums}

/* Social and footer */
.ar-root .kf-social{margin-top:0}
.ar-root .kf-social a{width:2.75rem;height:2.75rem;border:1.5px solid var(--ink);color:var(--ink);opacity:1}
.ar-root .kf-social a:hover{background:var(--ar-hl);border-color:var(--ar-dark);color:var(--ar-dark)}
.ar-foot .kf-legal{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:.25rem 1.5rem;font-size:.875rem;color:var(--ar-on-dark-muted)}
.ar-foot .kf-legal p{margin:0}
.ar-foot .kf-legal nav{margin:0;gap:0 1.5rem}
.ar-foot .kf-legal a{color:var(--ar-on-dark-muted);text-decoration:none;display:inline-block;padding:.75rem 0}
.ar-foot .kf-legal a:hover{color:#fff;text-decoration:underline}
.ar-foot .kf-credit{flex-basis:100%;opacity:1}

/* Booking (shared: pages/BookingPage.tsx) and legal pages */
.ar-main>.kf-page{padding:clamp(2rem,5vw,3.5rem) 0 5rem}
.ar-main .kf-wrap{max-width:75rem;padding:0 clamp(20px,5vw,48px)}
.kf-page h1{font-family:${display};font-weight:700;letter-spacing:-.035em;line-height:1.02;font-size:clamp(2.125rem,4vw,3rem)}
.kf-booking-kicker{color:var(--ar-dark);background:#fff;border:1px solid var(--ar-line);border-radius:999px;padding:.5rem 1rem .5rem .75rem;font-size:.875rem;font-weight:500}
.kf-booking-lead{font-size:1.0625rem}
.kf-booking-frame{background:#fff;border-radius:2rem;border:1px solid var(--ar-line)}
.kf-booking-card,.kf-booking-offline{background:#fff;border:1px solid var(--ar-line);border-radius:1.75rem;padding:1.75rem}
.kf-booking-card h2{font-family:${display};font-weight:700;letter-spacing:-.02em;font-size:1.375rem}
.kf-booking-card .kf-hours th,.kf-booking-card .kf-hours td{border-color:var(--ar-line)}
.kf-booking-aside>.kf-booking-card:first-child{background:var(--ar-dark);border-color:var(--ar-dark);color:#fff}
.kf-booking-aside>.kf-booking-card:first-child h2{color:#fff}
.kf-booking-aside>.kf-booking-card:first-child a{color:#fff}
.kf-booking-aside>.kf-booking-card:first-child .icon{color:var(--ar-hl)}
.kf-booking-aside>.kf-booking-card:first-child .kf-hours th,.kf-booking-aside>.kf-booking-card:first-child .kf-hours td{border-color:rgba(255,255,255,.12)}
.kf-booking-aside>.kf-booking-card:first-child .kf-closed td,.kf-booking-aside>.kf-booking-card:first-child .kf-status{color:var(--ar-on-dark-muted)}
.kf-booking-aside>.kf-booking-card:first-child .kf-booking-call{border-color:rgba(255,255,255,.12)}
.kf-booking-steps .icon,.kf-contact .icon{color:var(--ar-dark)}
.kf-legal-page h2{font-family:${display};font-weight:700;letter-spacing:-.025em}
.kf-legal-page a{color:var(--ar-dark)}
`;
