import { escapeHtml as e, renderLayout, renderText } from "./layout.js";

// Every email the app sends. Each template takes exactly the data it needs and
// returns the subject plus the HTML and plain-text bodies.

export type RenderedEmail = { subject: string; html: string; text: string };

// Same labels as the frontend (front/src/lib/roles.ts), in lower case for sentences
const roleNames: Record<string, string> = {
  owner: "propietario",
  admin: "administrador",
  receptionist: "recepción",
  physio: "fisioterapeuta",
};
const roleName = (role: string) => roleNames[role] ?? role;

// ---------- Invitation to join a clinic ----------

export type InvitationData = {
  clinicName: string;
  inviterName: string;
  role: string;
  url: string;
  expiresInDays: number;
};

function invitation(data: InvitationData): RenderedEmail {
  const role = roleName(data.role);
  const subject = `Te han invitado a ${data.clinicName}`;
  const button = { label: "Aceptar invitación", url: data.url };
  const note = `La invitación caduca en ${data.expiresInDays} días.`;

  return {
    subject,
    html: renderLayout({
      preheader: `${data.inviterName} te ha invitado como ${role}.`,
      heading: `Únete a ${data.clinicName}`,
      paragraphs: [
        `<strong>${e(data.inviterName)}</strong> te ha invitado a unirte a <strong>${e(data.clinicName)}</strong> como <strong>${e(role)}</strong>.`,
        "Acepta la invitación para empezar a usar la agenda de la clínica. Si todavía no tienes cuenta, podrás crearla en el mismo paso.",
      ],
      button,
      note,
    }),
    text: renderText(
      [
        `${data.inviterName} te ha invitado a unirte a ${data.clinicName} como ${role}.`,
        "Si todavía no tienes cuenta, podrás crearla al aceptar.",
        note,
      ],
      button,
    ),
  };
}

// ---------- New member: the clinic created their account ----------

export type WelcomeData = {
  name: string;
  clinicName: string;
  inviterName: string;
  role: string;
  url: string;
};

function welcome(data: WelcomeData): RenderedEmail {
  const role = roleName(data.role);
  const subject = `${data.clinicName} te ha dado de alta`;
  const button = { label: "Elegir mi contraseña", url: data.url };
  const note =
    "El enlace caduca en 1 hora. Si caduca, pide a la clínica que te envíe uno nuevo.";

  return {
    subject,
    html: renderLayout({
      preheader: `Elige tu contraseña para empezar en ${data.clinicName}.`,
      heading: `Hola, ${data.name}`,
      paragraphs: [
        `<strong>${e(data.inviterName)}</strong> te ha dado de alta en <strong>${e(data.clinicName)}</strong> como <strong>${e(role)}</strong>.`,
        "Elige tu contraseña para entrar por primera vez.",
      ],
      button,
      note,
    }),
    text: renderText(
      [
        `Hola, ${data.name}:`,
        `${data.inviterName} te ha dado de alta en ${data.clinicName} como ${role}.`,
        "Elige tu contraseña para entrar por primera vez.",
        note,
      ],
      button,
    ),
  };
}

// ---------- "Forgot password" ----------

export type ResetPasswordData = {
  name: string;
  url: string;
};

function resetPassword(data: ResetPasswordData): RenderedEmail {
  const subject = "Restablece tu contraseña";
  const button = { label: "Elegir nueva contraseña", url: data.url };
  const note =
    "El enlace caduca en 1 hora. Si no lo has pedido tú, ignora este email: tu contraseña no cambiará.";

  return {
    subject,
    html: renderLayout({
      preheader: "Elige una nueva contraseña para tu cuenta.",
      heading: `Hola, ${data.name}`,
      paragraphs: ["Hemos recibido una solicitud para restablecer la contraseña de tu cuenta."],
      button,
      note,
    }),
    text: renderText(
      [
        `Hola, ${data.name}:`,
        "Hemos recibido una solicitud para restablecer la contraseña de tu cuenta.",
        note,
      ],
      button,
    ),
  };
}

// ---------- New contact request (to the Kineflow team) ----------

export type ContactRequestData = {
  name: string;
  email: string;
  clinicName: string;
  phone: string | null;
  teamSize: string | null;
  message: string | null;
};

