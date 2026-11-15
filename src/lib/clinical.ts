// Historia clínica: who sees it and the fixed lists it uses.
// Mirrored in front/src/adapters/api.ts; labels in
// front/src/pages/Admin/Patients/clinicalFormat.ts

// Who can see and write clinical data (antecedentes, expedientes, evolución).
// Receptionists can't: they only need contact details and appointments
export const CLINICAL_ROLES = ["owner", "admin", "physio"] as const;

// Who can correct or delete anyone's notes and expedientes. Physios: only their own notes
export const CLINICAL_MANAGER_ROLES = ["owner", "admin"];

export const BODY_REGIONS = [
  "head_jaw",
  "neck",
  "shoulder",
  "elbow",
  "wrist_hand",
  "thoracic",
  "lumbar",
  "hip_pelvis",
  "knee",
  "ankle_foot",
  "general",
] as const;

export const SIDES = ["left", "right", "both"] as const;

// How an expediente ended
export const CLOSE_OUTCOMES = ["resolved", "improved", "no_change", "referred", "dropped"] as const;

export const isOneOf = <T extends string>(list: readonly T[], value: unknown): value is T =>
  typeof value === "string" && (list as readonly string[]).includes(value);
