import "dotenv/config";
import { betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { admin, organization } from "better-auth/plugins";
import { and, eq, gt } from "drizzle-orm";
import { db } from "./db/index.js";
import * as schema from "./db/schema.js";
import { sendEmail } from "./lib/email.js";
import { INVITATION_EXPIRES_IN_SECONDS, sendInvitationEmail } from "./lib/invitations.js";
import { replacePreviousOwners } from "./lib/ownership.js";
import {
  CLINIC_ROLES,
  clinicAc,
  clinicRoles,
  isClinicRole,
  platformAc,
  platformRoles,
} from "./lib/permissions.js";

const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:5173";

function assertClinicRole(role: unknown) {
  if (!isClinicRole(role)) {
    throw new APIError("BAD_REQUEST", {
      code: "INVALID_CLINIC_ROLE",
      message: `El rol debe ser uno de: ${CLINIC_ROLES.join(", ")}`,
    });
  }
}

// Header the accept-invitation page sends with its sign-up request
export const INVITATION_HEADER = "x-invitation-id";

// Public sign-up is only for people accepting an invitation. The invitation id
// is a secret that only reaches the invited inbox, so it proves the email is
// theirs. Without this, anyone could register someone else's email first and be
// added to a clinic with it later.
// Server-side calls (seed scripts, auth.api.* from our controllers) have no
// request and aren't affected.
async function requireInvitationForSignUp(request: Request | undefined, rawEmail: unknown) {
  if (!request) return;

  const invitationId = request.headers.get(INVITATION_HEADER);
  const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";

  const [found] = invitationId
    ? await db
        .select({ email: schema.invitation.email })
        .from(schema.invitation)
        .where(
          and(
            eq(schema.invitation.id, invitationId),
            eq(schema.invitation.status, "pending"),
            gt(schema.invitation.expiresAt, new Date()),
          ),
        )
        .limit(1)
    : [];

  if (!found || found.email.toLowerCase() !== email) {
    throw new APIError("FORBIDDEN", {
      code: "SIGN_UP_REQUIRES_INVITATION",
      message: "Solo puedes crear una cuenta desde una invitación válida",
    });
  }
}

const googleConfigured =
  !!process.env.GOOGLE_CLIENT_ID && !!process.env.GOOGLE_CLIENT_SECRET;

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins: [frontendUrl],

  database: drizzleAdapter(db, { provider: "pg", schema }),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 10,
    // A reset proves the inbox is theirs: anyone else logged in to the account
    // (e.g. with an old or leaked password) is logged out
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail(user.email, "Reset your password", `Reset link: ${url}`);
    },
  },

  // Google login is only enabled once its credentials are in .env
  socialProviders: googleConfigured
    ? {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        },
      }
    : {},

  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === "/sign-up/email") {
        await requireInvitationForSignUp(ctx.request, ctx.body?.email);
      }
    }),
  },

  account: {
    accountLinking: { enabled: true, trustedProviders: ["google"] },
  },

  plugins: [
    // Platform role on user.role: "superadmin" | "user"
    admin({
      ac: platformAc,
      roles: platformRoles,
      adminRoles: ["superadmin"],
      defaultRole: "user",
    }),

    // Clinics = organizations; role per membership
    organization({
      ac: clinicAc,
      roles: clinicRoles,
      creatorRole: "owner",
      // Only super-admins can create clinics
      allowUserToCreateOrganization: (user) => user.role === "superadmin",
      invitationExpiresIn: INVITATION_EXPIRES_IN_SECONDS,
      sendInvitationEmail: async ({ id, email, role, organization, inviter }) => {
        await sendInvitationEmail({
          invitationId: id,
          email,
          role,
          clinicName: organization.name,
          inviterName: inviter.user.name,
        });
      },
      organizationHooks: {
        // Every member and invitation must have exactly one of our clinic roles
        // (never Better Auth's default "member", which has no permissions)
        beforeAddMember: async ({ member }) => assertClinicRole(member.role),
        beforeUpdateMemberRole: async ({ newRole }) => assertClinicRole(newRole),
        beforeCreateInvitation: async ({ invitation }) => assertClinicRole(invitation.role),

        // Accepting an owner invitation hands the clinic over to the new owner
        afterAcceptInvitation: async ({ invitation, member }) => {
          if (invitation.role === "owner") {
            await replacePreviousOwners(invitation.organizationId, member.id);
          }
        },
      },
      schema: {
        organization: {
          additionalFields: {
            status: { type: "string", required: false, defaultValue: "active", input: false },
            isPublic: { type: "boolean", required: false, defaultValue: false, input: false },
            // IANA zone: appointments are stored in UTC and shown in this zone
            timezone: { type: "string", required: false, defaultValue: "Europe/Madrid", input: false },
          },
        },
      },
    }),
  ],
});

export type Session = typeof auth.$Infer.Session;
