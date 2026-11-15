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

export const templates = { invitation, welcome, resetPassword };
