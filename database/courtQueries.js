import db from "./database.js";

const getCourtRowsStatement = db.prepare(`
  SELECT id, name, status, created_at
  FROM courts
  ORDER BY id ASC
`);

const getActiveNormalMatchesStatement = db.prepare(`
  SELECT id, court_id, player_one, player_two, status
  FROM matches
  WHERE status = 'playing' AND court_id IS NOT NULL
  ORDER BY id ASC
`);

const getNormalMatchPlayersStatement = db.prepare(`
  SELECT
    players.id,
    players.name,
    players.level,
    match_players.team,
    match_players.match_type,
    match_players.id AS match_player_id
  FROM match_players
  JOIN players
    ON players.id = match_players.player_id
  WHERE match_players.match_id = ?
    AND match_players.source = 'normal'
  ORDER BY COALESCE(match_players.team, 0) ASC, match_players.id ASC
`);

const getFallbackNormalPlayersStatement = db.prepare(`
  SELECT id, name, level
  FROM players
  WHERE id IN (?, ?)
  ORDER BY CASE WHEN id = ? THEN 0 ELSE 1 END
`);

const getActiveTournamentMatchesStatement = db.prepare(`
  SELECT
    tournament_matches.id AS match_id,
    tournament_matches.court_id,
    tournament_matches.tournament_id,
    tournament_matches.status,
    tournaments.match_type,
    tournaments.category,
    tournament_rounds.round_number,
    team_a.id AS team_a_id,
    team_a.team_number AS team_a_number,
    team_a_player_1.id AS team_a_player_1_id,
    team_a_player_1.name AS team_a_player_1_name,
    team_a_player_1.level AS team_a_player_1_level,
    team_a_player_2.id AS team_a_player_2_id,
    team_a_player_2.name AS team_a_player_2_name,
    team_a_player_2.level AS team_a_player_2_level,
    team_b.id AS team_b_id,
    team_b.team_number AS team_b_number,
    team_b_player_1.id AS team_b_player_1_id,
    team_b_player_1.name AS team_b_player_1_name,
    team_b_player_1.level AS team_b_player_1_level,
    team_b_player_2.id AS team_b_player_2_id,
    team_b_player_2.name AS team_b_player_2_name,
    team_b_player_2.level AS team_b_player_2_level
  FROM tournament_matches
  JOIN tournaments
    ON tournaments.id = tournament_matches.tournament_id
  JOIN tournament_rounds
    ON tournament_rounds.id = tournament_matches.round_id
  JOIN tournament_teams AS team_a
    ON team_a.id = tournament_matches.team_a_id
  JOIN tournament_teams AS team_b
    ON team_b.id = tournament_matches.team_b_id
  LEFT JOIN players AS team_a_player_1
    ON team_a_player_1.id = team_a.player_1_id
  LEFT JOIN players AS team_a_player_2
    ON team_a_player_2.id = team_a.player_2_id
  LEFT JOIN players AS team_b_player_1
    ON team_b_player_1.id = team_b.player_1_id
  LEFT JOIN players AS team_b_player_2
    ON team_b_player_2.id = team_b.player_2_id
  WHERE tournament_matches.status = 'playing'
    AND tournament_matches.court_id IS NOT NULL
  ORDER BY tournament_matches.id ASC
`);

function mapPlayer(id, name, level) {
  if (id === null || id === undefined) return null;

  return {
    id: Number(id),
    name: name || "Unknown Player",
    level: level || "unknown",
  };
}

function mapTournamentTeam(row, side) {
  const prefix = `team_${side}`;
  const players = [
    mapPlayer(
      row[`${prefix}_player_1_id`],
      row[`${prefix}_player_1_name`],
      row[`${prefix}_player_1_level`],
    ),
    mapPlayer(
      row[`${prefix}_player_2_id`],
      row[`${prefix}_player_2_name`],
      row[`${prefix}_player_2_level`],
    ),
  ].filter(Boolean);

  return {
    id: Number(row[`${prefix}_id`]),
    teamNumber: Number(row[`${prefix}_number`]),
    players,
  };
}

function mapTournamentMatch(row) {
  const teamA = mapTournamentTeam(row, "a");
  const teamB = mapTournamentTeam(row, "b");

  return {
    source: "tournament",
    matchId: Number(row.match_id),
    courtId: Number(row.court_id),
    tournamentId: Number(row.tournament_id),
    roundNumber: Number(row.round_number),
    matchType: row.match_type,
    category: row.category,
    status: row.status,
    teamA,
    teamB,
    players: [...teamA.players, ...teamB.players],
  };
}

