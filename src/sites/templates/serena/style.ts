import { uiCss } from "../shared/ui.js";

// Serena: a physiotherapy clinic's site on the shadcn components
// (shared/ui.tsx). Clean white, surfaces tinted with the clinic's own colour
// (so every clinic's site feels like its own), clear cards, a drawn spine as
// signature. Only the palette variables from render.tsx, never a fixed
// clinic colour.
const serena = `
:root{
  --background:#ffffff;--foreground:#14201c;--card:#ffffff;--card-foreground:#14201c;
  --muted:color-mix(in srgb,var(--primary) 6%,#f7f8f8);--muted-foreground:#5a6662;
  --border:#e3e8e6;--secondary:color-mix(in srgb,var(--primary) 11%,#fff);
  --secondary-foreground:color-mix(in srgb,var(--primary) 75%,#000);
  --primary-foreground:var(--primary-contrast);--ring:var(--primary);--radius:.75rem;
  --ink:var(--foreground);--line:var(--border);
  --tint:color-mix(in srgb,var(--primary) 5%,#fff);
  --night:color-mix(in srgb,var(--primary) 22%,#0d1513)
}
body{background:var(--background);color:var(--foreground)}
::selection{background:var(--primary-tint)}
a:focus-visible,summary:focus-visible{outline:2px solid var(--ring);outline-offset:3px;border-radius:4px}
.kf-contact a{color:var(--foreground);text-decoration:none}
.kf-contact a:hover{color:var(--primary)}
.kf-social a{color:inherit;border-color:currentColor;opacity:.6;transition:opacity .2s}
.kf-social a:hover{opacity:1}
.kf-closed td{color:var(--muted-foreground)}

/* Rhythm */
.se-section{padding:4.5rem 0}
.se-tight{padding:3rem 0}
.se-tint{background:var(--tint)}
.se-section h2,.se-faq h2,.se-about h2{font-size:clamp(1.8rem,3.8vw,2.6rem);line-height:1.12;letter-spacing:-.025em;margin:0}
.se-em{color:var(--primary)}
.se-lead{font-size:clamp(1.05rem,1.7vw,1.2rem);color:var(--muted-foreground);max-width:36rem;margin:0 0 2rem;line-height:1.65}
.se-actions{display:flex;flex-wrap:wrap;gap:.75rem}
.se-eyebrow{margin:0 0 .85rem;font-size:.8rem;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:var(--primary)}
.se-head{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:1.5rem;margin-bottom:2.5rem}
.se-head>div{max-width:40rem}
.se-head-lead{margin:.9rem 0 0;color:var(--muted-foreground)}
.se-head-center{justify-content:center;text-align:center}

/* Top bar */
.se-topbar{background:var(--night);color:rgba(255,255,255,.82);font-size:.84rem}
.se-topbar-row{display:flex;align-items:center;justify-content:space-between;gap:1rem;min-height:2.5rem}
.se-topbar-left{display:flex;align-items:center;gap:1.75rem;min-width:0}
.se-topbar-address{display:none;align-items:center;gap:.4rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.se-topbar .icon{width:.95rem;height:.95rem;opacity:.8}
.se-topbar-phone{display:inline-flex;align-items:center;gap:.4rem;color:#fff;text-decoration:none;font-weight:600;white-space:nowrap}
.se-topbar .se-status{color:rgba(255,255,255,.9)}
.se-topbar .se-status-open{color:#9be3bf}

/* Status */
.se-status{display:inline-flex;align-items:center;gap:.5rem;font-weight:500;color:var(--muted-foreground);white-space:nowrap}
.se-status-dot{width:.5rem;height:.5rem;border-radius:999px;background:#a9b1ae;flex:none}
.se-status-open{color:#18794e}
.se-status-open .se-status-dot{background:#22a06b;box-shadow:0 0 0 3px rgba(34,160,107,.2);animation:se-blink 2.4s ease-in-out infinite}
@keyframes se-blink{50%{box-shadow:0 0 0 6px rgba(34,160,107,0)}}

/* Header */
.se-header{position:sticky;top:0;z-index:50;background:rgba(255,255,255,.92);backdrop-filter:saturate(1.5) blur(14px);-webkit-backdrop-filter:saturate(1.5) blur(14px);border-bottom:1px solid var(--border)}
.se-header-row{display:flex;align-items:center;justify-content:space-between;gap:1.5rem;height:4.5rem}
.se-brand{display:flex;align-items:center;gap:.75rem;color:var(--foreground);text-decoration:none;min-width:0}
.se-logo{display:block;max-height:2.75rem;max-width:11rem;object-fit:contain}
.se-mark{flex:none;display:flex;align-items:center;justify-content:center;width:2.6rem;height:2.6rem;border-radius:.8rem .8rem .8rem .25rem;background:var(--primary);color:var(--primary-contrast);font-family:var(--font-heading);font-weight:var(--heading-weight);font-size:1rem;letter-spacing:.02em}
.se-brand-text{display:flex;flex-direction:column;line-height:1.15;min-width:0}
.se-brand-text strong{font-family:var(--font-heading);font-weight:var(--heading-weight);font-size:1.08rem;letter-spacing:-.01em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.se-brand-text small{font-size:.78rem;color:var(--muted-foreground)}
.se-brand-inv{color:#fff}
.se-brand-inv .se-brand-text small{color:rgba(255,255,255,.6)}
.se-nav{display:none;gap:.25rem;font-size:.94rem}
.se-nav a{color:var(--muted-foreground);text-decoration:none;padding:.5rem .8rem;border-radius:999px;transition:color .2s,background .2s}
.se-nav a:hover{color:var(--foreground);background:var(--muted)}
.se-nav a[aria-current=page]{color:var(--primary);background:var(--secondary);font-weight:500}
.se-header-end{display:flex;align-items:center;gap:.5rem;flex:none}
.se-header-cta{border-radius:999px}
.se-mobile{position:relative}
.se-mobile summary{list-style:none;border-radius:999px}
.se-mobile summary::-webkit-details-marker{display:none}
.se-mobile-panel{position:absolute;right:0;top:calc(100% + .6rem);width:min(17rem,calc(100vw - 2.5rem));display:flex;flex-direction:column;padding:.5rem;background:var(--card);border-radius:1rem;box-shadow:0 0 0 1px var(--border),0 18px 40px -12px rgba(20,32,28,.2);animation:se-pop .2s ease-out}
.se-mobile-panel a:not(.ui-btn){padding:.7rem .85rem;border-radius:.6rem;color:var(--foreground);text-decoration:none}
.se-mobile-panel a:not(.ui-btn):hover{background:var(--muted)}
.se-mobile-panel a[aria-current=page]{color:var(--primary);background:var(--secondary)}
.se-mobile-cta{margin-top:.4rem;border-radius:999px}
@keyframes se-pop{from{opacity:0;transform:translateY(-6px) scale(.98)}to{opacity:1;transform:none}}

/* Spine */
.se-spine{display:block;width:100%;height:100%}
.se-spine-halo{fill:var(--primary);opacity:.06}
.se-spine-halo2{fill:var(--primary);opacity:.07}
.se-spine-body{fill:var(--primary)}
.se-spine-wing{fill:var(--primary);opacity:.35}
.se-spine-disc{fill:var(--primary);opacity:.22}
.se-spine g{animation:se-rise .7s ease-out both}
${Array.from({ length: 13 }, (_, i) => `.se-spine g:nth-of-type(${i + 1}){animation-delay:${(i * 0.05).toFixed(2)}s}`).join("")}
@keyframes se-rise{from{opacity:0}to{opacity:1}}

/* Hero */
.se-hero{padding:3rem 0 3.5rem;background:linear-gradient(180deg,var(--tint),#fff 70%)}
.se-hero-grid{display:grid;gap:3rem;align-items:center}
.se-hero-badge{height:1.85rem;padding:0 .85rem;margin-bottom:1.5rem;font-size:.82rem}
.se-hero h1{font-size:clamp(2.4rem,5.6vw,4rem);line-height:1.05;letter-spacing:-.035em;margin:0 0 1.25rem;max-width:16ch}
.se-hero-team{display:flex;align-items:center;gap:.85rem;margin:2.25rem 0 0;font-size:.95rem;color:var(--muted-foreground)}
.se-hero-team strong{color:var(--foreground);font-weight:600}
.se-stack{display:flex}
.se-stack .ui-avatar{box-shadow:0 0 0 2.5px #fff;margin-left:-.55rem}
.se-stack .ui-avatar:first-child{margin-left:0}
.se-stack .ui-avatar-fallback{background:var(--secondary);color:var(--secondary-foreground);font-size:.68rem;letter-spacing:-.02em}
.se-hero-visual{position:relative;max-width:34rem;width:100%;margin:0 auto;padding:0 0 2rem}
.se-hero-frame{aspect-ratio:5/6;border-radius:1.75rem;overflow:hidden;background:var(--secondary)}
.se-hero-frame img{width:100%;height:100%;object-fit:cover;display:block}
.se-hero-frame-art{display:flex;align-items:center;justify-content:center;padding:2rem 0;background:linear-gradient(160deg,var(--secondary),var(--tint))}
.se-float{position:absolute;display:flex;align-items:center;gap:.75rem;padding:.8rem 1.1rem .8rem .8rem;background:#fff;border-radius:1rem;box-shadow:0 0 0 1px var(--border),0 20px 40px -18px rgba(20,32,28,.28);color:var(--foreground);text-decoration:none}
.se-float>span:last-child{display:flex;flex-direction:column;line-height:1.3}
.se-float small{font-size:.75rem;color:var(--muted-foreground)}
.se-float strong{font-size:.92rem;font-weight:600}
.se-float .se-status{font-size:.9rem}
.se-float-icon{display:flex;align-items:center;justify-content:center;width:2.4rem;height:2.4rem;border-radius:.7rem;background:var(--secondary);color:var(--primary);flex:none}
.se-float-icon-solid{background:var(--primary);color:var(--primary-contrast)}
.se-float-status{left:-.5rem;bottom:0}
.se-float-book{right:-.5rem;top:1.5rem;transition:transform .2s}
.se-float-book:hover{transform:translateY(-2px)}

/* Trust */
.se-trust{list-style:none;margin:0;padding:1.25rem;display:grid;gap:1.25rem;border:1px solid var(--border);border-radius:1.25rem;background:#fff;box-shadow:0 12px 32px -24px rgba(20,32,28,.25)}
.se-trust li{display:flex;gap:.85rem;align-items:center}
.se-trust li>span:last-child{display:flex;flex-direction:column;line-height:1.35;min-width:0}
.se-trust strong{font-size:.95rem;font-weight:600}
.se-trust li>span:last-child>span{font-size:.85rem;color:var(--muted-foreground)}
.se-trust-icon{display:flex;align-items:center;justify-content:center;width:2.6rem;height:2.6rem;border-radius:999px;background:var(--secondary);color:var(--primary);flex:none}

/* Services */
.se-service-grid{display:grid;gap:1rem}
.se-service{transition:transform .25s,box-shadow .25s}
.se-service:hover{transform:translateY(-3px);box-shadow:0 0 0 1px color-mix(in srgb,var(--primary) 35%,transparent),0 24px 44px -26px rgba(20,32,28,.35)}
.se-service-icon{display:flex;align-items:center;justify-content:center;width:3rem;height:3rem;border-radius:.9rem;background:var(--secondary);color:var(--primary);margin-bottom:.75rem}
.se-service-icon .icon{width:1.4rem;height:1.4rem}
.se-service .ui-card-title{font-size:1.2rem}
.se-clamp p{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.se-clamp p+p{display:none}
.se-service .ui-card-description p{margin:0 0 .5rem}
.se-service-meta{display:flex;align-items:center;gap:.75rem;font-size:.88rem;color:var(--muted-foreground)}
.se-service-meta>span:first-child{display:inline-flex;align-items:center;gap:.4rem}
.se-service-meta .icon{width:1rem;height:1rem}
.se-service-foot{justify-content:space-between}
.se-price{font-family:var(--font-heading);font-weight:var(--heading-weight);font-size:1.3rem;letter-spacing:-.01em;white-space:nowrap}
.se-price-ask{font-family:var(--font-body);font-size:.9rem;font-weight:500;color:var(--muted-foreground)}
.se-group+.se-group{margin-top:3.5rem}
.se-group-title{font-size:1.35rem!important;margin:0 0 1.25rem!important}

/* First visit */
.se-visit{list-style:none;margin:0;padding:0;display:grid;gap:2rem;counter-reset:v}
.se-visit li{position:relative}
.se-visit-icon{position:relative;display:flex;align-items:center;justify-content:center;width:3.5rem;height:3.5rem;border-radius:999px;background:#fff;color:var(--primary);box-shadow:0 0 0 1px var(--border);margin-bottom:1.1rem}
.se-visit-icon .icon{width:1.4rem;height:1.4rem}
.se-visit-num{position:absolute;top:-.2rem;right:-.3rem;display:flex;align-items:center;justify-content:center;width:1.4rem;height:1.4rem;border-radius:999px;background:var(--primary);color:var(--primary-contrast);font-size:.72rem;font-weight:700}
.se-visit h3{margin:0 0 .4rem;font-size:1.15rem}
.se-visit p{margin:0;color:var(--muted-foreground);font-size:.96rem}

/* About */
.se-about{display:grid;gap:3rem}
.se-about-text h2{margin-bottom:1.25rem}
.se-about-text p{color:var(--muted-foreground);margin:0 0 1rem;max-width:36rem}
.se-about-text .ui-btn{margin-top:.75rem}
.se-highlights{list-style:none;margin:0;padding:0;display:grid;gap:.75rem}
.se-highlights li{display:flex;gap:1rem;align-items:flex-start;padding:1.15rem 1.25rem;border:1px solid var(--border);border-radius:1rem;background:#fff}
.se-highlights li>span:last-child{display:flex;flex-direction:column;gap:.2rem}
.se-highlights strong{font-weight:600}
.se-highlights li>span:last-child>span{color:var(--muted-foreground);font-size:.95rem}
.se-check{display:flex;align-items:center;justify-content:center;width:1.9rem;height:1.9rem;border-radius:999px;background:var(--primary);color:var(--primary-contrast);flex:none}
.se-check .icon{width:1rem;height:1rem}

/* Team */
.se-team-grid{display:grid;gap:2rem 1.5rem}
.se-person{display:flex;flex-direction:column}
.se-portrait{position:relative;aspect-ratio:4/5;border-radius:1.25rem;overflow:hidden;background:var(--secondary);margin-bottom:1.1rem}
.se-portrait img{width:100%;height:100%;object-fit:cover;display:block;transition:transform .6s}
.se-person:hover .se-portrait img{transform:scale(1.03)}
.se-portrait-initials{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:var(--font-heading);font-weight:var(--heading-weight);font-size:4rem;color:var(--primary);opacity:.8}
.se-license{position:absolute;left:.75rem;bottom:.75rem;display:inline-flex;align-items:center;gap:.35rem;padding:.35rem .7rem;border-radius:999px;background:rgba(255,255,255,.94);font-size:.75rem;font-weight:600;color:var(--foreground);backdrop-filter:blur(6px)}
.se-license .icon{width:.9rem;height:.9rem;color:var(--primary)}
.se-person h3{margin:0;font-size:1.25rem;letter-spacing:-.01em}
.se-role{margin:.2rem 0 0;color:var(--primary);font-size:.93rem;font-weight:500}
.se-bio{margin:.75rem 0 0;color:var(--muted-foreground);font-size:.96rem}

/* Gallery: one big, the rest around it */
.se-gallery{list-style:none;padding:0;margin:0;display:grid;gap:.75rem;grid-template-columns:repeat(2,1fr)}
.se-gallery li{border-radius:1rem;overflow:hidden;background:var(--muted);aspect-ratio:1}
.se-gallery img{width:100%;height:100%;object-fit:cover;display:block}
.se-gallery li:first-child{grid-column:1 / -1;aspect-ratio:16/9}

/* FAQ */
.se-faq{display:grid;gap:2rem}
.se-faq-side p{margin:1rem 0 0;color:var(--muted-foreground);max-width:24rem}
.se-faq .ui-accordion-trigger{font-size:1.04rem}
.se-faq .ui-accordion-item:first-child{border-top:1px solid var(--border)}

/* Call to action */
.se-cta{position:relative;overflow:hidden;display:grid;border-radius:1.75rem;background:var(--primary);color:var(--primary-contrast);padding:2.5rem 1.5rem}
.se-cta-text{position:relative;z-index:1;max-width:36rem}
.se-cta-title{font-family:var(--font-heading);font-weight:var(--heading-weight);font-size:clamp(1.8rem,4vw,2.7rem);line-height:1.1;letter-spacing:-.025em;margin:0 0 1rem;color:inherit}
.se-cta-text>p:not(.se-cta-title){margin:0 0 1.75rem;opacity:.85}
.se-cta .ui-btn-secondary{background:#fff;color:var(--foreground)}
.se-cta .ui-btn-secondary:hover{background:rgba(255,255,255,.88)}
.se-btn-inv{background:transparent!important;color:inherit!important;border-color:color-mix(in srgb,currentColor 40%,transparent)!important}
.se-btn-inv:hover{background:color-mix(in srgb,currentColor 12%,transparent)!important}
.se-cta-spine{position:absolute;right:-3rem;top:-2rem;width:16rem;height:auto;opacity:.22}
.se-cta-spine .se-spine-body,.se-cta-spine .se-spine-wing,.se-cta-spine .se-spine-disc{fill:var(--primary-contrast)}
.se-cta-spine circle{display:none}

/* Location */
.se-location{display:grid;gap:1rem;align-items:start}
.se-map-card{padding-top:0}
.se-map{position:relative;height:11rem;overflow:hidden;background:var(--muted)}
.se-map svg{width:100%;height:100%;display:block}
.se-map-block{fill:var(--tint)}
.se-map-road{fill:none;stroke:#fff;stroke-width:7;stroke-linecap:round}
.se-map-main{stroke:color-mix(in srgb,var(--primary) 22%,#fff);stroke-width:12}
.se-map-park{fill:color-mix(in srgb,#3c9a6b 16%,#fff);stroke:none}
.se-pin{position:absolute;left:50%;top:50%;display:flex;align-items:center;justify-content:center;width:3rem;height:3rem;margin:-2.4rem 0 0 -1.5rem;border-radius:999px 999px 999px 0;transform:rotate(-45deg);background:var(--primary);color:var(--primary-contrast);box-shadow:0 10px 24px -8px var(--primary)}
.se-pin .icon{transform:rotate(45deg);width:1.25rem;height:1.25rem}
.se-hours{list-style:none;margin:0;padding:0}
.se-hours li{display:flex;justify-content:space-between;gap:1rem;padding:.6rem .75rem;border-radius:.6rem;font-size:.94rem}
.se-hours li>span:first-child{display:inline-flex;align-items:center;gap:.5rem}
.se-hours li>span:last-child{font-variant-numeric:tabular-nums;text-align:right}
.se-hours .se-today{background:var(--secondary);font-weight:600}
.se-hours .se-closed>span:last-child{color:var(--muted-foreground)}
.se-hours .ui-badge{height:1.2rem;font-size:.68rem;background:var(--primary);color:var(--primary-contrast)}

/* Inner page header */
.se-page-head{position:relative;overflow:hidden;padding:3rem 0;background:var(--tint);border-bottom:1px solid var(--border)}
.se-page-head-inner{position:relative;z-index:1}
.se-page-head h1{font-size:clamp(2.2rem,5vw,3.5rem);line-height:1.06;letter-spacing:-.035em;margin:1.25rem 0 1rem;max-width:18ch}
.se-page-head .se-lead{margin:0}
.se-page-spine{position:absolute;right:6%;top:50%;width:10rem;height:auto;transform:translateY(-50%);opacity:.45;display:none!important}
.se-page-spine circle{display:none}

/* About page */
.se-story{display:grid;gap:2.5rem;align-items:start}
.se-prose p{margin:0 0 1.15rem;font-size:1.08rem;line-height:1.75;color:var(--muted-foreground)}
.se-prose p:first-child{font-size:1.25rem;color:var(--foreground);line-height:1.6}
.se-story-photo{border-radius:1.5rem;overflow:hidden;aspect-ratio:4/5}
.se-story-photo img{width:100%;height:100%;object-fit:cover;display:block}

/* Footer */
.se-footer{background:var(--night);color:rgba(255,255,255,.72);padding:4rem 0 2rem;margin-top:2rem}
.se-footer-grid{display:grid;gap:2.5rem;padding-bottom:2.5rem;border-bottom:1px solid rgba(255,255,255,.1)}
.se-footer-brand p{margin:1rem 0 0;max-width:22rem;font-size:.94rem}
.se-footer .se-mark{background:#fff;color:var(--night)}
.se-footer-registry{font-size:.82rem!important;opacity:.7}
.se-footer-label{margin:0 0 1rem;font-size:.78rem;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#fff}
.se-footer-col{display:flex;flex-direction:column;gap:.55rem;font-size:.94rem}
.se-footer-col>a{color:rgba(255,255,255,.72);text-decoration:none;width:fit-content}
.se-footer-col>a:hover{color:#fff}
.se-footer .kf-contact{gap:.65rem}
.se-footer .kf-contact a{color:rgba(255,255,255,.85)}
.se-footer .kf-contact .icon{color:#fff;opacity:.6}
.se-footer .se-hours li{padding:.3rem 0;font-size:.88rem}
.se-footer .se-hours .se-today{background:none;color:#fff}
.se-footer .se-hours .ui-badge{display:none}
.se-footer .se-hours li>span:last-child{white-space:nowrap}
.se-footer .se-hours .se-closed>span:last-child{color:rgba(255,255,255,.45)}
.se-footer .kf-legal{margin-top:1.5rem;font-size:.84rem}
.se-footer .kf-legal a{color:rgba(255,255,255,.72)}

/* Booking page (shared: pages/BookingPage.tsx) and legal pages */
.kf-page{padding:3rem 0 5rem}
.kf-page h1{font-size:clamp(2.2rem,5vw,3.25rem);letter-spacing:-.03em;line-height:1.06}
.kf-booking{background:linear-gradient(180deg,var(--tint),#fff 22rem)}
.kf-booking-kicker{padding:.35rem .8rem;border-radius:999px;background:var(--secondary)}
.kf-booking-lead{color:var(--muted-foreground)!important;font-size:1.1rem}
.kf-booking-main{min-width:0}
.kf-booking-card{border-radius:1.25rem;border-color:var(--border)}
.kf-booking-call{color:var(--primary)}
.kf-booking .kf-status{margin-bottom:1rem}
.kf-legal-page p,.kf-legal-page li{color:var(--muted-foreground)}

@media (min-width:40rem){
  .se-topbar-address{display:inline-flex}
  .se-service-grid{grid-template-columns:repeat(2,1fr)}
  .se-team-grid{grid-template-columns:repeat(2,1fr)}
  .se-trust{grid-template-columns:repeat(2,1fr);padding:1.5rem}
  .se-visit{grid-template-columns:repeat(2,1fr)}
  .se-location{grid-template-columns:repeat(2,1fr)}
  .se-gallery{grid-template-columns:repeat(4,1fr);grid-auto-rows:clamp(9rem,16vw,13rem)}
  .se-gallery li{aspect-ratio:auto}
  .se-gallery li:first-child{grid-column:span 2;grid-row:span 2;aspect-ratio:auto}
  .se-gallery-1 li:first-child,.se-gallery-2 li:first-child{grid-row:auto}
  .se-cta{padding:3.5rem 3rem}
  .se-footer-grid{grid-template-columns:repeat(2,1fr)}
}
@media (min-width:60rem){
  .se-nav{display:flex}
  .se-mobile{display:none}
  .se-section{padding:6rem 0}
  .se-tight{padding:4rem 0}
  .se-hero{padding:4.5rem 0 4.5rem}
  .se-hero-grid{grid-template-columns:1.1fr .9fr;gap:4rem}
  .se-float-status{left:-2rem;bottom:2.5rem}
  .se-float-book{right:-1.5rem}
  .se-trust{grid-template-columns:repeat(auto-fit,minmax(13rem,1fr));margin-top:-1.5rem;position:relative;z-index:2}
  .se-service-grid{grid-template-columns:repeat(3,1fr)}
  .se-visit{grid-template-columns:repeat(4,1fr);gap:2.5rem}
  .se-visit li:not(:last-child)::after{content:"";position:absolute;top:1.75rem;left:4.5rem;right:-1.5rem;border-top:1.5px dashed color-mix(in srgb,var(--primary) 35%,transparent)}
  .se-about{grid-template-columns:1fr 1fr;gap:5rem;align-items:center}
  .se-team-grid{grid-template-columns:repeat(3,1fr)}
  .se-faq{grid-template-columns:.8fr 1.2fr;gap:5rem;align-items:start}
  .se-faq-side{position:sticky;top:7rem}
  .se-cta{grid-template-columns:1fr;padding:4.5rem 4rem}
  .se-cta-spine{right:3rem;top:-3rem;width:20rem;opacity:.25}
  .se-location{grid-template-columns:1.2fr 1fr}
  .se-page-head{padding:4.5rem 0}
  .se-page-spine{display:block!important}
  .se-story{grid-template-columns:1.2fr .8fr;gap:4rem}
  .se-footer-grid{grid-template-columns:1.4fr 1fr 1.2fr 1.3fr;gap:3rem}
}
@media (max-width:39.99rem){.se-header-cta{display:none}}
`;


