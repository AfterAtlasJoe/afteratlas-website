"use client";

import { useState } from "react";

import type { YelpBusiness } from "@/lib/yelp";

import { ChecklistItemRow } from "./checklist-item-row";

type ChecklistItemData = {
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

type ChecklistBodyProps = {
  responseId: string;
  groups: { category: string; items: ChecklistItemData[] }[];
  vendorResultsByCategoryId: Record<string, YelpBusiness[]>;
  totalCount: number;
  initialCompletedIds: string[];
};

/**
 * Owns the completed-items state as one client-side set shared across every
 * <ChecklistItemRow>, so the "N of M done" summary updates the instant a
 * box is checked instead of waiting for a page reload to recompute
 * server-side.
 */
export function ChecklistBody({
  responseId,
  groups,
  vendorResultsByCategoryId,
  totalCount,
  initialCompletedIds,
}: ChecklistBodyProps) {
  const [completedIds, setCompletedIds] = useState<Set<string>>(
    new Set(initialCompletedIds),
  );

  function handleToggle(itemId: string, completed: boolean) {
    setCompletedIds((prev) => {
      const next = new Set(prev);
      if (completed) {
        next.add(itemId);
      } else {
        next.delete(itemId);
      }
      return next;
    });
  }

  return (
    <>
      <p className="text-sm text-zinc-500">
        {completedIds.size} of {totalCount} task{totalCount === 1 ? "" : "s"} done.
      </p>
      {groups.map(({ category, items }) => (
        <section key={category} className="flex flex-col gap-4">
          <h2 className="text-lg font-medium">{category}</h2>
          {items.map((item) => (
            <ChecklistItemRow
              key={item.id}
              responseId={responseId}
              item={item}
              businesses={vendorResultsByCategoryId[item.vendorCategory?.id ?? ""] ?? []}
              completed={completedIds.has(item.id)}
              onToggle={handleToggle}
            />
          ))}
        </section>
      ))}
    </>
  );
}
