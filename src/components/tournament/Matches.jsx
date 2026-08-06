import { useState } from "react";
import ConfirmDialog from "../ConfirmDialog";
import Modal from "../Modal";
import { getLevelClasses, getLevelLabel } from "../../utils/playerLevel";

function formatLabel(value) {
  if (value === "no_gender") return "No Gender";
  if (value === "mens") return "Men's";
  if (value === "womens") return "Women's";

  return value
    ? value.charAt(0).toUpperCase() + value.slice(1).replaceAll("_", " ")
    : "Unknown";
}

function getTeamName(team) {
  if (!team) return "Unknown Team";

  const playerNames = [team.player1?.name, team.player2?.name].filter(Boolean);
  return playerNames.length > 0
    ? playerNames.join(" / ")
    : `Team ${team.teamNumber}`;
}

function TeamPlayers({ team, centered = false }) {
  const players = [team?.player1, team?.player2].filter(Boolean);

  return (
    <div className={`flex flex-wrap gap-1.5 mt-1 ${centered ? "justify-center" : ""}`}>
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

function TournamentOutcome({ outcome }) {
  if (!outcome) return null;

  if (outcome.type === "champion") {
    return (
      <div className="rounded-2xl border border-[var(--success)]/30 bg-[var(--success-light)] p-5 text-center">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--success)]">
          Tournament Champion
        </p>
        <p className="text-xl font-bold text-[var(--text-h)] mt-1">
          Team {outcome.team.teamNumber}
        </p>
        <TeamPlayers team={outcome.team} centered />
        <p className="text-sm text-[var(--text)] mt-2">
          Finished with {outcome.wins} {outcome.wins === 1 ? "win" : "wins"}.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--warning)]/30 bg-[var(--warning-light)] p-5 text-center">
      <p className="text-xs font-semibold uppercase tracking-wider text-[var(--warning)]">
        Tournament Finished - Tie in Wins
      </p>
      <p className="text-base font-bold text-[var(--text-h)] mt-1">
        {outcome.teams
          .map((team) => `Team ${team.teamNumber}: ${getTeamName(team)}`)
          .join(" | ")}
      </p>
      <p className="text-sm text-[var(--text)] mt-1">
        Each first-place team finished with {outcome.wins} {outcome.wins === 1 ? "win" : "wins"}.
        No tie-breaker was applied.
      </p>
    </div>
  );
}

const statusClasses = {
  pending: "bg-[var(--warning-light)] text-[var(--warning)]",
  playing: "bg-[var(--primary-light)] text-[var(--primary)]",
  finished: "bg-[var(--success-light)] text-[var(--success)]",
};

