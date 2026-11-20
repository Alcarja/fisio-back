import type { ReactNode } from "react";
import { Paragraphs, SocialLinks } from "../shared/blocks.js";
import { cn } from "../shared/cn.js";
import { formatDuration, formatPrice, fullAddress, hoursByDay, hoursSummary, initials, openStatus, telHref, WEEKDAYS, whatsappHref } from "../shared/format.js";
import { ServiceIcon } from "../shared/icons.js";
import { pageAvailable } from "../shared/pages.js";
import type { SitePageProps, SiteService, SiteTeamMember } from "../types.js";

// Calma: a serious, calm and close health clinic. Lots of white, one font
// (Figtree), the clinic's colour as a deep primary and high contrast. Trust
// first (licence numbers, registration, opening hours) and booking always at
// hand: phone and button in the header, and a fixed bar on phones. Fluid
// layout: flex-wrap and auto-fit grids.

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

// White text on the primary everywhere: the clinic's colour is darkened
// until that reads well (AA)
export function calmaPrimary(primary: string) {
  const base = rgb(primary);
  let out = primary;
  for (let k = 1; luminance(out) > 0.17 && k > 0.15; k -= 0.05) out = toHex(base.map((v) => v * k));
  return out;
}

// ---------- Layout pieces ----------

export function Wrap({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("mx-auto box-border w-full max-w-[77.5rem] px-[clamp(20px,4vw,48px)]", className)}>{children}</div>;
}

export const pad = "py-[clamp(72px,9vw,128px)]";
const h2 = "cl-x m-0 text-[clamp(34px,3.8vw,52px)] leading-[1.08] tracking-[-.03em]";

export function Eyebrow({ children, dark }: { children: ReactNode; dark?: boolean }) {
  return <p className={cn("m-0 text-[15px] font-semibold", dark ? "text-(--cl-on-dark-accent)" : "text-(--cl-primary)")}>{children}</p>;
}

// Eyebrow + title on the left, a lead (or a link) on the right
function Head({ eyebrow, title, lead, action, wide }: { eyebrow: string; title: ReactNode; lead?: ReactNode; action?: ReactNode; wide?: boolean }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-x-12 gap-y-4">
      <div className={cn("flex flex-col gap-3.5", wide ? "max-w-[680px]" : "max-w-[640px]")}>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h2 className={h2}>{title}</h2>
      </div>
      {lead && <p className="m-0 max-w-[24em] text-base text-(--cl-muted)">{lead}</p>}
      {action}
    </div>
  );
}

type Tone = "primary" | "ink" | "outline" | "light";
const TONES: Record<Tone, string> = {
  primary: "bg-(--cl-primary) text-white hover:bg-[color-mix(in_srgb,var(--cl-primary)_85%,#000)]",
  ink: "bg-(--cl-ink) text-white hover:bg-[color-mix(in_srgb,var(--cl-ink)_80%,#fff)]",
  outline: "border border-solid border-(--cl-ink) text-(--cl-ink) hover:bg-(--cl-tint)",
  light: "bg-white text-(--cl-ink) hover:bg-white/90",
};

export function Btn({ href, tone = "primary", size = "lg", external, className, children }: { href: string; tone?: Tone; size?: "md" | "lg"; external?: boolean; className?: string; children: ReactNode }) {
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noopener" } : {})}
      className={cn(
        "box-border inline-flex items-center justify-center gap-2.5 font-semibold whitespace-nowrap no-underline transition-colors",
        size === "md" ? "min-h-12 rounded-[12px] px-[18px] text-[15px]" : "min-h-14 rounded-[14px] px-7 text-[17px]",
        TONES[tone],
        className,
      )}
    >
      {children}
    </a>
  );
}

const svg = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true } as const;

