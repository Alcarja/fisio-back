// Calma: the markup is styled with Tailwind; this is what Tailwind can't do on
// its own: the font (Figtree, self-hosted in sites-assets/fonts), the tones
// derived from the clinic's colour, the FAQ without JavaScript and restyling
// the shared parts (booking and legal pages).
//
// Colour: Layout.tsx sets --cl-primary (the clinic's main colour, darkened
// until white text reads well on it). Everything else (tints, lines, the
// light accent on the dark blocks) is mixed from it, so any colour works.

const latin =
  "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD";
const latinExt =
  "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF";

const sans = `"Figtree",system-ui,-apple-system,"Segoe UI",sans-serif`;

export default `
@font-face{font-family:"Figtree";font-style:normal;font-display:swap;font-weight:300 900;src:url(/_fonts/figtree-latin-wght-normal.woff2) format("woff2");unicode-range:${latin}}
@font-face{font-family:"Figtree";font-style:normal;font-display:swap;font-weight:300 900;src:url(/_fonts/figtree-latin-ext-wght-normal.woff2) format("woff2");unicode-range:${latinExt}}
:root{
  --font-heading:${sans};--font-body:${sans};--heading-weight:600;
}
.cl-root{
  --cl-ink:color-mix(in srgb,var(--cl-primary) 18%,#0b1513);
  --cl-muted:color-mix(in srgb,var(--cl-primary) 22%,#525a58);
  --cl-line:color-mix(in srgb,var(--cl-primary) 10%,#e2e7e5);
  --cl-chip:color-mix(in srgb,var(--cl-primary) 18%,#d3d9d7);
  --cl-tint:color-mix(in srgb,var(--cl-primary) 7%,#fff);
  --cl-photo:color-mix(in srgb,var(--cl-primary) 12%,#f0f2f1);
  --cl-photo-line:color-mix(in srgb,var(--cl-primary) 18%,#e6eae8);
  --cl-on-dark-accent:color-mix(in oklch,var(--cl-primary) 42%,#fff);
  --cl-on-dark-muted:color-mix(in srgb,var(--cl-primary) 12%,#b9c1bf);
  --cl-on-dark-line:color-mix(in srgb,var(--cl-primary) 25%,#2c3533);
  --ink:var(--cl-ink);--muted:var(--cl-muted);--line:var(--cl-line);--background:#fff;--foreground:var(--cl-ink);--card:#fff;--muted-foreground:var(--cl-muted);--border:var(--cl-line);--ring:var(--cl-primary);--radius:14px;
  background:#fff;color:var(--cl-ink);font-family:${sans};font-size:17px;line-height:1.6
}
body{background:#fff}
/* The light accent on dark blocks: the clinic's hue, light and gently saturated */
@supports (color:oklch(from red l c h)){.cl-root{--cl-on-dark-accent:oklch(from var(--cl-primary) .84 min(c,.09) h)}}
::selection{background:var(--cl-primary);color:#fff}
.cl-root :focus-visible{outline:3px solid var(--cl-primary);outline-offset:2px}
.cl-dark :focus-visible{outline-color:#fff}
.cl-x{font-family:${sans};font-weight:600;color:inherit;text-wrap:balance}

/* The map stand-in: a 48px grid (no embedded map: it would send data to Google) */
.cl-grid{background-color:var(--cl-photo);background-image:linear-gradient(var(--cl-photo-line) 1px,transparent 1px),linear-gradient(90deg,var(--cl-photo-line) 1px,transparent 1px);background-size:48px 48px}

/* Treatments: cells sharing their borders */
.cl-cells{border-top:1px solid var(--cl-line);border-left:1px solid var(--cl-line)}
.cl-cells>li{border-right:1px solid var(--cl-line);border-bottom:1px solid var(--cl-line)}
.cl-cell-icon svg{width:26px;height:26px}

/* FAQ: <details>, one open at a time */
.cl-faq summary{list-style:none;cursor:pointer}
.cl-faq summary::-webkit-details-marker{display:none}
.cl-faq .cl-chev{transition:transform .2s}
.cl-faq details[open] .cl-chev{transform:rotate(180deg);background:var(--cl-primary);color:#fff}

/* Open status dot */
.cl-dot{width:8px;height:8px;flex:none;border-radius:50%;background:#9aa29f}
.cl-dot-open{background:#16a34a;box-shadow:0 0 0 3px rgba(22,163,74,.18)}

/* Social links */
.cl-root .kf-social{margin-top:0}
.cl-root .kf-social a{width:2.75rem;height:2.75rem;border-radius:12px;border:1px solid var(--cl-line);color:var(--cl-ink);opacity:1}
.cl-root .kf-social a:hover{background:var(--cl-tint);border-color:var(--cl-primary);color:var(--cl-primary)}

/* Phones: room for the fixed call / book bar */
@media (max-width:63.99rem){.cl-root.cl-has-bar{padding-bottom:5.5rem}}

/* Booking (shared: pages/BookingPage.tsx) and legal pages */
.cl-main>.kf-page{padding:clamp(2rem,5vw,4rem) 0 5rem}
.cl-main .kf-wrap{max-width:77.5rem;padding:0 clamp(20px,4vw,48px)}
.kf-page h1{font-family:${sans};font-weight:600;letter-spacing:-.035em;line-height:1.04;font-size:clamp(2.5rem,5vw,4rem)}
.kf-booking-kicker{color:var(--cl-primary);font-size:.94rem;font-weight:600}
.kf-booking-lead{font-size:1.125rem;color:var(--cl-muted)}
.kf-booking-frame{border:1px solid var(--cl-line);border-radius:20px;background:#fff}
.kf-booking-card,.kf-booking-offline{background:#fff;border:1px solid var(--cl-line);border-radius:20px;padding:1.75rem}
.kf-booking-card h2{font-family:${sans};font-weight:600;letter-spacing:-.01em;font-size:1.3rem}
.kf-booking-card .kf-hours th,.kf-booking-card .kf-hours td{border-color:var(--cl-line)}
.kf-booking-aside>.kf-booking-card:first-child{background:var(--cl-ink);border-color:var(--cl-ink);color:#fff}
.kf-booking-aside>.kf-booking-card:first-child h2,.kf-booking-aside>.kf-booking-card:first-child a{color:#fff}
.kf-booking-aside>.kf-booking-card:first-child .icon{color:var(--cl-on-dark-accent)}
.kf-booking-aside>.kf-booking-card:first-child .kf-hours th,.kf-booking-aside>.kf-booking-card:first-child .kf-hours td{border-color:var(--cl-on-dark-line)}
.kf-booking-aside>.kf-booking-card:first-child .kf-closed td,.kf-booking-aside>.kf-booking-card:first-child .kf-status{color:var(--cl-on-dark-muted)}
.kf-booking-aside>.kf-booking-card:first-child .kf-booking-call{border-color:var(--cl-on-dark-line)}
.kf-booking-steps .icon,.kf-contact .icon{color:var(--cl-primary)}
.kf-legal-page h2{font-family:${sans};font-weight:600;letter-spacing:-.02em}
.kf-legal-page a{color:var(--cl-primary)}
`;
