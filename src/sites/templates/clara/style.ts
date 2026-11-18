// Clara: bold, modern, a little aggressive, with its own structure (tile
// hero, split services board, team rail, dark timeline, bento, "Hablemos").
// Thick ink outlines, hard offset shadows, heavy type, blocks of the clinic's
// colour, the health cross. Only the palette variables from render.tsx.
const clara = `
:root{
  --ink:#121513;--paper:#ffffff;--muted:#565d5a;--line:var(--ink);
  --background:#fff;--foreground:var(--ink);--card:#fff;--card-foreground:var(--ink);
  --muted-foreground:#565d5a;--border:var(--ink);--secondary:var(--primary-tint);--secondary-foreground:var(--ink);
  --primary-foreground:var(--primary-contrast);--ring:var(--primary);--radius:.75rem;
  --tint:color-mix(in srgb,var(--primary) 9%,#fff);
  --stroke:2.5px solid var(--ink);
  --hard:5px 5px 0 var(--ink);
  --heavy:calc(var(--heading-weight) + 150)
}
body{background:var(--paper);color:var(--ink)}
h1,h2,h3{font-weight:var(--heavy);color:var(--ink)}
::selection{background:var(--primary);color:var(--primary-contrast)}
a:focus-visible,summary:focus-visible{outline:3px solid var(--primary);outline-offset:3px;border-radius:6px}
.cl-plus{width:1em;height:1em;fill:currentColor;flex:none}
.kf-contact a{color:inherit;font-weight:600;text-decoration:none}
.kf-contact a:hover{text-decoration:underline;text-decoration-thickness:2px;text-decoration-color:var(--primary)}
.kf-contact .icon{color:inherit}
.kf-social a{border:2px solid currentColor;opacity:1}
.kf-social a:hover{background:var(--primary);color:var(--primary-contrast);border-color:var(--primary)}
@keyframes cl-spin{to{transform:rotate(360deg)}}

/* Rhythm and type */
.cl-section{padding:4.5rem 0}
.cl-section h2,.cl-timeline h2{font-size:clamp(2.1rem,5vw,3.6rem);line-height:.98;letter-spacing:-.045em;margin:0}
.cl-actions{display:flex;flex-wrap:wrap;gap:.85rem}
.cl-tag{display:inline-flex;align-items:center;gap:.6rem;margin:0 0 1.1rem;font-size:.78rem;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:inherit}
.cl-tag span{color:var(--primary)}
mark.cl-mark{display:inline-block;background:var(--primary);color:var(--primary-contrast);padding:0 .14em .04em;margin:0 .02em;border-radius:.12em;transform:rotate(-1.6deg);box-shadow:.06em .06em 0 var(--ink);line-height:1.05}

/* Buttons */
.cl-btn{display:inline-flex;align-items:center;justify-content:center;gap:.55rem;height:3.25rem;padding:0 1.4rem;border:var(--stroke);border-radius:.8rem;background:var(--primary);color:var(--primary-contrast);font-weight:800;font-size:.98rem;text-decoration:none;white-space:nowrap;box-shadow:4px 4px 0 var(--ink);transition:transform .12s,box-shadow .12s}
.cl-btn:hover{transform:translate(2px,2px);box-shadow:2px 2px 0 var(--ink)}
.cl-btn:active{transform:translate(4px,4px);box-shadow:0 0 0 var(--ink)}
.cl-btn .icon{width:1.1rem;height:1.1rem}
.cl-btn-paper{background:#fff;color:var(--ink)}
.cl-btn-ink{background:var(--ink);color:#fff}
.cl-arrow{display:inline-flex;align-items:center;gap:.7rem;font-weight:800;color:var(--ink);text-decoration:none;white-space:nowrap}
.cl-arrow>span{display:flex;align-items:center;justify-content:center;width:2.4rem;height:2.4rem;border-radius:999px;border:var(--stroke);background:var(--primary);color:var(--primary-contrast);transition:transform .2s}
.cl-arrow:hover>span{transform:rotate(-45deg)}
.cl-chip{display:inline-flex;align-items:center;height:1.6rem;padding:0 .65rem;border-radius:999px;border:1.5px solid currentColor;font-size:.78rem;font-weight:700;white-space:nowrap}
.cl-chip-solid{background:var(--ink);color:#fff;border-color:var(--ink)}

/* Status */
.cl-status{display:inline-flex;align-items:center;gap:.5rem;height:2.1rem;padding:0 .85rem;border:2px solid var(--ink);border-radius:999px;background:#fff;color:var(--ink);font-size:.82rem;font-weight:800;white-space:nowrap}
.cl-status>span{width:.55rem;height:.55rem;border-radius:999px;background:#9aa19e}
.cl-status-open>span{background:#18b26b;box-shadow:0 0 0 3px rgba(24,178,107,.25);animation:cl-blink 1.8s ease-in-out infinite}
@keyframes cl-blink{50%{box-shadow:0 0 0 6px rgba(24,178,107,0)}}

/* Header: a floating pill */
.cl-header{position:sticky;top:.75rem;z-index:50;margin-top:.75rem}
.cl-pill{display:flex;align-items:center;justify-content:space-between;gap:1rem;height:4rem;padding:0 .5rem 0 .6rem;background:#fff;border:var(--stroke);border-radius:999px;box-shadow:var(--hard)}
.cl-brand{display:flex;align-items:center;gap:.65rem;color:var(--ink);text-decoration:none;min-width:0}
.cl-logo{display:block;max-height:2.5rem;max-width:10rem;object-fit:contain;margin-left:.5rem}
.cl-brand-mark{display:flex;align-items:center;justify-content:center;width:2.75rem;height:2.75rem;border-radius:999px;background:var(--ink);color:var(--primary);font-size:1.2rem;flex:none;transition:transform .4s}
.cl-brand:hover .cl-brand-mark{transform:rotate(90deg)}
.cl-brand-name{font-family:var(--font-heading);font-weight:var(--heavy);font-size:1.15rem;letter-spacing:-.03em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.cl-brand-invert{color:#fff}
.cl-brand-invert .cl-brand-mark{background:var(--primary);color:var(--primary-contrast)}
.cl-nav{display:none;gap:.25rem}
.cl-nav a{padding:.55rem 1rem;border-radius:999px;color:var(--ink);font-weight:700;font-size:.94rem;text-decoration:none;transition:background .15s}
.cl-nav a:hover{background:var(--tint)}
.cl-nav a[aria-current=page]{background:var(--ink);color:#fff}
.cl-pill-end{display:flex;align-items:center;gap:.4rem;flex:none}
.cl-pill-cta{display:inline-flex;align-items:center;gap:.5rem;height:3rem;padding:0 1.1rem 0 1.3rem;border-radius:999px;background:var(--primary);color:var(--primary-contrast);border:var(--stroke);font-weight:800;text-decoration:none}
.cl-pill-cta .cl-plus{transition:transform .4s}
.cl-pill-cta:hover .cl-plus{transform:rotate(180deg)}
.cl-mobile{position:relative}
.cl-menu-btn{list-style:none;display:flex;align-items:center;justify-content:center;width:3rem;height:3rem;border:var(--stroke);border-radius:999px;cursor:pointer;background:#fff}
.cl-menu-btn::-webkit-details-marker{display:none}
.cl-mobile[open] .cl-menu-btn{background:var(--ink);color:#fff}
.cl-mobile-panel{position:absolute;right:0;top:calc(100% + .9rem);width:min(18rem,calc(100vw - 2.5rem));display:flex;flex-direction:column;gap:.25rem;padding:.6rem;background:#fff;border:var(--stroke);border-radius:1.25rem;box-shadow:var(--hard)}
.cl-mobile-panel>a:not(.cl-btn){padding:.75rem .9rem;border-radius:.7rem;color:var(--ink);font-weight:800;text-decoration:none}
.cl-mobile-panel>a:not(.cl-btn):hover{background:var(--tint)}
.cl-mobile-panel>a[aria-current=page]{background:var(--ink);color:#fff}
.cl-mobile-panel .cl-btn{margin-top:.3rem}

/* Hero: giant headline over a grid of tiles */
.cl-hero{padding:2.75rem 0 3.5rem}
.cl-hero-top{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:.75rem}
.cl-hero-top .cl-tag{margin:0}
.cl-hero-title{font-size:clamp(2.35rem,9.2vw,8.4rem);line-height:.9;letter-spacing:-.06em;margin:1.5rem 0 2.5rem;max-width:14ch}
.cl-hero-tiles{display:grid;gap:1rem}
.cl-tile{position:relative;display:flex;flex-direction:column;padding:1.5rem;border:var(--stroke);border-radius:1.5rem;background:#fff;color:var(--ink);box-shadow:var(--hard);text-decoration:none;overflow:hidden}
a.cl-tile{transition:transform .15s,box-shadow .15s}
a.cl-tile:hover{transform:translate(-3px,-3px);box-shadow:8px 8px 0 var(--ink)}
.cl-tile-photo{padding:0;aspect-ratio:4/3;background:var(--primary)}
.cl-tile-photo img{width:100%;height:100%;object-fit:cover;display:block}
.cl-tile-art{align-items:center;justify-content:center;color:var(--primary-contrast)}
.cl-art-monogram{font-family:var(--font-heading);font-weight:var(--heavy);font-size:clamp(5rem,14vw,10rem);letter-spacing:-.06em;line-height:1}
.cl-art-plus{position:absolute;animation:cl-spin 18s linear infinite}
.cl-art-plus-a{top:12%;left:9%;font-size:3rem;color:var(--ink)}
.cl-art-plus-b{bottom:10%;right:10%;font-size:5.5rem;opacity:.3;animation-direction:reverse}
.cl-art-plus-c{top:14%;right:16%;font-size:1.6rem}
.cl-sticker{position:absolute;left:1rem;bottom:1rem;display:inline-flex;align-items:center;gap:.45rem;height:2.6rem;padding:0 1rem;border:var(--stroke);border-radius:999px;background:#fff;color:var(--ink);font-size:.86rem;font-weight:800;box-shadow:3px 3px 0 var(--ink);transform:rotate(-4deg)}
.cl-sticker .icon{width:1.05rem;height:1.05rem;color:var(--primary)}
.cl-tile-intro{justify-content:space-between;gap:1.5rem;background:var(--tint)}
.cl-tile-intro p{margin:0;font-size:clamp(1.15rem,1.9vw,1.4rem);font-weight:600;line-height:1.45}
.cl-faces{display:inline-flex;align-items:center;gap:.75rem;font-weight:800;font-size:.95rem}
.cl-faces-stack{display:flex}
.cl-faces-stack .ui-avatar{margin-left:-.6rem;border:2px solid var(--ink);width:2.4rem;height:2.4rem}
.cl-faces-stack .ui-avatar:first-child{margin-left:0}
.cl-faces-stack .ui-avatar-fallback{background:var(--primary);color:var(--primary-contrast);font-weight:800;font-size:.72rem}
.cl-tile-icon{display:flex;align-items:center;justify-content:center;width:2.9rem;height:2.9rem;border-radius:.8rem;border:2px solid currentColor;margin-bottom:auto}
.cl-tile-icon .icon{width:1.3rem;height:1.3rem}
.cl-tile-big{margin-top:1.75rem;font-family:var(--font-heading);font-weight:var(--heavy);font-size:clamp(1.6rem,2.6vw,2.2rem);line-height:1;letter-spacing:-.04em}
.cl-tile-small{font-size:.9rem;font-weight:600;opacity:.8;margin-top:.4rem}
.cl-tile-call .cl-tile-small{margin-top:1.75rem}
.cl-tile-call .cl-tile-big{margin-top:.25rem}
.cl-tile-book{background:var(--primary);color:var(--primary-contrast)}
.cl-tile-call{background:var(--ink);color:#fff}
.cl-tile-go{position:absolute;top:1.25rem;right:1.25rem;display:flex;align-items:center;justify-content:center;width:2.75rem;height:2.75rem;border-radius:999px;background:var(--ink);color:#fff;transition:transform .25s}
.cl-tile-go .ui-icon{width:1.2rem;height:1.2rem}
.cl-tile-book:hover .cl-tile-go{transform:rotate(45deg)}

/* Ticker */
.cl-ticker{overflow:hidden;background:var(--ink);color:#fff;padding:1.1rem 0;border-block:var(--stroke)}
.cl-ticker-track{display:flex;width:max-content;animation:cl-scroll 32s linear infinite}
.cl-ticker ul{display:flex;list-style:none;margin:0;padding:0}
.cl-ticker li{display:flex;align-items:center;gap:1.5rem;padding-right:1.5rem;white-space:nowrap;font-family:var(--font-heading);font-weight:var(--heavy);font-size:clamp(1.3rem,2.6vw,2rem);letter-spacing:-.02em;text-transform:uppercase}
.cl-ticker .cl-plus{color:var(--primary);font-size:.8em}
@keyframes cl-scroll{to{transform:translateX(-50%)}}

/* Services: sticky column + board */
.cl-split{display:grid;gap:2.5rem;align-items:start}
.cl-split-aside h2{margin-bottom:1rem}
.cl-split-lead{margin:0 0 1.5rem;color:var(--muted)}
.cl-split-facts{display:grid;grid-template-columns:1fr 1fr;gap:.75rem;margin:0 0 1.75rem}
.cl-split-facts>div{padding:1rem 1.1rem;border:var(--stroke);border-radius:1rem;background:var(--tint)}
.cl-split-facts>div:last-child{background:var(--primary);color:var(--primary-contrast)}
.cl-split-facts dt{font-size:.75rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase;opacity:.75}
.cl-split-facts dd{margin:.2rem 0 0;font-family:var(--font-heading);font-weight:var(--heavy);font-size:2.2rem;line-height:1;letter-spacing:-.05em}
.cl-jump{display:flex;flex-direction:column;margin:0 0 1.75rem;border-top:var(--stroke)}
.cl-jump a{display:flex;justify-content:space-between;align-items:center;padding:.85rem 0;border-bottom:var(--stroke);color:var(--ink);font-weight:800;text-decoration:none}
.cl-jump a span{display:flex;align-items:center;justify-content:center;min-width:1.9rem;height:1.9rem;border-radius:999px;background:var(--ink);color:#fff;font-size:.8rem}
.cl-jump a:hover span{background:var(--primary);color:var(--primary-contrast)}
.cl-board{list-style:none;margin:0;padding:0;border-bottom:var(--stroke)}
.cl-board li{border-top:var(--stroke)}
.cl-board-row{display:grid;grid-template-columns:2rem 1fr auto;grid-template-areas:"num main price" "num main go";gap:.35rem 1rem;align-items:center;padding:1.35rem .5rem;color:var(--ink);text-decoration:none;transition:background .2s,color .2s,padding .2s}
.cl-board-num{grid-area:num;align-self:start;padding-top:.4rem;font-weight:800;font-size:.85rem;color:var(--primary);font-variant-numeric:tabular-nums}
.cl-board-icon{display:none}
.cl-board-main{grid-area:main;display:flex;flex-direction:column;gap:.4rem;min-width:0}
.cl-board-name{font-family:var(--font-heading);font-weight:var(--heavy);font-size:clamp(1.35rem,2.6vw,1.95rem);line-height:1.05;letter-spacing:-.035em}
.cl-board-desc{font-size:.95rem;color:var(--muted);max-width:36rem}
.cl-board-clamp{display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;overflow:hidden}
.cl-board-meta{display:flex;flex-wrap:wrap;gap:.4rem;margin-top:.15rem}
.cl-board-price{grid-area:price;font-family:var(--font-heading);font-weight:var(--heavy);font-size:clamp(1.3rem,2.4vw,1.8rem);letter-spacing:-.03em;white-space:nowrap;text-align:right}
.cl-board-go{grid-area:go;justify-self:end;display:flex;align-items:center;justify-content:center;width:2.6rem;height:2.6rem;border-radius:999px;border:2px solid currentColor;transition:transform .25s,background .2s}
.cl-board-go .ui-icon{width:1.15rem;height:1.15rem}
a.cl-board-row:hover{background:var(--primary);color:var(--primary-contrast);padding-left:1.1rem;padding-right:1.1rem}
a.cl-board-row:hover .cl-board-num,a.cl-board-row:hover .cl-board-desc{color:inherit}
a.cl-board-row:hover .cl-board-go{transform:rotate(45deg);background:var(--ink);color:#fff;border-color:var(--ink)}
.cl-group{scroll-margin-top:7rem}
.cl-group+.cl-group{margin-top:3rem}
.cl-group-title{font-size:1.4rem!important;letter-spacing:-.03em!important;margin:0 0 1rem!important}

/* Team rail */
.cl-team-section{background:var(--tint);border-block:var(--stroke);overflow:hidden}
.cl-rail-head{display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:1.5rem;margin-bottom:2.25rem}
.cl-rail-head>p{margin:0;max-width:22rem;font-weight:600;color:var(--muted)}
.cl-rail{list-style:none;margin:0;padding:.25rem .5rem 1.75rem .25rem;display:grid;grid-auto-flow:column;grid-auto-columns:minmax(14.5rem,18rem);gap:1.25rem;overflow-x:auto;scroll-snap-type:x mandatory;scrollbar-width:thin;scrollbar-color:var(--ink) transparent}
.cl-rail>li{scroll-snap-align:start}
.cl-rail-card{background:#fff;border:var(--stroke);border-radius:1.4rem;overflow:hidden;box-shadow:var(--hard);transition:transform .2s}
.cl-rail-card:nth-child(even){transform:translateY(1.25rem)}
.cl-rail-card:hover{transform:translateY(-4px) rotate(-1deg)}
.cl-rail-card h3{margin:1rem 1.15rem 0;font-size:1.35rem;letter-spacing:-.035em}
.cl-rail-card .cl-role{margin:.2rem 1.15rem 1.25rem}
.cl-rail-more a{display:flex;flex-direction:column;justify-content:flex-end;gap:.4rem;height:100%;min-height:18rem;padding:1.5rem;border:var(--stroke);border-radius:1.4rem;background:var(--primary);color:var(--primary-contrast);text-decoration:none;box-shadow:var(--hard);transition:transform .2s}
.cl-rail-more a:hover{transform:translate(-3px,-3px)}
.cl-rail-more .cl-plus{font-size:3rem;margin-bottom:auto;color:var(--ink);transition:transform .4s}
.cl-rail-more a:hover .cl-plus{transform:rotate(90deg)}
.cl-rail-more strong{font-family:var(--font-heading);font-weight:var(--heavy);font-size:1.6rem;line-height:1.05;letter-spacing:-.035em}
.cl-rail-more span{font-weight:700;font-size:.9rem;opacity:.85}
.cl-portrait{position:relative;aspect-ratio:4/5;background:var(--primary);overflow:hidden;border-bottom:var(--stroke)}
.cl-portrait img{width:100%;height:100%;object-fit:cover;display:block}
.cl-portrait-initials{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;font-family:var(--font-heading);font-weight:var(--heavy);font-size:5rem;letter-spacing:-.05em;color:var(--primary-contrast)}
.cl-badge{position:absolute;left:.8rem;bottom:.8rem;display:inline-flex;align-items:center;gap:.35rem;height:2rem;padding:0 .75rem;border:2px solid var(--ink);border-radius:999px;background:#fff;font-size:.76rem;font-weight:800;transform:rotate(-3deg)}
.cl-badge .icon{width:.95rem;height:.95rem;color:var(--primary)}
.cl-role{font-weight:700;color:var(--primary);font-size:.92rem}

/* Timeline (dark) */
.cl-timeline{position:relative;overflow:hidden;background:var(--ink);color:#fff;padding:5rem 0}
.cl-timeline h2{color:#fff}
.cl-timeline mark.cl-mark{box-shadow:.06em .06em 0 #fff}
.cl-timeline-plus{position:absolute;right:-5rem;top:-5rem;font-size:24rem;color:var(--primary);opacity:.12;animation:cl-spin 50s linear infinite}
.cl-timeline-head{position:relative;margin-bottom:3.5rem}
.cl-timeline-list{position:relative;list-style:none;margin:0;padding:0;display:grid;gap:2.5rem}
.cl-timeline-list li{position:relative;padding-left:4.25rem}
.cl-timeline-num{position:absolute;right:0;top:-.5rem;font-family:var(--font-heading);font-weight:var(--heavy);font-size:3.5rem;line-height:1;color:transparent;-webkit-text-stroke:1.5px rgba(255,255,255,.28)}
.cl-timeline-dot{position:absolute;left:0;top:0;display:flex;align-items:center;justify-content:center;width:3rem;height:3rem;border-radius:999px;background:var(--primary);color:var(--primary-contrast);border:2.5px solid #fff}
.cl-timeline-dot .icon{width:1.3rem;height:1.3rem}
.cl-timeline-list h3{margin:0 0 .45rem;color:#fff;font-size:1.45rem;letter-spacing:-.03em}
.cl-timeline-list p{margin:0;color:rgba(255,255,255,.7);max-width:20rem}
.cl-timeline-cta{position:relative;margin-top:3.5rem}
.cl-timeline .cl-btn{box-shadow:4px 4px 0 #fff;border-color:#fff}
.cl-timeline .cl-btn:hover{box-shadow:2px 2px 0 #fff}

/* "Así somos" bento */
.cl-bento-head{margin-bottom:2.5rem}
.cl-bento{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(2,1fr);grid-auto-flow:dense;gap:1rem}
.cl-bento>li{position:relative;display:flex;flex-direction:column;padding:1.4rem;border:var(--stroke);border-radius:1.4rem;background:#fff;box-shadow:var(--hard);overflow:hidden;min-height:10rem}
.cl-bento-quote{grid-column:span 2;justify-content:space-between;gap:1.5rem;background:var(--primary)!important;color:var(--primary-contrast)}
.cl-bento-quote blockquote{margin:0;font-family:var(--font-heading);font-weight:var(--heavy);font-size:clamp(1.6rem,3vw,2.5rem);line-height:1.06;letter-spacing:-.04em}
.cl-bento-quote>span{font-weight:800;font-size:.9rem;opacity:.85}
.cl-bento-quote-plus{position:absolute;right:-1.5rem;bottom:-1.5rem;font-size:8rem;color:var(--ink);opacity:.18;animation:cl-spin 24s linear infinite}
.cl-bento-stat{justify-content:flex-end}
.cl-bento-stat strong{font-family:var(--font-heading);font-weight:var(--heavy);font-size:clamp(3rem,6vw,4.6rem);line-height:.9;letter-spacing:-.06em;color:var(--primary)}
.cl-bento-stat span{margin-top:.4rem;font-weight:700;color:var(--muted)}
.cl-bento-stat-ink{background:var(--ink)!important;color:#fff}
.cl-bento-stat-ink strong{color:#fff}
.cl-bento-stat-ink span{color:rgba(255,255,255,.7)}
.cl-bento-hl{gap:.4rem;background:var(--tint)!important}
.cl-bento-hl-num{font-weight:800;font-size:.8rem;color:var(--primary);margin-bottom:auto;padding-bottom:1rem}
.cl-bento-hl strong{font-family:var(--font-heading);font-weight:var(--heavy);font-size:1.3rem;line-height:1.1;letter-spacing:-.03em}
.cl-bento-hl>span:last-child{font-size:.92rem;color:var(--muted)}
.cl-bento-photo{padding:0!important;min-height:12rem}
.cl-bento-photo img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.cl-bento-wide{grid-column:span 2}
.cl-bento-text{grid-column:span 2;justify-content:space-between;gap:1.25rem}
.cl-bento-text p{margin:0;font-size:1.05rem;color:var(--muted)}

/* "Hablemos": FAQ + console */
.cl-talk h2{margin-bottom:2rem}
.cl-talk-grid{display:grid;gap:2.5rem;align-items:start}
.cl-talk-solo{max-width:52rem}
.cl-accordion{gap:.75rem}
.cl-accordion .ui-accordion-item{border:var(--stroke);border-radius:1rem;background:#fff;transition:box-shadow .2s,background .2s}
.cl-accordion .ui-accordion-item[open]{background:var(--tint);box-shadow:var(--hard)}
.cl-accordion .ui-accordion-trigger{padding:1.15rem 1.25rem;font-size:1.08rem;font-weight:800;align-items:center}
.cl-accordion .ui-accordion-trigger:hover{color:var(--ink)}
.cl-accordion .ui-chevron{margin:0;width:1.9rem;height:1.9rem;padding:.4rem;border-radius:999px;background:var(--ink);color:#fff;flex:none}
.cl-accordion .ui-accordion-item[open] .ui-chevron{background:var(--primary);color:var(--primary-contrast)}
.cl-accordion .ui-accordion-content{padding:0 1.25rem 1.25rem;color:var(--muted)}
.cl-console{border:var(--stroke);border-radius:1.5rem;background:#fff;box-shadow:8px 8px 0 var(--ink);overflow:hidden}
.cl-console-top{display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:.75rem;padding:1rem 1.25rem;background:var(--ink);color:#fff}
.cl-console-label{display:inline-flex;align-items:center;gap:.5rem;font-size:.78rem;font-weight:800;letter-spacing:.14em;text-transform:uppercase}
.cl-console-label .cl-plus{color:var(--primary)}
.cl-console-address{display:flex;flex-direction:column;gap:.6rem;padding:1.4rem 1.25rem;background:var(--primary);color:var(--primary-contrast);border-bottom:var(--stroke)}
.cl-console-address strong{font-family:var(--font-heading);font-weight:var(--heavy);font-size:clamp(1.4rem,2.6vw,1.9rem);line-height:1.08;letter-spacing:-.035em}
.cl-console-address a{display:inline-flex;align-items:center;gap:.45rem;align-self:flex-start;height:2.2rem;padding:0 .9rem;border-radius:999px;background:var(--ink);color:#fff;font-weight:800;font-size:.86rem;text-decoration:none}
.cl-console-address a .icon{width:1rem;height:1rem}
.cl-console-body{display:grid;gap:1.5rem;padding:1.4rem 1.25rem}
.cl-console-body .kf-contact{align-content:start}
.cl-console-actions{display:flex;flex-wrap:wrap;gap:.65rem;padding:1.25rem;border-top:var(--stroke);background:var(--tint)}
.cl-console-actions .cl-btn{height:2.9rem;padding:0 1.1rem;font-size:.92rem}
.cl-hours{list-style:none;margin:0;padding:0}
.cl-hours li{display:flex;justify-content:space-between;gap:1rem;padding:.55rem .7rem;border-bottom:1.5px dashed color-mix(in srgb,var(--ink) 22%,transparent);font-size:.92rem}
.cl-hours li:last-child{border-bottom:0}
.cl-hours li>span:last-child{font-variant-numeric:tabular-nums;text-align:right;font-weight:700}
.cl-hours .cl-today{background:var(--ink);color:#fff;border-radius:.55rem;border-bottom-color:transparent;font-weight:800}
.cl-hours .cl-today>span:first-child::after{content:" · hoy";color:var(--primary)}
.cl-hours .cl-closed>span:last-child{color:var(--muted);font-weight:500}

/* Inner page header */
.cl-page-head{padding:3rem 0 3.5rem;border-bottom:var(--stroke);background:linear-gradient(180deg,#fff,var(--tint))}
.cl-page-head-grid{display:grid;gap:2rem;align-items:end}
.cl-page-head h1{font-size:clamp(2.8rem,7.4vw,6.4rem);line-height:.92;letter-spacing:-.06em;margin:0}
.cl-page-head-side{position:relative;padding:1.4rem 1.4rem 3.75rem;border:var(--stroke);border-radius:1.4rem;background:#fff;box-shadow:var(--hard)}
.cl-page-head-side p{margin:1rem 0 0;color:var(--muted);font-weight:500}
.cl-page-head .ui-breadcrumb-list{font-weight:700;color:var(--ink)}
.cl-page-head .ui-breadcrumb-page{color:var(--primary)}
.cl-page-num{position:absolute;right:1.1rem;bottom:.6rem;font-family:var(--font-heading);font-weight:var(--heavy);font-size:2.6rem;line-height:1;letter-spacing:-.05em;color:transparent;-webkit-text-stroke:1.5px var(--ink)}

/* Equipo page: zig-zag */
.cl-zigzag{display:grid;gap:4rem}
.cl-zig{display:grid;gap:1.75rem;align-items:center}
.cl-zig .cl-portrait{max-width:26rem;width:100%;border:var(--stroke);border-radius:1.5rem;box-shadow:8px 8px 0 var(--ink)}
.cl-zig:nth-child(odd) .cl-portrait{transform:rotate(-1.5deg)}
.cl-zig:nth-child(even) .cl-portrait{transform:rotate(1.5deg)}
.cl-zig-num{font-family:var(--font-heading);font-weight:var(--heavy);font-size:3rem;line-height:1;color:transparent;-webkit-text-stroke:1.5px var(--ink)}
.cl-zig-text h2{font-size:clamp(2.2rem,5vw,3.8rem)!important;margin:.5rem 0 .5rem!important}
.cl-zig-role{display:inline-block;margin:0 0 1.25rem;padding:.35rem .85rem;border:2px solid var(--ink);border-radius:999px;background:var(--primary);color:var(--primary-contrast);font-weight:800;font-size:.9rem}
.cl-zig-bio{margin:0 0 .85rem;font-size:1.1rem;line-height:1.7;color:var(--muted);max-width:34rem}

/* Nosotros page */
.cl-story{display:grid;gap:2rem;align-items:start}
.cl-story-quote{display:flex;flex-direction:column;gap:1rem;margin:0;font-family:var(--font-heading);font-weight:var(--heavy);font-size:clamp(1.9rem,4vw,3.2rem);line-height:1.04;letter-spacing:-.045em}
.cl-story-quote .cl-plus{font-size:2.5rem;color:var(--primary)}
.cl-prose p{margin:0 0 1.15rem;font-size:1.1rem;line-height:1.75;color:var(--muted)}

/* Footer: call to action band + dark footer */
.cl-cta{position:relative;overflow:hidden;background:var(--primary);color:var(--primary-contrast);border-top:var(--stroke);padding:4.5rem 0}
.cl-cta-inner{position:relative;display:grid;gap:2rem;align-items:end}
.cl-cta-big{margin:0;font-family:var(--font-heading);font-weight:var(--heavy);font-size:clamp(2.8rem,8.5vw,6.8rem);line-height:.9;letter-spacing:-.055em;text-transform:uppercase}
.cl-cta-side p{margin:0 0 1.5rem;font-size:1.08rem;max-width:26rem;opacity:.9}
.cl-cta-plus{position:absolute;color:var(--ink);opacity:.14;animation:cl-spin 30s linear infinite}
.cl-cta-plus-a{font-size:18rem;right:-4rem;top:-5rem}
.cl-cta-plus-b{font-size:7rem;left:42%;bottom:-2.5rem;animation-direction:reverse}
.cl-footer{margin-top:0}
.cl-footer-dark{background:var(--ink);color:rgba(255,255,255,.7);padding:4rem 0 0;overflow:hidden;border-top:var(--stroke)}
.cl-footer-grid{display:grid;gap:2.5rem;padding-bottom:2.5rem;border-bottom:1px solid rgba(255,255,255,.14)}
.cl-footer-brand p{margin:1rem 0 0;max-width:22rem;font-size:.95rem}
.cl-footer-small{font-size:.82rem!important;opacity:.7}
.cl-footer-label{margin:0 0 1rem;font-size:.78rem;font-weight:800;letter-spacing:.14em;text-transform:uppercase;color:var(--primary-tint)}
.cl-footer-col{display:flex;flex-direction:column;gap:.55rem;font-size:.95rem}
.cl-footer-col>a{color:#fff;font-weight:700;text-decoration:none;width:fit-content}
.cl-footer-col>a:hover{color:var(--primary-tint)}
.cl-footer .kf-contact a{color:#fff}
.cl-footer .kf-contact .icon{color:var(--primary-tint)}
.cl-footer .cl-hours li{padding:.3rem 0;font-size:.86rem;border-bottom-color:rgba(255,255,255,.1)}
.cl-footer .cl-hours .cl-today{background:none;padding:.3rem 0;color:#fff}
.cl-footer .cl-hours .cl-today>span:first-child::after{content:none}
.cl-footer .cl-hours li>span:last-child{white-space:nowrap}
.cl-footer .cl-hours .cl-closed>span:last-child{color:rgba(255,255,255,.45)}
.cl-footer .kf-legal{margin-top:1.5rem;font-size:.84rem}
.cl-footer .kf-legal a{color:rgba(255,255,255,.75)}
.cl-wordmark{display:flex;align-items:center;justify-content:center;gap:.08em;margin:2.5rem 0 0;padding:0 1rem;font-family:var(--font-heading);font-weight:var(--heavy);font-size:clamp(3rem,11.5vw,10.5rem);line-height:.78;letter-spacing:-.06em;white-space:nowrap;color:var(--primary);transform:translateY(.1em)}
.cl-wordmark .cl-plus{font-size:.45em;color:#fff;align-self:flex-start;margin-top:.1em}

/* Booking (shared: pages/BookingPage.tsx) and legal pages */
.kf-page h1{font-weight:var(--heavy);font-size:clamp(2.6rem,6vw,4.4rem);letter-spacing:-.055em;line-height:.95}
.kf-booking{background:var(--tint);border-bottom:var(--stroke)}
.kf-booking-kicker{padding:.4rem .85rem;border:2px solid var(--ink);border-radius:999px;background:#fff;color:var(--ink);font-weight:800}
.kf-booking-kicker .icon{color:var(--primary)}
.kf-booking-card,.kf-booking-offline{border:var(--stroke);border-radius:1.25rem;box-shadow:var(--hard)}
.kf-booking-card h2{font-weight:var(--heavy);letter-spacing:-.03em;font-size:1.3rem}
.kf-booking-call{border-top:2px dashed color-mix(in srgb,var(--ink) 25%,transparent);color:var(--ink)}
.kf-booking .kf-status{border:2px solid var(--ink);border-radius:999px;padding:.25rem .75rem;font-weight:800}

@media (min-width:40rem){
  .cl-hero-tiles{grid-template-columns:repeat(2,1fr)}
  .cl-tile-photo{grid-column:1 / -1;aspect-ratio:16/9}
  .cl-tile-intro{grid-column:1 / -1}
  .cl-bento{grid-template-columns:repeat(3,1fr)}
  .cl-timeline-list{grid-template-columns:repeat(2,1fr)}
  .cl-console-big .cl-console-body{grid-template-columns:1fr 1fr}
  .cl-zig{grid-template-columns:.9fr 1.1fr;gap:3rem}
  .cl-zig:nth-child(even) .cl-portrait{order:2}
  .cl-footer-grid{grid-template-columns:repeat(2,1fr)}
  .cl-board-row{grid-template-columns:2.25rem 3rem 1fr auto auto;grid-template-areas:"num icon main price go";gap:1.25rem;padding:1.5rem .5rem}
  .cl-board-num{align-self:center;padding:0}
  .cl-board-icon{grid-area:icon;display:flex;align-items:center;justify-content:center;width:3rem;height:3rem;border-radius:.8rem;border:2px solid currentColor}
  .cl-board-icon .icon{width:1.35rem;height:1.35rem}
}
@media (min-width:64rem){
  .cl-nav{display:flex}
  .cl-mobile{display:none}
  .cl-section{padding:6.5rem 0}
  .cl-hero{padding-top:4rem}
  .cl-hero-tiles{grid-template-columns:1.35fr 1fr 1fr;grid-template-rows:auto auto}
  .cl-tile-photo{grid-column:1;grid-row:1 / 3;aspect-ratio:auto;min-height:27rem}
  .cl-tile-intro{grid-column:2 / 4;grid-row:1}
  .cl-tile-book{grid-column:2;grid-row:2;min-height:13rem}
  .cl-tile-call{grid-column:3;grid-row:2;min-height:13rem}
  .cl-split{grid-template-columns:20rem 1fr;gap:4rem}
  .cl-split-aside{position:sticky;top:7.5rem}
  .cl-bento{grid-template-columns:repeat(4,1fr);grid-auto-rows:minmax(12.5rem,auto)}
  .cl-bento-quote{grid-row:span 2}
  .cl-timeline{padding:7rem 0}
  .cl-timeline-list{grid-template-columns:repeat(4,1fr);gap:2rem;padding-top:2.5rem;border-top:2px solid rgba(255,255,255,.18)}
  .cl-timeline-list li{padding-left:0;padding-top:2.5rem}
  .cl-timeline-dot{top:-4rem}
  .cl-timeline-num{top:-3.2rem}
  .cl-talk-grid{grid-template-columns:1.1fr .9fr;gap:4rem}
  .cl-talk-side{position:sticky;top:7.5rem}
  .cl-console-big .cl-console-body{grid-template-columns:1fr 1.2fr}
  .cl-page-head{padding:4.5rem 0}
  .cl-page-head-grid{grid-template-columns:1.6fr .9fr;gap:3rem}
  .cl-story{grid-template-columns:1fr 1fr;gap:4.5rem}
  .cl-story-quote{position:sticky;top:7.5rem}
  .cl-cta{padding:6.5rem 0}
  .cl-cta-inner{grid-template-columns:1.4fr .6fr;gap:3rem}
  .cl-footer-grid{grid-template-columns:1.4fr .8fr 1.2fr 1.3fr;gap:3rem}
}
@media (max-width:39.99rem){
  .cl-pill-cta{display:none}
  .cl-pill{padding-right:.4rem}
}
`;

export default clara;
