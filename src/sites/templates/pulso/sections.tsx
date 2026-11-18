import type { ReactNode } from "react";
import { ContactList, Paragraphs } from "../shared/blocks.js";
import { cn } from "../shared/cn.js";
import {
  firstSentence,
  formatDuration,
  formatPrice,
  fullAddress,
  hoursByDay,
  initials,
  openStatus,
  paragraphs,
  spainNow,
} from "../shared/format.js";
import { ServiceIcon } from "../shared/icons.js";
import { Accordion, AccordionItem, ArrowRight, ArrowUpRight, Breadcrumb } from "../shared/ui.js";
import type { SitePageProps, SiteService, SiteTeamMember } from "../types.js";

// Pulso: an independent-studio look. Warm grain paper, cream rounded panels,
// a huge condensed uppercase headline (Anton) with its last words in a second
// colour, a solid circle in the clinic's colour blending over it, a condensed
// serif (Instrument Serif) for section titles and quotes, black pill buttons.
// Written with Tailwind; style.ts has the fonts, the grain and a few classes.

type P = { props: SitePageProps };

// ---------- Building blocks ----------

export function Wrap({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-[90rem] px-5 md:px-10", className)}>{children}</div>;
}

// A rounded panel inset from the page edges (dark or cream)
export function Panel({ tone, className, children, id }: { tone: "dark" | "cream"; className?: string; children: ReactNode; id?: string }) {
  return (
    <section id={id} className="px-2.5 md:px-5">
      <div className={cn("rounded-[1.75rem] py-20 md:py-28", tone === "dark" ? "bg-[#141414] text-[#f3f1ec]" : "bg-(--s8-cream) text-ink", className)}>
        {children}
      </div>
    </section>
  );
}

// The second colour (style.ts): the clinic's accent, or a colour opposite its
// main one when it has none
export const secondColorClass = (props: SitePageProps) => (props.content.theme.accent ? "s8-accent" : "s8-auto-accent");

// Two overlapping circles (the brand mark when there's no logo)
export function Mark({ className }: { className?: string }) {
  return (
    <span className={cn("relative inline-block h-[1.15em] w-[.75em]", className)} aria-hidden="true">
      <span className="absolute top-0 left-0 size-[.75em] rounded-full bg-(--s8-second)" />
      <span className="absolute bottom-0 left-0 size-[.75em] rounded-full bg-primary mix-blend-multiply" />
    </span>
  );
}

export function Chip({ children, tone = "ink" }: { children: ReactNode; tone?: "ink" | "dark" }) {
  return (
    <span
      className={cn(
        "inline-flex h-7 items-center rounded-full px-3 text-[.72rem] font-medium tracking-[.08em] whitespace-nowrap uppercase",
        tone === "ink" ? "bg-ink text-white" : "bg-white/10 text-white/80",
      )}
    >
      {children}
    </span>
  );
}

export function PillLink({
  href,
  children,
  tone = "ink",
  external,
}: {
  href: string;
  children: ReactNode;
  tone?: "ink" | "light" | "ghost";
  external?: boolean;
}) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener" } : {})}
      className={cn(
        "inline-flex h-12 items-center justify-center gap-2 rounded-full px-7 text-[.84rem] font-medium tracking-[.08em] whitespace-nowrap uppercase no-underline transition-colors duration-200",
        tone === "ink" && "bg-ink text-white hover:bg-primary hover:text-primary-foreground",
        tone === "light" && "bg-(--s8-cream) text-ink hover:bg-white",
        tone === "ghost" && "bg-white/10 text-white hover:bg-white/20",
      )}
    >
      {children}
    </a>
  );
}

export function ArrowLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a href={href} className={cn("group inline-flex items-center gap-2 text-[.95rem] font-medium text-inherit no-underline", className)}>
      {children}
      <span className="transition-transform duration-200 group-hover:translate-x-1">
        <ArrowRight />
      </span>
    </a>
  );
}

