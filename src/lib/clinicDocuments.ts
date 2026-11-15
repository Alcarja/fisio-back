// The signed documents kept for each clinic (super-admin → a clinic →
// Documentación). Mirrored in front/src/adapters/api.ts; labels and which ones
// are required in front/src/lib/clinicDocuments.ts
export const DOCUMENT_TYPES = [
  "service_contract", // contrato de servicio / condiciones aceptadas
  "dpa", // contrato de encargo del tratamiento (art. 28 RGPD)
  "health_annex", // anexo de datos de salud, for clinics with historia clínica
  "other",
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

// What can be uploaded: a signed PDF, or a scan / photo of it
export const DOCUMENT_FILE_TYPES = ["application/pdf", "image/jpeg", "image/png"];

export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024; // 10 MB
