"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";

import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { DISCLAIMER_TEXT } from "@/lib/disclaimer-text";

export function RegisterForm({ callbackUrl }: { callbackUrl: string }) {
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const email = formData.get("email");
    const password = formData.get("password");
    const name = formData.get("name");
    const disclaimerAccepted = formData.get("disclaimerAccepted") === "on";

    const response = await fetch("/api/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, name, disclaimerAccepted }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong.");
      setSubmitting(false);
      return;
    }

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });
    setSubmitting(false);
    if (result?.error) {
      setError("Account created, but log in failed. Try logging in manually.");
      return;
    }
    window.location.href = callbackUrl;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        Name
        <input
          type="text"
          name="name"
          className="rounded-md border border-black/10 px-3 py-2 dark:border-white/10 dark:bg-transparent"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Email
        <input
          type="email"
          name="email"
          required
          className="rounded-md border border-black/10 px-3 py-2 dark:border-white/10 dark:bg-transparent"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Password
        <input
          type="password"
          name="password"
          required
          minLength={8}
          className="rounded-md border border-black/10 px-3 py-2 dark:border-white/10 dark:bg-transparent"
        />
      </label>
      <div className="flex max-h-32 flex-col gap-2 overflow-y-auto whitespace-pre-line rounded-md border border-black/10 p-3 text-xs text-zinc-600 dark:border-white/10 dark:text-zinc-400">
        {DISCLAIMER_TEXT}
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="disclaimerAccepted" required className="mt-1" />
        I understand and agree.
      </label>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button
        type="submit"
        disabled={submitting}
        className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {submitting ? "Creating account…" : "Sign up"}
      </button>

      <div className="flex items-center gap-3 text-xs text-zinc-500">
        <div className="h-px flex-1 bg-black/10 dark:bg-white/10" />
        or
        <div className="h-px flex-1 bg-black/10 dark:bg-white/10" />
      </div>
      <GoogleSignInButton callbackUrl={callbackUrl} />
    </form>
  );
}
