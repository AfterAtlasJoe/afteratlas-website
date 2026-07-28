"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { SurveyMode } from "@/generated/prisma/client";

type NewSurveyFormProps = {
  eventTypeId: string;
  eventTypeName: string;
  mode: SurveyMode;
};

/** Shown before a brand-new survey/plan starts, so the user can name it (e.g. "Mom's checklist"). */
export function NewSurveyForm({
  eventTypeId,
  eventTypeName,
  mode,
}: NewSurveyFormProps) {
  const router = useRouter();
  const [title, setTitle] = useState(eventTypeName);
  const [zipCode, setZipCode] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);

    const response = await fetch("/api/survey-responses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventTypeId,
        mode,
        title: title.trim() || eventTypeName,
        zipCode: zipCode.trim(),
      }),
    });

    if (!response.ok) {
      setSubmitting(false);
      return;
    }

    router.refresh();
  }

  return (
    <div className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-12">
      <div>
        <h1 className="text-2xl font-semibold">{eventTypeName}</h1>
        <p className="text-sm text-zinc-500">
          Give this a name so you can find it later on your dashboard.
        </p>
      </div>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Name
          <input
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            className="rounded-md border border-black/10 px-3 py-2 dark:border-white/10 dark:bg-transparent"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Zip code
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]{5}"
            maxLength={5}
            value={zipCode}
            onChange={(event) => setZipCode(event.target.value)}
            required
            placeholder="98101"
            className="rounded-md border border-black/10 px-3 py-2 dark:border-white/10 dark:bg-transparent"
          />
          <span className="text-xs text-zinc-500">
            Used to find local services nearby if needed (funeral homes,
            probate lawyers, etc.)
          </span>
        </label>
        <button
          type="submit"
          disabled={submitting}
          className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
        >
          {submitting ? "Starting…" : "Continue"}
        </button>
      </form>
    </div>
  );
}
