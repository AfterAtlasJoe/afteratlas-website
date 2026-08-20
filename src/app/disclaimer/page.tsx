import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { DISCLAIMER_TEXT } from "@/lib/disclaimer";
import { prisma } from "@/lib/prisma";
import { DisclaimerAcceptForm } from "@/components/auth/disclaimer-accept-form";

/**
 * Shown at the start of every checklist (see SurveyPage's `!response`
 * branch) — the full "must agree" version the first time a user creates a
 * checklist, and a lighter "As a reminder…" version every time after,
 * decided here by whether `disclaimerAcceptedAt` is already set.
 */
export default async function DisclaimerPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const session = await auth();
  const { callbackUrl } = await searchParams;
  if (!session?.user?.id) {
    redirect(
      `/login?callbackUrl=${encodeURIComponent(`/disclaimer${callbackUrl ? `?callbackUrl=${encodeURIComponent(callbackUrl)}` : ""}`)}`,
    );
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { disclaimerAcceptedAt: true },
  });
  const alreadyAccepted = Boolean(user?.disclaimerAcceptedAt);

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold">
        {alreadyAccepted ? "As a reminder…" : "Before you continue"}
      </h1>
      <div className="flex flex-col gap-3 whitespace-pre-line rounded-lg border border-black/10 p-4 text-sm text-zinc-600 dark:border-white/10 dark:text-zinc-400">
        {DISCLAIMER_TEXT}
      </div>
      <DisclaimerAcceptForm
        callbackUrl={callbackUrl ?? "/dashboard"}
        alreadyAccepted={alreadyAccepted}
      />
    </div>
  );
}
