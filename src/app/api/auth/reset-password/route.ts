import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { consumePasswordResetToken } from "@/lib/password-reset";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const token = typeof body.token === "string" ? body.token : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!token || !password || password.length < 8) {
    return NextResponse.json(
      { error: "A valid token and a password of at least 8 characters are required." },
      { status: 400 },
    );
  }

  const email = await consumePasswordResetToken(token);
  if (!email) {
    return NextResponse.json(
      { error: "This reset link is invalid or has expired. Request a new one." },
      { status: 400 },
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.update({ where: { email }, data: { passwordHash } });

  return NextResponse.json({ ok: true });
}
