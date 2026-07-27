import { LinkedText } from "./linked-text";

export type TriggeredItemPreview = {
  id: string;
  title: string;
  description: string;
  relatedLinks: string[];
};

type TriggeredItemsSummaryProps = {
  items: TriggeredItemPreview[];
  onContinue: () => void;
};

/**
 * Shown after a multiselect_group batch triggers one or more ChecklistItems
 * that don't otherwise get their own "info" screen (e.g. checking a
 * less-common item like "mineral rights"). Gives the user the overview and
 * link right away rather than letting it pass by unseen until the final
 * checklist.
 */
export function TriggeredItemsSummary({
  items,
  onContinue,
}: TriggeredItemsSummaryProps) {
  return (
    <div className="flex flex-col gap-6">
      <h2 className="text-xl font-medium">A few things to note</h2>
      <p className="text-sm text-zinc-500">
        Based on what you flagged, we&apos;ve added these to your checklist:
      </p>
      <ul className="flex flex-col gap-4">
        {items.map((item) => (
          <li
            key={item.id}
            className="rounded-lg border border-black/10 p-4 dark:border-white/10"
          >
            <h3 className="font-medium">{item.title}</h3>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              <LinkedText text={item.description} />
            </p>
            {item.relatedLinks.length > 0 ? (
              <ul className="mt-2 flex flex-col gap-1 text-sm">
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
          </li>
        ))}
      </ul>
      <button
        type="button"
        onClick={onContinue}
        className="self-start rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background"
      >
        Continue
      </button>
    </div>
  );
}
