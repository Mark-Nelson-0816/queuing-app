import db from "./database.js";
import {
  buildTournamentTeams,
  calculateTournamentStandings,
  generateRoundRobinSchedule,
  getTournamentOutcome,
  validateTournamentPlayers,
} from "./tournamentLogic.js";

const getPlayerStatement = db.prepare(`
  SELECT id, name, level, gender
  FROM players
  WHERE id = ?
`);

const getTournamentStatement = db.prepare(`
  SELECT id, match_type, category, status, created_at
  FROM tournaments
  WHERE id = ?
`);

const getLatestTournamentStatement = db.prepare(`
  SELECT id
  FROM tournaments
  ORDER BY id DESC
  LIMIT 1
`);

const getActiveTournamentStatement = db.prepare(`
  SELECT tournaments.id
  FROM tournaments
  WHERE tournaments.status = 'ongoing'
    AND EXISTS (
      SELECT 1
      FROM tournament_matches
      WHERE tournament_matches.tournament_id = tournaments.id
    )
  ORDER BY tournaments.id DESC
  LIMIT 1
`);

const getTournamentTeamsStatement = db.prepare(`
  SELECT
    tournament_teams.id,
    tournament_teams.tournament_id,
    tournament_teams.team_number,
    tournament_teams.player_1_id,
    tournament_teams.player_2_id,
    tournament_teams.created_at,
    player_1.name AS player_1_name,
    player_1.gender AS player_1_gender,
    player_1.level AS player_1_level,
    player_2.name AS player_2_name,
    player_2.gender AS player_2_gender,
    player_2.level AS player_2_level
  FROM tournament_teams
  LEFT JOIN players AS player_1
    ON player_1.id = tournament_teams.player_1_id
  LEFT JOIN players AS player_2
    ON player_2.id = tournament_teams.player_2_id
  WHERE tournament_teams.tournament_id = ?
  ORDER BY tournament_teams.team_number ASC
`);

const getTournamentRoundsStatement = db.prepare(`
  SELECT id, tournament_id, round_number, created_at
  FROM tournament_rounds
  WHERE tournament_id = ?
  ORDER BY round_number ASC
`);

const getTournamentMatchesStatement = db.prepare(`
  SELECT
    tournament_matches.id,
    tournament_matches.tournament_id,
    tournament_matches.round_id,
    tournament_matches.team_a_id,
    tournament_matches.team_b_id,
    tournament_matches.winner_team_id,
    tournament_matches.court_id,
    tournament_matches.status,
    tournament_matches.created_at,
    courts.name AS court_name,
    courts.status AS court_status
  FROM tournament_matches
  LEFT JOIN courts
    ON courts.id = tournament_matches.court_id
  WHERE tournament_matches.tournament_id = ?
  ORDER BY tournament_matches.round_id ASC, tournament_matches.id ASC
`);

const insertTournamentStatement = db.prepare(`
  INSERT INTO tournaments (match_type, category, status)
  VALUES (?, ?, 'ongoing')
`);

const insertTeamStatement = db.prepare(`
  INSERT INTO tournament_teams (
    tournament_id,
    team_number,
    player_1_id,
    player_2_id
  )
  VALUES (?, ?, ?, ?)
`);

const insertRoundStatement = db.prepare(`
  INSERT INTO tournament_rounds (tournament_id, round_number)
  VALUES (?, ?)
`);

const insertMatchStatement = db.prepare(`
  INSERT INTO tournament_matches (
    tournament_id,
    round_id,
    team_a_id,
    team_b_id,
    status
  )
  VALUES (?, ?, ?, ?, 'pending')
`);

function createFailure(error, fallbackMessage) {
  return {
    success: false,
    message: error instanceof Error && error.message
      ? error.message
      : fallbackMessage,
  };
}

function mapPlayer(id, name, gender, level) {
  if (id === null || id === undefined) return null;

  return {
    id: Number(id),
    name: name || "Unknown Player",
    gender: gender || "unknown",
    level: level || "unknown",
  };
}

function mapTeam(row) {
  return {
    id: Number(row.id),
    tournamentId: Number(row.tournament_id),
    teamNumber: Number(row.team_number),
    player1: mapPlayer(
      row.player_1_id,
      row.player_1_name,
      row.player_1_gender,
      row.player_1_level,
    ),
    player2: mapPlayer(
      row.player_2_id,
      row.player_2_name,
      row.player_2_gender,
      row.player_2_level,
    ),
    createdAt: row.created_at,
  };
}

