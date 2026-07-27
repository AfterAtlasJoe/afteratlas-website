"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type SurveyResponseCardProps = {
  id: string;
  title: string;
  subtitle: string;
  createdAt: string;
  href: string;
  actionLabel: string;
};

export function SurveyResponseCard({
  id,
  title,
  subtitle,
  createdAt,
  href,
  actionLabel,
}: SurveyResponseCardProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [titleValue, setTitleValue] = useState(title);
  const [busy, setBusy] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function saveTitle() {
    const trimmed = titleValue.trim();
    if (!trimmed || trimmed === title) {
      setTitleValue(title);
      setEditing(false);
      return;
    }
    setBusy(true);
    const response = await fetch(`/api/survey-responses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: trimmed }),
    });
    setBusy(false);
    setEditing(false);
    if (response.ok) {
      router.refresh();
    } else {
      setTitleValue(title);
    }
  }

  async function handleDelete() {
    if (!window.confirm(`Delete "${title}"? This can't be undone.`)) {
      return;
    }
    setBusy(true);
    setDeleteError(null);
    try {
      const response = await fetch(`/api/survey-responses/${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        router.refresh();
      } else {
        setBusy(false);
        setDeleteError("Something went wrong. Please try again.");
      }
    } catch {
      setBusy(false);
      setDeleteError("Something went wrong. Please try again.");
    }
  }

  return (
    <li className="flex items-center justify-between gap-4 rounded-lg border border-black/10 p-4 dark:border-white/10">
      <div className="min-w-0 flex-1">
        {editing ? (
          <input
            type="text"
            autoFocus
            value={titleValue}
            disabled={busy}
            onChange={(event) => setTitleValue(event.target.value)}
            onBlur={saveTitle}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
              if (event.key === "Escape") {
                setTitleValue(title);
                setEditing(false);
              }
            }}
            className="w-full rounded border border-black/20 px-2 py-1 font-medium dark:border-white/20 dark:bg-transparent"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="truncate text-left font-medium underline decoration-dotted"
            title="Click to rename"
          >
            {title}
          </button>
        )}
        <p className="text-xs text-zinc-500">
          {subtitle} &middot; {createdAt}
        </p>
        {deleteError ? (
          <p className="text-xs text-red-600">{deleteError}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-4">
        <Link href={href} className="text-sm underline">
          {actionLabel}
        </Link>
        <button
          type="button"
          onClick={handleDelete}
          disabled={busy}
          className="text-sm text-red-600 underline disabled:opacity-50"
        >
          Delete
        </button>
      </div>
    </li>
  );
}
