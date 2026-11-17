import { asc, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { clinicFeature } from "../db/schema.js";

// Optional features a super-admin switches on per clinic (off by default).
// Mirrored in front/src/adapters/api.ts (ClinicFeature) and described for the
// super-admin panel in front/src/lib/features.ts.
//
// To add one: add its key here and in the frontend, then protect its routes
// with requireFeature("key") after requireActiveClinic.
export const CLINIC_FEATURES = [
  "invoicing",
  // The whole Pacientes section: fichas, and in them the historia clínica
  // (antecedentes, expedientes, evolution notes). Health data, so off until the
  // clinic has signed what it needs (clinic → Documentación). Without it,
  // appointments only carry a name and surname
  "clinical_history",
  // Patients book their own appointments (link or QR). This only makes it
  // available: the clinic still has to switch it on in Configuración →
  // Reserva online (lib/onlineBooking.ts)
  "online_booking",
  // Appointment reminders by email. This only makes them available: the clinic
  // still has to switch them on in Configuración → Recordatorios (lib/reminders.ts)
  "reminders",
] as const;

export type ClinicFeature = (typeof CLINIC_FEATURES)[number];

export const isClinicFeature = (value: unknown): value is ClinicFeature =>
  CLINIC_FEATURES.includes(value as ClinicFeature);

// The features a clinic has switched on. Keys no longer in CLINIC_FEATURES
// (a removed feature with rows left behind) are ignored
export async function getClinicFeatures(clinicId: string): Promise<ClinicFeature[]> {
  const rows = await db
    .select({ feature: clinicFeature.feature })
    .from(clinicFeature)
    .where(eq(clinicFeature.organizationId, clinicId))
    .orderBy(asc(clinicFeature.feature));
  return rows.map((r) => r.feature).filter(isClinicFeature);
}
