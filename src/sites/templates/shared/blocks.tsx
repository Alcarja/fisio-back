import type { SitePageProps } from "../types.js";
import { fullAddress, hoursByDay, paragraphs, telHref, whatsappHref } from "./format.js";
import {
  ChatIcon,
  ClockIcon,
  FacebookIcon,
  InstagramIcon,
  LinkedinIcon,
  MailIcon,
  MapPinIcon,
  PhoneIcon,
} from "./icons.js";

// Pieces every template can use. Class names start with "kf-" and each
// template styles them in its own CSS. Text is always rendered as text: React
// escapes it (never dangerouslySetInnerHTML with clinic content)

// Plain text with line breaks → one <p> per paragraph
export function Paragraphs({ text, className }: { text?: string; className?: string }) {
  return (
    <>
      {paragraphs(text).map((p, i) => (
        <p key={i} className={className}>
          {p}
        </p>
      ))}
    </>
  );
}

// Monday to Sunday with the clinic's time ranges ("Cerrado" when none)
export function HoursTable({ hours }: { hours: SitePageProps["hours"] }) {
  if (!hours.length) return null;
  return (
    <table className="kf-hours">
      <tbody>
        {hoursByDay(hours).map((day) => (
          <tr key={day.label} className={day.ranges.length ? undefined : "kf-closed"}>
            <th scope="row">{day.label}</th>
            <td>{day.ranges.length ? day.ranges.join(" · ") : "Cerrado"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Phone, WhatsApp, email, address with "Cómo llegar", social profiles
export function ContactList({ content }: { content: SitePageProps["content"] }) {
  const c = content.contact;
  const address = fullAddress(c);
  return (
    <ul className="kf-contact">
      {c.phone && (
        <li>
          <PhoneIcon />
          <a href={telHref(c.phone)}>{c.phone}</a>
        </li>
      )}
      {c.whatsapp && (
        <li>
          <ChatIcon />
          <a href={whatsappHref(c.whatsapp)} target="_blank" rel="noopener">
            WhatsApp
          </a>
        </li>
      )}
      {c.email && (
        <li>
          <MailIcon />
          <a href={`mailto:${c.email}`}>{c.email}</a>
        </li>
      )}
      {address && (
        <li>
          <MapPinIcon />
          <span>
            {address}
            {c.mapsUrl && (
              <>
                {" · "}
                {/* A plain link: an embedded map would send visitors' data to Google */}
                <a href={c.mapsUrl} target="_blank" rel="noopener">
                  Cómo llegar
                </a>
              </>
            )}
          </span>
        </li>
      )}
    </ul>
  );
}

export function SocialLinks({ content }: { content: SitePageProps["content"] }) {
  const c = content.contact;
  const links = [
    c.instagram && { href: c.instagram, label: "Instagram", Icon: InstagramIcon },
    c.facebook && { href: c.facebook, label: "Facebook", Icon: FacebookIcon },
    c.linkedin && { href: c.linkedin, label: "LinkedIn", Icon: LinkedinIcon },
  ].filter((l): l is { href: string; label: string; Icon: typeof InstagramIcon } => !!l);
  if (!links.length) return null;
  return (
    <div className="kf-social">
      {links.map(({ href, label, Icon }) => (
        <a key={label} href={href} target="_blank" rel="noopener" aria-label={label}>
          <Icon />
        </a>
      ))}
    </div>
  );
}

export { ClockIcon };

// Legal links, registration number and the optional credit. Same for all
export function LegalFooter({ props }: { props: SitePageProps }) {
  const { clinic, content, link, showKineflowCredit, appUrl } = props;
  return (
    <div className="kf-legal">
      <p>
        © {new Date().getFullYear()} {clinic.name}
        {content.healthRegistry && <> · Nº de registro sanitario {content.healthRegistry}</>}
      </p>
      <nav aria-label="Información legal">
        <a href={link("/aviso-legal")}>Aviso legal</a>
        <a href={link("/privacidad")}>Privacidad</a>
        <a href={link("/cookies")}>Cookies</a>
      </nav>
      {showKineflowCredit && (
        <p className="kf-credit">
          Reservas con{" "}
          <a href={appUrl} target="_blank" rel="noopener">
            Kineflow
          </a>
        </p>
      )}
    </div>
  );
}

// The site's sections as a list of links (footers)
export function FooterNav({ items }: { items: { href: string; label: string }[] }) {
  return (
    <nav className="kf-footer-nav" aria-label="Secciones">
      {items.map((i) => (
        <a key={i.href} href={i.href}>
          {i.label}
        </a>
      ))}
    </nav>
  );
}