// Condensed serif, uppercase: section titles
export function SerifTitle({ children, className, as: Tag = "h2" }: { children: ReactNode; className?: string; as?: "h1" | "h2" | "p" }) {
  return <Tag className={cn("s8-serif m-0 text-[clamp(2.6rem,6vw,5.4rem)] leading-[.95] text-inherit uppercase", className)}>{children}</Tag>;
}

export const statusOf = (props: SitePageProps) => (props.content.sections.hours ? openStatus(props.hours) : null);

export function StatusLine({ props, className }: P & { className?: string }) {
  const status = statusOf(props);
  const city = props.content.contact.city;
  if (!status && !city) return null;
  return (
    <p className={cn("m-0 inline-flex items-center gap-2 text-[.8rem] text-[#6b6964]", className)}>
      <span className={cn("size-2 rounded-full", status?.open ? "bg-[#1fa971]" : "bg-primary")} aria-hidden="true" />
      {status ? status.label : `Fisioterapia en ${city}`}
      {status && city && <span className="opacity-70">· {city}</span>}
    </p>
  );
}

// Splits a title: everything dark but the last words, in the second colour
export function SplitTitle({ text }: { text: string }) {
  const words = text.trim().split(/\s+/);
  const tail = words.length > 3 ? 2 : 1;
  if (words.length < 2) return <>{text}</>;
  return (
    <>
      {words.slice(0, -tail).join(" ")} <span className="text-(--s8-second)">{words.slice(-tail).join(" ")}</span>
    </>
  );
}

// ---------- Treatments marquee (like a strip of client logos) ----------

