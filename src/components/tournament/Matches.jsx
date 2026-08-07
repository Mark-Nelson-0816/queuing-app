import { ChevronDown, ChevronRight, History, Trophy } from "lucide-react";
import { memo, useState } from "react";
import ConfirmDialog from "../ConfirmDialog";
import Modal from "../Modal";
import PaginationControls from "../PaginationControls";
import { getPagination } from "../../utils/pagination";
import { getLevelClasses, getLevelLabel } from "../../utils/playerLevel";

// Converts stored Tournament values into readable labels.
function formatLabel(value) {
  if (value === "no_gender") return "No Gender";
  if (value === "mens") return "Men's";
  if (value === "womens") return "Women's";
  return value
    ? value.charAt(0).toUpperCase() + value.slice(1).replaceAll("_", " ")
    : "Unknown";
}

// Builds a singles or doubles team name from its players.
function getTeamName(team) {
  if (!team) return "Unknown Team";
  const playerNames = [team.player1?.name, team.player2?.name].filter(Boolean);
  return playerNames.length > 0 ? playerNames.join(" / ") : `Team ${team.teamNumber}`;
}

// Displays the players assigned to one Tournament team.
function TeamPlayers({ team, centered = false }) {
  const players = [team?.player1, team?.player2].filter(Boolean);
  return (
    <div className={`mt-1 flex flex-wrap gap-1.5 ${centered ? "justify-center" : ""}`}>
      {players.map((player) => (
        <span
          key={player.id}
          title={getLevelLabel(player.level)}
          className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${getLevelClasses(player.level)}`}
        >
          {player.name}
        </span>
      ))}
    </div>
  );
}

// Displays the Tournament champion or first-place tie.
function TournamentOutcome({ outcome }) {
  if (!outcome) return null;

  if (outcome.type === "champion") {
    return (
      <div className="flex flex-col gap-3 rounded-xl border border-[var(--success)]/30 bg-[var(--success-light)] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="rounded-xl bg-[var(--surface)]/70 p-2 text-[var(--success)]"><Trophy size={20} /></span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--success)]">Tournament Champion</p>
            <p className="font-bold text-[var(--text-h)]">Team {outcome.team.teamNumber}</p>
          </div>
        </div>
        <div className="sm:text-right">
          <TeamPlayers team={outcome.team} centered />
          <p className="mt-1 text-xs text-[var(--text)]">{outcome.wins} {outcome.wins === 1 ? "win" : "wins"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--warning)]/30 bg-[var(--warning-light)] p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--warning)]">Tournament Finished - Tie in Wins</p>
      <p className="mt-1 text-sm font-bold text-[var(--text-h)]">
        {outcome.teams.map((team) => `Team ${team.teamNumber}: ${getTeamName(team)}`).join(" | ")}
      </p>
      <p className="mt-1 text-xs text-[var(--text)]">
        Each first-place team finished with {outcome.wins} {outcome.wins === 1 ? "win" : "wins"}. No tie-breaker was applied.
      </p>
    </div>
  );
}

const statusClasses = {
  pending: "bg-[var(--warning-light)] text-[var(--warning)]",
  playing: "bg-[var(--primary-light)] text-[var(--primary)]",
  finished: "bg-[var(--success-light)] text-[var(--success)]",
};

// Displays one Tournament match and its available lifecycle action.
function TournamentMatchCard({
  match,
  tournamentFinished,
  startingMatchId,
  savingMatchId,
  onStart,
  onChooseWinner,
}) {
  const matchIsStarting = startingMatchId === match.id;
  const matchIsSaving = savingMatchId === match.id;
  const isPending = match.status === "pending";
  const isPlaying = match.status === "playing";
  const isFinished = match.status === "finished";

  return (
    <article className="space-y-3 rounded-xl border border-[var(--border)] p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text)]">
          Round {match.roundNumber}
        </p>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusClasses[match.status] || statusClasses.pending}`}>
          {formatLabel(match.status)}
        </span>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-stretch gap-3">
        <div className={`rounded-xl p-3 ${
          match.winnerTeamId === match.teamAId
            ? "border border-[var(--success)]/30 bg-[var(--success-light)]"
            : "bg-[var(--primary-light)]/50"
        }`}>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--primary)]">
            Team {match.teamA?.teamNumber}
          </p>
          <TeamPlayers team={match.teamA} />
        </div>

        <span className="self-center text-xs font-bold text-[var(--text)] opacity-50">VS</span>

        <div className={`rounded-xl p-3 ${
          match.winnerTeamId === match.teamBId
            ? "border border-[var(--success)]/30 bg-[var(--success-light)]"
            : "bg-[var(--warning-light)]/50"
        }`}>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--warning)]">
            Team {match.teamB?.teamNumber}
          </p>
          <TeamPlayers team={match.teamB} />
        </div>
      </div>

      <div className="rounded-xl bg-[var(--surface-hover)] px-3 py-2 text-center text-sm text-[var(--text-h)]">
        {match.court ? <>Court: <strong>{match.court.name}</strong></> : "Court: Awaiting assignment"}
      </div>

      {isPending && (
        <button
          type="button"
          disabled={startingMatchId !== null || savingMatchId !== null || tournamentFinished}
          onClick={() => onStart(match)}
          className="w-full rounded-xl bg-[var(--primary)] px-3 py-2.5 text-sm font-semibold text-white hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {matchIsStarting ? "Starting Match..." : "Start Match"}
        </button>
      )}

      {isPlaying && (
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={savingMatchId !== null || startingMatchId !== null}
            onClick={() => onChooseWinner({
              matchId: match.id,
              winnerTeamId: match.teamAId,
              teamName: `Team ${match.teamA?.teamNumber} - ${getTeamName(match.teamA)}`,
            })}
            className="rounded-xl bg-[var(--primary)] px-3 py-2 text-xs font-semibold text-white hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Team {match.teamA?.teamNumber} Won
          </button>
          <button
            type="button"
            disabled={savingMatchId !== null || startingMatchId !== null}
            onClick={() => onChooseWinner({
              matchId: match.id,
              winnerTeamId: match.teamBId,
              teamName: `Team ${match.teamB?.teamNumber} - ${getTeamName(match.teamB)}`,
            })}
            className="rounded-xl bg-[var(--warning)] px-3 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Team {match.teamB?.teamNumber} Won
          </button>
        </div>
      )}

      {isFinished && (
        <div className="rounded-xl bg-[var(--success-light)] px-3 py-2 text-center text-sm font-semibold text-[var(--success)]">
          Winner: Team {match.winnerTeam?.teamNumber} - {getTeamName(match.winnerTeam)}
        </div>
      )}

      {(matchIsStarting || matchIsSaving) && (
        <p className="text-center text-xs text-[var(--text)]">
          {matchIsStarting ? "Starting match..." : "Finishing match..."}
        </p>
      )}
    </article>
  );
}

