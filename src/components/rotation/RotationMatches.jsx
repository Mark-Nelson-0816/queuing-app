import {
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Edit3,
  History,
  Play,
  Scale,
  Search,
  Trash2,
  Unlock,
} from "lucide-react";
import { useMemo, useState } from "react";
import PaginationControls from "../PaginationControls";
import { getPagination } from "../../utils/pagination";
import { getLevelClasses, getLevelLabel } from "../../utils/playerLevel";

function formatLabel(value) {
  if (value === "no_gender") return "No Gender";
  if (value === "mens") return "Men's";
  if (value === "womens") return "Women's";
  if (value === "mixed") return "Mixed";
  return value ? value.charAt(0).toUpperCase() + value.slice(1).replaceAll("_", " ") : "Unknown";
}

function formatTime(value) {
  if (!value) return "Time unavailable";
  const date = new Date(`${value}Z`);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function playerNames(match) {
  return match.players.map((player) => player.name).join(" · ");
}

const statusClasses = {
  waiting: "bg-[var(--warning-light)] text-[var(--warning)]",
  incomplete: "bg-[var(--danger-light)] text-[var(--danger)]",
  playing: "bg-[var(--primary-light)] text-[var(--primary)]",
  finished: "bg-[var(--success-light)] text-[var(--success)]",
};

function TeamPlayers({ players }) {
  if (players.length === 0) return <p className="mt-1 text-xs text-[var(--danger)]">Empty player slot</p>;
  return (
    <div className="mt-1 flex flex-wrap gap-1.5">
      {players.map((player) => (
        <span key={player.id} title={getLevelLabel(player.level)} className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${getLevelClasses(player.level)}`}>
          {player.name}
        </span>
      ))}
    </div>
  );
}

function RotationMatchCard({
  match,
  queueSortActive,
  busyAction,
  onEdit,
  onRebalance,
  onReorder,
  onCancel,
  onStart,
  onFinish,
  onUnlock,
  detailsOpen,
  onToggleDetails,
}) {
  const editable = ["waiting", "incomplete"].includes(match.status);
  const actionIsBusy = busyAction !== null;
  const lockIds = [...new Set(match.players.map((player) => player.lockId).filter(Boolean))];
  const singles = match.matchType === "singles";

  return (
    <article className="space-y-3 rounded-xl border border-[var(--border)] p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          {editable && <p className="text-xs font-semibold text-[var(--text)]">Queue #{match.queuePosition ?? "—"}</p>}
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClasses[match.status]}`}>{formatLabel(match.status)}</span>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-3">
        <div className={`${match.winnerTeam === 1 ? "border border-[var(--success)]/30 bg-[var(--success-light)]" : "bg-[var(--primary-light)]/50"} rounded-xl p-3`}>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--primary)]">{singles ? "Player A" : "Team A"}</p>
          <TeamPlayers players={match.teamA} />
        </div>
        <span className="self-center text-xs font-bold text-[var(--text)] opacity-50">VS</span>
        <div className={`${match.winnerTeam === 2 ? "border border-[var(--success)]/30 bg-[var(--success-light)]" : "bg-[var(--warning-light)]/50"} rounded-xl p-3`}>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--warning)]">{singles ? "Player B" : "Team B"}</p>
          <TeamPlayers players={match.teamB} />
        </div>
      </div>

      {match.court && <div className="rounded-xl bg-[var(--surface-hover)] px-3 py-2 text-center text-sm text-[var(--text-h)]">Court: <strong>{match.court.name}</strong></div>}
      {match.status === "incomplete" && match.validationMessage && <p className="rounded-xl bg-[var(--danger-light)] px-3 py-2 text-xs text-[var(--danger)]">{match.validationMessage}</p>}

      {editable && (
        <div className="space-y-2">
          <div className="flex gap-2">
            {match.status === "incomplete" && <button type="button" disabled={actionIsBusy} onClick={() => onEdit(match)} className="flex-1 rounded-xl bg-[var(--primary)] px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50"><Edit3 className="mr-1 inline h-4 w-4" /> Edit Match</button>}
            {match.status === "waiting" && <button type="button" disabled={actionIsBusy} onClick={() => onStart(match)} className="flex-1 rounded-xl bg-[var(--primary)] px-3 py-2.5 text-sm font-semibold text-white hover:bg-[var(--primary-hover)] disabled:opacity-50"><Play className="mr-1 inline h-4 w-4" /> Start Match</button>}
            <button type="button" onClick={onToggleDetails} className="rounded-xl border border-[var(--border)] px-3 py-2.5 text-xs font-semibold text-[var(--text-h)]">{detailsOpen ? <ChevronDown className="mr-1 inline h-4 w-4" /> : <ChevronRight className="mr-1 inline h-4 w-4" />} Details</button>
          </div>
        </div>
      )}

      {match.status === "playing" && <><div className="grid grid-cols-2 gap-2"><button type="button" disabled={actionIsBusy} onClick={() => onFinish(match, 1)} className="rounded-xl bg-[var(--primary)] px-3 py-2.5 text-xs font-semibold text-white disabled:opacity-50">{singles ? `${match.teamA[0]?.name || "Player A"} Won` : "Team A Won"}</button><button type="button" disabled={actionIsBusy} onClick={() => onFinish(match, 2)} className="rounded-xl bg-[var(--warning)] px-3 py-2.5 text-xs font-semibold text-white disabled:opacity-50">{singles ? `${match.teamB[0]?.name || "Player B"} Won` : "Team B Won"}</button></div><button type="button" onClick={onToggleDetails} className="w-full rounded-xl border border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--text-h)]">{detailsOpen ? <ChevronDown className="mr-1 inline h-4 w-4" /> : <ChevronRight className="mr-1 inline h-4 w-4" />} Details</button></>}
      {match.status === "finished" && <div className="rounded-xl bg-[var(--success-light)] px-3 py-2 text-center text-sm font-semibold text-[var(--success)]">Winner: {singles ? (match.winnerTeam === 1 ? match.teamA[0]?.name : match.teamB[0]?.name) : `Team ${match.winnerTeam === 1 ? "A" : "B"}`}</div>}
      {match.status === "finished" && <button type="button" onClick={onToggleDetails} className="w-full rounded-xl border border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--text-h)]">{detailsOpen ? <ChevronDown className="mr-1 inline h-4 w-4" /> : <ChevronRight className="mr-1 inline h-4 w-4" />} Details</button>}

      {detailsOpen && <div className="space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface-hover)]/40 p-3">
        <div className="flex flex-wrap justify-between gap-2 text-xs text-[var(--text)]"><span>{formatLabel(match.category)} · {formatLabel(match.matchType)}</span><span>{formatTime(match.status === "playing" ? match.startTime : match.createdAt)}</span><span>Balance: <strong className="text-[var(--text-h)]">{match.teamAStrength}–{match.teamBStrength} ({match.balanceDifference})</strong></span>{lockIds.length > 0 && <span className="font-semibold text-purple-700">Locked team</span>}</div>
        {match.validationMessage && match.status !== "incomplete" && <p className="rounded-lg bg-[var(--danger-light)] px-3 py-2 text-xs text-[var(--danger)]">{match.validationMessage}</p>}
        {match.warnings.slice(0, 2).map((warning) => <p key={warning} className="rounded-lg bg-[var(--warning-light)] px-3 py-2 text-xs text-[var(--warning)]">{warning}</p>)}
        {editable && <div className="flex flex-wrap gap-2 border-t border-[var(--border)] pt-3">
          <button type="button" title={queueSortActive ? "Move up" : "Return to queue sorting to reorder"} disabled={actionIsBusy || !queueSortActive} onClick={() => onReorder(match.id, "up")} className="rounded-lg border border-[var(--border)] p-2 text-[var(--text-h)] disabled:opacity-40"><ArrowUp size={14} /></button>
          <button type="button" title={queueSortActive ? "Move down" : "Return to queue sorting to reorder"} disabled={actionIsBusy || !queueSortActive} onClick={() => onReorder(match.id, "down")} className="rounded-lg border border-[var(--border)] p-2 text-[var(--text-h)] disabled:opacity-40"><ArrowDown size={14} /></button>
          <button type="button" disabled={actionIsBusy} onClick={() => onEdit(match)} className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] px-3 py-2 text-xs font-semibold text-[var(--text-h)] disabled:opacity-40"><Edit3 size={13} /> Edit</button>
          <button type="button" disabled={actionIsBusy || match.players.length === 0} onClick={() => onRebalance(match.id)} className="inline-flex items-center gap-1 rounded-lg bg-blue-100 px-3 py-2 text-xs font-semibold text-blue-800 disabled:opacity-40"><Scale size={13} /> Rebalance</button>
          {lockIds.map((lockId) => <button key={lockId} type="button" disabled={actionIsBusy} onClick={() => onUnlock(lockId)} className="inline-flex items-center gap-1 rounded-lg bg-purple-100 px-3 py-2 text-xs font-semibold text-purple-800 disabled:opacity-40"><Unlock size={13} /> Unlock</button>)}
          <button type="button" disabled={actionIsBusy} onClick={() => onCancel(match)} className="ml-auto inline-flex items-center gap-1 rounded-lg bg-[var(--danger-light)] px-3 py-2 text-xs font-semibold text-[var(--danger)] disabled:opacity-40"><Trash2 size={13} /> Cancel</button>
        </div>}
      </div>}
    </article>
  );
}

