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
  telHref,
} from "../shared/format.js";
import { ClockIcon, MapPinIcon, PhoneIcon, ServiceIcon, ShieldCheckIcon } from "../shared/icons.js";
import { ArrowRight, Breadcrumb } from "../shared/ui.js";
import type { SitePageProps, SiteService, SiteTeamMember } from "../types.js";

// Pulso: clean, confident, agency-like. Poppins, huge two-tone headlines,
// wide-tracked uppercase labels, hairline rows, pill buttons with an offset
// colour shadow, and a signature of three bars (violet, mint, lime) next to
// the clinic's own colour. Written with Tailwind classes; style.ts only has
// fonts, gradients and the line-art animation.

type P = { props: SitePageProps };

// ---------- Building blocks ----------

export function Wrap({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-[75rem] px-5 md:px-10", className)}>{children}</div>;
}

// The signature: three short bars
export function Bars({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex h-[1em] items-stretch gap-[.18em]", className)} aria-hidden="true">
      <span className="w-[.2em] rounded-[1px] bg-(--pu-violet)" />
      <span className="w-[.2em] rounded-[1px] bg-(--pu-mint)" />
      <span className="w-[.2em] rounded-[1px] bg-(--pu-lime)" />
    </span>
  );
}

// The same, lying down and stacked (hero line)
export function StackBars({ className }: { className?: string }) {
  return (
    <span className={cn("flex flex-col gap-1.5", className)} aria-hidden="true">
      <span className="h-2 w-[5.5rem] bg-(--pu-lime)" />
      <span className="h-2 w-16 bg-(--pu-mint)" />
      <span className="h-2 w-10 bg-(--pu-violet)" />
    </span>
  );
}

// Section corner mark
export function CornerBars() {
  return (
    <div className="mt-14 flex justify-end">
      <Bars className="text-[1.75rem]" />
    </div>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={cn("m-0 mb-4 text-[.76rem] font-semibold tracking-[.2em] text-primary uppercase", className)}>{children}</p>;
}

export function Rule({ className }: { className?: string }) {
  return <span className={cn("mt-7 block h-[3px] w-16 bg-primary", className)} aria-hidden="true" />;
}

export function Title({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <h2 className={cn("m-0 text-[clamp(2.1rem,4.4vw,3.4rem)] leading-[1.08] font-semibold tracking-[-.02em] text-ink", className)}>{children}</h2>
  );
}

export function Pill({
  href,
  children,
  tone = "primary",
  external,
}: {
  href: string;
  children: ReactNode;
  tone?: "primary" | "outline";
  external?: boolean;
}) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener" } : {})}
      className={cn(
        "inline-flex h-[3.4rem] items-center gap-3 rounded-full px-7 text-[.84rem] font-medium tracking-[.14em] whitespace-nowrap uppercase no-underline transition-transform duration-200 hover:-translate-y-0.5",
        tone === "primary"
          ? "bg-primary text-primary-foreground shadow-[4px_5px_0_var(--pu-lime)]"
          : "border-2 border-ink bg-white text-ink shadow-[4px_5px_0_var(--pu-mint)]",
      )}
    >
      <Bars className="text-[1.05rem]" />
      {children}
    </a>
  );
}

export function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} className="group inline-flex items-center gap-3 text-[.84rem] font-medium tracking-[.14em] text-ink uppercase no-underline">
      {children}
      <span className="transition-transform duration-200 group-hover:translate-x-1">
        <ArrowRight />
      </span>
    </a>
  );
}

export function counter() {
  let n = 0;
  return () => String(++n).padStart(2, "0");
}

// Splits a title in two: the first half dark, the rest light grey
export function TwoTone({ text, className }: { text: string; className?: string }) {
  const words = text.trim().split(/\s+/);
  const cut = Math.max(1, Math.ceil(words.length / 2));
  return (
    <span className={className}>
      <span className="text-[#4a4a4a]">{words.slice(0, cut).join(" ")}</span>{" "}
      <span className="text-[#ababab]">{words.slice(cut).join(" ")}</span>
    </span>
  );
}

export const statusOf = (props: SitePageProps) => (props.content.sections.hours ? openStatus(props.hours) : null);

export function StatusDot({ open }: { open: boolean }) {
  return <span className={cn("inline-block size-2 rounded-full", open ? "bg-[#22b573] shadow-[0_0_0_4px_rgba(34,181,115,.18)]" : "bg-[#b5b5b5]")} />;
}

