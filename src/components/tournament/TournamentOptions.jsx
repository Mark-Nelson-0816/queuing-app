// Displays Tournament match settings and the generation action.
export default function TournamentOptions({
  matchType = "doubles",
  category = "no_gender",
  setMatchType,
  setCategory,
  onGenerate,
  isGenerating = false,
  generationDisabled = false,
}) {
  const generateDisabled = isGenerating || generationDisabled;

  return (
    <section className="self-start rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 xl:sticky xl:top-0">
      {/* Tournament configuration heading */}
      <div>
        <h2 className="text-lg font-semibold text-[var(--text-h)]">
          Tournament Configuration
        </h2>
      </div>

      {/* Match type options */}
      <div className="mt-6">
        <label className="block text-sm font-medium mb-2">
          Match Type
        </label>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setMatchType("singles");
              setCategory("no_gender");
            }}
            className={`rounded-xl border py-2 transition ${
              matchType === "singles"
                ? "bg-[var(--primary)] text-white border-[var(--primary)]"
                : "border-[var(--border)]"
            }`}
          >
            Singles
          </button>

          <button
            type="button"
            onClick={() => setMatchType("doubles")}
            className={`rounded-xl border py-2 transition ${
              matchType === "doubles"
                ? "bg-[var(--primary)] text-white border-[var(--primary)]"
                : "border-[var(--border)]"
            }`}
          >
            Doubles
          </button>
        </div>
      </div>

      {/* Category options */}
      <div className="mt-6">
        <label className="block text-sm font-medium mb-2">
          Category
        </label>

        <div className="space-y-2">
          <button
            type="button"
            onClick={() => setCategory("no_gender")}
            className={`w-full rounded-xl border py-2 ${
              category === "no_gender"
                ? "bg-[var(--primary)] text-white border-[var(--primary)]"
                : "border-[var(--border)]"
            }`}
          >
            No Gender
          </button>

          {matchType === "doubles" && (
            <button
              type="button"
              onClick={() => setCategory("mixed")}
              className={`w-full rounded-xl border py-2 ${
                category === "mixed"
                  ? "bg-[var(--primary)] text-white border-[var(--primary)]"
                  : "border-[var(--border)]"
              }`}
            >
              Mixed
            </button>
          )}

          <button
            type="button"
            onClick={() => setCategory("mens")}
            className={`w-full rounded-xl border py-2 ${
              category === "mens"
                ? "bg-[var(--primary)] text-white border-[var(--primary)]"
                : "border-[var(--border)]"
            }`}
          >
            Men&apos;s
          </button>

          <button
            type="button"
            onClick={() => setCategory("womens")}
            className={`w-full rounded-xl border py-2 ${
              category === "womens"
                ? "bg-[var(--primary)] text-white border-[var(--primary)]"
                : "border-[var(--border)]"
            }`}
          >
            Women&apos;s
          </button>
        </div>
      </div>

      {/* Current category rule */}
      <div className="mt-5 rounded-xl border border-[var(--primary)]/30 p-3 text-center text-sm text-[var(--text)]">
        {category === "mens" && "Men vs Men."}
        {category === "womens" && "Women vs Women."}
        {category === "mixed" && "1 Man + 1 Woman vs 1 Man + 1 Woman."}
        {category === "no_gender" && "Any player combination is allowed."}
      </div>

      {generationDisabled && (
        <p className="mt-4 text-center text-sm text-[var(--warning)]">
          Finish the current Tournament before generating another one.
        </p>
      )}

      {/* Generate Tournament action */}
      <button
        type="button"
        className="mt-4 w-full rounded-xl bg-[var(--primary)] py-3 font-semibold text-white transition hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
        onClick={onGenerate}
        disabled={generateDisabled}
      >
        {isGenerating ? "Generating..." : "Generate Matches"}
      </button>
    </section>
  );
}
