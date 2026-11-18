import type { ReactNode } from "react";
import { Paragraphs, SocialLinks } from "../shared/blocks.js";
import { cn } from "../shared/cn.js";
import {
  firstSentence,
  formatDuration,
  formatPrice,
  hoursByDay,
  initials,
  openStatus,
  paragraphs,
  spainNow,
  telHref,
  whatsappHref,
} from "../shared/format.js";
import { ServiceIcon } from "../shared/icons.js";
import { pageAvailable } from "../shared/pages.js";
import { ArrowRight } from "../shared/ui.js";
import type { SitePageProps, SiteService, SiteTeamMember } from "../types.js";

// Zen: a calm, airy site. Paper tones, big serif titles with one word in
// italics, lots of space and a few quiet details drawn in the clinic's
// colour: a brush circle (ensō) that breathes, ripples, slow waves and a
// curved path for the first visit. No JavaScript: the motion is CSS and stops
// for visitors who ask for reduced motion (style.ts, render.tsx)

type P = { props: SitePageProps };

export function Wrap({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-[84rem] px-6 md:px-12", className)}>{children}</div>;
}

// ---------- Drawn details ----------

// A brush circle. The brush texture is the #zen-brush filter (Layout.tsx);
// "draw" paints it in once when the page opens
// "bold" for small marks (logo, monograms); large ones use a finer brush
export function Enso({ className, draw, bold }: { className?: string; draw?: boolean; bold?: boolean }) {
  return (
    <svg viewBox="0 0 200 200" className={cn("zen-enso block w-full", draw && "zen-draw", className)} fill="none" stroke="currentColor" strokeLinecap="round" aria-hidden="true">
      <g filter="url(#zen-brush)">
        <path d="M72.6 24.8A80 80 0 1 1 34.5 54.1" strokeWidth={bold ? 9 : 3.4} pathLength={1} />
        <path d="M89.4 24.7A76 76 0 1 1 25.7 84.2" strokeWidth={bold ? 2.4 : 1.1} pathLength={1} opacity=".45" />
      </g>
    </svg>
  );
}

// A sine wave as an SVG path, sampled every `step` units
export const sine = (width: number, period: number, amp: number, mid: number, phase = 0, step = 10) => {
  let d = "";
  for (let x = 0; x <= width; x += step) {
    const y = mid - amp * Math.sin((2 * Math.PI * (x + phase)) / period);
    d += `${x === 0 ? "M" : "L"}${x} ${y.toFixed(1)}`;
  }
  return d;
};

// Three slow lines drifting sideways. The track is twice as wide and every
// period divides half of it, so the loop has no seam
export function Waves({ className }: { className?: string }) {
  return (
    <div className={cn("pointer-events-none overflow-hidden", className)} aria-hidden="true">
      <svg viewBox="0 0 2400 120" preserveAspectRatio="none" className="zen-waves block h-full w-[200%]" fill="none" stroke="currentColor">
        <path d={sine(2400, 600, 16, 38, 0, 12)} vectorEffect="non-scaling-stroke" opacity=".55" />
        <path d={sine(2400, 1200, 26, 62, 150, 12)} vectorEffect="non-scaling-stroke" opacity=".35" />
        <path d={sine(2400, 400, 10, 88, 80, 12)} vectorEffect="non-scaling-stroke" opacity=".25" />
      </svg>
    </div>
  );
}

// A pebble dropped in still water: rings that fade in and out, one after the other
export function Ripples({ className, rings = 7 }: { className?: string; rings?: number }) {
  return (
    <svg viewBox="0 0 400 400" className={cn("zen-ripples", className)} fill="none" stroke="currentColor" aria-hidden="true">
      {Array.from({ length: rings }, (_, i) => (
        <circle key={i} cx="200" cy="200" r={22 + i * 26} vectorEffect="non-scaling-stroke" style={{ animationDelay: `${i * 0.9}s`, opacity: 1 - i / (rings + 1) }} />
      ))}
      <circle cx="200" cy="200" r="5" fill="currentColor" stroke="none" />
    </svg>
  );
}

// "Inspira… espira": a dot that grows and shrinks at the pace of a slow breath
export function BreathCue({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-3 text-[.72rem] tracking-[.24em] text-muted uppercase", className)} aria-hidden="true">
      <span className="relative flex size-6 items-center justify-center">
        <span className="zen-breath-ring absolute inset-0 rounded-full border border-(--zen-accent)" />
        <span className="size-1.5 rounded-full bg-(--zen-accent)" />
      </span>
      <span className="grid">
        <span className="zen-breath-in [grid-area:1/1]">Inspira</span>
        <span className="zen-breath-out [grid-area:1/1]">Espira</span>
      </span>
    </span>
  );
}

// ---------- Type ----------

// The last word of a title in italics ("…de Valencia" keeps its "de")
export function splitAccent(text: string): [string, string] {
  const words = text.trim().split(/\s+/);
  if (words.length < 2) return ["", text.trim()];
  const n = words.length > 2 && words[words.length - 2]!.length <= 3 ? 2 : 1;
  return [words.slice(0, -n).join(" "), words.slice(-n).join(" ")];
}

export function Accent({ text }: { text: string }) {
  const [head, tail] = splitAccent(text);
  return (
    <>
      {head && <>{head} </>}
      <em className="zen-em">{tail}</em>
    </>
  );
}

// Section label: its number in roman numerals (a CSS counter, so missing
// sections never leave a gap), a hairline and the name
export function Eyebrow({ children, numbered = true, center, className }: { children: ReactNode; numbered?: boolean; center?: boolean; className?: string }) {
  return (
    <p className={cn("m-0 flex items-center gap-4 text-[.7rem] tracking-[.28em] text-muted uppercase", center && "justify-center", className)}>
      {numbered && <span className="zen-num" aria-hidden="true" />}
      <span className="h-px w-10 bg-(--zen-stone)" aria-hidden="true" />
      <span>{children}</span>
      {center && <span className="h-px w-10 bg-(--zen-stone)" aria-hidden="true" />}
    </p>
  );
}

export function SectionHead({ label, title, intro, className }: { label: string; title: ReactNode; intro?: string; className?: string }) {
  return (
    <header className={cn("zen-reveal mb-16 grid gap-8 md:mb-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,25rem)] lg:items-end lg:gap-20", className)}>
      <div>
        <Eyebrow>{label}</Eyebrow>
        <h2 className="zen-h2 mt-8 mb-0 max-w-[15ch] text-[clamp(2.6rem,5.4vw,5rem)]">{typeof title === "string" ? <Accent text={title} /> : title}</h2>
      </div>
      {intro && <p className="m-0 text-[1.05rem] leading-[1.8] text-muted">{intro}</p>}
    </header>
  );
}

// ---------- Links ----------

export function Pill({ href, children, tone = "solid", size = "lg", className }: { href: string; children: ReactNode; tone?: "solid" | "line"; size?: "lg" | "sm"; className?: string }) {
  return (
    <a
      href={href}
      className={cn(
        "group inline-flex items-center rounded-full no-underline transition-colors duration-500",
        size === "lg" ? "h-14 gap-4 pr-2 pl-7 text-[.95rem]" : "h-11 gap-3 pr-1.5 pl-5 text-[.86rem]",
        tone === "solid" ? "bg-ink text-(--zen-paper) hover:bg-(--zen-accent)" : "border border-(--zen-stone) text-ink hover:border-ink",
        className,
      )}
    >
      {children}
      <span
        className={cn(
          "flex items-center justify-center rounded-full transition-transform duration-500 group-hover:translate-x-0.5",
          size === "lg" ? "size-10" : "size-8",
          tone === "solid" ? "bg-white/12" : "bg-ink text-(--zen-paper)",
        )}
      >
        <ArrowRight />
      </span>
    </a>
  );
}

// Text with a line that grows on hover
export function TextLink({ href, children, className, external }: { href: string; children: ReactNode; className?: string; external?: boolean }) {
  return (
    <a
      href={href}
      className={cn("zen-link inline-flex items-center gap-3 text-[.95rem] text-ink no-underline", className)}
      {...(external ? { target: "_blank", rel: "noopener" } : {})}
    >
      <span>{children}</span>
      <span className="zen-link-line" aria-hidden="true" />
    </a>
  );
}

// ---------- Status ----------

export const statusOf = (props: SitePageProps) => (props.content.sections.hours ? openStatus(props.hours) : null);

export function Status({ props, className }: P & { className?: string }) {
  const s = statusOf(props);
  if (!s) return null;
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className={cn("zen-dot", s.open && "zen-dot-open")} aria-hidden="true" />
      {s.label}
    </span>
  );
}