export default function Matches({
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

  const openCourtSelection = async (match) => {
    if (startingMatchId !== null) return;

    setStartTarget(match);
    setSelectedCourtId("");
    setAvailableCourts([]);
    setCourtError("");
    const result = await loadAvailableCourts();

    if (!result.success) {
      setCourtError("Unable to load court information.");
    } else if (result.courts.length === 0) {
      setCourtError("No courts are currently available.");
    }
  };

  const closeCourtSelection = () => {
    if (startingMatchId !== null) return;
    setStartTarget(null);
    setSelectedCourtId("");
    setAvailableCourts([]);
    setCourtError("");
  };

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
    } else {
      const failureMessage = result?.message || "Failed to start tournament match.";
      const refreshed = await loadAvailableCourts();

      if (!refreshed.success) {
        setSelectedCourtId("");
        setCourtError(`${failureMessage} Unable to refresh court information.`);
        return;
      }

      const selectedCourtIsStillAvailable = refreshed.courts.some(
        (court) => court.id === numericCourtId,
      );

      if (!selectedCourtIsStillAvailable) {
        setSelectedCourtId("");
      }

      setCourtError(
        refreshed.courts.length === 0
          ? "No courts are currently available."
          : failureMessage,
      );
    }
  };

  const handleConfirmWinner = async () => {
    if (!pendingWinner || savingMatchId !== null) return;

    const saved = await onFinishMatch?.(
      pendingWinner.matchId,
      pendingWinner.winnerTeamId,
    );

    if (saved) setPendingWinner(null);
  };

  if (isLoading) {
    return (
      <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] p-10 text-center text-[var(--text)]">
        Loading saved tournament...
      </div>
    );
  }

  if (!tournamentData) {
    return (
      <div className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] overflow-hidden">
        <div className="p-4 border-b border-[var(--border)]">
          <h2 className="font-semibold text-[var(--text-h)]">
            Tournament Matches
          </h2>
        </div>
        <div className="p-10 text-center text-[var(--text)]">
          Select registered players and generate a tournament to see its rounds.
        </div>
      </div>
    );
  }

  const { tournament, rounds, standings, outcome, summary } = tournamentData;
  const isFinished = tournament.status === "finished";

  return (
    <div className="space-y-6">
      <section className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] overflow-hidden">
        <div className="p-5 border-b border-[var(--border)] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-semibold text-[var(--text-h)]">
                Tournament
              </h2>
              <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                isFinished
                  ? "bg-[var(--success-light)] text-[var(--success)]"
                  : "bg-[var(--warning-light)] text-[var(--warning)]"
              }`}>
                {isFinished ? "Finished" : "Ongoing"}
              </span>
            </div>
            <p className="text-sm text-[var(--text)] mt-1">
              Start each match on an available court, then select its winner.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <span className="px-3 py-1.5 rounded-full bg-[var(--primary-light)] text-[var(--primary)]">
              {formatLabel(tournament.matchType)}
            </span>
            <span className="px-3 py-1.5 rounded-full bg-[var(--surface-hover)] text-[var(--text-h)]">
              {formatLabel(tournament.category)}
            </span>
            <span className="px-3 py-1.5 rounded-full bg-[var(--surface-hover)] text-[var(--text-h)]">
              {summary.totalTeams} Teams
            </span>
            <span className="px-3 py-1.5 rounded-full bg-[var(--surface-hover)] text-[var(--text-h)]">
              {summary.totalMatches} Matches
            </span>
          </div>
        </div>

        <div className="p-5 space-y-5">
          <TournamentOutcome outcome={outcome} />

          {rounds.length === 0 ? (
            <div className="py-8 text-center text-[var(--text)]">
              This tournament has no generated rounds.
            </div>
          ) : (
            rounds.map((round) => (
              <div key={round.id} className="rounded-2xl border border-[var(--border)] overflow-hidden">
                <div className="px-4 py-3 bg-[var(--surface-hover)] border-b border-[var(--border)] flex items-center justify-between">
                  <h3 className="font-semibold text-[var(--text-h)]">
                    Round {round.roundNumber}
                  </h3>
                  <span className="text-xs text-[var(--text)]">
                    {round.matches.length} {round.matches.length === 1 ? "match" : "matches"}
                  </span>
                </div>

                <div className="p-4 grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {round.matches.map((match) => {
                    const matchIsStarting = startingMatchId === match.id;
                    const matchIsSaving = savingMatchId === match.id;
                    const isPending = match.status === "pending";
                    const isPlaying = match.status === "playing";
                    const matchIsFinished = match.status === "finished";

                    return (
                      <article
                        key={match.id}
                        className="rounded-xl border border-[var(--border)] p-4 space-y-3"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--text)]">
                            Round {round.roundNumber}
                          </p>
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${statusClasses[match.status] || statusClasses.pending}`}>
                            {formatLabel(match.status)}
                          </span>
                        </div>

                        <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-stretch">
                          <div className={`rounded-xl p-3 ${
                            match.winnerTeamId === match.teamAId
                              ? "bg-[var(--success-light)] border border-[var(--success)]/30"
                              : "bg-[var(--primary-light)]/50"
                          }`}>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--primary)]">
                              Team {match.teamA?.teamNumber}
                            </p>
                            <TeamPlayers team={match.teamA} />
                          </div>

                          <span className="self-center text-xs font-bold text-[var(--text)] opacity-50">
                            VS
                          </span>

                          <div className={`rounded-xl p-3 ${
                            match.winnerTeamId === match.teamBId
                              ? "bg-[var(--success-light)] border border-[var(--success)]/30"
                              : "bg-[var(--warning-light)]/50"
                          }`}>
                            <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--warning)]">
                              Team {match.teamB?.teamNumber}
                            </p>
                            <TeamPlayers team={match.teamB} />
                          </div>
                        </div>

                        {match.court && (
                          <div className="rounded-xl bg-[var(--surface-hover)] px-3 py-2 text-sm text-center text-[var(--text-h)]">
                            Court: <strong>{match.court.name}</strong>
                          </div>
                        )}

                        {isPending && (
                          <button
                            type="button"
                            disabled={startingMatchId !== null || savingMatchId !== null || isFinished}
                            onClick={() => openCourtSelection({
                              ...match,
                              roundNumber: round.roundNumber,
                            })}
                            className="w-full rounded-xl bg-[var(--primary)] text-white px-3 py-2.5 text-sm font-semibold hover:bg-[var(--primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {matchIsStarting ? "Starting Match..." : "Start Match"}
                          </button>
                        )}

                        {isPlaying && (
                          <div className="grid grid-cols-2 gap-2">
                            <button
                              type="button"
                              disabled={savingMatchId !== null || startingMatchId !== null}
                              onClick={() => setPendingWinner({
                                matchId: match.id,
                                winnerTeamId: match.teamAId,
                                teamName: `Team ${match.teamA?.teamNumber} - ${getTeamName(match.teamA)}`,
                              })}
                              className="rounded-xl bg-[var(--primary)] text-white px-3 py-2 text-xs font-semibold hover:bg-[var(--primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Team {match.teamA?.teamNumber} Won
                            </button>
                            <button
                              type="button"
                              disabled={savingMatchId !== null || startingMatchId !== null}
                              onClick={() => setPendingWinner({
                                matchId: match.id,
                                winnerTeamId: match.teamBId,
                                teamName: `Team ${match.teamB?.teamNumber} - ${getTeamName(match.teamB)}`,
                              })}
                              className="rounded-xl bg-[var(--warning)] text-white px-3 py-2 text-xs font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              Team {match.teamB?.teamNumber} Won
                            </button>
                          </div>
                        )}

                        {matchIsFinished && (
                          <div className="rounded-xl bg-[var(--success-light)] px-3 py-2 text-sm text-[var(--success)] font-semibold text-center">
                            Winner: Team {match.winnerTeam?.teamNumber} - {getTeamName(match.winnerTeam)}
                          </div>
                        )}

                        {(matchIsStarting || matchIsSaving) && (
                          <p className="text-xs text-center text-[var(--text)]">
                            {matchIsStarting ? "Starting match..." : "Finishing match..."}
                          </p>
                        )}
                      </article>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section className="bg-[var(--surface)] rounded-2xl border border-[var(--border)] overflow-hidden">
        <div className="p-4 border-b border-[var(--border)]">
          <h2 className="font-semibold text-[var(--text-h)]">Standings</h2>
          <p className="text-sm text-[var(--text)] mt-1">
            Sorted by wins, then losses, then team number.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface-hover)]">
                <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-[var(--text)]">Rank</th>
                <th className="px-4 py-3 text-left text-xs uppercase tracking-wider text-[var(--text)]">Team</th>
                <th className="px-4 py-3 text-center text-xs uppercase tracking-wider text-[var(--text)]">Played</th>
                <th className="px-4 py-3 text-center text-xs uppercase tracking-wider text-[var(--text)]">Wins</th>
                <th className="px-4 py-3 text-center text-xs uppercase tracking-wider text-[var(--text)]">Losses</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((standing, index) => (
                <tr key={standing.teamId} className="border-b border-[var(--border)] last:border-b-0">
                  <td className="px-4 py-3 text-sm font-semibold text-[var(--text-h)]">
                    {index + 1}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm font-semibold text-[var(--text-h)]">
                      Team {standing.teamNumber}
                    </p>
                    <TeamPlayers team={standing.team} />
                  </td>
                  <td className="px-4 py-3 text-sm text-center text-[var(--text)]">
                    {standing.matchesPlayed}
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-center text-[var(--success)]">
                    {standing.wins}
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-center text-[var(--danger)]">
                    {standing.losses}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Modal
        open={startTarget !== null}
        onClose={closeCourtSelection}
        title="Select Court"
      >
        <div className="space-y-4">
          <p className="text-sm text-[var(--text)]">
            Choose an available court for Round {startTarget?.roundNumber || ""}.
          </p>

          {isLoadingCourts ? (
            <p className="rounded-xl bg-[var(--surface-hover)] p-4 text-sm text-[var(--text)]">
              Loading available courts...
            </p>
          ) : (
            <select
              value={selectedCourtId}
              onChange={(event) => setSelectedCourtId(event.target.value)}
              disabled={availableCourts.length === 0 || startingMatchId !== null}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[var(--text-h)]"
            >
              <option value="">Select a court</option>
              {availableCourts.map((court) => (
                <option key={court.id} value={court.id}>
                  {court.name}
                </option>
              ))}
            </select>
          )}

          {courtError && (
            <p className="rounded-xl bg-[var(--danger-light)] p-3 text-sm text-[var(--danger)]">
              {courtError}
            </p>
          )}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={closeCourtSelection}
              disabled={startingMatchId !== null}
              className="rounded-xl bg-[var(--surface-hover)] px-4 py-2 text-sm font-semibold text-[var(--text)] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmStart}
              disabled={
                isLoadingCourts
                || availableCourts.length === 0
                || !selectedCourtId
                || startingMatchId !== null
              }
              className="rounded-xl bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--primary-hover)] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {startingMatchId !== null ? "Starting Match..." : "Confirm Start"}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={pendingWinner !== null}
        title="Confirm Match Winner"
        message={pendingWinner
          ? `Save ${pendingWinner.teamName} as the winner? This result cannot be changed.`
          : "Save this match winner?"}
        confirmLabel={savingMatchId !== null ? "Finishing..." : "Save Winner"}
        variant="primary"
        confirmDisabled={savingMatchId !== null}
        onConfirm={handleConfirmWinner}
        onCancel={() => {
          if (savingMatchId === null) setPendingWinner(null);
        }}
      />
    </div>
  );
}
