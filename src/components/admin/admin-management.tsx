"use client";

import { useActionState, useTransition } from "react";

import type { addAdmin, AdminActionState, removeAdmin } from "@/app/admin/actions";

type AdminRow = { id: string; email: string };

export function AdminManagement({
  admins,
  currentUserId,
  addAdminAction,
  removeAdminAction,
}: {
  admins: AdminRow[];
  currentUserId: string;
  addAdminAction: typeof addAdmin;
  removeAdminAction: typeof removeAdmin;
}) {
  const [addState, addFormAction, addPending] = useActionState<AdminActionState, FormData>(
    addAdminAction,
    {},
  );

  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-medium">Admins</h2>
      <ul className="flex flex-col gap-2">
        {admins.map((admin) => (
          <li
            key={admin.id}
            className="flex items-center justify-between rounded-md border border-black/10 px-3 py-2 text-sm dark:border-white/10"
          >
            <span>
              {admin.email}
              {admin.id === currentUserId ? (
                <span className="ml-2 text-xs text-zinc-500">(you)</span>
              ) : null}
            </span>
            <RemoveAdminButton
              userId={admin.id}
              removeAdminAction={removeAdminAction}
              disabled={admins.length <= 1}
            />
          </li>
        ))}
      </ul>

      <form action={addFormAction} className="flex items-end gap-2">
        <label className="flex flex-col gap-1 text-sm">
          Add admin by email
          <input
            type="email"
            name="email"
            required
            placeholder="name@example.com"
            className="rounded-md border border-black/10 px-3 py-2 dark:border-white/10 dark:bg-transparent"
          />
        </label>
        <button
          type="submit"
          disabled={addPending}
          className="rounded-full bg-foreground px-4 py-2 text-sm font-medium text-background disabled:opacity-50"
        >
          {addPending ? "Adding…" : "Add"}
        </button>
      </form>
      {addState.error ? <p className="text-sm text-red-600">{addState.error}</p> : null}
      <p className="text-xs text-zinc-500">
        The email must already have an After Atlas account — this grants admin access to an
        existing user, it doesn&apos;t create one.
      </p>
    </div>
  );
}

/**
 * Deliberately not a `<form action>` — this row removes itself from the
 * list it lives in, and that self-removal doesn't reliably reconcile into
 * the DOM through the form-action same-response merge, nor through a
 * follow-up router.refresh(). A full reload (same as "Sign out" already
 * does elsewhere on this page) guarantees the list reflects the change.
 */
function RemoveAdminButton({
  userId,
  removeAdminAction,
  disabled,
}: {
  userId: string;
  removeAdminAction: typeof removeAdmin;
  disabled: boolean;
}) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={disabled || pending}
      onClick={() => {
        if (!window.confirm("Remove admin access for this user?")) return;
        startTransition(async () => {
          await removeAdminAction(userId);
          window.location.reload();
        });
      }}
      className="text-sm text-red-600 underline disabled:cursor-not-allowed disabled:opacity-50 disabled:no-underline"
      title={disabled ? "Can't remove the last remaining admin" : undefined}
    >
      {pending ? "Removing…" : "Remove"}
    </button>
  );
}
