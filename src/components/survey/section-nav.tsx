type SectionNavGroup = {
  /** Bucket name shown as a header, or null for categories no bucket covers (the mandatory intro) — rendered without a header. */
  bucketName: string | null;
  categories: string[];
};

type SectionNavProps = {
  groups: SectionNavGroup[];
  currentCategory: string;
  completedCategories: Set<string>;
  onSelectCategory: (category: string) => void;
};

/** TurboTax-style section table of contents, grouped by topic-selection bucket (indented under a header) — mode-agnostic, driven entirely by the `category`/bucket data passed in. */
export function SectionNav({
  groups,
  currentCategory,
  completedCategories,
  onSelectCategory,
}: SectionNavProps) {
  return (
    <nav aria-label="Survey sections" className="flex flex-col gap-3">
      {groups.map((group, index) => (
        <div key={group.bucketName ?? `ungrouped-${index}`} className="flex flex-col gap-1">
          {group.bucketName ? (
            <p className="px-3 text-xs font-semibold uppercase tracking-wide text-zinc-400">
              {group.bucketName}
            </p>
          ) : null}
          {group.categories.map((category) => {
            const isCurrent = category === currentCategory;
            const isComplete = completedCategories.has(category);
            return (
              <button
                key={category}
                type="button"
                onClick={() => onSelectCategory(category)}
                className={`flex items-center justify-between rounded-md px-3 py-2 text-left text-sm ${
                  group.bucketName ? "ml-2" : ""
                } ${
                  isCurrent
                    ? "bg-foreground text-background"
                    : "hover:bg-black/5 dark:hover:bg-white/10"
                }`}
              >
                <span>{category}</span>
                {isComplete ? (
                  <span aria-label="completed" className="text-xs">
                    ✓
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
