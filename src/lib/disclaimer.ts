import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";

export { DISCLAIMER_TEXT } from "@/lib/disclaimer-text";

/**
 * Gate for every protected page (dashboard, survey/plan, checklist, gaps)
 * — redirects to /disclaimer if this user hasn't accepted it yet, e.g. an
 * account created before this existed (new accounts accept it as part of
 * registration). Call right after the existing `auth()` session check.
 */
export async function requireDisclaimerAccepted(
  userId: string,
  callbackPath: string,
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { disclaimerAcceptedAt: true },
  });
  if (!user?.disclaimerAcceptedAt) {
    redirect(`/disclaimer?callbackUrl=${encodeURIComponent(callbackPath)}`);
  }
}
