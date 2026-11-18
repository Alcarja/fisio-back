import type { ReactNode } from "react";
import { ContactList, Paragraphs } from "../shared/blocks.js";
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
  whatsappHref,
} from "../shared/format.js";
import {
  ActivityIcon,
  CalendarIcon,
  ChatIcon,
  ClipboardIcon,
  HandIcon,
  PersonIcon,
  PhoneIcon,
  RouteIcon,
  ServiceIcon,
  ShieldCheckIcon,
} from "../shared/icons.js";
import { Accordion, AccordionItem, ArrowRight, ArrowUpRight, Breadcrumb } from "../shared/ui.js";
import type { SitePageProps, SiteService, SiteTeamMember } from "../types.js";

// Clara's pieces. Bold and modern (thick ink outlines, hard shadows, heavy
// type, blocks of the clinic's colour, the health cross as signature) and its
// own structure: a tile hero, a split services board, a team rail, a dark
// timeline, an "Así somos" bento, and FAQ + contact together in "Hablemos".

type P = { props: SitePageProps };

// ---------- Identity ----------

export function Plus({ className }: { className?: string }) {
  return (
    <svg className={`cl-plus ${className ?? ""}`} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 2h6v7h7v6h-7v7H9v-7H2V9h7z" />
    </svg>
  );
}

// The last word on a tilted block of colour
export function Marker({ text }: { text: string }) {
  const words = text.trim().split(/\s+/);
  if (words.length < 2) return <mark className="cl-mark">{text}</mark>;
  const last = words.pop();
  return (
    <>
      {words.join(" ")} <mark className="cl-mark">{last}</mark>
    </>
  );
}

export function Tag({ index, children }: { index?: string; children: ReactNode }) {
  return (
    <p className="cl-tag">
      {index && <span>({index})</span>}
      {children}
    </p>
  );
}

export function counter() {
  let n = 0;
  return () => String(++n).padStart(2, "0");
}

export function Brand({ props, invert }: P & { invert?: boolean }) {
  const { clinic, content, img, link } = props;
  const logo = img(content.logoId);
  return (
    <a href={link("/")} className={`cl-brand${invert ? " cl-brand-invert" : ""}`}>
      {logo && !invert ? (
        <img src={logo} alt={clinic.name} className="cl-logo" />
      ) : (
        <>
          <span className="cl-brand-mark" aria-hidden="true">
            <Plus />
          </span>
          <span className="cl-brand-name">{clinic.name}</span>
        </>
      )}
    </a>
  );
}

export function Arrow({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} className="cl-arrow">
      {children}
      <span>
        <ArrowRight />
      </span>
    </a>
  );
}

export function Btn({
  href,
  children,
  tone = "primary",
  external,
}: {
  href: string;
  children: ReactNode;
  tone?: "primary" | "paper" | "ink";
  external?: boolean;
}) {
  return (
    <a href={href} className={`cl-btn cl-btn-${tone}`} {...(external ? { target: "_blank", rel: "noopener" } : {})}>
      {children}
    </a>
  );
}

// ---------- Open now ----------

export const statusOf = (props: SitePageProps) => (props.content.sections.hours ? openStatus(props.hours) : null);

export function StatusPill({ status, className }: { status: { open: boolean; label: string }; className?: string }) {
  return (
    <span className={`cl-status${status.open ? " cl-status-open" : ""} ${className ?? ""}`}>
      <span aria-hidden="true" />
      {status.label}
    </span>
  );
}

export function HoursBoard({ hours }: { hours: SitePageProps["hours"] }) {
  const today = spainNow().weekday;
  return (
    <ul className="cl-hours">
      {hoursByDay(hours).map((d, i) => (
        <li key={d.label} className={`${i + 1 === today ? "cl-today" : ""}${d.ranges.length ? "" : " cl-closed"}`}>
          <span>{d.label}</span>
          <span>{d.ranges.length ? d.ranges.join(" / ") : "Cerrado"}</span>
        </li>
      ))}
    </ul>
  );
}

// ---------- Ticker ----------

export function Ticker({ items }: { items: string[] }) {
  if (!items.length) return null;
  const row = [...items, ...items, ...items].slice(0, Math.max(items.length * 2, 8));
  return (
    <div className="cl-ticker" aria-hidden="true">
      <div className="cl-ticker-track">
        {[0, 1].map((copy) => (
          <ul key={copy}>
            {row.map((t, i) => (
              <li key={i}>
                {t}
                <Plus />
              </li>
            ))}
          </ul>
        ))}
      </div>
    </div>
  );
}

