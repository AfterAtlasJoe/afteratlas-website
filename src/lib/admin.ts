import { prisma } from "@/lib/prisma";

/** Backed by User.isAdmin — managed from within /admin itself, see src/app/admin/actions.ts. */
export async function isAdminUser(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { isAdmin: true } });
  return Boolean(user?.isAdmin);
}
