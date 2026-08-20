import { randomBytes } from "node:crypto";

import { prisma } from "@/lib/prisma";

const RESET_TOKEN_WINDOW_MS = 60 * 60 * 1000; // 1 hour

/**
 * Reuses NextAuth's own VerificationToken table (identifier/token/expires)
 * rather than adding a new one — it's already exactly the shape a
 * single-use, expiring, email-scoped token needs, and Auth.js only uses it
 * itself for email-provider sign-in, which this app doesn't use.
 */
export async function createPasswordResetToken(email: string): Promise<string> {
  const token = randomBytes(32).toString("hex");
  await prisma.verificationToken.create({
    data: {
      identifier: email,
      token,
      expires: new Date(Date.now() + RESET_TOKEN_WINDOW_MS),
    },
  });
  return token;
}

/** Looks up and immediately deletes the token (single-use) if it's valid and unexpired; returns the email it was issued for, or null. */
export async function consumePasswordResetToken(token: string): Promise<string | null> {
  const record = await prisma.verificationToken.findUnique({ where: { token } });
  if (!record) return null;

  await prisma.verificationToken.delete({ where: { token } }).catch(() => {});

  if (record.expires < new Date()) return null;
  return record.identifier;
}