// Groups a flat match list into ascending Tournament rounds.
function groupByRound(matches) {
  const groups = new Map();
  matches.forEach((match) => {
    const current = groups.get(match.roundNumber) || [];
    current.push(match);
    groups.set(match.roundNumber, current);
  });
  return [...groups.entries()].sort(([first], [second]) => first - second);
}

// Displays Tournament matches grouped under their rounds.
function RoundGroups({ matches, renderMatch, emptyTitle, emptyMessage }) {
  if (matches.length === 0) {
    return (
      <div className="py-9 text-center text-[var(--text)]">
        <p className="font-semibold text-[var(--text-h)]">{emptyTitle}</p>
        <p className="mt-1 text-sm">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {groupByRound(matches).map(([roundNumber, roundMatches]) => (
        <div key={roundNumber} className="overflow-hidden rounded-xl border border-[var(--border)]">
          <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface-hover)] px-4 py-2.5">
            <h3 className="text-sm font-semibold text-[var(--text-h)]">Round {roundNumber}</h3>
            <span className="text-xs text-[var(--text)]">{roundMatches.length} {roundMatches.length === 1 ? "match" : "matches"}</span>
          </div>
          <div className="grid grid-cols-1 gap-4 p-4 xl:grid-cols-2">
            {roundMatches.map(renderMatch)}
          </div>
        </div>
      ))}
    </div>
  );
}