function contactRequest(data: ContactRequestData): RenderedEmail {
  const subject = `Nueva solicitud: ${data.clinicName}`;
  // Answering is one click: the email's Reply-To is the person who wrote
  const button = { label: `Responder a ${data.name}`, url: `mailto:${data.email}` };
  const rows: [string, string | null][] = [
    ["Nombre", data.name],
    ["Email", data.email],
    ["Clínica", data.clinicName],
    ["Teléfono", data.phone],
    ["Equipo", data.teamSize],
  ];
  const filled = rows.filter((r): r is [string, string] => !!r[1]);

  return {
    subject,
    html: renderLayout({
      preheader: `${data.name} quiere probar Kineflow en ${data.clinicName}.`,
      heading: "Nueva solicitud de contacto",
      paragraphs: [
        filled.map(([k, v]) => `<strong>${k}:</strong> ${e(v)}`).join("<br>"),
        ...(data.message ? [e(data.message).replace(/\n/g, "<br>")] : []),
      ],
      button,
    }),
    text: renderText(
      [
        "Nueva solicitud de contacto",
        filled.map(([k, v]) => `${k}: ${v}`).join("\n"),
        ...(data.message ? [data.message] : []),
      ],
      button,
    ),
  };
}

// ---------- Online booking confirmed (to the patient) ----------

export type BookingConfirmationData = {
  // null: a class without a physio yet
  firstName: string;
  clinicName: string;
  serviceName: string;
  professionalName: string | null;
  // Already written for people: "miércoles, 18 de noviembre", "10:00"
  dateLabel: string;
  startTime: string;
  endTime: string;
  // The patient's own page for this appointment
  url: string;
  // null: the clinic doesn't let patients cancel online
  cancelNote: string | null;
  // The clinic's own text for patients
  policyText: string | null;
};

function bookingConfirmation(data: BookingConfirmationData): RenderedEmail {
  const subject = `Tu cita en ${data.clinicName}: ${data.dateLabel}, ${data.startTime}`;
  const button = { label: "Ver mi cita", url: data.url };
  const details: [string, string][] = [
    ["Día", data.dateLabel],
    ["Hora", `${data.startTime}–${data.endTime}`],
    ["Servicio", data.serviceName],
    ...(data.professionalName ? ([["Con", data.professionalName]] as [string, string][]) : []),
  ];
  const cancel =
    data.cancelNote ?? "Si no puedes venir, avisa a la clínica lo antes posible.";

  return {
    subject,
    html: renderLayout({
      preheader: `${data.dateLabel}, ${data.startTime}. ${data.serviceName}.`,
      heading: `Cita reservada, ${data.firstName}`,
      paragraphs: [
        `Te esperamos en <strong>${e(data.clinicName)}</strong>.`,
        details.map(([k, v]) => `<strong>${k}:</strong> ${e(v)}`).join("<br>"),
        e(cancel),
        ...(data.policyText ? [e(data.policyText).replace(/\n/g, "<br>")] : []),
      ],
      button,
    }),
    text: renderText(
      [
        `Hola, ${data.firstName}:`,
        `Tu cita en ${data.clinicName} está reservada.`,
        details.map(([k, v]) => `${k}: ${v}`).join("\n"),
        cancel,
        ...(data.policyText ? [data.policyText] : []),
      ],
      button,
    ),
  };
}

// ---------- Online booking made or cancelled (to the clinic) ----------

export type BookingNoticeData = {
  kind: "booked" | "cancelled";
  clinicName: string;
  patientName: string;
  phone: string | null;
  email: string | null;
  serviceName: string;
  professionalName: string | null;
  dateLabel: string;
  startTime: string;
  endTime: string;
  // The patient wrote a comment when booking. Only that there is one: what it
  // says may be about their health, so it's read in the agenda, not sent by email
  hasNotes: boolean;
  // The clinic's calendar
  url: string;
};

function bookingNotice(data: BookingNoticeData): RenderedEmail {
  const booked = data.kind === "booked";
  const when = `${data.dateLabel}, ${data.startTime}`;
  const subject = booked
    ? `Nueva reserva online: ${data.patientName}, ${when}`
    : `Reserva online cancelada: ${data.patientName}, ${when}`;
  const intro = booked
    ? `${data.patientName} ha reservado una cita online en ${data.clinicName}.`
    : `${data.patientName} ha cancelado su cita online en ${data.clinicName}. La hora vuelve a estar libre.`;
  const button = { label: "Abrir la agenda", url: data.url };
  const rows: [string, string | null][] = [
    ["Día", data.dateLabel],
    ["Hora", `${data.startTime}–${data.endTime}`],
    ["Servicio", data.serviceName],
    ...(data.professionalName ? ([["Con", data.professionalName]] as [string, string][]) : []),
    ["Paciente", data.patientName],
    ["Teléfono", data.phone],
    ["Email", data.email],
    ["Comentario", data.hasNotes ? "Ha dejado un comentario: léelo en la agenda." : null],
  ];
  const filled = rows.filter((r): r is [string, string] => !!r[1]);

  return {
    subject,
    html: renderLayout({
      preheader: `${when}. ${data.serviceName}${data.professionalName ? ` con ${data.professionalName}` : ""}.`,
      heading: booked ? "Nueva reserva online" : "Reserva online cancelada",
      paragraphs: [e(intro), filled.map(([k, v]) => `<strong>${k}:</strong> ${e(v)}`).join("<br>")],
      button,
    }),
    text: renderText([intro, filled.map(([k, v]) => `${k}: ${v}`).join("\n")], button),
  };
}

