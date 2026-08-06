/*
Tournament flow reference

React Tournament page
  -> window.api.createRoundRobinTournament(players, matchType, category)
  -> Electron IPC handler in main.js
  -> createRoundRobinTournament() in database/tournamentQueries.js
  -> one SQLite transaction creates the tournament, teams, rounds, and matches

Pending matches use startTournamentMatch(matchId, courtId). One SQLite
transaction assigns an available court, marks the match as "playing", and marks
the court as "playing".

Playing matches use finishTournamentMatch(matchId, winnerTeamId). One SQLite
transaction saves the winner, marks the match as "finished", and releases only
its assigned court. The final result automatically changes the tournament status
to "finished". Court queries identify active matches with an explicit "normal"
or "tournament" source. The legacy round_robin_matches table and its removed IPC
methods are not part of the tournament flow.
*/