// ---------- Inner page header ----------

// Giant title on the left; on the right a tinted tile with the breadcrumb,
// the intro and the page's number ("02/04")
export function PageHead({ props, tag, title, lead, number }: P & { tag: string; title: string; lead?: string; number?: string }) {
  return (
    <section className="cl-page-head">
      <div className="kf-wrap cl-page-head-grid">
        <h1>
          <Marker text={title} />
        </h1>
        <div className="cl-page-head-side">
          <Breadcrumb items={[{ label: "Inicio", href: props.link("/") }, { label: tag }]} />
          {lead && <p>{lead}</p>}
          {number && <span className="cl-page-num">{number}</span>}
        </div>
      </div>
    </section>
  );
}

// ---------- Services: split board ----------

export function ServiceBoard({ services, props, full }: { services: SiteService[]; props: SitePageProps; full?: boolean }) {
  const { bookingUrl, link } = props;
  return (
    <ol className="cl-board">
      {services.map((s, i) => {
        const inner = (
          <>
            <span className="cl-board-num">{String(i + 1).padStart(2, "0")}</span>
            <span className="cl-board-icon">
              <ServiceIcon name={s.name} description={s.description} />
            </span>
            <span className="cl-board-main">
              <span className="cl-board-name">{s.name}</span>
              {s.description && (
                <span className={`cl-board-desc${full ? "" : " cl-board-clamp"}`}>{full ? s.description : firstSentence(s.description)}</span>
              )}
              <span className="cl-board-meta">
                <span className="cl-chip">{formatDuration(s.durationMinutes)}</span>
                {s.isGroup && <span className="cl-chip cl-chip-solid">Grupo</span>}
              </span>
            </span>
            <span className="cl-board-price">{s.priceCents > 0 ? formatPrice(s.priceCents) : "—"}</span>
            {bookingUrl && (
              <span className="cl-board-go" aria-hidden="true">
                <ArrowUpRight />
              </span>
            )}
          </>
        );
        return (
          <li key={s.name}>
            {bookingUrl ? (
              <a href={link(bookingUrl)} className="cl-board-row" aria-label={`Reservar ${s.name}`}>
                {inner}
              </a>
            ) : (
              <div className="cl-board-row">{inner}</div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

// The cheapest priced service, for "desde 18 €"
export function fromPrice(services: SiteService[]) {
  const priced = services.filter((s) => s.priceCents > 0).map((s) => s.priceCents);
  return priced.length ? formatPrice(Math.min(...priced)) : null;
}

// A sticky column (title, how many, from how much) beside the board
export function ServicesSplit({
  props,
  index,
  title,
  children,
  more,
  aside,
}: P & { index?: string; title: ReactNode; children: ReactNode; more?: boolean; aside?: ReactNode }) {
  const from = fromPrice(props.services);
  return (
    <div className="cl-split">
      <aside className="cl-split-aside">
        <Tag index={index}>Tratamientos</Tag>
        <h2>{title}</h2>
        <p className="cl-split-lead">Precio y duración a la vista. Pulsa uno y reserva directamente.</p>
        <dl className="cl-split-facts">
          <div>
            <dt>Tratamientos</dt>
            <dd>{props.services.length}</dd>
          </div>
          {from && (
            <div>
              <dt>Desde</dt>
              <dd>{from}</dd>
            </div>
          )}
        </dl>
        {aside}
        {more && <Arrow href={props.link("/servicios")}>Ver todos</Arrow>}
      </aside>
      <div className="cl-split-main">{children}</div>
    </div>
  );
}

// ---------- Team ----------

function Portrait({ member }: { member: SiteTeamMember }) {
  return (
    <div className="cl-portrait">
      {member.photoUrl ? (
        <img src={member.photoUrl} alt={member.name} loading="lazy" />
      ) : (
        <span className="cl-portrait-initials" aria-hidden="true">
          {initials(member.name)}
        </span>
      )}
      {member.licenseNumber && (
        <span className="cl-badge">
          <ShieldCheckIcon />
          Col. {member.licenseNumber}
        </span>
      )}
    </div>
  );
}

// A rail of tall cards that scrolls sideways, ending in a link card
export function TeamRail({ props, index, more = true }: P & { index?: string; more?: boolean }) {
  const { team, link } = props;
  return (
    <section className="cl-section cl-team-section" id="equipo">
      <div className="kf-wrap cl-rail-head">
        <div>
          <Tag index={index}>Equipo</Tag>
          <h2>
            <Marker text="Tu fisio tiene nombre" />
          </h2>
        </div>
        <p>{team.length === 1 ? "Una persona" : `${team.length} personas`}, un mismo objetivo: que vuelvas a moverte sin dolor.</p>
      </div>
      <div className="kf-wrap">
        <ul className="cl-rail">
          {team.map((m) => (
            <li key={m.name} className="cl-rail-card">
              <Portrait member={m} />
              <h3>{m.name}</h3>
              {m.headline && <p className="cl-role">{m.headline}</p>}
            </li>
          ))}
          {more && (
            <li className="cl-rail-more">
              <a href={link("/equipo")}>
                <Plus />
                <strong>Conoce a todo el equipo</strong>
                <span>Especialidades y experiencia →</span>
              </a>
            </li>
          )}
        </ul>
      </div>
    </section>
  );
}

// Equipo page: zig-zag rows, big portrait and the full story
export function TeamZigzag({ team }: { team: SiteTeamMember[] }) {
  return (
    <div className="cl-zigzag">
      {team.map((m, i) => (
        <article key={m.name} className="cl-zig">
          <Portrait member={m} />
          <div className="cl-zig-text">
            <span className="cl-zig-num">{String(i + 1).padStart(2, "0")}</span>
            <h2>{m.name}</h2>
            {m.headline && <p className="cl-zig-role">{m.headline}</p>}
            {m.bio && <Paragraphs text={m.bio} className="cl-zig-bio" />}
          </div>
        </article>
      ))}
    </div>
  );
}

// ---------- Timeline (dark) ----------

const STEPS = [
  { Icon: ClipboardIcon, title: "Valoramos", text: "Exploramos y buscamos el origen real del dolor. No solo dónde duele." },
  { Icon: ActivityIcon, title: "Te lo explicamos", text: "Qué te pasa, qué vamos a hacer y cuánto calculamos que llevará." },
  { Icon: HandIcon, title: "Tratamos", text: "Terapia manual, ejercicio y técnicas avanzadas. Lo que funcione para ti." },
  { Icon: PersonIcon, title: "Alta", text: "Con ejercicios para casa y las herramientas para que no vuelva." },
];

export function Timeline({ props, index }: P & { index?: string }) {
  return (
    <section className="cl-timeline">
      <Plus className="cl-timeline-plus" />
      <div className="kf-wrap">
        <div className="cl-timeline-head">
          <Tag index={index}>Cómo trabajamos</Tag>
          <h2>
            Del dolor <mark className="cl-mark">al alta.</mark>
          </h2>
        </div>
        <ol className="cl-timeline-list">
          {STEPS.map(({ Icon, title, text }, i) => (
            <li key={title}>
              <span className="cl-timeline-num">0{i + 1}</span>
              <span className="cl-timeline-dot">
                <Icon />
              </span>
              <h3>{title}</h3>
              <p>{text}</p>
            </li>
          ))}
        </ol>
        {props.bookingUrl && (
          <div className="cl-timeline-cta">
            <Btn href={props.link(props.bookingUrl)}>
              <CalendarIcon />
              Empieza por una valoración
            </Btn>
          </div>
        )}
      </div>
    </section>
  );
}

// ---------- "Así somos" bento ----------

// Quote, numbers, highlights and photos in one grid of tiles
export function Bento({ props, index, withText, withQuote = true }: P & { index?: string; withText?: boolean; withQuote?: boolean }) {
  const { content, img, services, team, hours, link } = props;
  const { about, highlights, sections } = content;
  const gallery = sections.gallery ? content.galleryIds.map((id) => img(id)).filter((u): u is string => !!u) : [];
  const quote = withQuote && sections.about ? firstSentence(about?.text) : "";
  const text = sections.about ? paragraphs(about?.text)[1] : undefined;
  const days = new Set(hours.map((h) => h.weekday)).size;
  const stats = (
    [
      sections.services && services.length > 0 && { value: String(services.length), label: "tratamientos" },
      sections.team && team.length > 0 && { value: String(team.length), label: team.length === 1 ? "fisioterapeuta" : "fisioterapeutas" },
      sections.hours && days > 0 && { value: String(days), label: "días a la semana" },
    ] as ({ value: string; label: string } | false)[]
  ).filter((s): s is { value: string; label: string } => !!s);

  const photos = [...gallery];
  const pic = (key: string, wide = false) => {
    const src = photos.shift();
    return src ? (
      <li key={key} className={`cl-bento-photo${wide ? " cl-bento-wide" : ""}`}>
        <img src={src} alt="" loading="lazy" />
      </li>
    ) : null;
  };

  // Interleave so the grid never stacks two tiles of a kind
  const tiles: ReactNode[] = [];
  if (quote)
    tiles.push(
      <li key="quote" className="cl-bento-quote">
        <Plus className="cl-bento-quote-plus" />
        <blockquote>“{quote}”</blockquote>
        <span>— {props.clinic.name}</span>
      </li>,
    );
  const rounds = Math.max(highlights.length, stats.length, 2);
  for (let i = 0; i < rounds; i++) {
    const s = stats[i];
    if (s)
      tiles.push(
        <li key={`s${i}`} className={`cl-bento-stat${i === 0 ? " cl-bento-stat-ink" : ""}`}>
          <strong>{s.value}</strong>
          <span>{s.label}</span>
        </li>,
      );
    tiles.push(pic(`p${i}`, i === 1));
    const h = highlights[i];
    if (h)
      tiles.push(
        <li key={`h${i}`} className="cl-bento-hl">
          <span className="cl-bento-hl-num">{String(i + 1).padStart(2, "0")}</span>
          <strong>{h.title}</strong>
          {h.text && <span>{h.text}</span>}
        </li>,
      );
  }
  let extra = 0;
  while (photos.length) tiles.push(pic(`x${extra++}`));
  if (withText && text)
    tiles.push(
      <li key="text" className="cl-bento-text">
        <p>{text}</p>
        <Arrow href={link("/nosotros")}>Nuestra historia</Arrow>
      </li>,
    );

  return (
    <section className="cl-section" id="nosotros">
      <div className="kf-wrap">
        <div className="cl-bento-head">
          <Tag index={index}>Así somos</Tag>
          <h2>
            <Marker text={withQuote && about?.title ? about.title : "Una clínica con carácter"} />
          </h2>
        </div>
        <ul className="cl-bento">{tiles.filter(Boolean)}</ul>
      </div>
    </section>
  );
}

// ---------- "Hablemos": FAQ + contact console ----------

export function Console({ props, big }: P & { big?: boolean }) {
  const { content, hours, bookingUrl, link } = props;
  const c = content.contact;
  const address = fullAddress(c);
  const status = statusOf(props);
  return (
    <div className={`cl-console${big ? " cl-console-big" : ""}`}>
      <div className="cl-console-top">
        <span className="cl-console-label">
          <Plus />
          Contacto
        </span>
        {status && <StatusPill status={status} />}
      </div>
      {address && (
        <div className="cl-console-address">
          <strong>{address}</strong>
          {c.mapsUrl && (
            <a href={c.mapsUrl} target="_blank" rel="noopener">
              <RouteIcon />
              Cómo llegar
            </a>
          )}
        </div>
      )}
      <div className="cl-console-body">
        <ContactList content={{ ...content, contact: { ...c, address: undefined, postalCode: undefined, city: undefined } }} />
        {content.sections.hours && hours.length > 0 && <HoursBoard hours={hours} />}
      </div>
      <div className="cl-console-actions">
        {bookingUrl && (
          <Btn href={link(bookingUrl)}>
            <CalendarIcon />
            Reservar
          </Btn>
        )}
        {c.phone && (
          <Btn href={telHref(c.phone)} tone="paper">
            <PhoneIcon />
            Llamar
          </Btn>
        )}
        {c.whatsapp && (
          <Btn href={whatsappHref(c.whatsapp)} tone="paper" external>
            <ChatIcon />
            WhatsApp
          </Btn>
        )}
      </div>
    </div>
  );
}

// faqOnly: just the questions (the Contacto page already shows the console)
export function Talk({ props, index, faqOnly }: P & { index?: string; faqOnly?: boolean }) {
  const { faq, sections } = props.content;
  const showFaq = sections.faq && faq.length > 0;
  return (
    <section className="cl-section cl-talk" id={faqOnly ? "preguntas" : "contacto"}>
      <div className={`kf-wrap${showFaq && !faqOnly ? " cl-talk-grid" : ""}${faqOnly ? " cl-talk-solo" : ""}`}>
        <div className="cl-talk-main">
          <Tag index={index}>Hablemos</Tag>
          <h2>
            <Marker text={showFaq ? "Preguntas, respuestas" : "Te esperamos"} />
          </h2>
          {showFaq && (
            <Accordion className="cl-accordion">
              {faq.map((f, i) => (
                <AccordionItem key={i} title={f.q}>
                  <Paragraphs text={f.a} />
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </div>
        {!faqOnly && (
          <div className="cl-talk-side">
            <Console props={props} big={!showFaq} />
          </div>
        )}
      </div>
    </section>
  );
}
