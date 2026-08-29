import { useState } from "react";
import { ChevronDown, RotateCcw, Users } from "lucide-react";
import {
  CATEGORY_LABELS,
  DIVISION_LABELS,
  LEVEL_LABELS,
} from "./TournamentOptions";
import { getLevelClasses } from "../../utils/playerLevel";

// Displays player names for a generated Singles or Doubles team.
function TeamName({ team }) {
  return (
    <span>
      {team?.players?.map((player) => player.name).join(" / ") || "Unknown team"}
    </span>
  );
}

// Shows a completed group's unique winner or every team tied for first.
function GroupResult({ result }) {
  if (!result) return null;
  const isWinner = result.type === "winner";
  const teams = isWinner ? [result.team] : result.teams;

  return (
    <div className={`mx-4 mt-4 rounded-xl border p-3 ${isWinner ? "border-[var(--success)]/40 bg-[var(--success-light)]/40" : "border-[var(--warning)]/40 bg-[var(--warning-light)]/40"}`}>
      <p className={`text-xs font-semibold uppercase tracking-wide ${isWinner ? "text-[var(--success)]" : "text-[var(--warning)]"}`}>
        {isWinner ? "Group Winner" : "Tie in Wins"}
      </p>
      <p className="mt-1 break-words font-semibold text-[var(--text-h)]">
        {teams.map((team) => team.players.map((player) => player.name).join(" / ")).join(" · ")}
      </p>
      {!isWinner && (
        <p className="mt-1 text-xs text-[var(--text)]">No tie-breaker is applied.</p>
      )}
    </div>
  );
}

