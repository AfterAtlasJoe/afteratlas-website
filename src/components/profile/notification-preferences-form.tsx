"use client";

import { useActionState } from "react";

import {
  updateNotificationPreferences,
  type ProfileActionState,
} from "@/app/profile/actions";

const DIGEST_OPTIONS = [
  { value: "off", label: "Off" },
  { value: "instant", label: "Instantly, per signup" },
  { value: "daily", label: "Daily digest" },
  { value: "weekly", label: "Weekly digest" },
  { value: "monthly", label: "Monthly digest" },
];

export function NotificationPreferencesForm({
  receiveChecklistEmail,
  isAdmin,
  adminDigestFrequency,
}: {
  receiveChecklistEmail: boolean;
  isAdmin: boolean;
  adminDigestFrequency: string;
}) {
  const [state, formAction, pending] = useActionState<ProfileActionState, FormData>(
    updateNotificationPreferences,
    {},
  );

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          name="receiveChecklistEmail"
          defaultChecked={receiveChecklistEmail}
          className="mt-1"
        />
        Email me a copy of my checklist when I complete a survey
      </label>

      {isAdmin ? (
        <label className="flex flex-col gap-1 text-sm">
          New user signup alerts (admin)
          <select
            name="adminDigestFrequency"
            defaultValue={adminDigestFrequency}
            className="rounded-md border border-black/10 px-3 py-2 dark:border-white/10 dark:bg-transparent"
          >
            {DIGEST_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}

      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {state.saved ? <p className="text-sm text-green-700">Saved.</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="self-start rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
