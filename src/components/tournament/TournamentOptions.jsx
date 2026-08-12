const DIVISION_LABELS = {
  adult: "Adult",
  u17: "17 Under",
  u15: "15 Under",
  u13: "13 Under",
  u11: "11 Under",
  u9: "9 Under",
};

const CATEGORY_LABELS = {
  mens: "Men's",
  womens: "Women's",
  mixed: "Mixed",
  no_gender: "No Gender",
};

const LEVEL_LABELS = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  upper_intermediate: "Upper Intermediate",
  advanced: "Advanced",
};

// Displays compact selectors for one exact Tournament configuration.
export default function TournamentOptions({
  division,
  matchType,
  category,
  level,
  options,
  existingConfiguration,
  disabled = false,
  onDivisionChange,
  onMatchTypeChange,
  onCategoryChange,
  onLevelChange,
}) {
  const categories = options.categoriesByMatchType?.[matchType] || [];

  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-h)]">
            Configuration
          </h2>
          <p className="mt-1 text-sm text-[var(--text)]">
            Choose one division, format, category, and exact player level.
          </p>
        </div>
        {existingConfiguration && (
          <span className="rounded-full bg-[var(--success-light)] px-3 py-1 text-xs font-semibold text-[var(--success)]">
            Already Generated
          </span>
        )}
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <label className="space-y-1.5 text-sm font-medium text-[var(--text-h)]">
          <span>Division</span>
          <select
            value={division}
            disabled={disabled}
            onChange={(event) => onDivisionChange(event.target.value)}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-60"
          >
            {options.divisions.map((value) => (
              <option key={value} value={value}>{DIVISION_LABELS[value] || value}</option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5 text-sm font-medium text-[var(--text-h)]">
          <span>Match Type</span>
          <select
            value={matchType}
            disabled={disabled}
            onChange={(event) => onMatchTypeChange(event.target.value)}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm capitalize disabled:cursor-not-allowed disabled:opacity-60"
          >
            {options.matchTypes.map((value) => (
              <option key={value} value={value} className="capitalize">{value}</option>
            ))}
          </select>
        </label>

        <label className="space-y-1.5 text-sm font-medium text-[var(--text-h)]">
          <span>Category</span>
          <select
            value={category}
            disabled={disabled}
            onChange={(event) => onCategoryChange(event.target.value)}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-60"
          >
            {options.categories.map((value) => (
              <option
                key={value}
                value={value}
                disabled={!categories.includes(value)}
              >
                {CATEGORY_LABELS[value] || value}
              </option>
            ))}
          </select>
          {matchType === "singles" && (
            <span className="block text-xs font-normal text-[var(--text)]">
              Mixed is available only for Doubles.
            </span>
          )}
        </label>

        <label className="space-y-1.5 text-sm font-medium text-[var(--text-h)]">
          <span>Level</span>
          <select
            value={level}
            disabled={disabled}
            onChange={(event) => onLevelChange(event.target.value)}
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-60"
          >
            {options.levels.map((value) => (
              <option key={value} value={value}>{LEVEL_LABELS[value] || value}</option>
            ))}
          </select>
        </label>
      </div>
    </section>
  );
}

export { CATEGORY_LABELS, DIVISION_LABELS, LEVEL_LABELS };
