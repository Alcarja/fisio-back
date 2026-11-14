// Placeholder until an email provider (e.g. Resend) is configured:
// emails are printed to the console so links can be used in development.
export async function sendEmail(to: string, subject: string, body: string) {
  console.log(`\n[email] to: ${to}\n[email] subject: ${subject}\n${body}\n`);
}
