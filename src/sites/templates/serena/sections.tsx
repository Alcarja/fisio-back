import type { ReactNode } from "react";
import { ContactList, Paragraphs } from "../shared/blocks.js";
import { firstSentence, formatDuration, formatPrice, fullAddress, hoursByDay, initials, openStatus, spainNow, telHref, whatsappHref } from "../shared/format.js";
import {
  ActivityIcon,
  CalendarIcon,
  ChatIcon,
  CheckIcon,
  ClipboardIcon,
  HandIcon,
  MapPinIcon,
  PersonIcon,
  PhoneIcon,
  RouteIcon,
  ServiceIcon,
  ShieldCheckIcon,
} from "../shared/icons.js";
import {
  Accordion,
  AccordionItem,
  ArrowRight,
  ArrowUpRight,
  Avatar,
  Badge,
  Breadcrumb,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../shared/ui.js";
import type { SitePageProps, SiteService, SiteTeamMember } from "../types.js";

// Serena's pieces, shared by the home page and the inner pages. A clinic
// site, not a brochure: what a patient looks for first (is it open, where is
// it, who treats me, what does it cost) built from each clinic's own data.
// Signature: a spine drawn in the clinic's colour.

type P = { props: SitePageProps };

// ---------- Identity ----------

// "Recupera tu movimiento con calma" → the last word in the clinic's colour
export function Emphasis({ text }: { text: string }) {
  const words = text.trim().split(/\s+/);
  if (words.length < 3) return <>{text}</>;
  const last = words.pop();
  return (
    <>
      {words.join(" ")} <span className="se-em">{last}</span>
    </>
  );
}

export function Eyebrow({ children, index }: { children: ReactNode; index?: string }) {
  return (
    <p className="se-eyebrow">
      {index && <span className="se-eyebrow-num">{index}</span>}
      {children}
    </p>
  );
}

// "01", "02"… in the order the sections are drawn (hidden ones don't count)
export function counter() {
  let n = 0;
  return () => String(++n).padStart(2, "0");
}

// Logo, or a monogram mark + the name, like a real clinic's brand
export function Brand({ props, inverted }: P & { inverted?: boolean }) {
  const { clinic, content, img, link } = props;
  const logo = img(content.logoId);
  const city = content.contact.city;
  return (
    <a href={link("/")} className={`se-brand${inverted ? " se-brand-inv" : ""}`}>
      {logo && !inverted ? (
        <img src={logo} alt={clinic.name} className="se-logo" />
      ) : (
        <>
          <span className="se-mark" aria-hidden="true">
            {initials(clinic.name)}
          </span>
          <span className="se-brand-text">
            <strong>{clinic.name}</strong>
            <small>Fisioterapia{city ? ` · ${city}` : ""}</small>
          </span>
        </>
      )}
    </a>
  );
}

// A spine: vertebrae along a gentle S-curve, bigger towards the lumbar spine
export function Spine({ className }: { className?: string }) {
  const n = 13;
  const top = 34;
  const span = 412;
  const curve = (t: number) => 120 + 30 * Math.sin(t * Math.PI * 1.8 - 0.5);
  const parts = Array.from({ length: n }, (_, i) => {
    const t = i / (n - 1);
    const y = top + t * span;
    const x = curve(t);
    const slope = (curve(t + 0.01) - curve(t - 0.01)) / ((0.02 * span) || 1);
    const angle = (-Math.atan(slope) * 180) / Math.PI;
    const w = 40 + t * 30;
    const h = 20 + t * 6;
    return { x, y, angle, w, h };
  });
  return (
    <svg className={`se-spine ${className ?? ""}`} viewBox="0 0 240 480" aria-hidden="true">
      <circle cx="120" cy="240" r="200" className="se-spine-halo" />
      <circle cx="120" cy="240" r="140" className="se-spine-halo2" />
      {parts.map((p, i) => (
        <g key={i} transform={`translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${p.angle.toFixed(1)})`}>
          <rect x={-p.w * 0.82} y={-p.h * 0.18} width={p.w * 1.64} height={p.h * 0.36} rx={p.h * 0.18} className="se-spine-wing" />
          <rect x={-p.w / 2} y={-p.h / 2} width={p.w} height={p.h} rx={p.h / 2.2} className="se-spine-body" />
          {i < n - 1 && <ellipse cx="0" cy={p.h / 2 + 5.5} rx={p.w * 0.36} ry="2.6" className="se-spine-disc" />}
        </g>
      ))}
    </svg>
  );
}

export function SectionHead({
  eyebrow,
  title,
  lead,
  action,
  center,
  index,
}: {
  eyebrow: string;
  title: ReactNode;
  lead?: string;
  action?: ReactNode;
  center?: boolean;
  index?: string;
}) {
  return (
    <div className={`se-head${center ? " se-head-center" : ""}`}>
      <div>
        <Eyebrow index={index}>{eyebrow}</Eyebrow>
        <h2>{title}</h2>
        {lead && <p className="se-head-lead">{lead}</p>}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({ props, title, lead, crumb }: P & { title: string; lead?: string; crumb: string }) {
  return (
    <section className="se-page-head">
      <div className="kf-wrap se-page-head-inner">
        <div>
          <Breadcrumb items={[{ label: "Inicio", href: props.link("/") }, { label: crumb }]} />
          <h1>
            <Emphasis text={title} />
          </h1>
          {lead && <p className="se-lead">{lead}</p>}
        </div>
      </div>
      <Spine className="se-page-spine" />
    </section>
  );
}

export function MoreLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Button variant="outline" href={href}>
      {children}
      <ArrowRight />
    </Button>
  );
}

// A round sticker with text running around it, turning slowly
export function Sticker({ text, href, children }: { text: string; href?: string; children: ReactNode }) {
  const Tag = href ? "a" : "span";
  return (
    <Tag className="se-sticker" {...(href ? { href } : {})} aria-label={href ? text : undefined}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <defs>
          <path id="se-sticker-path" d="M60 60m-46 0a46 46 0 1 1 92 0a46 46 0 1 1-92 0" />
        </defs>
        <text>
          <textPath href="#se-sticker-path" textLength="288">
            {text}
          </textPath>
        </text>
      </svg>
      <span className="se-sticker-core">{children}</span>
    </Tag>
  );
}

// The clinic's own treatments, scrolling by
export function Marquee({ items }: { items: string[] }) {
  if (items.length < 3) return null;
  const row = [...items, ...items];
  return (
    <div className="se-marquee" aria-hidden="true">
      <div className="se-marquee-track">
        {[0, 1].map((copy) => (
          <ul key={copy}>
            {row.map((t, i) => (
              <li key={i}>
                {t}
                <span className="se-marquee-dot" />
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}

// A small ring: how long the session is, out of an hour and a half
function DurationRing({ minutes }: { minutes: number }) {
  const r = 7;
  const length = 2 * Math.PI * r;
  const share = Math.min(minutes / 90, 1);
  return (
    <svg className="se-ring" viewBox="0 0 18 18" aria-hidden="true">
      <circle cx="9" cy="9" r={r} className="se-ring-track" />
      <circle cx="9" cy="9" r={r} className="se-ring-fill" strokeDasharray={`${(share * length).toFixed(2)} ${length.toFixed(2)}`} />
    </svg>
  );
}

// ---------- Open now ----------

export function statusOf(props: SitePageProps) {
  return props.content.sections.hours ? openStatus(props.hours) : null;
}

export function Status({ status, className }: { status: { open: boolean; label: string }; className?: string }) {
  return (
    <span className={`se-status${status.open ? " se-status-open" : ""} ${className ?? ""}`}>
      <span className="se-status-dot" aria-hidden="true" />
      {status.label}
    </span>
  );
}

// Monday to Sunday, today marked
export function HoursList({ hours }: { hours: SitePageProps["hours"] }) {
  const today = spainNow().weekday;
  return (
    <ul className="se-hours">
      {hoursByDay(hours).map((d, i) => (
        <li key={d.label} className={`${i + 1 === today ? "se-today" : ""}${d.ranges.length ? "" : " se-closed"}`}>
          <span>
            {d.label}
            {i + 1 === today && <Badge variant="secondary">Hoy</Badge>}
          </span>
          <span>{d.ranges.length ? d.ranges.join(" · ") : "Cerrado"}</span>
        </li>
      ))}
    </ul>
  );
}

// ---------- Trust ----------

// Only true things, from the clinic's data
export function TrustBar({ props }: P) {
  const { team, content, bookingUrl } = props;
  const licensed = content.sections.team && team.some((m) => m.licenseNumber);
  const address = content.contact.address;
  const items = [
    licensed && { Icon: ShieldCheckIcon, title: "Fisioterapeutas colegiados", text: "Profesionales sanitarios titulados" },
    content.healthRegistry && { Icon: ClipboardIcon, title: "Centro sanitario autorizado", text: `Registro ${content.healthRegistry}` },
    bookingUrl && { Icon: CalendarIcon, title: "Reserva online", text: "Elige día y hora en un minuto" },
    address && { Icon: MapPinIcon, title: content.contact.city || "Dónde estamos", text: address },
  ].filter((i): i is { Icon: typeof ShieldCheckIcon; title: string; text: string } => !!i);
  if (!items.length) return null;
  return (
    <div className="kf-wrap">
      <ul className="se-trust">
        {items.map(({ Icon, title, text }) => (
          <li key={title}>
            <span className="se-trust-icon">
              <Icon />
            </span>
            <span>
              <strong>{title}</strong>
              <span>{text}</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function AvatarStack({ team }: { team: SiteTeamMember[] }) {
  return (
    <span className="se-stack">
      {team.slice(0, 4).map((m) => (
        <Avatar key={m.name} src={m.photoUrl} alt="" fallback={initials(m.name)} size="sm" />
      ))}
    </span>
  );
}

// ---------- Services ----------

const price = (s: SiteService) => (s.priceCents > 0 ? formatPrice(s.priceCents) : null);

export function ServiceCard({ service, props, full, index }: { service: SiteService; props: SitePageProps; full?: boolean; index?: number }) {
  return (
    <Card className="se-service">
      <CardHeader>
        <span className="se-service-top">
          <span className="se-service-icon">
            <ServiceIcon name={service.name} description={service.description} />
          </span>
          {index !== undefined && <span className="se-service-num">{String(index + 1).padStart(2, "0")}</span>}
        </span>
        <CardTitle>{service.name}</CardTitle>
        {service.description && (
          <CardDescription className={full ? undefined : "se-clamp"}>
            <Paragraphs text={service.description} />
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="se-service-meta">
        <span>
          <DurationRing minutes={service.durationMinutes} />
          {formatDuration(service.durationMinutes)}
        </span>
        {service.isGroup && <Badge variant="secondary">En grupo</Badge>}
      </CardContent>
      <CardFooter className="se-service-foot">
        <span className="se-price">{price(service) ?? <span className="se-price-ask">Consúltanos</span>}</span>
        {props.bookingUrl && (
          <Button variant="ghost" size="sm" href={props.link(props.bookingUrl)}>
            Reservar
            <ArrowRight />
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}

// ---------- First visit ----------

const VISIT = [
  { Icon: ClipboardIcon, title: "Valoración", text: "Escuchamos tu historia y exploramos la zona para entender el origen del problema." },
  { Icon: ActivityIcon, title: "Plan claro", text: "Te explicamos qué te pasa, qué vamos a hacer y cuántas sesiones calculamos." },
  { Icon: HandIcon, title: "Tratamiento", text: "Terapia manual, ejercicio y las técnicas que mejor encajen contigo." },
  { Icon: PersonIcon, title: "Autonomía", text: "Te llevas ejercicios para casa para que la mejoría dure." },
];

export function FirstVisit({ props, index }: P & { index?: string }) {
  return (
    <section className="se-section se-tint se-dots">
      <div className="kf-wrap">
        <SectionHead
          index={index}
          eyebrow="Tu primera visita"
          title="Así trabajamos contigo"
          lead="Sin prisas y con un objetivo: que entiendas tu cuerpo y vuelvas a moverte sin dolor."
          action={
            props.bookingUrl ? (
              <Button href={props.link(props.bookingUrl)}>
                <CalendarIcon />
                Pedir valoración
              </Button>
            ) : undefined
          }
        />
        <ol className="se-visit">
          {VISIT.map(({ Icon, title, text }, i) => (
            <li key={title}>
              <span className="se-visit-icon">
                <Icon />
                <span className="se-visit-num">{i + 1}</span>
              </span>
              <h3>{title}</h3>
              <p>{text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ---------- Team ----------

export function TeamCard({ member, full }: { member: SiteTeamMember; full?: boolean }) {
  return (
    <article className="se-person">
      <div className="se-portrait">
        {member.photoUrl ? (
          <img src={member.photoUrl} alt={member.name} loading="lazy" />
        ) : (
          <span className="se-portrait-initials" aria-hidden="true">
            {initials(member.name)}
          </span>
        )}
        {!full && member.bio && (
          <span className="se-portrait-bio">
            <span>{firstSentence(member.bio)}</span>
          </span>
        )}
        {member.licenseNumber && (
          <span className="se-license">
            <ShieldCheckIcon />
            Col. nº {member.licenseNumber}
          </span>
        )}
      </div>
      <h3>{member.name}</h3>
      {member.headline && <p className="se-role">{member.headline}</p>}
      {full && member.bio && <Paragraphs text={member.bio} className="se-bio" />}
    </article>
  );
}

// ---------- About ----------

export function Highlights({ items }: { items: SitePageProps["content"]["highlights"] }) {
  return (
    <ul className="se-highlights">
      {items.map((h, i) => (
        <li key={i}>
          <span className="se-check">
            <CheckIcon />
          </span>
          <span>
            <strong>{h.title}</strong>
            {h.text && <span>{h.text}</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

// The first sentence of the clinic's story, signed by the team
export function QuoteCard({ props }: P) {
  const quote = firstSentence(props.content.about?.text);
  if (!quote) return null;
  return (
    <figure className="se-quote">
      <svg className="se-quote-mark" viewBox="0 0 32 24" aria-hidden="true">
        <path d="M0 24V14C0 6 4 1.5 12 0l1.5 3.5C9 5 7 8 7 12h6v12H0zm19 0V14c0-8 4-12.5 12-14l1 3.5C27.5 5 25.5 8 25.5 12H32v12H19z" />
      </svg>
      <blockquote>{quote}</blockquote>
      <figcaption>
        <AvatarStack team={props.content.sections.team ? props.team : []} />
        <span>Equipo de {props.clinic.name}</span>
      </figcaption>
    </figure>
  );
}

export function Gallery({ images }: { images: string[] }) {
  return (
    <ul className={`se-gallery se-gallery-${Math.min(images.length, 5)}`}>
      {images.slice(0, 5).map((src) => (
        <li key={src}>
          <img src={src} alt="" loading="lazy" />
        </li>
      ))}
    </ul>
  );
}

// ---------- FAQ ----------

export function Faq({ props, index }: P & { index?: string }) {
  const { faq, contact, sections } = props.content;
  const team = sections.team ? props.team : [];
  return (
    <div className="se-faq">
      <div className="se-faq-side">
        <Eyebrow index={index}>Preguntas frecuentes</Eyebrow>
        <h2>Resolvemos tus dudas</h2>
        <p>Lo que más nos preguntan antes de la primera sesión.</p>
        {(contact.phone || contact.whatsapp) && (
          <div className="se-ask">
            {team.length > 0 && <AvatarStack team={team} />}
            <p>
              <strong>¿Te quedan dudas?</strong>
              <span>Te responde directamente el equipo, sin centralitas.</span>
            </p>
            <div className="se-ask-actions">
              {contact.phone && (
                <Button size="sm" variant="outline" href={telHref(contact.phone)}>
                  <PhoneIcon />
                  Llamar
                </Button>
              )}
              {contact.whatsapp && (
                <Button size="sm" variant="outline" href={whatsappHref(contact.whatsapp)} target="_blank" rel="noopener">
                  <ChatIcon />
                  WhatsApp
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
      <Accordion>
        {faq.map((f, i) => (
          <AccordionItem key={i} title={f.q}>
            <Paragraphs text={f.a} />
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}

// ---------- Call to action ----------

export function CtaBand({ props }: P) {
  const { bookingUrl, link, content } = props;
  const phone = content.contact.phone;
  if (!bookingUrl && !phone) return null;
  return (
    <section className="se-section se-tight">
      <div className="kf-wrap">
        <div className="se-cta">
          <div className="se-cta-text">
            <p className="se-cta-title">¿Algo te duele? Empecemos por entender por qué.</p>
            <p>Cuanto antes lo valoremos, antes vuelves a tu ritmo. Reserva tu primera sesión cuando te venga bien.</p>
            <div className="se-actions">
              {bookingUrl && (
                <Button size="lg" variant="secondary" href={link(bookingUrl)}>
                  <CalendarIcon />
                  Reservar cita
                </Button>
              )}
              {phone && (
                <Button size="lg" variant="outline" className="se-btn-inv" href={telHref(phone)}>
                  <PhoneIcon />
                  {phone}
                </Button>
              )}
            </div>
          </div>
          <Spine className="se-cta-spine" />
        </div>
      </div>
    </section>
  );
}

// ---------- Location ----------

// A drawn map (no third parties: a real embedded map would send visitors'
// data to Google), the address, how to get there and the hours
export function Location({ props }: P) {
  const { content, hours } = props;
  const c = content.contact;
  const address = fullAddress(c);
  const status = statusOf(props);
  return (
    <div className="se-location">
      <Card className="se-map-card">
        <div className="se-map" aria-hidden="true">
          <svg viewBox="0 0 400 220" preserveAspectRatio="xMidYMid slice">
            <path className="se-map-block" d="M0 0h400v220H0z" />
            <path className="se-map-road se-map-main" d="M-10 150 C 90 140, 160 90, 410 70" />
            <path className="se-map-road" d="M120 -10 L 150 230 M 260 -10 L 240 230 M -10 40 L 410 30 M -10 200 L 410 190 M 330 -10 L 360 230 M 40 -10 L 60 230" />
            <path className="se-map-park" d="M270 120h70v50h-70z" />
          </svg>
          <span className="se-pin">
            <MapPinIcon />
          </span>
        </div>
        <CardHeader>
          <CardTitle>Dónde estamos</CardTitle>
          {address && <CardDescription>{address}</CardDescription>}
        </CardHeader>
        <CardContent>
          <ContactList content={{ ...content, contact: { ...c, address: undefined, postalCode: undefined, city: undefined } }} />
        </CardContent>
        {c.mapsUrl && (
          <CardFooter>
            <Button variant="link" href={c.mapsUrl} target="_blank" rel="noopener">
              <RouteIcon />
              Cómo llegar
              <ArrowUpRight />
            </Button>
          </CardFooter>
        )}
      </Card>
      {content.sections.hours && hours.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Horario</CardTitle>
            {status && (
              <CardDescription>
                <Status status={status} />
              </CardDescription>
            )}
          </CardHeader>
          <CardContent>
            <HoursList hours={hours} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
