"use client";

import { useState } from "react";

export function ForgotPasswordForm() {
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);

    const formData = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: formData.get("email") }),
    });
    const body = await response.json().catch(() => ({}));
    setSubmitting(false);
    setMessage(body.message ?? "If an account exists for that email, a reset link is on its way.");
  }

  if (message) {
    return (
      <p className="rounded-lg border border-black/10 p-4 text-sm dark:border-white/10">
        {message}
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        Email
        <input
          type="email"
          name="email"
          required
          className="rounded-md border border-black/10 px-3 py-2 dark:border-white/10 dark:bg-transparent"
        />
      </label>
      <button
        type="submit"
        disabled={submitting}
        className="self-start rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {submitting ? "Sending…" : "Send reset link"}
      </button>
    </form>
  );
}
