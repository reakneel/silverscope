import { createHmac, timingSafeEqual } from "node:crypto";
export function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
  nowSeconds = Math.floor(Date.now() / 1000),
  toleranceSeconds = 300,
): boolean {
  if (!signatureHeader || !secret || !Number.isFinite(nowSeconds) || toleranceSeconds <= 0) return false;
  const parts = signatureHeader.split(",").map((part) => part.trim());
  const timestampPart = parts.find((part) => part.startsWith("t="));
  const signatures = parts.filter((part) => part.startsWith("v1=")).map((part) => part.slice(3));
  if (!timestampPart || !signatures.length) return false;
  const timestamp = Number(timestampPart.slice(2));
  if (!Number.isInteger(timestamp) || Math.abs(nowSeconds - timestamp) > toleranceSeconds) return false;
  const expected = createHmac("sha256", secret).update(`${timestamp}.${rawBody}`, "utf8").digest();
  return signatures.some((signature) => {
    if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
    const supplied = Buffer.from(signature, "hex");
    return supplied.length === expected.length && timingSafeEqual(supplied, expected);
  });
}
