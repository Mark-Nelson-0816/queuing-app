import { ArrowUpDown, Search, UserPlus, Users, UserCheck } from "lucide-react";
import { useMemo, useState } from "react";
import PaginationControls from "../PaginationControls";
import { getPagination } from "../../utils/pagination";
import { filterAndSortTodayPlayers } from "../../utils/playerManagementUi";
import { PlayerLevelBadge, PlayerStatusBadge } from "./PlayerBadges";
import { genderLabel } from "./playerDisplay";

// Displays a sortable heading for today's player table.
function SortHeader({ label, field, sort, onSort, align = "left" }) {
  const active = sort.field === field;
  const alignmentClass = align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left";
  return (
    <th className={`whitespace-nowrap px-3 py-2.5 ${alignmentClass}`} aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className={`inline-flex items-center gap-1 whitespace-nowrap font-semibold ${align === "right" ? "ml-auto" : ""}`}
      >
        {label}<ArrowUpDown className={`h-3.5 w-3.5 ${active ? "text-[var(--primary)]" : "opacity-40"}`} />
      </button>
    </th>
  );
}

// Displays searchable, sortable, and paginated players registered today.
export default function RegisteredPlayersTable({
  players,
  isLoading,
  busyPlayerId,
  onMarkDone,
  onReactivate,
  onOpenRegister,
  onOpenAdd,
  onMarkAllDone,
  isMarkingAllDone,
}) {
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");
  const [genderFilter, setGenderFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState({ field: "name", direction: "asc" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const dailyCounts = useMemo(() => players.reduce((counts, player) => {
    if (player.isDoneToday) counts.done += 1;
    else counts.active += 1;
    return counts;
  }, { active: 0, done: 0 }), [players]);

  // Filter and sort today's players without changing the source list.
  const filteredPlayers = useMemo(() => filterAndSortTodayPlayers(players, {
    search,
    levelFilter,
    genderFilter,
    statusFilter,
    sort,
  }), [genderFilter, levelFilter, players, search, sort, statusFilter]);

  // Limit filtered players to the current page.
  const pagination = getPagination(filteredPlayers.length, page, pageSize);
  const pagedPlayers = filteredPlayers.slice(pagination.startIndex, pagination.endIndex);

  // Apply a filter and return to the first page.
  const updateFilter = (setter) => (event) => {
    setter(event.target.value);
    setPage(1);
  };
  // Toggle sorting for the selected column.
  const changeSort = (field) => {
    setSort((current) => ({
      field,
      direction: current.field === field && current.direction === "asc" ? "desc" : "asc",
    }));
    setPage(1);
  };
  // Restore the default daily-player filters.
  const clearFilters = () => {
    setSearch("");
    setLevelFilter("all");
    setGenderFilter("all");
    setStatusFilter("all");
    setPage(1);
  };

  return (
    <section className="min-w-0 overflow-hidden rounded-2xl border border-[var(--primary)]/30 bg-[var(--surface)] shadow-[var(--shadow)]">
      {/* Daily-player heading and filters */}
      <div className="border-b border-[var(--border)] bg-[var(--primary-light)]/20 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><h2 className="whitespace-nowrap text-xl font-bold text-[var(--text-h)]">Players Today</h2><span className="whitespace-nowrap rounded-full bg-[var(--primary-light)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--primary)]">Today&apos;s Session</span></div>
            <p className="mt-0.5 text-xs text-[var(--text)]">Daily availability, active matches, teammate locks, and results.</p>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            <span className="whitespace-nowrap rounded-full bg-[var(--surface-hover)] px-3 py-1 text-sm font-semibold text-[var(--text-h)]">
              {dailyCounts.active} active · {dailyCounts.done} done
            </span>
            <button
              type="button"
              onClick={onMarkAllDone}
              disabled={isMarkingAllDone || dailyCounts.active === 0}
              className="whitespace-nowrap rounded-lg bg-green-500 px-3 py-2 text-xs font-semibold text-white
                        hover:bg-green-600
                        disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-green-500"
          >
              <UserCheck className="mr-1 inline h-3.5 w-3.5" />
              {isMarkingAllDone ? "Working..." : "Mark All Done"}
          </button>
            <button type="button" onClick={onOpenRegister} className="whitespace-nowrap rounded-lg bg-[var(--primary)] px-3 py-2 text-xs font-semibold text-white hover:bg-[var(--primary-hover)]"> <Users className="mr-1 inline h-3.5 w-3.5" /> Register Existing</button>
          </div>
        </div>

        <div className="mt-3 grid gap-2 lg:grid-cols-[minmax(13rem,1fr)_11rem_9rem_9rem]">
          <label className="relative min-w-0">
            <span className="sr-only">Search today&apos;s players</span>
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-[var(--text)]" />
            <input value={search} onChange={updateFilter(setSearch)} placeholder="Search today's players..." className="h-9 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] pl-9 pr-3 text-sm" />
          </label>
          <select value={levelFilter} onChange={updateFilter(setLevelFilter)} aria-label="Filter today's players by level" className="h-9 min-w-0 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm">
            <option value="all">All levels</option><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="upper_intermediate">Upper Intermediate</option><option value="advanced">Advanced</option>
          </select>
          <select value={genderFilter} onChange={updateFilter(setGenderFilter)} aria-label="Filter today's players by gender" className="h-9 min-w-0 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm">
            <option value="all">All genders</option><option value="male">Male</option><option value="female">Female</option>
          </select>
          <select value={statusFilter} onChange={updateFilter(setStatusFilter)} aria-label="Filter today's players by status" className="h-9 min-w-0 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm">
            <option value="all">All statuses</option><option value="available">Available</option><option value="assigned">Assigned</option><option value="playing">Playing</option><option value="done">Done</option>
          </select>
        </div>
      </div>

      {/* Daily-player loading, empty, or table content */}
      {isLoading ? (
        <div className="px-5 py-10 text-center text-sm text-[var(--text)]">Loading today&apos;s players...</div>
      ) : players.length === 0 ? (
        <div className="px-5 py-12 text-center">
          <Users className="mx-auto mb-3 h-8 w-8 text-[var(--text)]" />
          <h3 className="font-semibold text-[var(--text-h)]">No players registered today</h3>
          <p className="mt-1 text-sm text-[var(--text)]">Register an existing profile or add a new player profile.</p>
          <div className="mt-4 flex justify-center gap-2">
            <button type="button" onClick={onOpenRegister} className="rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white"><Users className="mr-1 inline h-3.5 w-3.5" />Register Existing</button>
            <button type="button" onClick={onOpenAdd} className="rounded-xl border border-[var(--border)] px-4 py-2 text-sm font-semibold text-[var(--text-h)]"><UserPlus className="mr-1 inline h-4 w-4" /> Add New</button>
          </div>
        </div>
      ) : filteredPlayers.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <p className="font-medium text-[var(--text-h)]">No players match these filters.</p>
          <button type="button" onClick={clearFilters} className="mt-2 text-sm font-semibold text-[var(--primary)]">Clear filters</button>
        </div>
      ) : (
        <>
          {/* Registered players table */}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px] table-fixed border-collapse text-sm">
              <colgroup>
                <col className="w-[13.5rem]" />
                <col className="w-[9rem]" />
                <col className="w-[8rem]" />
                <col className="w-[6.5rem]" />
                <col className="w-[5.5rem]" />
                <col className="w-[12rem]" />
                <col className="w-[8rem]" />
              </colgroup>
              <thead className="sticky top-0 z-10 bg-[var(--surface-hover)]">
                <tr className="text-left text-xs uppercase tracking-wide text-[var(--text)] shadow-[0_1px_0_var(--border)]">
                  <SortHeader label="Player" field="name" sort={sort} onSort={changeSort} />
                  <SortHeader label="Level" field="level" sort={sort} onSort={changeSort} />
                  <SortHeader label="Status" field="status" sort={sort} onSort={changeSort} />
                  <SortHeader label="Matches" field="matches" sort={sort} onSort={changeSort} align="center" />
                  <SortHeader label="W / L" field="results" sort={sort} onSort={changeSort} align="center" />
                  <th className="px-3 py-2.5">Locked Teammate</th>
                  <th className="w-px whitespace-nowrap px-3 py-2.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {pagedPlayers.map((player) => {
                  const isBusy = busyPlayerId === player.id;
                  const actionsDisabled = busyPlayerId !== null;
                  const cannotMarkDone = ["assigned", "playing"].includes(player.status);
                  return (
                    <tr key={player.registrationId} className="border-t border-[var(--border)] hover:bg-[var(--primary-light)]/35">
                      <td className="px-3 py-2"><p title={player.name} className="truncate font-semibold text-[var(--text-h)]">{player.name}</p><p className="whitespace-nowrap text-xs text-[var(--text)]">{genderLabel(player.gender)}</p></td>
                      <td className="px-3 py-2"><PlayerLevelBadge level={player.level} /></td>
                      <td className="px-3 py-2"><PlayerStatusBadge status={player.status} /></td>
                      <td className="px-3 py-2 text-center font-semibold text-[var(--text-h)]">{player.matchesToday}</td>
                      <td className="px-3 py-2 text-center"><span className="font-semibold text-[var(--success)]">{player.winsToday}</span><span className="px-1 text-[var(--text)]">/</span><span className="font-semibold text-[var(--danger)]">{player.lossesToday}</span></td>
                      <td className="px-3 py-2">{player.lockedTeammate ? <span title={player.lockedTeammate.name} className="block truncate font-medium text-[var(--text-h)]">{player.lockedTeammate.name}</span> : <span className="text-[var(--text)]">—</span>}</td>
                      <td className="w-px whitespace-nowrap px-3 py-2 text-right">
                        {player.isDoneToday ? (
                          <button type="button" onClick={() => onReactivate(player)} disabled={actionsDisabled} className="whitespace-nowrap rounded-lg bg-[var(--primary)] px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50">{isBusy ? "Working..." : "Reactivate"}</button>
                        ) : (
                          <button type="button" onClick={() => onMarkDone(player)} disabled={actionsDisabled || cannotMarkDone} title={cannotMarkDone ? `This player is currently ${player.status}.` : "Mark this player done for today"} className="whitespace-nowrap rounded-lg border border-[var(--border)] px-2.5 py-1 text-xs font-semibold text-[var(--text-h)] hover:border-blue-600 disabled:cursor-not-allowed disabled:opacity-40">{isBusy ? "Working..." : "Mark Done"}</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Registered-player pagination */}
          <PaginationControls page={pagination.currentPage} pageSize={pageSize} totalRecords={filteredPlayers.length} itemLabel="players" onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />
        </>
      )}
    </section>
  );
}
