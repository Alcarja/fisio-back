import { createHash, randomBytes } from "node:crypto";

// Keys of the patients' exercise pages (/ejercicios/:token). Never kept
// readable: whoever reads the database can't open the pages. A program keeps
// the token encrypted (to show the QR again) and its SHA-256 to find it.

export const newProgramToken = () => randomBytes(24).toString("base64url");

export const hashProgramToken = (token: string) => createHash("sha256").update(token).digest("hex");

// Is this a database error for "only one active program per expediente"?
export const isOneActiveViolation = (error: unknown) => {
  let e: unknown = error;
  for (let i = 0; i < 4 && e; i++) {
    const pg = e as { code?: string; constraint?: string };
    if (pg.code === "23505" && pg.constraint === "exercise_program_one_active") return true;
    e = (e as { cause?: unknown }).cause;
  }
  return false;
};