// ---------- Appointment reminder (to the patient) ----------

export type AppointmentReminderData = {
  firstName: string;
  clinicName: string;
  // Already written for people: "miércoles, 18 de noviembre", "10:00"
  dateLabel: string;
  startTime: string;
  endTime: string;
  // null: a class without a physio yet
  professionalName: string | null;
  // null: the clinic prefers not to say it (it can reveal health details)
  serviceName: string | null;
  // The clinic's own text: address, what to bring…
  extraText: string | null;
  // The patient's own page, to see or cancel it. null: no page (given by the clinic)
  url: string | null;
};

// Never anything about the patient's health: only when, where and with whom
function appointmentReminder(data: AppointmentReminderData): RenderedEmail {
  const subject = `Recordatorio: tu cita en ${data.clinicName}, ${data.dateLabel} a las ${data.startTime}`;
  const button = data.url ? { label: "Ver o cancelar mi cita", url: data.url } : undefined;
  const details: [string, string][] = [
    ["Día", data.dateLabel],
    ["Hora", `${data.startTime}–${data.endTime}`],
    ...(data.serviceName ? ([["Servicio", data.serviceName]] as [string, string][]) : []),
    ...(data.professionalName ? ([["Con", data.professionalName]] as [string, string][]) : []),
  ];
  const cancel = data.url
    ? "Si no puedes venir, cancela la cita desde el enlace para que otra persona pueda usar la hora."
    : "Si no puedes venir, avisa a la clínica lo antes posible para que otra persona pueda usar la hora.";

  return {
    subject,
    html: renderLayout({
      preheader: `${data.dateLabel}, ${data.startTime}${data.professionalName ? `, con ${data.professionalName}` : ""}.`,
      heading: `Te esperamos, ${data.firstName}`,
      paragraphs: [
        `Te recordamos tu cita en <strong>${e(data.clinicName)}</strong>.`,
        details.map(([k, v]) => `<strong>${k}:</strong> ${e(v)}`).join("<br>"),
        e(cancel),
        ...(data.extraText ? [e(data.extraText).replace(/\n/g, "<br>")] : []),
      ],
      button,
    }),
    text: renderText(
      [
        `Hola, ${data.firstName}:`,
        `Te recordamos tu cita en ${data.clinicName}.`,
        details.map(([k, v]) => `${k}: ${v}`).join("\n"),
        cancel,
        ...(data.extraText ? [data.extraText] : []),
      ],
      button,
    ),
  };
}

// ---------- A class changed or was cancelled (to each of its students) ----------

export type ClassChangedData = {
  firstName: string;
  clinicName: string;
  serviceName: string;
  // Already written for people: "martes, 24 de noviembre, 19:00"
  cancelled: string[];
  // "martes, 24 de noviembre: ahora a las 19:30"
  moved: string[];
  // New sessions they've been added to: "miércoles, 25 de noviembre, 19:00"
  added: string[];
  // The clinic's own words, if it wrote any
  message: string | null;
};

// Long lists are cut: the first ones and "y N más"
const capList = (items: string[], max = 10) =>
  items.length > max ? [...items.slice(0, max), `y ${items.length - max} más`] : items;