export const PhoneIcon = () => (
  <svg {...svg} width={18} height={18} strokeWidth={2} className="shrink-0">
    <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />
  </svg>
);
export const Arrow = () => (
  <svg {...svg} width={18} height={18} strokeWidth={2.2} className="shrink-0">
    <path d="M5 12h14" />
    <path d="M13 6l6 6-6 6" />
  </svg>
);
const CalendarIcon = () => (
  <svg {...svg} width={22} height={22} strokeWidth={2}>
    <rect x="3" y="5" width="18" height="16" rx="3" />
    <path d="M3 10h18" />
    <path d="M8 3v4" />
    <path d="M16 3v4" />
  </svg>
);
const Cross = ({ size = 22 }: { size?: number }) => (
  <svg {...svg} width={size} height={size} strokeWidth={2.4}>
    <path d="M12 4v16" />
    <path d="M4 12h16" />
  </svg>
);
const Chevron = () => (
  <svg {...svg} width={18} height={18} strokeWidth={2.2}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);

// Where the main "Pedir cita" buttons go: online booking, else a call
export function bookTarget({ bookingUrl, link, content }: SitePageProps) {
  if (bookingUrl) return { href: link(bookingUrl), external: false };
  if (content.contact.phone) return { href: telHref(content.contact.phone), external: false };
  return null;
}

export const statusOf = (props: SitePageProps) => (props.content.sections.hours ? openStatus(props.hours) : null);

// ---------- Brand ----------

export function Logo({ props, light }: P & { light?: boolean }) {
  const { clinic, content, img, link } = props;
  const logo = img(content.logoId);
  return (
    <a href={link("/")} aria-label={`${clinic.name}, inicio`} className={cn("flex min-h-11 min-w-0 items-center gap-3 no-underline", light ? "text-white" : "text-(--cl-ink)")}>
      {logo && !light ? (
        <img src={logo} alt={clinic.name} className="block max-h-11 max-w-48 object-contain" />
      ) : (
        <>
          <span aria-hidden="true" className={cn("flex size-[38px] flex-none items-center justify-center rounded-[12px]", light ? "bg-white/10 text-white" : "bg-(--cl-primary) text-white")}>
            <Cross />
          </span>
          <span className="flex min-w-0 flex-col leading-[1.1]">
            <span className="truncate text-xl font-bold tracking-[-.01em]">{clinic.name}</span>
            <span className={cn("text-[13px]", light ? "text-(--cl-on-dark-muted)" : "text-(--cl-muted)")}>Clínica de fisioterapia</span>
          </span>
        </>
      )}
    </a>
  );
}

// ---------- Top bar ----------

export function TopBar({ props }: P) {
  const { content, hours } = props;
  const summary = content.sections.hours ? hoursSummary(hours) : [];
  const address = fullAddress(content.contact);
  if (!summary.length && !address) return null;
  return (
    <div className="bg-(--cl-primary) text-sm text-white">
      <Wrap className="flex flex-wrap justify-between gap-x-6 gap-y-1 py-2">
        {summary.length > 0 && (
          <span className="flex flex-wrap gap-x-4">
            {summary.map((s) => (
              <span key={s}>{s}</span>
            ))}
          </span>
        )}
        {address && <span className="text-white/90">{address}</span>}
      </Wrap>
    </div>
  );
}

// ---------- Hero ----------

function heroFacts({ content, team, services, bookingUrl }: SitePageProps) {
  const showTeam = content.sections.team && team.length > 0;
  const single = services.find((s) => !s.isGroup);
  const facts = [
    showTeam && team.some((m) => m.licenseNumber) && { title: "Colegiados", text: "Nº col. visibles" },
    single && { title: "1 a 1", text: `${formatDuration(single.durationMinutes)} por sesión` },
    bookingUrl && { title: "Online", text: "reserva 24 h" },
    content.sections.services && services.length > 0 && { title: String(services.length), text: services.length === 1 ? "tratamiento" : "tratamientos" },
  ].filter((f): f is { title: string; text: string } => !!f);
  return facts.slice(0, 3);
}

