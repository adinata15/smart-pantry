import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { HttpError } from "./errors";

const ALGO = "aes-256-gcm";
const IV_BYTES = 12;
const TAG_BYTES = 16;
const MIN_SEALED_BYTES = IV_BYTES + TAG_BYTES;

function keyFromEnv(env: NodeJS.ProcessEnv = process.env): Buffer {
  const raw = env.CODEX_LOGIN_KEY?.trim();
  if (!raw || raw.length < 16) {
    throw new HttpError(503, "codex_unavailable", "Codex login is not configured on this server.");
  }
  return createHash("sha256").update(raw).digest();
}

/** Seal a UTF-8 string for at-rest storage. Format: base64(iv + tag + ciphertext). */
export function sealText(plain: string, env: NodeJS.ProcessEnv = process.env): string {
  const key = keyFromEnv(env);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

export function openSealedText(sealed: string, env: NodeJS.ProcessEnv = process.env): string {
  const key = keyFromEnv(env);
  const buf = Buffer.from(sealed, "base64");
  if (buf.length < MIN_SEALED_BYTES) throw new Error("Sealed login material is truncated.");
  const iv = buf.subarray(0, IV_BYTES);
  const tag = buf.subarray(IV_BYTES, MIN_SEALED_BYTES);
  const encrypted = buf.subarray(MIN_SEALED_BYTES);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export function codexLoginConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = env.CODEX_LOGIN_KEY?.trim();
  return Boolean(raw && raw.length >= 16);
}
