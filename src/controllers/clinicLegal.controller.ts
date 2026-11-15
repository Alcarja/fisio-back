import type { Request, Response } from "express";
import { and, desc, eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { clinicDocument, clinicLegal, organization, user } from "../db/schema.js";
import { DOCUMENT_FILE_TYPES, DOCUMENT_TYPES, MAX_DOCUMENT_BYTES } from "../lib/clinicDocuments.js";
import { isIsoDate } from "../lib/schedule.js";

// Documentación of a clinic (super-admin only, checked in clinic.routes.ts):
// its legal details and its signed documents.

const send = (res: Response, status: number, code: string, message: string) =>
  res.status(status).json({ error: { code, message } });

type ClinicParams = { clinicId: string };

async function clinicExists(clinicId: string, res: Response) {
  const [clinic] = await db
    .select({ id: organization.id })
    .from(organization)
    .where(eq(organization.id, clinicId))
    .limit(1);
  if (!clinic) send(res, 404, "CLINIC_NOT_FOUND", "La clínica no existe");
  return !!clinic;
}

// Legal details: all optional text, with its longest allowed length
const LEGAL_LIMITS = {
  legalName: 200,
  taxId: 20,
  address: 200,
  postalCode: 12,
  city: 100,
  signerName: 150,
  privacyContactName: 150,
  privacyContactEmail: 200,
  privacyContactPhone: 30,
  dpoContact: 300,
  notes: 2000,
} as const;

type LegalKey = keyof typeof LEGAL_LIMITS;
const LEGAL_KEYS = Object.keys(LEGAL_LIMITS) as LegalKey[];

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Everything but the file's content
const documentColumns = {
  id: clinicDocument.id,
  type: clinicDocument.type,
  title: clinicDocument.title,
  signedAt: clinicDocument.signedAt,
  fileName: clinicDocument.fileName,
  fileType: clinicDocument.fileType,
  fileSize: clinicDocument.fileSize,
  uploadedByName: user.name,
  createdAt: clinicDocument.createdAt,
};

// GET /admin/clinics/:clinicId/legal -> { legal, documents }
// legal: every field, null while empty. documents: newest first, without the file
export const getClinicLegal = async (req: Request<ClinicParams>, res: Response) => {
  const { clinicId } = req.params;
  if (!(await clinicExists(clinicId, res))) return;

  const [[legal], documents] = await Promise.all([
    db.select().from(clinicLegal).where(eq(clinicLegal.organizationId, clinicId)).limit(1),
    db
      .select(documentColumns)
      .from(clinicDocument)
      .leftJoin(user, eq(clinicDocument.uploadedBy, user.id))
      .where(eq(clinicDocument.organizationId, clinicId))
      .orderBy(desc(clinicDocument.createdAt)),
  ]);

  res.json({
    legal: Object.fromEntries(LEGAL_KEYS.map((key) => [key, legal?.[key] ?? null])),
    documents,
  });
};

// PUT /admin/clinics/:clinicId/legal -> 204. body: any of the legal fields
// ("" or null empties one)
export const updateClinicLegal = async (req: Request<ClinicParams>, res: Response) => {
  const { clinicId } = req.params;
  const body = req.body ?? {};

  const fields: Partial<Record<LegalKey, string | null>> = {};
  for (const key of LEGAL_KEYS) {
    const value = body[key];
    if (value === undefined) continue;
    if (value !== null && typeof value !== "string") {
      return send(res, 400, "INVALID_LEGAL", `El campo ${key} no es válido`);
    }
    const text = value?.trim() ?? "";
    if (text.length > LEGAL_LIMITS[key]) {
      return send(res, 400, "INVALID_LEGAL", `El campo ${key} admite como máximo ${LEGAL_LIMITS[key]} caracteres`);
    }
    fields[key] = text || null;
  }
  if (fields.privacyContactEmail && !EMAIL_PATTERN.test(fields.privacyContactEmail)) {
    return send(res, 400, "INVALID_LEGAL", "El email de contacto no es válido");
  }
  if (fields.taxId) fields.taxId = fields.taxId.toUpperCase();
  if (Object.keys(fields).length === 0) {
    return send(res, 400, "NOTHING_TO_UPDATE", "No hay cambios que guardar");
  }
  if (!(await clinicExists(clinicId, res))) return;

  await db
    .insert(clinicLegal)
    .values({ organizationId: clinicId, ...fields })
    .onConflictDoUpdate({ target: clinicLegal.organizationId, set: fields });
  res.status(204).end();
};

// POST /admin/clinics/:clinicId/documents?type=&signedAt=&title=&fileName= -> 201 { documentId }
// The body is the file itself (PDF, JPG or PNG, up to 10 MB), with its
// Content-Type. express.raw in clinic.routes.ts leaves it in req.body
export const uploadClinicDocument = async (req: Request<ClinicParams>, res: Response) => {
  const { clinicId } = req.params;
  const { type, signedAt, title, fileName } = req.query;

  if (!DOCUMENT_TYPES.includes(type as (typeof DOCUMENT_TYPES)[number])) {
    return send(res, 400, "INVALID_DOCUMENT", `El tipo debe ser uno de: ${DOCUMENT_TYPES.join(", ")}`);
  }
  if (signedAt !== undefined && signedAt !== "" && !isIsoDate(signedAt)) {
    return send(res, 400, "INVALID_DOCUMENT", "La fecha de firma debe ser AAAA-MM-DD");
  }
  if (title !== undefined && (typeof title !== "string" || title.length > 150)) {
    return send(res, 400, "INVALID_DOCUMENT", "La descripción admite como máximo 150 caracteres");
  }
  if (typeof fileName !== "string" || !fileName.trim() || fileName.length > 200) {
    return send(res, 400, "INVALID_DOCUMENT", "Falta el nombre del archivo");
  }
  const fileType = req.headers["content-type"]?.split(";")[0]?.trim() ?? "";
  if (!DOCUMENT_FILE_TYPES.includes(fileType) || !Buffer.isBuffer(req.body)) {
    return send(res, 400, "INVALID_FILE", "El archivo debe ser un PDF, un JPG o un PNG");
  }
  if (req.body.length === 0 || req.body.length > MAX_DOCUMENT_BYTES) {
    return send(res, 400, "INVALID_FILE", "El archivo está vacío o pesa más de 10 MB");
  }
  if (!(await clinicExists(clinicId, res))) return;

  const [created] = await db
    .insert(clinicDocument)
    .values({
      organizationId: clinicId,
      type: type as string,
      title: title?.trim() || null,
      signedAt: signedAt || null,
      // Only the name: no folders, no characters that would break a header
      fileName: fileName.trim().replace(/[\\/"\r\n]/g, "_"),
      fileType,
      fileSize: req.body.length,
      fileData: req.body,
      uploadedBy: req.user!.id,
    })
    .returning({ id: clinicDocument.id });

  res.status(201).json({ documentId: created!.id });
};

type DocumentParams = ClinicParams & { documentId: string };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const documentFilter = ({ clinicId, documentId }: DocumentParams) =>
  and(eq(clinicDocument.id, documentId), eq(clinicDocument.organizationId, clinicId));

const documentNotFound = (res: Response) =>
  send(res, 404, "DOCUMENT_NOT_FOUND", "Este documento no existe");

// GET /admin/clinics/:clinicId/documents/:documentId/file -> the file
export const downloadClinicDocument = async (req: Request<DocumentParams>, res: Response) => {
  if (!UUID_PATTERN.test(req.params.documentId)) return documentNotFound(res);
  const [document] = await db
    .select({
      fileName: clinicDocument.fileName,
      fileType: clinicDocument.fileType,
      fileData: clinicDocument.fileData,
    })
    .from(clinicDocument)
    .where(documentFilter(req.params))
    .limit(1);
  if (!document) return documentNotFound(res);

  res.setHeader("Content-Type", document.fileType);
  res.setHeader(
    "Content-Disposition",
    `inline; filename*=UTF-8''${encodeURIComponent(document.fileName)}`,
  );
  // Never let the browser guess another type for an uploaded file
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "private, no-store");
  res.end(document.fileData);
};

// DELETE /admin/clinics/:clinicId/documents/:documentId -> 204
export const deleteClinicDocument = async (req: Request<DocumentParams>, res: Response) => {
  if (!UUID_PATTERN.test(req.params.documentId)) return documentNotFound(res);
  const deleted = await db
    .delete(clinicDocument)
    .where(documentFilter(req.params))
    .returning({ id: clinicDocument.id });
  if (deleted.length === 0) return documentNotFound(res);
  res.status(204).end();
};
