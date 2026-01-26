import crypto from "crypto";

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export function signRawMessage(raw: string): string {
  const secret = requireEnv("MESSAGE_HMAC_SECRET");
  return crypto.createHmac("sha256", secret).update(raw, "utf8").digest("hex");
}

export function verifyRawMessage(raw: string, signature: any): boolean {
  if (typeof signature !== "string" || signature.length < 10) return false;

  const expected = signRawMessage(raw);

  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  if (a.length !== b.length) return false;

  return crypto.timingSafeEqual(a, b);
}