export function Hero({ props }: P) {
  const { content, img, clinic } = props;
  const { hero, contact } = content;
  const cover = img(content.coverId);
  const target = bookTarget(props);
  const facts = heroFacts(props);
  const status = statusOf(props);

  return (
    <section id="inicio">
      <Wrap className="flex flex-wrap items-center gap-[clamp(40px,5vw,80px)] py-[clamp(48px,7vw,104px)]">
        <div className="flex min-w-0 flex-[1_1_480px] flex-col gap-7">
          <Eyebrow>Clínica de fisioterapia{contact.city ? ` en ${contact.city}` : ""}</Eyebrow>
          <h1 className="cl-x m-0 text-[clamp(44px,5.6vw,76px)] leading-[1.04] tracking-[-.035em]">{hero.title}</h1>
          {hero.subtitle && <p className="m-0 max-w-[30em] text-[clamp(18px,1.5vw,20px)] leading-relaxed text-(--cl-muted)">{hero.subtitle}</p>}
          <div className="flex flex-wrap gap-3">
            {target && (
              <Btn href={target.href}>
                {props.bookingUrl ? "Pedir primera valoración" : `Llamar al ${contact.phone}`} <Arrow />
              </Btn>
            )}
            <a href="#primera-visita" className="inline-flex min-h-14 items-center px-2 text-[17px] font-semibold text-(--cl-ink) underline underline-offset-[5px]">
              Cómo es la primera visita
            </a>
          </div>
          {facts.length > 0 && (
            <ul className="m-0 mt-3 grid list-none grid-cols-3 gap-4 border-x-0 border-t border-b-0 border-solid border-(--cl-line) p-0 pt-6">
              {facts.map((f) => (
                <li key={f.title} className="flex flex-col gap-0.5">
                  <span className="text-lg font-bold">{f.title}</span>
                  <span className="text-sm text-(--cl-muted)">{f.text}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="relative min-w-0 flex-[1_1_440px]">
          {cover ? (
            <img src={cover} alt={`${clinic.name}: la clínica`} className="block aspect-[4/5] w-full rounded-[28px] object-cover" />
          ) : (
            <div className="cl-grid flex aspect-[4/5] w-full items-center justify-center rounded-[28px]" aria-hidden="true">
              <span className="flex size-28 items-center justify-center rounded-[32px] bg-(--cl-primary) text-white shadow-[0_0_0_14px_rgba(255,255,255,.6)]">
                <Cross size={56} />
              </span>
            </div>
          )}
          {status && (
            <div className="absolute bottom-8 left-[clamp(-24px,-2vw,0px)] flex max-w-[300px] items-center gap-3.5 rounded-[18px] bg-white px-5 py-[18px] shadow-[0_12px_32px_rgba(15,31,28,.12)]">
              <span aria-hidden="true" className="flex size-11 flex-none items-center justify-center rounded-[12px] bg-(--cl-tint) text-(--cl-primary)">
                <CalendarIcon />
              </span>
              <span className="flex flex-col leading-[1.3]">
                <span className="text-[13px] text-(--cl-muted)">Hoy</span>
                <span className="flex items-center gap-2 text-base font-bold">
                  <span className={cn("cl-dot", status.open && "cl-dot-open")} aria-hidden="true" />
                  {status.label}
                </span>
              </span>
            </div>
          )}
        </div>
      </Wrap>
    </section>
  );
}

// ---------- "¿Qué te ocurre?" chips ----------

const CONDITIONS = ["Dolor de espalda", "Cervicales", "Rodilla", "Hombro", "Esguince", "Lesión deportiva", "Postoperatorio", "Suelo pélvico"];

export function Conditions({ props }: P) {
  const { content, services, bookingUrl, link } = props;
  const href = content.sections.services && services.length > 0 ? "#tratamientos" : bookingUrl ? link(bookingUrl) : "#contacto";
  return (
    <section aria-labelledby="cl-conditions" className="bg-(--cl-tint)">
      <Wrap className="flex flex-wrap items-center gap-x-8 gap-y-4 py-10">
        <h2 id="cl-conditions" className="cl-x m-0 flex-none text-xl tracking-[-.01em]">
          ¿Qué te ocurre?
        </h2>
        <ul className="m-0 flex flex-[1_1_600px] list-none flex-wrap gap-2.5 p-0">
          {CONDITIONS.map((c) => (
            <li key={c}>
              <a href={href} className="box-border inline-flex min-h-11 items-center rounded-full border border-solid border-(--cl-chip) bg-white px-[18px] text-[15px] font-medium text-(--cl-ink) no-underline hover:border-(--cl-primary)">
                {c}
              </a>
            </li>
          ))}
        </ul>
      </Wrap>
    </section>
  );
}

// ---------- Treatments ----------

export function Treatments({ props, limit, full }: P & { limit?: number; full?: boolean }) {
  const { services, bookingUrl, link } = props;
  const list = limit ? services.slice(0, limit) : services;
  return (
    <section id="tratamientos">
      <Wrap className={cn("flex flex-col gap-12", pad)}>
        {!full && (
          <Head
            wide
            eyebrow="Tratamientos"
            title="Tratamos la causa, no solo el síntoma."
            action={
              services.length > list.length &&
              pageAvailable("servicios", props) && (
                <a href={link("/servicios")} className="inline-flex min-h-11 items-center font-semibold text-(--cl-ink) underline underline-offset-[5px]">
                  Ver los {services.length} tratamientos
                </a>
              )
            }
          />
        )}
        <ul className="cl-cells m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(320px,100%),1fr))] p-0">
          {list.map((s) => {
            const inner = (
              <>
                <span aria-hidden="true" className="cl-cell-icon flex size-[52px] items-center justify-center rounded-[14px] bg-(--cl-tint) text-(--cl-primary)">
                  <ServiceIcon name={s.name} description={s.description} />
                </span>
                <h3 className="m-0 font-sans text-[22px] font-semibold tracking-[-.01em] text-inherit">{s.name}</h3>
                {s.description && <p className="m-0 text-base text-(--cl-muted)">{s.description}</p>}
                <p className="m-0 mt-auto pt-1 text-sm font-medium text-(--cl-muted)">
                  {formatDuration(s.durationMinutes)} · {s.isGroup ? "en grupo reducido" : "individual"}
                </p>
              </>
            );
            const cell = "box-border flex h-full flex-col gap-3.5 px-8 py-9 text-(--cl-ink) no-underline";
            return (
              <li key={s.name}>
                {bookingUrl ? (
                  <a href={link(bookingUrl)} className={cn(cell, "transition-colors hover:bg-(--cl-tint)")} aria-label={`${s.name}: pedir cita`}>
                    {inner}
                  </a>
                ) : (
                  <div className={cell}>{inner}</div>
                )}
              </li>
            );
          })}
        </ul>
      </Wrap>
    </section>
  );
}

// ---------- First visit (ink block) ----------

const STEPS = [
  { title: "Te escuchamos", text: "Cuándo empezó, qué lo empeora, cómo afecta a tu día a día y qué quieres conseguir." },
  { title: "Exploración", text: "Movilidad, fuerza, pruebas ortopédicas y funcionales para entender el origen del problema." },
  { title: "Diagnóstico y plan", text: "Te explicamos qué ocurre, cuántas sesiones estimamos y qué puedes hacer tú en casa." },
  { title: "Primer tratamiento", text: "Siempre que sea posible, empezamos ese mismo día con terapia manual y los primeros ejercicios." },
];

export function FirstVisit({ props }: P) {
  const { services } = props;
  const assessment = services.find((s) => /valoraci/i.test(s.name));
  const target = bookTarget(props);
  return (
    <section id="primera-visita" className="cl-dark bg-(--cl-ink) text-white">
      <Wrap className={cn("flex flex-wrap gap-x-[clamp(40px,6vw,96px)] gap-y-12", pad)}>
        <div className="flex min-w-0 flex-[1_1_340px] flex-col gap-5">
          <Eyebrow dark>Primera visita</Eyebrow>
          <h2 className={cn(h2, "text-white")}>Qué pasa cuando vienes por primera vez.</h2>
          <p className="m-0 max-w-[26em] text-[17px] text-(--cl-on-dark-muted)">
            {assessment ? `Dura ${formatDuration(assessment.durationMinutes)}. ` : ""}Trae ropa cómoda y, si los tienes, informes o pruebas de imagen. No necesitas prescripción médica.
          </p>
          {target && (
            <Btn href={target.href} tone="light" className="mt-2 min-h-[52px] self-start px-6 text-base">
              {props.bookingUrl ? "Reservar valoración" : "Llamar para pedir cita"}
            </Btn>
          )}
        </div>
        <ol className="m-0 flex min-w-0 flex-[999_1_560px] list-none flex-col p-0">
          {STEPS.map((s, i) => {
            const last = i === STEPS.length - 1;
            return (
              <li key={s.title} className={cn("flex gap-6 border-x-0 border-t border-solid border-(--cl-on-dark-line) py-7", last ? "border-b" : "border-b-0")}>
                <span
                  className={cn(
                    "flex size-11 flex-none items-center justify-center rounded-full font-semibold",
                    last ? "bg-(--cl-on-dark-accent) font-bold text-(--cl-ink)" : "border border-solid border-(--cl-on-dark-accent) text-(--cl-on-dark-accent)",
                  )}
                  aria-hidden="true"
                >
                  {i + 1}
                </span>
                <div className="flex flex-col gap-1.5">
                  <h3 className="m-0 font-sans text-[22px] font-semibold text-white">{s.title}</h3>
                  <p className="m-0 text-base text-(--cl-on-dark-muted)">{s.text}</p>
                </div>
              </li>
            );
          })}
        </ol>
      </Wrap>
    </section>
  );
}

// ---------- Team ----------

function TeamCard({ member, full }: { member: SiteTeamMember; full?: boolean }) {
  const role = [member.headline, member.licenseNumber && `Nº col. ${member.licenseNumber}`].filter(Boolean).join(" · ");
  return (
    <article className="flex flex-col gap-4">
      <div className="flex aspect-square items-center justify-center overflow-hidden rounded-[24px] bg-(--cl-photo)">
        {member.photoUrl ? (
          <img src={member.photoUrl} alt={member.name} loading="lazy" className="size-full object-cover" />
        ) : (
          <span className="text-6xl font-semibold tracking-[-.03em] text-(--cl-primary)" aria-hidden="true">
            {initials(member.name)}
          </span>
        )}
      </div>
      <div className="flex flex-col gap-1">
        <h3 className="m-0 font-sans text-[21px] font-semibold">{member.name}</h3>
        {role && <p className="m-0 text-[15px] text-(--cl-muted)">{role}</p>}
        {member.bio && <p className={cn("mt-2 mb-0 text-[15px] text-(--cl-muted)", !full && "line-clamp-3")}>{member.bio}</p>}
      </div>
    </article>
  );
}

export function Team({ props, limit, full }: P & { limit?: number; full?: boolean }) {
  const { team, link } = props;
  const list = limit ? team.slice(0, limit) : team;
  return (
    <section id="equipo">
      <Wrap className={cn("flex flex-col gap-12", pad)}>
        {!full && (
          <Head
            eyebrow="Equipo"
            title="Fisioterapeutas colegiados, especializados por áreas."
            lead="Cada paciente tiene un fisioterapeuta de referencia, de la valoración al alta."
            action={
              team.length > list.length &&
              pageAvailable("equipo", props) && (
                <a href={link("/equipo")} className="inline-flex min-h-11 items-center font-semibold text-(--cl-ink) underline underline-offset-[5px]">
                  Todo el equipo
                </a>
              )
            }
          />
        )}
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(280px,100%),1fr))] gap-8 p-0">
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

// ---------- About (the tint block; the design's reviews need real data) ----------

export function About({ props, full }: P & { full?: boolean }) {
  const { content, clinic, img, link } = props;
  const { about, highlights, sections } = content;
  const hasText = sections.about && !!about?.text;
  const photo = full ? (img(content.galleryIds[0]) ?? img(content.coverId)) : img(content.galleryIds[0]);
  if (!hasText && !highlights.length) return null;
  return (
    <section id="nosotros" className="bg-(--cl-tint)">
      <Wrap className="flex flex-col gap-10 py-[clamp(64px,8vw,112px)]">
        <div className="flex flex-wrap items-start gap-x-16 gap-y-8">
          <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-5">
            <Eyebrow>Nosotros</Eyebrow>
            <h2 className={h2}>{about?.title || `Esto es ${clinic.name}.`}</h2>
            {hasText && (
              <div className={cn("flex flex-col gap-4 text-[17px] text-(--cl-muted)", !full && "[&>p:nth-child(n+3)]:hidden")}>
                <Paragraphs text={about!.text} className="m-0" />
              </div>
            )}
            {!full && pageAvailable("nosotros", props) && (
              <a href={link("/nosotros")} className="inline-flex min-h-11 items-center self-start font-semibold text-(--cl-ink) underline underline-offset-[5px]">
                Conoce la clínica
              </a>
            )}
          </div>
          {photo && <img src={photo} alt="" loading="lazy" className="block aspect-[4/3] min-w-0 flex-[1_1_380px] rounded-[24px] object-cover" />}
        </div>
        {highlights.length > 0 && (
          <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(280px,100%),1fr))] gap-5 p-0">
            {highlights.map((h) => (
              <li key={h.title} className="flex min-h-[160px] flex-col gap-3 rounded-[20px] bg-white p-7">
                <h3 className="m-0 font-sans text-[20px] font-semibold">{h.title}</h3>
                {h.text && <p className="m-0 text-base text-(--cl-muted)">{h.text}</p>}
              </li>
            ))}
          </ul>
        )}
      </Wrap>
    </section>
  );
}

export function Gallery({ images }: { images: string[] }) {
  return (
    <ul className="m-0 grid list-none grid-cols-2 gap-4 p-0 md:grid-cols-4">
      {images.map((src, i) => (
        <li key={src} className={cn("overflow-hidden rounded-[24px] bg-(--cl-photo)", i === 0 && "col-span-2 row-span-2")}>
          <img src={src} alt="" loading="lazy" className="block aspect-square size-full object-cover" />
        </li>
      ))}
    </ul>
  );
}

// ---------- Prices ----------

export function Prices({ props, list }: P & { list?: SiteService[] }) {
  const { content, bookingUrl, link } = props;
  const rows = list ?? props.services;
  const phone = content.contact.phone;
  return (
    <section id="tarifas">
      <Wrap className={cn("flex flex-col gap-12", pad)}>
        <Head eyebrow="Tarifas" title="Precios claros." lead="El precio de cada sesión, a la vista antes de reservar. Pagas en la clínica." />
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(min(260px,100%),1fr))] gap-5 p-0">
          {rows.map((s) => (
            <li key={s.name} className="flex flex-col gap-2.5 rounded-[20px] border border-solid border-(--cl-line) p-8">
              <h3 className="m-0 font-sans text-lg font-semibold">{s.name}</h3>
              <p className="m-0 text-[15px] text-(--cl-muted)">
                {formatDuration(s.durationMinutes)} · {s.isGroup ? "en grupo" : "individual"}
              </p>
              <p className="m-0 mt-3.5 text-[40px] leading-none font-bold tracking-[-.02em]">{formatPrice(s.priceCents)}</p>
            </li>
          ))}
          {(phone || bookingUrl) && (
            <li className="cl-dark flex flex-col gap-2.5 rounded-[20px] bg-(--cl-primary) p-8 text-white">
              <h3 className="m-0 font-sans text-lg font-semibold text-white">¿No sabes cuál elegir?</h3>
              <p className="m-0 text-[15px] text-white/90">Empieza por una valoración y te orientamos.</p>
              <Btn href={phone ? telHref(phone) : link(bookingUrl!)} tone="light" size="md" className="mt-auto">
                {phone ? (
                  <>
                    <PhoneIcon /> Llamar
                  </>
                ) : (
                  "Pedir cita"
                )}
              </Btn>
            </li>
          )}
        </ul>
      </Wrap>
    </section>
  );
}