// Displays one generated group and loads match rows only when expanded.
function GroupCard({ group }) {
  const [showMatches, setShowMatches] = useState(false);

  return (
    <article className="overflow-hidden rounded-xl border border-[var(--border)]">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[var(--surface-hover)] px-4 py-3">
        <div>
          <h4 className="font-semibold text-[var(--text-h)]">{group.name}</h4>
          <p className="text-xs text-[var(--text)]">
            {group.summary.totalTeams} teams · {group.summary.totalMatches} round-robin matches
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-[10px] font-semibold uppercase tracking-wide">
          <span className="rounded-full bg-[var(--warning-light)] px-2 py-1 text-[var(--warning)]">
            {group.summary.waitingMatches} Waiting
          </span>
          {group.summary.playingMatches > 0 && (
            <span className="rounded-full bg-[var(--primary-light)] px-2 py-1 text-[var(--primary)]">
              {group.summary.playingMatches} Playing
            </span>
          )}
          <span className="rounded-full bg-[var(--success-light)] px-2 py-1 text-[var(--success)]">
            {group.summary.finishedMatches} Finished
          </span>
        </div>
      </div>

      <GroupResult result={group.result} />

      <div className="grid gap-2 p-4 md:grid-cols-2">
        {group.teams.map((team) => (
          <div key={team.id} className="flex min-w-0 items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm">
            <span className="shrink-0 rounded-md bg-[var(--primary-light)] px-2 py-1 text-[10px] font-bold text-[var(--primary)]">
              Team {team.teamNumber}
            </span>
            <div className="min-w-0">
              <p className="truncate font-medium text-[var(--text-h)]"><TeamName team={team} /></p>
              <p className="truncate text-[10px] capitalize text-[var(--text)]">
                {team.players.map((player) => (
                  `${LEVEL_LABELS[player.levelSnapshot] || player.levelSnapshot} / ${player.genderSnapshot}`
                )).join(" · ")}
              </p>
            </div>
          </div>
        ))}
      </div>

      <div className="mx-4 mb-4 overflow-x-auto rounded-xl border border-[var(--border)]">
        <table className="min-w-[34rem] w-full table-fixed text-left text-sm">
          <thead className="bg-[var(--surface-hover)] text-xs uppercase tracking-wide text-[var(--text)]">
            <tr>
              <th className="w-[55%] px-3 py-2">Standings</th>
              <th className="w-[15%] px-3 py-2 text-center">Played</th>
              <th className="w-[15%] px-3 py-2 text-center">Wins</th>
              <th className="w-[15%] px-3 py-2 text-center">Losses</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border)]">
            {group.standings.map((standing) => (
              <tr key={standing.teamId}>
                <td className="px-3 py-2 font-medium text-[var(--text-h)]">
                  <span className="block truncate" title={`Team ${standing.teamNumber}: ${standing.team?.players?.map((player) => player.name).join(" / ") || "Unknown team"}`}>
                    Team {standing.teamNumber}: <TeamName team={standing.team} />
                  </span>
                </td>
                <td className="px-3 py-2 text-center text-[var(--text)]">{standing.matchesPlayed}</td>
                <td className="px-3 py-2 text-center font-semibold text-[var(--success)]">{standing.wins}</td>
                <td className="px-3 py-2 text-center font-semibold text-[var(--danger)]">{standing.losses}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        onClick={() => setShowMatches((current) => !current)}
        className="flex w-full items-center justify-center gap-2 border-t border-[var(--border)] px-4 py-2.5 text-xs font-semibold text-[var(--primary)] hover:bg-[var(--surface-hover)]"
      >
        {showMatches ? "Hide Matches" : `View ${group.summary.totalMatches} Matches`}
        <ChevronDown className={`h-4 w-4 transition-transform ${showMatches ? "rotate-180" : ""}`} />
      </button>

      {showMatches && (
        <div className="space-y-3 border-t border-[var(--border)] bg-[var(--surface)] p-4">
          {group.rounds.map((round) => (
            <div key={round.id}>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--text)]">
                Round {round.roundNumber}
              </p>
              <div className="space-y-1.5">
                {round.matches.map((match) => (
                  <div key={match.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)] px-3 py-2 text-sm">
                    <span className="min-w-0 flex-1 break-words text-[var(--text-h)]">
                      <TeamName team={match.teamA} />
                      <span className="mx-2 text-xs text-[var(--text)]">vs</span>
                      <TeamName team={match.teamB} />
                    </span>
                    <div className="shrink-0 text-right text-[10px] font-semibold uppercase tracking-wide text-[var(--text)]">
                      <p>{match.status}{match.court ? ` · ${match.court.name}` : ""}</p>
                      {Number.isInteger(match.teamAScore) && Number.isInteger(match.teamBScore) && (
                        <p className="mt-0.5 text-xs text-[var(--text-h)]">
                          Final Score: {match.teamAScore} - {match.teamBScore}
                        </p>
                      )}
                      {match.winnerTeam && (
                        <p className="mt-0.5 text-[var(--success)]">Winner: <TeamName team={match.winnerTeam} /></p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

// Summarizes one persisted configuration, its teams, groups, and matches.
export default function TournamentConfigurationSummary({
  configuration,
  readOnly,
  isResetting,
  onReset,
}) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold text-[var(--text-h)]">Generated Configuration</h2>
            {configuration.division === "adult" && (
              <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${getLevelClasses(configuration.level)}`}>
                {LEVEL_LABELS[configuration.level] || configuration.level}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-[var(--text)]">
            {DIVISION_LABELS[configuration.division]} · <span className="capitalize">{configuration.matchType}</span> · {CATEGORY_LABELS[configuration.category]}
          </p>
        </div>
        {!readOnly && (
          <button
            type="button"
            disabled={isResetting}
            onClick={onReset}
            className="inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-xl border border-red-500/40 px-3 py-2 text-xs font-semibold text-red-500 hover:bg-red-500/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <RotateCcw className="h-4 w-4" />
            {isResetting ? "Resetting..." : "Reset Configuration"}
          </button>
        )}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          [configuration.summary.totalParticipants, "Players"],
          [configuration.summary.totalTeams, "Teams"],
          [configuration.summary.totalGroups, "Groups"],
          [configuration.summary.totalMatches, "Matches"],
        ].map(([value, label]) => (
          <div key={label} className="rounded-xl border border-[var(--border)] bg-[var(--surface-hover)] p-3 text-center">
            <p className="text-xl font-bold text-[var(--text-h)]">{value}</p>
            <p className="text-xs text-[var(--text)]">{label}</p>
          </div>
        ))}
      </div>

      <div className="mt-5 space-y-4">
        {configuration.groups.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--border)] p-8 text-center">
            <Users className="mx-auto h-7 w-7 text-[var(--text)]" />
            <p className="mt-2 text-sm text-[var(--text)]">No groups were generated.</p>
          </div>
        ) : configuration.groups.map((group) => (
          <GroupCard key={group.id} group={group} />
        ))}
      </div>
    </section>
  );
}
