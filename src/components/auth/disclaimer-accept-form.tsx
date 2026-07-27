"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DisclaimerAcceptForm({ callbackUrl }: { callbackUrl: string }) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAccept() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    const response = await fetch("/api/disclaimer/accept", { method: "POST" });
    if (!response.ok) {
      setError("Something went wrong. Please try again.");
      setSubmitting(false);
      return;
    }
    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button
        type="button"
        onClick={handleAccept}
        disabled={submitting}
        className="self-start rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {submitting ? "Continuing…" : "I understand and agree"}
      </button>
    </div>
  );
}