// ---------- FAQ ----------

export function Faq({ props }: P) {
  const { faq } = props.content;
  return (
    <section id="preguntas" className="border-x-0 border-t border-b-0 border-solid border-(--cl-line)">
      <Wrap className={cn("flex flex-wrap items-start gap-x-[clamp(40px,6vw,96px)] gap-y-10", pad)}>
        <div className="flex min-w-0 flex-[1_1_340px] flex-col gap-3.5">
          <Eyebrow>Preguntas frecuentes</Eyebrow>
          <h2 className={h2}>Antes de venir.</h2>
        </div>
        <div className="cl-faq min-w-0 flex-[999_1_560px] border-x-0 border-t border-b-0 border-solid border-(--cl-line)">
          {faq.map((f, i) => (
            <details key={f.q} name="cl-faq" open={i === 0} className="border-x-0 border-t-0 border-b border-solid border-(--cl-line)">
              <summary className="flex min-h-[72px] items-center justify-between gap-6 py-4">
                <h3 className="m-0 font-sans text-[20px] font-semibold tracking-[-.01em]">{f.q}</h3>
                <span className="cl-chev flex size-10 flex-none items-center justify-center rounded-[12px] bg-(--cl-tint) text-(--cl-primary)" aria-hidden="true">
                  <Chevron />
                </span>
              </summary>
              <div className="pr-16 pb-6 text-[17px] text-(--cl-muted)">
                <Paragraphs text={f.a} className="m-0 mb-2 last:mb-0" />
              </div>
            </details>
          ))}
        </div>
      </Wrap>
    </section>
  );
}

