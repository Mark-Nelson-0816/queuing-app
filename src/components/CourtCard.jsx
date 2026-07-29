export default function CourtCard({ court, onEndMatch }) {
  const isAvailable = court.status === "Available";

  return (
    <div
      className={`bg-[var(--surface)] rounded-2xl border-2 p-5 transition-all duration-200 hover:shadow-[var(--shadow)] ${
        isAvailable
          ? "border-[var(--success)]/30 hover:border-[var(--success)]/60"
          : "border-[var(--primary)]/30 hover:border-[var(--primary)]/60"
      }`}
    >
      {/* Court Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-[var(--text-h)]">Court {court.number}</h3>
        <span
          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
            isAvailable
              ? "bg-[var(--success-light)] text-[var(--success)]"
              : "bg-[var(--primary-light)] text-[var(--primary)]"
          }`}
        >
          <span className={`w-2 h-2 rounded-full ${isAvailable ? "bg-[var(--success)]" : "bg-[var(--primary)]"}`} />
          {court.status}
        </span>
      </div>

      {/* Current Players */}
      {court.players && court.players.length > 0 ? (
        <div className="space-y-2 mb-4">
          <p className="text-xs font-medium text-[var(--text)] uppercase tracking-wider">Players</p>
          <div className="flex flex-wrap gap-2">
            {court.players.map((player, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--surface-hover)] rounded-lg text-sm text-[var(--text-h)]"
              >
                <span className="w-6 h-6 rounded-full bg-[var(--primary)] text-white text-xs flex items-center justify-center font-medium">
                  {player.charAt(0)}
                </span>
                {player}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="mb-4 py-3 text-center text-sm text-[var(--text)]">No players assigned</div>
      )}

      {/* Match Timer Placeholder */}
      {!isAvailable && (
        <div className="flex items-center gap-2 mb-4 p-3 bg-[var(--surface-hover)] rounded-xl">
          <div>
            <p className="text-xs font-medium text-[var(--text)]">Match Time</p>
            <p className="text-lg font-bold text-[var(--text-h)] font-mono">00:00</p>
          </div>
        </div>
      )}

      {/* End Match Button */}
      {!isAvailable && (
        <button
          onClick={() => onEndMatch?.(court.id)}
          className="w-full py-2 px-4 rounded-xl bg-[var(--danger)] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          End Match
        </button>
      )}

      {isAvailable && (
        <button
          className="w-full py-2 px-4 rounded-xl bg-[var(--primary)] text-white text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          Assign Players
        </button>
      )}
    </div>
  );
}

