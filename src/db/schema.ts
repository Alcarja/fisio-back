// Better Auth tables (generated with `npm run auth:generate`, don't edit by hand)
export * from "./auth-schema.js";

// Calendar (CALENDARIO.md)
export * from "./schedule-schema.js";
export * from "./room-schema.js";
export * from "./service-schema.js";
export * from "./patient-schema.js";
export * from "./clinical-schema.js";
export * from "./appointment-schema.js";

// Pagos de las clínicas (super-admin)
export * from "./billing-schema.js";

// Funcionalidades opcionales por clínica (super-admin)
export * from "./feature-schema.js";

// Documentación de cada clínica: datos legales y contratos firmados (super-admin)
export * from "./clinic-legal-schema.js";

// Solicitudes de contacto de la web pública
export * from "./contact-schema.js";
