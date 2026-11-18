import { createHmac, timingSafeEqual } from "node:crypto";

// Links to see a clinic's draft website before publishing
// (https://sites.kineflow.es/_preview?t=<token>). The token carries the
// clinic id and an expiry, signed with SITES_PREVIEW_SECRET: the only secret
// the API and the sites service share. Nothing is stored.

const VALID_MS = 15 * 60 * 1000;

function secret() {
  const value = process.env.SITES_PREVIEW_SECRET;
  if (!value || value.length < 32) return null;
  return value;
}

export const previewConfigured = () => secret() !== null;

const sign = (payload: string, key: string) =>
  createHmac("sha256", key).update(payload).digest("base64url");

// Throws if SITES_PREVIEW_SECRET isn't set (check previewConfigured first)
export function makePreviewToken(clinicId: string): { token: string; expiresAt: Date } {
  const key = secret();
  if (!key) throw new Error("SITES_PREVIEW_SECRET is not set (32+ characters)");
  const expiresAt = new Date(Date.now() + VALID_MS);
  const payload = Buffer.from(JSON.stringify({ c: clinicId, e: expiresAt.getTime() })).toString("base64url");
  return { token: `${payload}.${sign(payload, key)}`, expiresAt };
}

// The clinic id, or null if the token is malformed, forged or expired
export function readPreviewToken(token: string): string | null {
  const key = secret();
  if (!key || typeof token !== "string" || token.length > 500) return null;
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra !== undefined) return null;

  const expected = Buffer.from(sign(payload, key));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  try {
    const { c, e } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof c !== "string" || typeof e !== "number" || e < Date.now()) return null;
    return c;
  } catch {
    return null;
  }
}
