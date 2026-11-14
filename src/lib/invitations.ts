import { sendEmail } from "./email.js";

const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";

// How long an invitation stays valid. Used by Better Auth too (auth.ts)
export const INVITATION_EXPIRES_IN_SECONDS = 60 * 60 * 24 * 7; // 7 days

export const invitationExpiryDate = () =>
  new Date(Date.now() + INVITATION_EXPIRES_IN_SECONDS * 1000);

// Page in the frontend where the invited person accepts
export const invitationUrl = (invitationId: string) =>
  `${frontendUrl}/accept-invitation/${invitationId}`;

export async function sendInvitationEmail({
  invitationId,
  email,
  role,
  clinicName,
  inviterName,
}: {
  invitationId: string;
  email: string;
  role: string;
  clinicName: string;
  inviterName: string;
}) {
  await sendEmail(
    email,
    `You're invited to join ${clinicName}`,
    `${inviterName} invited you as ${role}. Accept: ${invitationUrl(invitationId)}`,
  );
}
