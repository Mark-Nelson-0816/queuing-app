import { useEffect, useMemo, useState } from "react";
import { MapPin, Swords, Trophy } from "lucide-react";
import PaginationControls from "../PaginationControls";
import { getPagination } from "../../utils/pagination";
import { getLevelClasses } from "../../utils/playerLevel";
import { validateTournamentScoreInput } from "../../utils/tournamentScore";
import {
  CATEGORY_LABELS,
  DIVISION_LABELS,
  LEVEL_LABELS,
} from "./TournamentOptions";

const STATUS_OPTIONS = ["all", "waiting", "playing", "finished"];

// Displays one team consistently in waiting, playing, and finished match cards.
function MatchTeam({
  team,
  side,
  winner,
  showPlayingIndicators,
  playingPlayerById,
}) {
  return (
    <div className={`rounded-xl border p-3 ${winner ? "border-[var(--success)] bg-[var(--success-light)]/40" : "border-[var(--border)] bg-[var(--surface-hover)]/60"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text)]">
            {side} · Team {team?.teamNumber}
          </p>
          <div className="mt-1 space-y-1">
            {team?.players?.length ? team.players.map((player) => {
              const activeMatch = showPlayingIndicators
                ? playingPlayerById?.get(Number(player.playerId))
                : null;
              const statusDetails = activeMatch
                ? [
                  `Tournament match #${activeMatch.matchId}`,
                  activeMatch.courtName,
                ].filter(Boolean).join(" on ")
                : "";

              return (
                <div key={player.participantId || player.playerId} className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-[var(--text-h)]">{player.name}</span>
                  {activeMatch && (
                    <span
                      title={statusDetails}
                      className="rounded-full bg-[var(--primary-light)] px-2 py-0.5 text-[10px] font-semibold text-[var(--primary)]"
                    >
                      Playing
                    </span>
                  )}
                </div>
              );
            }) : (
              <p className="font-semibold text-[var(--text-h)]">Unknown team</p>
            )}
          </div>
        </div>
        {winner && (
          <span className="rounded-full bg-[var(--success)] px-2 py-1 text-[10px] font-semibold text-white">
            Winner
          </span>
        )}
      </div>
    </div>
  );
}

