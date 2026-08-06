import { ArrowUpDown, Search, UserPlus, Users } from "lucide-react";
import { useMemo, useState } from "react";
import PaginationControls from "../PaginationControls";
import { getPagination } from "../../utils/pagination";
import { PlayerLevelBadge } from "./PlayerBadges";
import { formatPlayerPreferences, genderLabel, rankPreferenceLabel } from "./playerDisplay";

function compareValues(first, second) {
  if (typeof first === "number" && typeof second === "number") return first - second;
  return String(first || "").localeCompare(String(second || ""));
}

function SortHeader({ label, field, sort, onSort, centered = false }) {
  const active = sort.field === field;
  return (
    <th className={`px-3 py-2.5 ${centered ? "text-center" : "text-left"}`} aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}>
      <button type="button" onClick={() => onSort(field)} className={`inline-flex items-center gap-1 font-semibold ${centered ? "justify-center" : ""}`}>
        {label}<ArrowUpDown className={`h-3.5 w-3.5 ${active ? "text-[var(--primary)]" : "opacity-40"}`} />
      </button>
    </th>
  );
}

export default function AllPlayersTable({ profiles, isLoading, busyPlayerId, onRegister, onEdit, onDelete, onOpenAdd }) {
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");
  const [genderFilter, setGenderFilter] = useState("all");
  const [rankFilter, setRankFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sort, setSort] = useState({ field: "name", direction: "asc" });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const filteredProfiles = useMemo(() => {
    const searchText = search.trim().toLowerCase();
    const filtered = profiles.filter((player) => (
      (!searchText || player.name.toLowerCase().includes(searchText) || String(player.contactNumber || "").toLowerCase().includes(searchText))
      && (levelFilter === "all" || player.level === levelFilter)
      && (genderFilter === "all" || player.gender === genderFilter)
      && (rankFilter === "all" || player.rankPreference === rankFilter)
      && (categoryFilter === "all"
        || (categoryFilter === "mens" && player.preferMens)
        || (categoryFilter === "womens" && player.preferWomens)
        || (categoryFilter === "mixed" && player.preferMixed)
        || (categoryFilter === "no_gender" && player.preferNoGender))
    ));
    const getValue = (player) => ({
      name: player.name,
      level: player.level,
      gender: player.gender,
      matches: player.lifetimeMatches,
      results: player.lifetimeWins - player.lifetimeLosses,
    })[sort.field];
    return filtered.sort((first, second) => compareValues(getValue(first), getValue(second)) * (sort.direction === "asc" ? 1 : -1));
  }, [categoryFilter, genderFilter, levelFilter, profiles, rankFilter, search, sort]);

  const pagination = getPagination(filteredProfiles.length, page, pageSize);
  const pagedProfiles = filteredProfiles.slice(pagination.startIndex, pagination.endIndex);
  const updateFilter = (setter) => (event) => { setter(event.target.value); setPage(1); };
  const changeSort = (field) => {
    setSort((current) => ({ field, direction: current.field === field && current.direction === "asc" ? "desc" : "asc" }));
    setPage(1);
  };
  const clearFilters = () => {
    setSearch(""); setLevelFilter("all"); setGenderFilter("all"); setRankFilter("all"); setCategoryFilter("all"); setPage(1);
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
      <div className="border-b border-[var(--border)] p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-h)]">All Player Profiles</h2>
            <p className="mt-0.5 text-xs text-[var(--text)]">Permanent details, preferences, and lifetime Rotation records.</p>
          </div>
          <span className="rounded-full bg-[var(--surface-hover)] px-3 py-1 text-sm font-semibold text-[var(--text-h)]">{profiles.length} profiles</span>
        </div>
        <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-[minmax(13rem,1fr)_10rem_9rem_11rem_11rem]">
          <label className="relative">
            <span className="sr-only">Search all player profiles</span><Search className="absolute left-3 top-2.5 h-4 w-4 text-[var(--text)]" />
            <input value={search} onChange={updateFilter(setSearch)} placeholder="Search name or contact..." className="h-9 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] pl-9 pr-3 text-sm" />
          </label>
          <select value={levelFilter} onChange={updateFilter(setLevelFilter)} aria-label="Filter profiles by level" className="h-9 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"><option value="all">All levels</option><option value="beginner">Beginner</option><option value="intermediate">Intermediate</option><option value="upper_intermediate">Upper Intermediate</option><option value="advanced">Advanced</option></select>
          <select value={genderFilter} onChange={updateFilter(setGenderFilter)} aria-label="Filter profiles by gender" className="h-9 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"><option value="all">All genders</option><option value="male">Male</option><option value="female">Female</option></select>
          <select value={rankFilter} onChange={updateFilter(setRankFilter)} aria-label="Filter profiles by rank preference" className="h-9 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"><option value="all">All rank preferences</option><option value="same_rank">Same rank only</option><option value="adjacent_rank">Adjacent allowed</option></select>
          <select value={categoryFilter} onChange={updateFilter(setCategoryFilter)} aria-label="Filter profiles by match category" className="h-9 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"><option value="all">All categories</option><option value="mens">Men&apos;s</option><option value="womens">Women&apos;s</option><option value="mixed">Mixed</option><option value="no_gender">No Gender</option></select>
        </div>
      </div>

      {isLoading ? (
        <div className="px-5 py-10 text-center text-sm text-[var(--text)]">Loading player profiles...</div>
      ) : profiles.length === 0 ? (
        <div className="px-5 py-12 text-center">
          <Users className="mx-auto mb-3 h-8 w-8 text-[var(--text)]" />
          <h3 className="font-semibold text-[var(--text-h)]">No player profiles yet</h3>
          <p className="mt-1 text-sm text-[var(--text)]">Create the first profile to begin registering players.</p>
          <button type="button" onClick={onOpenAdd} className="mt-4 rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white"><UserPlus className="mr-1 inline h-4 w-4" /> Add New Player</button>
        </div>
      ) : filteredProfiles.length === 0 ? (
        <div className="px-5 py-10 text-center"><p className="font-medium text-[var(--text-h)]">No profiles match these filters.</p><button type="button" onClick={clearFilters} className="mt-2 text-sm font-semibold text-[var(--primary)]">Clear filters</button></div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="min-w-[900px] w-full border-collapse text-sm">
              <thead className="sticky top-0 z-10 bg-[var(--surface-hover)]">
                <tr className="text-xs uppercase tracking-wide text-[var(--text)] shadow-[0_1px_0_var(--border)]">
                  <SortHeader label="Player" field="name" sort={sort} onSort={changeSort} />
                  <SortHeader label="Level" field="level" sort={sort} onSort={changeSort} />
                  <th className="px-3 py-2.5 text-left">Preferences</th>
                  <SortHeader label="Total Matches" field="matches" sort={sort} onSort={changeSort} centered />
                  <SortHeader label="W / L" field="results" sort={sort} onSort={changeSort} centered />
                  <th className="w-px whitespace-nowrap px-3 py-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedProfiles.map((player) => {
                  const preferences = formatPlayerPreferences(player);
                  const isBusy = busyPlayerId === player.id;
                  const actionsDisabled = busyPlayerId !== null;
                  const activeToday = player.todayRegistration && !player.todayRegistration.isDone;
                  return (
                    <tr key={player.id} className="border-t border-[var(--border)] hover:bg-[var(--primary-light)]/35">
                      <td className="px-3 py-2"><p className="font-semibold text-[var(--text-h)]">{player.name}</p><p className="text-xs text-[var(--text)]">{genderLabel(player.gender)} · {player.contactNumber || "No contact"}</p></td>
                      <td className="px-3 py-2"><PlayerLevelBadge level={player.level} /></td>
                      <td className="px-3 py-2"><p className="font-medium text-[var(--text-h)]">{preferences.join(" · ") || "None"}</p><p className="mt-0.5 text-xs text-[var(--text)]">{rankPreferenceLabel(player.rankPreference)}</p></td>
                      <td className="px-3 py-2 text-center font-semibold text-[var(--text-h)]">{player.lifetimeMatches}</td>
                      <td className="px-3 py-2 text-center"><span className="font-semibold text-[var(--success)]">{player.lifetimeWins}</span><span className="px-1 text-[var(--text)]">/</span><span className="font-semibold text-[var(--danger)]">{player.lifetimeLosses}</span></td>
                      <td className="w-px whitespace-nowrap px-3 py-2"><div className="flex items-center justify-end gap-1.5">
                        {activeToday ? <span className="rounded-lg bg-[var(--success-light)] px-2 py-1 text-xs font-semibold text-[var(--success)]">Registered</span> : <button type="button" onClick={() => onRegister(player)} disabled={actionsDisabled} className="rounded-lg bg-[var(--primary)] px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-50">{isBusy ? "Working..." : player.todayRegistration?.isDone ? "Reactivate" : "Register"}</button>}
                        <button type="button" onClick={() => onEdit(player)} disabled={actionsDisabled} className="rounded-lg border border-[var(--border)] px-2.5 py-1 text-xs font-semibold text-[var(--text-h)] hover:bg-[var(--surface-hover)] disabled:opacity-50">Edit</button>
                        <button type="button" onClick={() => onDelete(player)} disabled={actionsDisabled || activeToday} title={activeToday ? "Mark this player done before deleting their profile." : "Delete player profile"} className="rounded-lg border border-[var(--danger)]/40 px-2.5 py-1 text-xs font-semibold text-[var(--danger)] hover:bg-[var(--danger-light)] disabled:cursor-not-allowed disabled:opacity-40">Delete</button>
                      </div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <PaginationControls page={pagination.currentPage} pageSize={pageSize} totalRecords={filteredProfiles.length} itemLabel="profiles" onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />
        </>
      )}
    </section>
  );
}
