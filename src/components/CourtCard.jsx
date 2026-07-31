import { Trash2, Users } from "lucide-react";

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

function StatusBadge({ status }) {
  const style = statusStyles[status] ?? statusStyles.available;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${style.badge}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
      {status}
    </span>
  );
}

export default function CourtCard({ court, requeuePlayers = true, onEndMatch, onRemoveCourt }) {
  const isAvailable = court.status === "available";
  const players = court.players ?? [];
  const style = statusStyles[court.status] ?? statusStyles.available;

  return (
    <div
      className={`
        group relative bg-[var(--surface)] rounded-2xl border border-[var(--border)]
        p-5 flex flex-col gap-4 ring-1 ${style.ring}
        transition-shadow hover:shadow-md
      `}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-1.5">
          <h3 className="text-lg font-bold text-[var(--text-h)] leading-tight">
            {court.name}
          </h3>
          <StatusBadge status={court.status} />
        </div>

        <button
          onClick={() => onRemoveCourt?.(court.id)}
          aria-label="Remove court"
          className="
            p-2 rounded-lg text-[var(--text)] opacity-0 group-hover:opacity-100
            hover:bg-red-500/10 hover:text-red-500 transition
          "
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* Players */}
      <div className="flex-1">
        {players.length > 0 ? (
          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-xs font-medium text-[var(--text)] uppercase tracking-wide">
              <Users size={12} />
              Players
            </p>
            <div className="flex flex-col flex-wrap gap-2">
              {players.map((player, index) => (
                <span
                  key={index}
                  className="inline-flex items-center gap-2 pl-1.5 pr-3 py-1 bg-[var(--surface-hover)] rounded-full text-sm"
                >
                  <span className="w-6 h-6 rounded-full bg-[var(--primary)] text-white flex items-center justify-center text-[11px] font-semibold">
                    {player.charAt(0).toUpperCase()}
                  </span>
                  {player}
                </span>
              ))}
            </div>
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-sm text-[var(--text)]/60 italic py-4">
            No players assigned
          </div>
        )}
      </div>

{/* Action */}
      {!isAvailable && (
        <div className="pt-3 border-t border-[var(--border)]">
          <button
            onClick={() => onEndMatch?.(court.id, requeuePlayers)}
            className="w-full py-2 rounded-xl bg-red-400 hover:bg-red-500 text-white text-sm font-semibold transition-colors"
          >
            End Match
          </button>
        </div>
      )}
    </div>
  );
}