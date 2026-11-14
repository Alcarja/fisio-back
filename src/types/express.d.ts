import type { Session } from "../auth.js";
import type { ClinicRole } from "../lib/permissions.js";

declare global {
  namespace Express {
    interface Request {
      user?: Session["user"];
      session?: Session["session"];
      // Set by requireActiveClinic: the session's clinic and the user's role in it
      clinicId?: string;
      clinicRole?: ClinicRole;
    }
  }
}

export {};
