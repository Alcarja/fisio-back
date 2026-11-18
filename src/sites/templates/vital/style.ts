// Vital: bold and sporty. Near-black and the clinic's colour, huge uppercase
// titles, a moving strip (still with "reduce motion"), diagonal cuts.
// Only the palette variables from render.tsx, never a hard-coded clinic colour.
export default `
:root{--night:#101413;--night-2:#181e1c}
body{background:#fff}
main{overflow-x:clip}
.vi-section{padding:4.5rem 0;position:relative}
.vi-section h2{font-size:clamp(2.6rem,8vw,5rem);line-height:.95;text-transform:uppercase;letter-spacing:-.03em;margin:0 0 2.5rem}
.vi-dot{color:var(--primary)}
.vi-dark{background:var(--night);color:rgba(255,255,255,.82)}
.vi-dark h2,.vi-dark h3{color:#fff}
.vi-accent{background:var(--primary);color:var(--primary-contrast)}
.vi-accent h2{color:inherit}
.vi-accent .vi-dot{color:inherit}
/* Inner page header */
.vi-page-head{background:var(--night);color:rgba(255,255,255,.75);padding:3.5rem 0 4rem}
.vi-page-head h1{color:#fff;font-size:clamp(3rem,11vw,7rem);line-height:.9;text-transform:uppercase;letter-spacing:-.04em;margin:1rem 0 1.25rem}
.vi-page-head .vi-lead{margin:0}
.vi-crumbs{margin:0;font-size:.8rem;text-transform:uppercase;letter-spacing:.14em}
.vi-crumbs a{color:var(--primary-tint);text-decoration:none}
.vi-nav a[aria-current=page]{opacity:1;color:var(--primary-tint)}
.vi-cut{clip-path:polygon(0 3rem,100% 0,100% calc(100% - 3rem),0 100%);padding:7rem 0}

/* Header */
.vi-header{position:sticky;top:0;z-index:20;background:var(--night);color:#fff}
.vi-header-row{display:flex;align-items:center;gap:1.5rem;min-height:4rem}
.vi-brand{font-family:var(--font-heading);font-weight:var(--heading-weight);font-size:1.2rem;text-transform:uppercase;letter-spacing:.02em;color:#fff;text-decoration:none;margin-right:auto}
.vi-logo{display:block;max-height:2.5rem;max-width:10rem;object-fit:contain;background:#fff;border-radius:.4rem;padding:.25rem .4rem}
.vi-nav{display:none;gap:1.75rem}
.vi-nav a{color:#fff;text-decoration:none;font-size:.85rem;text-transform:uppercase;letter-spacing:.1em;opacity:.7}
.vi-nav a:hover{opacity:1;color:var(--primary-tint)}

/* Buttons */
.vi-btn{white-space:nowrap;display:inline-flex;align-items:center;justify-content:center;gap:.55rem;min-height:3.2rem;padding:0 1.7rem;background:var(--primary);color:var(--primary-contrast);font-weight:700;text-transform:uppercase;letter-spacing:.06em;font-size:.92rem;text-decoration:none;border:2px solid var(--primary);border-radius:.35rem;transition:transform .15s,background .15s}
.vi-btn:hover{transform:translateY(-2px)}
.vi-btn .icon{width:1.05rem;height:1.05rem}
.vi-btn-sm{min-height:2.5rem;padding:0 1.1rem;font-size:.8rem}
.vi-btn-ghost{background:transparent;color:#fff;border-color:rgba(255,255,255,.5)}
.vi-btn-dark{background:var(--night);color:#fff;border-color:var(--night)}
a:focus-visible,summary:focus-visible{outline:3px solid var(--accent);outline-offset:3px}

/* Hero */
.vi-hero{position:relative;overflow:hidden;background:var(--night);color:#fff;padding:5rem 0 10rem;clip-path:polygon(0 0,100% 0,100% calc(100% - 2.5rem),0 100%)}
.vi-hero-photo{padding-bottom:6rem}
.vi-hero-bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.42;filter:grayscale(.35)}
.vi-hero-photo::before{content:"";position:absolute;inset:0;background:linear-gradient(90deg,var(--night) 10%,transparent 85%);z-index:1}
.vi-hero-mark{position:absolute;right:-2rem;bottom:-4rem;font-family:var(--font-heading);font-weight:var(--heading-weight);font-size:clamp(14rem,40vw,30rem);line-height:.8;letter-spacing:-.06em;color:var(--primary);opacity:.9;text-transform:uppercase;pointer-events:none}
.vi-hero-mark::after{content:"";position:absolute;left:-12%;top:12%;width:9rem;height:9rem;border-radius:999px;background:var(--accent);opacity:.85;mix-blend-mode:screen}
.vi-hero-inner{position:relative;z-index:2}
.vi-kicker{display:inline-block;margin:0 0 1.5rem;padding:.35rem .8rem;background:var(--primary);color:var(--primary-contrast);font-size:.8rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase}
.vi-hero h1{color:#fff;font-size:clamp(2.9rem,9.5vw,6.6rem);line-height:.92;text-transform:uppercase;letter-spacing:-.035em;margin:0 0 1.75rem;max-width:12ch}
.vi-lead{font-size:clamp(1.08rem,2.3vw,1.3rem);color:rgba(255,255,255,.8);max-width:34rem;margin:0 0 2.25rem}
.vi-actions{display:flex;flex-wrap:wrap;gap:.75rem}

/* Strip */
.vi-strip{overflow:hidden;background:var(--primary);color:var(--primary-contrast);padding:1.1rem 0;margin:-3.25rem -1rem 0;transform:rotate(-1.5deg);position:relative;z-index:3}
.vi-strip-track{display:flex;width:max-content;animation:vi-scroll 32s linear infinite}
.vi-strip ul{display:flex;list-style:none;margin:0;padding:0}
.vi-strip li{font-family:var(--font-heading);font-weight:var(--heading-weight);font-size:1.35rem;text-transform:uppercase;letter-spacing:.02em;white-space:nowrap;padding:0 1.5rem;display:flex;align-items:center;gap:3rem}
.vi-strip li::after{content:"✦";font-size:.9rem;opacity:.7}
@keyframes vi-scroll{to{transform:translateX(-50%)}}

/* Points */
.vi-points{list-style:none;padding:0;margin:0;display:grid;gap:2.5rem}
.vi-index{display:block;font-weight:700;color:var(--primary);letter-spacing:.06em;margin-bottom:.5rem}
.vi-points h3{margin:0;font-size:1.5rem;text-transform:uppercase;letter-spacing:-.01em}
.vi-points p{margin:.6rem 0 0;color:var(--muted)}

/* Service tiles */
.vi-tiles{list-style:none;padding:0;margin:0;display:grid;border-top:1px solid rgba(255,255,255,.14);border-left:1px solid rgba(255,255,255,.14)}
.vi-tiles li{position:relative;background:var(--night);padding:2rem 1.75rem 2.25rem;transition:background .2s;border-right:1px solid rgba(255,255,255,.14);border-bottom:1px solid rgba(255,255,255,.14)}
.vi-tiles li:hover{background:var(--primary-deep)}
.vi-tile-num{position:absolute;top:1.25rem;right:1.5rem;font-family:var(--font-heading);font-weight:var(--heading-weight);font-size:2.75rem;line-height:1;color:var(--primary);opacity:.8}
.vi-tiles h3{margin:0 3.5rem 0 0;font-size:1.45rem;text-transform:uppercase;letter-spacing:-.01em}
.vi-tile-meta{display:flex;align-items:center;gap:.5rem 1rem;flex-wrap:wrap;margin:.75rem 0 0;font-size:.85rem;text-transform:uppercase;letter-spacing:.08em;color:rgba(255,255,255,.6)}
.vi-tile-meta strong{color:#fff;font-size:1.05rem;letter-spacing:0}
.vi-tile-desc{margin:.9rem 0 0;color:rgba(255,255,255,.7)}

/* Team */
.vi-team{list-style:none;padding:0;margin:0;display:grid;gap:2.5rem 1.5rem}
.vi-photo{position:relative;aspect-ratio:4/5;overflow:hidden;background:var(--night-2);display:flex;align-items:center;justify-content:center}
.vi-photo img{width:100%;height:100%;object-fit:cover;display:block;filter:grayscale(1) contrast(1.05);transition:filter .3s,transform .3s}
.vi-team li:hover .vi-photo img{filter:none;transform:scale(1.03)}
.vi-photo span{font-family:var(--font-heading);font-weight:var(--heading-weight);font-size:5rem;color:var(--primary);text-transform:uppercase}
.vi-badge{position:absolute;left:0;bottom:0;margin:0;max-width:90%;padding:.45rem .8rem;background:var(--primary);color:var(--primary-contrast);font-size:.78rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em}
.vi-team h3{margin:1rem 0 0;font-size:1.35rem;text-transform:uppercase}
.vi-bio{color:var(--muted);margin:.6rem 0 0}
.vi-license{margin:.5rem 0 0;font-size:.8rem;letter-spacing:.06em;color:var(--muted);text-transform:uppercase}

/* About */
.vi-about{display:grid;gap:1.5rem}
.vi-about h2{margin:0}
.vi-about p{font-size:1.15rem;margin:0 0 1rem;opacity:.92}

/* Gallery: a full-width strip */
.vi-gallery-wrap{padding:0;margin-top:-3rem}
.vi-gallery{list-style:none;padding:0;margin:0;display:grid;grid-template-columns:repeat(2,1fr)}
.vi-gallery img{width:100%;aspect-ratio:1;object-fit:cover;display:block;filter:saturate(.9)}

/* FAQ */
.vi-faq-grid{display:grid;gap:1rem}
.vi-faq{border-bottom:2px solid var(--ink);padding:1.25rem 0}
.vi-faq:first-child{border-top:2px solid var(--ink)}
.vi-faq summary{cursor:pointer;list-style:none;font-weight:700;font-size:1.1rem;display:flex;justify-content:space-between;align-items:center;gap:1rem}
.vi-faq summary::-webkit-details-marker{display:none}
.vi-faq summary::after{content:"";flex:none;width:1.6rem;height:1.6rem;background:var(--primary);clip-path:polygon(45% 0,55% 0,55% 45%,100% 45%,100% 55%,55% 55%,55% 100%,45% 100%,45% 55%,0 55%,0 45%,45% 45%);transition:transform .2s}
.vi-faq[open] summary::after{transform:rotate(45deg)}
.vi-faq p{color:var(--muted);margin:.75rem 0 0}

/* Call to action */
.vi-cta{background:var(--primary);color:var(--primary-contrast);padding:4.5rem 0;text-align:left}
.vi-cta-big{font-family:var(--font-heading);font-weight:var(--heading-weight);font-size:clamp(3rem,11vw,7.5rem);line-height:.9;text-transform:uppercase;letter-spacing:-.04em;margin:0 0 2rem}

/* Contact */
.vi-contact{display:grid;gap:3rem}
.vi-hours{background:var(--night);color:rgba(255,255,255,.85);padding:2rem 1.75rem}
.vi-hours h3{color:#fff;text-transform:uppercase;margin:0 0 1rem;font-size:1.2rem}
.vi-hours .kf-hours th,.vi-hours .kf-hours td{border-color:rgba(255,255,255,.12)}
.vi-hours .kf-closed td{color:rgba(255,255,255,.45)}

/* Footer */
.vi-footer{background:var(--night);color:rgba(255,255,255,.72);padding:4rem 0 2rem}
.vi-footer a{color:#fff}
.vi-footer-name{font-family:var(--font-heading);font-weight:var(--heading-weight);font-size:clamp(2.4rem,9vw,6rem);line-height:.9;text-transform:uppercase;letter-spacing:-.04em;color:#fff;margin:0 0 2.5rem}
.vi-footer-grid{display:grid;gap:2rem;padding-bottom:2.5rem;margin-bottom:2rem;border-bottom:1px solid rgba(255,255,255,.12)}
.vi-footer .kf-footer-nav{font-size:.85rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase}
.vi-footer .kf-social{margin-top:0}

/* Booking and legal pages */
.kf-page h1{text-transform:uppercase;letter-spacing:-.03em}

@media (min-width:48rem){
  .vi-section{padding:6.5rem 0}
  .vi-cut{padding:9rem 0;clip-path:polygon(0 5rem,100% 0,100% calc(100% - 5rem),0 100%)}
  .vi-hero{padding:7rem 0 9rem}
  .vi-points{grid-template-columns:repeat(3,1fr);gap:3rem}
  .vi-tiles{grid-template-columns:repeat(2,1fr)}
  .vi-team{grid-template-columns:repeat(3,1fr)}
  .vi-about{grid-template-columns:.9fr 1.1fr;gap:4rem;align-items:start}
  .vi-gallery{grid-template-columns:repeat(4,1fr)}
  .vi-faq-grid{grid-template-columns:.8fr 1.2fr;gap:4rem}
  .vi-contact{grid-template-columns:1fr 1fr;align-items:start}
  .vi-footer-grid{grid-template-columns:1fr auto;align-items:end}
}
@media (min-width:64rem){
  .vi-nav{display:flex}
  .vi-tiles{grid-template-columns:repeat(3,1fr)}
}
`;