export function HoursList({ hours, className, compact }: { hours: SitePageProps["hours"]; className?: string; compact?: boolean }) {
  const today = spainNow().weekday;
  return (
    <ul className={cn("m-0 list-none p-0", className)}>
      {hoursByDay(hours).map((d, i) => {
        const isToday = i + 1 === today;
        return (
          <li key={d.label} className={cn("flex items-baseline justify-between gap-6 border-b border-(--zen-stone)/70 py-3 last:border-0", isToday ? "text-ink" : "text-muted")}>
            <span className="flex items-baseline gap-3 whitespace-nowrap">
              {d.label}
              {isToday && (compact ? <span className="size-1.5 self-center rounded-full bg-(--zen-accent)" title="Hoy" /> : <span className="zen-serif text-[1.05rem] text-(--zen-accent) italic">hoy</span>)}
            </span>
            <span className="text-right tabular-nums">{d.ranges.length ? d.ranges.join("  ·  ") : "Cerrado"}</span>
          </li>
        );
      })}
    </ul>
  );
}

// ---------- Sections ----------

// The cover photo in a soft dome. Without one, the clinic's first sentence
// over still-water ripples
export function CoverDome({ props }: P) {
  const { content, img } = props;
  const src = img(content.coverId);
  const quote = content.sections.about ? firstSentence(content.about?.text) : "";
  if (!src && !quote) return null;
  return (
    <section className="px-3 md:px-6" aria-label={src ? "El centro" : undefined}>
      <div className="zen-dome relative h-[min(80vh,48rem)] min-h-[26rem] overflow-hidden bg-(--zen-sand)">
        {src ? (
          <img src={src} alt="" className="zen-parallax absolute inset-0 size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center px-8">
            <Ripples className="absolute top-1/2 left-1/2 w-[64rem] max-w-none -translate-x-1/2 -translate-y-1/2 text-(--zen-accent) opacity-40" />
            <p className="zen-serif relative m-0 max-w-[22ch] text-center text-[clamp(1.9rem,3.8vw,3.4rem)] leading-[1.15] text-ink">“{quote}”</p>
          </div>
        )}
      </div>
    </section>
  );
}