// ---------- Contact ----------

// Consecutive days with the same times as one row: "Lunes a viernes", "Sábado", "Domingo · Cerrado"
function hoursRows(hours: SitePageProps["hours"]) {
  const days = hoursByDay(hours).map((d) => (d.ranges.length ? d.ranges.join(" · ") : "Cerrado"));
  const rows: [string, string][] = [];
  for (let i = 0; i < 7; ) {
    let j = i;
    while (j + 1 < 7 && days[j + 1] === days[i]) j++;
    rows.push([i === j ? WEEKDAYS[i]! : `${WEEKDAYS[i]} a ${WEEKDAYS[j]!.toLowerCase()}`, days[i]!]);
    i = j + 1;
  }
  return rows;
}

export function Contact({ props, withHeader = true }: P & { withHeader?: boolean }) {
  const { content, hours, bookingUrl, link } = props;
  const c = content.contact;
  const address = fullAddress(c);
  const place = [c.postalCode, c.city].filter(Boolean).join(" ");
  const showHours = content.sections.hours && hours.length > 0;
  const channels = [bookingUrl && "online", c.phone && "por teléfono", c.whatsapp && "por WhatsApp"].filter((x): x is string => !!x);
  const lead = channels.length
    ? `${channels.length > 1 ? `${channels.slice(0, -1).join(", ")} o ${channels[channels.length - 1]}` : channels[0]}`.replace(/^./, (m) => m.toUpperCase()) +
      ". Si no sabes qué tratamiento necesitas, pide una valoración inicial."
    : "Si no sabes qué tratamiento necesitas, pide una valoración inicial.";

  type Row = { label: string; value: ReactNode };
  const rows = (
    [
      (c.address || place) && {
        label: "Dirección",
        value: (
          <>
            {c.address}
            {c.address && place && <br />}
            {place}
          </>
        ),
      },
      c.email && {
        label: "Email",
        value: (
          <a href={`mailto:${c.email}`} className="break-all text-(--cl-ink) no-underline hover:underline">
            {c.email}
          </a>
        ),
      },
      c.whatsapp && {
        label: "WhatsApp",
        value: (
          <a href={whatsappHref(c.whatsapp)} target="_blank" rel="noopener" className="text-(--cl-ink) no-underline hover:underline">
            Escríbenos
          </a>
        ),
      },
    ] as (Row | false | "" | undefined)[]
  ).filter((r): r is Row => !!r);

  return (
    <section id="contacto" className="border-x-0 border-t border-b-0 border-solid border-(--cl-line)">
      <Wrap className={cn("flex flex-wrap gap-10", pad)}>
        <div className="flex min-w-0 flex-[1_1_420px] flex-col gap-7">
          {withHeader && (
            <>
              <Eyebrow>Contacto</Eyebrow>
              <h2 className={h2}>Pide tu cita.</h2>
            </>
          )}
          <p className="m-0 max-w-[28em] text-[17px] text-(--cl-muted)">{lead}</p>
          <div className="flex flex-wrap gap-3">
            {bookingUrl && <Btn href={link(bookingUrl)}>Reservar online</Btn>}
            {c.phone && (
              <Btn href={telHref(c.phone)} tone="outline" className="px-6">
                <PhoneIcon /> {c.phone}
              </Btn>
            )}
          </div>
          {rows.length > 0 && (
            <dl className="m-0 mt-2 grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] gap-6 border-x-0 border-t border-b-0 border-solid border-(--cl-line) pt-7">
              {rows.map((r) => (
                <div key={r.label} className="flex flex-col gap-1">
                  <dt className="text-sm text-(--cl-muted)">{r.label}</dt>
                  <dd className="m-0 font-semibold">{r.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {showHours && (
            <table className="w-full border-collapse text-base">
              <caption className="pb-2 text-left text-sm text-(--cl-muted)">Horario</caption>
              <tbody>
                {hoursRows(hours).map(([day, time], i, all) => (
                  <tr key={day} className={cn("border-x-0 border-t border-solid border-(--cl-line)", i === all.length - 1 ? "border-b" : "border-b-0")}>
                    <th scope="row" className="py-3 text-left font-medium">
                      {day}
                    </th>
                    <td className="py-3 text-right font-semibold tabular-nums">{time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <SocialLinks content={content} />
        </div>
        {address && (
          <div className="cl-grid box-border flex min-h-[460px] min-w-0 flex-[1_1_440px] flex-col items-center justify-center gap-3 rounded-[28px] p-6 text-center">
            <span aria-hidden="true" className="flex size-[52px] items-center justify-center rounded-full bg-(--cl-primary) text-white shadow-[0_0_0_8px_rgba(255,255,255,.7)]">
              <Cross size={24} />
            </span>
            <span className="max-w-[22rem] rounded-full bg-white px-3 py-1.5 text-sm text-(--cl-muted)">{address}</span>
            {c.mapsUrl && (
              <Btn href={c.mapsUrl} external tone="ink" size="md" className="mt-2">
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

export function PageHead({ props, crumb, title, lead }: P & { crumb: string; title: string; lead?: string }) {
  return (
    <section className="border-x-0 border-t-0 border-b border-solid border-(--cl-line)">
      <Wrap className="flex flex-col gap-6 py-[clamp(48px,7vw,96px)]">
        <nav aria-label="Ruta de navegación" className="text-[15px] font-semibold">
          <a href={props.link("/")} className="text-(--cl-muted) no-underline hover:underline">
            Inicio
          </a>
          <span className="px-2 text-(--cl-muted)" aria-hidden="true">
            /
          </span>
          <span aria-current="page" className="text-(--cl-primary)">
            {crumb}
          </span>
        </nav>
        <h1 className="cl-x m-0 max-w-[16em] text-[clamp(44px,5.6vw,76px)] leading-[1.04] tracking-[-.035em]">{title}</h1>
        {lead && <p className="m-0 max-w-[32em] text-[clamp(18px,1.5vw,20px)] text-(--cl-muted)">{lead}</p>}
      </Wrap>
    </section>
  );
}
