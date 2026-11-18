import type { ReactNode } from "react";
import { Paragraphs, SocialLinks } from "../shared/blocks.js";
import { cn } from "../shared/cn.js";
import { formatDuration, formatPrice, fullAddress, hoursByDay, initials, openStatus, spainNow, telHref, whatsappHref } from "../shared/format.js";
import { CalendarIcon, ChatIcon, CheckIcon, ClockIcon, MailIcon, MapPinIcon, PhoneIcon, ServiceIcon, ShieldCheckIcon } from "../shared/icons.js";
import { pageAvailable } from "../shared/pages.js";
import { Accordion, AccordionItem, ArrowRight, ArrowUpRight, Badge, Breadcrumb, Button } from "../shared/ui.js";
import type { SitePageProps, SiteService, SiteTeamMember } from "../types.js";

// Norte: a business-like clinic site built from rounded white panels on a
// soft grey page (a bento grid). Straight to the point: what we treat and
// what it costs, who treats you, how it works (the one dark panel), answers
// and where to find us. shadcn parts (Button, Badge, Accordion, Breadcrumb)
// from shared/ui.tsx, restyled with Tailwind

type P = { props: SitePageProps };

export function Wrap({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("mx-auto w-full max-w-[80rem] px-3 md:px-5", className)}>{children}</div>;
}