// "Nosotros": the title stays put while the text scrolls; the first paragraph
// reads as a lead, the rest in two quiet columns
export function Philosophy({ props, more }: P & { more?: boolean }) {
  const { content, clinic, link } = props;
  const about = content.about;
  if (!content.sections.about || !about?.text) return null;
  const [lead, ...rest] = paragraphs(about.text);
  return (
    <section className="zen-section" id="nosotros">
      <Wrap className="grid gap-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-24">
        <div className="zen-reveal lg:sticky lg:top-36 lg:self-start">
          <Eyebrow>Nosotros</Eyebrow>
          <h2 className="zen-h2 mt-8 mb-0 text-[clamp(2.6rem,5vw,4.6rem)]">
            <Accent text={about.title || `Esto es ${clinic.name}`} />
          </h2>
        </div>
        <div className="zen-reveal lg:pt-28">
          <p className="zen-serif m-0 text-[clamp(1.55rem,2.4vw,2.1rem)] leading-[1.35] text-ink">{lead}</p>
          {rest.length > 0 && (
            <div className={cn("mt-12 grid gap-x-12 gap-y-5 leading-[1.85] text-muted", rest.length > 1 && "md:grid-cols-2")}>
              {rest.map((p, i) => (
                <p key={i} className="m-0">
                  {p}
                </p>
              ))}
            </div>
          )}
          {more && pageAvailable("nosotros", props) && <TextLink className="mt-12" href={link("/nosotros")}>Conoce el centro</TextLink>}
        </div>
      </Wrap>
    </section>
  );
}

const ROMAN = ["i", "ii", "iii", "iv", "v", "vi"];

