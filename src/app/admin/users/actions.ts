"use server";

import { randomBytes } from "node:crypto";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { sendEmail } from "@/lib/email";
import { isAdminUser } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { buildTemporaryPasswordEmail } from "@/lib/password-reset-email";

export type UserActionState = { error?: string; message?: string };

async function requireAdmin(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id || !(await isAdminUser(session.user.id))) {
    throw new Error("Forbidden");
  }
  return session.user.id;
}

/**
 * Manually deletes everything that references this user before deleting
 * the row itself, rather than relying on cascade behavior — several of
 * these relations (SurveyResponse, Plan.ownerUserId, PlanMember) don't
 * cascade on delete, so a plain `prisma.user.delete()` would fail with a
 * foreign-key violation the moment the account has any real data.
 */
export async function deleteUser(userId: string): Promise<UserActionState> {
  const adminId = await requireAdmin();

  if (userId === adminId) {
    return { error: "You can't delete your own account from here." };
  }

  const target = await prisma.user.findUnique({ where: { id: userId }, select: { isAdmin: true } });
  if (!target) return { error: "User not found." };
  if (target.isAdmin) {
    const adminCount = await prisma.user.count({ where: { isAdmin: true } });
    if (adminCount <= 1) {
      return { error: "Can't delete the last admin — remove admin access first if you really mean to." };
    }
  }

  await prisma.$transaction(async (tx) => {
    const ownedPlans = await tx.plan.findMany({ where: { ownerUserId: userId }, select: { id: true } });
    const ownedPlanIds = ownedPlans.map((p) => p.id);
    if (ownedPlanIds.length > 0) {
      await tx.planMember.deleteMany({ where: { planId: { in: ownedPlanIds } } });
      await tx.plan.deleteMany({ where: { id: { in: ownedPlanIds } } });
    }
    await tx.planMember.deleteMany({ where: { userId } });
    await tx.surveyResponse.deleteMany({ where: { userId } });
    await tx.user.delete({ where: { id: userId } });
  });

  revalidatePath("/admin/users");
  return { message: "User deleted." };
}

function generateTemporaryPassword(): string {
  // Base64url-ish, no ambiguous-looking characters needed since it's typed
  // once and then replaced — just needs to be long and random.
  return randomBytes(9).toString("base64").replace(/[+/=]/g, "").slice(0, 12);
}

export async function resetUserPassword(userId: string): Promise<UserActionState> {
  await requireAdmin();

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!user) return { error: "User not found." };

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, 10);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

  const { subject, html } = buildTemporaryPasswordEmail({ temporaryPassword });
  try {
    await sendEmail({ to: user.email, subject, html });
  } catch (error) {
    console.error("Failed to send temporary password email:", error);
    return { error: "Password was reset, but the notification email failed to send." };
  }

  revalidatePath("/admin/users");
  return { message: `Temporary password emailed to ${user.email}.` };
}
