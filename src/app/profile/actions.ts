"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export type ProfileActionState = { error?: string; saved?: boolean };

export async function updateNotificationPreferences(
  _prevState: ProfileActionState,
  formData: FormData,
): Promise<ProfileActionState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "You must be signed in." };
  }

  const receiveChecklistEmail = formData.get("receiveChecklistEmail") === "on";
  const adminDigestFrequencyInput = formData.get("adminDigestFrequency");

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { isAdmin: true },
  });

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      receiveChecklistEmail,
      // Only admins can meaningfully set this — silently ignore the field
      // for everyone else rather than trusting an arbitrary submitted value.
      ...(user?.isAdmin && typeof adminDigestFrequencyInput === "string"
        ? {
            adminDigestFrequency: adminDigestFrequencyInput as
              | "off"
              | "instant"
              | "daily"
              | "weekly"
              | "monthly",
          }
        : {}),
    },
  });

  revalidatePath("/profile");
  return { saved: true };
}
