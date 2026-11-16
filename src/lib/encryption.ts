import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { customType } from "drizzle-orm/pg-core";

// Encryption of the clinical texts before they reach the database (diagnoses,
// evolution notes, antecedentes…). Whoever gets the database (a leaked
// DATABASE_URL, the provider's console, a dump) only sees unreadable text: the
// key lives in this server's environment, never in the database.
//
// AES-256-GCM with a new random IV for every value. Stored as
//   enc:v1:<base64url of IV (12 bytes) + auth tag (16 bytes) + ciphertext>
// "v1" names the key: to change it one day, add a v2 here and re-encrypt.
//
// THE KEY (DATA_ENCRYPTION_KEY) CAN'T BE RECOVERED. Without it the encrypted
// columns are lost for good: keep a copy away from the server and the database.
//
// Encrypted columns can't be searched, compared or ordered in SQL: use them
// only for texts that are read back whole. Declare them in the schema with
// encryptedText / encryptedJson and the rest of the code works with plain values.

const PREFIX = "enc:v1:";
const IV_BYTES = 12;
const TAG_BYTES = 16;

let cachedKey: Buffer | undefined;

// Read on first use (not on import), so tools that only load the schema, like
// drizzle-kit, don't need it
function key(): Buffer {
  if (cachedKey) return cachedKey;
  const value = process.env.DATA_ENCRYPTION_KEY;
  if (!value) {
    throw new Error(
      "DATA_ENCRYPTION_KEY is not set. Generate one with `openssl rand -base64 32` (see .env.example)",
    );
  }
  const decoded = Buffer.from(value, "base64");
  if (decoded.length !== 32) {
    throw new Error("DATA_ENCRYPTION_KEY must be 32 bytes in base64 (`openssl rand -base64 32`)");
  }
  cachedKey = decoded;
  return decoded;
}

// Call on startup: better to fail now than on the first clinical note
export const assertEncryptionKey = () => void key();

export const isEncrypted = (value: string) => value.startsWith(PREFIX);

export function encrypt(plain: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return PREFIX + Buffer.concat([iv, cipher.getAuthTag(), data]).toString("base64url");
}

// Values saved before encryption existed come back as they are, until
// `npm run db:encrypt-clinical` encrypts them
export function decrypt(stored: string): string {
  if (!isEncrypted(stored)) return stored;
  const raw = Buffer.from(stored.slice(PREFIX.length), "base64url");
  const decipher = createDecipheriv("aes-256-gcm", key(), raw.subarray(0, IV_BYTES));
  decipher.setAuthTag(raw.subarray(IV_BYTES, IV_BYTES + TAG_BYTES));
  try {
    return Buffer.concat([
      decipher.update(raw.subarray(IV_BYTES + TAG_BYTES)),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    // Wrong key, or the stored value was altered. Never include the value
    throw new Error("Could not decrypt a stored value: wrong DATA_ENCRYPTION_KEY or damaged data");
  }
}

// A text column, encrypted in the database and plain in the code
export const encryptedText = customType<{ data: string; driverData: string }>({
  dataType: () => "text",
  toDriver: (value) => encrypt(value),
  fromDriver: (value) => decrypt(value),
});

// An object kept as encrypted JSON (a text column in the database)
export const encryptedJson = customType<{ data: Record<string, unknown>; driverData: string }>({
  dataType: () => "text",
  toDriver: (value) => encrypt(JSON.stringify(value)),
  fromDriver: (value) => JSON.parse(decrypt(value)) as Record<string, unknown>,
});