export function NameStrip({ names }: { names: string[] }) {
  if (names.length < 3) return null;
  const row = [...names, ...names];
  return (
    <div className="s8-strip overflow-hidden py-10" aria-hidden="true">
      <div className="s8-strip-track flex w-max">
        {[0, 1].map((copy) => (
          <ul key={copy} className="m-0 flex list-none items-center gap-16 p-0 pr-16">
            {row.map((n, i) => (
              <li key={i} className="flex items-center gap-3 text-[clamp(1.5rem,2.4vw,2.1rem)] font-bold tracking-[-.02em] whitespace-nowrap text-[#3d3c39] opacity-80">
                <ServiceIcon name={n} className="size-[.9em]" />
                {n}
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}

// ---------- Treatments: project-style cards on the dark panel ----------

// Each card's tile gets one of these backgrounds, in turn
const TILES = [
  "linear-gradient(180deg, color-mix(in srgb, var(--primary) 92%, white), color-mix(in srgb, var(--primary) 55%, black))",
  "radial-gradient(70% 60% at 50% 100%, color-mix(in srgb, var(--s8-second) 80%, transparent), transparent), #16161f",
  "radial-gradient(60% 70% at 30% 30%, color-mix(in srgb, var(--s8-second) 55%, white), transparent), radial-gradient(60% 70% at 70% 80%, color-mix(in srgb, var(--primary) 45%, white), transparent), #f1eee8",
  "linear-gradient(160deg, #1d2b3a, #0f1720)",
];

export function ServiceCards({ services, props, full }: { services: SiteService[]; props: SitePageProps; full?: boolean }) {
  const { bookingUrl, link } = props;
  return (
    <ul className="m-0 grid list-none gap-x-10 gap-y-14 p-0 md:grid-cols-2">
      {services.map((s, i) => {
        const light = i % TILES.length === 2;
        const tile = (
          <div
            className="s8-grain relative flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl transition-transform duration-500 group-hover:scale-[1.015]"
            style={{ background: TILES[i % TILES.length] }}
          >
            <span className={cn("flex items-center gap-4 px-8 text-center text-[clamp(1.6rem,3vw,2.6rem)] font-bold tracking-[-.03em]", light ? "text-ink" : "text-white")}>
              <ServiceIcon name={s.name} description={s.description} className="size-[1em] shrink-0" />
              {s.name}
            </span>
            {bookingUrl && (
              <span className="absolute top-4 right-4 flex size-11 items-center justify-center rounded-full bg-white text-ink opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                <ArrowUpRight />
              </span>
            )}
          </div>
        );
        return (
          <li key={s.name} className="group">
            {bookingUrl ? (
              <a href={link(bookingUrl)} className="block text-inherit no-underline" aria-label={`Reservar ${s.name}`}>
                {tile}
              </a>
            ) : (
              tile
            )}
            <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_1.3fr]">
              <div>
                <h3 className="m-0 font-sans text-[1.35rem] font-normal text-white">{s.name}</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Chip tone="dark">{formatDuration(s.durationMinutes)}</Chip>
                  {s.isGroup && <Chip tone="dark">En grupo</Chip>}
                  {s.priceCents > 0 && <Chip tone="dark">{formatPrice(s.priceCents)}</Chip>}
                </div>
              </div>
              {s.description && (
                <div className="s8-serif text-[1.3rem] leading-snug text-white/65 [&_p]:m-0 [&_p+p]:mt-2">
                  {full ? <Paragraphs text={s.description} /> : <p>{firstSentence(s.description)}</p>}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function ServicesPanel({ props, services, more, full }: P & { services: SiteService[]; more?: boolean; full?: boolean }) {
  return (
    <Wrap className="px-5 md:px-[3.75rem]">
      <div className="mb-14 flex flex-col items-center gap-8 text-center">
        <SerifTitle>Tratamientos</SerifTitle>
        {more && (
          <PillLink href={props.link("/servicios")} tone="ghost">
            Ver todos
          </PillLink>
        )}
      </div>
      <ServiceCards services={services} props={props} full={full} />
    </Wrap>
  );
}

// ---------- About statement (inside the dark panel) ----------

export function Statement({ props, more }: P & { more?: boolean }) {
  const { content, img, link } = props;
  const { about, highlights, sections } = content;
  const cover = img(content.coverId);
  const showAbout = sections.about && !!about?.text;
  const text = showAbout ? paragraphs(about?.text)[0] : content.hero.subtitle;
  return (
    <Wrap className="px-5 text-center md:px-[3.75rem]">
      {cover && <img src={cover} alt="" className="mb-16 aspect-[21/9] w-full rounded-xl object-cover" loading="lazy" />}
      <SerifTitle className="mx-auto max-w-[18ch]">{(showAbout && about?.title) || "Una clínica que te escucha"}</SerifTitle>
      {text && <p className="mx-auto mt-8 mb-0 max-w-[48rem] text-[clamp(1.05rem,1.6vw,1.25rem)] leading-relaxed text-white/70">{text}</p>}
      {highlights.length > 0 && (
        <ul className="m-0 mx-auto mt-9 flex max-w-[52rem] list-none flex-wrap justify-center gap-2.5 p-0">
          {highlights.map((h, i) => (
            <li key={i}>
              <Chip tone="dark">{h.title}</Chip>
            </li>
          ))}
        </ul>
      )}
      {more && (
        <div className="mt-10">
          <PillLink href={link("/nosotros")} tone="light">
            Conócenos
          </PillLink>
        </div>
      )}
    </Wrap>
  );
}

// ---------- Team: quote cards + a stat card ----------

function TeamCard({ member, full }: { member: SiteTeamMember; full?: boolean }) {
  const quote = full ? member.bio : firstSentence(member.bio);
  return (
    <li className="flex flex-col justify-between gap-10 rounded-[1.25rem] bg-(--s8-cream) p-8 md:p-10">
      {quote ? (
        <div className="s8-serif text-[clamp(1.35rem,2vw,1.75rem)] leading-[1.25] text-ink [&_p]:m-0 [&_p+p]:mt-3">
          {full ? <Paragraphs text={`“${quote}”`} /> : <p>“{quote}”</p>}
        </div>
      ) : (
        <span className="s8-display text-[5rem] leading-none text-primary">{initials(member.name)}</span>
      )}
      <div className="flex items-center gap-4">
        <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-sm font-medium text-primary-foreground">
          {member.photoUrl ? <img src={member.photoUrl} alt="" className="size-full object-cover" loading="lazy" /> : initials(member.name)}
        </span>
        <span className="flex flex-col">
          <span className="text-[1rem] text-ink">{member.name}</span>
          <span className="text-[.72rem] tracking-[.08em] text-[#7a7873] uppercase">
            {[member.headline, member.licenseNumber && `Col. ${member.licenseNumber}`].filter(Boolean).join(" · ")}
          </span>
        </span>
      </div>
    </li>
  );
}

export function TeamSection({ props, full, max }: P & { full?: boolean; max?: number }) {
  const { team, services, content, link } = props;
  const shown = max ? team.slice(0, max) : team;
  const licensed = team.filter((m) => m.licenseNumber).length;
  const big = licensed || team.length;
  return (
    <section className="py-24 md:py-32" id="equipo">
      <Wrap className="md:px-[3.75rem]">
        <Chip>Equipo</Chip>
        <div className="mt-6 mb-14 flex flex-wrap items-end justify-between gap-8">
          <SerifTitle className="max-w-[16ch]">Las manos que te van a cuidar.</SerifTitle>
          {!full && <PillLink href={link("/equipo")}>Conoce al equipo</PillLink>}
        </div>
        <ul className="m-0 grid list-none gap-6 p-0 md:grid-cols-2">
          {shown.map((m) => (
            <TeamCard key={m.name} member={m} full={full} />
          ))}
          <li className="s8-grain flex flex-col justify-between gap-10 rounded-[1.25rem] bg-(--s8-second) p-8 md:p-10">
            <span className="s8-display text-[clamp(6rem,12vw,10rem)] leading-[.8] text-ink">
              {big}
            </span>
            <p className="m-0 max-w-sm text-[1.15rem] leading-snug text-ink">
              {licensed ? (licensed === 1 ? "Fisioterapeuta colegiado" : "Fisioterapeutas colegiados") : team.length === 1 ? "Fisioterapeuta" : "Fisioterapeutas"}
              {content.sections.services && services.length > 0 ? ` y ${services.length} tratamientos para que vuelvas a moverte sin dolor.` : "."}
            </p>
          </li>
        </ul>
      </Wrap>
    </section>
  );
}

// ---------- FAQ (cream panel) ----------

export function FaqPanel({ props }: P) {
  return (
    <Panel tone="cream" id="preguntas">
      <Wrap className="grid gap-12 md:px-[3.75rem] lg:grid-cols-[.8fr_1.2fr] lg:gap-20">
        <div>
          <Chip>Preguntas</Chip>
          <SerifTitle className="mt-6">Antes de tu primera visita.</SerifTitle>
        </div>
        <Accordion className="s8-faq">
          {props.content.faq.map((f, i) => (
            <AccordionItem key={i} title={f.q}>
              <Paragraphs text={f.a} />
            </AccordionItem>
          ))}
        </Accordion>
      </Wrap>
    </Panel>
  );
}

// ---------- Big call to action ----------

export function BigCta({ props }: P) {
  const { bookingUrl, link, content } = props;
  const phone = content.contact.phone;
  if (!bookingUrl && !phone) return null;
  return (
    <section className="py-24 text-center md:py-36">
      <Wrap>
        <p className="s8-display m-0 text-[clamp(3.4rem,10vw,9.5rem)] leading-[.86]">
          ¿Algo te duele?
          <br />
          Empecemos.
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-3">
          {bookingUrl && <PillLink href={link(bookingUrl)}>Pide cita</PillLink>}
          {phone && (
            <a href={`tel:${phone.replace(/[^\d+]/g, "")}`} className="inline-flex h-12 items-center rounded-full border border-ink px-7 text-[.84rem] font-medium tracking-[.08em] text-ink uppercase no-underline hover:bg-ink hover:text-white">
              {phone}
            </a>
          )}
        </div>
      </Wrap>
    </section>
  );
}

// ---------- Hours (footer, contact page) ----------

export function HoursList({ hours, className }: { hours: SitePageProps["hours"]; className?: string }) {
  const today = spainNow().weekday;
  return (
    <ul className={cn("m-0 list-none p-0", className)}>
      {hoursByDay(hours).map((d, i) => (
        <li key={d.label} className={cn("flex justify-between gap-6 border-b border-[#dedbd4] py-2 text-[.92rem] last:border-0", i + 1 === today ? "font-medium text-ink" : "text-[#6b6964]")}>
          <span>
            {d.label}
            {i + 1 === today && <span className="ml-2 rounded-full bg-ink px-2 py-0.5 text-[.65rem] tracking-[.08em] text-white uppercase">Hoy</span>}
          </span>
          <span className="tabular-nums">{d.ranges.length ? d.ranges.join(" · ") : "Cerrado"}</span>
        </li>
      ))}
    </ul>
  );
}

// ---------- Contact block (contact page) ----------

export function ContactPanel({ props }: P) {
  const { content, hours } = props;
  const c = content.contact;
  const address = fullAddress(c);
  return (
    <Panel tone="cream" id="contacto">
      <Wrap className="grid gap-14 md:px-[3.75rem] lg:grid-cols-2 lg:gap-20">
        <div>
          <Chip>Contacto</Chip>
          <SerifTitle className="mt-6">{address ? "Ven a vernos." : "Escríbenos."}</SerifTitle>
          {address && <p className="s8-serif m-0 mt-6 text-[1.7rem] leading-snug text-ink">{address}</p>}
          <div className="mt-8 text-[1.05rem] [&_.kf-contact]:gap-3 [&_a]:text-ink [&_a]:no-underline [&_a:hover]:text-primary">
            <ContactList content={{ ...content, contact: { ...c, address: undefined, postalCode: undefined, city: undefined } }} />
          </div>
          {c.mapsUrl && (
            <div className="mt-8">
              <PillLink href={c.mapsUrl} external>
                Cómo llegar
              </PillLink>
            </div>
          )}
        </div>
        {content.sections.hours && hours.length > 0 && (
          <div>
            <StatusLine props={props} className="mb-5 text-[.95rem]" />
            <HoursList hours={hours} className="[&_li]:py-3 [&_li]:text-[1rem]" />
          </div>
        )}
      </Wrap>
    </Panel>
  );
}

export function Gallery({ images }: { images: string[] }) {
  return (
    <ul className="m-0 grid list-none grid-cols-2 gap-4 p-0 md:grid-cols-3">
      {images.map((src, i) => (
        <li key={src} className={cn("overflow-hidden rounded-xl", i === 0 && "col-span-2 row-span-2")}>
          <img src={src} alt="" className="aspect-square size-full object-cover" loading="lazy" />
        </li>
      ))}
    </ul>
  );
}

// ---------- Inner page header ----------

export function PageHead({ props, tag, title, lead }: P & { tag: string; title: string; lead?: string }) {
  return (
    <section className="pt-12 pb-16 md:pt-20 md:pb-24">
      <Wrap>
        <Breadcrumb items={[{ label: "Inicio", href: props.link("/") }, { label: tag }]} />
        <h1 className="s8-display m-0 mt-8 text-[clamp(3.2rem,10vw,9.5rem)] leading-[.86] text-ink">
          <SplitTitle text={title} />
        </h1>
        <div className="mt-10 border-t border-[#cfccc5] pt-4">
          <StatusLine props={props} />
        </div>
        {lead && <p className="m-0 mt-8 max-w-[34rem] text-[clamp(1.05rem,1.5vw,1.2rem)] leading-relaxed text-ink md:ml-auto">{lead}</p>}
      </Wrap>
    </section>
  );
}