function loadTournamentDetails(tournamentId) {
  const tournamentRow = getTournamentStatement.get(tournamentId);
  if (!tournamentRow) return null;

  const teams = getTournamentTeamsStatement.all(tournamentId).map(mapTeam);
  const teamById = new Map(teams.map((team) => [team.id, team]));
  const matchRows = getTournamentMatchesStatement.all(tournamentId);

  const matches = matchRows.map((row) => ({
    id: Number(row.id),
    tournamentId: Number(row.tournament_id),
    roundId: Number(row.round_id),
    status: row.status,
    teamAId: Number(row.team_a_id),
    teamBId: Number(row.team_b_id),
    winnerTeamId: row.winner_team_id === null
      ? null
      : Number(row.winner_team_id),
    courtId: row.court_id === null ? null : Number(row.court_id),
    court: row.court_id === null
      ? null
      : {
        id: Number(row.court_id),
        name: row.court_name || "Unknown Court",
        status: row.court_status || "unknown",
      },
    teamA: teamById.get(Number(row.team_a_id)) || null,
    teamB: teamById.get(Number(row.team_b_id)) || null,
    winnerTeam: row.winner_team_id === null
      ? null
      : teamById.get(Number(row.winner_team_id)) || null,
    createdAt: row.created_at,
  }));

  const matchesByRound = new Map();
  for (const match of matches) {
    const roundMatches = matchesByRound.get(match.roundId) || [];
    roundMatches.push(match);
    matchesByRound.set(match.roundId, roundMatches);
  }

  const rounds = getTournamentRoundsStatement.all(tournamentId).map((row) => ({
    id: Number(row.id),
    tournamentId: Number(row.tournament_id),
    roundNumber: Number(row.round_number),
    matches: matchesByRound.get(Number(row.id)) || [],
    createdAt: row.created_at,
  }));

  const tournament = {
    id: Number(tournamentRow.id),
    matchType: tournamentRow.match_type,
    category: tournamentRow.category,
    status: tournamentRow.status,
    createdAt: tournamentRow.created_at,
  };

  const standings = calculateTournamentStandings(teams, matches);
  const completedMatches = matches.filter(
    (match) => match.status === "finished",
  ).length;
  const playingMatches = matches.filter(
    (match) => match.status === "playing",
  ).length;
  const pendingMatches = matches.filter(
    (match) => match.status === "pending",
  ).length;

  return {
    tournament,
    teams,
    rounds,
    standings,
    outcome: getTournamentOutcome(standings, tournament.status),
    summary: {
      totalTeams: teams.length,
      totalRounds: rounds.length,
      totalMatches: matches.length,
      completedMatches,
      playingMatches,
      pendingMatches,
    },
  };
}

function resolveSelectedPlayers(selectedPlayers) {
  if (!Array.isArray(selectedPlayers)) {
    throw new Error("Please select tournament players.");
  }

  const playerIds = selectedPlayers.map((player) => Number(player?.id));
  if (playerIds.some((id) => !Number.isInteger(id) || id <= 0)) {
    throw new Error("One or more selected players are invalid.");
  }

  if (new Set(playerIds).size !== playerIds.length) {
    throw new Error("A player can only be selected once.");
  }

  return playerIds.map((playerId) => {
    const player = getPlayerStatement.get(playerId);
    if (!player) {
      throw new Error("One or more selected players could not be found.");
    }

    return {
      id: Number(player.id),
      name: player.name,
      level: player.level,
      gender: player.gender,
    };
  });
}

const createTournamentTransaction = db.transaction((
  selectedPlayers,
  matchType,
  category,
) => {
  const players = resolveSelectedPlayers(selectedPlayers);
  validateTournamentPlayers(players, matchType, category);

  const activeTournament = getActiveTournamentStatement.get();
  if (activeTournament) {
    throw new Error(
      "An ongoing tournament already exists. Finish it before creating another tournament.",
    );
  }

  const teamDefinitions = buildTournamentTeams(players, matchType, category);
  const tournamentResult = insertTournamentStatement.run(matchType, category);
  const tournamentId = Number(tournamentResult.lastInsertRowid);

  const insertedTeams = teamDefinitions.map((team) => {
    const result = insertTeamStatement.run(
      tournamentId,
      team.teamNumber,
      team.player1Id,
      team.player2Id,
    );

    return {
      ...team,
      id: Number(result.lastInsertRowid),
      tournamentId,
    };
  });

  const schedule = generateRoundRobinSchedule(insertedTeams);

  for (const round of schedule) {
    const roundResult = insertRoundStatement.run(
      tournamentId,
      round.roundNumber,
    );
    const roundId = Number(roundResult.lastInsertRowid);

    for (const match of round.matches) {
      insertMatchStatement.run(
        tournamentId,
        roundId,
        match.teamAId,
        match.teamBId,
      );
    }
  }

  return loadTournamentDetails(tournamentId);
});

