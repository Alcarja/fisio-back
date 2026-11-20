import type { ReactNode } from "react";
import { Paragraphs, SocialLinks } from "../shared/blocks.js";
import { cn } from "../shared/cn.js";
import { formatDuration, formatPrice, hoursSummary, initials, openStatus, telHref, whatsappHref } from "../shared/format.js";
import { pageAvailable } from "../shared/pages.js";
import type { SitePageProps, SiteService, SiteTeamMember } from "../types.js";
import { CONDITIONS, DEFAULT_ZONE, ZONES } from "./zones.js";

// Zona: the site starts with the patient. The hero asks where it hurts and
// lets them pick a body zone (radios + CSS, no JavaScript). Editorial and
// clinical: white, black and the clinic's colour, very heavy Archivo, mono
// labels like a medical file and sections numbered 01, 02… in the order they
// appear. Fluid layout: flex-wrap and auto-fit grids.

type P = { props: SitePageProps };

// ---------- Colour ----------

const rgb = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
const toHex = (c: number[]) => `#${c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;
function luminance(hex: string) {
  const [r, g, b] = rgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

// White text sits on the accent everywhere (even at 56 % in the zone list):
// the clinic's colour is darkened until that reads well
export function zonaAccent(primary: string) {
  const base = rgb(primary);
  let accent = primary;
  for (let k = 1; luminance(accent) > 0.15 && k > 0.15; k -= 0.05) accent = toHex(base.map((v) => v * k));
  return accent;
}

// ---------- Layout pieces ----------

export function Wrap({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("mx-auto box-border w-full max-w-[82.5rem] px-[clamp(20px,4vw,40px)]", className)}>{children}</div>;
}

const pad = "py-[clamp(64px,8vw,112px)]";
const num = (n: number) => String(n).padStart(2, "0");

// "01 — TRATAMIENTOS": in the accent on white, light on black or on the accent
export function Label({ n, children, tone = "accent", className }: { n?: number; children: ReactNode; tone?: "accent" | "dark" | "color" | "muted"; className?: string }) {
  return (
    <p
      className={cn(
        "zn-mono m-0 text-[13px]",
        tone === "accent" && "text-(--zn-accent)",
        tone === "dark" && "text-(--zn-on-dark-label)",
        tone === "color" && "text-white/85",
        tone === "muted" && "text-muted",
        className,
      )}
    >
      {n !== undefined && <>{num(n)} — </>}
      {children}
    </p>
  );
}

const h2 = "zn-x m-0 text-[clamp(36px,4vw,56px)] leading-[.95] tracking-[-.045em]";

type Tone = "accent" | "ink" | "outline" | "white";
const TONES: Record<Tone, string> = {
  accent: "bg-(--zn-accent) text-white hover:bg-[color-mix(in_srgb,var(--zn-accent)_85%,#000)]",
  ink: "bg-(--zn-ink) text-white hover:bg-[#2a2a2a]",
  outline: "border border-solid border-(--zn-ink) text-(--zn-ink) hover:bg-(--zn-tint)",
  white: "bg-white text-(--zn-accent) hover:bg-white/90",
};

export function Btn({ href, tone = "ink", external, className, children }: { href: string; tone?: Tone; external?: boolean; className?: string; children: ReactNode }) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener" } : {})}
      className={cn("box-border inline-flex min-h-[52px] items-center justify-center gap-2.5 rounded-[6px] px-[22px] font-semibold whitespace-nowrap no-underline transition-colors", TONES[tone], className)}
    >
      {children}
    </a>
  );
}

const svg = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

export const ArrowDiag = ({ size = 16 }: { size?: number }) => (
  <svg {...svg} width={size} height={size} strokeWidth={2.4} className="shrink-0">
    <path d="M7 17L17 7" />
    <path d="M8 7h9v9" />
  </svg>
);
export const ArrowRight = ({ size = 16 }: { size?: number }) => (
  <svg {...svg} width={size} height={size} strokeWidth={2.4} className="shrink-0">
    <path d="M5 12h14" />
    <path d="M13 6l6 6-6 6" />
  </svg>
);
const Plus = () => (
  <svg {...svg} width={16} height={16} strokeWidth={2.6}>
    <path d="M12 5v14" />
    <path d="M5 12h14" />
  </svg>
);

// ---------- Brand ----------

// "Arco Fisioterapia" → "Arco." with the dot in the accent and "FISIOTERAPIA"
// in mono, like the design. Only when the name ends with one of these words
const GENERIC = /^(fisioterapia|fisio|physio|clínica|clinica|centro|salud|rehabilitación|osteopatía)$/i;
function splitName(name: string): [string, string | null] {
  const words = name.trim().split(/\s+/);
  const last = words[words.length - 1] ?? "";
  return words.length > 1 && GENERIC.test(last) ? [words.slice(0, -1).join(" "), last] : [name, null];
}

export function Wordmark({ props, light, size = 30 }: P & { light?: boolean; size?: number }) {
  const { clinic, content, img, link } = props;
  const logo = img(content.logoId);
  const [main, sub] = splitName(clinic.name);
  return (
    <a href={link("/")} aria-label={`${clinic.name}, inicio`} className={cn("flex min-h-11 min-w-0 items-baseline gap-3 no-underline", light ? "text-white" : "text-(--zn-ink)")}>
      {logo && !light ? (
        <img src={logo} alt={clinic.name} className="block max-h-10 max-w-44 self-center object-contain" />
      ) : (
        <>
          <span className="zn-x truncate leading-none tracking-[-.05em]" style={{ fontSize: size }}>
            {main}
            <span className={light ? "text-white" : "text-(--zn-accent)"}>.</span>
          </span>
          {sub && <span className={cn("zn-mono hidden text-xs sm:inline", light ? "text-white/85" : "text-muted")}>{sub}</span>}
        </>
      )}
    </a>
  );
}

// ---------- Hero: "¿Dónde te duele?" ----------

const ZONE_CODE = (i: number) => num(i + 1);

export function Hero({ props }: P) {
  const { content, bookingUrl, link, services, team } = props;
  const { hero, contact } = content;
  const label = [`Fisioterapia${contact.city ? ` en ${contact.city}` : ""}`, bookingUrl && "Cita online"].filter(Boolean).join(" — ");
  const showServices = content.sections.services && services.length > 0;
  const showTeam = content.sections.team && team.length > 0;
  const facts = [
    `${ZONES.length} zonas`,
    showServices && `${services.length} ${services.length === 1 ? "tratamiento" : "tratamientos"}`,
    showTeam && `${team.length} ${team.length === 1 ? "fisioterapeuta" : "fisioterapeutas"}`,
  ].filter(Boolean);

  return (
    <section className="zn-hero">
      <Wrap className="grid gap-x-[clamp(32px,4vw,64px)] gap-y-7 pt-[clamp(32px,5vw,64px)] pb-[clamp(48px,6vw,80px)] lg:grid-cols-2 lg:grid-rows-[auto_1fr]">
          <div className="flex min-w-0 flex-col gap-6 lg:col-start-1 lg:row-start-1">
            <Label tone="muted">{label}</Label>
            <h1 className="zn-x m-0 text-[clamp(56px,8.2vw,132px)] leading-[.88] tracking-[-.055em]">{hero.title}</h1>
            <p className="m-0 max-w-[30em] text-[clamp(17px,1.5vw,20px)] leading-[1.55] text-(--zn-text2)">
              {hero.subtitle ?? "Elige una zona y te contamos qué solemos tratar y cómo lo hacemos."}
              {contact.phone && (
                <>
                  {" "}
                  ¿Prefieres hablar? Llámanos al{" "}
                  <a href={telHref(contact.phone)} className="font-semibold text-(--zn-ink)">
                    {contact.phone}
                  </a>
                  .
                </>
              )}
            </p>
          </div>

        <fieldset className="zn-on-color m-0 box-border flex min-w-0 flex-col lg:col-start-2 lg:row-span-2 lg:row-start-1 justify-between gap-7 rounded-[12px] border-0 bg-(--zn-accent) p-[clamp(24px,3vw,40px)] text-white">
          <legend className="sr-only">¿Dónde te duele? Elige una zona del cuerpo</legend>
          <div className="zn-mono flex justify-between text-xs text-white/90" aria-hidden="true">
            <span>Elige una zona</span>
            <span>{num(ZONES.length)}</span>
          </div>
          <ul className="m-0 flex list-none flex-col border-x-0 border-t-0 border-b border-solid border-white/30 p-0">
            {ZONES.map((z, i) => (
              <li key={z.id} className="relative border-x-0 border-t border-b-0 border-solid border-white/30">
                <input type="radio" name="zn-zone" id={`zn-z-${z.id}`} value={z.id} defaultChecked={z.id === DEFAULT_ZONE} className="zn-radio" />
                <label htmlFor={`zn-z-${z.id}`} className="zn-zone zn-x flex min-h-16 items-center gap-4 py-2.5 text-[clamp(28px,3.3vw,46px)] leading-none tracking-[-.04em]">
                  <span className="zn-mono flex-[0_0_32px] text-[13px] font-normal tracking-[.04em]">{ZONE_CODE(i)}</span>
                  <span className="min-w-0 flex-auto">{z.name}</span>
                  <span className="zn-arrow flex size-11 flex-none items-center justify-center rounded-[6px] bg-white text-(--zn-accent)" aria-hidden="true">
                    <ArrowRight size={20} />
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <p className="zn-mono m-0 text-xs text-white/90">{facts.join(" · ")}</p>
        </fieldset>

          <div aria-live="polite" className="min-w-0 self-end lg:col-start-1 lg:row-start-2">
            {ZONES.map((z, i) => (
              <div key={z.id} data-zone={z.id} className="zn-panel flex-col gap-[18px] rounded-[10px] border border-solid border-(--zn-ink) p-[clamp(20px,2.5vw,28px)]">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="zn-mono text-xs text-muted">
                    Zona {ZONE_CODE(i)} / {num(ZONES.length)}
                  </span>
                  <span className="zn-mono rounded-[4px] bg-(--zn-tint) px-2.5 py-1 text-xs">{z.tag}</span>
                </div>
                <h2 className="zn-x m-0 text-[clamp(32px,3.2vw,44px)] leading-none tracking-[-.04em]">{z.name}</h2>
                <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
                  {z.conditions.map((c) => (
                    <li key={c} className="rounded-full border border-solid border-(--zn-line) px-3.5 py-2 text-[15px]">
                      {c}
                    </li>
                  ))}
                </ul>
                <p className="m-0 leading-relaxed text-(--zn-text2)">{z.text}</p>
                {bookingUrl ? (
                  <Btn href={link(bookingUrl)} className="self-start whitespace-normal">
                    Reservar valoración de {z.short.toLowerCase()} <ArrowRight />
                  </Btn>
                ) : (
                  contact.phone && (
                    <Btn href={telHref(contact.phone)} className="self-start">
                      Pedir cita: {contact.phone}
                    </Btn>
                  )
                )}
              </div>
            ))}
          </div>
      </Wrap>
    </section>
  );
}

// ---------- Conditions ticker (decorative) ----------

export function Ticker() {
  const line = CONDITIONS.join("  /  ") + "  /  ";
  return (
    <div aria-hidden="true" className="zn-mono overflow-hidden bg-(--zn-accent) py-5 text-[15px] tracking-[.08em] whitespace-pre text-white">
      <div className="zn-ticker-track">
        <span className="pl-10">{line}</span>
        <span className="pl-10">{line}</span>
      </div>
    </div>
  );
}

// ---------- Section heads ----------

// Label + title (+ lead) in a narrow column beside the content
function SideHead({ n, label, title, lead, nested }: { n?: number; label: string; title: ReactNode; lead?: ReactNode; nested?: boolean }) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-4", !nested && "flex-[1_1_360px]")}>
      <Label n={n}>{label}</Label>
      <h2 className={h2}>{title}</h2>
      {lead && <p className="m-0 max-w-[24em] leading-relaxed text-muted">{lead}</p>}
    </div>
  );
}

// Label + title on the left, a lead on the right, bottom-aligned
function RowHead({ n, label, title, lead, dark, action }: { n?: number; label: string; title: ReactNode; lead?: ReactNode; dark?: boolean; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-16 gap-y-5">
      <div className="flex min-w-0 flex-[1_1_480px] flex-col gap-4">
        <Label n={n} tone={dark ? "dark" : "accent"}>
          {label}
        </Label>
        <h2 className={cn(h2, dark && "text-[clamp(36px,4.6vw,64px)]")}>{title}</h2>
      </div>
      {lead && <p className={cn("m-0 max-w-[26em] min-w-0 flex-[1_1_300px] leading-relaxed", dark ? "text-(--zn-on-dark-2)" : "text-muted")}>{lead}</p>}
      {action}
    </div>
  );
}

const MoreLink = ({ href, children }: { href: string; children: ReactNode }) => (
  <a href={href} className="zn-mono inline-flex min-h-11 items-center gap-2 text-[13px] text-(--zn-ink) underline underline-offset-4">
    {children} <ArrowDiag size={14} />
  </a>
);

// ---------- Treatments index ----------

const COUNT = ["", "Un", "Dos", "Tres", "Cuatro", "Cinco", "Seis", "Siete", "Ocho", "Nueve", "Diez", "Once", "Doce"];

function serviceLine(s: SiteService) {
  return s.description || `${formatDuration(s.durationMinutes)}${s.isGroup ? " · en grupo reducido" : " · sesión individual"}`;
}

export function Treatments({ props, n, limit }: P & { n?: number; limit?: number }) {
  const { services, bookingUrl, link } = props;
  const list = limit ? services.slice(0, limit) : services;
  const href = bookingUrl ? link(bookingUrl) : pageAvailable("servicios", props) ? link("/servicios") : null;
  const total = services.length;
  const title = total >= 2 && total <= 12 ? `${COUNT[total]} tratamientos, un mismo criterio.` : "Un mismo criterio, en cada sesión.";
  return (
    <section id="tratamientos">
      <Wrap className={cn("flex flex-wrap gap-x-16 gap-y-8", pad)}>
        <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-4">
          <SideHead nested n={n} label="Tratamientos" title={title} lead="Tratamientos basados en la evidencia y adaptados a tu momento: dolor agudo, recuperación o rendimiento." />
          {limit && total > list.length && pageAvailable("servicios", props) && <MoreLink href={link("/servicios")}>Ver los {total}</MoreLink>}
        </div>
        <ol className="m-0 min-w-0 flex-[999_1_640px] list-none border-x-0 border-t-0 border-b border-solid border-(--zn-ink) p-0">
          {list.map((s, i) => {
            const inner = (
              <>
                <span className="zn-mono flex-[0_0_48px] text-sm text-muted">{num(i + 1)}</span>
                <span className="flex-[1_1_280px] text-[clamp(24px,2.4vw,34px)] leading-[1.05] font-bold tracking-[-.03em]">{s.name}</span>
                <span className="flex-[1_1_300px] text-[15px] leading-[1.55] text-muted">{serviceLine(s)}</span>
                {href && (
                  <span className="flex size-12 flex-[0_0_48px] items-center justify-center rounded-[6px] border border-solid border-(--zn-ink) transition-colors group-hover:bg-(--zn-accent) group-hover:border-(--zn-accent) group-hover:text-white">
                    <ArrowDiag size={18} />
                  </span>
                )}
              </>
            );
            const row = "flex flex-wrap items-center gap-x-6 gap-y-3 py-7 text-(--zn-ink) no-underline";
            return (
              <li key={s.name} className="border-x-0 border-t border-b-0 border-solid border-(--zn-ink)">
                {href ? (
                  <a href={href} className={cn(row, "group")} aria-label={`${s.name}${bookingUrl ? ": reservar" : ""}`}>
                    {inner}
                  </a>
                ) : (
                  <div className={row}>{inner}</div>
                )}
              </li>
            );
          })}
        </ol>
      </Wrap>
    </section>
  );
}

// ---------- Method: timeline on black ----------

const STEPS = [
  { when: "Día 1", title: "Valoración", text: "Exploración completa, pruebas funcionales y un diagnóstico de fisioterapia que entiendas." },
  { when: "Semanas 1–2", title: "Alivio", text: "Bajamos el dolor con terapia manual y ejercicio dosificado, sin parar tu vida." },
  { when: "Semanas 3–6", title: "Fuerza y control", text: "Progresamos la carga para que el tejido tolere lo que le pides en tu día a día." },
  { when: "Alta", title: "Autonomía", text: "Te vas con un plan propio para mantener lo ganado y prevenir recaídas." },
];

export function Method({ n }: { n?: number }) {
  return (
    <section id="metodo" className="zn-on-color bg-(--zn-ink) text-white">
      <Wrap className={cn("flex flex-col gap-14", pad)}>
        <RowHead n={n} dark label="Método" title="De la primera visita al alta." lead="Tiempos orientativos: cada plan se ajusta a tu lesión y a cómo respondes." />
        <ol className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(230px,100%),1fr))] gap-x-6 gap-y-10 p-0">
          {STEPS.map((s, i) => (
            <li key={s.title} className="relative flex flex-col gap-3 border-x-0 border-t-2 border-b-0 border-solid border-white pt-6">
              <span className={cn("absolute -top-2 left-0 size-3.5 rounded-full shadow-[0_0_0_3px_var(--zn-ink)]", i === 0 ? "bg-(--zn-accent) shadow-[0_0_0_3px_var(--zn-ink),0_0_0_4px_rgba(255,255,255,.6)]" : "bg-white")} aria-hidden="true" />
              <span className="zn-mono text-[13px] text-(--zn-on-dark-label)">{s.when}</span>
              <h3 className="m-0 font-sans text-[28px] font-bold tracking-[-.03em] text-white">{s.title}</h3>
              <p className="m-0 text-[15px] leading-relaxed text-(--zn-on-dark-2)">{s.text}</p>
            </li>
          ))}
        </ol>
      </Wrap>
    </section>
  );
}

// ---------- Questions: statement card + accordion ----------

function Statement({ props, n }: P & { n?: number }) {
  const { services } = props;
  const single = services.filter((s) => !s.isGroup);
  const group = services.some((s) => s.isGroup);
  const [lines, text] = single.length
    ? [["Uno a uno.", group ? "O en grupo." : "Siempre."], `Sesiones individuales${single[0] ? ` de ${formatDuration(single[0].durationMinutes)}` : ""} con tu fisioterapeuta, de principio a fin.${group ? " Y clases en grupo reducido, siempre guiadas." : ""}`]
    : [["En grupo.", "Siempre guiado."], "Clases con plazas limitadas, guiadas por fisioterapeutas de principio a fin."];
  return (
    <div className="zn-on-color box-border flex min-h-[420px] min-w-0 flex-[1_1_380px] flex-col justify-between gap-10 rounded-[12px] bg-(--zn-accent) p-[clamp(28px,4vw,48px)] text-white">
      <Label n={n} tone="color">
        Preguntas
      </Label>
      <p className="zn-x m-0 text-[clamp(44px,5.4vw,80px)] leading-[.9] tracking-[-.05em]">
        {lines[0]}
        <br />
        {lines[1]}
      </p>
      <p className="m-0 max-w-[24em] leading-relaxed text-white/90">{text}</p>
    </div>
  );
}

export function Faq({ props, n }: P & { n?: number }) {
  const { faq } = props.content;
  return (
    <section id="preguntas">
      <Wrap className={cn("flex flex-wrap items-start gap-x-[clamp(32px,5vw,80px)] gap-y-8", pad)}>
        <Statement props={props} n={n} />
        <div className="zn-faq min-w-0 flex-[999_1_520px] border-x-0 border-t border-b-0 border-solid border-(--zn-ink)">
          <h2 className="sr-only">Preguntas frecuentes</h2>
          {faq.map((f, i) => (
            <details key={f.q} name="zn-faq" open={i === 0} className="border-x-0 border-t-0 border-b border-solid border-(--zn-ink)">
              <summary className="flex min-h-[76px] items-center justify-between gap-6 py-5 text-[clamp(19px,1.8vw,24px)] font-bold tracking-[-.02em]">
                <h3 className="m-0 font-sans text-inherit [font-weight:inherit] [letter-spacing:inherit]">{f.q}</h3>
                <span className="zn-plus box-border flex size-10 flex-none items-center justify-center rounded-[6px]" aria-hidden="true">
                  <Plus />
                </span>
              </summary>
              <div className="pr-16 pb-6 leading-[1.65] text-(--zn-text2)">
                <Paragraphs text={f.a} className="m-0 mb-2 last:mb-0" />
              </div>
            </details>
          ))}
        </div>
      </Wrap>
    </section>
  );
}

// ---------- Team ----------

function TeamCard({ member, full }: { member: SiteTeamMember; full?: boolean }) {
  return (
    <article className="flex items-stretch gap-5 rounded-[12px] border border-solid border-(--zn-line) p-4">
      <div className="flex h-[150px] w-[120px] flex-none items-center justify-center overflow-hidden rounded-[8px] bg-(--zn-tint)">
        {member.photoUrl ? (
          <img src={member.photoUrl} alt={member.name} loading="lazy" className="size-full object-cover" />
        ) : (
          <span className="zn-x text-4xl tracking-[-.04em] text-(--zn-accent)" aria-hidden="true">
            {initials(member.name)}
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-col justify-center gap-1.5">
        {member.headline && <span className="zn-mono text-xs text-muted">{member.headline}</span>}
        <h3 className="m-0 font-sans text-[22px] leading-[1.15] font-bold tracking-[-.02em]">{member.name}</h3>
        {member.licenseNumber && <p className="m-0 text-sm text-muted">Nº col. {member.licenseNumber}</p>}
        {full && member.bio && <p className="mt-2 mb-0 text-[15px] leading-relaxed text-(--zn-text2)">{member.bio}</p>}
      </div>
    </article>
  );
}

export function Team({ props, n, limit, full }: P & { n?: number; limit?: number; full?: boolean }) {
  const { team, link } = props;
  const list = limit ? team.slice(0, limit) : team;
  return (
    <section id="equipo" className="border-x-0 border-t border-b-0 border-solid border-(--zn-line)">
      <Wrap className={cn("flex flex-col gap-12", pad)}>
        {!full && (
          <RowHead
            n={n}
            label="Equipo"
            title="Quién te va a tratar."
            lead="Fisioterapeutas colegiados, cada uno especializado en un área."
            action={team.length > list.length && pageAvailable("equipo", props) && <MoreLink href={link("/equipo")}>Todo el equipo</MoreLink>}
          />
        )}
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(300px,100%),1fr))] gap-6 p-0">
          {list.map((m) => (
            <li key={m.name}>
              <TeamCard member={m} full={full} />
            </li>
          ))}
        </ul>
      </Wrap>
    </section>
  );
}

// ---------- Prices: a real table ----------

export function Prices({ props, n, list, title = "Sin letra pequeña.", id = "tarifas" }: P & { n?: number; list?: SiteService[]; title?: string; id?: string }) {
  const rows = list ?? props.services;
  return (
    <section id={id} className="bg-(--zn-tint)">
      <Wrap className={cn("flex flex-wrap gap-x-16 gap-y-8", pad)}>
        <SideHead n={n} label="Tarifas" title={title} lead="El precio de cada sesión, a la vista antes de reservar. Pagas en la clínica." />
        <div className="min-w-0 flex-[999_1_640px] overflow-x-auto">
          <table className="w-full min-w-[480px] border-collapse text-base">
            <caption className="zn-mono pb-3 text-left text-xs text-muted">Precios por sesión</caption>
            <thead>
              <tr className="border-x-0 border-t-0 border-b border-solid border-(--zn-ink)">
                <th scope="col" className="zn-mono py-3 text-left text-xs font-medium text-muted">
                  Servicio
                </th>
                <th scope="col" className="zn-mono py-3 text-left text-xs font-medium text-muted">
                  Duración
                </th>
                <th scope="col" className="zn-mono py-3 text-right text-xs font-medium text-muted">
                  Precio
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s, i) => (
                <tr key={s.name} className={cn("border-x-0 border-t-0 border-b border-solid", i === rows.length - 1 ? "border-(--zn-ink)" : "border-(--zn-tint-line)")}>
                  <th scope="row" className="py-[22px] pr-4 text-left text-xl font-bold tracking-[-.02em]">
                    {s.name}
                    {s.isGroup && <span className="zn-mono ml-3 rounded-[4px] bg-white px-2 py-0.5 align-middle text-[11px] font-normal tracking-[.06em] text-muted">Grupo</span>}
                  </th>
                  <td className="py-[22px] whitespace-nowrap text-(--zn-text2)">{formatDuration(s.durationMinutes)}</td>
                  <td className="zn-x py-[22px] text-right text-2xl whitespace-nowrap tracking-[-.03em]">{formatPrice(s.priceCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Wrap>
    </section>
  );
}

// ---------- About ----------

export function About({ props, n, full }: P & { n?: number; full?: boolean }) {
  const { content, clinic, img, link } = props;
  const { about, highlights, sections } = content;
  const hasText = sections.about && !!about?.text;
  const photo = img(content.coverId) ?? img(content.galleryIds[0]);
  if (!hasText && !highlights.length) return null;
  return (
    <section id="nosotros" className="border-x-0 border-t border-b-0 border-solid border-(--zn-line)">
      <Wrap className={cn("flex flex-wrap gap-x-16 gap-y-10", pad)}>
        <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-6">
          <SideHead nested n={n} label="Nosotros" title={about?.title || `Esto es ${clinic.name}.`} />
          {photo && <img src={photo} alt="" loading="lazy" className="block aspect-[4/3] w-full rounded-[12px] object-cover" />}
        </div>
        <div className="flex min-w-0 flex-[999_1_640px] flex-col gap-10">
          {hasText && (
            <div className={cn("flex flex-col gap-4 text-[clamp(17px,1.5vw,20px)] leading-[1.55] text-(--zn-text2)", !full && "[&>p:nth-child(n+3)]:hidden")}>
              <Paragraphs text={about!.text} className="m-0" />
              {!full && pageAvailable("nosotros", props) && <MoreLink href={link("/nosotros")}>Conoce el centro</MoreLink>}
            </div>
          )}
          {highlights.length > 0 && (
            <ol className="m-0 list-none border-x-0 border-t-0 border-b border-solid border-(--zn-ink) p-0">
              {highlights.map((h, i) => (
                <li key={h.title} className="flex flex-wrap items-baseline gap-x-6 gap-y-2 border-x-0 border-t border-b-0 border-solid border-(--zn-ink) py-6">
                  <span className="zn-mono flex-[0_0_48px] text-sm text-muted">{num(i + 1)}</span>
                  <h3 className="m-0 flex-[1_1_240px] font-sans text-[clamp(20px,2vw,26px)] font-bold tracking-[-.03em]">{h.title}</h3>
                  {h.text && <p className="m-0 flex-[1_1_300px] text-[15px] leading-[1.55] text-muted">{h.text}</p>}
                </li>
              ))}
            </ol>
          )}
        </div>
      </Wrap>
    </section>
  );
}

export function Gallery({ images }: { images: string[] }) {
  return (
    <ul className="m-0 grid list-none grid-cols-2 gap-4 p-0 md:grid-cols-4">
      {images.map((src, i) => (
        <li key={src} className={cn("overflow-hidden rounded-[8px] bg-(--zn-tint)", i === 0 && "col-span-2 row-span-2")}>
          <img src={src} alt="" loading="lazy" className="block aspect-square size-full object-cover" />
        </li>
      ))}
    </ul>
  );
}

// ---------- Closing: booking CTA + contact + legal (the footer) ----------

export const statusOf = (props: SitePageProps) => (props.content.sections.hours ? openStatus(props.hours) : null);

export function Closing({ props, n, cta = true }: P & { n?: number; cta?: boolean }) {
  const { content, hours, bookingUrl, link, clinic, showKineflowCredit, appUrl } = props;
  const c = content.contact;
  const place = [c.postalCode, c.city].filter(Boolean).join(" ");
  const summary = content.sections.hours ? hoursSummary(hours) : [];
  const status = statusOf(props);

  const target = bookingUrl ? { href: link(bookingUrl), text: "Reserva tu valoración" } : c.phone ? { href: telHref(c.phone), text: "Llámanos" } : c.email ? { href: `mailto:${c.email}`, text: "Escríbenos" } : null;
  const channels = [bookingUrl && "online en un minuto", c.phone && "por teléfono", c.whatsapp && "por WhatsApp"].filter((x): x is string => !!x);
  const lead = channels.length
    ? `Pide tu cita ${channels.length > 1 ? `${channels.slice(0, -1).join(", ")} o ${channels[channels.length - 1]}` : channels[0]}.${bookingUrl ? " Las reservas online quedan confirmadas al momento." : ""}`
    : null;

  type Row = { label: string; value: ReactNode };
  const rows = ([
    (c.address || place) && {
      label: "Dirección",
      value: (
        <>
          {c.address}
          {c.address && place && <br />}
          {place}
          {c.mapsUrl && (
            <a href={c.mapsUrl} target="_blank" rel="noopener" className="zn-mono mt-2 block text-xs font-normal text-white underline underline-offset-4">
              Cómo llegar ↗
            </a>
          )}
        </>
      ),
    },
    summary.length > 0 && {
      label: "Horario",
      value: (
        <>
          {summary.map((s) => (
            <span key={s} className="block">
              {s}
            </span>
          ))}
          {status && <span className="zn-mono mt-2 block text-xs font-normal text-white/85">{status.label}</span>}
        </>
      ),
    },
    (c.phone || c.whatsapp) && {
      label: c.phone && c.whatsapp ? "Teléfono · WhatsApp" : c.phone ? "Teléfono" : "WhatsApp",
      value: (
        <>
          {c.phone && (
            <a href={telHref(c.phone)} className="block text-white no-underline hover:underline">
              {c.phone}
            </a>
          )}
          {c.whatsapp && (
            <a href={whatsappHref(c.whatsapp)} target="_blank" rel="noopener" className="block text-white no-underline hover:underline">
              {c.phone ? "Escríbenos por WhatsApp" : c.whatsapp}
            </a>
          )}
        </>
      ),
    },
    c.email && {
      label: "Email",
      value: (
        <a href={`mailto:${c.email}`} className="break-all text-white no-underline hover:underline">
          {c.email}
        </a>
      ),
    },
  ] as (Row | false | "" | undefined | null)[]).filter((r): r is Row => !!r);

  return (
    <footer id="reservar" className="zn-on-color bg-(--zn-accent) text-white">
      <Wrap className={cn("flex flex-col gap-[clamp(48px,6vw,88px)] pb-10", cta ? "pt-[clamp(64px,8vw,112px)]" : "pt-14")}>
        {cta && target && (
          <div className="flex flex-col gap-6">
            <Label n={n} tone="color">
              Reserva
            </Label>
            <a href={target.href} className="zn-x inline-flex flex-wrap items-end gap-x-[.2em] text-[clamp(48px,9vw,148px)] leading-[.88] tracking-[-.06em] text-white no-underline hover:underline hover:decoration-4 hover:underline-offset-8">
              {target.text.split(" ").slice(0, -1).join(" ")}{" "}
              <span className="inline-flex items-end gap-[.2em] whitespace-nowrap">
                {target.text.split(" ").slice(-1)[0]}
                <span className="mb-[.08em] inline-flex size-[.7em]" aria-hidden="true">
                  <svg {...svg} width="100%" height="100%" strokeWidth={2.4}>
                    <path d="M7 17L17 7" />
                    <path d="M8 7h9v9" />
                  </svg>
                </span>
              </span>
            </a>
            {lead && <p className="m-0 max-w-[32em] text-lg leading-[1.55] text-white/90">{lead}</p>}
          </div>
        )}
        {rows.length > 0 && (
          <dl className="m-0 grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] gap-8 border-x-0 border-t border-b-0 border-solid border-white/40 pt-8">
            {rows.map((r) => (
              <div key={r.label} className="flex flex-col gap-2">
                <dt className="zn-mono text-xs text-white/85">{r.label}</dt>
                <dd className="m-0 text-[17px] leading-[1.4] font-semibold">{r.value}</dd>
              </div>
            ))}
          </dl>
        )}
        <div className="flex flex-wrap items-center justify-between gap-4 border-x-0 border-t border-b-0 border-solid border-white/40 pt-5">
          <Wordmark props={props} light size={28} />
          <nav aria-label="Información legal" className="zn-mono flex flex-wrap gap-x-6 text-xs tracking-[.04em]">
            {[
              ["/aviso-legal", "Aviso legal"],
              ["/privacidad", "Privacidad"],
              ["/cookies", "Cookies"],
            ].map(([path, label]) => (
              <a key={path} href={link(path!)} className="py-3.5 text-white no-underline hover:underline">
                {label}
              </a>
            ))}
          </nav>
          <SocialLinks content={content} />
          <p className="zn-mono m-0 basis-full text-xs tracking-[.04em] text-white/85">
            © {new Date().getFullYear()} {clinic.name}
            {content.healthRegistry && <> · Reg. sanitario {content.healthRegistry}</>}
            {showKineflowCredit && (
              <>
                {" · "}Reservas con{" "}
                <a href={appUrl} target="_blank" rel="noopener" className="text-white">
                  Kineflow
                </a>
              </>
            )}
          </p>
        </div>
      </Wrap>
    </footer>
  );
}

// ---------- Inner pages ----------

export function PageHead({ props, crumb, title, lead }: P & { crumb: string; title: string; lead?: string }) {
  return (
    <section className="border-x-0 border-t-0 border-b border-solid border-(--zn-line)">
      <Wrap className="flex flex-col gap-6 py-[clamp(40px,6vw,88px)]">
        <nav aria-label="Ruta de navegación" className="zn-mono text-[13px] text-muted">
          <a href={props.link("/")} className="text-muted no-underline hover:underline">
            Inicio
          </a>
          {" / "}
          <span aria-current="page" className="text-(--zn-accent)">
            {crumb}
          </span>
        </nav>
        <h1 className="zn-x m-0 max-w-[12em] text-[clamp(48px,7vw,112px)] leading-[.88] tracking-[-.055em]">{title}</h1>
        {lead && <p className="m-0 max-w-[34em] text-[clamp(17px,1.5vw,20px)] leading-[1.55] text-(--zn-text2)">{lead}</p>}
      </Wrap>
    </section>
  );
}

// ---------- The home page's sections, in order ----------

export type HomeSection = "treatments" | "method" | "faq" | "team" | "about" | "prices";

// Which sections the home page shows: numbered 01, 02… in this order, and the
// closing gets the next number
export function homeSections({ content, services, team }: SitePageProps): HomeSection[] {
  const s = content.sections;
  const list: (HomeSection | false)[] = [
    s.services && services.length > 0 && "treatments",
    "method",
    s.faq && content.faq.length > 0 && "faq",
    s.team && team.length > 0 && "team",
    ((s.about && !!content.about?.text) || content.highlights.length > 0) && "about",
    s.services && services.length > 0 && "prices",
  ];
  return list.filter((x): x is HomeSection => !!x);
}
