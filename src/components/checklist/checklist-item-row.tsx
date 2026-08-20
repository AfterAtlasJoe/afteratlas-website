"use client";

import { useState } from "react";

import { VendorRecommendations } from "@/components/vendors/vendor-recommendations";
import { articleFor } from "@/lib/grammar";
import type { YelpBusiness } from "@/lib/yelp";

type ChecklistItemRowProps = {
  responseId: string;
  item: {
    id: string;
    title: string;
    description: string;
    relatedLinks: string[];
    vendorCategory: {
      id: string;
      name: string;
      singularName: string;
      yelpSearchTerm: string;
    } | null;
  };
  businesses: YelpBusiness[];
  /** Getting Started items are relevant context, not to-dos — shown without a checkbox and never counted. */
  checkable: boolean;
  completed: boolean;
  onToggle: (itemId: string, completed: boolean) => void;
};

/** One checklist task, with a "mark as done" checkbox that crosses it off. Completion is a manual to-do state, independent of whether the item stays triggered. Controlled by the parent (<ChecklistBody>) so the "N of M done" summary stays in sync. */
export function ChecklistItemRow({
  responseId,
  item,
  businesses,
  checkable,
  completed,
  onToggle,
}: ChecklistItemRowProps) {
  const [pending, setPending] = useState(false);

  async function toggle() {
    if (pending) return;
    setPending(true);
    const next = !completed;
    onToggle(item.id, next);
    try {
      const response = await fetch(`/api/survey-responses/${responseId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toggleChecklistItemId: item.id }),
      });
      if (!response.ok) {
        onToggle(item.id, completed);
      }
    } catch {
      onToggle(item.id, completed);
    } finally {
      setPending(false);
    }
  }

  const content = (
    <span className="flex flex-col gap-2">
      <h3 className={`font-medium ${checkable && completed ? "line-through" : ""}`}>
        {item.title}
      </h3>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">{item.description}</p>
      {item.relatedLinks.length > 0 ? (
        <ul className="flex flex-col gap-1 text-sm">
          {item.relatedLinks.map((url) => (
            <li key={url}>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                {url}
              </a>
            </li>
          ))}
        </ul>
      ) : null}
      {item.vendorCategory ? (
        <div className="mt-2 rounded-md bg-black/5 p-3 text-sm dark:bg-white/10">
          <p className="mb-2 font-medium">
            Need {articleFor(item.vendorCategory.singularName)}{" "}
            {item.vendorCategory.singularName}?
          </p>
          <VendorRecommendations
            categoryName={item.vendorCategory.name}
            searchTerm={item.vendorCategory.yelpSearchTerm}
            businesses={businesses}
          />
        </div>
      ) : null}
    </span>
  );

  return (
    <div
      className={`flex flex-col gap-2 rounded-lg border border-black/10 p-4 dark:border-white/10 ${
        checkable && completed ? "opacity-50" : ""
      }`}
    >
      {checkable ? (
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={completed}
            onChange={toggle}
            disabled={pending}
            className="mt-1"
          />
          {content}
        </label>
      ) : (
        content
      )}
    </div>
  );
}
