// Pulso: the markup is styled with Tailwind classes; this is only what
// Tailwind can't express: its own font (Poppins, self-hosted in
// sites-assets/fonts), tokens, background gradients and the line-art
// animation. The clinic's colour is --primary (render.tsx); the three
// signature colours are fixed accents, not the clinic's colour.

const latin =
  "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD";
const latinExt =
  "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF";

const faces = [300, 400, 500, 600]
  .flatMap((w) => [
    `@font-face{font-family:"Poppins";font-style:normal;font-display:swap;font-weight:${w};src:url(/_fonts/poppins-latin-${w}-normal.woff2) format("woff2");unicode-range:${latin}}`,
    `@font-face{font-family:"Poppins";font-style:normal;font-display:swap;font-weight:${w};src:url(/_fonts/poppins-latin-ext-${w}-normal.woff2) format("woff2");unicode-range:${latinExt}}`,
  ])
  .join("\n");

export default `
${faces}
:root{
  --font-heading:"Poppins",system-ui,sans-serif;--font-body:"Poppins",system-ui,sans-serif;--heading-weight:600;
  --ink:#1c1c1c;--muted:#6b6b6b;--line:#e6e6e3;
  --background:#fff;--foreground:var(--ink);--muted-foreground:#6b6b6b;--border:#e6e6e3;--radius:1rem;
  --pu-violet:#7b2ff7;--pu-violet-soft:#a98bff;--pu-mint:#5df0cf;--pu-lime:#e4f54b;--pu-gray:#f4f4f2
}
body{font-weight:400;color:var(--ink)}
.kf-contact .icon{color:var(--ink)}
.kf-social a{border-width:1.5px}

/* Line art: draws itself once */
.pu-art path,.pu-art circle{fill:none;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:1;stroke-dashoffset:1;animation:pu-draw 2.4s cubic-bezier(.65,0,.35,1) forwards}
.pu-art-violet{stroke:var(--pu-violet)}
.pu-art-mint{stroke:var(--pu-mint);animation-delay:.3s!important}
.pu-art-soft{opacity:.45;animation-delay:.15s!important}
.pu-art-strong{stroke-width:2.2!important;animation-delay:.6s!important;animation-duration:2s!important}
@keyframes pu-draw{to{stroke-dashoffset:0}}
/* Without motion, the drawing is simply there */
@media (prefers-reduced-motion:reduce){.pu-art path,.pu-art circle{stroke-dashoffset:0}}

/* Backgrounds */
.pu-dark::before{content:"";position:absolute;inset:0;background:radial-gradient(60rem 30rem at 85% 0%,rgba(123,47,247,.45),transparent 60%),radial-gradient(40rem 26rem at 10% 100%,rgba(30,90,60,.5),transparent 60%);pointer-events:none}
.pu-blob::before{content:"";position:absolute;width:46rem;height:34rem;right:-12rem;top:-10rem;background:radial-gradient(closest-side,rgba(123,47,247,.10),rgba(255,120,200,.06) 50%,transparent);pointer-events:none}
.pu-fresh::before{content:"";position:absolute;width:56rem;height:44rem;right:-16rem;top:-8rem;background:radial-gradient(closest-side,rgba(228,245,75,.42),rgba(93,240,207,.16) 55%,transparent);pointer-events:none}
.pu-ferns::before{content:"";position:absolute;inset:auto 0 0 0;height:60%;background:radial-gradient(50rem 20rem at 20% 100%,rgba(93,240,207,.16),transparent 70%),radial-gradient(50rem 20rem at 85% 100%,rgba(123,47,247,.10),transparent 70%);pointer-events:none}
.pu-band{background:radial-gradient(30rem 16rem at 15% 40%,rgba(228,245,75,.9),transparent 70%),radial-gradient(30rem 18rem at 50% 70%,rgba(93,240,207,.85),transparent 70%),radial-gradient(34rem 18rem at 85% 30%,rgba(123,47,247,.75),transparent 70%),var(--primary)}

/* Booking (shared: pages/BookingPage.tsx) and legal pages */
.kf-page h1{font-weight:600;letter-spacing:-.03em;font-size:clamp(2.4rem,5.5vw,4rem)}
.kf-booking-kicker{text-transform:uppercase;letter-spacing:.18em;font-size:.76rem}
.kf-booking-card,.kf-booking-offline{border-radius:1rem;border-color:#dcdcd8}
.kf-booking-card h2{font-weight:600}
`;
