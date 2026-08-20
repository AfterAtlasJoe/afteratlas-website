"use client";

import { useState } from "react";

import { deleteUser, resetUserPassword } from "./actions";

export function UserRowActions({ userId, email }: { userId: string; email: string }) {
  const [pending, setPending] = useState<"delete" | "reset" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleDelete() {
    if (!confirm(`Permanently delete ${email} and all their checklists? This can't be undone.`)) {
      return;
    }
    setPending("delete");
    setMessage(null);
    const result = await deleteUser(userId);
    setPending(null);
    if (result.error) {
      setMessage(result.error);
      return;
    }
    // The row removing itself from its own list doesn't reliably
    // reconcile via revalidatePath/router.refresh() — same issue as the
    // admin-management remove button.
    window.location.reload();
  }

  async function handleResetPassword() {
    if (!confirm(`Reset ${email}'s password and email them a temporary one?`)) {
      return;
    }
    setPending("reset");
    setMessage(null);
    const result = await resetUserPassword(userId);
    setPending(null);
    setMessage(result.error ?? result.message ?? null);
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleResetPassword}
          disabled={pending !== null}
          className="rounded-full border border-black/10 px-3 py-1 text-xs font-medium disabled:opacity-50 dark:border-white/10"
        >
          {pending === "reset" ? "Resetting…" : "Reset password"}
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={pending !== null}
          className="rounded-full border border-red-600/30 px-3 py-1 text-xs font-medium text-red-600 disabled:opacity-50"
        >
          {pending === "delete" ? "Deleting…" : "Delete"}
        </button>
      </div>
      {message ? <p className="max-w-[16rem] text-right text-xs text-zinc-500">{message}</p> : null}
    </div>
  );
}
