type SectionNavProps = {
  categories: string[];
  currentCategory: string;
  completedCategories: Set<string>;
  onSelectCategory: (category: string) => void;
};

/** TurboTax-style section table of contents. Mode-agnostic: driven entirely by the `category` values on the seeded questions. */
export function SectionNav({
  categories,
  currentCategory,
  completedCategories,
  onSelectCategory,
}: SectionNavProps) {
  return (
    <nav aria-label="Survey sections" className="flex flex-col gap-1">
      {categories.map((category) => {
        const isCurrent = category === currentCategory;
        const isComplete = completedCategories.has(category);
        return (
          <button
            key={category}
            type="button"
            onClick={() => onSelectCategory(category)}
            className={`flex items-center justify-between rounded-md px-3 py-2 text-left text-sm ${
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
    </nav>
  );
}