export function createRoundRobinTournament(
  selectedPlayers,
  matchType = "doubles",
  category = "no_gender",
) {
  try {
    return {
      success: true,
      data: createTournamentTransaction(selectedPlayers, matchType, category),
    };
  } catch (error) {
    return createFailure(error, "Failed to create tournament.");
  }
}

export function getTournamentById(tournamentId) {
  try {
    const numericTournamentId = Number(tournamentId);
    if (!Number.isInteger(numericTournamentId) || numericTournamentId <= 0) {
      return { success: false, message: "Tournament not found." };
    }

    const data = loadTournamentDetails(numericTournamentId);
    if (!data) {
      return { success: false, message: "Tournament not found." };
    }

    return { success: true, data };
  } catch (error) {
    return createFailure(error, "Failed to load tournament.");
  }
}

export function getLatestTournament() {
  try {
    const latestTournament = getLatestTournamentStatement.get();
    if (!latestTournament) {
      return { success: true, data: null };
    }

    return {
      success: true,
      data: loadTournamentDetails(Number(latestTournament.id)),
    };
  } catch (error) {
    return createFailure(error, "Failed to load tournament.");
  }
}

export function getTournamentMatches(tournamentId) {
  return getTournamentById(tournamentId);
}

export function getTournamentStandings(tournamentId) {
  const result = getTournamentById(tournamentId);
  if (!result.success) return result;

  return {
    success: true,
    data: {
      tournament: result.data.tournament,
      standings: result.data.standings,
      outcome: result.data.outcome,
    },
  };
}

const startMatchTransaction = db.transaction((matchId, courtId) => {
  const match = db.prepare(`
    SELECT
      tournament_matches.id,
      tournament_matches.tournament_id,
      tournament_matches.status,
      tournaments.status AS tournament_status
    FROM tournament_matches
    JOIN tournaments
      ON tournaments.id = tournament_matches.tournament_id
    WHERE tournament_matches.id = ?
  `).get(matchId);

  if (!match) {
    throw new Error("Tournament match not found.");
  }

  if (match.status === "playing") {
    throw new Error("This match has already started.");
  }

  if (match.status === "finished") {
    throw new Error("This match has already finished.");
  }

  if (match.tournament_status === "finished") {
    throw new Error("This tournament has already been finished.");
  }

  const court = db.prepare(`
    SELECT id, name, status
    FROM courts
    WHERE id = ?
  `).get(courtId);

  if (!court) {
    throw new Error("Selected court was not found.");
  }

  const activeNormalMatch = db.prepare(`
    SELECT id
    FROM matches
    WHERE court_id = ? AND status = 'playing'
    LIMIT 1
  `).get(courtId);

  const activeTournamentMatch = db.prepare(`
    SELECT id
    FROM tournament_matches
    WHERE court_id = ? AND status = 'playing'
    LIMIT 1
  `).get(courtId);

  const activeRotationMatch = db.prepare(`
    SELECT id
    FROM rotation_matches
    WHERE court_id = ? AND status = 'playing'
    LIMIT 1
  `).get(courtId);

  if (
    court.status !== "available"
    || activeNormalMatch
    || activeTournamentMatch
    || activeRotationMatch
  ) {
    throw new Error("Selected court is no longer available.");
  }

  const courtUpdate = db.prepare(`
    UPDATE courts
    SET status = 'playing'
    WHERE id = ? AND status = 'available'
  `).run(courtId);

  if (courtUpdate.changes !== 1) {
    throw new Error("Selected court is no longer available.");
  }

  const matchUpdate = db.prepare(`
    UPDATE tournament_matches
    SET court_id = ?, status = 'playing'
    WHERE id = ? AND status = 'pending'
  `).run(courtId, matchId);

  if (matchUpdate.changes !== 1) {
    throw new Error("This match could not be started.");
  }

  return loadTournamentDetails(Number(match.tournament_id));
});

export function startTournamentMatch(matchId, courtId) {
  try {
    const numericMatchId = Number(matchId);
    const numericCourtId = Number(courtId);

    if (!Number.isInteger(numericMatchId) || numericMatchId <= 0) {
      return { success: false, message: "Tournament match not found." };
    }

    if (!Number.isInteger(numericCourtId) || numericCourtId <= 0) {
      return { success: false, message: "Selected court was not found." };
    }

    return {
      success: true,
      data: startMatchTransaction(numericMatchId, numericCourtId),
    };
  } catch (error) {
    return createFailure(error, "Failed to start tournament match.");
  }
}

