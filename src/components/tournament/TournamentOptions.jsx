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
    <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-5 space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-[var(--text-h)]">
          Tournament Configuration
        </h2>
        <p className="text-sm text-[var(--text)] mt-1">
          Configure the tournament before selecting participants.
        </p>
      </div>

      <div>
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

      <div>
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

      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-hover)] p-3 text-sm text-[var(--text)] text-center">
        {category === "mens" && "Men vs Men."}
        {category === "womens" && "Women vs Women."}
        {category === "mixed" && "1 Man + 1 Woman vs 1 Man + 1 Woman."}
        {category === "no_gender" && "Any player combination is allowed."}
      </div>

      {generationDisabled && (
        <p className="text-sm text-center text-[var(--warning)]">
          Finish the current tournament before generating another one.
        </p>
      )}

      <button
        type="button"
        className="w-full py-3 rounded-xl bg-[var(--primary)] text-white font-semibold hover:bg-[var(--primary-hover)] transition disabled:opacity-50 disabled:cursor-not-allowed"
        onClick={onGenerate}
        disabled={generateDisabled}
      >
        {isGenerating ? "Generating..." : "Generate Matches"}
      </button>
    </div>
  );
}
