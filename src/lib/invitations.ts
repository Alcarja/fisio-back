import { clinicSender, platformSender, sendTemplate } from "./email/index.js";

const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";

// How long an invitation stays valid. Used by Better Auth too (auth.ts)
export const INVITATION_EXPIRES_IN_SECONDS = 60 * 60 * 24 * 7; // 7 days

export const invitationExpiryDate = () =>
  new Date(Date.now() + INVITATION_EXPIRES_IN_SECONDS * 1000);

// Page in the frontend where the invited person accepts
export const invitationUrl = (invitationId: string) =>
  `${frontendUrl}/accept-invitation/${invitationId}`;

// sentBy "clinic": an owner or admin invited a colleague, so the email comes
// from the clinic and answers go to them. "platform": a super-admin invited a
// clinic's owner, so it comes from the platform
export async function sendInvitationEmail({
  invitationId,
  email,
  role,
  clinicName,
  inviter,
  sentBy,
}: {
  invitationId: string;
  email: string;
  role: string;
  clinicName: string;
  inviter: { name: string; email: string };
  sentBy: "clinic" | "platform";
}) {
  await sendTemplate(
    "invitation",
    email,
    {
      clinicName,
      inviterName: sentBy === "clinic" ? inviter.name : platformSender.name,
      role,
      url: invitationUrl(invitationId),
      expiresInDays: INVITATION_EXPIRES_IN_SECONDS / (60 * 60 * 24),
    },
    sentBy === "clinic" ? clinicSender(clinicName, inviter.email) : platformSender,
  );
}