// "Por qué nosotros" as a few principles under a hairline
export function Principles({ props, className }: P & { className?: string }) {
  const list = props.content.highlights;
  if (!list.length) return null;
  return (
    <section className={cn("pb-28 md:pb-44", className)} aria-label="Lo que nos importa">
      <Wrap>
        <p className="zen-reveal mb-8 text-[.7rem] tracking-[.28em] text-muted uppercase">Lo que nos importa</p>
        <ol className="m-0 grid list-none border-t border-(--zen-stone) p-0 md:grid-cols-3">
          {list.map((h, i) => (
            <li
              key={h.title}
              className="zen-reveal border-b border-(--zen-stone) py-10 md:border-b-0 md:border-l md:px-10 md:py-14 md:[&:nth-child(3n+1)]:border-l-0 md:[&:nth-child(3n+1)]:pl-0 md:[&:nth-child(n+4)]:border-t"
            >
              <span className="zen-serif block text-[3.4rem] leading-none text-(--zen-accent) italic">{ROMAN[i]}.</span>
              <h3 className="zen-h3 mt-8 mb-3 text-[1.75rem]">{h.title}</h3>
              {h.text && <p className="m-0 max-w-[24rem] leading-[1.8] text-muted">{h.text}</p>}
            </li>
          ))}
        </ol>
      </Wrap>
    </section>
  );
}

// The treatments as a quiet menu: icon, name, what it is, time and price
export function ServicesMenu({ props, services }: P & { services: SiteService[] }) {
  const { bookingUrl, link } = props;
  const href = bookingUrl ? link(bookingUrl) : undefined;
  return (
    <ul className="m-0 list-none border-t border-(--zen-stone) p-0">
      {services.map((s) => {
        const Row = href ? "a" : "div";
        return (
          <li key={s.name} className="zen-reveal border-b border-(--zen-stone)">
            <Row
              {...(href ? { href, "aria-label": `${s.name}: reservar cita` } : {})}
              className="group grid grid-cols-[auto_minmax(0,1fr)] gap-x-5 gap-y-4 py-9 text-ink no-underline md:grid-cols-[3.5rem_minmax(0,1fr)_auto] md:items-center md:gap-x-10 md:py-11"
            >
              <span className="flex size-12 items-center justify-center rounded-full border border-(--zen-stone) text-(--zen-accent) transition-colors duration-700 group-hover:border-transparent group-hover:bg-(--zen-wash) md:size-14">
                <ServiceIcon name={s.name} description={s.description} />
              </span>
              <div className="min-w-0 transition-transform duration-700 group-hover:translate-x-1.5">
                <h3 className="zen-h3 m-0 flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[clamp(1.6rem,2.6vw,2.3rem)] leading-[1.1]">
                  {s.name}
                  {s.isGroup && <span className="font-sans text-[.68rem] tracking-[.2em] text-(--zen-accent) uppercase not-italic">En grupo</span>}
                </h3>
                {s.description && <p className="mt-3 mb-0 max-w-[44rem] text-[.98rem] leading-[1.75] text-muted">{s.description}</p>}
              </div>
              <div className="col-start-2 flex items-center gap-6 md:col-start-auto md:justify-end">
                <span className="text-[.86rem] text-muted tabular-nums">{formatDuration(s.durationMinutes)}</span>
                <span className="zen-serif text-[1.8rem] leading-none tabular-nums">{formatPrice(s.priceCents)}</span>
                {href && (
                  <span className="hidden size-11 items-center justify-center rounded-full border border-(--zen-stone) transition-all duration-500 group-hover:border-ink group-hover:bg-ink group-hover:text-(--zen-paper) md:flex">
                    <ArrowRight />
                  </span>
                )}
              </div>
            </Row>
          </li>
        );
      })}
    </ul>
  );
}

// A breath between sections: one sentence and slow waves, on sand
export function Interlude({ children }: { children: ReactNode }) {
  return (
    <section className="px-3 md:px-6" aria-label="Nuestra forma de trabajar">
      <div className="relative overflow-hidden rounded-[2rem] bg-(--zen-sand) py-32 md:py-48">
        <Waves className="absolute inset-x-0 bottom-4 h-16 text-(--zen-accent) md:bottom-12 md:h-40" />
        <Wrap className="zen-reveal relative text-center">
          <Ripples rings={4} className="mx-auto mb-10 block w-24 text-(--zen-accent)" />
          <p className="zen-serif m-0 mx-auto max-w-[20ch] text-[clamp(2.2rem,4.8vw,4.4rem)] leading-[1.1] text-ink">{children}</p>
        </Wrap>
      </div>
    </section>
  );
}

