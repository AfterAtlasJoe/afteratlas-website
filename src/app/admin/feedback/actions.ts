"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { isAdminUser } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

async function requireAdmin(): Promise<void> {
  const session = await auth();
  if (!session?.user?.id || !(await isAdminUser(session.user.id))) {
    throw new Error("Forbidden");
  }
}

export async function setFeedbackReviewed(id: string, reviewed: boolean): Promise<void> {
  await requireAdmin();
  await prisma.feedback.update({
    where: { id },
    data: { reviewedAt: reviewed ? new Date() : null },
  });
  revalidatePath("/admin/feedback");
}
