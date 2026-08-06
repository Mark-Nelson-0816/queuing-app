import { ArrowUpDown, Search, UserPlus, Users } from "lucide-react";
import { useMemo, useState } from "react";
import PaginationControls from "../PaginationControls";
import { getPagination } from "../../utils/pagination";
import { PlayerLevelBadge, PlayerStatusBadge } from "./PlayerBadges";
import { genderLabel } from "./playerDisplay";

function compareValues(first, second) {
  if (typeof first === "number" && typeof second === "number") return first - second;
  return String(first || "").localeCompare(String(second || ""));
}

function SortHeader({ label, field, sort, onSort, align = "left" }) {
  const active = sort.field === field;
  const alignmentClass = align === "center" ? "text-center" : align === "right" ? "text-right" : "text-left";
  return (
    <th className={`px-3 py-2.5 ${alignmentClass}`} aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className={`inline-flex items-center gap-1 font-semibold ${align === "right" ? "ml-auto" : ""}`}
      >
        {label}<ArrowUpDown className={`h-3.5 w-3.5 ${active ? "text-[var(--primary)]" : "opacity-40"}`} />
      </button>
    </th>
  );
}

export default function RegisteredPlayersTable({
  players,
  isLoading,
  busyPlayerId,
  onMarkDone,
  onReactivate,
  onOpenRegister,
  onOpenAdd,
}) {
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");
  const [genderFilter, setGenderFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState({ field: "name", direction: "asc" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const filteredPlayers = useMemo(() => {
    const searchText = search.trim().toLowerCase();
    const filtered = players.filter((player) => (
      (!searchText || player.name.toLowerCase().includes(searchText))
      && (levelFilter === "all" || player.level === levelFilter)
      && (genderFilter === "all" || player.gender === genderFilter)
      && (statusFilter === "all" || player.status === statusFilter)
    ));
    const getValue = (player) => ({
      name: player.name,
      level: player.level,
      gender: player.gender,
      status: player.status,
      matches: player.matchesToday,
      results: player.winsToday - player.lossesToday,
    })[sort.field];
    return filtered.sort((first, second) => (
      compareValues(getValue(first), getValue(second))
      * (sort.direction === "asc" ? 1 : -1)
    ));
  }, [genderFilter, levelFilter, players, search, sort, statusFilter]);

  const pagination = getPagination(filteredPlayers.length, page, pageSize);
  const pagedPlayers = filteredPlayers.slice(pagination.startIndex, pagination.endIndex);

  const updateFilter = (setter) => (event) => {
    setter(event.target.value);
    setPage(1);
  };
  const changeSort = (field) => {
    setSort((current) => ({
      field,
      direction: current.field === field && current.direction === "asc" ? "desc" : "asc",
    }));
    setPage(1);
  };
  const clearFilters = () => {
    setSearch("");
    setLevelFilter("all");
    setGenderFilter("all");
    setStatusFilter("all");
    setPage(1);
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--primary)]/30 bg-[var(--surface)] shadow-[var(--shadow)]">
      <div className="border-b border-[var(--border)] bg-[var(--primary-light)]/20 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2"><h2 className="text-xl font-bold text-[var(--text-h)]">Players Today</h2><span className="rounded-full bg-[var(--primary-light)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--primary)]">Today&apos;s Session</span></div>
            <p className="mt-0.5 text-xs text-[var(--text)]">Daily availability, active matches, teammate locks, and results.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-[var(--surface-hover)] px-3 py-1 text-sm font-semibold text-[var(--text-h)]">
              {players.filter((player) => !player.isDoneToday).length} active · {players.filter((player) => player.isDoneToday).length} done
            </span>
            <button type="button" onClick={onOpenRegister} className="rounded-xl bg-[var(--primary)] px-3 py-2 text-xs font-semibold text-white">Register Existing</button>
          </div>
        </div>

        <div className="mt-3 grid gap-2 lg:grid-cols-[minmax(13rem,1fr)_11rem_9rem_9rem]">
          <label className="relative">
            <span className="sr-only">Search today&apos;s players</span>
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-[var(--text)]" />
            <input value={search} onChange={updateFilter(setSearch)} placeholder="Search today's players..." className="h-9 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] pl-9 pr-3 text-sm" />
          </label>
          <select value={levelFilter} onChange={updateFilter(setLevelFilter)} aria-label="Filter today's players by level" className="h-9 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm">
            <option value="all">All levels</option><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="upper_intermediate">Upper Intermediate</option><option value="advanced">Advanced</option>
          </select>
          <select value={genderFilter} onChange={updateFilter(setGenderFilter)} aria-label="Filter today's players by gender" className="h-9 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm">
            <option value="all">All genders</option><option value="male">Male</option><option value="female">Female</option>
          </select>
          <select value={statusFilter} onChange={updateFilter(setStatusFilter)} aria-label="Filter today's players by status" className="h-9 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm">
            <option value="all">All statuses</option><option value="available">Available</option><option value="assigned">Assigned</option><option value="playing">Playing</option><option value="done">Done</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="px-5 py-10 text-center text-sm text-[var(--text)]">Loading today&apos;s players...</div>
      ) : players.length === 0 ? (
        <div className="px-5 py-12 text-center">
          <Users className="mx-auto mb-3 h-8 w-8 text-[var(--text)]" />
          <h3 className="font-semibold text-[var(--text-h)]">No players registered today</h3>
          <p className="mt-1 text-sm text-[var(--text)]">Register an existing profile or add a new player profile.</p>
          <div className="mt-4 flex justify-center gap-2">
            <button type="button" onClick={onOpenRegister} className="rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white">Register Existing</button>
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
          <div className="overflow-x-auto">
            <table className="min-w-[800px] w-full border-collapse text-sm">
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
                      <td className="px-3 py-2"><p className="font-semibold text-[var(--text-h)]">{player.name}</p><p className="text-xs text-[var(--text)]">{genderLabel(player.gender)}</p></td>
                      <td className="px-3 py-2"><PlayerLevelBadge level={player.level} /></td>
                      <td className="px-3 py-2"><PlayerStatusBadge status={player.status} /></td>
                      <td className="px-3 py-2 text-center font-semibold text-[var(--text-h)]">{player.matchesToday}</td>
                      <td className="px-3 py-2 text-center"><span className="font-semibold text-[var(--success)]">{player.winsToday}</span><span className="px-1 text-[var(--text)]">/</span><span className="font-semibold text-[var(--danger)]">{player.lossesToday}</span></td>
                      <td className="px-3 py-2">{player.lockedTeammate ? <span className="font-medium text-[var(--text-h)]">{player.lockedTeammate.name}</span> : <span className="text-[var(--text)]">—</span>}</td>
                      <td className="w-px whitespace-nowrap px-3 py-2 text-right">
                        {player.isDoneToday ? (
                          <button type="button" onClick={() => onReactivate(player)} disabled={actionsDisabled} className="rounded-lg bg-[var(--primary)] px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50">{isBusy ? "Working..." : "Reactivate"}</button>
                        ) : (
                          <button type="button" onClick={() => onMarkDone(player)} disabled={actionsDisabled || cannotMarkDone} title={cannotMarkDone ? `This player is currently ${player.status}.` : "Mark this player done for today"} className="rounded-lg border border-[var(--border)] px-2.5 py-1 text-xs font-semibold text-[var(--text-h)] hover:bg-[var(--surface-hover)] disabled:cursor-not-allowed disabled:opacity-40">{isBusy ? "Working..." : "Mark Done"}</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <PaginationControls page={pagination.currentPage} pageSize={pageSize} totalRecords={filteredPlayers.length} itemLabel="players" onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />
        </>
      )}
    </section>
  );
}
