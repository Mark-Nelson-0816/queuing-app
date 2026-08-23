import { Search, Users } from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import PaginationControls from "../PaginationControls";
import { getPagination } from "../../utils/pagination";
import {
  getLevelClasses,
  getLevelLabel,
} from "../../utils/playerLevel";
import {
  getEligibleTournamentProfiles,
  getTournamentSelectionDetails,
} from "../../utils/tournamentSelection";

// Displays one permanent profile and shares one selection handler across rows.
const TournamentProfileRow = memo(function TournamentProfileRow({
  player,
  selected,
  onToggle,
}) {
  return (
    <div
      onClick={(event) => {
        if (event.target.closest?.("button, input, select, textarea, a, [role='button']")) return;
        onToggle(player.id);
      }}
      className={`flex cursor-pointer items-center gap-3 border-l-4 px-4 py-3 transition-colors duration-150 ${
        selected
          ? "border-l-[var(--primary)] bg-[var(--primary-light)]/70"
          : "border-l-transparent hover:bg-[var(--surface-hover)]/70"
      }`}
    >
      <input
        type="checkbox"
        checked={selected}
        onClick={(event) => event.stopPropagation()}
        onChange={() => onToggle(player.id)}
        aria-label={`Select ${player.name}`}
      />
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
        <span className="truncate text-sm font-medium text-[var(--text-h)]">
          {player.name}
        </span>
        <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getLevelClasses(player.level)}`}>
          {getLevelLabel(player.level)}
        </span>
      </div>
      <span className="shrink-0 text-xs capitalize text-[var(--text)]">
        {player.gender}
      </span>
      {selected && (
        <span className="shrink-0 rounded-full bg-[var(--primary)] px-2.5 py-1 text-[10px] font-semibold text-white">
          Selected
        </span>
      )}
    </div>
  );
});

// Filters and selects permanent profiles for one exact configuration.
export default function RegisteredPlayers({
  players,
  selectedIds,
  setSelectedIds,
  level,
  category,
  matchType,
  validation,
  isGenerating,
  onGenerate,
}) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const eligiblePlayers = useMemo(
    () => getEligibleTournamentProfiles(players, level, category),
    [category, level, players],
  );

  const filteredPlayers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return eligiblePlayers;
    return eligiblePlayers.filter((player) => (
      String(player.name || "").toLowerCase().includes(query)
    ));
  }, [eligiblePlayers, search]);

  const { selectedIdSet, genderCounts } = useMemo(
    () => getTournamentSelectionDetails(selectedIds, eligiblePlayers),
    [eligiblePlayers, selectedIds],
  );

  const pagination = useMemo(
    () => getPagination(filteredPlayers.length, page, pageSize),
    [filteredPlayers.length, page, pageSize],
  );
  const pagedPlayers = useMemo(() => filteredPlayers.slice(
    pagination.startIndex,
    pagination.endIndex,
  ), [filteredPlayers, pagination.endIndex, pagination.startIndex]);

  const togglePlayer = useCallback((playerId) => {
    const numericId = Number(playerId);
    setSelectedIds((current) => {
      const currentSet = new Set(current.map(Number));
      if (currentSet.has(numericId)) {
        return current.filter((id) => Number(id) !== numericId);
      }
      return [...current, numericId];
    });
  }, [setSelectedIds]);

  const selectAllEligible = useCallback(() => {
    setSelectedIds((current) => [
      ...new Set([
        ...current.map(Number),
        ...filteredPlayers.map((player) => Number(player.id)),
      ]),
    ]);
  }, [filteredPlayers, setSelectedIds]);

  const allFilteredSelected = filteredPlayers.length > 0
    && filteredPlayers.every((player) => selectedIdSet.has(Number(player.id)));

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
      <div className="border-b border-[var(--border)] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold text-[var(--text-h)]">Permanent Player Profiles</h2>
            <p className="mt-1 text-sm text-[var(--text)]">
              Only profiles matching this category and exact level are shown.
            </p>
          </div>
          <span className="rounded-full bg-[var(--primary-light)] px-3 py-1 text-xs font-semibold text-[var(--primary)]">
            {eligiblePlayers.length} Eligible
          </span>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(14rem,1fr)_auto] lg:items-center">
          <label className="relative">
            <span className="sr-only">Search eligible profiles</span>
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-[var(--text)]" />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search eligible player..."
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] py-2 pl-9 pr-3 text-sm outline-none focus:border-[var(--primary)]"
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={filteredPlayers.length === 0 || allFilteredSelected}
              onClick={selectAllEligible}
              className="rounded-xl border border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--text-h)] hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Select All Eligible
            </button>
            <button
              type="button"
              disabled={selectedIds.length === 0}
              onClick={() => setSelectedIds([])}
              className="rounded-xl border border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--text-h)] hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-40"
            >
              Clear
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-xl bg-[var(--surface-hover)] p-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
              <span><strong className="text-[var(--text-h)]">{selectedIds.length}</strong> Selected</span>
              {matchType === "doubles" && category === "mixed" && (
                <>
                  <span><strong className="text-[var(--text-h)]">{genderCounts.male}</strong> Male</span>
                  <span><strong className="text-[var(--text-h)]">{genderCounts.female}</strong> Female</span>
                </>
              )}
            </div>
            <span className={`text-xs font-semibold ${validation.ready ? "text-[var(--success)]" : "text-[var(--warning)]"}`}>
              {validation.ready ? "Ready to generate" : validation.message}
            </span>
          </div>
        </div>
      </div>

      <div className="divide-y divide-[var(--border)]">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--text)]">
          <span>Player</span>
          <span>Gender</span>
        </div>
        {eligiblePlayers.length === 0 ? (
          <div className="p-10 text-center">
            <Users className="mx-auto h-7 w-7 text-[var(--text)]" />
            <p className="mt-2 font-medium text-[var(--text-h)]">No eligible profiles</p>
            <p className="mt-1 text-xs text-[var(--text)]">
              No permanent profile matches this category and level.
            </p>
          </div>
        ) : filteredPlayers.length === 0 ? (
          <div className="p-10 text-center">
            <Users className="mx-auto h-7 w-7 text-[var(--text)]" />
            <p className="mt-2 font-medium text-[var(--text-h)]">No matching players</p>
            <p className="mt-1 text-xs text-[var(--text)]">Try a different search.</p>
          </div>
        ) : pagedPlayers.map((player) => (
          <TournamentProfileRow
            key={player.id}
            player={player}
            selected={selectedIdSet.has(Number(player.id))}
            onToggle={togglePlayer}
          />
        ))}
      </div>

      {filteredPlayers.length > 0 && (
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

      <div className="border-t border-[var(--border)] bg-[var(--surface)] p-4">
        <button
          type="button"
          disabled={!validation.ready || isGenerating}
          onClick={onGenerate}
          className="w-full rounded-xl bg-[var(--primary)] py-3 font-semibold text-white transition hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isGenerating ? "Generating Configuration..." : "Generate Teams, Groups and Matches"}
        </button>
      </div>
    </section>
  );
}