// The details that give Serena its character
const details = `
/* Numbered eyebrows: 01 — Tratamientos */
.se-eyebrow{display:inline-flex;align-items:center;gap:.65rem}
.se-eyebrow-num{display:inline-flex;align-items:center;gap:.65rem;font-variant-numeric:tabular-nums;color:var(--muted-foreground);font-weight:500}
.se-eyebrow-num::after{content:"";width:1.75rem;height:1px;background:currentColor;opacity:.5}

/* Hand-drawn underline under the coloured word of the big titles */
.se-hero .se-em,.se-page-head .se-em{position:relative;white-space:nowrap}
.se-hero .se-em::after,.se-page-head .se-em::after{content:"";position:absolute;left:-2%;right:-2%;bottom:-.12em;height:.32em;background:var(--primary);opacity:.55;-webkit-mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 20' preserveAspectRatio='none'%3E%3Cpath d='M2 14 C 40 4, 90 2, 120 8 S 170 16, 198 6' fill='none' stroke='black' stroke-width='4' stroke-linecap='round'/%3E%3C/svg%3E") center/100% 100% no-repeat;mask:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 20' preserveAspectRatio='none'%3E%3Cpath d='M2 14 C 40 4, 90 2, 120 8 S 170 16, 198 6' fill='none' stroke='black' stroke-width='4' stroke-linecap='round'/%3E%3C/svg%3E") center/100% 100% no-repeat;transform-origin:left;animation:se-underline .9s .4s cubic-bezier(.65,0,.35,1) both}
@keyframes se-underline{from{transform:scaleX(0)}to{transform:scaleX(1)}}

/* Hero: a soft dot grid behind, the sticker on the photo */
.se-hero{position:relative;overflow:hidden}
.se-hero::before{content:"";position:absolute;inset:0;background-image:radial-gradient(color-mix(in srgb,var(--primary) 18%,transparent) 1px,transparent 1.5px);background-size:22px 22px;-webkit-mask:linear-gradient(90deg,transparent 40%,#000 75%);mask:linear-gradient(90deg,transparent 40%,#000 75%);opacity:.6;pointer-events:none}
.se-hero-grid{position:relative}
.se-sticker{position:absolute;right:-.75rem;bottom:5.5rem;width:7.25rem;height:7.25rem;border-radius:999px;background:#fff;color:var(--foreground);display:flex;align-items:center;justify-content:center;box-shadow:0 0 0 1px var(--border),0 18px 36px -18px rgba(20,32,28,.35);text-decoration:none;z-index:2;transition:transform .3s}
a.se-sticker:hover{transform:scale(1.05) rotate(-4deg)}
.se-sticker>svg{position:absolute;inset:0;width:100%;height:100%;animation:se-spin 22s linear infinite}
.se-sticker text{font-size:9.5px;font-weight:600;letter-spacing:.18em;text-transform:uppercase;fill:currentColor}
.se-sticker-core{display:flex;align-items:center;justify-content:center;width:2.9rem;height:2.9rem;border-radius:999px;background:var(--primary);color:var(--primary-contrast);font-family:var(--font-heading);font-weight:var(--heading-weight);font-size:.95rem}
@keyframes se-spin{to{transform:rotate(360deg)}}

/* Marquee of the clinic's treatments */
.se-marquee{overflow:hidden;margin-top:2.5rem;padding:1.1rem 0;border-block:1px solid var(--border);-webkit-mask:linear-gradient(90deg,transparent,#000 10%,#000 90%,transparent);mask:linear-gradient(90deg,transparent,#000 10%,#000 90%,transparent)}
.se-marquee-track{display:flex;width:max-content;animation:se-scroll 40s linear infinite}
.se-marquee ul{display:flex;list-style:none;margin:0;padding:0}
.se-marquee li{display:flex;align-items:center;gap:2rem;padding-right:2rem;white-space:nowrap;font-family:var(--font-heading);font-weight:var(--heading-weight);font-size:clamp(1.25rem,2.4vw,1.75rem);letter-spacing:-.015em;color:color-mix(in srgb,var(--foreground) 80%,transparent)}
.se-marquee li:nth-child(even){color:var(--primary)}
.se-marquee-dot{width:.55rem;height:.85rem;border-radius:.3rem;background:var(--primary);opacity:.35}
@keyframes se-scroll{to{transform:translateX(-50%)}}

/* Service cards: number in the corner, duration ring */
.se-service-top{display:flex;align-items:flex-start;justify-content:space-between}
.se-service-num{font-family:var(--font-heading);font-weight:var(--heading-weight);font-size:1.6rem;line-height:1;color:color-mix(in srgb,var(--primary) 22%,transparent);transition:color .25s}
.se-service:hover .se-service-num{color:var(--primary)}
.se-service-icon{transition:background .25s,color .25s}
.se-service:hover .se-service-icon{background:var(--primary);color:var(--primary-contrast)}
.se-ring{width:1.05rem;height:1.05rem;transform:rotate(-90deg)}
.se-ring circle{fill:none;stroke-width:2.5}
.se-ring-track{stroke:var(--border)}
.se-ring-fill{stroke:var(--primary);stroke-linecap:round}

/* Dotted texture on the first visit */
.se-dots{background-image:radial-gradient(color-mix(in srgb,var(--primary) 14%,transparent) 1px,transparent 1.5px);background-size:24px 24px;background-color:var(--tint)}
.se-visit-icon{background:#fff;transition:transform .3s}
.se-visit li:hover .se-visit-icon{transform:translateY(-3px) rotate(-6deg)}

/* Quote card */
.se-quote{position:relative;margin:0 0 1rem;padding:1.75rem 1.75rem 1.5rem;border-radius:1.25rem;background:var(--primary);color:var(--primary-contrast);overflow:hidden}
.se-quote::after{content:"";position:absolute;right:-3rem;top:-3rem;width:9rem;height:9rem;border-radius:999px;border:1.5rem solid currentColor;opacity:.07}
.se-quote-mark{width:2rem;height:1.5rem;fill:currentColor;opacity:.45;margin-bottom:.85rem}
.se-quote blockquote{margin:0 0 1.25rem;font-family:var(--font-heading);font-weight:var(--heading-weight);font-size:clamp(1.2rem,2.2vw,1.45rem);line-height:1.35;letter-spacing:-.01em}
.se-quote figcaption{display:flex;align-items:center;gap:.75rem;font-size:.88rem;opacity:.9}
.se-quote .se-stack .ui-avatar{box-shadow:0 0 0 2.5px var(--primary)}

/* Team: the bio appears over the portrait on hover */
.se-portrait-bio{position:absolute;inset:auto 0 0 0;display:flex;align-items:flex-end;min-height:55%;padding:1.25rem 1.25rem 3.25rem;background:linear-gradient(0deg,rgba(10,16,14,.82),transparent);color:#fff;font-size:.92rem;line-height:1.5;opacity:0;transform:translateY(8px);transition:opacity .3s,transform .3s}
.se-person:hover .se-portrait-bio{opacity:1;transform:none}
@media (hover:none){.se-portrait-bio{display:none}}

/* FAQ: talk to the team */
.se-ask{margin-top:1.75rem;padding:1.25rem;border:1px solid var(--border);border-radius:1.1rem;background:var(--tint)}
.se-ask p{display:flex;flex-direction:column;gap:.2rem;margin:.85rem 0 1rem!important;max-width:none!important}
.se-ask strong{color:var(--foreground);font-weight:600}
.se-ask span{font-size:.92rem}
.se-ask-actions{display:flex;flex-wrap:wrap;gap:.5rem}
.se-ask .ui-btn{border-radius:999px;background:#fff}
.se-ask .se-stack .ui-avatar{box-shadow:0 0 0 2.5px var(--tint)}

/* Footer: the clinic's name, big */
.se-footer{overflow:hidden;padding-bottom:0}
.se-wordmark{margin:2.5rem 0 0;padding:0 1rem;font-family:var(--font-heading);font-weight:var(--heading-weight);font-size:clamp(3rem,12vw,10.5rem);line-height:.8;letter-spacing:-.05em;white-space:nowrap;text-align:center;color:transparent;-webkit-text-stroke:1px rgba(255,255,255,.14);transform:translateY(.12em)}

@media (max-width:39.99rem){
  .se-sticker{width:5.75rem;height:5.75rem;right:-.25rem;bottom:4.5rem}
  .se-sticker text{font-size:11px}
  .se-sticker-core{width:2.3rem;height:2.3rem}
}
`;

export default uiCss + serena + details;
