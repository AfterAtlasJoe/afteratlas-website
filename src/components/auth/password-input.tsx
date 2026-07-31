"use client";

import { useState } from "react";

/** A password field with a Show/Hide toggle, reused for both the password and confirm-password fields on the signup form. */
export function PasswordInput({
  name,
  required,
  minLength,
}: {
  name: string;
  required?: boolean;
  minLength?: number;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="flex items-center gap-2 rounded-md border border-black/10 pr-2 dark:border-white/10">
      <input
        type={visible ? "text" : "password"}
        name={name}
        required={required}
        minLength={minLength}
        className="min-w-0 flex-1 border-0 px-3 py-2 focus:outline-none dark:bg-transparent"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="shrink-0 text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
      >
        {visible ? "Hide" : "Show"}
      </button>
    </div>
  );
}
