import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

/** Records that the current user has accepted the disclaimer (src/lib/disclaimer.ts). */
export async function POST() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: { disclaimerAcceptedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
