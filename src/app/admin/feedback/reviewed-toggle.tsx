"use client";

import { useTransition } from "react";

import { setFeedbackReviewed } from "./actions";

export function ReviewedToggle({ id, reviewed }: { id: string; reviewed: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => setFeedbackReviewed(id, !reviewed))}
      className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium disabled:opacity-50 ${
        reviewed
          ? "border-black/10 text-zinc-500 dark:border-white/10"
          : "border-accent bg-accent-light text-accent-ink"
      }`}
    >
      {reviewed ? "Reviewed" : "Mark reviewed"}
    </button>
  );
}