const finishMatchTransaction = db.transaction((matchId, winnerTeamId) => {
  const match = db.prepare(`
    SELECT
      tournament_matches.id,
      tournament_matches.tournament_id,
      tournament_matches.team_a_id,
      tournament_matches.team_b_id,
      tournament_matches.court_id,
      tournament_matches.status,
      tournaments.status AS tournament_status
    FROM tournament_matches
    JOIN tournaments
      ON tournaments.id = tournament_matches.tournament_id
    WHERE tournament_matches.id = ?
  `).get(matchId);

  if (!match) {
    throw new Error("Tournament match not found.");
  }

  if (match.status === "finished") {
    throw new Error("This match has already been completed.");
  }

  if (match.status === "pending") {
    throw new Error("This match must be started before selecting a winner.");
  }

  if (match.tournament_status === "finished") {
    throw new Error("This tournament has already been finished.");
  }

  if (
    winnerTeamId !== Number(match.team_a_id)
    && winnerTeamId !== Number(match.team_b_id)
  ) {
    throw new Error("The selected winner is not part of this match.");
  }

  if (match.court_id === null) {
    throw new Error("This match does not have an assigned court.");
  }

  const assignedCourt = db.prepare(`
    SELECT id
    FROM courts
    WHERE id = ?
  `).get(match.court_id);

  if (!assignedCourt) {
    throw new Error("The assigned court was not found.");
  }

  const updateResult = db.prepare(`
    UPDATE tournament_matches
    SET winner_team_id = ?, status = 'finished'
    WHERE id = ? AND status = 'playing'
  `).run(winnerTeamId, matchId);

  if (updateResult.changes !== 1) {
    throw new Error("This match could not be completed.");
  }

  db.prepare(`
    UPDATE courts
    SET status = 'available'
    WHERE id = ?
      AND NOT EXISTS (
        SELECT 1
        FROM matches
        WHERE matches.court_id = courts.id
          AND matches.status = 'playing'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM rotation_matches
        WHERE rotation_matches.court_id = courts.id
          AND rotation_matches.status = 'playing'
      )
      AND NOT EXISTS (
        SELECT 1
        FROM tournament_matches
        WHERE tournament_matches.court_id = courts.id
          AND tournament_matches.status = 'playing'
      )
  `).run(match.court_id);

  const pending = db.prepare(`
    SELECT COUNT(*) AS count
    FROM tournament_matches
    WHERE tournament_id = ? AND status <> 'finished'
  `).get(match.tournament_id);

  if (pending.count === 0) {
    db.prepare(`
      UPDATE tournaments
      SET status = 'finished'
      WHERE id = ?
    `).run(match.tournament_id);
  }

  return loadTournamentDetails(Number(match.tournament_id));
});

export function finishTournamentMatch(matchId, winnerTeamId) {
  try {
    const numericMatchId = Number(matchId);
    const numericWinnerTeamId = Number(winnerTeamId);

    if (!Number.isInteger(numericMatchId) || numericMatchId <= 0) {
      return { success: false, message: "Tournament match not found." };
    }

    if (!Number.isInteger(numericWinnerTeamId) || numericWinnerTeamId <= 0) {
      return {
        success: false,
        message: "The selected winner is not part of this match.",
      };
    }

    return {
      success: true,
      data: finishMatchTransaction(numericMatchId, numericWinnerTeamId),
    };
  } catch (error) {
    return createFailure(error, "Failed to complete tournament match.");
  }
}

const finishTournamentTransaction = db.transaction((tournamentId) => {
  const tournament = getTournamentStatement.get(tournamentId);
  if (!tournament) {
    throw new Error("Tournament not found.");
  }

  const matchCounts = db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN status <> 'finished' THEN 1 ELSE 0 END) AS pending
    FROM tournament_matches
    WHERE tournament_id = ?
  `).get(tournamentId);

  if (matchCounts.total === 0) {
    throw new Error("Tournament has no matches.");
  }

  if (matchCounts.pending > 0) {
    throw new Error("All matches must be completed before finishing the tournament.");
  }

  db.prepare(`
    UPDATE tournaments
    SET status = 'finished'
    WHERE id = ?
  `).run(tournamentId);

  return loadTournamentDetails(tournamentId);
});

export function finishTournament(tournamentId) {
  try {
    const numericTournamentId = Number(tournamentId);
    if (!Number.isInteger(numericTournamentId) || numericTournamentId <= 0) {
      return { success: false, message: "Tournament not found." };
    }

    return {
      success: true,
      data: finishTournamentTransaction(numericTournamentId),
    };
  } catch (error) {
    return createFailure(error, "Failed to finish tournament.");
  }
}
