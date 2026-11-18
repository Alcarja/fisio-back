import type { Request } from "express";

// Uploaded images (exercises, website photos): small, already compressed by
// the browser, sent as the request body (express.raw in the routes).

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

// The file really is the image it says it is (by its first bytes)
export function looksLike(type: string, data: Buffer) {
  if (type === "image/jpeg") return data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff;
  if (type === "image/png") return data.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  if (type === "image/webp") return data.subarray(0, 4).toString("latin1") === "RIFF" && data.subarray(8, 12).toString("latin1") === "WEBP";
  return false;
}

// The uploaded image, checked: { type, data }, or what's wrong with it
export function readUploadedImage(req: Request): { type: string; data: Buffer } | string {
  const type = req.headers["content-type"]?.split(";")[0]?.trim() ?? "";
  if (!IMAGE_TYPES.includes(type) || !Buffer.isBuffer(req.body)) {
    return "La imagen debe ser JPG, PNG o WebP";
  }
  if (req.body.length === 0 || req.body.length > MAX_IMAGE_BYTES) {
    return "La imagen está vacía o pesa más de 2 MB";
  }
  if (!looksLike(type, req.body)) return "El archivo no es una imagen válida";
  return { type, data: req.body };
}
