import { useEffect } from "react";
import { getLevelTextClasses } from "../utils/playerLevel";

const COURT_COLS = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
};

// Converts stored match values into public-facing labels.
function formatLabel(value) {
  if (value === "no_gender") return "No Gender";
  if (value === "mens") return "Men's";
  if (value === "womens") return "Women's";
  return value
    ? value.charAt(0).toUpperCase() + value.slice(1).replaceAll("_", " ")
    : "";
}

// Converts Tournament division codes into public-facing age labels.
function formatDivision(value) {
  if (value === "adult") return "Adult";
  if (String(value || "").startsWith("u")) return `${String(value).slice(1)} Under`;
  return formatLabel(value);
}

// Displays one team on an active public court card.
function PublicTeam({ team, dense, accent = "primary", matchType, side }) {
  const isPrimary = accent === "primary";
  const sideLabel = matchType === "singles"
    ? `Player ${side}`
    : `Team ${side}`;

  return (
    <div className={`rounded-xl ${dense ? "p-2" : "p-3"} ${
      isPrimary
        ? "bg-[var(--primary-light)]/35"
        : "bg-[var(--warning-light)]/35"
    }`}>
      <p className={`font-semibold text-center mb-1.5 ${dense ? "text-[10px]" : "text-xs"} ${
        isPrimary ? "text-[var(--primary)]" : "text-[var(--warning)]"
      }`}>
        {sideLabel}
      </p>
      <div className={`grid gap-2 ${team?.players.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
        {team?.players.map((player) => (
          <div
            key={player.id}
            className="bg-[var(--surface-hover)] rounded-lg px-2 py-2 text-center overflow-hidden"
          >
            <p className={`font-bold truncate ${dense ? "text-base" : "text-xl"} ${getLevelTextClasses(player.level)}`}>
              {player.name}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// Displays active courts and Rotation Queue matches that are next up.
export default function PublicDisplay({
  courts = [],
  queueNext = [],
  courtError = "",
}) {
  const activeCourts = courts.filter(
    (court) => court.status === "playing" && court.activeMatch,
  );
  const courtColCount = activeCourts.length <= 1
    ? 1
    : activeCourts.length <= 4
      ? 2
      : 3;
  const courtGridCols = COURT_COLS[courtColCount];
  const dense = activeCourts.length > 4;

  // Reload the public screen when Escape is pressed.
  useEffect(() => {
    // Handle the public-display Escape shortcut.
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        window.location.reload();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, []);

  return (
    <div className="h-screen overflow-hidden bg-[var(--bg)] text-[var(--text)] p-5 flex flex-col gap-4">
      {/* Public display heading and clock */}
      <div className="shrink-0 flex items-center justify-between border-b border-[var(--border)] pb-3">
        <h1 className="text-3xl font-bold text-[var(--text-h)]">
          Badminton Queue
        </h1>

        <div className="text-right">
          <p className="text-4xl font-bold font-mono text-[var(--text-h)]">
            {new Date().toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
          <p className="text-lg text-[var(--text)]">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
      </div>

      {/* Court loading error */}
      {courtError && (
        <div className="shrink-0 rounded-xl bg-[var(--danger-light)] text-[var(--danger)] px-4 py-2 text-center font-semibold">
          {courtError}
        </div>
      )}

      {/* Active courts and Next Up queue */}
      <div className="grid grid-cols-4 gap-4 flex-1 min-h-0">
        {/* Currently playing courts */}
        <div className="col-span-3 min-h-0 flex flex-col gap-3">
          <h2 className="shrink-0 text-xl font-semibold uppercase tracking-wide text-[var(--text-h)]">
            Currently Playing
          </h2>

          {activeCourts.length === 0 ? (
            <div className="flex-1 flex items-center justify-center rounded-2xl bg-[var(--surface)] border border-dashed border-[var(--border)]">
              <div className="text-center">
                <p className="text-xl text-[var(--text)]">No active matches</p>
                <p className="text-sm opacity-60">Waiting for players...</p>
              </div>
            </div>
          ) : (
            <div className={`flex-1 min-h-0 grid ${courtGridCols} auto-rows-fr gap-3`}>
              {activeCourts.map((court) => {
                const match = court.activeMatch;
                const isTournament = match.source === "tournament";
                const isRotation = match.source === "rotation";

                return (
                  <div
                    key={court.id}
                    className={`min-h-0 flex flex-col bg-[var(--surface)] rounded-2xl border border-[var(--border)] shadow-[var(--shadow)] ${dense ? "p-3" : "p-4"}`}
                  >
                    <div className={`shrink-0 flex items-center justify-between ${dense ? "mb-2" : "mb-3"}`}>
                      <h3 className={`font-bold text-[var(--text-h)] truncate ${dense ? "text-base" : "text-xl"}`}>
                        {court.name}
                      </h3>
                      <span className={`shrink-0 flex items-center gap-2 rounded-full bg-[var(--success-light)] text-[var(--success)] font-semibold ${dense ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm"}`}>
                        <span className="w-2 h-2 rounded-full bg-[var(--success)] animate-pulse" />
                        LIVE
                      </span>
                    </div>

                    <div className="text-center mb-3">
                      <p className={`font-bold text-[var(--text-h)] ${dense ? "text-xs" : "text-sm"}`}>
                        {isTournament
                          ? match.tournamentName
                          : isRotation
                            ? "Rotation Match"
                            : "Legacy Normal Match"}
                      </p>
                      <p className={`text-[var(--text)] ${dense ? "text-[10px]" : "text-xs"}`}>
                        {isTournament
                          ? [
                            formatDivision(match.division),
                            formatLabel(match.matchType),
                            formatLabel(match.category),
                            formatLabel(match.level),
                            match.groupName,
                            `Round ${match.roundNumber}`,
                          ].filter(Boolean).join(" · ")
                          : `${isRotation ? `${formatLabel(match.category)} ` : ""}${formatLabel(match.matchType)}`}
                      </p>
                    </div>

                    <div className="flex-1 min-h-0 flex flex-col justify-center gap-2">
                      <PublicTeam team={match.teamA} dense={dense} accent="primary" matchType={match.matchType} side="A" />
                      <p className={`text-center font-bold text-[var(--text)]/50 ${dense ? "text-xs" : "text-sm"}`}>
                        VS
                      </p>
                      <PublicTeam team={match.teamB} dense={dense} accent="warning" matchType={match.matchType} side="B" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Rotation Queue Next Up */}
        <div className="min-h-0 flex flex-col gap-3">
          <h2 className="shrink-0 text-xl font-semibold uppercase tracking-wide text-[var(--text-h)]">
            Next Up
          </h2>

          <div className="flex-1 min-h-0 bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-4 shadow-[var(--shadow)] flex flex-col">
            {queueNext.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center">
                <p className="text-[var(--text)]">Queue is empty</p>
              </div>
            ) : (
              <div className="flex-1 min-h-0 flex flex-col gap-2">
                {queueNext.slice(0, 6).map((player, index) => (
                  <div
                    key={`${player.source}-${player.id}`}
                    className="flex items-center gap-3 bg-[var(--surface-hover)] rounded-xl p-3 shrink-0"
                  >
                    <span className="w-8 h-8 rounded-full bg-[var(--primary)] text-white flex items-center justify-center font-bold shrink-0">
                      {index + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="font-medium text-[var(--text-h)] truncate">
                        {player.name}
                      </p>
                      <p className="text-xs text-[var(--text)]">
                        {player.timeJoined}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
