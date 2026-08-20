"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { PasswordInput } from "@/components/auth/password-input";

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    const password = formData.get("password");
    const confirmPassword = formData.get("confirmPassword");
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setSubmitting(false);
      return;
    }

    const response = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    setSubmitting(false);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      setError(body.error ?? "Something went wrong.");
      return;
    }
    setDone(true);
    setTimeout(() => router.push("/login"), 2000);
  }

  if (done) {
    return (
      <p className="rounded-lg border border-black/10 p-4 text-sm dark:border-white/10">
        Password updated — redirecting you to log in…
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        New password
        <PasswordInput name="password" required minLength={8} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Confirm new password
        <PasswordInput name="confirmPassword" required minLength={8} />
      </label>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      <button
        type="submit"
        disabled={submitting}
        className="self-start rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {submitting ? "Saving…" : "Set new password"}
      </button>
    </form>
  );
}
