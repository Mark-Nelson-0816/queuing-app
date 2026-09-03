import { useEffect, useMemo, useRef, useState } from "react";
import { getLevelTextClasses } from "../utils/playerLevel";

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

// Cards never grow past this many columns in a row, no matter how many
// courts there are — beyond that, an extra row is added instead.
const MAX_COLUMNS = 6;

// Picks the column count using a fixed rule based purely on the number of
// courts, so the same count always lays out the same way regardless of the
// screen's aspect ratio: 1-2 courts sit in a single row; from 3 courts up,
// courts split across as few rows as possible (starting at 2), with any
// leftover court(s) going into the earlier row(s) rather than the last one.
// e.g. 3 -> 2+1, 4 -> 2+2, 5 -> 3+2, 6 -> 3+3, 7 -> 4+3, 8 -> 4+4.
function getOptimalColumns(count) {
  if (count <= 0) return 1;
  if (count <= 2) return count;

  let rows = 2;
  while (Math.ceil(count / rows) > MAX_COLUMNS) {
    rows += 1;
  }
  return Math.ceil(count / rows);
}

// Splits items into rows of `columns` each. The last row may be shorter —
// callers should stretch those cards to fill the row rather than leaving
// a gap, so partial rows never look like an unfinished grid.
function chunkIntoRows(items, columns) {
  const rows = [];
  for (let i = 0; i < items.length; i += columns) {
    rows.push(items.slice(i, i + columns));
  }
  return rows;
}

// Text/spacing density, driven by how many cards actually end up sharing a
// row-slot (columns x rows) rather than the raw court count, since two
// courts stacked 1-per-row need bigger text than two sitting side by side.
function getDensity(columns, rowCount) {
  const cells = columns * rowCount;
  if (cells <= 2) return "low";
  if (cells <= 4) return "medium";
  if (cells <= 6) return "high";
  return "dense";
}

const DENSITY_STYLES = {
  low: {
    cardPad: "p-3 2xl:p-5",
    headerGap: "mb-1.5",
    title: "text-xl 2xl:text-2xl",
    badge: "gap-2 px-3 py-1 text-sm 2xl:text-base",
    dot: "h-2 w-2",
    metaGap: "mb-1.5",
    metaTitle: "text-sm 2xl:text-base",
    metaSub: "text-xs",
    teamsGap: "gap-2 2xl:gap-3",
    vs: "text-xl leading-6 2xl:text-2xl",
    teamPad: "p-3 2xl:p-4",
    teamLabel: "mb-1.5 text-base leading-5 2xl:text-lg",
    playerGap: "gap-2 2xl:gap-3",
    playerPad: "px-3 py-2 2xl:px-4 2xl:py-3",
    playerName: "text-xl leading-6 lg:text-2xl lg:leading-7 2xl:text-3xl 2xl:leading-8",
    availableLabel: "text-lg 2xl:text-xl",
    availableIcon: "h-10 w-10 2xl:h-12 2xl:w-12",
  },
  medium: {
    cardPad: "p-1.5 2xl:p-3",
    headerGap: "mb-1",
    title: "text-lg 2xl:text-xl",
    badge: "gap-1.5 px-2 py-0.5 text-xs 2xl:text-sm",
    dot: "h-2 w-2",
    metaGap: "mb-1",
    metaTitle: "text-sm 2xl:text-base",
    metaSub: "text-xs",
    teamsGap: "gap-1.5 2xl:gap-2",
    vs: "text-lg leading-5 2xl:text-xl",
    teamPad: "p-1.5 2xl:p-3",
    teamLabel: "mb-0.5 text-[10px] leading-3 2xl:mb-1 2xl:text-base 2xl:leading-5",
    playerGap: "gap-1 2xl:gap-2",
    playerPad: "px-1.5 py-0.5 2xl:px-3 2xl:py-2",
    playerName: "text-[clamp(0.9375rem,1.1vw,1.25rem)] leading-tight 2xl:text-xl 2xl:leading-6",
    availableLabel: "text-base 2xl:text-lg",
    availableIcon: "h-8 w-8 2xl:h-10 2xl:w-10",
  },
  high: {
    cardPad: "p-2 2xl:p-3",
    headerGap: "mb-1",
    title: "text-base 2xl:text-lg",
    badge: "gap-1.5 px-2 py-0.5 text-xs 2xl:text-sm",
    dot: "h-2 w-2",
    metaGap: "mb-1",
    metaTitle: "text-xs 2xl:text-sm",
    metaSub: "text-[10px] 2xl:text-xs",
    teamsGap: "gap-1 2xl:gap-2",
    vs: "text-base leading-5 2xl:text-lg",
    teamPad: "p-2 2xl:p-3",
    teamLabel: "mb-1 text-xs leading-4 2xl:text-sm",
    playerGap: "gap-1.5 2xl:gap-2",
    playerPad: "px-2 py-1 2xl:px-3 2xl:py-1.5",
    playerName: "text-base leading-5 2xl:text-lg 2xl:leading-6",
    availableLabel: "text-sm 2xl:text-base",
    availableIcon: "h-7 w-7 2xl:h-8 2xl:w-8",
  },
  dense: {
    cardPad: "p-1.5",
    headerGap: "mb-0",
    title: "text-sm",
    badge: "gap-1 px-1.5 py-0.5 text-[9px]",
    dot: "h-1.5 w-1.5",
    metaGap: "mb-0",
    metaTitle: "text-[10px]",
    metaSub: "text-[8px]",
    teamsGap: "gap-0",
    vs: "text-[8px] leading-2",
    teamPad: "p-1",
    teamLabel: "mb-0 text-[8px] leading-2",
    playerGap: "gap-0.5",
    playerPad: "px-1 py-0.5",
    playerName: "text-xs leading-4 2xl:text-sm",
    availableLabel: "text-xs",
    availableIcon: "h-5 w-5",
  },
};