function mapNormalMatch(row) {
  let players = getNormalMatchPlayersStatement.all(row.id).map((player) => ({
    id: Number(player.id),
    name: player.name,
    level: player.level,
    team: player.team === null ? null : Number(player.team),
    matchType: player.match_type,
  }));

  if (players.length === 0) {
    players = getFallbackNormalPlayersStatement
      .all(row.player_one, row.player_two, row.player_one)
      .map((player) => ({
        id: Number(player.id),
        name: player.name,
        level: player.level,
        team: null,
        matchType: "singles",
      }));
  }

  const matchType = players[0]?.matchType
    || (players.length === 4 ? "doubles" : "singles");
  let teamAPlayers;
  let teamBPlayers;

  if (matchType === "doubles") {
    teamAPlayers = players.filter((player) => player.team === 1);
    teamBPlayers = players.filter((player) => player.team === 2);

    if (teamAPlayers.length === 0 || teamBPlayers.length === 0) {
      teamAPlayers = players.slice(0, 2);
      teamBPlayers = players.slice(2, 4);
    }
  } else {
    teamAPlayers = players.slice(0, 1);
    teamBPlayers = players.slice(1, 2);
  }

  const cleanPlayer = (player) => ({
    id: player.id,
    name: player.name,
    level: player.level,
  });

  const teamA = {
    id: null,
    teamNumber: 1,
    players: teamAPlayers.map(cleanPlayer),
  };
  const teamB = {
    id: null,
    teamNumber: 2,
    players: teamBPlayers.map(cleanPlayer),
  };

  return {
    source: "normal",
    matchId: Number(row.id),
    courtId: Number(row.court_id),
    status: row.status,
    matchType,
    category: null,
    roundNumber: null,
    teamA,
    teamB,
    players: [...teamA.players, ...teamB.players],
  };
}

export function getCourts() {
  const courts = getCourtRowsStatement.all();
  const normalMatchesByCourt = new Map(
    getActiveNormalMatchesStatement.all().map((match) => [
      Number(match.court_id),
      mapNormalMatch(match),
    ]),
  );
  const tournamentMatchesByCourt = new Map(
    getActiveTournamentMatchesStatement.all().map((match) => [
      Number(match.court_id),
      mapTournamentMatch(match),
    ]),
  );

  return courts.map((court) => {
    const courtId = Number(court.id);
    const activeMatch = tournamentMatchesByCourt.get(courtId)
      || normalMatchesByCourt.get(courtId)
      || null;
    const playerDetails = activeMatch?.players || [];

    if (activeMatch) {
      activeMatch.courtName = court.name;
    }

    return {
      id: courtId,
      name: court.name,
      status: activeMatch ? "playing" : court.status,
      source: activeMatch?.source || null,
      match_type: activeMatch?.matchType || null,
      players: playerDetails.map((player) => player.name),
      playerDetails,
      activeMatch,
      created_at: court.created_at,
    };
  });
}

export function getAvailableCourts() {
  return getCourts()
    .filter((court) => court.status === "available" && !court.activeMatch)
    .map((court) => ({
      id: court.id,
      name: court.name,
      status: court.status,
    }));
}

export function getAvailableCourt() {
  return getAvailableCourts()[0];
}

export function updateCourtStatus(id, status) {
  return db.prepare(`
    UPDATE courts
    SET status = ?
    WHERE id = ?
  `).run(status, id);
}

export function addCourt(name) {
  return db.prepare(`
    INSERT INTO courts(name)
    VALUES(?)
  `).run(name);
}

export function removeCourt(id) {
  const activeTournamentMatch = db.prepare(`
    SELECT id
    FROM tournament_matches
    WHERE court_id = ? AND status = 'playing'
    LIMIT 1
  `).get(id);

  if (activeTournamentMatch) {
    return {
      success: false,
      error: "Cannot remove a court with an active tournament match.",
    };
  }

  db.prepare(`
    DELETE FROM matches
    WHERE court_id = ?
  `).run(id);

  db.prepare(`
    UPDATE round_robin_matches
    SET court_id = NULL, status = 'pending'
    WHERE court_id = ?
  `).run(id);

  db.prepare(`
    DELETE FROM courts
    WHERE id = ?
  `).run(id);

  return { success: true };
}
