import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import { z } from "zod";
export const gatewayScopes = ["tracking:read", "tracking:write"];
const callback = z
  .url()
  .max(2048)
  .refine((value) => {
    const u = new URL(value);
    return (
      !u.hash &&
      !u.username &&
      !u.password &&
      (u.protocol === "https:" ||
        (u.protocol === "http:" &&
          ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname)))
    );
  }, "Use HTTPS or a loopback callback without credentials or a fragment.");
export const registrationSchema = z.object({
  client_name: z.string().trim().min(1).max(150).default("MCP assistant"),
  redirect_uris: z.array(callback).min(1).max(10),
  token_endpoint_auth_method: z.literal("none").default("none"),
  grant_types: z
    .array(z.enum(["authorization_code", "refresh_token"]))
    .default(["authorization_code", "refresh_token"]),
  response_types: z.array(z.literal("code")).default(["code"]),
});
export const authorizationSchema = z.object({
  client_id: z.uuid(),
  redirect_uri: callback,
  response_type: z.literal("code"),
  code_challenge: z.string().regex(/^[A-Za-z0-9_-]{43}$/),
  code_challenge_method: z.literal("S256"),
  state: z.string().min(1).max(1024),
  resource: z.url().max(2048),
  scope: z
    .string()
    .default("tracking:read")
    .refine((s) => {
      const parts = s.split(" ");
      return (
        parts.includes("tracking:read") &&
        parts.every((v) => gatewayScopes.includes(v))
      );
    }),
});
export function digest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}
export function randomToken() {
  return randomBytes(32).toString("base64url");
}
function encryptionKey(value: string) {
  const key = Buffer.from(value, "base64");
  if (key.length !== 32)
    throw new Error(
      "MCP_GATEWAY_ENCRYPTION_KEY must be a base64-encoded 32-byte key.",
    );
  return key;
}
export function encrypt(value: unknown, key: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(key), iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(value), "utf8"),
    cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString(
    "base64url",
  );
}
export function decrypt(value: string, key: string): unknown {
  const bytes = Buffer.from(value, "base64url");
  const cipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(key),
    bytes.subarray(0, 12),
  );
  cipher.setAuthTag(bytes.subarray(12, 28));
  return JSON.parse(
    Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString(
      "utf8",
    ),
  );
}
