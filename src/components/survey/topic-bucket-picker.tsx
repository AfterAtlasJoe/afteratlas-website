"use client";

import { useState } from "react";

export type TopicBucketData = {
  id: string;
  name: string;
  /** One-sentence summary of what's inside, always visible (not a hover tooltip) so it works the same on mobile. */
  description: string;
  categories: string[];
};

type TopicBucketPickerProps = {
  buckets: TopicBucketData[];
  disabled: boolean;
  onSubmit: (selectedCategories: string[]) => void;
};

/**
 * The topic_selection question's real UI: a handful of higher-level
 * buckets instead of the full flat list of categories, so the choice
 * doesn't feel like picking from 13 things at once. Chosen buckets flatten
 * to the category list the engine actually filters on
 * (SurveyResponse.selectedCategories) — the bucket itself isn't stored
 * anywhere past this screen.
 */
export function TopicBucketPicker({
  buckets,
  disabled,
  onSubmit,
}: TopicBucketPickerProps) {
  const [selectedBucketIds, setSelectedBucketIds] = useState<Set<string>>(
    new Set(),
  );

  function toggle(bucketId: string) {
    setSelectedBucketIds((prev) => {
      const next = new Set(prev);
      if (next.has(bucketId)) {
        next.delete(bucketId);
      } else {
        next.add(bucketId);
      }
      return next;
    });
  }

  const selectedCategories = buckets
    .filter((bucket) => selectedBucketIds.has(bucket.id))
    .flatMap((bucket) => bucket.categories);

  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-xl font-medium">
        Which areas would you like to cover?
      </h2>
      <p className="text-sm text-zinc-500">
        Pick as many as apply to your situation — you can move freely
        between them once you&apos;re in.
      </p>
      <div className="flex flex-col gap-3">
        {buckets.map((bucket) => (
          <label
            key={bucket.id}
            className="flex cursor-pointer items-start gap-3 rounded-lg border border-black/10 p-4 dark:border-white/10"
          >
            <input
              type="checkbox"
              checked={selectedBucketIds.has(bucket.id)}
              onChange={() => toggle(bucket.id)}
              disabled={disabled}
              className="mt-1"
            />
            <span className="flex flex-col gap-0.5">
              <span className="font-medium">{bucket.name}</span>
              <span className="text-xs text-zinc-500">{bucket.description}</span>
            </span>
          </label>
        ))}
      </div>
      <button
        type="button"
        disabled={disabled || selectedCategories.length === 0}
        onClick={() => onSubmit(selectedCategories)}
        className="self-start rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background disabled:opacity-50"
      >
        Continue
      </button>
    </div>
  );
}
