import { Search, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import PaginationControls from "../PaginationControls";
import { getPagination } from "../../utils/pagination";
import {
  getLevelClasses,
  getLevelLabel,
  normalizePlayerLevel,
} from "../../utils/playerLevel";
import {
  getTournamentPreferencePriority,
  isTournamentCategoryEligible,
  isTournamentPlayerEligible,
} from "../../utils/tournamentUi";

const LEVELS = [
  ["beginner", "Beginner"],
  ["intermediate", "Intermediate"],
  ["upper_intermediate", "Upper Intermediate"],
  ["advanced", "Advanced"],
];

const statusClasses = {
  available: "bg-[var(--success-light)] text-[var(--success)]",
  waiting: "bg-[var(--success-light)] text-[var(--success)]",
  assigned: "bg-[var(--warning-light)] text-[var(--warning)]",
  playing: "bg-[var(--primary-light)] text-[var(--primary)]",
  done: "bg-[var(--surface-hover)] text-[var(--text)]",
  finished: "bg-[var(--surface-hover)] text-[var(--text)]",
};

// Converts stored player values into readable labels.
function formatValue(value, fallback = "Unknown") {
  const normalized = String(value || "").trim();
  if (!normalized) return fallback;
  return normalized.charAt(0).toUpperCase() + normalized.slice(1).replaceAll("_", " ");
}

// Keeps the player fields required by Tournament creation.
function toSelectedPlayer(player) {
  return {
    id: player.id,
    name: player.name,
    gender: player.gender,
    level: player.level,
    preferMens: player.preferMens,
    preferWomens: player.preferWomens,
    preferMixed: player.preferMixed,
    preferNoGender: player.preferNoGender,
  };
}

// Loads and manages players selected for Tournament generation.
export default function RegisteredPlayers({
  selectedPlayers,
  setSelectedPlayers,
  category,
}) {
  const [players, setPlayers] = useState([]);
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");
  const [genderFilter, setGenderFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // Refresh registered players and remove selections that become ineligible.
  useEffect(() => {
    let isCancelled = false;
    let hasLoaded = false;

    // Load today's registered players from the backend.
    const loadPlayers = () => {
      window.api.getRegisteredPlayersToday()
        .then((registeredPlayers) => {
          if (isCancelled) return;
          const currentPlayers = Array.isArray(registeredPlayers) ? registeredPlayers : [];
          const eligibleIds = new Set(
            currentPlayers
              .filter((player) => isTournamentPlayerEligible(player, category))
              .map((player) => Number(player.id)),
          );

          hasLoaded = true;
          setPlayers(currentPlayers);
          setLoadError("");
          setSelectedPlayers((current) => (
            current.filter((player) => eligibleIds.has(Number(player.id)))
          ));
          setIsLoading(false);
        })
        .catch(() => {
          if (isCancelled || hasLoaded) return;
          setPlayers([]);
          setLoadError("Unable to load today's registered players.");
          setIsLoading(false);
        });
    };

    loadPlayers();
    const refreshTimer = window.setInterval(loadPlayers, 5000);

    return () => {
      isCancelled = true;
      window.clearInterval(refreshTimer);
    };
  }, [category, setSelectedPlayers]);

  // Build fast lookup state for selected player rows.
  const selectedIdSet = useMemo(
    () => new Set(selectedPlayers.map((player) => Number(player.id))),
    [selectedPlayers],
  );

  // Keep players whose gender fits the selected category.
  const categoryPlayers = useMemo(
    () => players.filter((player) => isTournamentCategoryEligible(player, category)),
    [category, players],
  );

  // Count players who also meet status and preference rules.
  const eligiblePlayers = useMemo(
    () => categoryPlayers.filter((player) => isTournamentPlayerEligible(player, category)),
    [category, categoryPlayers],
  );

  // Filter players and place exact preferences before fallback players.
  const filteredPlayers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return categoryPlayers
      .filter((player) => (
        (!query || String(player.name || "").toLowerCase().includes(query))
        && (levelFilter === "all" || normalizePlayerLevel(player.level) === levelFilter)
        && (genderFilter === "all" || String(player.gender || "").toLowerCase() === genderFilter)
      ))
      .sort((first, second) => (
        (getTournamentPreferencePriority(first, category) ?? 2)
        - (getTournamentPreferencePriority(second, category) ?? 2)
      ));
  }, [category, categoryPlayers, genderFilter, levelFilter, search]);

  // Limit filtered players to the current page.
  const pagination = getPagination(filteredPlayers.length, page, pageSize);
  const pagedPlayers = filteredPlayers.slice(pagination.startIndex, pagination.endIndex);
  const eligiblePagePlayers = pagedPlayers.filter(
    (player) => isTournamentPlayerEligible(player, category),
  );
  const allPageSelected = eligiblePagePlayers.length > 0
    && eligiblePagePlayers.every((player) => selectedIdSet.has(Number(player.id)));

  // Add or remove one eligible Tournament player.
  const updatePlayerSelection = (player, shouldSelect) => {
    setSelectedPlayers((current) => {
      if (shouldSelect && !isTournamentPlayerEligible(player, category)) return current;
      const alreadySelected = current.some((selected) => selected.id === player.id);
      if (shouldSelect) {
        return alreadySelected ? current : [...current, toSelectedPlayer(player)];
      }
      return current.filter((selected) => selected.id !== player.id);
    });
  };

  // Toggle selection using the shared selection updater.
  const togglePlayer = (player) => {
    updatePlayerSelection(player, !selectedIdSet.has(Number(player.id)));
  };

  // Toggle a row unless an interactive child handled the click.
  const handlePlayerRowClick = (event, player) => {
    if (event.target.closest?.("button, input, select, textarea, a, [role='button']")) return;
    if (!isTournamentPlayerEligible(player, category)) return;
    togglePlayer(player);
  };

  // Select or clear all eligible players on the current page.
  const toggleSelectPage = () => {
    setSelectedPlayers((current) => {
      const pageIdSet = new Set(eligiblePagePlayers.map((player) => Number(player.id)));
      if (allPageSelected) {
        return current.filter((player) => !pageIdSet.has(Number(player.id)));
      }

      const currentIds = new Set(current.map((player) => Number(player.id)));
      const additions = eligiblePagePlayers
        .filter((player) => !currentIds.has(Number(player.id)))
        .map(toSelectedPlayer);
      return [...current, ...additions];
    });
  };

  // Apply a player filter and return to the first page.
  const updateFilter = (setter) => (event) => {
    setter(event.target.value);
    setPage(1);
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] xl:col-span-2">
      {/* Selection heading, filters, and selected-player summary */}
      <div className="border-b border-[var(--border)] p-4">
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-[var(--text-h)]">Registered Players Today</h2>
            <p className="mt-1 text-sm text-[var(--text)]">
              Select eligible players for this Tournament.
            </p>
          </div>
          <span className="rounded-full bg-[var(--primary-light)] px-3 py-1 text-xs font-semibold text-[var(--primary)]">
            {eligiblePlayers.length} Eligible
          </span>
        </div>

        <div className="mb-4 rounded-xl bg-[var(--surface-hover)] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-sm font-semibold text-[var(--text-h)]">
                Selected: {selectedPlayers.length} players
              </p>
              <p className="mt-0.5 text-xs text-[var(--text)]">
                Selection stays active while you search, filter, and change pages.
              </p>
            </div>
            <button
              type="button"
              disabled={selectedPlayers.length === 0}
              onClick={() => setSelectedPlayers([])}
              className="text-xs font-semibold text-[var(--primary)] disabled:opacity-40"
            >
              Clear
            </button>
          </div>
          {selectedPlayers.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {selectedPlayers.slice(0, 8).map((player) => (
                <button
                  key={player.id}
                  type="button"
                  title={`Remove ${player.name}`}
                  onClick={() => updatePlayerSelection(player, false)}
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getLevelClasses(player.level)}`}
                >
                  {player.name} ×
                </button>
              ))}
              {selectedPlayers.length > 8 && (
                <span className="px-2 py-0.5 text-[10px] font-semibold text-[var(--text)]">
                  +{selectedPlayers.length - 8} more
                </span>
              )}
            </div>
          )}
        </div>

        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[minmax(12rem,1fr)_11rem_9rem]">
          <label className="relative">
            <span className="sr-only">Search players</span>
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-[var(--text)]" />
            <input
              value={search}
              onChange={updateFilter(setSearch)}
              placeholder="Search player..."
              className="w-full rounded-xl border border-[var(--border)] py-2 pl-9 pr-3 text-sm outline-none"
            />
          </label>
          <select
            value={levelFilter}
            onChange={updateFilter(setLevelFilter)}
            aria-label="Filter player level"
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs"
          >
            <option value="all">All Levels</option>
            {LEVELS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <select
            value={genderFilter}
            onChange={updateFilter(setGenderFilter)}
            aria-label="Filter player gender"
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-xs"
          >
            <option value="all">All Genders</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
          </select>
        </div>

        <label className="mt-3 flex items-center gap-2 text-sm text-[var(--text)]">
          <input
            type="checkbox"
            checked={allPageSelected}
            disabled={eligiblePagePlayers.length === 0}
            onChange={toggleSelectPage}
          />
          Select all eligible players on this page
          <span className="ml-auto">
            Selected: <strong className="text-[var(--text-h)]">{selectedPlayers.length}</strong>
          </span>
        </label>
      </div>

      {/* Registered player rows */}
      <div className="divide-y divide-[var(--border)]">
        {isLoading ? (
          <p className="p-10 text-center text-sm text-[var(--text)]">Loading today&apos;s players...</p>
        ) : loadError ? (
          <p className="p-10 text-center text-sm text-[var(--danger)]">{loadError}</p>
        ) : categoryPlayers.length === 0 ? (
          <div className="p-10 text-center">
            <Users className="mx-auto h-7 w-7 text-[var(--text)]" />
            <p className="mt-2 font-medium text-[var(--text-h)]">No eligible players for this category</p>
            <p className="mt-1 text-xs text-[var(--text)]">Change the category or register more players today.</p>
          </div>
        ) : filteredPlayers.length === 0 ? (
          <div className="p-10 text-center">
            <Users className="mx-auto h-7 w-7 text-[var(--text)]" />
            <p className="mt-2 font-medium text-[var(--text-h)]">No players match these filters</p>
            <p className="mt-1 text-xs text-[var(--text)]">Clear the search or change a filter.</p>
          </div>
        ) : pagedPlayers.map((player) => {
          const isSelected = selectedIdSet.has(Number(player.id));
          const status = String(player.status || "available").toLowerCase();
          const isEligible = isTournamentPlayerEligible(player, category);
          return (
            <div
              key={player.id}
              onClick={(event) => handlePlayerRowClick(event, player)}
              className={`flex items-center gap-3 border-l-4 px-4 py-3 transition-colors duration-150 ${
                isSelected
                  ? "border-l-[var(--primary)] bg-[var(--primary-light)]/70"
                  : `border-l-transparent ${isEligible ? "hover:bg-[var(--surface-hover)]/70" : "opacity-70"}`
              } ${isEligible ? "cursor-pointer" : "cursor-not-allowed"}`}
            >
              <input
                type="checkbox"
                checked={isSelected}
                disabled={!isEligible}
                onClick={(event) => event.stopPropagation()}
                onChange={() => togglePlayer(player)}
                aria-label={`Select ${player.name}`}
              />
              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                <span className="truncate text-sm font-medium text-[var(--text-h)]">{player.name.toUpperCase()}</span>
                <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getLevelClasses(player.level)}`}>
                  {getLevelLabel(player.level)}
                </span>
                <span className="text-xs capitalize text-[var(--text)]">{formatValue(player.gender)}</span>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold ${statusClasses[status] || statusClasses.available}`}>
                {status === "done" ? "Finished" : formatValue(status, "Available")}
              </span>
            </div>
          );
        })}
      </div>

      {/* Player pagination */}
      {!isLoading && !loadError && filteredPlayers.length > 0 && (
        <PaginationControls
          page={pagination.currentPage}
          pageSize={pageSize}
          totalRecords={filteredPlayers.length}
          itemLabel="players"
          onPageChange={setPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setPage(1);
          }}
        />
      )}
    </section>
  );
}