// Displays one team on an active public court card.
function PublicTeam({ team, styles, accent = "primary", matchType, side }) {
  const isPrimary = accent === "primary";
  const sideLabel = matchType === "singles" ? `Player ${side}` : `Team ${side}`;

  return (
    <div className={`flex h-full min-h-0 min-w-0 max-w-full flex-col justify-center rounded-xl ${styles.teamPad} ${
      isPrimary ? "bg-[var(--primary-light)]/35" : "bg-[var(--warning-light)]/35"
    }`}>
      <p className={`text-center font-semibold ${styles.teamLabel} ${isPrimary ? "text-[var(--primary)]" : "text-[var(--warning)]"}`}>
        {sideLabel}
      </p>
      <div className={`grid min-w-0 grid-cols-1 ${styles.playerGap}`}>
        {team?.players.map((player) => (
          <div
            key={player.id}
            className={`min-w-0 max-w-full overflow-hidden rounded-lg text-center ${styles.playerPad}`}
          >
            <p title={player.name} className={`overflow-hidden truncate whitespace-nowrap font-bold ${styles.playerName} ${getLevelTextClasses(player.level)}`}>
              {player.name}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// A single active-court card. Sits inside a flex row and stretches
// (flex-1) to share whatever width the row gives it, so a short last row
// grows wider instead of leaving empty space beside it.
function CourtCard({ court, styles }) {
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
    <div className={`flex h-full min-h-0 min-w-0 max-w-full flex-1 basis-0 flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow)] ${styles.cardPad}`}>
      <div className={`flex shrink-0 min-w-0 items-center justify-between gap-2 ${styles.headerGap}`}>
        <h3 title={court.name} className={`min-w-0 truncate ml-2 font-bold text-[var(--text-h)] ${styles.title}`}>
          {court.name}
        </h3>
        <span className={`flex shrink-0 items-center whitespace-nowrap rounded-full bg-[var(--success-light)] font-semibold text-[var(--success)] ${styles.badge}`}>
          <span className={`${styles.dot} rounded-full bg-[var(--success)] animate-pulse`} />
          LIVE
        </span>
      </div>

      <div className={`min-w-0 shrink-0 text-center ${styles.metaGap}`}>
        <p title={isTournament ? match.tournamentName : undefined} className={`truncate font-bold text-[var(--text-h)] ${styles.metaTitle}`}>
          {isTournament ? match.tournamentName : isRotation ? "Rotation Match" : "Legacy Normal Match"}
        </p>
        <p title={matchMetadata.join(" · ")} className={`truncate whitespace-nowrap leading-tight text-[var(--text)] ${styles.metaSub}`}>
          {matchMetadata.join(" · ")}
        </p>
      </div>

      <div className={`grid min-h-0 min-w-0 flex-1 grid-rows-[minmax(0,1fr)_auto_minmax(0,1fr)] ${styles.teamsGap}`}>
        <PublicTeam team={match.teamA} styles={styles} accent="primary" matchType={match.matchType} side="A" />
        <p className={`shrink-0 self-center text-center font-bold text-[var(--text)]/50 ${styles.vs}`}>VS</p>
        <PublicTeam team={match.teamB} styles={styles} accent="warning" matchType={match.matchType} side="B" />
      </div>
    </div>
  );
}

// A court that isn't currently playing. Kept visually calmer (muted colors,
// dashed border, no LIVE pulse) so the live matches still read as the
// primary focus, while players can still see which courts are free.
function AvailableCourtCard({ court, styles }) {
  return (
    <div className={`flex h-full min-h-0 min-w-0 max-w-full flex-1 basis-0 flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)]/50 ${styles.cardPad}`}>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className={`${styles.availableIcon} text-[var(--text)]/25`}
      >
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <line x1="3" y1="12" x2="21" y2="12" />
        <line x1="12" y1="4" x2="12" y2="20" />
      </svg>
      <h3 title={court.name} className={`min-w-0 max-w-full truncate text-center font-bold text-[var(--text)]/70 ${styles.title}`}>
        {court.name}
      </h3>
      <span className={`font-semibold uppercase tracking-wide text-[var(--text)]/45 ${styles.availableLabel}`}>
        Available
      </span>
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

// Displays all courts (live matches and available courts alike) and the
// Rotation Queue matches that are next up.
export default function PublicDisplay({
  courts = [],
  queueNext = [],
  courtError = "",
}) {
  const nextUpCompact = queueNext.length > 3;

  // The layout is derived from the court count alone (see getOptimalColumns),
  // not from measured pixel dimensions — this keeps a given court count
  // laying out the same way (e.g. 5 courts -> 3 on top, 2 on the bottom)
  // no matter the screen's aspect ratio.
  const { rows: courtRows, styles } = useMemo(() => {
    const count = courts.length;
    const columns = getOptimalColumns(count);
    const chunked = chunkIntoRows(courts, columns);
    const density = getDensity(columns, chunked.length || 1);
    return { rows: chunked, styles: DENSITY_STYLES[density] };
  }, [courts]);

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

      {/* Courts and Next Up queue */}
      <div className="mt-3 grid min-h-0 min-w-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_17rem]">
        {/* All courts: live matches and available courts */}
        <div className="flex min-h-0 min-w-0 flex-col">
          <h2 className="mb-2 shrink-0 text-lg font-semibold uppercase tracking-wide text-[var(--text-h)]">
            Courts
          </h2>

          {courts.length === 0 ? (
            <div className="flex min-h-0 flex-1 items-center justify-center rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)]">
              <div className="text-center">
                <p className="text-xl text-[var(--text)]">No courts configured</p>
                <p className="text-sm opacity-60">Add a court to get started</p>
              </div>
            </div>
          ) : (
            // Rows stack with equal height, and every card inside a row
            // stretches (flex-1) to share that row's width, so a short
            // last row grows wider instead of leaving a gap.
            <div className="flex min-h-0 flex-1 flex-col gap-2">
              {courtRows.map((rowCourts, rowIndex) => (
                <div key={rowIndex} className="flex min-h-0 flex-1 gap-2">
                  {rowCourts.map((court) =>
                    court.status === "playing" && court.activeMatch ? (
                      <CourtCard key={court.id} court={court} styles={styles} />
                    ) : (
                      <AvailableCourtCard key={court.id} court={court} styles={styles} />
                    ),
                  )}
                </div>
              ))}
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