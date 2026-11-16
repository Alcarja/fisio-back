import { AsyncLocalStorage } from "node:async_hooks";
import { logError, maskEmail } from "../logError.js";
import { sendEmail } from "./send.js";
import { templates } from "./templates.js";

// The only way the app sends email. Emails are always triggered by a backend
// action (inviting, adding a member…), never directly by the frontend: the
// backend decides who receives what, with data from the database.

export type TemplateName = keyof typeof templates;
export type TemplateData<T extends TemplateName> = Parameters<(typeof templates)[T]>[0];

// Who the email appears to come from. The address is always ours
// (EMAIL_FROM_ADDRESS, authenticated in Brevo); only the name and Reply-To change.
export type Sender = { name: string; replyTo?: string };

// Platform emails (password resets, superadmin invitations)
export const platformSender: Sender = {
  name: process.env.EMAIL_FROM_NAME || "Kineflow",
  replyTo: process.env.EMAIL_SUPPORT_ADDRESS || undefined,
};

// A clinic's emails: its name, and answers go to the person who acted
export const clinicSender = (clinicName: string, replyTo: string): Sender => ({
  name: clinicName,
  replyTo,
});

// Never throws: a failed email mustn't undo the action that triggered it (the
// invitation still exists and can be resent). Returns whether it was sent.
export async function sendTemplate<T extends TemplateName>(
  template: T,
  to: string,
  data: TemplateData<T>,
  sender: Sender = platformSender,
): Promise<boolean> {
  try {
    const render = templates[template] as (data: TemplateData<T>) => ReturnType<
      (typeof templates)[T]
    >;
    const { subject, html, text } = render(data);

    await sendEmail({
      to,
      subject,
      html,
      text,
      fromName: sender.name,
      replyTo: sender.replyTo,
      tag: template,
    });
    return true;
  } catch (error) {
    logError(`[email] ${template} to ${maskEmail(to)} failed`, error);
    return false;
  }
}

// ---------- Welcome email for members created by a clinic ----------
//
// Their "choose your password" link comes from Better Auth's password reset
// (auth.ts → sendResetPassword), which only knows the user. Running the reset
// inside withWelcomeEmail tells it to send the clinic's welcome email instead
// of the generic "forgot password" one.

export type WelcomeContext = Omit<TemplateData<"welcome">, "name" | "url"> & {
  replyTo: string;
};

const welcomeContext = new AsyncLocalStorage<WelcomeContext>();

export const withWelcomeEmail = <R>(context: WelcomeContext, fn: () => Promise<R>) =>
  welcomeContext.run(context, fn);

export const getWelcomeContext = () => welcomeContext.getStore();
