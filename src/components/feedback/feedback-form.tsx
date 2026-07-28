"use client";

import { useState } from "react";

export function FeedbackForm({
  isSignedIn,
  surveyResponseId,
  page,
}: {
  isSignedIn: boolean;
  surveyResponseId?: string;
  page?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const response = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: formData.get("message"),
        email: formData.get("email"),
        surveyResponseId,
        page,
      }),
    });

    setSubmitting(false);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong. Please try again.");
      return;
    }
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <p className="rounded-lg border border-black/10 p-4 text-sm dark:border-white/10">
        Thanks — your feedback has been sent.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        Your feedback
        <textarea
          name="message"
          required
          rows={6}
          maxLength={5000}
          placeholder="What's working, what's confusing, what would help..."
          className="rounded-md border border-black/10 px-3 py-2 dark:border-white/10 dark:bg-transparent"
        />
      </label>
      {!isSignedIn ? (
        <label className="flex flex-col gap-1 text-sm">
          Email (optional, if you&apos;d like a reply)
          <input
            type="email"
            name="email"
            className="rounded-md border border-black/10 px-3 py-2 dark:border-white/10 dark:bg-transparent"
          />
        </label>
      ) : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button
        type="submit"
        disabled={submitting}
        className="self-start rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {submitting ? "Sending…" : "Send feedback"}
      </button>
    </form>
  );
}
