// Low-level sending. Use sendTemplate (./index.ts) from the rest of the app.
//
// With BREVO_API_KEY set, emails go out through Brevo's API. Without it (local
// development) they're printed to the console so links can still be used.
import { maskEmail } from "../logError.js";

const BREVO_URL = "https://api.brevo.com/v3/smtp/email";

const apiKey = process.env.BREVO_API_KEY;
const fromAddress = process.env.EMAIL_FROM_ADDRESS;

// Fail on startup rather than on the first email
if (apiKey && !fromAddress) {
  throw new Error("BREVO_API_KEY is set but EMAIL_FROM_ADDRESS is missing");
}

export type OutgoingEmail = {
  to: string;
  subject: string;
  html: string;
  text: string;
  // Display name: the clinic's name, or the platform's
  fromName: string;
  // Where answers go (the address itself is always ours: EMAIL_FROM_ADDRESS)
  replyTo?: string;
  // Shows up in Brevo's logs and statistics, e.g. "invitation"
  tag: string;
};

export async function sendEmail(email: OutgoingEmail): Promise<void> {
  if (!apiKey) {
    console.log(
      `\n[email:console] ${email.tag}\n` +
        `from: ${email.fromName}${email.replyTo ? ` (reply-to: ${email.replyTo})` : ""}\n` +
        `to: ${email.to}\nsubject: ${email.subject}\n\n${email.text}\n`,
    );
    return;
  }

  const response = await fetch(BREVO_URL, {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: { name: email.fromName, email: fromAddress },
      to: [{ email: email.to }],
      ...(email.replyTo && { replyTo: { email: email.replyTo } }),
      subject: email.subject,
      htmlContent: email.html,
      textContent: email.text,
      tags: [email.tag],
    }),
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Brevo responded ${response.status}: ${detail.slice(0, 300)}`);
  }

  // Only metadata: the content may contain sign-in links
  const { messageId } = (await response.json().catch(() => ({}))) as { messageId?: string };
  console.log(`[email] sent ${email.tag} to ${maskEmail(email.to)} (${messageId ?? "no id"})`);
}