const STEPS = [
  { title: "Escuchamos", text: "Nos cuentas qué te pasa, desde cuándo y qué te gustaría volver a hacer." },
  { title: "Valoramos", text: "Vemos cómo te mueves para encontrar el origen, no solo el síntoma." },
  { title: "Tratamos", text: "Terapia manual y ejercicio, adaptados a ti y a tu ritmo." },
  { title: "Te acompañamos", text: "Te llevas pautas para casa y seguimos tu evolución de cerca." },
];

// The first visit along a gentle curve: the dots sit on its crests and
// troughs (columns centred at 1/8, 3/8, 5/8, 7/8 of a wave of period 1/2).
// On phones, a straight line down
export function Journey() {
  return (
    <section className="zen-section">
      <Wrap>
        <SectionHead label="Tu primera visita" title="Así empezamos" intro="Sin prisas y sin tecnicismos. Esto es lo que pasa desde que entras por la puerta." />
        <div className="relative">
          <svg viewBox="0 0 1000 120" preserveAspectRatio="none" className="absolute inset-x-0 top-0 hidden h-[120px] w-full text-(--zen-accent) md:block" fill="none" stroke="currentColor" aria-hidden="true">
            <path d={sine(1000, 500, 40, 60, 0, 8)} vectorEffect="non-scaling-stroke" strokeWidth="1.25" pathLength={1} className="zen-trace" opacity=".45" />
          </svg>
          <ol className="relative m-0 grid list-none gap-14 p-0 before:absolute before:top-2 before:bottom-2 before:left-[23px] before:w-px before:bg-(--zen-stone) md:grid-cols-4 md:gap-0 md:before:hidden">
            {STEPS.map((s, i) => (
              <li key={s.title} className="zen-reveal relative pl-20 md:px-6 md:pt-[168px] md:text-center">
                <span
                  className={cn(
                    "zen-serif absolute top-0 left-0 flex size-12 items-center justify-center rounded-full border border-(--zen-stone) bg-(--zen-paper) text-[1.25rem] text-(--zen-accent) italic md:left-1/2 md:-translate-x-1/2",
                    i % 2 === 0 ? "md:top-[-4px]" : "md:top-[76px]",
                  )}
                >
                  {i + 1}
                </span>
                <h3 className="zen-h3 m-0 pt-2 text-[1.7rem] md:pt-0">{s.title}</h3>
                <p className="mt-3 mb-0 text-[.98rem] leading-[1.75] text-muted md:mx-auto md:max-w-[15rem]">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </Wrap>
    </section>
  );
}

function TeamMember({ member, full }: { member: SiteTeamMember; full?: boolean }) {
  return (
    <>
      <div className="zen-arch relative aspect-[4/5] overflow-hidden bg-(--zen-mist)">
        {member.photoUrl ? (
          <img src={member.photoUrl} alt={member.name} loading="lazy" className="zen-zoom size-full object-cover" />
        ) : (
          <div className="flex size-full items-center justify-center text-(--zen-accent)">
            <span className="absolute w-[64%] opacity-40">
              <Enso bold />
            </span>
            <span className="zen-serif relative text-[4.6rem] leading-none italic">{initials(member.name)}</span>
          </div>
        )}
      </div>
      <div className="mt-8">
        <h3 className="zen-h3 m-0 text-[1.95rem]">{member.name}</h3>
        {member.headline && <p className="mt-2 mb-0 text-[.7rem] tracking-[.22em] text-muted uppercase">{member.headline}</p>}
        {member.bio && <p className={cn("mt-5 mb-0 text-[.98rem] leading-[1.8] text-muted", !full && "line-clamp-3")}>{member.bio}</p>}
        {member.licenseNumber && <p className="mt-4 mb-0 text-[.8rem] text-muted/80">Nº de colegiado {member.licenseNumber}</p>}
      </div>
    </>
  );
}

// The team in arches; the middle column steps down so the row flows
export function Team({ props, full, max }: P & { full?: boolean; max?: number }) {
  const team = max ? props.team.slice(0, max) : props.team;
  return (
    <ul className="m-0 grid list-none gap-x-10 gap-y-20 p-0 sm:grid-cols-2 lg:grid-cols-3 lg:gap-x-14">
      {team.map((m, i) => (
        <li key={m.name} className={cn("zen-reveal", i % 3 === 1 && "lg:mt-28")}>
          <TeamMember member={m} full={full} />
        </li>
      ))}
    </ul>
  );
}


// Photos in a loose rhythm: every other column steps down, the middle one of
// each row of three is an arch
export function GalleryFlow({ images }: { images: string[] }) {
  return (
    <div className="grid grid-cols-2 gap-4 pb-12 md:grid-cols-3 md:gap-6 md:pb-24">
      {images.map((src, i) => (
        <figure
          key={src}
          className={cn(
            "zen-reveal m-0 aspect-[4/5] overflow-hidden even:translate-y-12 md:even:translate-y-0 md:[&:nth-child(3n+2)]:translate-y-24",
            i % 3 === 1 ? "zen-arch" : "rounded-[1.5rem]",
          )}
        >
          <img src={src} alt="" loading="lazy" className="zen-zoom block size-full object-cover" />
        </figure>
      ))}
    </div>
  );
}

// Questions: the title stays put, big serif questions open with a + that turns into ×
export function Questions({ props }: P) {
  const { faq, contact } = props.content;
  return (
    <section className="zen-section" id="preguntas">
      <Wrap className="grid gap-14 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-24">
        <div className="zen-reveal lg:sticky lg:top-36 lg:self-start">
          <Eyebrow>Preguntas</Eyebrow>
          <h2 className="zen-h2 mt-8 mb-0 text-[clamp(2.6rem,5vw,4.6rem)]">
            Lo que suelen <em className="zen-em">preguntarnos</em>
          </h2>
          {contact.phone && (
            <p className="mt-8 mb-0 max-w-[22rem] leading-[1.8] text-muted">
              ¿Te queda alguna duda? Llámanos al{" "}
              <a href={telHref(contact.phone)} className="whitespace-nowrap text-ink underline decoration-(--zen-stone) underline-offset-4">
                {contact.phone}
              </a>{" "}
              y te lo contamos sin compromiso.
            </p>
          )}
        </div>
        <div className="zen-reveal border-t border-(--zen-stone)">
          {faq.map((f) => (
            <details key={f.q} className="zen-faq border-b border-(--zen-stone)">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-8 py-7 [&::-webkit-details-marker]:hidden">
                <span className="zen-serif text-[clamp(1.4rem,2vw,1.8rem)] leading-[1.25] text-ink">{f.q}</span>
                <span className="zen-plus" aria-hidden="true" />
              </summary>
              <div className="pr-4 pb-8 leading-[1.8] text-muted md:pr-20">
                <Paragraphs text={f.a} className="m-0 mb-3 last:mb-0" />
              </div>
            </details>
          ))}
        </div>
      </Wrap>
    </section>
  );
}

// Where and when: the address as the title, how to reach us, the week's hours
export function Visit({ props, numbered = true }: P & { numbered?: boolean }) {
  const { content, hours } = props;
  const c = content.contact;
  const place = [c.postalCode, c.city].filter(Boolean).join(" ");
  const showHours = content.sections.hours && hours.length > 0;
  const rows = [
    c.phone && { label: "Teléfono", value: c.phone, href: telHref(c.phone) },
    c.whatsapp && { label: "WhatsApp", value: "Escríbenos", href: whatsappHref(c.whatsapp), external: true },
    c.email && { label: "Email", value: c.email, href: `mailto:${c.email}` },
  ].filter((r): r is { label: string; value: string; href: string; external?: boolean } => !!r);
  if (!c.address && !rows.length && !showHours) return null;

  return (
    <section className="zen-section" id="contacto">
      <div className="relative mx-3 overflow-hidden rounded-[2rem] bg-(--zen-sand) py-24 md:mx-6 md:py-32">
        <Ripples className="pointer-events-none absolute -top-40 -right-40 w-[34rem] text-(--zen-accent) opacity-30" />
        <Wrap className="relative grid gap-16 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-24">
          <div className="zen-reveal">
            <Eyebrow numbered={numbered}>Visítanos</Eyebrow>
            <h2 className="zen-h2 mt-8 mb-0 text-[clamp(2.4rem,4.8vw,4.4rem)]">
              {c.address ? (
                <>
                  {c.address}
                  {place && (
                    <>
                      <br />
                      <em className="zen-em">{place}</em>
                    </>
                  )}
                </>
              ) : (
                <>
                  Ven a <em className="zen-em">vernos</em>
                </>
              )}
            </h2>
            {c.mapsUrl && (
              <TextLink className="mt-8" href={c.mapsUrl} external>
                Cómo llegar
              </TextLink>
            )}
            {rows.length > 0 && (
              <dl className="m-0 mt-14 grid max-w-[34rem] border-t border-(--zen-stone)">
                {rows.map((r) => (
                  <div key={r.label} className="grid grid-cols-[7rem_minmax(0,1fr)] items-baseline gap-4 border-b border-(--zen-stone) py-4">
                    <dt className="text-[.7rem] tracking-[.22em] text-muted uppercase">{r.label}</dt>
                    <dd className="m-0 min-w-0">
                      <a href={r.href} className="zen-serif text-[1.45rem] break-words text-ink no-underline hover:text-(--zen-accent)" {...(r.external ? { target: "_blank", rel: "noopener" } : {})}>
                        {r.value}
                      </a>
                    </dd>
                  </div>
                ))}
              </dl>
            )}
            <div className="zen-social">
              <SocialLinks content={content} />
            </div>
          </div>
          {showHours && (
            <div className="zen-reveal lg:pt-24">
              <p className="m-0 mb-5 text-[.7rem] tracking-[.28em] text-muted uppercase">Horario</p>
              <Status props={props} className="mb-6 text-[.95rem] text-ink" />
              <HoursList hours={hours} className="text-[.95rem]" />
            </div>
          )}
        </Wrap>
      </div>
    </section>
  );
}

// The last word: a big invitation inside a breathing ensō
export function Closing({ props }: P) {
  const { bookingUrl, link, content } = props;
  const phone = content.contact.phone;
  if (!bookingUrl && !phone) return null;
  return (
    <section className="relative overflow-hidden py-36 text-center md:py-56">
      <div className="zen-breathe pointer-events-none absolute top-1/2 left-1/2 w-[min(42rem,115vw)] -translate-x-1/2 -translate-y-1/2 text-(--zen-accent) opacity-25">
        <Enso draw />
      </div>
      <Wrap className="zen-reveal relative">
        <Eyebrow numbered={false} center>
          Tu cita
        </Eyebrow>
        <h2 className="zen-h2 mx-auto mt-8 mb-0 max-w-[12ch] text-[clamp(3rem,7.6vw,7.2rem)]">
          Tómate un momento <em className="zen-em">para ti.</em>
        </h2>
        <p className="mx-auto mt-8 mb-0 max-w-[30rem] text-[1.05rem] leading-[1.8] text-muted">
          {bookingUrl ? "Elige día y hora en un minuto. Si lo prefieres, llámanos y lo vemos juntos." : "Llámanos y buscamos juntos el mejor momento."}
        </p>
        <div className="mt-12 flex flex-wrap items-center justify-center gap-x-10 gap-y-6">
          {bookingUrl && <Pill href={link(bookingUrl)}>Reservar cita</Pill>}
          {phone && <TextLink href={telHref(phone)}>Llamar al {phone}</TextLink>}
        </div>
      </Wrap>
    </section>
  );
}

// Inner pages open with a centred title, a faint ensō and a drop falling
// down a thin line into the content
export function PageHead({ label, title, lead }: { label: string; title: ReactNode; lead?: string }) {
  return (
    <section className="relative overflow-hidden pt-20 pb-20 text-center md:pt-32 md:pb-28">
      <div className="pointer-events-none absolute top-[44%] left-1/2 w-[min(36rem,105vw)] -translate-x-1/2 -translate-y-1/2 text-(--zen-accent) opacity-20">
        <Enso draw />
      </div>
      <Wrap className="relative">
        <div className="zen-rise">
          <Eyebrow numbered={false} center>
            {label}
          </Eyebrow>
        </div>
        <h1 className="zen-h1 zen-rise zen-rise-2 mx-auto mt-8 mb-0 max-w-[14ch] text-[clamp(3rem,8vw,7.4rem)]">{typeof title === "string" ? <Accent text={title} /> : title}</h1>
        {lead && <p className="zen-rise zen-rise-3 mx-auto mt-8 mb-0 max-w-[34rem] text-[1.1rem] leading-[1.8] text-muted">{lead}</p>}
        <span className="zen-drop mx-auto mt-14 block h-24 w-px bg-(--zen-stone)" aria-hidden="true" />
      </Wrap>
    </section>
  );
}
