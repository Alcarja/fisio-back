// Zen: the markup is styled with Tailwind; this is what Tailwind can't do on
// its own: the fonts (self-hosted in sites-assets/fonts: Instrument Serif with
// its italic, Geist), the paper tones, the calm version of the clinic's colour
// and the slow motion (breathing, drawing, drifting, revealing). Every
// animation starts from the finished state, so with reduced motion (render.tsx
// turns animations off) everything is simply there.

const latin =
  "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD";
const latinExt =
  "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C0, U+2113, U+2C60-2C7F, U+A720-A7FF";

const face = (family: string, file: string, weight: string, style = "normal") =>
  [
    `@font-face{font-family:"${family}";font-style:${style};font-display:swap;font-weight:${weight};src:url(/_fonts/${file.replace("{set}", "latin")}.woff2) format("woff2");unicode-range:${latin}}`,
    `@font-face{font-family:"${family}";font-style:${style};font-display:swap;font-weight:${weight};src:url(/_fonts/${file.replace("{set}", "latin-ext")}.woff2) format("woff2");unicode-range:${latinExt}}`,
  ].join("\n");

// Paper texture: an SVG noise tile (a data: image, allowed by the CSP)
const noise = (alpha: number) =>
  `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.8' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 ${alpha} 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`;

const serif = `"Instrument Serif",Georgia,serif`;
const ease = "cubic-bezier(.2,.7,.2,1)";

