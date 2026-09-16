import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

function getEncryptionKey(): Buffer {
  const hex = process.env.USER_SECRET_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error("USER_SECRET_ENCRYPTION_KEY must be a 64-character hex string (32 bytes).");
  }
  return Buffer.from(hex, "hex");
}

export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `${iv.toString("hex")}.${authTag}.${encrypted}`;
}

export function decrypt(encryptedText: string): string {
  const key = getEncryptionKey();
  const parts = encryptedText.split(".");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted format.");
  }
  const [ivHex, authTagHex, ciphertext] = parts;
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(authTagHex, "hex"));
  let decrypted = decipher.update(ciphertext, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

export function maskApiKey(key: string): string {
  if (key.length <= 6) return "••••••";
  return `${key.slice(0, 3)}••••••••${key.slice(-4)}`;
}
