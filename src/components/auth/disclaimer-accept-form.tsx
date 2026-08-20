"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Marks the redirect back to `callbackUrl` as having just come from the disclaimer, so the checklist-start gate there doesn't bounce straight back and loop. */
function withAck(callbackUrl: string): string {
  const separator = callbackUrl.includes("?") ? "&" : "?";
  return `${callbackUrl}${separator}disclaimerAck=1`;
}

export function DisclaimerAcceptForm({
  callbackUrl,
  alreadyAccepted,
}: {
  callbackUrl: string;
  /** Repeat visits ("As a reminder…") don't need to persist acceptance again — just acknowledge and continue. */
  alreadyAccepted: boolean;
}) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleContinue() {
    if (alreadyAccepted) {
      router.push(withAck(callbackUrl));
      return;
    }

    if (submitting) return;
    setSubmitting(true);
    setError(null);
    const response = await fetch("/api/disclaimer/accept", { method: "POST" });
    if (!response.ok) {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
      return;
    }
    router.push(withAck(callbackUrl));
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button
        type="button"
        onClick={handleContinue}
        disabled={submitting}
        className="self-start rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {submitting
          ? "Continuing…"
          : alreadyAccepted
            ? "Continue"
            : "I understand and agree"}
      </button>
    </div>
  );
}