// Displays a consistent Tournament match-section heading.
function SectionHeader({ title, description, count, tone }) {
  const badge = tone === "playing"
    ? "bg-[var(--primary-light)] text-[var(--primary)]"
    : "bg-[var(--warning-light)] text-[var(--warning)]";
  return (
    <div className="border-b border-[var(--border)] p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold text-[var(--text-h)]">{title}</h2>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${badge}`}>{count} {tone === "playing" ? "Playing" : "Pending"}</span>
      </div>
      <p className="mt-1 text-sm text-[var(--text)]">{description}</p>
    </div>
  );
}

// Manages Tournament match sections, court assignment, and winner confirmation.
function Matches({
  tournamentData,
  isLoading = false,
  startingMatchId = null,
  savingMatchId = null,
  onStartMatch,
  onFinishMatch,
}) {
  const [pendingWinner, setPendingWinner] = useState(null);
  const [startTarget, setStartTarget] = useState(null);
  const [availableCourts, setAvailableCourts] = useState([]);
  const [selectedCourtId, setSelectedCourtId] = useState("");
  const [isLoadingCourts, setIsLoadingCourts] = useState(false);
  const [courtError, setCourtError] = useState("");
  const [pendingPage, setPendingPage] = useState(1);
  const [pendingPageSize, setPendingPageSize] = useState(10);
  const [finishedOpen, setFinishedOpen] = useState(false);
  const [finishedPage, setFinishedPage] = useState(1);
  const [finishedPageSize, setFinishedPageSize] = useState(10);
  const [standingsOpen, setStandingsOpen] = useState(false);

  // Load courts that can accept a Tournament match.
  const loadAvailableCourts = async () => {
    setIsLoadingCourts(true);
    try {
      const courts = await window.api.getAvailableCourts();
      const available = Array.isArray(courts) ? courts : [];
      setAvailableCourts(available);
      return { success: true, courts: available };
    } catch {
      setAvailableCourts([]);
      return { success: false, courts: [] };
    } finally {
      setIsLoadingCourts(false);
    }
  };

  // Open court selection for a pending match.
  const openCourtSelection = async (match) => {
    if (startingMatchId !== null) return;
    setStartTarget(match);
    setSelectedCourtId("");
    setAvailableCourts([]);
    setCourtError("");
    const result = await loadAvailableCourts();
    if (!result.success) setCourtError("Unable to load court information.");
    else if (result.courts.length === 0) setCourtError("No courts are currently available.");
  };

  // Close court selection when no start request is active.
  const closeCourtSelection = () => {
    if (startingMatchId !== null) return;
    setStartTarget(null);
    setSelectedCourtId("");
    setAvailableCourts([]);
    setCourtError("");
  };

  // Start the selected Tournament match on the chosen court.
  const handleConfirmStart = async () => {
    if (!startTarget || startingMatchId !== null) return;
    const numericCourtId = Number(selectedCourtId);
    if (!Number.isInteger(numericCourtId) || numericCourtId <= 0) {
      setCourtError("Please select an available court.");
      return;
    }

    setCourtError("");
    const result = await onStartMatch?.(startTarget.id, numericCourtId);
    if (result?.success) {
      closeCourtSelection();
      return;
    }

    const failureMessage = result?.message || "Failed to start Tournament match.";
    const refreshed = await loadAvailableCourts();
    if (!refreshed.success) {
      setSelectedCourtId("");
      setCourtError(`${failureMessage} Unable to refresh court information.`);
      return;
    }
    if (!refreshed.courts.some((court) => court.id === numericCourtId)) setSelectedCourtId("");
    setCourtError(refreshed.courts.length === 0 ? "No courts are currently available." : failureMessage);
  };

  // Save the selected winner after confirmation.
  const handleConfirmWinner = async () => {
    if (!pendingWinner || savingMatchId !== null) return;
    const saved = await onFinishMatch?.(pendingWinner.matchId, pendingWinner.winnerTeamId);
    if (saved) setPendingWinner(null);
  };

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-10 text-center text-[var(--text)]">
        Loading saved Tournament...
      </div>
    );
  }

  if (!tournamentData) {
    return (
      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <div className="border-b border-[var(--border)] p-4"><h2 className="font-semibold text-[var(--text-h)]">Tournament Matches</h2></div>
        <div className="p-10 text-center text-[var(--text)]">Select registered players and generate a Tournament to see its rounds.</div>
      </div>
    );
  }

  const { tournament, rounds, standings, outcome, summary } = tournamentData;
  // Split all matches into their current lifecycle sections.
  const tournamentFinished = tournament.status === "finished";
  const allMatches = rounds.flatMap((round) => round.matches.map((match) => ({
    ...match,
    roundNumber: round.roundNumber,
  })));
  const pendingMatches = allMatches.filter((match) => match.status === "pending");
  const playingMatches = allMatches.filter((match) => match.status === "playing");
  const finishedMatches = allMatches.filter((match) => match.status === "finished");
  // Build independent pagination for pending and finished matches.
  const pendingPagination = getPagination(pendingMatches.length, pendingPage, pendingPageSize);
  const finishedPagination = getPagination(finishedMatches.length, finishedPage, finishedPageSize);
  const pagedPending = pendingMatches.slice(pendingPagination.startIndex, pendingPagination.endIndex);
  const pagedFinished = finishedMatches.slice(finishedPagination.startIndex, finishedPagination.endIndex);
  // Render a match card with shared Tournament actions.
  const renderMatch = (match) => (
    <TournamentMatchCard
      key={match.id}
      match={match}
      tournamentFinished={tournamentFinished}
      startingMatchId={startingMatchId}
      savingMatchId={savingMatchId}
      onStart={openCourtSelection}
      onChooseWinner={setPendingWinner}
    />
  );

  return (
    <div className="space-y-6">
      {/* Tournament summary and final outcome */}
      <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <div className="flex flex-col justify-between gap-4 border-b border-[var(--border)] p-5 lg:flex-row lg:items-center">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-[var(--text-h)]">Tournament</h2>
              <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${tournamentFinished ? "bg-[var(--success-light)] text-[var(--success)]" : "bg-[var(--warning-light)] text-[var(--warning)]"}`}>
                {tournamentFinished ? "Finished" : "Ongoing"}
              </span>
            </div>
            <p className="mt-1 text-sm text-[var(--text)]">Start each pending match on a court, then select the winner.</p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <span className="rounded-full bg-[var(--primary-light)] px-3 py-1.5 text-[var(--primary)]">{formatLabel(tournament.matchType)}</span>
            <span className="rounded-full bg-[var(--surface-hover)] px-3 py-1.5 text-[var(--text-h)]">{formatLabel(tournament.category)}</span>
            <span className="rounded-full bg-[var(--surface-hover)] px-3 py-1.5 text-[var(--text-h)]">{summary.totalTeams} Teams</span>
            <span className="rounded-full bg-[var(--surface-hover)] px-3 py-1.5 text-[var(--text-h)]">{summary.totalMatches} Matches</span>
          </div>
        </div>
        {outcome && <div className="p-5"><TournamentOutcome outcome={outcome} /></div>}
      </section>

      {/* Pending matches */}
      <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <SectionHeader title="Pending Matches" description="Review each round and assign an available court when ready." count={pendingMatches.length} tone="pending" />
        <div className="p-5">
          <RoundGroups matches={pagedPending} renderMatch={renderMatch} emptyTitle="No pending matches" emptyMessage={playingMatches.length > 0 ? "All remaining matches are currently playing." : "Generate a Tournament or finish the current matches."} />
        </div>
        {pendingMatches.length > 0 && (
          <PaginationControls
            page={pendingPagination.currentPage}
            pageSize={pendingPageSize}
            totalRecords={pendingMatches.length}
            itemLabel="matches"
            onPageChange={setPendingPage}
            onPageSizeChange={(size) => { setPendingPageSize(size); setPendingPage(1); }}
          />
        )}
      </section>

      {/* Playing matches */}
      <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <SectionHeader title="Playing Matches" description="Select the winning team when play is complete." count={playingMatches.length} tone="playing" />
        <div className="p-5">
          <RoundGroups matches={playingMatches} renderMatch={renderMatch} emptyTitle="No matches currently playing" emptyMessage="Start a pending match after selecting a court." />
        </div>
      </section>

      {/* Finished match history */}
      <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <button type="button" onClick={() => setFinishedOpen((current) => !current)} className="flex w-full items-center justify-between gap-3 p-5 text-left hover:bg-[var(--surface-hover)]/50">
          <div className="flex items-center gap-3">
            <span className="rounded-xl bg-[var(--success-light)] p-2 text-[var(--success)]"><History size={18} /></span>
            <div><h2 className="font-semibold text-[var(--text-h)]">Finished Matches</h2><p className="mt-1 text-sm text-[var(--text)]">Open completed rounds and winner history when needed.</p></div>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-[var(--success-light)] px-2.5 py-1 text-xs font-semibold text-[var(--success)]">{finishedMatches.length} Finished</span>
            {finishedOpen ? <ChevronDown className="text-[var(--text)]" /> : <ChevronRight className="text-[var(--text)]" />}
          </div>
        </button>
        {finishedOpen && (
          <>
            <div className="border-t border-[var(--border)] p-5">
              <RoundGroups matches={pagedFinished} renderMatch={renderMatch} emptyTitle="No finished matches" emptyMessage="Completed match history will appear here." />
            </div>
            {finishedMatches.length > 0 && (
              <PaginationControls
                page={finishedPagination.currentPage}
                pageSize={finishedPageSize}
                totalRecords={finishedMatches.length}
                itemLabel="matches"
                onPageChange={setFinishedPage}
                onPageSizeChange={(size) => { setFinishedPageSize(size); setFinishedPage(1); }}
              />
            )}
          </>
        )}
      </section>

      {/* Tournament standings */}
      <section className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
        <button type="button" onClick={() => setStandingsOpen((current) => !current)} className="flex w-full items-center justify-between gap-3 p-5 text-left hover:bg-[var(--surface-hover)]/50">
          <div><h2 className="font-semibold text-[var(--text-h)]">Standings</h2><p className="mt-1 text-sm text-[var(--text)]">Sorted by wins, losses, then team number.</p></div>
          {standingsOpen ? <ChevronDown className="text-[var(--text)]" /> : <ChevronRight className="text-[var(--text)]" />}
        </button>
        {standingsOpen && (
          <div className="overflow-x-auto border-t border-[var(--border)]">
            <table className="w-full">
              <thead><tr className="border-b border-[var(--border)] bg-[var(--surface-hover)]"><th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-[var(--text)]">Rank</th><th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-[var(--text)]">Team</th><th className="px-4 py-3 text-center text-xs uppercase tracking-wider text-[var(--text)]">Played</th><th className="px-4 py-3 text-center text-xs uppercase tracking-wider text-[var(--text)]">Wins</th><th className="px-4 py-3 text-center text-xs uppercase tracking-wider text-[var(--text)]">Losses</th></tr></thead>
              <tbody>
                {standings.map((standing, index) => (
                  <tr key={standing.teamId} className="border-b border-[var(--border)] last:border-b-0">
                    <td className="px-4 py-3 text-sm font-semibold text-[var(--text-h)]">{index + 1}</td>
                    <td className="px-4 py-3"><p className="text-sm font-semibold text-[var(--text-h)]">Team {standing.teamNumber}</p><TeamPlayers team={standing.team} /></td>
                    <td className="px-4 py-3 text-center text-sm text-[var(--text)]">{standing.matchesPlayed}</td>
                    <td className="px-4 py-3 text-center text-sm font-semibold text-[var(--success)]">{standing.wins}</td>
                    <td className="px-4 py-3 text-center text-sm font-semibold text-[var(--danger)]">{standing.losses}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Court selection */}
      <Modal open={startTarget !== null} onClose={closeCourtSelection} title="Select Court">
        <div className="space-y-4">
          <p className="text-sm text-[var(--text)]">Choose an available court for Round {startTarget?.roundNumber || ""}.</p>
          {isLoadingCourts ? (
            <p className="rounded-xl bg-[var(--surface-hover)] p-4 text-sm text-[var(--text)]">Loading available courts...</p>
          ) : (
            <select value={selectedCourtId} onChange={(event) => setSelectedCourtId(event.target.value)} disabled={availableCourts.length === 0 || startingMatchId !== null} className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[var(--text-h)]">
              <option value="">Select a court</option>
              {availableCourts.map((court) => <option key={court.id} value={court.id}>{court.name}</option>)}
            </select>
          )}
          {courtError && <p className="rounded-xl bg-[var(--danger-light)] p-3 text-sm text-[var(--danger)]">{courtError}</p>}
          <div className="flex justify-end gap-3">
            <button type="button" onClick={closeCourtSelection} disabled={startingMatchId !== null} className="rounded-xl bg-[var(--surface-hover)] px-4 py-2 text-sm font-semibold text-[var(--text)] disabled:opacity-50">Cancel</button>
            <button type="button" onClick={handleConfirmStart} disabled={isLoadingCourts || availableCourts.length === 0 || !selectedCourtId || startingMatchId !== null} className="rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--primary-hover)] disabled:cursor-not-allowed disabled:opacity-50">{startingMatchId !== null ? "Starting Match..." : "Confirm Start"}</button>
          </div>
        </div>
      </Modal>

      {/* Winner confirmation */}
      <ConfirmDialog
        open={pendingWinner !== null}
        title="Confirm Match Winner"
        message={pendingWinner ? `Save ${pendingWinner.teamName} as the winner? This result cannot be changed.` : "Save this match winner?"}
        confirmLabel={savingMatchId !== null ? "Finishing..." : "Save Winner"}
        variant="primary"
        confirmDisabled={savingMatchId !== null}
        onConfirm={handleConfirmWinner}
        onCancel={() => { if (savingMatchId === null) setPendingWinner(null); }}
      />
    </div>
  );
}

export default memo(Matches);
