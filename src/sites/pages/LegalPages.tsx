import type { ReactNode } from "react";
import { fullAddress } from "../templates/shared/format.js";
import type { SitePageProps } from "../templates/types.js";

// The legal pages of each clinic site (WEBS.md 3.10), in the clinic's name:
// the clinic is the owner of the site and the controller of the data;
// Kineflow only appears as its processor. Built from clinic_legal and the
// site's content. Have a lawyer review these texts once.

function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="cl-page kf-page kf-legal-page">
      <div className="cl-wrap cl-narrow">
        <h1>{title}</h1>
        {children}
      </div>
    </section>
  );
}

// "Ñandú SL (NIF B12345678), Calle Mayor 1, 46001 Valencia"
function owner(props: SitePageProps) {
  const { legal, clinic } = props;
  return legal.legalName ?? clinic.name;
}

const ownerAddress = (props: SitePageProps) =>
  fullAddress({
    address: props.legal.address ?? undefined,
    postalCode: props.legal.postalCode ?? undefined,
    city: props.legal.city ?? undefined,
  });

const contactEmail = (props: SitePageProps) => props.legal.privacyEmail ?? props.content.contact.email;

export function LegalNotice({ props }: { props: SitePageProps }) {
  const { legal, content, team, clinic } = props;
  const email = content.contact.email ?? legal.privacyEmail;
  const licensed = team.filter((m) => m.licenseNumber);
  return (
    <LegalPage title="Aviso legal">
      <p>
        En cumplimiento del artículo 10 de la Ley 34/2002, de servicios de la sociedad de la
        información y de comercio electrónico (LSSI-CE), se informa de los datos del titular de
        esta web:
      </p>
      <ul>
        <li>
          Titular: <strong>{owner(props)}</strong>
          {legal.legalName && legal.legalName !== clinic.name && <> (nombre comercial: {clinic.name})</>}
        </li>
        {legal.taxId && <li>NIF/CIF: {legal.taxId}</li>}
        {ownerAddress(props) && <li>Domicilio: {ownerAddress(props)}</li>}
        {email && <li>Email: {email}</li>}
        {content.contact.phone && <li>Teléfono: {content.contact.phone}</li>}
        {content.healthRegistry && <li>Nº de registro sanitario: {content.healthRegistry}</li>}
      </ul>
      {licensed.length > 0 && (
        <>
          <h2>Profesionales sanitarios</h2>
          <p>
            Los fisioterapeutas del centro están colegiados en el Colegio Profesional de
            Fisioterapeutas correspondiente a su comunidad autónoma:
          </p>
          <ul>
            {licensed.map((m) => (
              <li key={m.name}>
                {m.name}: nº de colegiado {m.licenseNumber}
              </li>
            ))}
          </ul>
        </>
      )}
      <h2>Uso de la web</h2>
      <p>
        Esta web informa sobre los servicios del centro y permite pedir cita. Sus contenidos son
        orientativos y no sustituyen una valoración profesional. Los textos e imágenes pertenecen
        a {owner(props)} o se usan con permiso; no se pueden reproducir sin autorización.
      </p>
      <p>
        La web está alojada y mantenida por Kineflow, que presta el servicio técnico al titular.
      </p>
    </LegalPage>
  );
}

export function PrivacyPolicy({ props }: { props: SitePageProps }) {
  const email = contactEmail(props);
  return (
    <LegalPage title="Política de privacidad">
      <h2>Responsable del tratamiento</h2>
      <p>
        {owner(props)}
        {props.legal.taxId && <>, NIF/CIF {props.legal.taxId}</>}
        {ownerAddress(props) && <>, con domicilio en {ownerAddress(props)}</>}.
        {email && <> Para cualquier asunto de protección de datos puedes escribir a {email}.</>}
      </p>

      <h2>Qué datos tratamos</h2>
      <p>
        Esta web no recoge datos por sí misma: no usa formularios de contacto, cookies ni
        herramientas de analítica. Si pides cita con el formulario de reserva online, tratamos tu
        nombre, apellidos, teléfono, email y el comentario que escribas.
      </p>

      <h2>Para qué y con qué base legal</h2>
      <p>
        Para gestionar tu cita: confirmarla, recordártela y avisarte de cualquier cambio. La base
        legal es la aplicación de medidas precontractuales a petición tuya y la prestación del
        servicio que solicitas (art. 6.1.b del Reglamento General de Protección de Datos, RGPD).
      </p>

      <h2>Cuánto tiempo los conservamos</h2>
      <p>
        Mientras mantengas relación con el centro y, después, durante los plazos que exija la ley.
        Si eres paciente, tu historia clínica se conserva durante el tiempo que establece la
        normativa sanitaria.
      </p>

      <h2>Quién más accede a tus datos</h2>
      <p>
        Kineflow nos presta el servicio de agenda y reservas online como encargado del
        tratamiento, con sus proveedores de alojamiento en la Unión Europea (Hetzner, en Alemania,
        y Neon, en Fráncfort). No cedemos tus datos a terceros salvo obligación legal.
      </p>

      <h2>Tus derechos</h2>
      <p>
        Puedes acceder a tus datos, rectificarlos, suprimirlos, oponerte a su tratamiento,
        limitarlo o pedir su portabilidad
        {email ? <> escribiendo a {email}</> : <> dirigiéndote al centro</>}. Si consideras que no
        hemos atendido bien tu solicitud, puedes reclamar ante la Agencia Española de Protección de
        Datos (www.aepd.es).
      </p>
    </LegalPage>
  );
}

export function CookiesPolicy({ props }: { props: SitePageProps }) {
  return (
    <LegalPage title="Política de cookies">
      <p>
        Esta web no usa cookies propias ni de terceros, ni ninguna otra tecnología para seguir tu
        navegación. No hay analítica, publicidad ni contenidos incrustados de redes sociales o
        mapas: los enlaces a Google Maps o a redes sociales se abren en su propia página.
      </p>
      <p>
        El formulario de reserva online se muestra desde la plataforma de citas de{" "}
        {props.legal.legalName ?? props.clinic.name} (Kineflow) y tampoco instala cookies.
      </p>
      <p>Por eso no te pedimos que aceptes ninguna cookie.</p>
    </LegalPage>
  );
}
