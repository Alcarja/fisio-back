// Clara's CSS. A TS string so tsc copies it to dist with the rest.
// Uses the variables set in render.tsx from the clinic's choices: --primary,
// --primary-contrast, --primary-soft, --accent, --font-heading, --font-body,
// --heading-weight. Never hard-code the clinic's colour here.
export default `
.cl-wrap { width: 100%; max-width: 72rem; margin: 0 auto; padding: 0 1.25rem; }
.cl-narrow { max-width: 46rem; }
.cl-center { text-align: center; margin-top: 2rem; }

/* Header */
.cl-header { position: sticky; top: 0; z-index: 10; background: rgba(255,255,255,.92);
  backdrop-filter: saturate(1.4) blur(8px); border-bottom: 1px solid var(--line); }
.cl-header-row { display: flex; align-items: center; justify-content: space-between; gap: 1rem; min-height: 4rem; }
.cl-brand { font-family: var(--font-heading); font-weight: var(--heading-weight); font-size: 1.25rem;
  color: var(--ink); text-decoration: none; }
.cl-logo { display: block; max-height: 2.75rem; max-width: 11rem; width: auto; object-fit: contain; }

/* Buttons */
.cl-btn { display: inline-flex; align-items: center; justify-content: center; gap: .5rem;
  min-height: 3rem; padding: 0 1.5rem; border-radius: 999px; background: var(--primary);
  color: var(--primary-contrast); font-weight: 600; text-decoration: none; border: 2px solid var(--primary);
  transition: filter .15s; }
.cl-btn:hover { filter: brightness(1.08); }
.cl-btn:focus-visible, a:focus-visible, summary:focus-visible { outline: 3px solid var(--accent); outline-offset: 3px; }
.cl-btn-small { min-height: 2.5rem; padding: 0 1.1rem; font-size: .95rem; }
.cl-btn-ghost { background: transparent; color: var(--primary); }

/* Hero */
.cl-hero { padding: 3.5rem 0 3rem; background: linear-gradient(180deg, var(--primary-soft), #fff 85%); }
.cl-hero-grid { display: grid; gap: 2rem; align-items: center; }
.cl-hero h1 { font-size: clamp(2.2rem, 6vw, 3.75rem); margin: 0 0 1rem; }
.cl-lead { font-size: 1.15rem; color: var(--muted); max-width: 36rem; margin: 0 0 1.75rem; }
.cl-actions { display: flex; flex-wrap: wrap; gap: .75rem; }
.cl-hero-img { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; border-radius: 1.75rem; }

/* Sections */
.cl-section { padding: 4rem 0; }
.cl-tint { background: var(--primary-soft); }
.cl-section h2 { font-size: clamp(1.75rem, 4vw, 2.5rem); margin: 0 0 2rem; }
.cl-h-icon { display: flex; align-items: center; gap: .6rem; }
.cl-h-icon .icon { width: 1.5rem; height: 1.5rem; color: var(--primary); }
.cl-meta { color: var(--muted); margin: .25rem 0 0; }
.cl-small { color: var(--muted); font-size: .85rem; margin: .25rem 0 0; }

.cl-highlights { list-style: none; padding: 0; margin: 0; display: grid; gap: 1.5rem; }
.cl-highlights li { display: flex; gap: 1rem; align-items: flex-start; }
.cl-highlights h3 { margin: 0; font-size: 1.1rem; }
.cl-highlights p { margin: .35rem 0 0; color: var(--muted); }
.cl-check { flex: none; display: flex; align-items: center; justify-content: center; width: 2.25rem; height: 2.25rem;
  border-radius: 999px; background: var(--primary); color: var(--primary-contrast); }
.cl-check .icon { width: 1.1rem; height: 1.1rem; }

.cl-card { background: #fff; border: 1px solid var(--line); border-radius: 1.25rem; padding: 1.5rem; }
.cl-services { list-style: none; padding: 0; margin: 0; display: grid; gap: 1rem; }
.cl-service-head { display: flex; justify-content: space-between; gap: 1rem; align-items: baseline; }
.cl-service-head h3 { margin: 0; font-size: 1.15rem; }
.cl-price { font-weight: 600; color: var(--primary); white-space: nowrap; }
.cl-card p:not(.cl-meta) { margin: .75rem 0 0; color: var(--muted); }

.cl-team { list-style: none; padding: 0; margin: 0; display: grid; gap: 2rem; }
.cl-person { text-align: center; }
.cl-person h3 { margin: 1rem 0 0; font-size: 1.15rem; }
.cl-avatar { width: 9rem; height: 9rem; border-radius: 999px; object-fit: cover; margin: 0 auto; display: block; }
.cl-avatar-empty { display: flex; align-items: center; justify-content: center; background: var(--primary-soft);
  color: var(--primary); font-family: var(--font-heading); font-size: 3rem; }
.cl-bio { color: var(--muted); text-align: left; margin: .75rem 0 0; }

.cl-gallery { list-style: none; padding: 0; margin: 0; display: grid; grid-template-columns: repeat(2, 1fr); gap: .75rem; }
.cl-gallery img { width: 100%; aspect-ratio: 1; object-fit: cover; border-radius: 1rem; display: block; }

.cl-faq { border-bottom: 1px solid var(--line); padding: 1rem 0; }
.cl-faq summary { cursor: pointer; font-weight: 600; font-size: 1.05rem; list-style: none;
  display: flex; justify-content: space-between; gap: 1rem; }
.cl-faq summary::-webkit-details-marker { display: none; }
.cl-faq summary::after { content: "+"; color: var(--primary); font-size: 1.4rem; line-height: 1; }
.cl-faq[open] summary::after { content: "–"; }
.cl-faq p { color: var(--muted); margin: .75rem 0 0; }

.cl-contact-grid { display: grid; gap: 3rem; }

/* Footer */
.cl-footer { background: var(--ink); color: rgba(255,255,255,.85); padding: 3rem 0 2rem; }
.cl-footer a { color: #fff; }
.cl-footer-grid { display: grid; gap: 2rem; }
.cl-footer-name { font-family: var(--font-heading); font-weight: var(--heading-weight); font-size: 1.35rem; color: #fff; margin: 0 0 1rem; }

/* Booking and legal pages */
.cl-page { padding: 3rem 0 4rem; }
.cl-page h1 { font-size: clamp(2rem, 5vw, 3rem); margin: 0 0 1.5rem; }

@media (min-width: 48rem) {
  .cl-hero { padding: 5rem 0 4.5rem; }
  .cl-hero-photo .cl-hero-grid { grid-template-columns: 1.1fr 1fr; }
  .cl-highlights { grid-template-columns: repeat(2, 1fr); }
  .cl-services { grid-template-columns: repeat(2, 1fr); }
  .cl-team { grid-template-columns: repeat(3, 1fr); }
  .cl-gallery { grid-template-columns: repeat(4, 1fr); }
  .cl-contact-grid { grid-template-columns: 1fr 1fr; }
  .cl-footer-grid { grid-template-columns: 1fr 1fr; align-items: end; }
  .cl-section { padding: 5.5rem 0; }
}
`;
