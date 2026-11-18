import { ContactList, HoursTable } from "../templates/shared/blocks.js";
import { openStatus, telHref } from "../templates/shared/format.js";
import { CalendarIcon, CheckIcon, PhoneIcon } from "../templates/shared/icons.js";
import type { SitePageProps } from "../templates/types.js";

// /reservar: the clinic's booking page from kineflow.es in a frame, in embed
// mode (front: PublicBookingPage + useEmbed). The frame reports its height and
// a tiny inline script (render.tsx, BOOKING_SCRIPT) resizes it. Beside it, what
// a patient wants to know before booking (where, when, how to call), so the
// page never looks empty while the form only shows its first step.
// The clinic's colour goes to the form (?color=), so it matches the site.
// Without online booking, how to call instead
export default function BookingPage({ props }: { props: SitePageProps }) {
  const { clinic, content, appUrl, bookingUrl, hours } = props;
  const { phone, email } = content.contact;
  const status = content.sections.hours ? openStatus(hours) : null;
  const color = content.theme.primary.replace("#", "");

  return (
    <section className="kf-page kf-booking">
      <div className="kf-wrap">
        <header className="kf-booking-head">
          <p className="kf-booking-kicker">
            <CalendarIcon />
            Cita online
          </p>
          <h1>Reserva tu cita</h1>
          <p className="kf-booking-lead">
            {bookingUrl
              ? "Elige el tratamiento, el día y la hora que mejor te vengan. Solo te llevará un minuto."
              : "Ahora mismo no aceptamos reservas online, pero te damos cita enseguida."}
          </p>
        </header>

        <div className="kf-booking-grid">
          <div className="kf-booking-main">
            {bookingUrl ? (
              <iframe
                id="kf-booking"
                className="kf-booking-frame"
                title={`Reservar cita en ${clinic.name}`}
                src={`${appUrl}/reservar/${encodeURIComponent(clinic.slug)}?embed=1&color=${color}`}
              />
            ) : (
              <div className="kf-booking-offline">
                <p>
                  {phone ? (
                    <>
                      Llámanos al <a href={telHref(phone)}>{phone}</a> y buscamos juntos el mejor hueco.
                    </>
                  ) : (
                    email && (
                      <>
                        Escríbenos a <a href={`mailto:${email}`}>{email}</a> y te damos cita.
                      </>
                    )
                  )}
                </p>
              </div>
            )}
          </div>

          <aside className="kf-booking-aside">
            {bookingUrl && (
              <div className="kf-booking-card">
                <h2>Cómo funciona</h2>
                <ol className="kf-booking-steps">
                  <li>
                    <CheckIcon />
                    Elige el tratamiento que necesitas
                  </li>
                  <li>
                    <CheckIcon />
                    Escoge el día y la hora libres
                  </li>
                  <li>
                    <CheckIcon />
                    Deja tus datos y listo: tu cita queda reservada
                  </li>
                </ol>
              </div>
            )}
            <div className="kf-booking-card">
              <h2>{clinic.name}</h2>
              {status && (
                <p className={`kf-status${status.open ? " kf-status-open" : ""}`}>
                  <span aria-hidden="true" />
                  {status.label}
                </p>
              )}
              <ContactList content={content} />
              {phone && bookingUrl && (
                <a href={telHref(phone)} className="kf-booking-call">
                  <PhoneIcon />
                  ¿Prefieres llamar? {phone}
                </a>
              )}
            </div>
            {content.sections.hours && hours.length > 0 && (
              <div className="kf-booking-card">
                <h2>Horario</h2>
                <HoursTable hours={hours} />
              </div>
            )}
          </aside>
        </div>
      </div>
    </section>
  );
}
