import { createHmac, timingSafeEqual } from "node:crypto";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Lets the "download it as a PDF" link in the checklist-completion email
 * work no matter where it's opened — a mobile mail app's link often opens
 * in a browser/webview with no session cookie for the site at all (unlike
 * desktop, where the recipient is often already logged in in the same
 * browser), so relying on the session cookie alone 401s there. This is a
 * stateless HMAC-signed token scoped to one specific survey response and
 * expiring after 30 days, verified without needing a database round trip
 * or a new table — the PDF route accepts either a valid session (browsing
 * the site directly) or a valid token (the emailed link) for the same
 * response id.
 */
function secret(): string {
  const value = process.env.AUTH_SECRET;
  if (!value) {
    throw new Error("AUTH_SECRET must be set to sign/verify PDF download tokens");
  }
  return value;
}

function sign(responseId: string, expiresAt: number): string {
  return createHmac("sha256", secret())
    .update(`${responseId}.${expiresAt}`)
    .digest("hex");
}

export function createPdfDownloadToken(responseId: string): string {
  const expiresAt = Date.now() + THIRTY_DAYS_MS;
  const signature = sign(responseId, expiresAt);
  return `${expiresAt}.${signature}`;
}

export function verifyPdfDownloadToken(responseId: string, token: string | null): boolean {
  if (!token) return false;
  const [expiresAtStr, signature] = token.split(".");
  const expiresAt = Number(expiresAtStr);
  if (!expiresAtStr || !signature || Number.isNaN(expiresAt)) return false;
  if (Date.now() > expiresAt) return false;

  const expected = sign(responseId, expiresAt);
  const expectedBuf = Buffer.from(expected, "hex");
  const actualBuf = Buffer.from(signature, "hex");
  if (expectedBuf.length !== actualBuf.length) return false;
  return timingSafeEqual(expectedBuf, actualBuf);
}
