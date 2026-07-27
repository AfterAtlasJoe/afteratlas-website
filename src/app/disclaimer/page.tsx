import { redirect } from "next/navigation";

import { auth } from "@/auth";
import { DISCLAIMER_TEXT } from "@/lib/disclaimer";
import { DisclaimerAcceptForm } from "@/components/auth/disclaimer-accept-form";

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

  return (
    <div className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold">Before you continue</h1>
      <div className="flex flex-col gap-3 whitespace-pre-line rounded-lg border border-black/10 p-4 text-sm text-zinc-600 dark:border-white/10 dark:text-zinc-400">
        {DISCLAIMER_TEXT}
      </div>
      <DisclaimerAcceptForm callbackUrl={callbackUrl ?? "/dashboard"} />
    </div>
  );
}
