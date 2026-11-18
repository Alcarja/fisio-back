import { telHref } from "../templates/shared/format.js";
import type { SitePageProps } from "../templates/types.js";

// /reservar: the clinic's booking page from kineflow.es in a frame, in embed
// mode (front: PublicBookingPage + useEmbed). The frame reports its height and
// a tiny inline script (render.tsx, BOOKING_SCRIPT) resizes it. Without online
// booking, how to call instead
export default function BookingPage({ props }: { props: SitePageProps }) {
  const { clinic, content, appUrl, bookingUrl } = props;
  const phone = content.contact.phone;

  return (
    <section className="cl-page kf-page">
      <div className="cl-wrap cl-narrow">
        <h1>Reserva tu cita</h1>
        {bookingUrl ? (
          <iframe
            id="kf-booking"
            className="kf-booking-frame"
            title={`Reservar cita en ${clinic.name}`}
            src={`${appUrl}/reservar/${encodeURIComponent(clinic.slug)}?embed=1`}
          />
        ) : (
          <p>
            Ahora mismo no aceptamos reservas online.
            {phone ? (
              <>
                {" "}
                Llámanos al <a href={telHref(phone)}>{phone}</a> y te damos cita.
              </>
            ) : (
              content.contact.email && (
                <>
                  {" "}
                  Escríbenos a <a href={`mailto:${content.contact.email}`}>{content.contact.email}</a> y te
                  damos cita.
                </>
              )
            )}
          </p>
        )}
      </div>
    </section>
  );
}