// A rounded panel: the building block of every section
export function Panel({ className, children, tone = "white", id, as: Tag = "section", label }: { className?: string; children: ReactNode; tone?: "white" | "dark" | "brand" | "soft"; id?: string; as?: "section" | "div"; label?: string }) {
  return (
    <Tag
      id={id}
      aria-label={label}
      className={cn(
        "nt-panel rounded-[1.75rem] md:rounded-[2rem]",
        tone === "white" && "bg-white",
        tone === "soft" && "bg-(--nt-soft)",
        tone === "dark" && "nt-dark bg-(--nt-ink) text-white",
        tone === "brand" && "bg-primary text-primary-foreground",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("m-0 inline-flex items-center gap-2 text-[.8rem] font-medium text-muted", className)}>
      <span className="size-1.5 rounded-full bg-primary" aria-hidden="true" />
      {children}
    </p>
  );
}

// Section header: title on the left, an optional link on the right
export function Head({ eyebrow, title, intro, action, className, dark }: { eyebrow?: string; title: ReactNode; intro?: string; action?: ReactNode; className?: string; dark?: boolean }) {
  return (
    <header className={cn("mb-8 flex flex-col gap-5 md:mb-10 md:flex-row md:items-end md:justify-between", className)}>
      <div className="max-w-[40rem]">
        {eyebrow && <Eyebrow className={cn("mb-3", dark && "text-white/60")}>{eyebrow}</Eyebrow>}
        <h2 className={cn("nt-h2 m-0 text-[clamp(1.9rem,3.6vw,3rem)]", dark ? "text-white" : "text-ink")}>{title}</h2>
        {intro && <p className={cn("mt-4 mb-0 text-[1.02rem] leading-relaxed", dark ? "text-white/65" : "text-muted")}>{intro}</p>}
      </div>
      {action}
    </header>
  );
}

export const pill = "h-11 rounded-full px-5 text-[.92rem] font-medium";

export function MoreLink({ href, children, dark }: { href: string; children: ReactNode; dark?: boolean }) {
  return (
    <a href={href} className={cn("group inline-flex shrink-0 items-center gap-2 text-[.92rem] font-medium no-underline", dark ? "text-white" : "text-ink")}>
      {children}
      <span className={cn("flex size-8 items-center justify-center rounded-full transition-transform group-hover:translate-x-0.5", dark ? "bg-white/10" : "bg-(--nt-soft)")}>
        <ArrowRight />
      </span>
    </a>
  );
}

// ---------- Status ----------

export const statusOf = (props: SitePageProps) => (props.content.sections.hours ? openStatus(props.hours) : null);

export function StatusBadge({ props, className }: P & { className?: string }) {
  const s = statusOf(props);
  if (!s) return null;
  return (
    <Badge variant="outline" className={cn("h-8 gap-2 rounded-full border-(--nt-line) bg-white px-3 text-[.8rem] font-medium text-ink", className)}>
      <span className={cn("nt-dot", s.open && "nt-dot-open")} aria-hidden="true" />
      {s.label}
    </Badge>
  );
}

// Today's opening times in one line ("09:00–14:00 · 16:00–20:00")
export function todayHours(hours: SitePageProps["hours"]) {
  const day = hoursByDay(hours)[spainNow().weekday - 1];
  return day && day.ranges.length ? day.ranges.join(" · ") : "Cerrado";
}

export function HoursList({ hours, className, dark }: { hours: SitePageProps["hours"]; className?: string; dark?: boolean }) {
  const today = spainNow().weekday;
  return (
    <ul className={cn("m-0 grid list-none gap-1 p-0", className)}>
      {hoursByDay(hours).map((d, i) => {
        const isToday = i + 1 === today;
        return (
          <li
            key={d.label}
            className={cn(
              "flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-[.84rem] sm:text-[.9rem]",
              isToday ? (dark ? "bg-white/10 font-medium text-white" : "bg-(--nt-soft) font-medium text-ink") : dark ? "text-white/60" : "text-muted",
            )}
          >
            <span className="flex items-center gap-2">
              {d.label}
              {isToday && <span className="rounded-full bg-primary px-2 py-0.5 text-[.66rem] font-semibold text-primary-foreground uppercase">Hoy</span>}
            </span>
            <span className="text-right whitespace-nowrap tabular-nums">{d.ranges.length ? d.ranges.join(" · ") : "Cerrado"}</span>
          </li>
        );
      })}
    </ul>
  );
}

// ---------- Hero ----------

export function Hero({ props }: P) {
  const { content, services, team, img, link, bookingUrl, hours } = props;
  const { hero, contact, highlights, sections } = content;
  const cover = img(content.coverId);
  const showServices = sections.services && services.length > 0;
  const showTeam = sections.team && team.length > 0;
  const status = statusOf(props);
  const from = showServices ? Math.min(...services.map((s) => s.priceCents)) : null;
  const address = fullAddress(contact);

  const stats = [
    showServices && { value: String(services.length), label: services.length === 1 ? "tratamiento" : "tratamientos" },
    showTeam && { value: String(team.length), label: team.length === 1 ? "fisioterapeuta colegiado" : "fisioterapeutas colegiados" },
    from !== null && { value: formatPrice(from), label: "precio desde", brand: true },
    status && sections.hours && hours.length > 0 && { value: status.open ? "Abierto" : "Cerrado", label: `Hoy: ${todayHours(hours)}` },
  ].filter((s): s is { value: string; label: string; brand?: boolean } => !!s);

  return (
    <div className="grid gap-3 md:gap-4 lg:grid-cols-12">
      <Panel as="div" className="flex flex-col justify-between gap-12 p-7 md:p-12 lg:col-span-7 lg:min-h-[34rem]">
        <div>
          <div className="flex flex-wrap gap-2">
            <StatusBadge props={props} />
            {contact.city && (
              <Badge variant="outline" className="h-8 gap-1.5 rounded-full border-(--nt-line) bg-white px-3 text-[.8rem] font-medium text-muted">
                <MapPinIcon /> {contact.city}
              </Badge>
            )}
          </div>
          <h1 className="nt-h1 mt-8 mb-0 text-[clamp(2.5rem,5.6vw,4.6rem)] text-ink">{hero.title}</h1>
          {hero.subtitle && <p className="mt-6 mb-0 max-w-[34rem] text-[1.1rem] leading-relaxed text-muted">{hero.subtitle}</p>}
        </div>
        <div>
          <div className="flex flex-wrap gap-3">
            {bookingUrl && (
              <Button href={link(bookingUrl)} size="lg" className={cn(pill, "h-12 px-6")}>
                <CalendarIcon /> Reservar cita
              </Button>
            )}
            {contact.phone && (
              <Button href={telHref(contact.phone)} variant="outline" size="lg" className={cn(pill, "h-12 border-(--nt-line) px-6")}>
                <PhoneIcon /> {contact.phone}
              </Button>
            )}
          </div>
          {highlights.length > 0 && (
            <ul className="mt-8 flex list-none flex-wrap gap-x-6 gap-y-2 p-0 text-[.88rem] text-ink">
              {highlights.slice(0, 3).map((h) => (
                <li key={h.title} className="flex items-center gap-2">
                  <span className="flex size-5 items-center justify-center rounded-full bg-(--nt-tint) text-primary [&_svg]:size-3">
                    <CheckIcon />
                  </span>
                  {h.title}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Panel>

      <Panel as="div" tone={cover ? "white" : "brand"} className="relative min-h-[22rem] overflow-hidden lg:col-span-5">
        {cover ? (
          <img src={cover} alt="" className="absolute inset-0 size-full object-cover" />
        ) : (
          <>
            <div className="nt-grid-bg absolute inset-0" aria-hidden="true" />
            <div className="relative flex h-full flex-col gap-10 p-8 pb-24 md:p-10 md:pb-28">
              <span className="flex size-14 items-center justify-center rounded-2xl bg-white/15 [&_svg]:size-7">
                <ShieldCheckIcon />
              </span>
              <p className="nt-h2 m-0 mt-auto max-w-[16ch] text-[clamp(1.7rem,2.8vw,2.4rem)]">Valoración, tratamiento y seguimiento. Todo en un mismo sitio.</p>
            </div>
          </>
        )}
        {address && (
          <div className="absolute right-4 bottom-4 left-4 flex items-center gap-3 rounded-2xl bg-white/90 p-3 pr-4 text-ink backdrop-blur-md md:right-auto">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <MapPinIcon />
            </span>
            <span className="min-w-0 text-[.86rem] leading-snug">
              <strong className="block font-semibold">Dónde estamos</strong>
              <span className="text-muted">{address}</span>
            </span>
          </div>
        )}
      </Panel>

      {stats.length > 0 && (
        <div className={cn("grid grid-cols-2 gap-3 md:gap-4 lg:col-span-12", stats.length >= 4 ? "lg:grid-cols-4" : stats.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-2")}>
          {stats.map((s) => (
            <Panel as="div" key={s.label} tone={s.brand ? "brand" : "white"} className="p-6 md:p-7">
              <p className="nt-num m-0 text-[clamp(1.8rem,3vw,2.6rem)]">{s.value}</p>
              <p className={cn("mt-2 mb-0 text-[.88rem]", s.brand ? "text-primary-foreground/80" : "text-muted")}>{s.label}</p>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Services ----------

export function ServiceCard({ service, props }: { service: SiteService; props: SitePageProps }) {
  const { bookingUrl, link } = props;
  const Tag = bookingUrl ? "a" : "div";
  return (
    <Tag
      {...(bookingUrl ? { href: link(bookingUrl), "aria-label": `${service.name}, ${formatPrice(service.priceCents)}: reservar` } : {})}
      className="group flex h-full flex-col rounded-[1.5rem] bg-(--nt-soft) p-6 text-ink no-underline transition-colors duration-300 hover:bg-(--nt-tint)"
    >
      <div className="flex items-start justify-between gap-4">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-white text-primary shadow-[0_1px_2px_rgba(16,24,40,.06)]">
          <ServiceIcon name={service.name} description={service.description} />
        </span>
        {service.isGroup && <Badge className="rounded-full bg-white px-2.5 text-[.72rem] font-medium text-ink">En grupo</Badge>}
      </div>
      <h3 className="nt-h3 mt-6 mb-0 text-[1.25rem]">{service.name}</h3>
      {service.description && <p className="mt-2 mb-0 line-clamp-3 text-[.92rem] leading-relaxed text-muted">{service.description}</p>}
      <div className="mt-auto flex items-center justify-between gap-3 pt-6">
        <span className="inline-flex items-center gap-1.5 text-[.85rem] text-muted [&_svg]:size-4">
          <ClockIcon /> {formatDuration(service.durationMinutes)}
        </span>
        <span className="flex items-center gap-3">
          <span className="nt-num text-[1.35rem]">{formatPrice(service.priceCents)}</span>
          {bookingUrl && (
            <span className="flex size-9 items-center justify-center rounded-full bg-ink text-white transition-transform duration-300 group-hover:-rotate-45">
              <ArrowRight />
            </span>
          )}
        </span>
      </div>
    </Tag>
  );
}

// When the last row isn't full, the free cell helps people who don't know
// which treatment they need
export function ServiceGrid({ services, props, help: withHelp = true }: { services: SiteService[]; props: SitePageProps; help?: boolean }) {
  const { bookingUrl, link, content } = props;
  const phone = content.contact.phone;
  const help = withHelp && services.length % 3 !== 0 && (bookingUrl || phone);
  return (
    <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
      {services.map((s) => (
        <li key={s.name}>
          <ServiceCard service={s} props={props} />
        </li>
      ))}
      {help && (
        <li className={cn(services.length % 3 === 1 && "lg:col-span-2")}>
          <div className="relative flex h-full min-h-[14rem] flex-col justify-between gap-6 overflow-hidden rounded-[1.5rem] bg-primary p-6 text-primary-foreground">
            <div className="nt-grid-bg pointer-events-none absolute inset-0" aria-hidden="true" />
            <div className="relative">
              <h3 className="nt-h3 m-0 text-[1.25rem]">¿No sabes cuál elegir?</h3>
              <p className="mt-2 mb-0 max-w-[26rem] text-[.92rem] leading-relaxed text-primary-foreground/80">Empieza por una sesión de fisioterapia: valoramos tu caso y te decimos qué necesitas.</p>
            </div>
            <div className="relative flex flex-wrap gap-2">
              {bookingUrl && (
                <Button href={link(bookingUrl)} variant="secondary" className={cn(pill, "bg-white text-ink hover:bg-white/90")}>
                  Reservar valoración
                </Button>
              )}
              {phone && (
                <Button href={telHref(phone)} variant="outline" className={cn(pill, "border-white/40 bg-transparent text-primary-foreground hover:bg-white/10")}>
                  <PhoneIcon /> Consultar
                </Button>
              )}
            </div>
          </div>
        </li>
      )}
    </ul>
  );
}

// ---------- About ----------

// The clinic's text in a big panel, the highlights as numbered tiles and,
// when there are photos, one of the centre
export function About({ props, full }: P & { full?: boolean }) {
  const { content, clinic, img, link } = props;
  const { about, highlights, sections } = content;
  const hasText = sections.about && !!about?.text;
  const photo = img(content.galleryIds[0]) ?? (full ? undefined : img(content.coverId));
  if (!hasText && !highlights.length) return null;
  return (
    <div className="grid gap-3 md:gap-4 lg:grid-cols-12" id="nosotros">
      {hasText && (
        <Panel className={cn("p-7 md:p-12", highlights.length || photo ? "lg:col-span-7" : "lg:col-span-12")}>
          <Eyebrow className="mb-3">Sobre nosotros</Eyebrow>
          <h2 className="nt-h2 m-0 text-[clamp(1.9rem,3.6vw,3rem)] text-ink">{about!.title || `Esto es ${clinic.name}`}</h2>
          <div className={cn("mt-6 grid gap-4 text-[1.02rem] leading-relaxed text-muted", !full && "[&>p:nth-child(n+3)]:hidden")}>
            <Paragraphs text={about!.text} className="m-0" />
          </div>
          {!full && pageAvailable("nosotros", props) && (
            <div className="mt-8">
              <MoreLink href={link("/nosotros")}>Conoce el centro</MoreLink>
            </div>
          )}
        </Panel>
      )}
      {(highlights.length > 0 || photo) && (
        <div className={cn("grid gap-3 md:gap-4", hasText ? "lg:col-span-5" : "lg:col-span-12 lg:grid-cols-3")}>
          {photo && hasText && (
            <Panel as="div" className="relative min-h-[14rem] overflow-hidden">
              <img src={photo} alt="" className="absolute inset-0 size-full object-cover" loading="lazy" />
            </Panel>
          )}
          {highlights.map((h, i) => (
            <Panel as="div" key={h.title} tone="white" className="flex gap-5 p-6 md:p-7">
              <span className="nt-num flex size-11 shrink-0 items-center justify-center rounded-2xl bg-(--nt-tint) text-[1rem] text-primary">{String(i + 1).padStart(2, "0")}</span>
              <div>
                <h3 className="nt-h3 m-0 text-[1.12rem]">{h.title}</h3>
                {h.text && <p className="mt-1.5 mb-0 text-[.92rem] leading-relaxed text-muted">{h.text}</p>}
              </div>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- How it works (the dark panel) ----------

const STEPS = [
  { title: "Reserva online", text: "Eliges tratamiento, día y hora en menos de un minuto." },
  { title: "Valoración", text: "Analizamos tu caso y te explicamos qué te pasa y por qué." },
  { title: "Tratamiento", text: "Un plan concreto: terapia manual, ejercicio y objetivos claros." },
  { title: "Seguimiento", text: "Medimos tu evolución y te damos pautas para casa." },
];

export function Process({ props }: P) {
  const { bookingUrl, link, content } = props;
  return (
    <Panel tone="dark" className="relative overflow-hidden p-7 md:p-12">
      <div className="nt-glow pointer-events-none absolute -top-40 -right-40 size-[32rem] rounded-full" aria-hidden="true" />
      <Head
        dark
        eyebrow="Cómo funciona"
        title="De la primera cita al alta, sin complicaciones"
        action={
          bookingUrl ? (
            <Button href={link(bookingUrl)} className={cn(pill, "relative")}>
              Reservar ahora <ArrowUpRight />
            </Button>
          ) : (
            content.contact.phone && (
              <Button href={telHref(content.contact.phone)} className={cn(pill, "relative")}>
                <PhoneIcon /> Llamar
              </Button>
            )
          )
        }
        className="relative"
      />
      <ol className="relative m-0 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map((s, i) => (
          <li key={s.title} className="flex flex-col rounded-[1.5rem] border border-white/10 bg-white/[.04] p-6">
            <span className="nt-num text-[.85rem] text-white/50">0{i + 1}</span>
            <h3 className="nt-h3 mt-10 mb-0 text-[1.2rem] text-white">{s.title}</h3>
            <p className="mt-2 mb-0 text-[.92rem] leading-relaxed text-white/60">{s.text}</p>
          </li>
        ))}
      </ol>
    </Panel>
  );
}

// ---------- Team ----------

function MemberCard({ member, full }: { member: SiteTeamMember; full?: boolean }) {
  return (
    <article className="flex h-full flex-col rounded-[1.5rem] bg-(--nt-soft) p-3">
      <div className="relative aspect-[4/5] overflow-hidden rounded-[1.15rem] bg-(--nt-tint)">
        {member.photoUrl ? (
          <img src={member.photoUrl} alt={member.name} loading="lazy" className="size-full object-cover" />
        ) : (
          <span className="nt-num flex size-full items-center justify-center text-[3.5rem] text-primary">{initials(member.name)}</span>
        )}
        {member.licenseNumber && (
          <span className="absolute top-3 left-3 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-[.72rem] font-medium text-ink backdrop-blur [&_svg]:size-3.5 [&_svg]:text-primary">
            <ShieldCheckIcon /> Nº col. {member.licenseNumber}
          </span>
        )}
      </div>
      <div className="px-3 pt-5 pb-3">
        <h3 className="nt-h3 m-0 text-[1.2rem]">{member.name}</h3>
        {member.headline && <p className="mt-1 mb-0 text-[.88rem] text-primary">{member.headline}</p>}
        {member.bio && <p className={cn("mt-3 mb-0 text-[.9rem] leading-relaxed text-muted", !full && "line-clamp-3")}>{member.bio}</p>}
      </div>
    </article>
  );
}

export function TeamGrid({ team, full }: { team: SiteTeamMember[]; full?: boolean }) {
  return (
    <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
      {team.map((m) => (
        <li key={m.name}>
          <MemberCard member={m} full={full} />
        </li>
      ))}
    </ul>
  );
}

// ---------- FAQ + contact ----------

export function Faq({ props, className }: P & { className?: string }) {
  const { faq, contact } = props.content;
  return (
    <Panel className={cn("flex flex-col p-7 md:p-12", className)} id="preguntas">
      <Head eyebrow="Preguntas frecuentes" title="Lo que nos preguntan antes de venir" className="md:mb-6" />
      <Accordion className="nt-faq">
        {faq.map((f) => (
          <AccordionItem key={f.q} title={f.q} name="nt-faq">
            <Paragraphs text={f.a} className="m-0 mb-2 last:mb-0" />
          </AccordionItem>
        ))}
      </Accordion>
      {(contact.phone || contact.whatsapp) && (
        <div className="mt-auto pt-10">
          <div className="flex flex-col gap-4 rounded-[1.5rem] bg-(--nt-soft) p-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="m-0 flex items-center gap-3 text-[.95rem] font-medium text-ink">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-primary">
                <ChatIcon />
              </span>
              ¿Tienes otra pregunta? Te respondemos hoy.
            </p>
            <div className="flex shrink-0 gap-2">
              {contact.whatsapp && (
                <Button href={whatsappHref(contact.whatsapp)} target="_blank" rel="noopener" variant="outline" className={cn(pill, "h-10 border-(--nt-line) bg-white")}>
                  WhatsApp
                </Button>
              )}
              {contact.phone && (
                <Button href={telHref(contact.phone)} className={cn(pill, "h-10")}>
                  Llamar
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}

export function ContactCard({ props, className }: P & { className?: string }) {
  const { content, hours } = props;
  const c = content.contact;
  const address = fullAddress(c);
  const showHours = content.sections.hours && hours.length > 0;
  type Row = { Icon: typeof PhoneIcon; label: string; value: string; href: string | undefined; external?: boolean };
  const rows: (Row | false | "" | undefined)[] = [
    c.phone && { Icon: PhoneIcon, label: "Teléfono", value: c.phone, href: telHref(c.phone) },
    c.whatsapp && { Icon: ChatIcon, label: "WhatsApp", value: "Escríbenos", href: whatsappHref(c.whatsapp), external: true },
    c.email && { Icon: MailIcon, label: "Email", value: c.email, href: `mailto:${c.email}` },
    address && { Icon: MapPinIcon, label: "Dirección", value: address, href: c.mapsUrl, external: true },
  ];
  const list = rows.filter((r): r is Row => !!r);
  if (!list.length && !showHours) return null;
  return (
    <Panel className={cn("flex flex-col gap-8 p-7 md:p-10", className)} id="contacto">
      <div>
        <Eyebrow className="mb-3">Contacto</Eyebrow>
        <h2 className="nt-h2 m-0 text-[clamp(1.7rem,2.6vw,2.2rem)] text-ink">Hablemos</h2>
      </div>
      {list.length > 0 && (
        <ul className="m-0 grid list-none gap-2 p-0">
          {list.map(({ Icon, label, value, href, external }) => {
            const inner = (
              <>
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white text-primary">
                  <Icon />
                </span>
                <span className="min-w-0">
                  <span className="block text-[.75rem] text-muted">{label}</span>
                  <span className="block font-medium break-words text-ink">{value}</span>
                </span>
              </>
            );
            return (
              <li key={label}>
                {href ? (
                  <a href={href} className="flex items-center gap-3 rounded-2xl bg-(--nt-soft) p-2.5 no-underline transition-colors hover:bg-(--nt-tint)" {...(external ? { target: "_blank", rel: "noopener" } : {})}>
                    {inner}
                  </a>
                ) : (
                  <div className="flex items-center gap-3 rounded-2xl bg-(--nt-soft) p-2.5">{inner}</div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {showHours && (
        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h3 className="nt-h3 m-0 text-[1.05rem]">Horario</h3>
            <StatusBadge props={props} className="h-7 text-[.75rem]" />
          </div>
          <HoursList hours={hours} />
        </div>
      )}
      <SocialLinks content={content} />
    </Panel>
  );
}

// ---------- Call to action ----------

export function Cta({ props }: P) {
  const { bookingUrl, link, content } = props;
  const phone = content.contact.phone;
  if (!bookingUrl && !phone) return null;
  return (
    <Panel tone="brand" className="relative overflow-hidden p-8 md:p-14">
      <div className="nt-grid-bg pointer-events-none absolute inset-0 opacity-60" aria-hidden="true" />
      <div className="relative flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
        <div className="max-w-[36rem]">
          <h2 className="nt-h2 m-0 text-[clamp(2rem,4.2vw,3.4rem)] text-primary-foreground">¿Te duele? No lo dejes para mañana.</h2>
          <p className="mt-4 mb-0 text-[1.05rem] text-primary-foreground/80">
            {bookingUrl ? "Reserva tu primera visita online. Te confirmamos al momento." : "Llámanos y te damos cita en el primer hueco libre."}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {bookingUrl && (
            <Button href={link(bookingUrl)} variant="secondary" className={cn(pill, "h-12 bg-white px-6 text-ink hover:bg-white/90")}>
              <CalendarIcon /> Reservar cita
            </Button>
          )}
          {phone && (
            <Button href={telHref(phone)} variant="outline" className={cn(pill, "h-12 border-white/40 bg-transparent px-6 text-primary-foreground hover:bg-white/10")}>
              <PhoneIcon /> {phone}
            </Button>
          )}
        </div>
      </div>
    </Panel>
  );
}

// ---------- Inner pages ----------

export function PageHead({ props, title, lead, crumb, aside }: P & { title: string; lead?: string; crumb: string; aside?: ReactNode }) {
  return (
    <div className="grid gap-3 md:gap-4 lg:grid-cols-12">
      <Panel as="div" className={cn("p-7 md:p-12", aside ? "lg:col-span-8" : "lg:col-span-12")}>
        <div className="nt-crumb">
          <Breadcrumb items={[{ label: "Inicio", href: props.link("/") }, { label: crumb }]} />
        </div>
        <h1 className="nt-h1 mt-6 mb-0 text-[clamp(2.3rem,5vw,4rem)] text-ink">{title}</h1>
        {lead && <p className="mt-5 mb-0 max-w-[38rem] text-[1.08rem] leading-relaxed text-muted">{lead}</p>}
      </Panel>
      {aside && <div className="grid gap-3 md:gap-4 lg:col-span-4">{aside}</div>}
    </div>
  );
}

export function FactTile({ value, label, brand }: { value: string; label: string; brand?: boolean }) {
  return (
    <Panel as="div" tone={brand ? "brand" : "white"} className="flex flex-col justify-end p-6 md:p-7">
      <p className="nt-num m-0 text-[clamp(1.6rem,2.6vw,2.2rem)]">{value}</p>
      <p className={cn("mt-1.5 mb-0 text-[.88rem]", brand ? "text-primary-foreground/80" : "text-muted")}>{label}</p>
    </Panel>
  );
}

export function Gallery({ images }: { images: string[] }) {
  return (
    <ul className="m-0 grid list-none grid-cols-2 gap-3 p-0 md:grid-cols-4 md:gap-4">
      {images.map((src, i) => (
        <li key={src} className={cn("overflow-hidden rounded-[1.5rem]", i === 0 && "col-span-2 row-span-2")}>
          <img src={src} alt="" loading="lazy" className="aspect-square size-full object-cover" />
        </li>
      ))}
    </ul>
  );
}
