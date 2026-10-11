import { createHash, randomBytes, randomInt } from "node:crypto";

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function randomToken(bytes = 48): string {
  return randomBytes(bytes).toString("base64url");
}

export function randomDigits(length: number): string {
  let out = "";
  for (let i = 0; i < length; i += 1) out += randomInt(0, 10).toString();
  return out;
}
