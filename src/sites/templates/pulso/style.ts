// Pulso: the markup is styled with Tailwind; this is what Tailwind can't do on
// its own: the template's fonts (self-hosted in sites-assets/fonts: Anton,
// Instrument Serif, Geist), the paper tones, the grain, the second colour and
// the strip animation. The clinic's colour is --primary (render.tsx).

const latin =
  "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD";
const latinExt =
  "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF";

const face = (family: string, file: string, weight: string) =>
  [
    `@font-face{font-family:"${family}";font-style:normal;font-display:swap;font-weight:${weight};src:url(/_fonts/${file.replace("{set}", "latin")}.woff2) format("woff2");unicode-range:${latin}}`,
    `@font-face{font-family:"${family}";font-style:normal;font-display:swap;font-weight:${weight};src:url(/_fonts/${file.replace("{set}", "latin-ext")}.woff2) format("woff2");unicode-range:${latinExt}}`,
  ].join("\n");

// Film grain: an SVG noise tile (a data: image, allowed by the CSP)
const noise = (alpha: number) =>
  `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='180'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.85' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 ${alpha} 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

export default `
${face("Anton", "anton-{set}-400-normal", "400")}
${face("Instrument Serif", "instrument-serif-{set}-400-normal", "400")}
${face("Geist", "geist-{set}-wght-normal", "100 900")}
:root{
  --font-heading:"Anton",Impact,sans-serif;--font-body:"Geist",system-ui,sans-serif;--heading-weight:400;
  --ink:#141414;--muted:#6b6964;--line:#dedbd4;--background:#e8e6e1;--foreground:var(--ink);--muted-foreground:#6b6964;--border:#dedbd4;--radius:1rem;
  --s8-paper:#e8e6e1;--s8-cream:#f6f5f1
}
body{background:var(--s8-paper);color:var(--ink);font-weight:400}
.s8-root{background:${noise(0.07)},var(--s8-paper);background-size:180px,auto}

/* Type */
.s8-display{font-family:"Anton",Impact,sans-serif;font-weight:400;text-transform:uppercase;letter-spacing:-.005em}
.s8-serif{font-family:"Instrument Serif",Georgia,serif;font-weight:400;letter-spacing:-.01em}

/* The second colour: the clinic's accent, or one opposite its main colour */
.s8-accent{--s8-second:var(--accent)}
.s8-auto-accent{--s8-second:var(--accent)}
@supports (color:oklch(from red l c h)){
  .s8-auto-accent{--s8-second:oklch(from var(--primary) .72 max(c, .12) calc(h + 170))}
}

/* Grain on solid shapes */
.s8-grain:not(.s8-circle){position:relative}
.s8-grain::after{content:"";position:absolute;inset:0;border-radius:inherit;background:${noise(0.35)};background-size:180px;opacity:.5;mix-blend-mode:overlay;pointer-events:none}

/* Treatments strip */
.s8-strip{mask:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent);-webkit-mask:linear-gradient(90deg,transparent,#000 8%,#000 92%,transparent)}
.s8-strip-track{animation:s8-scroll 45s linear infinite}
@keyframes s8-scroll{to{transform:translateX(-50%)}}

/* FAQ: big serif questions */
.s8-faq .ui-accordion-item{border-color:#dedbd4}
.s8-faq .ui-accordion-item:first-child{border-top:1px solid #dedbd4}
.s8-faq .ui-accordion-trigger{font-family:"Instrument Serif",Georgia,serif;font-weight:400;font-size:clamp(1.4rem,2.2vw,1.9rem);line-height:1.15;padding:1.4rem 0;align-items:center}
.s8-faq .ui-accordion-trigger:hover{color:var(--ink);opacity:.7}
.s8-faq .ui-chevron{width:2.2rem;height:2.2rem;padding:.55rem;margin:0;border-radius:999px;background:var(--ink);color:#fff;flex:none}
.s8-faq .ui-accordion-content{font-size:1.05rem;padding-right:3.5rem;color:#4d4b47}

.kf-contact .icon{color:var(--ink)}
.kf-social a{border-width:1px;opacity:.8}

/* Booking (shared: pages/BookingPage.tsx) and legal pages */
.kf-page h1{font-family:"Anton",Impact,sans-serif;font-weight:400;text-transform:uppercase;letter-spacing:0;line-height:.9;font-size:clamp(3rem,8vw,6.5rem)}
.kf-booking-kicker{background:var(--ink);color:#fff;border-radius:999px;padding:.35rem .8rem;text-transform:uppercase;letter-spacing:.08em;font-size:.72rem}
.kf-booking-kicker .icon{color:#fff}
.kf-booking-card,.kf-booking-offline{background:var(--s8-cream);border:0;border-radius:1.25rem}
.kf-booking-card h2{font-family:"Instrument Serif",Georgia,serif;font-weight:400;font-size:1.7rem;text-transform:uppercase;letter-spacing:-.01em}
.kf-legal-page h2{font-family:"Instrument Serif",Georgia,serif;font-weight:400;font-size:2rem;text-transform:uppercase}
`;
