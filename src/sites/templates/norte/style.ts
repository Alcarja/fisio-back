// Norte: the markup is styled with Tailwind; this is what Tailwind can't do on
// its own: the font (Geist, self-hosted in sites-assets/fonts), the greys,
// the tints of the clinic's colour and restyling the shared parts (shadcn
// buttons and accordion, booking and legal pages). The clinic's colour is
// --primary (render.tsx).

const latin =
  "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD";
const latinExt =
  "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF";

const geist = [
  `@font-face{font-family:"Geist";font-style:normal;font-display:swap;font-weight:100 900;src:url(/_fonts/geist-latin-wght-normal.woff2) format("woff2");unicode-range:${latin}}`,
  `@font-face{font-family:"Geist";font-style:normal;font-display:swap;font-weight:100 900;src:url(/_fonts/geist-latin-ext-wght-normal.woff2) format("woff2");unicode-range:${latinExt}}`,
].join("\n");

const sans = `"Geist",system-ui,-apple-system,"Segoe UI",sans-serif`;

export default `
${geist}
:root{
  --font-heading:${sans};--font-body:${sans};--heading-weight:600;
  --nt-page:#eef0f3;--nt-soft:#f4f5f7;--nt-line:#e3e6ea;--nt-ink:#0f1419;
  --ink:#0f1419;--muted:#5f6670;--line:#e3e6ea;--background:#eef0f3;--foreground:var(--ink);--card:#fff;--muted-foreground:#5f6670;--border:#e3e6ea;--radius:.9rem;
  --nt-tint:color-mix(in srgb,var(--primary) 12%,#fff);
}
body{background:var(--nt-page);color:var(--ink);font-size:1rem}
::selection{background:var(--nt-tint);color:var(--ink)}

/* Type: tight, confident, business-like */
.nt-h1,.nt-h2,.nt-h3{font-family:${sans};font-weight:600;color:inherit;text-wrap:balance}
.nt-h1{line-height:1.02;letter-spacing:-.045em}
.nt-h2{line-height:1.08;letter-spacing:-.035em}
.nt-h3{line-height:1.25;letter-spacing:-.02em}
.nt-num{font-weight:600;letter-spacing:-.04em;line-height:1;font-variant-numeric:tabular-nums}

/* Open status */
.nt-dot{position:relative;width:8px;height:8px;flex:none;border-radius:50%;background:#a0a6ae}
.nt-dot-open{background:#16a34a;box-shadow:0 0 0 3px rgba(22,163,74,.18)}

/* Decoration: a faint grid on brand panels, a glow on the dark one */
.nt-grid-bg{background-image:linear-gradient(rgba(255,255,255,.09) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.09) 1px,transparent 1px);background-size:44px 44px;-webkit-mask:radial-gradient(ellipse at 80% 20%,#000 20%,transparent 75%);mask:radial-gradient(ellipse at 80% 20%,#000 20%,transparent 75%)}
.nt-glow{background:radial-gradient(circle,color-mix(in srgb,var(--primary) 55%,transparent),transparent 65%);opacity:.55}

/* shadcn parts */
.nt-root .ui-btn{gap:.5rem}
.nt-root .ui-btn svg{width:1.05rem;height:1.05rem}
.nt-faq .ui-accordion-item{border-color:var(--nt-line)}
.nt-faq .ui-accordion-item:last-child{border-bottom:0}
.nt-faq .ui-accordion-trigger{font-size:1.05rem;font-weight:600;letter-spacing:-.01em;padding:1.15rem 0;color:var(--ink)}
.nt-faq .ui-accordion-trigger:hover{text-decoration:none;color:var(--primary)}
.nt-faq .ui-chevron{width:2rem;height:2rem;padding:.45rem;margin:0;border-radius:999px;background:var(--nt-soft);flex:none}
.nt-faq .ui-accordion-content{color:var(--muted);line-height:1.65;padding-right:2.5rem}
.nt-crumb .ui-breadcrumb-list{font-size:.86rem}

/* Footer */
.nt-foot-label{margin:0 0 .25rem;font-size:.78rem;font-weight:600;color:var(--ink)}
.nt-foot-link{color:var(--muted);text-decoration:none;font-size:.94rem}
.nt-foot-link:hover{color:var(--ink)}
.nt-legal a{color:var(--muted);text-decoration:none}
.nt-legal a:hover{color:var(--ink)}
.nt-legal .kf-legal nav{gap:1.25rem}
.kf-social{margin-top:.75rem}
.kf-social a{border:0;background:var(--nt-soft);color:var(--ink);opacity:1}
.kf-social a:hover{background:var(--nt-tint);color:var(--primary)}

/* Booking (shared: pages/BookingPage.tsx) and legal pages, inside a panel */
.nt-main>.kf-page{background:#fff;border-radius:1.75rem;margin:0 .75rem .75rem;padding:2.5rem 0 3.5rem}
@media (min-width:48rem){.nt-main>.kf-page{border-radius:2rem;margin:0 1.25rem 1rem;padding:3.5rem 1.5rem 4.5rem}}
@media (min-width:82.5rem){.nt-main>.kf-page{max-width:77.5rem;margin:0 auto 1rem}}
.kf-page h1{font-family:${sans};font-weight:600;letter-spacing:-.045em;line-height:1.05;font-size:clamp(2.2rem,5vw,3.6rem)}
.kf-booking-kicker{color:var(--primary);font-weight:600}
.kf-booking-card,.kf-booking-offline{background:var(--nt-soft);border:0;border-radius:1.5rem}
.kf-booking-card h2{font-family:${sans};font-weight:600;letter-spacing:-.02em;font-size:1.1rem}
.kf-booking-card .kf-hours th,.kf-booking-card .kf-hours td{border-color:var(--nt-line)}
.kf-legal-page h2{font-family:${sans};font-weight:600;letter-spacing:-.025em}
`;
