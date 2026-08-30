import { useEffect } from "react";
import { getLevelTextClasses } from "../utils/playerLevel";

const COURT_LAYOUTS = {
  low: "grid-cols-1",
  medium: "grid-cols-2",
  high: "grid-cols-3",
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

// Chooses a bounded grid that keeps every active Court visible on a venue screen.
function getCourtLayout(activeCourtCount) {
  if (activeCourtCount <= 1) return { grid: COURT_LAYOUTS.low, rows: 1, density: "low" };
  if (activeCourtCount === 2) return { grid: COURT_LAYOUTS.medium, rows: 1, density: "low" };
  if (activeCourtCount <= 4) return { grid: COURT_LAYOUTS.medium, rows: 2, density: "medium" };
  if (activeCourtCount <= 6) return {
    grid: COURT_LAYOUTS.high,
    rows: Math.ceil(activeCourtCount / 3),
    density: "high",
  };
  return {
    grid: COURT_LAYOUTS.high,
    rows: Math.ceil(activeCourtCount / 3),
    density: "dense",
  };
}

// Displays one team on an active public court card.
function PublicTeam({ team, density, accent = "primary", matchType, side }) {
  const isPrimary = accent === "primary";
  const isDense = density === "dense";
  const isHighDensity = density === "high";
  const sideLabel = matchType === "singles"
    ? `Player ${side}`
    : `Team ${side}`;

  return (
    <div className={`flex h-full min-h-0 min-w-0 max-w-full flex-col justify-center rounded-xl ${isDense ? "p-1" : isHighDensity ? "p-2 2xl:p-3" : density === "medium" ? "p-1.5 2xl:p-3" : "p-3 2xl:p-4"} ${
      isPrimary
        ? "bg-[var(--primary-light)]/35"
        : "bg-[var(--warning-light)]/35"
    }`}>
      <p className={`text-center font-semibold ${isDense ? "mb-0 text-[8px] leading-2" : isHighDensity ? "mb-1 text-xs leading-4 2xl:text-sm" : density === "medium" ? "mb-0.5 text-[10px] leading-3 2xl:mb-1 2xl:text-base 2xl:leading-5" : "mb-1.5 text-base leading-5 2xl:text-lg"} ${
        isPrimary ? "text-[var(--primary)]" : "text-[var(--warning)]"
      }`}>
        {sideLabel}
      </p>
      <div className={`grid min-w-0 grid-cols-1 ${isDense ? "gap-0.5" : isHighDensity ? "gap-1.5 2xl:gap-2" : density === "medium" ? "gap-1 2xl:gap-2" : "gap-2 2xl:gap-3"}`}>
        {team?.players.map((player) => (
          <div
            key={player.id}
            className={`min-w-0 max-w-full overflow-hidden rounded-lg bg-[var(--surface-hover)] text-center ${isDense ? "px-1 py-0.5" : isHighDensity ? "px-2 py-1 2xl:px-3 2xl:py-1.5" : density === "medium" ? "px-1.5 py-0.5 2xl:px-3 2xl:py-2" : "px-3 py-2 2xl:px-4 2xl:py-3"}`}
          >
            <p title={player.name} className={`overflow-hidden truncate whitespace-nowrap font-bold ${isDense ? "text-xs leading-4 2xl:text-sm" : isHighDensity ? "text-base leading-5 2xl:text-lg 2xl:leading-6" : density === "medium" ? "text-[clamp(0.9375rem,1.1vw,1.25rem)] leading-tight 2xl:text-xl 2xl:leading-6" : "text-xl leading-6 lg:text-2xl lg:leading-7 2xl:text-3xl 2xl:leading-8"} ${getLevelTextClasses(player.level)}`}>
              {player.name}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// Displays both Rotation Queue teams one player per line in the Next Up panel.
function NextUpTeams({ entry, compact }) {
  const hasStructuredTeams = Array.isArray(entry.teamA) && Array.isArray(entry.teamB);
  const nameClass = `truncate font-medium text-[var(--text-h)] ${compact ? "text-[10px] leading-3" : "text-sm leading-4"}`;

  if (!hasStructuredTeams) {
    return <p title={entry.name} className={nameClass}>{entry.name}</p>;
  }

  return (
    <div className="min-w-0">
      <div className="min-w-0">
        {entry.teamA.map((name, index) => (
          <p key={`a-${index}`} title={name} className={nameClass}>{name}</p>
        ))}
      </div>
      <p className={`font-semibold uppercase tracking-wide text-[var(--text)] ${compact ? "my-0 text-[8px] leading-2" : "my-1 text-[10px]"}`}>vs</p>
      <div className="min-w-0">
        {entry.teamB.map((name, index) => (
          <p key={`b-${index}`} title={name} className={nameClass}>{name}</p>
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
  const courtLayout = getCourtLayout(activeCourts.length);
  const nextUpCompact = queueNext.length > 3;

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
    <div className="flex h-screen min-h-0 flex-col overflow-hidden bg-[var(--bg)] p-3 text-[var(--text)] sm:p-4">
      {/* Public display heading and clock */}
      <div className="flex shrink-0 min-w-0 items-center justify-between gap-5 border-b border-[var(--border)] pb-2">
        <h1 className="min-w-0 truncate text-2xl font-bold text-[var(--text-h)]" title="Badminton Queue">
          Badminton Queue
        </h1>

        <div className="shrink-0 whitespace-nowrap text-right">
          <p className="font-mono text-3xl font-bold text-[var(--text-h)] sm:text-4xl">
            {new Date().toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
          <p className="text-xs text-[var(--text)] sm:text-base">
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
        <div className="mt-2 shrink-0 break-words rounded-xl bg-[var(--danger-light)] px-3 py-1.5 text-center text-sm font-semibold text-[var(--danger)]">
          {courtError}
        </div>
      )}

      {/* Active courts and Next Up queue */}
      <div className="mt-3 grid min-h-0 min-w-0 flex-1 grid-cols-[minmax(0,1fr)_17rem] gap-3">
        {/* Currently playing courts */}
        <div className="flex min-h-0 min-w-0 flex-col">
          <h2 className="mb-2 shrink-0 text-lg font-semibold uppercase tracking-wide text-[var(--text-h)]">
            Currently Playing
          </h2>

          {activeCourts.length === 0 ? (
            <div className="flex min-h-0 flex-1 items-center justify-center rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)]">
              <div className="text-center">
                <p className="text-xl text-[var(--text)]">No active matches</p>
                <p className="text-sm opacity-60">Waiting for players...</p>
              </div>
            </div>
          ) : (
            <div
              className={`grid min-h-0 flex-1 ${courtLayout.grid} gap-2`}
              style={{ gridTemplateRows: `repeat(${courtLayout.rows}, minmax(0, 1fr))` }}
            >
              {activeCourts.map((court) => {
                const match = court.activeMatch;
                const isTournament = match.source === "tournament";
                const isRotation = match.source === "rotation";
                const matchMetadata = isTournament
                  ? [
                    formatDivision(match.division),
                    formatLabel(match.matchType),
                    formatLabel(match.category),
                    match.division === "adult" ? formatLabel(match.level) : null,
                    match.groupName,
                    `Round ${match.roundNumber}`,
                  ].filter(Boolean)
                  : [
                    isRotation ? formatLabel(match.category) : null,
                    formatLabel(match.matchType),
                  ].filter(Boolean);

                return (
                  <div
                    key={court.id}
                    className={`flex h-full min-h-0 min-w-0 max-w-full flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)] ${courtLayout.density === "dense" ? "p-1.5" : courtLayout.density === "high" ? "p-2 2xl:p-3" : courtLayout.density === "medium" ? "p-1.5 2xl:p-3" : "p-3 2xl:p-5"}`}
                  >
                    <div className={`flex shrink-0 min-w-0 items-center justify-between gap-2 ${courtLayout.density === "dense" ? "mb-0" : courtLayout.density === "high" ? "mb-1" : courtLayout.density === "medium" ? "mb-1" : "mb-1.5"}`}>
                      <h3 title={court.name} className={`min-w-0 truncate font-bold text-[var(--text-h)] ${courtLayout.density === "dense" ? "text-sm" : courtLayout.density === "high" ? "text-base 2xl:text-lg" : courtLayout.density === "medium" ? "text-lg 2xl:text-xl" : "text-xl 2xl:text-2xl"}`}>
                        {court.name}
                      </h3>
                      <span className={`flex shrink-0 items-center whitespace-nowrap rounded-full bg-[var(--success-light)] font-semibold text-[var(--success)] ${courtLayout.density === "dense" ? "gap-1 px-1.5 py-0.5 text-[9px]" : courtLayout.density === "high" ? "gap-1.5 px-2 py-0.5 text-xs 2xl:text-sm" : courtLayout.density === "medium" ? "gap-1.5 px-2 py-0.5 text-xs 2xl:text-sm" : "gap-2 px-3 py-1 text-sm 2xl:text-base"}`}>
                        <span className={`${courtLayout.density === "dense" ? "h-1.5 w-1.5" : "h-2 w-2"} rounded-full bg-[var(--success)] animate-pulse`} />
                        LIVE
                      </span>
                    </div>

                    <div className={`min-w-0 shrink-0 text-center ${courtLayout.density === "dense" ? "mb-0" : courtLayout.density === "high" ? "mb-1" : courtLayout.density === "medium" ? "mb-1" : "mb-1.5"}`}>
                      <p title={isTournament ? match.tournamentName : undefined} className={`truncate font-bold text-[var(--text-h)] ${courtLayout.density === "dense" ? "text-[10px]" : courtLayout.density === "high" ? "text-xs 2xl:text-sm" : "text-sm 2xl:text-base"}`}>
                        {isTournament
                          ? match.tournamentName
                          : isRotation
                            ? "Rotation Match"
                            : "Legacy Normal Match"}
                      </p>
                      <p title={matchMetadata.join(" · ")} className={`truncate whitespace-nowrap leading-tight text-[var(--text)] ${courtLayout.density === "dense" ? "text-[8px]" : courtLayout.density === "high" ? "text-[10px] 2xl:text-xs" : "text-xs"}`}>
                        {matchMetadata.join(" · ")}
                      </p>
                    </div>

                    <div className={`grid min-h-0 min-w-0 flex-1 grid-rows-[minmax(0,1fr)_auto_minmax(0,1fr)] ${courtLayout.density === "dense" ? "gap-0" : courtLayout.density === "high" ? "gap-1 2xl:gap-2" : courtLayout.density === "medium" ? "gap-1.5 2xl:gap-2" : "gap-2 2xl:gap-3"}`}>
                      <PublicTeam team={match.teamA} density={courtLayout.density} accent="primary" matchType={match.matchType} side="A" />
                      <p className={`shrink-0 self-center text-center font-bold text-[var(--text)]/50 ${courtLayout.density === "dense" ? "text-[8px] leading-2" : courtLayout.density === "high" ? "text-base leading-5 2xl:text-lg" : courtLayout.density === "medium" ? "text-lg leading-5 2xl:text-xl" : "text-xl leading-6 2xl:text-2xl"}`}>
                        VS
                      </p>
                      <PublicTeam team={match.teamB} density={courtLayout.density} accent="warning" matchType={match.matchType} side="B" />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Rotation Queue Next Up */}
        <div className="flex min-h-0 min-w-0 flex-col">
          <h2 className="mb-2 shrink-0 text-lg font-semibold uppercase tracking-wide text-[var(--text-h)]">
            Next Up
          </h2>

          <div className={`min-h-0 flex-1 rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)] ${nextUpCompact ? "p-2" : "p-3"}`}>
            {queueNext.length === 0 ? (
              <div className="flex h-full min-h-0 flex-col items-center justify-center">
                <p className="text-[var(--text)]">Queue is empty</p>
              </div>
            ) : (
              <div className={`h-full min-h-0 ${nextUpCompact ? "space-y-1" : "space-y-2"}`}>
                {queueNext.slice(0, 6).map((player, index) => (
                  <div
                    key={`${player.source}-${player.id}`}
                    className={`flex min-w-0 items-start rounded-xl bg-[var(--surface-hover)] ${nextUpCompact ? "gap-1.5 p-1" : "gap-3 p-3"}`}
                  >
                    <span className={`flex shrink-0 items-center justify-center rounded-full bg-[var(--primary)] font-bold text-white ${nextUpCompact ? "h-6 w-6 text-[10px]" : "h-8 w-8"}`}>
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <NextUpTeams entry={player} compact={nextUpCompact} />
                      <p className={`text-[var(--text)] ${nextUpCompact ? "mt-0 text-[8px] leading-2" : "mt-1 text-xs"}`}>
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
