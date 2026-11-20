import type { ReactNode } from "react";
import { Paragraphs, SocialLinks } from "../shared/blocks.js";
import { cn } from "../shared/cn.js";
import { formatDuration, formatPrice, fullAddress, hoursSummary, initials, openStatus, telHref, whatsappHref } from "../shared/format.js";
import { pageAvailable } from "../shared/pages.js";
import { Accordion, AccordionItem, Breadcrumb } from "../shared/ui.js";
import type { SitePageProps, SiteService, SiteTeamMember } from "../types.js";

// Arco: the "range of movement" clinic site. A goniometer arc as the logo, a
// degree dial in the hero and the method as 0°, 90° and 180°. Calm sage
// neutrals, the clinic's colour as deep blocks and a bright highlight (its
// second colour) used sparingly: a word of the headline, dots, the dial.
// Big Bricolage Grotesque headlines over Inter. Fluid layout: flex-wrap and
// auto-fit grids, no breakpoints needed except the menu.

type P = { props: SitePageProps };

// ---------- Colours ----------

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
const toHex = (c: number[]) => `#${c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;
function luminance(hex: string) {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// The design needs a deep colour (white text on it) and a light highlight
// (deep text on it, and visible on the deep colour). The clinic's main colour
// is darkened until white text reads well on it; its second colour is the
// highlight only when it's light, otherwise a pale tint of the main colour
export function arcoColors(primary: string, accent?: string) {
  const base = rgb(primary);
  let dark = primary;
  for (let k = 1; luminance(dark) > 0.16 && k > 0.15; k -= 0.05) dark = toHex(base.map((v) => v * k));
  const hl = accent && luminance(accent) > 0.45 ? accent : toHex(base.map((v) => 255 - (255 - v) * 0.28));
  return { dark, hl };
}

// ---------- Layout pieces ----------

export function Wrap({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("mx-auto box-border w-full max-w-[75rem] px-[clamp(20px,5vw,48px)]", className)}>{children}</div>;
}

// A full-width band: "page" (the sage background) or "white" (with borders)
export function Band({ tone = "page", id, className, children, label }: { tone?: "page" | "white"; id?: string; className?: string; children: ReactNode; label?: string }) {
  return (
    <section id={id} aria-label={label} className={cn(tone === "white" && "border-y border-solid border-x-0 border-(--ar-line) bg-white")}>
      <Wrap className={cn("flex flex-col gap-10 py-[clamp(64px,8vw,104px)] md:gap-12", className)}>{children}</Wrap>
    </section>
  );
}

// Eyebrow + big title on the left, a lead or a link on the right, bottom-aligned
export function SectionHeader({ eyebrow, title, lead, action }: { eyebrow?: string; title: ReactNode; lead?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-12 gap-y-5">
      <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-3.5">
        {eyebrow && <p className="ar-eyebrow">{eyebrow}</p>}
        <h2 className="ar-display ar-h2 m-0 text-[clamp(34px,4.2vw,54px)]">{title}</h2>
      </div>
      {lead && <p className="m-0 max-w-[30em] min-w-0 flex-[1_1_320px] text-[17px] leading-relaxed text-muted">{lead}</p>}
      {action}
    </div>
  );
}

type Tone = "dark" | "outline" | "hl" | "outlineLight";
const TONES: Record<Tone, string> = {
  dark: "bg-(--ar-dark) text-white hover:bg-(--ar-dark-deep)",
  outline: "border-[1.5px] border-solid border-ink text-ink hover:bg-white",
  hl: "bg-(--ar-hl) text-(--ar-dark) hover:brightness-95",
  outlineLight: "border-[1.5px] border-solid border-white/40 text-white hover:bg-white/10",
};
const SIZES = { md: "min-h-12 px-[22px] text-[15px]", lg: "min-h-[52px] px-[26px] text-base", xl: "min-h-14 px-7 text-base" };

export function Btn({ href, tone = "dark", size = "lg", external, className, children }: { href: string; tone?: Tone; size?: keyof typeof SIZES; external?: boolean; className?: string; children: ReactNode }) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener" } : {})}
      className={cn("box-border inline-flex items-center justify-center gap-2.5 rounded-full font-semibold whitespace-nowrap no-underline transition-[background-color,filter] duration-200", TONES[tone], SIZES[size], className)}
    >
      {children}
    </a>
  );
}

const svg = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

export const Check = ({ className }: { className?: string }) => (
  <svg {...svg} width={18} height={18} strokeWidth={2.4} className={cn("shrink-0", className)}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
);
export const Arrow = () => (
  <svg {...svg} width={18} height={18} strokeWidth={2.2} className="shrink-0">
    <path d="M5 12h14" />
    <path d="M13 6l6 6-6 6" />
  </svg>
);
export const Pin = ({ size = 24 }: { size?: number }) => (
  <svg {...svg} width={size} height={size} strokeWidth={2} className="shrink-0">
    <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z" />
    <circle cx="12" cy="9.5" r="2.5" />
  </svg>
);
const Phone = () => (
  <svg {...svg} width={18} height={18} strokeWidth={2} className="shrink-0">
    <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />
  </svg>
);

// ---------- Brand ----------

// The goniometer arc with a dot in the highlight colour
export function ArcMark({ size = 36, light }: { size?: number; light?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 36 36" aria-hidden="true" className="shrink-0">
      <path d="M5 27 A13 13 0 0 1 31 27" fill="none" strokeWidth={5} strokeLinecap="round" style={{ stroke: light ? "#fff" : "var(--ar-dark)" }} />
      <circle cx={27.2} cy={17.8} r={4.5} strokeWidth={2.5} style={{ fill: "var(--ar-hl)", stroke: light ? "var(--ar-dark-deep)" : "var(--ar-dark)" }} />
    </svg>
  );
}

// "Arco Fisioterapia" → "Arco" big and "Fisioterapia" small, like the design.
// Only when the name ends with one of these words
const GENERIC = /^(fisioterapia|fisio|physio|clínica|clinica|centro|salud|rehabilitación|osteopatía)$/i;
function splitName(name: string): [string, string | null] {
  const words = name.trim().split(/\s+/);
  const last = words[words.length - 1] ?? "";
  return words.length > 1 && GENERIC.test(last) ? [words.slice(0, -1).join(" "), last] : [name, null];
}

export function Brand({ props, light }: P & { light?: boolean }) {
  const { clinic, content, img, link } = props;
  const logo = img(content.logoId);
  const [main, sub] = splitName(clinic.name);
  return (
    <a href={link("/")} aria-label={`${clinic.name}, inicio`} className={cn("flex min-h-11 min-w-0 items-center gap-2.5 no-underline", light ? "text-white" : "text-ink")}>
      {logo && !light ? (
        <img src={logo} alt={clinic.name} className="block max-h-10 max-w-44 object-contain" />
      ) : (
        <>
          <ArcMark size={light ? 30 : 36} light={light} />
          <span className={cn("ar-display truncate tracking-[-.03em]", light ? "text-xl" : "text-2xl")}>{light ? clinic.name : main}</span>
          {sub && !light && <span className="hidden pt-[3px] text-sm text-muted sm:inline">{sub}</span>}
        </>
      )}
    </a>
  );
}

// ---------- Status and hours ----------

export const statusOf = (props: SitePageProps) => (props.content.sections.hours ? openStatus(props.hours) : null);

export function Status({ props, className }: P & { className?: string }) {
  const s = statusOf(props);
  if (!s) return null;
  return (
    <span className={cn("inline-flex items-center gap-2 text-sm font-medium", className)}>
      <span className={cn("ar-dot", s.open && "ar-dot-open")} aria-hidden="true" />
      {s.label}
    </span>
  );
}

// ---------- Hero ----------

// The points under the hero buttons: the clinic's own highlights, or facts
// drawn from its data
function heroChecks({ content, team, services, bookingUrl }: SitePageProps) {
  if (content.highlights.length) return content.highlights.slice(0, 3).map((h) => h.title);
  return [
    content.sections.team && team.length > 0 && team.every((m) => m.licenseNumber) && "Fisioterapeutas colegiados",
    services.some((s) => !s.isGroup) && "Sesiones 1 a 1",
    bookingUrl && "Reserva online 24 h",
  ].filter((t): t is string => !!t);
}

export function Hero({ props }: P) {
  const { content, bookingUrl, link, services } = props;
  const { hero, contact, sections } = content;
  const words = hero.title.trim().split(/\s+/);
  const last = words.pop();
  const pill = [`Fisioterapia${contact.city ? ` en ${contact.city}` : ""}`, bookingUrl && "Cita online"].filter(Boolean).join(" · ");
  const showServices = sections.services && services.length > 0;
  const checks = heroChecks(props);

  return (
    <Wrap className="flex flex-wrap items-center gap-14 py-[clamp(48px,8vw,96px)]">
      <div className="flex min-w-0 flex-[1_1_480px] flex-col gap-7">
        <p className="m-0 inline-flex items-center gap-2.5 self-start rounded-full border border-solid border-(--ar-line) bg-white py-2 pr-4 pl-3 text-sm font-medium">
          <span className="size-2.5 rounded-full bg-(--ar-hl) shadow-[0_0_0_2px_var(--ar-dark)]" aria-hidden="true" />
          {pill}
        </p>
        <h1 className="ar-display ar-h1 m-0 text-[clamp(44px,6.4vw,84px)]">
          {words.length > 0 && <>{words.join(" ")} </>}
          <span className="ar-mark">{last}</span>
        </h1>
        {hero.subtitle && <p className="m-0 max-w-[34em] text-[clamp(17px,1.5vw,19px)] leading-relaxed text-muted">{hero.subtitle}</p>}
        <div className="flex flex-wrap gap-3">
          {bookingUrl ? (
            <Btn href={link(bookingUrl)} size="xl">
              Reservar valoración <Arrow />
            </Btn>
          ) : (
            contact.phone && (
              <Btn href={telHref(contact.phone)} size="xl">
                <Phone /> {contact.phone}
              </Btn>
            )
          )}
          {showServices && (
            <Btn href="#tratamientos" tone="outline" size="xl">
              Ver tratamientos
            </Btn>
          )}
        </div>
        {checks.length > 0 && (
          <ul className="m-0 mt-2 flex list-none flex-wrap gap-x-6 gap-y-2.5 p-0 text-sm font-medium">
            {checks.map((c) => (
              <li key={c} className="flex items-center gap-2">
                <Check className="text-(--ar-dark)" />
                {c}
              </li>
            ))}
          </ul>
        )}
      </div>
      <RomDial />
    </Wrap>
  );
}

// ---------- The dial ----------

// A point of the dial's arc at `deg` (0° left, 180° right)
const onArc = (deg: number, r = 170) => {
  const t = (deg * Math.PI) / 180;
  return [200 - r * Math.cos(t), 210 - r * Math.sin(t)].map((v) => Math.round(v * 10) / 10) as [number, number];
};

// An example of how progress is tracked (a knee after surgery: 70° → 135°).
// Labelled as an example: it's the template's illustration, not a patient
export function RomDial() {
  const [ex, ey] = onArc(135);
  const weeks = [
    ["Semana 1", "70°"],
    ["Semana 4", "110°"],
    ["Semana 6", "135°"],
  ];
  return (
    <div className="box-border flex min-w-0 flex-[1_1_420px] flex-col gap-5 rounded-[32px] bg-(--ar-dark) p-[clamp(24px,3.5vw,40px)] text-white">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-(--ar-on-dark-muted)">Ejemplo de seguimiento</span>
        <span className="rounded-full bg-(--ar-hl) px-3 py-1.5 text-[13px] font-semibold text-(--ar-dark)">Rodilla · postoperatorio</span>
      </div>
      <svg viewBox="0 0 400 236" width="100%" role="img" aria-label="Rango de movimiento de rodilla: de 70 grados en la semana 1 a 135 grados en la semana 6" className="block h-auto">
        <path d="M30 210 A170 170 0 0 1 370 210" fill="none" stroke="#fff" strokeOpacity={0.14} strokeWidth={22} strokeLinecap="round" />
        <path d={`M30 210 A170 170 0 0 1 ${ex} ${ey}`} fill="none" strokeWidth={22} strokeLinecap="round" style={{ stroke: "var(--ar-hl)" }} />
        <line x1={150.4} y1={73.7} x2={135} y2={31.5} stroke="#fff" strokeWidth={3} strokeLinecap="round" />
        <text x={124} y={22} fontSize={13} fontFamily="Inter, sans-serif" textAnchor="middle" style={{ fill: "var(--ar-on-dark-muted)" }}>
          Sem. 1
        </text>
        <circle cx={ex} cy={ey} r={16} strokeWidth={6} style={{ fill: "var(--ar-hl)", stroke: "var(--ar-dark)" }} />
        <text x={200} y={178} fill="#fff" fontSize={68} fontWeight={700} fontFamily="'Bricolage Grotesque', sans-serif" textAnchor="middle" letterSpacing={-2}>
          135°
        </text>
        <text x={200} y={208} fontSize={15} fontFamily="Inter, sans-serif" textAnchor="middle" style={{ fill: "var(--ar-on-dark-muted)" }}>
          flexión de rodilla
        </text>
        <text x={30} y={234} fontSize={13} fontFamily="Inter, sans-serif" textAnchor="middle" style={{ fill: "var(--ar-on-dark-muted)" }}>
          0°
        </text>
        <text x={370} y={234} fontSize={13} fontFamily="Inter, sans-serif" textAnchor="middle" style={{ fill: "var(--ar-on-dark-muted)" }}>
          180°
        </text>
      </svg>
      <div className="grid grid-cols-3 gap-2.5">
        {weeks.map(([label, value], i) => (
          <div key={label} className="flex flex-col gap-0.5 rounded-2xl bg-white/[.07] px-4 py-3.5">
            <span className="text-[13px] text-(--ar-on-dark-muted)">{label}</span>
            <span className={cn("ar-display text-[26px]", i === 2 && "text-(--ar-hl)")}>{value}</span>
          </div>
        ))}
      </div>
      <p className="m-0 text-sm leading-normal text-(--ar-on-dark-muted)">Medimos tu evolución con pruebas funcionales en cada revisión.</p>
    </div>
  );
}

// ---------- Method: 0°, 90°, 180° ----------

const METHOD = [
  { deg: "0°", title: "Valoración", text: "Historia clínica, exploración, pruebas funcionales y mediciones de partida. Sales con un diagnóstico de fisioterapia claro y un plan por escrito." },
  { deg: "90°", title: "Tratamiento", text: "Terapia manual, ejercicio terapéutico y técnicas específicas para tu caso. Revisamos tu evolución y ajustamos el plan." },
  { deg: "180°", title: "Autonomía", text: "El objetivo es que no nos necesites. Te llevas un programa de ejercicios para casa y pautas para evitar recaídas." },
];

function MiniArc({ step }: { step: number }) {
  const dot = [
    [5, 30],
    [28, 7],
    [51, 30],
  ][step]!;
  return (
    <svg width="56" height="34" viewBox="0 0 56 34" aria-hidden="true" className="shrink-0">
      <path d="M5 30 A23 23 0 0 1 51 30" fill="none" strokeWidth={6} strokeLinecap="round" style={{ stroke: step === 2 ? "var(--ar-dark)" : "var(--ar-line)" }} />
      {step === 1 && <path d="M5 30 A23 23 0 0 1 28 7" fill="none" strokeWidth={6} strokeLinecap="round" style={{ stroke: "var(--ar-dark)" }} />}
      <circle cx={dot[0]} cy={dot[1]} r={5} strokeWidth={2.5} style={{ fill: "var(--ar-hl)", stroke: "var(--ar-dark)" }} />
    </svg>
  );
}

export function Method() {
  return (
    <Band tone="white" id="metodo">
      <SectionHeader eyebrow="Cómo trabajamos" title="Un método en tres ángulos." lead="Del primer día a la última sesión, cada paso tiene un objetivo medible. Sin sesiones de relleno." />
      <ol className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-5 p-0">
        {METHOD.map((m, i) => (
          <li key={m.title} className="flex flex-col gap-4 rounded-[28px] bg-(--ar-bg) p-8">
            <div className="flex items-end gap-3.5">
              <MiniArc step={i} />
              <span className="ar-num text-[52px] leading-[.85]">{m.deg}</span>
            </div>
            <h3 className="ar-display ar-h3 mt-2 mb-0 text-2xl">{m.title}</h3>
            <p className="m-0 leading-relaxed text-muted">{m.text}</p>
          </li>
        ))}
      </ol>
    </Band>
  );
}

// ---------- Treatments ----------

export function TreatmentCard({ service, props }: { service: SiteService; props: SitePageProps }) {
  const { bookingUrl, link } = props;
  const dark = service.isGroup;
  const Tag = bookingUrl ? "a" : "div";
  return (
    <Tag
      {...(bookingUrl ? { href: link(bookingUrl), "aria-label": `${service.name}: reservar` } : {})}
      className={cn(
        "box-border flex h-full min-h-[250px] flex-col gap-3.5 rounded-[28px] border border-solid p-7 no-underline transition-colors",
        dark ? "border-(--ar-dark) bg-(--ar-dark) text-white" : "border-(--ar-line) bg-white text-ink hover:border-(--ar-line-strong)",
      )}
    >
      <span className={cn("self-start rounded-full px-3 py-[5px] text-[13px] font-semibold", dark ? "bg-(--ar-hl) text-(--ar-dark)" : "bg-(--ar-tag)")}>
        {dark ? "Grupos reducidos" : "Sesión individual"}
      </span>
      <h3 className="ar-display ar-h3 m-0 text-[25px]">{service.name}</h3>
      {service.description && <p className={cn("m-0 line-clamp-4 leading-relaxed", dark ? "text-(--ar-on-dark-muted)" : "text-muted")}>{service.description}</p>}
      <span className="mt-auto flex items-center justify-between gap-3 pt-2 text-[15px] font-semibold">
        <span>{bookingUrl ? "Reservar →" : formatPrice(service.priceCents)}</span>
        <span className={cn("font-medium", dark ? "text-(--ar-on-dark-muted)" : "text-muted")}>{formatDuration(service.durationMinutes)}</span>
      </span>
    </Tag>
  );
}

export function Treatments({ props, limit }: P & { limit?: number }) {
  const { services, link } = props;
  const list = limit ? services.slice(0, limit) : services;
  const more = limit && pageAvailable("servicios", props);
  return (
    <Band id="tratamientos" className="gap-10">
      <SectionHeader
        eyebrow="Tratamientos"
        title="Qué tratamos."
        action={
          more && (
            <a href={link("/servicios")} className="inline-flex min-h-11 items-center gap-2 font-semibold text-ink underline underline-offset-4">
              {services.length > list.length ? `Ver los ${services.length} tratamientos` : "Ver todos los tratamientos"}
            </a>
          )
        }
      />
      <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] gap-5 p-0">
        {list.map((s) => (
          <li key={s.name}>
            <TreatmentCard service={s} props={props} />
          </li>
        ))}
      </ul>
    </Band>
  );
}

// ---------- Manifesto band ----------

export function Manifesto({ props }: P) {
  const { bookingUrl, link, content } = props;
  const phone = content.contact.phone;
  return (
    <section className="bg-(--ar-dark) text-white">
      <Wrap className="flex flex-col gap-10 py-[clamp(72px,9vw,120px)]">
        <p className="ar-display ar-h2 m-0 max-w-[16em] text-[clamp(34px,5vw,68px)] leading-[1.04]">
          No tratamos lesiones. Ayudamos a personas a volver a <span className="text-(--ar-hl)">correr, cargar a sus hijos y dormir del tirón.</span>
        </p>
        {(bookingUrl || phone) && (
          <div className="flex flex-wrap items-center justify-between gap-6">
            <p className="m-0 max-w-[32em] flex-[1_1_320px] text-[17px] leading-relaxed text-(--ar-on-dark-muted)">Cuéntanos qué quieres recuperar. En la primera visita lo convertimos en objetivos concretos.</p>
            {bookingUrl ? (
              <Btn href={link(bookingUrl)} tone="hl" size="xl">
                Reservar valoración
              </Btn>
            ) : (
              <Btn href={telHref(phone!)} tone="hl" size="xl">
                <Phone /> {phone}
              </Btn>
            )}
          </div>
        )}
      </Wrap>
    </section>
  );
}

// ---------- Team ----------

function TeamCard({ member, full }: { member: SiteTeamMember; full?: boolean }) {
  const role = [member.headline, member.licenseNumber && `Nº col. ${member.licenseNumber}`].filter(Boolean).join(" · ");
  return (
    <article className="flex flex-col gap-3.5">
      <div className="flex aspect-[4/5] items-center justify-center overflow-hidden rounded-[28px] bg-(--ar-line)">
        {member.photoUrl ? (
          <img src={member.photoUrl} alt={member.name} loading="lazy" className="size-full object-cover" />
        ) : (
          <span className="ar-num text-[64px] text-(--ar-dark)" aria-hidden="true">
            {initials(member.name)}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="ar-display ar-h3 m-0 text-[22px]">{member.name}</h3>
        {role && <p className="m-0 text-[15px] text-muted">{role}</p>}
        {member.bio && <p className={cn("mt-2 mb-0 text-[15px] leading-relaxed text-muted", !full && "line-clamp-3")}>{member.bio}</p>}
      </div>
    </article>
  );
}

export function Team({ props, limit, full, tone = "page" }: P & { limit?: number; full?: boolean; tone?: "page" | "white" }) {
  const { team, link } = props;
  const list = limit ? team.slice(0, limit) : team;
  return (
    <Band id="equipo" tone={tone}>
      {!full && (
        <SectionHeader
          eyebrow="Equipo"
          title="Siempre la misma persona."
          lead="Fisioterapeutas colegiados. Te acompaña quien te valoró desde el primer día."
          action={
            team.length > list.length &&
            pageAvailable("equipo", props) && (
              <a href={link("/equipo")} className="inline-flex min-h-11 items-center font-semibold text-ink underline underline-offset-4">
                Todo el equipo
              </a>
            )
          }
        />
      )}
      <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(260px,100%),1fr))] gap-6 p-0">
        {list.map((m) => (
          <li key={m.name}>
            <TeamCard member={m} full={full} />
          </li>
        ))}
      </ul>
    </Band>
  );
}

// ---------- Prices ----------

function PriceCard({ service, featured, props }: { service: SiteService; featured?: boolean; props: SitePageProps }) {
  const { bookingUrl, link, content } = props;
  const phone = content.contact.phone;
  const points = [
    `${formatDuration(service.durationMinutes)}`,
    service.isGroup ? "Grupo reducido, guiado por fisioterapeutas" : "Un fisioterapeuta, un paciente",
    bookingUrl ? "Reserva online en un minuto" : phone ? "Reserva por teléfono" : null,
  ].filter((p): p is string => !!p);
  return (
    <article className={cn("box-border flex h-full flex-col gap-5 rounded-[28px] p-8", featured ? "bg-(--ar-dark) text-white" : "border border-solid border-(--ar-line) bg-(--ar-bg)")}>
      <h3 className="m-0 font-sans text-[17px] font-semibold text-inherit">{service.name}</h3>
      <p className="m-0">
        <span className={cn("ar-display text-5xl leading-none tracking-[-.03em]", featured && "text-(--ar-hl)")}>{formatPrice(service.priceCents)}</span>
      </p>
      {service.description && <p className={cn("m-0 text-[15px] leading-relaxed", featured ? "text-(--ar-on-dark-muted)" : "text-muted")}>{service.description}</p>}
      <ul className="m-0 flex list-none flex-col gap-2.5 p-0 text-[15px]">
        {points.map((p) => (
          <li key={p} className="flex items-start gap-2.5">
            <Check className={cn("mt-0.5", featured ? "text-(--ar-hl)" : "text-(--ar-dark)")} />
            {p}
          </li>
        ))}
      </ul>
      {(bookingUrl || phone) && (
        <Btn href={bookingUrl ? link(bookingUrl) : telHref(phone!)} tone={featured ? "hl" : "outline"} className="mt-auto w-full">
          {bookingUrl ? "Reservar" : "Llamar"}
        </Btn>
      )}
    </article>
  );
}

// The highlighted card: the middle one of three, otherwise the second
const featuredIndex = (n: number) => (n >= 2 ? 1 : 0);

export function Prices({ props, list, eyebrow = "Tarifas", title = "Precios claros, sin sorpresas.", lead, more, tone = "white", id = "tarifas" }: P & { list: SiteService[]; eyebrow?: string; title?: string; lead?: string; more?: boolean; tone?: "page" | "white"; id?: string }) {
  const { link, services } = props;
  return (
    <Band tone={tone} id={id}>
      <SectionHeader
        eyebrow={eyebrow}
        title={title}
        lead={lead ?? "El precio de cada sesión, a la vista antes de reservar. Pagas en la clínica."}
        action={
          more && (
            <a href={link("/servicios")} className="inline-flex min-h-11 items-center font-semibold text-ink underline underline-offset-4">
              Ver las {services.length} tarifas
            </a>
          )
        }
      />
      <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(280px,100%),1fr))] items-stretch gap-5 p-0">
        {list.map((s, i) => (
          <li key={s.name}>
            <PriceCard service={s} featured={list.length > 1 && i === featuredIndex(list.length)} props={props} />
          </li>
        ))}
      </ul>
    </Band>
  );
}

// ---------- About ----------

export function About({ props, full, tone = "page" }: P & { full?: boolean; tone?: "page" | "white" }) {
  const { content, clinic, img, link } = props;
  const { about, highlights, sections } = content;
  const hasText = sections.about && !!about?.text;
  const photo = img(content.coverId) ?? img(content.galleryIds[0]);
  if (!hasText && !highlights.length) return null;
  return (
    <Band id="nosotros" tone={tone}>
      <SectionHeader eyebrow="Nosotros" title={about?.title || `Esto es ${clinic.name}.`} />
      {hasText && (
        <div className="flex flex-wrap items-start gap-10">
          <div className={cn("flex min-w-0 flex-[1_1_420px] flex-col gap-4 text-[17px] leading-relaxed text-muted", !full && "[&>p:nth-child(n+3)]:hidden")}>
            <Paragraphs text={about!.text} className="m-0" />
            {!full && pageAvailable("nosotros", props) && (
              <a href={link("/nosotros")} className="inline-flex min-h-11 items-center gap-2 self-start font-semibold text-ink underline underline-offset-4">
                Conoce el centro
              </a>
            )}
          </div>
          {photo && (
            <div className="min-w-0 flex-[1_1_380px] overflow-hidden rounded-[28px] bg-(--ar-line)">
              <img src={photo} alt="" loading="lazy" className="block aspect-[4/3] size-full object-cover" />
            </div>
          )}
        </div>
      )}
      {highlights.length > 0 && (
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(260px,100%),1fr))] gap-5 p-0">
          {highlights.map((h) => (
            <li key={h.title} className={cn("flex flex-col gap-3 rounded-[28px] p-7", tone === "white" ? "bg-(--ar-bg)" : "border border-solid border-(--ar-line) bg-white")}>
              <span className="flex size-10 items-center justify-center rounded-full bg-(--ar-hl) text-(--ar-dark)">
                <Check />
              </span>
              <h3 className="ar-display ar-h3 m-0 text-[22px]">{h.title}</h3>
              {h.text && <p className="m-0 text-[15px] leading-relaxed text-muted">{h.text}</p>}
            </li>
          ))}
        </ul>
      )}
    </Band>
  );
}

export function Gallery({ images }: { images: string[] }) {
  return (
    <ul className="m-0 grid list-none grid-cols-2 gap-4 p-0 md:grid-cols-4">
      {images.map((src, i) => (
        <li key={src} className={cn("overflow-hidden rounded-[28px] bg-(--ar-line)", i === 0 && "col-span-2 row-span-2")}>
          <img src={src} alt="" loading="lazy" className="block aspect-square size-full object-cover" />
        </li>
      ))}
    </ul>
  );
}

// ---------- FAQ ----------

export function Faq({ props, tone = "white" }: P & { tone?: "page" | "white" }) {
  const { faq, contact } = props.content;
  return (
    <Band id="preguntas" tone={tone}>
      <div className="flex flex-wrap items-start gap-x-14 gap-y-10">
        <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-3.5">
          <p className="ar-eyebrow">Preguntas frecuentes</p>
          <h2 className="ar-display ar-h2 m-0 text-[clamp(34px,4.2vw,54px)]">Lo que nos preguntan.</h2>
          {(contact.phone || contact.whatsapp) && (
            <>
              <p className="mt-2 mb-0 text-[17px] leading-relaxed text-muted">¿No encuentras tu respuesta? Pregúntanos sin compromiso.</p>
              <div className="flex flex-wrap gap-3">
                {contact.whatsapp && (
                  <Btn href={whatsappHref(contact.whatsapp)} external tone="outline" size="md">
                    WhatsApp
                  </Btn>
                )}
                {contact.phone && (
                  <Btn href={telHref(contact.phone)} size="md">
                    Llamar
                  </Btn>
                )}
              </div>
            </>
          )}
        </div>
        <Accordion className="ar-faq min-w-0 flex-[2_1_480px]">
          {faq.map((f) => (
            <AccordionItem key={f.q} title={f.q} name="ar-faq">
              <Paragraphs text={f.a} className="m-0 mb-2 last:mb-0" />
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </Band>
  );
}

// ---------- Contact ----------

export function Contact({ props, title = "Ven a vernos.", tone = "page", withHeader = true }: P & { title?: string; tone?: "page" | "white"; withHeader?: boolean }) {
  const { content, hours, bookingUrl, link } = props;
  const c = content.contact;
  const address = fullAddress(c);
  const place = [c.postalCode, c.city].filter(Boolean).join(" ");
  const summary = content.sections.hours ? hoursSummary(hours) : [];

  type Row = { label: string; value: ReactNode };
  const rows = ([
    address && {
      label: "Dirección",
      value: (
        <>
          {c.address}
          {c.address && place && <br />}
          {place}
        </>
      ),
    },
    summary.length > 0 && {
      label: "Horario",
      value: (
        <>
          {summary.map((s, i) => (
            <span key={s} className="block">
              {s}
              {i < summary.length - 1 && " "}
            </span>
          ))}
          <Status props={props} className="mt-2 text-muted" />
        </>
      ),
    },
    c.phone && { label: "Teléfono", value: <a href={telHref(c.phone)} className="text-ink no-underline hover:underline">{c.phone}</a> },
    c.email && { label: "Email", value: <a href={`mailto:${c.email}`} className="break-all text-ink no-underline hover:underline">{c.email}</a> },
    c.whatsapp && { label: "WhatsApp", value: <a href={whatsappHref(c.whatsapp)} target="_blank" rel="noopener" className="text-ink no-underline hover:underline">Escríbenos</a> },
  ] as (Row | false | "" | undefined)[]).filter((r): r is Row => !!r);

  return (
    <section id="contacto" className={cn(tone === "white" && "border-y border-solid border-x-0 border-(--ar-line) bg-white")}>
      <Wrap className="flex flex-wrap gap-8 py-[clamp(64px,8vw,104px)]">
        <div className="flex min-w-0 flex-[1_1_380px] flex-col gap-7">
          {withHeader && (
            <div className="flex flex-col gap-3.5">
              <p className="ar-eyebrow">Contacto</p>
              <h2 className="ar-display ar-h2 m-0 text-[clamp(34px,4.2vw,54px)]">{title}</h2>
            </div>
          )}
          {rows.length > 0 && (
            <dl className="m-0 grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] gap-6">
              {rows.map((r) => (
                <div key={r.label} className="flex flex-col gap-1">
                  <dt className="text-sm text-muted">{r.label}</dt>
                  <dd className="m-0 font-medium">{r.value}</dd>
                </div>
              ))}
            </dl>
          )}
          <div className="flex flex-wrap gap-3">
            {bookingUrl && <Btn href={link(bookingUrl)}>Reservar cita online</Btn>}
            {c.phone && (
              <Btn href={telHref(c.phone)} tone="outline">
                Llamar
              </Btn>
            )}
          </div>
          <SocialLinks content={content} />
        </div>
        {address && (
          <div className="ar-grid box-border flex min-h-[380px] min-w-0 flex-[1_1_420px] flex-col items-center justify-center gap-4 rounded-[28px] p-6 text-center">
            <span className="text-(--ar-dark)">
              <Pin size={44} />
            </span>
            <span className="max-w-[22rem] rounded-full bg-(--ar-bg) px-4 py-2 text-sm font-medium">{address}</span>
            {c.mapsUrl && (
              <Btn href={c.mapsUrl} external size="md">
                Cómo llegar <Arrow />
              </Btn>
            )}
          </div>
        )}
      </Wrap>
    </section>
  );
}

// ---------- Inner pages ----------

export function PageHead({ props, crumb, title, lead, children }: P & { crumb: string; title: string; lead?: string; children?: ReactNode }) {
  return (
    <section className="border-y border-x-0 border-t-0 border-solid border-(--ar-line)">
      <Wrap className="flex flex-col gap-6 py-[clamp(40px,6vw,80px)]">
        <div className="ar-crumb">
          <Breadcrumb items={[{ label: "Inicio", href: props.link("/") }, { label: crumb }]} />
        </div>
        <h1 className="ar-display ar-h1 m-0 max-w-[14em] text-[clamp(40px,5.6vw,72px)]">{title}</h1>
        {lead && <p className="m-0 max-w-[36em] text-[clamp(17px,1.5vw,19px)] leading-relaxed text-muted">{lead}</p>}
        {children}
      </Wrap>
    </section>
  );
}
