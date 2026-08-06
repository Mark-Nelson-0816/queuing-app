import { AlertTriangle, CheckCircle2, Link2, Search, Settings2, Users, XCircle } from "lucide-react";
import { useMemo, useState } from "react";
import Modal from "../Modal";
import PaginationControls from "../PaginationControls";
import { getPagination } from "../../utils/pagination";
import { getLevelClasses, getLevelLabel, normalizePlayerLevel } from "../../utils/playerLevel";
import { buildRotationPreview, getPlayerConfigurationReason } from "../../utils/rotationUi";

const LEVELS = [
  ["beginner", "Beginner"],
  ["intermediate", "Intermediate"],
  ["upper_intermediate", "Upper Intermediate"],
  ["advanced", "Advanced"],
];

function categoryLabel(category) {
  if (category === "no_gender") return "No Gender";
  if (category === "mens") return "Men's";
  if (category === "womens") return "Women's";
  return "Mixed";
}

function getStatusBadge(player, reason) {
  if (!reason) return { label: "Available", classes: "bg-[var(--success-light)] text-[var(--success)]" };
  if (player.status === "playing") return { label: "Playing", classes: "bg-[var(--primary-light)] text-[var(--primary)]" };
  if (player.status === "assigned") return { label: "Assigned", classes: "bg-[var(--warning-light)] text-[var(--warning)]" };
  if (player.isDoneToday || player.status === "done") return { label: "Done", classes: "bg-[var(--surface-hover)] text-[var(--text)]" };
  return { label: "Unavailable", classes: "bg-[var(--danger-light)] text-[var(--danger)]" };
}

function isDoneForToday(player) {
  return player.isDoneToday || player.status === "done";
}

