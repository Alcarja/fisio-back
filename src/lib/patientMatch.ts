import { and, eq, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { clinicFeature, patient } from "../db/schema.js";

// Links an online booking to the patient's ficha (only in clinics with
// "Pacientes e historia clínica"). The booking form is public and an email is
// no proof of who's booking (anyone can type someone else's, and families
// share one), so a ficha is linked only when the email AND the name match a
// single ficha. Otherwise, a ficha with that email is only suggested to the
// clinic, which decides. The patient is never told whether a ficha was found.

type Exec = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];

// "María José" ~ "maria jose", "MARÍA JOSÉ"
const norm = (t: string) =>
  t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
const firstWord = (t: string) => norm(t).split(" ")[0] ?? "";

// Same first name, and the same first surname ("Martínez" matches a ficha
// "Martínez Ruiz": people often write only one)
export const sameName = (
  typed: { firstName: string; lastName: string },
  ficha: { firstName: string; lastName: string },
) => norm(typed.firstName) === norm(ficha.firstName) && firstWord(typed.lastName) === firstWord(ficha.lastName);

export async function matchPatientByEmail(
  exec: Exec,
  clinicId: string,
  typed: { email: string; firstName: string; lastName: string },
): Promise<{ linked: { id: string; firstName: string; lastName: string } | null; suggestedId: string | null }> {
  const [feature] = await exec
    .select({ f: clinicFeature.feature })
    .from(clinicFeature)
    .where(and(eq(clinicFeature.organizationId, clinicId), eq(clinicFeature.feature, "clinical_history")))
    .limit(1);
  if (!feature) return { linked: null, suggestedId: null };

  const candidates = await exec
    .select({ id: patient.id, firstName: patient.firstName, lastName: patient.lastName })
    .from(patient)
    .where(
      and(
        eq(patient.organizationId, clinicId),
        sql`lower(trim(${patient.email})) = ${typed.email.trim().toLowerCase()}`,
      ),
    );
  const matches = candidates.filter((c) => sameName(typed, c));
  if (matches.length === 1) return { linked: matches[0]!, suggestedId: null };
  return { linked: null, suggestedId: (matches[0] ?? candidates[0])?.id ?? null };
}