// ---------- Hero art: original line drawing (hills, sun, cloud, a pulse) ----------

export function LineArt({ className }: { className?: string }) {
  return (
    <svg className={cn("pu-art", className)} viewBox="0 0 640 260" fill="none" aria-hidden="true">
      <path pathLength={1} className="pu-art-mint" d="M268 74a20 20 0 0 1 37-9 25 25 0 0 1 46 7 16 16 0 0 1 1 31h-88a15 15 0 0 1 4-29z" />
      <circle pathLength={1} className="pu-art-mint" cx="540" cy="58" r="30" />
      <path pathLength={1} className="pu-art-violet" d="M0 250 70 168l46 52 70-96 84 126" />
      <path pathLength={1} className="pu-art-violet pu-art-soft" d="M120 250 214 150l40 40 30-30 68 90" />
      <path pathLength={1} className="pu-art-mint" d="M380 250 476 104l42 58 26-30 96 118" />
      <path pathLength={1} className="pu-art-violet pu-art-strong" d="M0 214h196l18-44 22 78 26-118 24 96 16-12h338" />
    </svg>
  );
}

// ---------- Statement + badges ----------

export function Badges({ props }: P) {
  const { content, team, hours, bookingUrl } = props;
  const licensed = content.sections.team ? team.filter((m) => m.licenseNumber).length : 0;
  const days = content.sections.hours ? new Set(hours.map((h) => h.weekday)).size : 0;
  const items = [
    content.healthRegistry && { top: "Registro sanitario", main: content.healthRegistry },
    licensed > 0 && { top: licensed === 1 ? "Fisio" : `${licensed} fisios`, main: "Colegiados" },
    bookingUrl && { top: "Cita online", main: "24/7" },
    days > 0 && { top: "Abrimos", main: `${days} días` },
  ].filter((b): b is { top: string; main: string } => !!b);
  if (!items.length) return null;
  return (
    <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 sm:w-[19rem]">
      {items.map((b, i) => (
        <li
          key={b.top}
          className={cn("flex min-h-24 flex-col items-center justify-center border-2 px-3 py-3 text-center", i % 2 ? "border-ink" : "border-primary")}
        >
          <span className={cn("text-[.7rem] font-semibold tracking-[.12em] uppercase", i % 2 ? "text-ink" : "text-primary")}>{b.top}</span>
          <span className="mt-1 text-lg leading-tight font-semibold text-ink">{b.main}</span>
        </li>
      ))}
    </ul>
  );
}

// ---------- FAQ: dark section, numbered rows ----------

export function FaqDark({ props, index }: P & { index?: string }) {
  const { content, img } = props;
  const photo = content.sections.gallery ? img(content.galleryIds[0]) : undefined;
  const phone = content.contact.phone;
  return (
    <section className="pu-dark relative overflow-hidden border-b-4 border-primary bg-[#141414] py-24 text-white md:py-32">
      {photo && <img src={photo} alt="" className="absolute inset-0 size-full object-cover opacity-20 grayscale" loading="lazy" />}
      <Wrap className="relative">
        <Eyebrow className="text-(--pu-mint)">{index ? `${index} · ` : ""}Antes de venir</Eyebrow>
        <Title className="text-white">
          ¿Tienes dudas?
          <br />
          Es lo normal.
        </Title>
        <Rule />
        <ol className="m-0 mt-12 list-none border-t border-white/15 p-0">
          {content.faq.map((f, i) => {
            const last = i === content.faq.length - 1;
            return (
              <li key={i} className="grid gap-3 border-b border-white/15 py-8 md:grid-cols-[6rem_1fr_1fr] md:gap-8">
                <span className="pt-1.5 text-xs font-semibold tracking-[.18em] text-(--pu-violet-soft)">{String(i + 1).padStart(2, "0")}</span>
                <h3 className={cn("m-0 text-[clamp(1.3rem,2.2vw,1.85rem)] leading-tight font-medium", last ? "text-(--pu-mint)" : "text-white")}>{f.q}</h3>
                <div className={cn("text-[1.02rem] leading-relaxed [&_p]:m-0 [&_p+p]:mt-3", last ? "text-white" : "text-white/60")}>
                  <Paragraphs text={f.a} />
                </div>
              </li>
            );
          })}
        </ol>
        {phone && (
          <p className="m-0 mt-10 max-w-2xl text-[clamp(1.2rem,2vw,1.6rem)] leading-snug font-semibold">
            ¿Algo más? Llámanos al{" "}
            <a href={telHref(phone)} className="text-(--pu-lime) no-underline hover:underline">
              {phone}
            </a>{" "}
            y lo hablamos.
          </p>
        )}
        <CornerBars />
      </Wrap>
    </section>
  );
}

