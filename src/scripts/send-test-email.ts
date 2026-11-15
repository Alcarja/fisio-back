import "dotenv/config";
import { clinicSender, sendTemplate } from "../lib/email/index.js";

// Sends every email template to one address, without touching the database.
// Usage: npm run email:test -- you@example.com
// Without BREVO_API_KEY in .env they're printed to the console instead.

const to = process.argv[2];
if (!to || !to.includes("@")) {
  console.error("Usage: npm run email:test -- you@example.com");
  process.exit(1);
}

const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";
const replyTo = process.env.EMAIL_SUPPORT_ADDRESS || to;

console.log(
  process.env.BREVO_API_KEY
    ? `Sending through Brevo as ${process.env.EMAIL_FROM_ADDRESS}…`
    : "No BREVO_API_KEY: printing to the console",
);

const results = [
  await sendTemplate(
    "invitation",
    to,
    {
      clinicName: "Clínica de Prueba",
      inviterName: "María García",
      role: "physio",
      url: `${frontendUrl}/accept-invitation/test`,
      expiresInDays: 7,
    },
    clinicSender("Clínica de Prueba", replyTo),
  ),
  await sendTemplate(
    "welcome",
    to,
    {
      name: "Lucía",
      clinicName: "Clínica de Prueba",
      inviterName: "María García",
      role: "receptionist",
      url: `${frontendUrl}/reset-password`,
    },
    clinicSender("Clínica de Prueba", replyTo),
  ),
  await sendTemplate("resetPassword", to, {
    name: "Lucía",
    url: `${frontendUrl}/reset-password`,
  }),
];

const sent = results.filter(Boolean).length;
console.log(`\n${sent}/${results.length} emails sent`);
process.exit(sent === results.length ? 0 : 1);
