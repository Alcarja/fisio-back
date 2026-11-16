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
  firstName: string;
  clinicName: string;
  serviceName: string;
  professionalName: string;
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
    ["Con", data.professionalName],
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
  professionalName: string;
  dateLabel: string;
  startTime: string;
  endTime: string;
  // What the patient wrote when booking
  notes: string | null;
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
    ["Con", data.professionalName],
    ["Paciente", data.patientName],
    ["Teléfono", data.phone],
    ["Email", data.email],
    ["Comentario", data.notes],
  ];
  const filled = rows.filter((r): r is [string, string] => !!r[1]);

  return {
    subject,
    html: renderLayout({
      preheader: `${when}. ${data.serviceName} con ${data.professionalName}.`,
      heading: booked ? "Nueva reserva online" : "Reserva online cancelada",
      paragraphs: [e(intro), filled.map(([k, v]) => `<strong>${k}:</strong> ${e(v)}`).join("<br>")],
      button,
    }),
    text: renderText([intro, filled.map(([k, v]) => `${k}: ${v}`).join("\n")], button),
  };
}

export const templates = {
  invitation,
  welcome,
  resetPassword,
  contactRequest,
  bookingConfirmation,
  bookingNotice,
};