function classChanged(data: ClassChangedData): RenderedEmail {
  const onlyCancelled = data.moved.length === 0 && data.added.length === 0;
  const subject = onlyCancelled
    ? data.cancelled.length === 1
      ? `Sesión cancelada: ${data.serviceName} en ${data.clinicName}`
      : `Sesiones canceladas: ${data.serviceName} en ${data.clinicName}`
    : `Cambios en tu clase de ${data.serviceName} en ${data.clinicName}`;
  const sections: [string, string[]][] = [
    [data.cancelled.length === 1 ? "Se cancela esta sesión:" : "Se cancelan estas sesiones:", capList(data.cancelled)],
    [data.moved.length === 1 ? "Cambia la hora de esta sesión:" : "Cambia la hora de estas sesiones:", capList(data.moved)],
    [data.added.length === 1 ? "Tienes una sesión nueva:" : "Tienes estas sesiones nuevas:", capList(data.added)],
  ].filter(([, list]) => list.length > 0) as [string, string[]][];
  const closing = "Si tienes cualquier duda, responde a este email o llama a la clínica.";

  return {
    subject,
    html: renderLayout({
      preheader: onlyCancelled ? `${data.serviceName}: ${data.cancelled[0]}` : `Cambios en ${data.serviceName}`,
      heading: onlyCancelled ? `Hola, ${data.firstName}` : `Cambios en tu clase, ${data.firstName}`,
      paragraphs: [
        `Te escribimos de <strong>${e(data.clinicName)}</strong> por tu clase de <strong>${e(data.serviceName)}</strong>.`,
        ...sections.map(([title, list]) => `<strong>${e(title)}</strong><br>${list.map(e).join("<br>")}`),
        ...(data.message ? [e(data.message).replace(/\n/g, "<br>")] : []),
        e(closing),
      ],
    }),
    text: renderText([
      `Hola, ${data.firstName}:`,
      `Te escribimos de ${data.clinicName} por tu clase de ${data.serviceName}.`,
      ...sections.map(([title, list]) => [title, ...list].join("\n")),
      ...(data.message ? [data.message] : []),
      closing,
    ]),
  };
}

// ---------- Own domains (Mi web → Dominio) ----------

export type DomainData = { name: string; clinicName: string; domain: string; url: string };

function domainConnected(data: DomainData): RenderedEmail {
  const subject = `Tu web ya está en ${data.domain}`;
  const button = { label: "Ver Mi web", url: data.url };
  const lines = [
    `El dominio <strong>${e(data.domain)}</strong> ya está conectado a la web de <strong>${e(data.clinicName)}</strong>.`,
    "Las direcciones anteriores (la dirección gratuita y la versión con o sin www) redirigen automáticamente a tu dominio.",
  ];
  return {
    subject,
    html: renderLayout({ preheader: "Tu dominio ya funciona.", heading: `Hola, ${data.name}`, paragraphs: lines, button }),
    text: renderText(
      [`Hola, ${data.name}:`, `El dominio ${data.domain} ya está conectado a la web de ${data.clinicName}.`, "Las direcciones anteriores redirigen automáticamente a tu dominio."],
      button,
    ),
  };
}

function domainBroken(data: DomainData): RenderedEmail {
  const subject = `${data.domain} ya no apunta a tu web`;
  const button = { label: "Revisar la configuración", url: data.url };
  const note = "Mientras tanto, tu web sigue disponible en su dirección gratuita.";
  return {
    subject,
    html: renderLayout({
      preheader: "Revisa los registros DNS de tu dominio.",
      heading: `Hola, ${data.name}`,
      paragraphs: [
        `Llevamos tres días sin poder comprobar que <strong>${e(data.domain)}</strong> apunta a la web de <strong>${e(data.clinicName)}</strong>.`,
        "Suele pasar al cambiar de proveedor o al editar los registros DNS. En Mi web → Dirección verás qué registro falta.",
      ],
      button,
      note,
    }),
    text: renderText(
      [`Hola, ${data.name}:`, `Llevamos tres días sin poder comprobar que ${data.domain} apunta a la web de ${data.clinicName}.`, "En Mi web → Dirección verás qué registro falta.", note],
      button,
    ),
  };
}

function domainPending(data: DomainData): RenderedEmail {
  const subject = `Tu dominio ${data.domain} aún no está conectado`;
  const button = { label: "Ver los pasos", url: data.url };
  const note = "Si no se conecta en 30 días, lo quitaremos de tu web. Puedes volver a añadirlo cuando quieras.";
  return {
    subject,
    html: renderLayout({
      preheader: "Faltan registros DNS por añadir.",
      heading: `Hola, ${data.name}`,
      paragraphs: [
        `Hace una semana añadiste <strong>${e(data.domain)}</strong> a la web de <strong>${e(data.clinicName)}</strong>, pero todavía no apunta a ella.`,
        "En Mi web → Dirección tienes los registros que hay que añadir en tu proveedor de dominio. Si prefieres que lo hagamos nosotros, escríbenos.",
      ],
      button,
      note,
    }),
    text: renderText(
      [`Hola, ${data.name}:`, `Hace una semana añadiste ${data.domain} a la web de ${data.clinicName}, pero todavía no apunta a ella.`, "En Mi web → Dirección tienes los registros que hay que añadir.", note],
      button,
    ),
  };
}

export const templates = {
  domainConnected,
  domainBroken,
  domainPending,
  invitation,
  welcome,
  resetPassword,
  contactRequest,
  bookingConfirmation,
  bookingNotice,
  appointmentReminder,
  classChanged,
};
