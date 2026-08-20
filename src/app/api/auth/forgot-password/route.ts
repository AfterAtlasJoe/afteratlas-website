import { NextRequest, NextResponse } from "next/server";

import { sendEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";
import { createPasswordResetToken } from "@/lib/password-reset";
import { buildPasswordResetEmail } from "@/lib/password-reset-email";

const MAX_REQUESTS_PER_HOUR = 3;

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

  // Always return the same generic response regardless of whether the
  // email is registered, has a password (vs. Google-only), or was rate
  // limited — revealing which of those is true would let someone enumerate
  // real accounts.
  const genericResponse = NextResponse.json({
    message: "If an account exists for that email, a reset link is on its way.",
  });

  if (!email) return genericResponse;

  const user = await prisma.user.findUnique({ where: { email }, select: { passwordHash: true } });
  if (!user?.passwordHash) {
    // No account, or a Google-only account with nothing to reset.
    return genericResponse;
  }

  const recentRequestCount = await prisma.verificationToken.count({
    where: { identifier: email, expires: { gt: new Date() } },
  });
  if (recentRequestCount >= MAX_REQUESTS_PER_HOUR) {
    return genericResponse;
  }

  const token = await createPasswordResetToken(email);
  const resetUrl = `${request.nextUrl.origin}/reset-password?token=${token}`;
  const { subject, html } = buildPasswordResetEmail({ resetUrl });
  try {
    await sendEmail({ to: email, subject, html });
  } catch (error) {
    console.error("Failed to send password reset email:", error);
  }

  return genericResponse;
}