// Displays and operates one Tournament match without introducing queue ordering.
function TournamentMatchCard({
  item,
  courtId,
  availableCourts,
  readOnly,
  starting,
  finishing,
  updating,
  editingResult,
  canEditResult,
  playingPlayerById,
  scoreValues,
  onCourtChange,
  onScoreChange,
  onStart,
  onReviewResult,
  onBeginEditResult,
  onCancelEditResult,
  onReviewResultUpdate,
}) {
  const { match, group, round } = item;
  const isPlaying = match.status === "playing";
  const isFinished = match.status === "finished";
  const scoreValidation = validateTournamentScoreInput(
    scoreValues.teamA,
    scoreValues.teamB,
  );
  const hasSavedScore = Number.isInteger(match.teamAScore)
    && Number.isInteger(match.teamBScore);
  const scoreIsUnchanged = hasSavedScore
    && scoreValidation.valid
    && scoreValidation.teamAScore === match.teamAScore
    && scoreValidation.teamBScore === match.teamBScore;

  return (
    <article className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-[var(--primary-light)] px-2.5 py-1 text-xs font-semibold text-[var(--primary)]">
            {group.name}
          </span>
          <span className="text-xs font-semibold text-[var(--text)]">Round {round.roundNumber}</span>
          <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
            match.status === "playing"
              ? "bg-[var(--primary-light)] text-[var(--primary)]"
              : match.status === "finished"
                ? "bg-[var(--success-light)] text-[var(--success)]"
                : "bg-[var(--warning-light)] text-[var(--warning)]"
          }`}>
            {match.status}
          </span>
        </div>
        <span className="text-[10px] font-semibold text-[var(--text)]">Match #{match.id}</span>
      </div>

      {match.court && (
        <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-[var(--text-h)]">
          <MapPin className="h-3.5 w-3.5 text-[var(--primary)]" />
          {match.court.name}
        </p>
      )}

      <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_auto_1fr] lg:items-center">
        <MatchTeam
          team={match.teamA}
          side="Team A"
          winner={isFinished && match.winnerTeamId === match.teamAId}
          showPlayingIndicators={match.status === "waiting"}
          playingPlayerById={playingPlayerById}
        />
        <div className="text-center">
          {isFinished && hasSavedScore ? (
            <p className="text-base font-bold text-[var(--text-h)]">
              {match.teamAScore} - {match.teamBScore}
            </p>
          ) : (
            <span className="text-xs font-bold text-[var(--text)]">VS</span>
          )}
        </div>
        <MatchTeam
          team={match.teamB}
          side="Team B"
          winner={isFinished && match.winnerTeamId === match.teamBId}
          showPlayingIndicators={match.status === "waiting"}
          playingPlayerById={playingPlayerById}
        />
      </div>

      {isPlaying && !readOnly && (
        <div className="mt-4 border-t border-[var(--border)] pt-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5 text-xs font-semibold text-[var(--text-h)]">
              <span>Team A Score</span>
              <input
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                value={scoreValues.teamA}
                disabled={finishing}
                onChange={(event) => onScoreChange(match.id, "teamA", event.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm disabled:opacity-50"
              />
            </label>
            <label className="space-y-1.5 text-xs font-semibold text-[var(--text-h)]">
              <span>Team B Score</span>
              <input
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                value={scoreValues.teamB}
                disabled={finishing}
                onChange={(event) => onScoreChange(match.id, "teamB", event.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm disabled:opacity-50"
              />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className={`text-xs font-semibold ${scoreValidation.valid ? "text-[var(--success)]" : "text-[var(--warning)]"}`}>
              {scoreValidation.message}
            </p>
            <button
              type="button"
              disabled={!scoreValidation.valid || finishing}
              onClick={() => onReviewResult(match, scoreValidation)}
              className="rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {finishing ? "Saving Result..." : "Review Result"}
            </button>
          </div>
        </div>
      )}

      {isFinished && canEditResult && !editingResult && (
        <div className="mt-4 flex justify-end border-t border-[var(--border)] pt-4">
          <button
            type="button"
            disabled={updating}
            onClick={() => onBeginEditResult(match)}
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-sm font-semibold text-[var(--text-h)] hover:bg-[var(--surface-hover)] disabled:opacity-50"
          >
            Edit Result
          </button>
        </div>
      )}

      {isFinished && canEditResult && editingResult && (
        <div className="mt-4 border-t border-[var(--border)] pt-4">
          <p className="mb-3 text-xs font-semibold text-[var(--text-h)]">
            Correct the saved result. The match remains finished and its Court will not change.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5 text-xs font-semibold text-[var(--text-h)]">
              <span>Team A Score</span>
              <input
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                value={scoreValues.teamA}
                disabled={updating}
                onChange={(event) => onScoreChange(match.id, "teamA", event.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm disabled:opacity-50"
              />
            </label>
            <label className="space-y-1.5 text-xs font-semibold text-[var(--text-h)]">
              <span>Team B Score</span>
              <input
                type="number"
                min="0"
                step="1"
                inputMode="numeric"
                value={scoreValues.teamB}
                disabled={updating}
                onChange={(event) => onScoreChange(match.id, "teamB", event.target.value)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm disabled:opacity-50"
              />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className={`text-xs font-semibold ${scoreValidation.valid && !scoreIsUnchanged ? "text-[var(--success)]" : "text-[var(--warning)]"}`}>
              {scoreIsUnchanged ? "No score changes to review." : scoreValidation.message}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={updating}
                onClick={onCancelEditResult}
                className="rounded-xl bg-[var(--surface-hover)] px-4 py-2.5 text-sm font-semibold text-[var(--text)] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!scoreValidation.valid || scoreIsUnchanged || updating}
                onClick={() => onReviewResultUpdate(match, scoreValidation)}
                className="rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {updating ? "Updating Result..." : "Review Update"}
              </button>
            </div>
          </div>
        </div>
      )}

      {match.status === "waiting" && !readOnly && (
        <div className="mt-4 flex flex-col gap-2 border-t border-[var(--border)] pt-4 sm:flex-row">
          <select
            value={courtId || ""}
            disabled={starting}
            onChange={(event) => onCourtChange(match.id, event.target.value)}
            aria-label={`Court for Tournament match ${match.id}`}
            className="min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 text-sm disabled:opacity-50"
          >
            <option value="">Select available court</option>
            {availableCourts.map((court) => (
              <option key={court.id} value={court.id}>{court.name}</option>
            ))}
          </select>
          <button
            type="button"
            disabled={!courtId || starting}
            onClick={() => onStart(match.id, Number(courtId))}
            className="rounded-xl bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {starting ? "Starting..." : "Start Match"}
          </button>
        </div>
      )}
    </article>
  );
}

// Provides filtered match management for one exact Tournament configuration.
export default function TournamentMatchManagement({
  tournament,
  configuration,
  readOnly,
  startingMatchId,
  finishingMatchId,
  updatingResultMatchId,
  playingPlayerById,
  onStartMatch,
  onReviewResult,
  onReviewResultUpdate,
}) {
  const [groupFilter, setGroupFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState(readOnly ? "all" : "waiting");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [courtByMatchId, setCourtByMatchId] = useState({});
  const [scoreByMatchId, setScoreByMatchId] = useState({});
  const [editingResultMatchId, setEditingResultMatchId] = useState(null);
  const [availableCourts, setAvailableCourts] = useState([]);
  const [courtError, setCourtError] = useState("");

  const matches = useMemo(() => configuration.groups.flatMap((group) => (
    group.rounds.flatMap((round) => round.matches.map((match) => ({
      match,
      group,
      round,
    })))
  )), [configuration.groups]);

  const filteredMatches = useMemo(() => matches.filter((item) => (
    (groupFilter === "all" || String(item.group.id) === groupFilter)
    && (statusFilter === "all" || item.match.status === statusFilter)
  )), [groupFilter, matches, statusFilter]);

  const pagination = useMemo(
    () => getPagination(filteredMatches.length, page, pageSize),
    [filteredMatches.length, page, pageSize],
  );
  const pagedMatches = useMemo(() => filteredMatches.slice(
    pagination.startIndex,
    pagination.endIndex,
  ), [filteredMatches, pagination.endIndex, pagination.startIndex]);

  // Refreshes shared court availability whenever this configuration lifecycle changes.
  useEffect(() => {
    let cancelled = false;
    window.api.getAvailableCourts()
      .then((courts) => {
        if (cancelled) return;
        setAvailableCourts(Array.isArray(courts) ? courts : []);
        setCourtError("");
      })
      .catch(() => {
        if (!cancelled) {
          setAvailableCourts([]);
          setCourtError("Available courts could not be loaded. Refresh and try again.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [
    configuration.id,
    configuration.summary.finishedMatches,
    configuration.summary.playingMatches,
    configuration.summary.waitingMatches,
  ]);

  const updateGroupFilter = (value) => {
    setGroupFilter(value);
    setPage(1);
  };
  const updateStatusFilter = (value) => {
    setStatusFilter(value);
    setPage(1);
  };

  const beginResultEdit = (match) => {
    setEditingResultMatchId(match.id);
    setScoreByMatchId((current) => ({
      ...current,
      [match.id]: {
        teamA: Number.isInteger(match.teamAScore) ? String(match.teamAScore) : "",
        teamB: Number.isInteger(match.teamBScore) ? String(match.teamBScore) : "",
      },
    }));
  };

  return (
    <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
      <div className="border-b border-[var(--border)] p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Swords className="h-5 w-5 text-[var(--primary)]" />
              <h2 className="text-lg font-semibold text-[var(--text-h)]">Tournament Matches</h2>
            </div>
            <p className="mt-1 text-sm text-[var(--text)]">
              Waiting matches have no queue position. Choose any eligible match and available court.
            </p>
          </div>
          {configuration.division === "adult" && (
            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${getLevelClasses(configuration.level)}`}>
              {LEVEL_LABELS[configuration.level]}
            </span>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2 text-xs text-[var(--text)]">
          <span className="rounded-lg bg-[var(--surface-hover)] px-2.5 py-1.5 font-semibold text-[var(--text-h)]">
            {tournament.name}
          </span>
          <span className="rounded-lg bg-[var(--surface-hover)] px-2.5 py-1.5">{DIVISION_LABELS[configuration.division]}</span>
          <span className="rounded-lg bg-[var(--surface-hover)] px-2.5 py-1.5 capitalize">{configuration.matchType}</span>
          <span className="rounded-lg bg-[var(--surface-hover)] px-2.5 py-1.5">{CATEGORY_LABELS[configuration.category]}</span>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-[13rem_minmax(0,1fr)] lg:items-center">
          <select
            value={groupFilter}
            onChange={(event) => updateGroupFilter(event.target.value)}
            aria-label="Filter Tournament matches by group"
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
          >
            <option value="all">All Groups</option>
            {configuration.groups.map((group) => (
              <option key={group.id} value={group.id}>{group.name}</option>
            ))}
          </select>
          <div className="grid grid-cols-4 rounded-xl bg-[var(--surface-hover)] p-1">
            {STATUS_OPTIONS.map((status) => {
              const count = status === "all"
                ? configuration.summary.totalMatches
                : configuration.summary[`${status}Matches`];
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => updateStatusFilter(status)}
                  className={`rounded-lg px-2 py-2 text-xs font-semibold capitalize ${statusFilter === status ? "bg-[var(--surface)] text-[var(--text-h)] shadow-sm" : "text-[var(--text)]"}`}
                >
                  {status} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {courtError && !readOnly && (
          <p className="mt-3 rounded-xl bg-[var(--danger-light)] px-3 py-2 text-xs font-semibold text-[var(--danger)]">
            {courtError}
          </p>
        )}
      </div>

      <div className="space-y-3 bg-[var(--surface-hover)]/35 p-4">
        {pagedMatches.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-10 text-center">
            <Trophy className="mx-auto h-7 w-7 text-[var(--text)]" />
            <p className="mt-2 font-medium text-[var(--text-h)]">No matching Tournament matches</p>
            <p className="mt-1 text-xs text-[var(--text)]">Choose another group or status.</p>
          </div>
        ) : pagedMatches.map((item) => (
          <TournamentMatchCard
            key={item.match.id}
            item={item}
            courtId={courtByMatchId[item.match.id]}
            availableCourts={availableCourts}
            readOnly={readOnly}
            starting={Number(startingMatchId) === Number(item.match.id)}
            finishing={Number(finishingMatchId) === Number(item.match.id)}
            updating={Number(updatingResultMatchId) === Number(item.match.id)}
            editingResult={Number(editingResultMatchId) === Number(item.match.id)}
            canEditResult={!readOnly && tournament.status === "ongoing"}
            playingPlayerById={playingPlayerById}
            scoreValues={scoreByMatchId[item.match.id] || { teamA: "", teamB: "" }}
            onCourtChange={(matchId, value) => setCourtByMatchId((current) => ({
              ...current,
              [matchId]: value,
            }))}
            onScoreChange={(matchId, side, value) => setScoreByMatchId((current) => ({
              ...current,
              [matchId]: {
                ...(current[matchId] || { teamA: "", teamB: "" }),
                [side]: value,
              },
            }))}
            onStart={onStartMatch}
            onReviewResult={onReviewResult}
            onBeginEditResult={beginResultEdit}
            onCancelEditResult={() => setEditingResultMatchId(null)}
            onReviewResultUpdate={onReviewResultUpdate}
          />
        ))}
      </div>

      {filteredMatches.length > 0 && (
        <PaginationControls
          page={pagination.currentPage}
          pageSize={pageSize}
          totalRecords={filteredMatches.length}
          itemLabel="matches"
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