export default `
${face("Instrument Serif", "instrument-serif-{set}-400-normal", "400")}
${face("Instrument Serif", "instrument-serif-{set}-400-italic", "400", "italic")}
${face("Geist", "geist-{set}-wght-normal", "100 900")}
:root{
  --font-heading:${serif};--font-body:"Geist",system-ui,sans-serif;--heading-weight:400;
  --zen-paper:#f6f4ef;--zen-sand:#ece7dd;--zen-stone:#d6d0c4;
  --ink:#232624;--muted:#6d706b;--line:#d6d0c4;--background:#f6f4ef;--foreground:var(--ink);--muted-foreground:#6d706b;--border:#d6d0c4;--radius:1rem;
  /* The clinic's colour, a little deeper and quieter so it reads on paper */
  --zen-accent:color-mix(in oklab,var(--primary) 78%,#1d2120);
  --zen-mist:color-mix(in srgb,var(--primary) 8%,var(--zen-paper));
  --zen-wash:color-mix(in srgb,var(--primary) 16%,var(--zen-paper));
}
@supports (color:oklch(from red l c h)){
  :root{--zen-accent:oklch(from var(--primary) min(l,.5) min(c,.13) h)}
}
body{background:var(--zen-paper);color:var(--ink);font-weight:400;font-size:1.0625rem}
::selection{background:var(--zen-wash);color:var(--ink)}
.zen-root{background:${noise(0.035)},var(--zen-paper);background-size:200px,auto}

/* Type */
.zen-serif{font-family:${serif};font-weight:400;letter-spacing:-.01em}
.zen-h1,.zen-h2,.zen-h3{font-family:${serif};font-weight:400;color:var(--ink);text-wrap:balance}
.zen-h1{line-height:.98;letter-spacing:-.028em}
.zen-h2{line-height:1.02;letter-spacing:-.022em}
.zen-h3{line-height:1.1;letter-spacing:-.012em}
.zen-em{font-style:italic;color:var(--zen-accent);letter-spacing:-.01em}
.zen-main{counter-reset:zen}
.zen-num{font-family:${serif};font-style:italic;font-size:1.1rem;letter-spacing:0;text-transform:none;color:var(--zen-accent);min-width:1.2em}
.zen-num::before{counter-increment:zen;content:counter(zen,upper-roman)}

/* Space */
.zen-section{padding:7rem 0}
@media (min-width:48rem){.zen-section{padding:11rem 0}}

/* Shapes */
.zen-dome{border-radius:50% 50% 1.75rem 1.75rem/14% 14% 1.75rem 1.75rem}
@media (min-width:48rem){.zen-dome{border-radius:50% 50% 2rem 2rem/26% 26% 2rem 2rem}}
.zen-arch{border-radius:50% 50% 1.5rem 1.5rem/40% 40% 1.5rem 1.5rem}
.zen-zoom{transition:scale 1.6s ${ease}}
.zen-zoom:hover{scale:1.04}

/* Links */
.zen-link-line{display:block;width:2rem;height:1px;background:currentColor;transition:width .7s ${ease}}
.zen-link:hover .zen-link-line{width:3.75rem}
.zen-link:hover{color:var(--zen-accent)}
.zen-nav{position:relative;transition:color .4s}
.zen-nav[aria-current=page]::after{content:"";position:absolute;left:50%;bottom:-.55rem;width:4px;height:4px;margin-left:-2px;border-radius:50%;background:var(--zen-accent)}
.zen-foot-label{margin:0 0 .6rem;font-size:.7rem;letter-spacing:.28em;text-transform:uppercase;color:var(--muted)}
.zen-foot-link{color:var(--ink);text-decoration:none;font-size:.98rem;transition:color .4s}
.zen-foot-link:hover{color:var(--zen-accent)}
.zen-wordmark{color:var(--zen-paper);text-shadow:0 1px 0 rgba(255,255,255,.7),0 -1px 0 rgba(60,50,30,.06)}
.zen-social .kf-social{margin-top:2rem;gap:.6rem}
.zen-social .kf-social a{width:2.75rem;height:2.75rem;border:1px solid var(--zen-stone);color:var(--ink);opacity:1;transition:background .4s,border-color .4s}
.zen-social .kf-social a:hover{background:var(--zen-paper);border-color:var(--ink)}

/* Open status */
.zen-dot{position:relative;width:7px;height:7px;flex:none;border-radius:50%;background:#b3ada0}
.zen-dot-open{background:#4b9a6c}
.zen-dot-open::after{content:"";position:absolute;inset:-4px;border-radius:50%;border:1px solid #4b9a6c;animation:zen-halo 3s ease-out infinite;opacity:0}
@keyframes zen-halo{0%{scale:.4;opacity:.8}100%{scale:1.6;opacity:0}}

/* The phone menu: two lines that cross */
.zen-burger{position:relative;display:block;width:18px;height:8px}
.zen-burger::before,.zen-burger::after{content:"";position:absolute;left:0;right:0;height:1.5px;background:currentColor;transition:transform .4s ${ease},top .4s ${ease}}
.zen-burger::before{top:0}
.zen-burger::after{top:6.5px}
.zen-menu[open] .zen-burger::before{top:3.25px;transform:rotate(45deg)}
.zen-menu[open] .zen-burger::after{top:3.25px;transform:rotate(-45deg)}
.zen-menu[open]>nav{animation:zen-rise .5s ${ease} both}

/* Questions: + turns into × */
.zen-plus{position:relative;flex:none;width:2.6rem;height:2.6rem;border:1px solid var(--zen-stone);border-radius:50%;transition:transform .6s ${ease},background .4s,border-color .4s}
.zen-plus::before,.zen-plus::after{content:"";position:absolute;left:50%;top:50%;width:12px;height:1.25px;margin:-.6px 0 0 -6px;background:var(--ink);transition:background .4s}
.zen-plus::after{transform:rotate(90deg)}
.zen-faq summary:hover .zen-plus{border-color:var(--ink)}
.zen-faq[open] .zen-plus{transform:rotate(135deg);background:var(--ink);border-color:var(--ink)}
.zen-faq[open] .zen-plus::before,.zen-faq[open] .zen-plus::after{background:var(--zen-paper)}
.zen-faq[open]>div{animation:zen-rise .6s ${ease} both}

/* Motion: arriving */
.zen-rise{animation:zen-rise 1.4s ${ease} both}
.zen-rise-2{animation-delay:.15s}
.zen-rise-3{animation-delay:.3s}
.zen-rise-4{animation-delay:.45s}
@keyframes zen-rise{from{opacity:0;translate:0 1.25rem}}

/* Motion: the ensō paints itself, then breathes */
.zen-draw path{stroke-dasharray:1;animation:zen-draw 2.8s cubic-bezier(.6,.1,.3,1) .2s both}
.zen-draw path+path{animation-delay:.6s}
@keyframes zen-draw{from{stroke-dashoffset:1}}
.zen-breathe{animation:zen-breathe 9s ease-in-out infinite}
@keyframes zen-breathe{50%{scale:1.05}}

/* "Inspira / Espira": 4.5 s in, 4.5 s out */
.zen-breath-ring{animation:zen-ring 9s ease-in-out infinite}
@keyframes zen-ring{0%,100%{scale:.5;opacity:.45}50%{scale:1;opacity:1}}
.zen-breath-in{animation:zen-in 9s ease-in-out infinite}
.zen-breath-out{opacity:0;animation:zen-out 9s ease-in-out infinite}
@keyframes zen-in{0%,42%{opacity:1}50%,92%{opacity:0}100%{opacity:1}}
@keyframes zen-out{0%,42%{opacity:0}50%,92%{opacity:1}100%{opacity:0}}

/* Motion: water */
.zen-waves{animation:zen-drift 48s linear infinite}
@keyframes zen-drift{to{translate:-50% 0}}
.zen-ripples circle{animation:zen-ripple 7s ease-in-out infinite}
@keyframes zen-ripple{50%{stroke-opacity:.2}}

/* A drop falling down the line under inner page titles */
.zen-drop{position:relative;overflow:hidden}
.zen-drop::after{content:"";position:absolute;left:0;top:0;width:1px;height:40%;background:var(--zen-accent);animation:zen-fall 3.6s ease-in-out infinite;translate:0 -100%}
@keyframes zen-fall{0%{translate:0 -100%}70%,100%{translate:0 260%}}

/* Motion tied to scrolling, where the browser supports it: sections settle
   in as they arrive, the cover drifts, the visit path draws itself */
@media (prefers-reduced-motion:no-preference){
  @supports (animation-timeline:view()){
    .zen-reveal{animation:zen-reveal linear both;animation-timeline:view();animation-range:entry 0% entry 60%}
    @keyframes zen-reveal{from{opacity:0;translate:0 2.5rem}}
    .zen-parallax{scale:1.12;animation:zen-parallax linear both;animation-timeline:view()}
    @keyframes zen-parallax{from{translate:0 -5%}to{translate:0 5%}}
    .zen-trace{stroke-dasharray:1;animation:zen-draw linear both;animation-timeline:view();animation-range:entry 30% cover 50%}
  }
}

/* Booking (shared: pages/BookingPage.tsx) and legal pages */
.kf-page{padding:4.5rem 0 8rem}
.kf-page h1{font-family:${serif};font-weight:400;letter-spacing:-.025em;line-height:1;font-size:clamp(3rem,7vw,5.5rem)}
.kf-booking-kicker{color:var(--zen-accent);font-weight:400;text-transform:uppercase;letter-spacing:.24em;font-size:.7rem}
.kf-booking-kicker .icon{color:var(--zen-accent)}
.kf-booking-lead{font-size:1.1rem;line-height:1.8}
.kf-booking-card,.kf-booking-offline{background:var(--zen-sand);border:0;border-radius:1.5rem;padding:1.75rem}
.kf-booking-card h2{font-family:${serif};font-weight:400;font-size:1.7rem;letter-spacing:-.01em}
.kf-booking-card .kf-hours th,.kf-booking-card .kf-hours td{border-color:var(--zen-stone)}
.kf-booking-steps .icon,.kf-contact .icon{color:var(--zen-accent)}
.kf-booking-call{color:var(--ink);border-color:var(--zen-stone)}
.kf-status-open{color:#3d7f59}
.kf-legal-page h2{font-family:${serif};font-weight:400;font-size:2rem;letter-spacing:-.015em}
.kf-legal-page a,.kf-booking a{color:var(--zen-accent)}
`;