function PreviewTeam({ label, players, tone }) {
  const background = tone === "primary"
    ? "bg-[var(--primary-light)]/50"
    : "bg-[var(--warning-light)]/50";
  return (
    <div className={`min-w-0 rounded-xl p-3 ${background}`}>
      <p className={`text-[10px] font-semibold uppercase tracking-wider ${tone === "primary" ? "text-[var(--primary)]" : "text-[var(--warning)]"}`}>{label}</p>
      <div className="mt-1.5 space-y-1.5">
        {players.map((player) => (
          <div key={player.id} className="flex min-w-0 items-center gap-1.5">
            <span className="truncate text-xs font-semibold text-[var(--text-h)]">{player.name}</span>
            <span className={`shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-semibold ${getLevelClasses(player.level)}`}>{getLevelLabel(player.level)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function RotationPlayerPool({
  players,
  locks,
  selectedPlayerIds,
  matchType,
  category,
  isLoading,
  isGenerating,
  lockActionId,
  preferenceActionId,
  onMatchTypeChange,
  onCategoryChange,
  onSelectionChange,
  onCreateLock,
  onRemoveLock,
  onPreferenceChange,
  onGenerate,
}) {
  const [search, setSearch] = useState("");
  const [levelFilter, setLevelFilter] = useState("all");
  const [genderFilter, setGenderFilter] = useState("all");
  const [availabilityFilter, setAvailabilityFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [lockModalOpen, setLockModalOpen] = useState(false);
  const [preferencePlayerId, setPreferencePlayerId] = useState(null);
  const [firstLockPlayerId, setFirstLockPlayerId] = useState("");
  const [secondLockPlayerId, setSecondLockPlayerId] = useState("");

  const selectedIdSet = useMemo(() => new Set(selectedPlayerIds.map(Number)), [selectedPlayerIds]);
  const selectedPlayers = useMemo(() => players.filter((player) => selectedIdSet.has(player.id)), [players, selectedIdSet]);
  const visiblePlayers = useMemo(() => players.filter((player) => !isDoneForToday(player)), [players]);
  const preview = useMemo(() => buildRotationPreview({ players, selectedPlayerIds, locks, matchType, category }), [category, locks, matchType, players, selectedPlayerIds]);

  const maleCount = selectedPlayers.filter((player) => player.gender === "male").length;
  const femaleCount = selectedPlayers.filter((player) => player.gender === "female").length;
  const selectedLockIds = [...new Set(selectedPlayers.map((player) => player.lock?.id).filter(Boolean))];
  const selectedLocks = locks.filter((lock) => selectedLockIds.includes(lock.id));
  const lockCandidates = selectedPlayers.filter((player) => player.eligible && !player.lock);

  const availability = useMemo(() => players.reduce((summary, player) => {
    if (isDoneForToday(player)) summary.done += 1;
    const reason = getPlayerConfigurationReason(player, matchType, category);
    if (!reason) summary.available += 1;
    else if (player.eligible) summary.categoryBlocked += 1;
    if (player.status === "playing") summary.playing += 1;
    if (player.status === "assigned") summary.assigned += 1;
    return summary;
  }, { available: 0, categoryBlocked: 0, playing: 0, assigned: 0, done: 0 }), [category, matchType, players]);

  const filteredPlayers = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = visiblePlayers.filter((player) => {
      const reason = getPlayerConfigurationReason(player, matchType, category);
      return (!query || player.name.toLowerCase().includes(query))
        && (levelFilter === "all" || normalizePlayerLevel(player.level) === levelFilter)
        && (genderFilter === "all" || player.gender === genderFilter)
        && (availabilityFilter === "all" || (availabilityFilter === "available" ? !reason : Boolean(reason)));
    });
    return filtered.sort((first, second) => {
      const firstReason = getPlayerConfigurationReason(first, matchType, category);
      const secondReason = getPlayerConfigurationReason(second, matchType, category);
      return Number(Boolean(firstReason)) - Number(Boolean(secondReason)) || first.name.localeCompare(second.name);
    });
  }, [availabilityFilter, category, genderFilter, levelFilter, matchType, search, visiblePlayers]);

  const pagination = getPagination(filteredPlayers.length, page, pageSize);
  const pagedPlayers = filteredPlayers.slice(pagination.startIndex, pagination.endIndex);
  const selectablePagePlayers = pagedPlayers.filter((player) => !getPlayerConfigurationReason(player, matchType, category));
  const allPageSelected = selectablePagePlayers.length > 0 && selectablePagePlayers.every((player) => selectedIdSet.has(player.id));
  const primaryPreview = preview.matches[0] || null;
  const previewWarnings = [...new Set([...preview.warnings, ...(primaryPreview?.warnings || [])])];
  const preferencePlayer = players.find((player) => player.id === preferencePlayerId) || null;

  const togglePlayer = (playerId) => {
    const next = new Set(selectedIdSet);
    if (next.has(playerId)) next.delete(playerId);
    else next.add(playerId);
    onSelectionChange([...next]);
  };
  const handlePlayerRowClick = (event, playerId, disabled) => {
    if (disabled || event.target.closest?.("button, input, select, textarea, a, [role='button']")) return;
    togglePlayer(playerId);
  };
  const toggleSelectPage = () => {
    const next = new Set(selectedIdSet);
    selectablePagePlayers.forEach((player) => {
      if (allPageSelected) next.delete(player.id);
      else next.add(player.id);
    });
    onSelectionChange([...next]);
  };
  const updateFilter = (setter) => (event) => {
    setter(event.target.value);
    setPage(1);
  };
  const handleCreateLock = async () => {
    const firstId = Number(firstLockPlayerId);
    const secondId = Number(secondLockPlayerId);
    if (!firstId || !secondId || firstId === secondId) return;
    const saved = await onCreateLock(firstId, secondId);
    if (saved) {
      setFirstLockPlayerId("");
      setSecondLockPlayerId("");
      setLockModalOpen(false);
    }
  };

  const readinessClasses = {
    ready: "bg-[var(--success-light)] text-[var(--success)]",
    attention: "bg-[var(--warning-light)] text-[var(--warning)]",
    blocked: "bg-[var(--danger-light)] text-[var(--danger)]",
  };
  const ReadinessIcon = preview.tone === "ready" ? CheckCircle2 : preview.tone === "attention" ? AlertTriangle : XCircle;

  return (
    <>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <section className="self-start rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 xl:sticky xl:top-0">
          <div>
            <h2 className="text-lg font-semibold text-[var(--text-h)]">Match Configuration</h2>
          </div>

          <div className="mt-6">
            <p className="mb-2 text-sm font-medium">Match Type</p>
            <div className="grid grid-cols-2 gap-2">
              {["singles", "doubles"].map((value) => <button key={value} type="button" onClick={() => onMatchTypeChange(value)} className={`rounded-xl border py-2 transition ${matchType === value ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--border)]"}`}>{value === "singles" ? "Singles" : "Doubles"}</button>)}
            </div>
          </div>

          <div className="mt-6">
            <p className="mb-2 text-sm font-medium">Category</p>
            <div className="space-y-2">
              {["no_gender", ...(matchType === "doubles" ? ["mixed"] : []), "mens", "womens"].map((value) => <button key={value} type="button" onClick={() => onCategoryChange(value)} className={`w-full rounded-xl border py-2 ${category === value ? "border-[var(--primary)] bg-[var(--primary)] text-white" : "border-[var(--border)]"}`}>{categoryLabel(value)}</button>)}
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-[var(--primary)]/30 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-[var(--primary)]">Match Preview</p>
              <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold ${readinessClasses[preview.tone]}`}><ReadinessIcon size={11} /> {preview.canGenerate ? "Ready" : "Not ready"}</span>
            </div>
            {primaryPreview && <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2"><PreviewTeam label={matchType === "singles" ? "Player A" : "Team A"} players={primaryPreview.teamA} tone="primary" /><span className="text-xs font-bold text-[var(--text)]/50">VS</span><PreviewTeam label={matchType === "singles" ? "Player B" : "Team B"} players={primaryPreview.teamB} tone="warning" /></div>}
            <p className="mt-3 text-sm text-[var(--text)]">{preview.message}</p>
            {(preview.unmatchedPlayers[0]?.reason || previewWarnings[0]) && <p className="mt-2 rounded-lg bg-[var(--warning-light)] px-2.5 py-2 text-xs text-[var(--warning)]">{preview.unmatchedPlayers[0]?.reason || previewWarnings[0]}</p>}
          </div>

          <button type="button" disabled={isGenerating || !preview.canGenerate} onClick={onGenerate} className="mt-4 w-full rounded-xl bg-[var(--primary)] py-3 font-semibold text-white transition hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-50">{isGenerating ? "Generating..." : preview.matches.length > 0 ? `Generate ${preview.matches.length} Match${preview.matches.length === 1 ? "" : "es"}` : "Generate Matches"}</button>
        </section>

        <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] xl:col-span-2">
          <div className="border-b border-[var(--border)] p-4">
            <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div><h2 className="font-semibold text-[var(--text-h)]">Available Players</h2><p className="text-sm text-[var(--text)]">Select registered players for this match.</p></div>
              <div className="flex flex-wrap gap-2 text-xs"><span><strong className="text-[var(--success)]">{availability.available}</strong> Available</span><span><strong className="text-[var(--primary)]">{availability.playing}</strong> Playing</span><span><strong className="text-[var(--warning)]">{availability.assigned}</strong> Assigned</span><span><strong className="text-[var(--text-h)]">{availability.done}</strong> Done</span><span><strong className="text-[var(--danger)]">{availability.categoryBlocked}</strong> Category mismatch</span></div>
            </div>
            <div className="mb-4 rounded-xl bg-[var(--surface-hover)] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div><p className="text-sm font-semibold text-[var(--text-h)]">Selected: {selectedPlayers.length} players</p><p className="mt-0.5 text-xs text-[var(--text)]">{preview.canGenerate ? "Ready to generate" : preview.message}{category === "mixed" && selectedPlayers.length > 0 ? ` · ${maleCount} male, ${femaleCount} female` : ""}</p></div>
                <div className="flex items-center gap-2 text-xs">{matchType === "doubles" && <button type="button" disabled={selectedPlayers.length < 2} onClick={() => setLockModalOpen(true)} className="rounded-lg bg-purple-100 px-2.5 py-1 font-semibold text-purple-800 disabled:opacity-40"><Link2 className="mr-1 inline h-3 w-3" /> Manage Locks</button>}<button type="button" disabled={selectedPlayers.length === 0} onClick={() => onSelectionChange([])} className="font-semibold text-[var(--primary)] disabled:opacity-40">Clear</button></div>
              </div>
              {selectedPlayers.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{selectedPlayers.slice(0, 8).map((player) => <button key={player.id} type="button" onClick={() => togglePlayer(player.id)} title={`Remove ${player.name}`} className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getLevelClasses(player.level)}`}>{player.name} ×</button>)}{selectedPlayers.length > 8 && <span className="px-2 py-0.5 text-[10px] font-semibold text-[var(--text)]">+{selectedPlayers.length - 8} more</span>}</div>}
            </div>
            <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[minmax(12rem,1fr)_10rem_9rem_11rem]">
              <label className="relative"><span className="sr-only">Search players</span><Search className="absolute left-3 top-2.5 h-4 w-4 text-[var(--text)]" /><input value={search} onChange={updateFilter(setSearch)} placeholder="Search player..." className="w-full rounded-xl border border-[var(--border)] py-2 pl-9 pr-3 text-sm outline-none" /></label>
              <select value={levelFilter} onChange={updateFilter(setLevelFilter)} aria-label="Filter player level" className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2 py-2 text-xs"><option value="all">All Levels</option>{LEVELS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
              <select value={genderFilter} onChange={updateFilter(setGenderFilter)} aria-label="Filter player gender" className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2 py-2 text-xs"><option value="all">All Genders</option><option value="male">Male</option><option value="female">Female</option></select>
              <select value={availabilityFilter} onChange={updateFilter(setAvailabilityFilter)} aria-label="Filter availability" className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-2 py-2 text-xs"><option value="all">All Availability</option><option value="available">Available</option><option value="unavailable">Unavailable</option></select>
            </div>
            <label className="mt-3 flex items-center gap-2 text-sm text-[var(--text)]"><input type="checkbox" checked={allPageSelected} onChange={toggleSelectPage} /> Select all eligible players on this page <span className="ml-auto">Selected: <strong className="text-[var(--text-h)]">{selectedPlayers.length}</strong></span></label>
          </div>

          <div className="divide-y divide-[var(--border)]">
            {isLoading ? <p className="p-10 text-center text-sm text-[var(--text)]">Loading today&apos;s players...</p> : visiblePlayers.length === 0 ? <div className="p-10 text-center"><Users className="mx-auto h-7 w-7 text-[var(--text)]" /><p className="mt-2 font-medium text-[var(--text-h)]">No players are currently available for matchmaking.</p><p className="mt-1 text-xs text-[var(--text)]">Players marked done remain recorded in Player Management and match history.</p></div> : filteredPlayers.length === 0 ? <div className="p-10 text-center"><Users className="mx-auto h-7 w-7 text-[var(--text)]" /><p className="mt-2 font-medium text-[var(--text-h)]">No players match these filters</p><p className="mt-1 text-xs text-[var(--text)]">Change the category or clear a filter.</p></div> : pagedPlayers.map((player) => {
              const reason = getPlayerConfigurationReason(player, matchType, category);
              const selected = selectedIdSet.has(player.id);
              const badge = getStatusBadge(player, reason);
              return (
                <div
                  key={player.id}
                  title={reason || undefined}
                  onClick={(event) => handlePlayerRowClick(event, player.id, Boolean(reason))}
                  className={`flex items-center gap-3 border-l-4 px-4 py-2.5 transition-colors duration-150 ${selected ? "border-l-[var(--primary)] bg-[var(--primary-light)]/70" : "border-l-transparent hover:bg-[var(--surface-hover)]/70"} ${reason ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
                >
                  <input
                    type="checkbox"
                    checked={selected}
                    disabled={Boolean(reason)}
                    onClick={(event) => event.stopPropagation()}
                    onChange={() => togglePlayer(player.id)}
                    aria-label={`Select ${player.name}`}
                  />
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="truncate text-sm font-medium text-[var(--text-h)]">{player.name}</span>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getLevelClasses(player.level)}`}>{getLevelLabel(player.level)}</span>
                    {category === "mixed" && <span className="text-xs capitalize text-[var(--text)]">{player.gender}</span>}
                    {player.lockedTeammateName && <span title={`Locked with ${player.lockedTeammateName}`} className="text-purple-700"><Link2 size={13} /></span>}
                  </div>
                  <span title={reason || undefined} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badge.classes}`}>{badge.label}</span>
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      setPreferencePlayerId(player.id);
                    }}
                    title="Player match settings"
                    className="rounded-lg p-2 text-[var(--text)] hover:bg-[var(--surface-hover)]"
                  >
                    <Settings2 size={15} />
                  </button>
                </div>
              );
            })}
          </div>
          {!isLoading && filteredPlayers.length > 0 && <PaginationControls page={pagination.currentPage} pageSize={pageSize} totalRecords={filteredPlayers.length} itemLabel="players" onPageChange={setPage} onPageSizeChange={(size) => { setPageSize(size); setPage(1); }} />}
        </section>
      </div>

      <Modal open={lockModalOpen} onClose={() => setLockModalOpen(false)} title="Manage Teammate Lock">
        <div className="space-y-4">
          <p className="text-sm text-[var(--text)]">Lock two selected players together for today.</p>
          <div className="grid gap-2 sm:grid-cols-2"><select value={firstLockPlayerId} onChange={(event) => setFirstLockPlayerId(event.target.value)} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"><option value="">First teammate</option>{lockCandidates.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}</select><select value={secondLockPlayerId} onChange={(event) => setSecondLockPlayerId(event.target.value)} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"><option value="">Second teammate</option>{lockCandidates.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}</select></div>
          {selectedLocks.length > 0 && <div className="space-y-2">{selectedLocks.map((lock) => <div key={lock.id} className="flex items-center justify-between gap-3 rounded-xl bg-purple-50 px-3 py-2 text-sm text-purple-800"><span>{lock.player1Name} + {lock.player2Name}</span><button type="button" disabled={lockActionId !== null} onClick={() => onRemoveLock(lock.id)} className="font-semibold disabled:opacity-40">Unlock</button></div>)}</div>}
          <div className="flex justify-end gap-2"><button type="button" onClick={() => setLockModalOpen(false)} className="rounded-xl bg-[var(--surface-hover)] px-4 py-2 text-sm">Close</button><button type="button" disabled={lockActionId !== null || !firstLockPlayerId || !secondLockPlayerId || firstLockPlayerId === secondLockPlayerId} onClick={handleCreateLock} className="rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Lock Teammates</button></div>
        </div>
      </Modal>

      <Modal open={preferencePlayer !== null} onClose={() => setPreferencePlayerId(null)} title={preferencePlayer ? `${preferencePlayer.name} Match Settings` : "Player Match Settings"}>
        {preferencePlayer && <div className="space-y-4">
          <div className="flex items-center justify-between gap-3"><div><p className="font-semibold text-[var(--text-h)]">{preferencePlayer.name}</p><p className="text-sm text-[var(--text)]">{getLevelLabel(preferencePlayer.level)} · {preferencePlayer.gender || "Unknown gender"}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusBadge(preferencePlayer, getPlayerConfigurationReason(preferencePlayer, matchType, category)).classes}`}>{getStatusBadge(preferencePlayer, getPlayerConfigurationReason(preferencePlayer, matchType, category)).label}</span></div>
          <div className="rounded-xl bg-[var(--surface-hover)] p-3 text-sm text-[var(--text)]"><p>Today: <strong className="text-[var(--text-h)]">{preferencePlayer.matchCount} matches</strong> · {preferencePlayer.wins} wins · {preferencePlayer.losses} losses</p>{preferencePlayer.lockedTeammateName && <p className="mt-1">Locked with: <strong className="text-[var(--text-h)]">{preferencePlayer.lockedTeammateName}</strong></p>}</div>
          <label className="block text-sm font-medium text-[var(--text-h)]">Rank Preference<select value={preferencePlayer.rankPreference} disabled={!preferencePlayer.eligible || preferenceActionId === preferencePlayer.id} onChange={(event) => onPreferenceChange(preferencePlayer.id, event.target.value)} className="mt-2 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2"><option value="same_rank">Same Rank Only</option><option value="adjacent_rank">Adjacent Rank Allowed</option></select></label>
          {getPlayerConfigurationReason(preferencePlayer, matchType, category) && <p className="rounded-xl bg-[var(--warning-light)] p-3 text-sm text-[var(--warning)]">{getPlayerConfigurationReason(preferencePlayer, matchType, category)}</p>}
          <div className="flex justify-end"><button type="button" onClick={() => setPreferencePlayerId(null)} className="rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white">Done</button></div>
        </div>}
      </Modal>
    </>
  );
}