export default function RotationMatches({ matches, isLoading, busyAction, onEdit, onRebalance, onReorder, onCancel, onStart, onFinish, onUnlock }) {
  const [waitingSearch, setWaitingSearch] = useState("");
  const [waitingSort, setWaitingSort] = useState("queue");
  const [waitingPage, setWaitingPage] = useState(1);
  const [waitingPageSize, setWaitingPageSize] = useState(10);
  const [finishedOpen, setFinishedOpen] = useState(false);
  const [finishedPage, setFinishedPage] = useState(1);
  const [finishedPageSize, setFinishedPageSize] = useState(10);
  const [detailMatchIds, setDetailMatchIds] = useState([]);

  const waitingMatches = useMemo(() => {
    const query = waitingSearch.trim().toLowerCase();
    const filtered = matches.filter((match) => ["waiting", "incomplete"].includes(match.status) && (!query || playerNames(match).toLowerCase().includes(query)));
    if (waitingSort === "queue") return filtered;
    return [...filtered].sort((first, second) => waitingSort === "status" ? first.status.localeCompare(second.status) || Number(first.queuePosition) - Number(second.queuePosition) : Date.parse(`${second.createdAt || ""}Z`) - Date.parse(`${first.createdAt || ""}Z`));
  }, [matches, waitingSearch, waitingSort]);
  const playingMatches = matches.filter((match) => match.status === "playing");
  const finishedMatches = matches.filter((match) => match.status === "finished");
  const waitingPagination = getPagination(waitingMatches.length, waitingPage, waitingPageSize);
  const finishedPagination = getPagination(finishedMatches.length, finishedPage, finishedPageSize);
  const pagedWaiting = waitingMatches.slice(waitingPagination.startIndex, waitingPagination.endIndex);
  const pagedFinished = finishedMatches.slice(finishedPagination.startIndex, finishedPagination.endIndex);
  const queueSortActive = waitingSort === "queue";
  const cardProps = { busyAction, onEdit, onRebalance, onReorder, onCancel, onStart, onFinish, onUnlock };
  const renderMatchCard = (match, sortActive = true) => <RotationMatchCard key={match.id} match={match} queueSortActive={sortActive} detailsOpen={detailMatchIds.includes(match.id)} onToggleDetails={() => setDetailMatchIds((current) => current.includes(match.id) ? current.filter((id) => id !== match.id) : [...current, match.id])} {...cardProps} />;

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <div className="flex flex-col justify-between gap-4 border-b border-[var(--border)] p-5 lg:flex-row lg:items-center">
          <div><div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-semibold text-[var(--text-h)]">Generated Waiting Matches</h2><span className="rounded-full bg-[var(--warning-light)] px-2.5 py-1 text-xs font-semibold text-[var(--warning)]">{waitingMatches.length} Waiting</span></div><p className="mt-1 text-sm text-[var(--text)]">Review teams, adjust queue order, then assign an available court.</p></div>
          <div className="flex min-w-0 flex-1 gap-2 lg:max-w-xl"><label className="relative min-w-0 flex-1"><span className="sr-only">Search waiting matches</span><Search className="absolute left-3 top-2.5 h-4 w-4 text-[var(--text)]" /><input value={waitingSearch} onChange={(event) => { setWaitingSearch(event.target.value); setWaitingPage(1); }} placeholder="Search player..." className="w-full rounded-xl border border-[var(--border)] py-2 pl-9 pr-3 text-sm" /></label><select value={waitingSort} onChange={(event) => { setWaitingSort(event.target.value); setWaitingPage(1); }} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"><option value="queue">Queue Order</option><option value="status">Status</option><option value="created">Newest</option></select></div>
        </div>
        <div className="p-5">
          {isLoading ? <p className="py-10 text-center text-[var(--text)]">Loading waiting matches...</p> : waitingMatches.length === 0 ? <div className="py-10 text-center text-[var(--text)]"><p className="font-semibold text-[var(--text-h)]">No waiting matches</p><p className="mt-1 text-sm">Generate a match above to add it to the queue.</p></div> : <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">{pagedWaiting.map((match) => renderMatchCard(match, queueSortActive))}</div>}
        </div>
        {!isLoading && waitingMatches.length > 0 && <PaginationControls page={waitingPagination.currentPage} pageSize={waitingPageSize} totalRecords={waitingMatches.length} itemLabel="matches" onPageChange={setWaitingPage} onPageSizeChange={(size) => { setWaitingPageSize(size); setWaitingPage(1); }} />}
      </section>

      <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] p-5"><div><div className="flex items-center gap-2"><h2 className="text-lg font-semibold text-[var(--text-h)]">Playing Matches</h2><span className="rounded-full bg-[var(--primary-light)] px-2.5 py-1 text-xs font-semibold text-[var(--primary)]">{playingMatches.length} Playing</span></div><p className="mt-1 text-sm text-[var(--text)]">Select the winning team when play is complete.</p></div></div>
        <div className="p-5">{isLoading ? <p className="py-8 text-center text-[var(--text)]">Loading playing matches...</p> : playingMatches.length === 0 ? <div className="py-8 text-center text-[var(--text)]"><p className="font-semibold text-[var(--text-h)]">No matches currently playing</p><p className="mt-1 text-sm">Start a waiting match after selecting a court.</p></div> : <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">{playingMatches.map((match) => renderMatchCard(match))}</div>}</div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <button type="button" onClick={() => setFinishedOpen((current) => !current)} className="flex w-full items-center justify-between gap-3 p-5 text-left hover:bg-[var(--surface-hover)]/50"><div className="flex items-center gap-3"><span className="rounded-xl bg-[var(--success-light)] p-2 text-[var(--success)]"><History size={18} /></span><div><h2 className="font-semibold text-[var(--text-h)]">Finished Matches</h2><p className="mt-1 text-sm text-[var(--text)]">Open saved match history when needed.</p></div></div><div className="flex items-center gap-2"><span className="rounded-full bg-[var(--success-light)] px-2.5 py-1 text-xs font-semibold text-[var(--success)]">{finishedMatches.length} Finished</span>{finishedOpen ? <ChevronDown className="text-[var(--text)]" /> : <ChevronRight className="text-[var(--text)]" />}</div></button>
        {finishedOpen && <><div className="border-t border-[var(--border)] p-5">{finishedMatches.length === 0 ? <p className="py-8 text-center text-[var(--text)]">Finished match history will appear here.</p> : <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">{pagedFinished.map((match) => renderMatchCard(match))}</div>}</div>{finishedMatches.length > 0 && <PaginationControls page={finishedPagination.currentPage} pageSize={finishedPageSize} totalRecords={finishedMatches.length} itemLabel="matches" onPageChange={setFinishedPage} onPageSizeChange={(size) => { setFinishedPageSize(size); setFinishedPage(1); }} />}</>}
      </section>
    </div>
  );
}
