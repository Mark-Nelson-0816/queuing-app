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

function formatLabel(value) {
  if (value === "no_gender") return "No Gender";
  if (value === "mens") return "Men's";
  if (value === "womens") return "Women's";
  return value
    ? value.charAt(0).toUpperCase() + value.slice(1).replaceAll("_", " ")
    : "";
}

function StatusBadge({ status }) {
  const style = statusStyles[status] ?? statusStyles.available;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${style.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
      {status}
    </span>
  );
}

function Team({ team, accent = "primary" }) {
  if (!team) return null;

  return (
    <div className={`rounded-xl p-2 ${
      accent === "primary"
        ? "bg-[var(--primary-light)]/40"
        : "bg-[var(--warning-light)]/40"
    }`}>
      <p className={`text-[10px] font-semibold uppercase tracking-wide mb-1.5 ${
        accent === "primary" ? "text-[var(--primary)]" : "text-[var(--warning)]"
      }`}>
        Team {team.teamNumber}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {team.players.map((player) => (
          <span
            key={player.id}
            title={getLevelLabel(player.level)}
            className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getLevelClasses(player.level)}`}
          >
            {player.name}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function CourtCard({
  court,
  requeuePlayers = true,
  onEndMatch,
  onRemoveCourt,
}) {
  const isAvailable = court.status === "available";
  const activeMatch = court.activeMatch;
  const style = statusStyles[court.status] ?? statusStyles.available;
  const isTournamentMatch = activeMatch?.source === "tournament";

  return (
    <div className={`group relative bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-5 flex flex-col gap-4 ring-1 ${style.ring} transition-shadow hover:shadow-md`}>
      <div className="flex items-start justify-between">
        <div className="space-y-1.5">
          <h3 className="text-lg font-bold text-[var(--text-h)] leading-tight">
            {court.name}
          </h3>
          <StatusBadge status={court.status} />
        </div>

        <button
          type="button"
          onClick={() => onRemoveCourt?.(court.id)}
          aria-label="Remove court"
          className="p-2 rounded-lg text-[var(--text)] opacity-0 group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-500 transition"
        >
          <Trash2 size={16} />
        </button>
      </div>

      <div className="flex-1">
        {activeMatch ? (
          <div className="space-y-3">
            <div>
              <p className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-h)] uppercase tracking-wide">
                <Users size={12} />
                {isTournamentMatch
                  ? `Tournament - Round ${activeMatch.roundNumber}`
                  : "Normal Match"}
              </p>
              <p className="text-xs text-[var(--text)] mt-1">
                {isTournamentMatch && `${formatLabel(activeMatch.category)} `}
                {formatLabel(activeMatch.matchType)}
              </p>
            </div>

            <Team team={activeMatch.teamA} accent="primary" />
            <p className="text-center text-[10px] font-bold text-[var(--text)]/50">VS</p>
            <Team team={activeMatch.teamB} accent="warning" />
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-sm text-[var(--text)]/60 italic py-4">
            No players assigned
          </div>
        )}
      </div>

      {!isAvailable && activeMatch?.source === "normal" && (
        <div className="pt-3 border-t border-[var(--border)]">
          <button
            type="button"
            onClick={() => onEndMatch?.(court.id, requeuePlayers)}
            className="w-full py-2 rounded-xl bg-red-400 hover:bg-red-500 text-white text-sm font-semibold transition-colors"
          >
            End Match
          </button>
        </div>
      )}

      {!isAvailable && isTournamentMatch && (
        <div className="pt-3 border-t border-[var(--border)] text-xs text-center text-[var(--text)]">
          Select the winner from the Tournament page to finish this match.
        </div>
      )}
    </div>
  );
}
