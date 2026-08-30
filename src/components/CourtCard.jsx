import { Trash2, Users } from "lucide-react";
import { getLevelClasses, getLevelLabel } from "../utils/playerLevel";

const statusStyles = {
  available: {
    badge: "bg-[var(--success-light)] text-[var(--success)]",
    dot: "bg-[var(--success)]",
    ring: "ring-[var(--success)]/20",
  },
  playing: {
    badge: "bg-[var(--primary-light)] text-[var(--primary)]",
    dot: "bg-[var(--primary)]",
    ring: "ring-[var(--primary)]/20",
  },
};

// Converts stored match values into readable labels.
function formatLabel(value) {
  if (value === "no_gender") return "No Gender";
  if (value === "mens") return "Men's";
  if (value === "womens") return "Women's";
  return value
    ? value.charAt(0).toUpperCase() + value.slice(1).replaceAll("_", " ")
    : "";
}

// Uses the Tournament's operator-facing division labels in compact card metadata.
function formatDivision(value) {
  const labels = {
    adult: "Adult",
    u17: "17 Under",
    u15: "15 Under",
    u13: "13 Under",
    u11: "11 Under",
    u9: "9 Under",
  };
  return labels[value] || formatLabel(value);
}

// Displays the court's current availability status.
function StatusBadge({ status }) {
  const style = statusStyles[status] ?? statusStyles.available;
  return (
    <span className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ${style.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
      {status}
    </span>
  );
}

// Displays one side of the active court match.
function Team({ team, accent = "primary", matchType }) {
  if (!team) return null;
  const hasMultiplePlayers = team.players.length > 1;
  const sideLabel = matchType === "singles"
    ? `Player ${team.teamNumber === 1 ? "A" : "B"}`
    : `Team ${team.teamNumber}`;

  return (
    <div className={`min-w-0 max-w-full rounded-xl p-2 ${
      accent === "primary"
        ? "bg-[var(--primary-light)]/40"
        : "bg-[var(--warning-light)]/40"
    }`}>
      <p className={`text-[10px] font-semibold uppercase tracking-wide mb-1.5 ${
        accent === "primary" ? "text-[var(--primary)]" : "text-[var(--warning)]"
      }`}>
        {sideLabel}
      </p>
      <div className="flex min-w-0 max-w-full flex-wrap gap-1.5">
        {team.players.map((player) => (
          <span
            key={player.id}
            title={`${player.name} · ${getLevelLabel(player.level)}`}
            className={`inline-flex min-w-0 max-w-full items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${
              hasMultiplePlayers ? "sm:max-w-[calc(50%-0.1875rem)]" : ""
            } ${getLevelClasses(player.level)}`}
          >
            <span className="truncate">{player.name}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// Displays one court and its active match, when present.
export default function CourtCard({
  court,
  onRemoveCourt,
}) {
  const isAvailable = court.status === "available";
  const activeMatch = court.activeMatch;
  const style = statusStyles[court.status] ?? statusStyles.available;
  const isTournamentMatch = activeMatch?.source === "tournament";
  const isRotationMatch = activeMatch?.source === "rotation";

  return (
    <div className={`group relative min-w-0 max-w-full rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 ring-1 ${style.ring} transition-shadow hover:shadow-md`}>
      {/* Court name, status, and removal action */}
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-1.5">
          <h3 className="truncate text-lg font-bold leading-tight text-[var(--text-h)]" title={court.name}>
            {court.name}
          </h3>
          <span className='capitalize'><StatusBadge status={court.status}/></span>
        </div>

        <button
          type="button"
          onClick={() => onRemoveCourt?.(court.id)}
          aria-label="Remove court"
          className="shrink-0 rounded-lg p-2 text-[var(--text)] opacity-0 transition hover:bg-red-500/10 hover:text-red-500 focus-visible:opacity-100 group-hover:opacity-100"
        >
          <Trash2 size={16} />
        </button>
      </div>
      {/* Active match or available-court state */}
      <div className="min-w-0">
        {activeMatch ? (
          <div className="space-y-3">
            <div className="min-w-0">
              <p className="flex min-w-0 items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--text-h)]">
                <Users size={12} />
                {isTournamentMatch
                  ? `Tournament - Round ${activeMatch.roundNumber}`
                  : isRotationMatch
                    ? "Rotation Match"
                    : "Legacy Normal Match"}
              </p>
              {isTournamentMatch && (
                <p className="mt-1 truncate text-xs font-semibold text-[var(--text-h)]" title={activeMatch.tournamentName}>
                  {activeMatch.tournamentName}
                </p>
              )}
              <div className="mt-1 flex flex-wrap gap-1.5 text-xs text-[var(--text)]">
                {isTournamentMatch && activeMatch.division && (
                  <span className="rounded-md bg-[var(--surface-hover)] px-2 py-1">
                    {formatDivision(activeMatch.division)}
                  </span>
                )}
                {(isTournamentMatch || isRotationMatch) && activeMatch.category && (
                  <span className="rounded-md bg-[var(--surface-hover)] px-2 py-1">
                    {formatLabel(activeMatch.category)}
                  </span>
                )}
                <span className="rounded-md bg-[var(--surface-hover)] px-2 py-1">
                  {formatLabel(activeMatch.matchType)}
                </span>
                {isTournamentMatch && activeMatch.division === "adult" && activeMatch.level && activeMatch.level !== "all" && (
                  <span className="rounded-md bg-[var(--surface-hover)] px-2 py-1">
                    {formatLabel(activeMatch.level)}
                  </span>
                )}
                {isTournamentMatch && activeMatch.groupName && (
                  <span className="rounded-md bg-[var(--surface-hover)] px-2 py-1">
                    {activeMatch.groupName}
                  </span>
                )}
              </div>
            </div>

            <Team team={activeMatch.teamA} accent="primary" matchType={activeMatch.matchType} />
            <p className="text-center text-[10px] font-bold text-[var(--text)]/50">VS</p>
            <Team team={activeMatch.teamB} accent="warning" matchType={activeMatch.matchType} />
          </div>
        ) : (
          <div className="flex min-h-[7rem] items-center justify-center py-4 text-sm italic text-[var(--text)]/60">
            No players assigned
          </div>
        )}
      </div>

      {!isAvailable && isTournamentMatch && (
        <div className="border-t border-[var(--border)] pt-3 text-left text-xs leading-relaxed text-[var(--text)]">
          Select the winner from the Tournament page to finish this match.
        </div>
      )}

      {!isAvailable && isRotationMatch && (
        <div className="border-t border-[var(--border)] pt-3 text-left text-xs leading-relaxed text-[var(--text)]">
          Select the winner from the Rotation Queue page to finish this match.
        </div>
      )}

      {!isAvailable && activeMatch?.source === "normal" && (
        <div className="border-t border-[var(--border)] pt-3 text-left text-xs leading-relaxed text-[var(--text)]">
          This is a legacy normal match record.
        </div>
      )}
    </div>
  );
}
