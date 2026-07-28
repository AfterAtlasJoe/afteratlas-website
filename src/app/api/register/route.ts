import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";

import { notifyAdminsOfNewSignup } from "@/lib/notify-admins";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const email: string | undefined = body.email;
  const password: string | undefined = body.password;
  const name: string | undefined = body.name;
  const disclaimerAccepted: boolean = body.disclaimerAccepted === true;

  if (!email || !password) {
    return NextResponse.json(
      { error: "Email and password are required" },
      { status: 400 },
    );
  }
  if (!disclaimerAccepted) {
    return NextResponse.json(
      { error: "You must accept the disclaimer to create an account" },
      { status: 400 },
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { error: "An account with that email already exists" },
      { status: 409 },
    );
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { email, passwordHash, name, disclaimerAcceptedAt: new Date() },
    select: { id: true, email: true, name: true },
  });

  try {
    await notifyAdminsOfNewSignup(user);
  } catch (error) {
    console.error("Failed to notify admins of new signup:", error);
  }

  return NextResponse.json(user, { status: 201 });
}
