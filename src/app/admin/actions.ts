"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { isAdminUser } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export type AdminActionState = { error?: string };

async function requireAdmin(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id || !(await isAdminUser(session.user.id))) {
    throw new Error("Forbidden");
  }
  return session.user.id;
}

export async function addAdmin(
  _prevState: AdminActionState,
  formData: FormData,
): Promise<AdminActionState> {
  await requireAdmin();

  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (!email) return { error: "Enter an email address." };

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    return { error: `No account found for ${email} — they need to register first.` };
  }
  if (user.isAdmin) {
    return { error: `${email} is already an admin.` };
  }

  await prisma.user.update({ where: { id: user.id }, data: { isAdmin: true } });
  revalidatePath("/admin");
  return {};
}

/**
 * Called directly from a client event handler (not a `<form action>`) — see
 * RemoveAdminButton, which follows up with `router.refresh()` itself. The
 * UI's disabled-when-last-admin check is the primary guard; this is the
 * server-side backstop for the rare race where that check goes stale (e.g.
 * two admin tabs open at once).
 */
export async function removeAdmin(userId: string): Promise<void> {
  await requireAdmin();

  const adminCount = await prisma.user.count({ where: { isAdmin: true } });
  if (adminCount <= 1) return;

  await prisma.user.update({ where: { id: userId }, data: { isAdmin: false } });
  revalidatePath("/admin");
}