// ---------- Services: numbered hairline rows ----------

export function ServiceRows({ services, props, full }: { services: SiteService[]; props: SitePageProps; full?: boolean }) {
  const { bookingUrl, link } = props;
  return (
    <ol className="m-0 list-none border-t border-(--line) p-0">
      {services.map((s, i) => {
        const name = (
          <span className="inline-flex items-baseline gap-3">
            {s.name}
            {bookingUrl && (
              <span className="text-primary transition-transform duration-200 group-hover:translate-x-1">
                <ArrowRight />
              </span>
            )}
          </span>
        );
        return (
          <li key={s.name} className="group grid gap-3 border-b border-(--line) py-8 md:grid-cols-[11rem_1.1fr_1fr_auto] md:items-baseline md:gap-8">
            <span className="text-xs font-semibold tracking-[.18em] text-(--pu-violet) uppercase">
              {String(i + 1).padStart(2, "0")} · {formatDuration(s.durationMinutes)}
              {s.isGroup && " · grupo"}
            </span>
            <h3 className="m-0 text-[clamp(1.2rem,1.8vw,1.5rem)] leading-snug font-semibold text-ink">
              {bookingUrl ? (
                <a href={link(bookingUrl)} className="text-inherit no-underline">
                  {name}
                </a>
              ) : (
                name
              )}
            </h3>
            <div className="text-[1.02rem] leading-relaxed text-[#6b6b6b] [&_p]:m-0 [&_p+p]:mt-2">
              {s.description ? full ? <Paragraphs text={s.description} /> : <p>{firstSentence(s.description)}</p> : null}
            </div>
            <span className="text-xl font-semibold whitespace-nowrap text-ink md:text-right">{s.priceCents > 0 ? formatPrice(s.priceCents) : ""}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function ServicesSection({ props, index, services, full, more }: P & { index?: string; services: SiteService[]; full?: boolean; more?: boolean }) {
  return (
    <section className="pu-blob relative overflow-hidden py-24 md:py-32" id="servicios">
      <Wrap className="relative">
        <Eyebrow>{index ? `${index} · ` : ""}Tratamientos</Eyebrow>
        <Title>
          Un tratamiento
          <br />
          para cada caso.
        </Title>
        <Rule />
        <div className="mt-12">
          <ServiceRows services={services} props={props} full={full} />
        </div>
        <div className="mt-8 flex flex-wrap items-center justify-between gap-6">
          <p className="m-0 max-w-xl text-[.95rem] text-[#6b6b6b]">¿No sabes cuál es el tuyo? Empieza por una valoración y te orientamos.</p>
          {more && <TextLink href={props.link("/servicios")}>Todos los tratamientos</TextLink>}
        </div>
        <CornerBars />
      </Wrap>
    </section>
  );
}

// ---------- Team: grey section, photo + roster panel ----------

function Roster({ team }: { team: SiteTeamMember[] }) {
  return (
    <div className="rounded-2xl bg-[#ebebe8] p-6">
      <p className="m-0 mb-4 text-[.72rem] font-semibold tracking-[.2em] text-[#777] uppercase">Nuestro equipo</p>
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {team.map((m) => (
          <li key={m.name} className="flex items-center gap-4 rounded-full bg-white py-2.5 pr-5 pl-2.5">
            <span className="flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-soft text-sm font-semibold text-primary">
              {m.photoUrl ? <img src={m.photoUrl} alt="" className="size-full object-cover" loading="lazy" /> : initials(m.name)}
            </span>
            <span className="flex min-w-0 flex-col leading-tight">
              <span className="font-medium text-ink">{m.name}</span>
              {m.headline && <span className="truncate text-[.82rem] text-[#777]">{m.headline}</span>}
            </span>
            {m.licenseNumber && (
              <span className="ml-auto hidden items-center gap-1.5 text-[.72rem] font-semibold tracking-[.08em] text-[#777] uppercase sm:inline-flex">
                <ShieldCheckIcon className="size-3.5 text-primary" />
                {m.licenseNumber}
              </span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

const NEXT = [
  { bar: "bg-(--pu-violet)", title: "Valoración", text: "Escuchamos, exploramos y buscamos el origen del problema, no solo dónde duele." },
  { bar: "bg-(--pu-mint)", title: "Tratamiento", text: "Terapia manual, ejercicio y las técnicas que mejor encajen contigo." },
  { bar: "bg-(--pu-lime)", title: "Seguimiento", text: "Te llevas ejercicios para casa y revisamos juntos cómo avanzas." },
];

export function TeamSection({ props, index }: P & { index?: string }) {
  const { team, link, bookingUrl, content } = props;
  const lead = team.find((m) => m.photoUrl);
  return (
    <section className="bg-(--pu-gray) py-24 md:py-32" id="equipo">
      <Wrap>
        <div className="grid gap-14 lg:grid-cols-2 lg:gap-20">
          <div>
            <Eyebrow>{index ? `${index} · ` : ""}Equipo</Eyebrow>
            <Title>
              Las personas que
              <br />
              te van a tratar.
            </Title>
            <Rule />
            <p className="m-0 mt-8 text-[1.3rem] leading-normal text-ink">
              {team.length === 1 ? "Una fisioterapeuta" : `${team.length} fisioterapeutas`}, cada uno con su especialidad y el mismo objetivo: que vuelvas a moverte sin dolor.
            </p>
            <p className="m-0 mt-5 leading-relaxed text-[#6b6b6b]">
              Te atiende siempre un profesional colegiado. <strong className="text-[#4a4a4a]">Y te explica lo que hace:</strong> sabrás qué te pasa y por qué.
            </p>
            {lead?.photoUrl && <img src={lead.photoUrl} alt={lead.name} className="mt-10 aspect-[16/10] w-full rounded-2xl object-cover" loading="lazy" />}
          </div>
          <div className="flex flex-col gap-5">
            <Roster team={team} />
            <div className="relative rounded-2xl border border-[#dcdcd8] bg-white p-6">
              <span className="absolute top-0 left-6 h-1 w-14 bg-(--pu-lime)" aria-hidden="true" />
              <p className="m-0 text-[.72rem] font-semibold tracking-[.2em] text-[#777] uppercase">Tu primera visita</p>
              <p className="m-0 mt-4 text-[1.25rem] leading-snug font-medium text-ink">“Vengo a que me valoréis y me digáis qué me pasa y cómo lo trabajamos.”</p>
            </div>
            <div className="flex flex-wrap items-center gap-6">
              {bookingUrl ? (
                <Pill href={link(bookingUrl)}>Pide cita</Pill>
              ) : (
                content.contact.phone && <Pill href={telHref(content.contact.phone)}>Llámanos</Pill>
              )}
              <TextLink href={link("/equipo")}>Conoce al equipo</TextLink>
            </div>
          </div>
        </div>

        <div className="mt-20 grid gap-10 border-t border-[#dcdcd8] pt-14 lg:grid-cols-[1fr_1.4fr] lg:gap-20">
          <div>
            <Eyebrow>¿Y después?</Eyebrow>
            <Title className="text-[clamp(1.8rem,3.4vw,2.6rem)]">Contigo hasta el alta, no solo una sesión.</Title>
          </div>
          <ul className="m-0 grid list-none gap-8 p-0 sm:grid-cols-3">
            {NEXT.map((n) => (
              <li key={n.title} className="border-t border-[#dcdcd8] pt-5">
                <span className={cn("mb-4 block h-1 w-8", n.bar)} aria-hidden="true" />
                <h3 className="m-0 text-[1.2rem] font-semibold text-ink">{n.title}</h3>
                <p className="m-0 mt-2 text-[.95rem] leading-relaxed text-[#6b6b6b]">{n.text}</p>
              </li>
            ))}
          </ul>
        </div>
        <CornerBars />
      </Wrap>
    </section>
  );
}

// Equipo page: one card per person, with the full bio
export function TeamCards({ team }: { team: SiteTeamMember[] }) {
  return (
    <ul className="m-0 grid list-none gap-6 p-0 sm:grid-cols-2 lg:grid-cols-3">
      {team.map((m) => (
        <li key={m.name} className="overflow-hidden rounded-2xl border border-[#dcdcd8] bg-white">
          <div className="relative aspect-[4/5] bg-primary-soft">
            {m.photoUrl ? (
              <img src={m.photoUrl} alt={m.name} className="size-full object-cover" loading="lazy" />
            ) : (
              <span className="absolute inset-0 flex items-center justify-center text-6xl font-semibold text-primary">{initials(m.name)}</span>
            )}
          </div>
          <div className="relative p-6">
            <span className="absolute top-0 left-6 h-1 w-10 bg-primary" aria-hidden="true" />
            <h3 className="m-0 text-[1.3rem] font-semibold text-ink">{m.name}</h3>
            {m.headline && <p className="m-0 mt-1 text-[.95rem] font-medium text-primary">{m.headline}</p>}
            {m.bio && (
              <div className="mt-4 text-[.98rem] leading-relaxed text-[#6b6b6b] [&_p]:m-0 [&_p+p]:mt-2">
                <Paragraphs text={m.bio} />
              </div>
            )}
            {m.licenseNumber && (
              <p className="m-0 mt-5 inline-flex items-center gap-1.5 text-[.72rem] font-semibold tracking-[.12em] text-[#777] uppercase">
                <ShieldCheckIcon className="size-3.5 text-primary" />
                Colegiado nº {m.licenseNumber}
              </p>
            )}
          </div>
        </li>
      ))}
    </ul>
  );
}

// ---------- About: gradient section, statement + highlight cards ----------

export function AboutSection({ props, index, more }: P & { index?: string; more?: boolean }) {
  const { content, link } = props;
  const { about, highlights, sections } = content;
  const showAbout = sections.about && !!about?.text;
  const paras = paragraphs(about?.text);
  const lead = firstSentence(about?.text);
  const rest = (paras[0] ?? "").slice(lead.length).trim();
  return (
    <section className="pu-fresh relative overflow-hidden py-24 md:py-32" id="nosotros">
      <Wrap className="relative grid gap-14 lg:grid-cols-2 lg:gap-20">
        <div>
          <Eyebrow>{index ? `${index} · ` : ""}Nosotros</Eyebrow>
          <Title>{(showAbout && about?.title) || "Una clínica que se toma su tiempo."}</Title>
          <Rule />
          {showAbout && (
            <>
              <p className="m-0 mt-10 text-[1.4rem] leading-snug font-semibold text-ink">{lead}</p>
              {rest && <p className="m-0 mt-5 text-[1.05rem] leading-relaxed text-[#4a4a4a]">{rest}</p>}
              {paras.slice(1).map((p, i) => (
                <p key={i} className={cn("m-0 mt-4 text-[1.05rem] leading-relaxed text-[#4a4a4a]", more && "hidden")}>
                  {p}
                </p>
              ))}
            </>
          )}
          {more && (
            <div className="mt-10">
              <TextLink href={link("/nosotros")}>Más sobre nosotros</TextLink>
            </div>
          )}
        </div>
        {highlights.length > 0 && (
          <div>
            <Eyebrow>Por qué nosotros</Eyebrow>
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {highlights.map((h, i) => (
                <li key={i} className="rounded-2xl border border-[#dcdcd8] bg-white/85 px-7 py-6 backdrop-blur-sm">
                  <h3 className="m-0 text-[1.2rem] font-semibold text-ink">{h.title}</h3>
                  {h.text && <p className="m-0 mt-1.5 text-[.95rem] leading-relaxed text-[#6b6b6b]">{h.text}</p>}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Wrap>
    </section>
  );
}

export function GalleryGrid({ images }: { images: string[] }) {
  return (
    <ul className="m-0 grid list-none grid-cols-2 gap-4 p-0 md:grid-cols-3">
      {images.map((src, i) => (
        <li key={src} className={cn("overflow-hidden rounded-2xl", i === 0 && "md:col-span-2 md:row-span-2")}>
          <img src={src} alt="" className="aspect-square size-full object-cover" loading="lazy" />
        </li>
      ))}
    </ul>
  );
}

// ---------- Visit: three cards + treatment chips ----------

export function VisitSection({ props, index }: P & { index?: string }) {
  const { content, hours, services, link } = props;
  const c = content.contact;
  const address = fullAddress(c);
  const status = statusOf(props);
  const today = spainNow().weekday;
  const todayRanges = content.sections.hours ? hoursByDay(hours)[today - 1]?.ranges ?? [] : [];
  const chips = content.sections.services ? services.map((s) => s.name) : content.highlights.map((h) => h.title);
  const card = "relative flex flex-col rounded-2xl border border-[#dcdcd8] bg-white p-7";
  return (
    <section className="pu-ferns relative overflow-hidden py-24 md:py-32" id="contacto">
      <Wrap className="relative">
        <Eyebrow>{index ? `${index} · ` : ""}Ven a vernos</Eyebrow>
        <Title>Estamos aquí.</Title>
        <Rule />
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          <div className={card}>
            <span className="mb-6 flex size-12 items-center justify-center rounded-full bg-(--pu-mint)/35 text-ink">
              <MapPinIcon className="size-6" />
            </span>
            <h3 className="m-0 text-[1.35rem] font-semibold text-ink">Dirección</h3>
            <p className="m-0 mt-2 text-[#6b6b6b]">{address || "Escríbenos y te contamos cómo llegar."}</p>
            {c.mapsUrl && (
              <div className="mt-auto pt-6">
                <TextLink href={c.mapsUrl}>Cómo llegar</TextLink>
              </div>
            )}
          </div>
          <div className={card}>
            <span className="mb-6 flex size-12 items-center justify-center rounded-full bg-(--pu-lime)/50 text-ink">
              <ClockIcon className="size-6" />
            </span>
            <h3 className="m-0 text-[1.35rem] font-semibold text-ink">Horario</h3>
            {status ? (
              <p className="m-0 mt-2 inline-flex items-center gap-2.5 font-medium text-ink">
                <StatusDot open={status.open} />
                {status.label}
              </p>
            ) : (
              <p className="m-0 mt-2 text-[#6b6b6b]">Con cita previa.</p>
            )}
            {todayRanges.length > 0 && <p className="m-0 mt-1 text-[#6b6b6b]">Hoy: {todayRanges.join(" · ")}</p>}
            <div className="mt-auto pt-6">
              <TextLink href={link("/contacto")}>Ver horario completo</TextLink>
            </div>
          </div>
          <div className={card}>
            <span className="mb-6 flex size-12 items-center justify-center rounded-full bg-(--pu-violet)/15 text-ink">
              <PhoneIcon className="size-6" />
            </span>
            <h3 className="m-0 text-[1.35rem] font-semibold text-ink">Contacto</h3>
            <div className="mt-3 text-[.98rem] [&_.kf-contact]:gap-2 [&_a]:text-ink [&_a]:no-underline [&_a:hover]:text-primary">
              <ContactList content={{ ...content, contact: { ...c, address: undefined, postalCode: undefined, city: undefined } }} />
            </div>
          </div>
        </div>
        {chips.length > 0 && (
          <ul className="m-0 mt-6 flex list-none flex-wrap gap-3 p-0">
            {chips.map((t) => (
              <li key={t} className="inline-flex h-11 items-center gap-2 rounded-full bg-(--pu-lime) px-5 text-[.95rem] font-medium text-ink">
                <ServiceIcon name={t} className="size-4" />
                {t}
              </li>
            ))}
          </ul>
        )}
      </Wrap>
    </section>
  );
}

// ---------- Inner page header ----------

export function PageHead({ props, tag, title, lead }: P & { tag: string; title: string; lead?: string }) {
  return (
    <section className="border-b border-(--line) pt-16 pb-16 md:pt-24 md:pb-20">
      <Wrap>
        <div className="mb-10">
          <Breadcrumb items={[{ label: "Inicio", href: props.link("/") }, { label: tag }]} />
        </div>
        <h1 className="m-0 text-[clamp(2.6rem,7vw,6rem)] leading-[.98] font-semibold tracking-[-.03em]">
          <TwoTone text={title} />
        </h1>
        {lead && (
          <div className="mt-10 flex items-center gap-6">
            <StackBars />
            <p className="m-0 max-w-2xl text-[clamp(1.05rem,1.6vw,1.3rem)] leading-normal text-[#4a4a4a]">{lead}</p>
          </div>
        )}
      </Wrap>
    </section>
  );
}
