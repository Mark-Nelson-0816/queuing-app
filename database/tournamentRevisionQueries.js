import db from "./database.js";
import {
  TOURNAMENT_CATEGORIES,
  TOURNAMENT_DIVISIONS,
  TOURNAMENT_LEVELS,
  TOURNAMENT_MATCH_TYPES,
  generateTournamentConfiguration as generatePureTournamentConfiguration,
} from "./tournamentGenerationLogic.js";

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const getEventRowStatement = db.prepare(`
  SELECT
    id,
    name,
    start_date,
    end_date,
    status,
    tournament_format_version,
    created_at
  FROM tournaments
  WHERE id = ? AND tournament_format_version >= 2
`);

const listEventRowsStatement = db.prepare(`
  SELECT
    tournaments.id,
    tournaments.name,
    tournaments.start_date,
    tournaments.end_date,
    tournaments.status,
    tournaments.tournament_format_version,
    tournaments.created_at,
    COUNT(DISTINCT tournament_configurations.id) AS configuration_count,
    COUNT(DISTINCT tournament_matches.id) AS match_count,
    COUNT(DISTINCT CASE
      WHEN tournament_matches.status = 'finished' THEN tournament_matches.id
    END) AS finished_match_count
  FROM tournaments
  LEFT JOIN tournament_configurations
    ON tournament_configurations.tournament_id = tournaments.id
  LEFT JOIN tournament_matches
    ON tournament_matches.tournament_id = tournaments.id
   AND tournament_matches.configuration_id IS NOT NULL
  WHERE tournaments.tournament_format_version >= 2
  GROUP BY tournaments.id
  ORDER BY
    CASE tournaments.status
      WHEN 'ongoing' THEN 0
      WHEN 'draft' THEN 1
      ELSE 2
    END,
    tournaments.start_date DESC,
    tournaments.id DESC
`);

const listHistoryRowsStatement = db.prepare(`
  SELECT
    tournaments.id,
    tournaments.name,
    tournaments.start_date,
    tournaments.end_date,
    tournaments.status,
    tournaments.tournament_format_version,
    tournaments.created_at,
    COUNT(DISTINCT tournament_configurations.id) AS configuration_count,
    COUNT(DISTINCT tournament_matches.id) AS match_count,
    COUNT(DISTINCT CASE
      WHEN tournament_matches.status = 'finished' THEN tournament_matches.id
    END) AS finished_match_count
  FROM tournaments
  LEFT JOIN tournament_configurations
    ON tournament_configurations.tournament_id = tournaments.id
  LEFT JOIN tournament_matches
    ON tournament_matches.tournament_id = tournaments.id
   AND tournament_matches.configuration_id IS NOT NULL
  WHERE tournaments.tournament_format_version >= 2
    AND tournaments.status = 'finished'
  GROUP BY tournaments.id
  ORDER BY tournaments.end_date DESC, tournaments.start_date DESC, tournaments.id DESC
`);

const getConfigurationRowsStatement = db.prepare(`
  SELECT id, tournament_id, division, match_type, category, level, created_at
  FROM tournament_configurations
  WHERE tournament_id = ?
  ORDER BY division, match_type, category, level, id
`);

const getParticipantRowsStatement = db.prepare(`
  SELECT
    tournament_participants.id,
    tournament_participants.configuration_id,
    tournament_participants.player_id,
    tournament_participants.level_snapshot,
    tournament_participants.gender_snapshot,
    tournament_participants.created_at,
    players.name AS player_name,
    players.level AS current_level,
    players.gender AS current_gender
  FROM tournament_participants
  JOIN tournament_configurations
    ON tournament_configurations.id = tournament_participants.configuration_id
  JOIN players
    ON players.id = tournament_participants.player_id
  WHERE tournament_configurations.tournament_id = ?
  ORDER BY tournament_participants.configuration_id, players.name COLLATE NOCASE
`);

const getGroupRowsStatement = db.prepare(`
  SELECT
    tournament_groups.id,
    tournament_groups.configuration_id,
    tournament_groups.group_number,
    tournament_groups.name,
    tournament_groups.created_at
  FROM tournament_groups
  JOIN tournament_configurations
    ON tournament_configurations.id = tournament_groups.configuration_id
  WHERE tournament_configurations.tournament_id = ?
  ORDER BY tournament_groups.configuration_id, tournament_groups.group_number
`);

const getTeamRowsStatement = db.prepare(`
  SELECT
    tournament_teams.id,
    tournament_teams.tournament_id,
    tournament_teams.configuration_id,
    tournament_teams.group_id,
    tournament_teams.team_number,
    tournament_teams.created_at,
    tournament_team_players.slot,
    tournament_participants.id AS participant_id,
    tournament_participants.player_id,
    tournament_participants.level_snapshot,
    tournament_participants.gender_snapshot,
    players.name AS player_name,
    players.level AS current_level,
    players.gender AS current_gender
  FROM tournament_teams
  LEFT JOIN tournament_team_players
    ON tournament_team_players.team_id = tournament_teams.id
  LEFT JOIN tournament_participants
    ON tournament_participants.id = tournament_team_players.participant_id
  LEFT JOIN players
    ON players.id = tournament_participants.player_id
  WHERE tournament_teams.tournament_id = ?
    AND tournament_teams.configuration_id IS NOT NULL
  ORDER BY
    tournament_teams.configuration_id,
    tournament_teams.group_id,
    tournament_teams.team_number,
    tournament_team_players.slot
`);

const getRoundRowsStatement = db.prepare(`
  SELECT
    tournament_rounds.id,
    tournament_rounds.tournament_id,
    tournament_rounds.configuration_id,
    tournament_rounds.group_id,
    tournament_rounds.round_number,
    tournament_rounds.created_at
  FROM tournament_rounds
  WHERE tournament_rounds.tournament_id = ?
    AND tournament_rounds.configuration_id IS NOT NULL
  ORDER BY
    tournament_rounds.configuration_id,
    tournament_rounds.group_id,
    tournament_rounds.round_number
`);

const getMatchRowsStatement = db.prepare(`
  SELECT
    tournament_matches.id,
    tournament_matches.tournament_id,
    tournament_matches.configuration_id,
    tournament_matches.group_id,
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
    AND tournament_matches.configuration_id IS NOT NULL
  ORDER BY
    tournament_matches.configuration_id,
    tournament_matches.group_id,
    tournament_matches.round_id,
    tournament_matches.id
`);

const getCanonicalPlayersStatement = db.prepare(`
  SELECT id, name, level, gender
  FROM players
  WHERE id IN (
    SELECT CAST(value AS INTEGER)
    FROM json_each(?)
  )
`);

const getConfigurationProfilesStatement = db.prepare(`
  SELECT id, name, level, gender
  FROM players
  ORDER BY name COLLATE NOCASE, id
`);

const insertEventStatement = db.prepare(`
  INSERT INTO tournaments (
    name,
    start_date,
    end_date,
    status,
    tournament_format_version
  ) VALUES (?, ?, ?, 'draft', 2)
`);

const insertConfigurationStatement = db.prepare(`
  INSERT INTO tournament_configurations (
    tournament_id,
    division,
    match_type,
    category,
    level
  ) VALUES (?, ?, ?, ?, ?)
`);

const insertParticipantStatement = db.prepare(`
  INSERT INTO tournament_participants (
    configuration_id,
    player_id,
    level_snapshot,
    gender_snapshot
  ) VALUES (?, ?, ?, ?)
`);

const insertGroupStatement = db.prepare(`
  INSERT INTO tournament_groups (configuration_id, group_number, name)
  VALUES (?, ?, ?)
`);

const insertRevisedTeamStatement = db.prepare(`
  INSERT INTO tournament_teams (
    tournament_id,
    configuration_id,
    group_id,
    player_1_id,
    player_2_id,
    team_number
  ) VALUES (?, ?, ?, ?, ?, ?)
`);

const insertTeamPlayerStatement = db.prepare(`
  INSERT INTO tournament_team_players (team_id, participant_id, slot)
  VALUES (?, ?, ?)
`);

const insertRevisedRoundStatement = db.prepare(`
  INSERT INTO tournament_rounds (
    tournament_id,
    configuration_id,
    group_id,
    round_number
  ) VALUES (?, ?, ?, ?)
`);

const insertRevisedMatchStatement = db.prepare(`
  INSERT INTO tournament_matches (
    tournament_id,
    configuration_id,
    group_id,
    round_id,
    team_a_id,
    team_b_id,
    status
  ) VALUES (?, ?, ?, ?, ?, ?, 'waiting')
`);

const getRevisedMatchLifecycleStatement = db.prepare(`
  SELECT
    tournament_matches.id,
    tournament_matches.tournament_id,
    tournament_matches.configuration_id,
    tournament_matches.group_id,
    tournament_matches.team_a_id,
    tournament_matches.team_b_id,
    tournament_matches.winner_team_id,
    tournament_matches.court_id,
    tournament_matches.status,
    tournaments.status AS tournament_status,
    tournament_configurations.match_type
  FROM tournament_matches
  JOIN tournaments
    ON tournaments.id = tournament_matches.tournament_id
  JOIN tournament_configurations
    ON tournament_configurations.id = tournament_matches.configuration_id
  WHERE tournament_matches.id = ?
    AND tournament_matches.configuration_id IS NOT NULL
    AND tournaments.tournament_format_version >= 2
`);

const getTeamPlayerIdsStatement = db.prepare(`
  SELECT tournament_participants.player_id
  FROM tournament_team_players
  JOIN tournament_participants
    ON tournament_participants.id = tournament_team_players.participant_id
  WHERE tournament_team_players.team_id IN (?, ?)
  ORDER BY tournament_team_players.team_id, tournament_team_players.slot
`);

const getPlayingPlayerConflictStatement = db.prepare(`
  WITH target_players AS (
    SELECT tournament_participants.player_id
    FROM tournament_team_players
    JOIN tournament_participants
      ON tournament_participants.id = tournament_team_players.participant_id
    WHERE tournament_team_players.team_id IN (?, ?)
  )
  SELECT players.name, courts.name AS court_name
  FROM tournament_matches
  JOIN tournament_teams AS team_a
    ON team_a.id = tournament_matches.team_a_id
  JOIN tournament_teams AS team_b
    ON team_b.id = tournament_matches.team_b_id
  JOIN target_players
    ON target_players.player_id IN (
      team_a.player_1_id,
      team_a.player_2_id,
      team_b.player_1_id,
      team_b.player_2_id
    )
  JOIN players
    ON players.id = target_players.player_id
  LEFT JOIN courts
    ON courts.id = tournament_matches.court_id
  WHERE tournament_matches.status = 'playing'
    AND tournament_matches.id <> ?
  LIMIT 1
`);

const getCourtStatement = db.prepare(`
  SELECT id, name, status
  FROM courts
  WHERE id = ?
`);

const getCourtConflictStatement = db.prepare(`
  SELECT 'normal' AS source
  FROM matches
  WHERE court_id = ? AND status = 'playing'
  UNION ALL
  SELECT 'rotation'
  FROM rotation_matches
  WHERE court_id = ? AND status = 'playing'
  UNION ALL
  SELECT 'tournament'
  FROM tournament_matches
  WHERE court_id = ? AND status = 'playing'
  LIMIT 1
`);

const reserveCourtStatement = db.prepare(`
  UPDATE courts
  SET status = 'playing'
  WHERE id = ? AND status = 'available'
`);

const releaseCourtStatement = db.prepare(`
  UPDATE courts
  SET status = 'available'
  WHERE id = ?
    AND NOT EXISTS (
      SELECT 1 FROM matches
      WHERE matches.court_id = courts.id AND matches.status = 'playing'
    )
    AND NOT EXISTS (
      SELECT 1 FROM rotation_matches
      WHERE rotation_matches.court_id = courts.id
        AND rotation_matches.status = 'playing'
    )
    AND NOT EXISTS (
      SELECT 1 FROM tournament_matches
      WHERE tournament_matches.court_id = courts.id
        AND tournament_matches.status = 'playing'
    )
`);

const updateWinnerStatsStatement = db.prepare(`
  UPDATE players
  SET
    total_matches_played = total_matches_played + 1,
    total_wins = total_wins + 1
  WHERE id = ?
`);

const updateLoserStatsStatement = db.prepare(`
  UPDATE players
  SET
    total_matches_played = total_matches_played + 1,
    total_losses = total_losses + 1
  WHERE id = ?
`);

// Converts internal failures into the consistent Tournament result contract.
function failure(error, fallbackMessage) {
  return {
    success: false,
    message: error instanceof Error && error.message
      ? error.message
      : fallbackMessage,
  };
}

// Parses a positive database ID and uses a caller-specific failure message.
function parseId(value, message) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new Error(message);
  return id;
}

// Accepts only real calendar dates in the database's YYYY-MM-DD format.
function parseDate(value, fieldName) {
  const date = String(value || "").trim();
  if (!ISO_DATE_PATTERN.test(date)) {
    throw new Error(`${fieldName} must use YYYY-MM-DD format.`);
  }

  const [year, month, day] = date.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year
    || parsed.getUTCMonth() !== month - 1
    || parsed.getUTCDate() !== day
  ) {
    throw new Error(`${fieldName} is not a valid date.`);
  }

  return date;
}

// Maps the top-level revised Tournament record for renderer use.
function mapEvent(row) {
  return {
    id: Number(row.id),
    name: row.name,
    startDate: row.start_date,
    endDate: row.end_date,
    status: row.status,
    formatVersion: Number(row.tournament_format_version),
    createdAt: row.created_at,
  };
}

// Maps list and history summaries without loading the full event graph.
function mapEventSummary(row) {
  return {
    ...mapEvent(row),
    configurationCount: Number(row.configuration_count || 0),
    matchCount: Number(row.match_count || 0),
    finishedMatchCount: Number(row.finished_match_count || 0),
  };
}

// Calculates standings and a completed-group result from persisted match rows.
function calculateGroupStandings(teams, matches) {
  const standingsByTeamId = new Map(teams.map((team) => [
    team.id,
    {
      teamId: team.id,
      teamNumber: team.teamNumber,
      team,
      matchesPlayed: 0,
      wins: 0,
      losses: 0,
    },
  ]));

  for (const match of matches) {
    if (match.status !== "finished") continue;
    const teamA = standingsByTeamId.get(match.teamAId);
    const teamB = standingsByTeamId.get(match.teamBId);
    if (!teamA || !teamB) continue;

    teamA.matchesPlayed += 1;
    teamB.matchesPlayed += 1;
    if (match.winnerTeamId === teamA.teamId) {
      teamA.wins += 1;
      teamB.losses += 1;
    } else if (match.winnerTeamId === teamB.teamId) {
      teamB.wins += 1;
      teamA.losses += 1;
    }
  }

  const standings = [...standingsByTeamId.values()].sort((first, second) => (
    second.wins - first.wins
    || first.losses - second.losses
    || first.teamNumber - second.teamNumber
  ));
  const complete = matches.length > 0
    && matches.every((match) => match.status === "finished");

  if (!complete || standings.length === 0) {
    return { standings, result: null };
  }

  const highestWins = standings[0].wins;
  const leaders = standings.filter((standing) => standing.wins === highestWins);
  return {
    standings,
    result: leaders.length === 1
      ? { type: "winner", wins: highestWins, team: leaders[0].team }
      : {
        type: "tie",
        wins: highestWins,
        teams: leaders.map((standing) => standing.team),
      },
  };
}

// Loads a complete revised event with a fixed number of bulk queries.
function loadTournamentEvent(tournamentId) {
  const eventRow = getEventRowStatement.get(tournamentId);
  if (!eventRow) return null;

  const configurationRows = getConfigurationRowsStatement.all(tournamentId);
  const participantRows = getParticipantRowsStatement.all(tournamentId);
  const groupRows = getGroupRowsStatement.all(tournamentId);
  const teamRows = getTeamRowsStatement.all(tournamentId);
  const roundRows = getRoundRowsStatement.all(tournamentId);
  const matchRows = getMatchRowsStatement.all(tournamentId);

  const participantsByConfigurationId = new Map();
  for (const row of participantRows) {
    const participant = {
      id: Number(row.id),
      playerId: Number(row.player_id),
      name: row.player_name,
      levelSnapshot: row.level_snapshot,
      genderSnapshot: row.gender_snapshot,
      currentLevel: row.current_level,
      currentGender: row.current_gender,
      createdAt: row.created_at,
    };
    const list = participantsByConfigurationId.get(Number(row.configuration_id)) || [];
    list.push(participant);
    participantsByConfigurationId.set(Number(row.configuration_id), list);
  }

  const teamById = new Map();
  const teamsByGroupId = new Map();
  for (const row of teamRows) {
    const teamId = Number(row.id);
    let team = teamById.get(teamId);
    if (!team) {
      team = {
        id: teamId,
        tournamentId: Number(row.tournament_id),
        configurationId: Number(row.configuration_id),
        groupId: Number(row.group_id),
        teamNumber: Number(row.team_number),
        players: [],
        createdAt: row.created_at,
      };
      teamById.set(teamId, team);
      const groupTeams = teamsByGroupId.get(team.groupId) || [];
      groupTeams.push(team);
      teamsByGroupId.set(team.groupId, groupTeams);
    }

    if (row.participant_id !== null) {
      team.players.push({
        participantId: Number(row.participant_id),
        playerId: Number(row.player_id),
        slot: Number(row.slot),
        name: row.player_name,
        levelSnapshot: row.level_snapshot,
        genderSnapshot: row.gender_snapshot,
        currentLevel: row.current_level,
        currentGender: row.current_gender,
      });
    }
  }

  const matchesByRoundId = new Map();
  const matchesByGroupId = new Map();
  for (const row of matchRows) {
    const winnerTeamId = row.winner_team_id === null
      ? null
      : Number(row.winner_team_id);
    const match = {
      id: Number(row.id),
      tournamentId: Number(row.tournament_id),
      configurationId: Number(row.configuration_id),
      groupId: Number(row.group_id),
      roundId: Number(row.round_id),
      teamAId: Number(row.team_a_id),
      teamBId: Number(row.team_b_id),
      winnerTeamId,
      status: row.status,
      courtId: row.court_id === null ? null : Number(row.court_id),
      court: row.court_id === null ? null : {
        id: Number(row.court_id),
        name: row.court_name || "Unknown Court",
        status: row.court_status || "unknown",
      },
      teamA: teamById.get(Number(row.team_a_id)) || null,
      teamB: teamById.get(Number(row.team_b_id)) || null,
      winnerTeam: winnerTeamId === null
        ? null
        : teamById.get(winnerTeamId) || null,
      createdAt: row.created_at,
    };

    const roundMatches = matchesByRoundId.get(match.roundId) || [];
    roundMatches.push(match);
    matchesByRoundId.set(match.roundId, roundMatches);
    const groupMatches = matchesByGroupId.get(match.groupId) || [];
    groupMatches.push(match);
    matchesByGroupId.set(match.groupId, groupMatches);
  }

  const roundsByGroupId = new Map();
  for (const row of roundRows) {
    const groupId = Number(row.group_id);
    const rounds = roundsByGroupId.get(groupId) || [];
    rounds.push({
      id: Number(row.id),
      tournamentId: Number(row.tournament_id),
      configurationId: Number(row.configuration_id),
      groupId,
      roundNumber: Number(row.round_number),
      matches: matchesByRoundId.get(Number(row.id)) || [],
      createdAt: row.created_at,
    });
    roundsByGroupId.set(groupId, rounds);
  }

  const groupsByConfigurationId = new Map();
  for (const row of groupRows) {
    const groupId = Number(row.id);
    const configurationId = Number(row.configuration_id);
    const teams = (teamsByGroupId.get(groupId) || [])
      .sort((first, second) => first.teamNumber - second.teamNumber);
    const matches = matchesByGroupId.get(groupId) || [];
    const { standings, result } = calculateGroupStandings(teams, matches);
    const group = {
      id: groupId,
      configurationId,
      groupNumber: Number(row.group_number),
      name: row.name,
      teams,
      rounds: roundsByGroupId.get(groupId) || [],
      standings,
      result,
      summary: {
        totalTeams: teams.length,
        totalMatches: matches.length,
        waitingMatches: matches.filter((match) => match.status === "waiting").length,
        playingMatches: matches.filter((match) => match.status === "playing").length,
        finishedMatches: matches.filter((match) => match.status === "finished").length,
      },
      createdAt: row.created_at,
    };
    const groups = groupsByConfigurationId.get(configurationId) || [];
    groups.push(group);
    groupsByConfigurationId.set(configurationId, groups);
  }

  const configurations = configurationRows.map((row) => {
    const id = Number(row.id);
    const groups = groupsByConfigurationId.get(id) || [];
    const teams = groups.flatMap((group) => group.teams);
    const matches = groups.flatMap((group) => (
      group.rounds.flatMap((round) => round.matches)
    ));
    return {
      id,
      tournamentId: Number(row.tournament_id),
      division: row.division,
      matchType: row.match_type,
      category: row.category,
      level: row.level,
      participants: participantsByConfigurationId.get(id) || [],
      teams,
      groups,
      summary: {
        totalParticipants: (participantsByConfigurationId.get(id) || []).length,
        totalTeams: teams.length,
        totalGroups: groups.length,
        totalMatches: matches.length,
        waitingMatches: matches.filter((match) => match.status === "waiting").length,
        playingMatches: matches.filter((match) => match.status === "playing").length,
        finishedMatches: matches.filter((match) => match.status === "finished").length,
      },
      createdAt: row.created_at,
    };
  });

  const allMatches = configurations.flatMap((configuration) => (
    configuration.groups.flatMap((group) => (
      group.rounds.flatMap((round) => round.matches)
    ))
  ));

  return {
    tournament: mapEvent(eventRow),
    configurations,
    summary: {
      totalConfigurations: configurations.length,
      totalParticipants: configurations.reduce(
        (sum, configuration) => sum + configuration.summary.totalParticipants,
        0,
      ),
      totalTeams: configurations.reduce(
        (sum, configuration) => sum + configuration.summary.totalTeams,
        0,
      ),
      totalGroups: configurations.reduce(
        (sum, configuration) => sum + configuration.summary.totalGroups,
        0,
      ),
      totalMatches: allMatches.length,
      waitingMatches: allMatches.filter((match) => match.status === "waiting").length,
      playingMatches: allMatches.filter((match) => match.status === "playing").length,
      finishedMatches: allMatches.filter((match) => match.status === "finished").length,
    },
  };
}

// Resolves selected permanent profiles in one query and preserves selected order.
function resolveCanonicalPlayers(selectedPlayers) {
  if (!Array.isArray(selectedPlayers)) {
    throw new Error("Please select Tournament players.");
  }

  const playerIds = selectedPlayers.map((player) => Number(
    typeof player === "object" && player !== null ? player.id : player,
  ));
  if (playerIds.some((id) => !Number.isInteger(id) || id <= 0)) {
    throw new Error("One or more selected Tournament players are invalid.");
  }
  if (new Set(playerIds).size !== playerIds.length) {
    throw new Error("A player can only appear once in this Tournament configuration.");
  }

  const playerById = new Map(
    getCanonicalPlayersStatement.all(JSON.stringify(playerIds)).map((player) => [
      Number(player.id),
      {
        id: Number(player.id),
        name: player.name,
        level: player.level,
        gender: player.gender,
      },
    ]),
  );

  return playerIds.map((playerId) => {
    const player = playerById.get(playerId);
    if (!player) throw new Error(`Tournament player ${playerId} was not found.`);
    return player;
  });
}

// Ensures a persisted match has exactly the expected Singles or Doubles players.
function getCompleteMatchPlayerIds(match) {
  const playerIds = getTeamPlayerIdsStatement.all(
    match.team_a_id,
    match.team_b_id,
  ).map((row) => Number(row.player_id));
  const expectedCount = match.match_type === "singles" ? 2 : 4;
  if (playerIds.length !== expectedCount || new Set(playerIds).size !== expectedCount) {
    throw new Error("Tournament match participants are incomplete or duplicated.");
  }
  return playerIds;
}

// Creates a named, multi-day revised Tournament in draft status.
export function createTournamentEvent(name, startDate, endDate) {
  try {
    const normalizedName = String(name || "").trim();
    if (!normalizedName) throw new Error("Tournament name is required.");
    const normalizedStartDate = parseDate(startDate, "Tournament start date");
    const normalizedEndDate = parseDate(endDate, "Tournament end date");
    if (normalizedStartDate > normalizedEndDate) {
      throw new Error("Tournament start date must not be after its end date.");
    }

    const result = insertEventStatement.run(
      normalizedName,
      normalizedStartDate,
      normalizedEndDate,
    );
    return {
      success: true,
      data: loadTournamentEvent(Number(result.lastInsertRowid)),
    };
  } catch (error) {
    return failure(error, "Failed to create Tournament.");
  }
}

// Lists all revised draft, ongoing, and finished Tournament events.
export function listTournamentEvents() {
  try {
    return { success: true, data: listEventRowsStatement.all().map(mapEventSummary) };
  } catch (error) {
    return failure(error, "Failed to list Tournaments.");
  }
}

// Returns one complete revised Tournament event graph.
export function getTournamentEvent(tournamentId) {
  try {
    const id = parseId(tournamentId, "Tournament not found.");
    const tournament = loadTournamentEvent(id);
    if (!tournament) throw new Error("Tournament not found.");
    return { success: true, data: tournament };
  } catch (error) {
    return failure(error, "Failed to load Tournament.");
  }
}

// Lists finished revised Tournaments for persistent history navigation.
export function getTournamentEventHistory() {
  try {
    return { success: true, data: listHistoryRowsStatement.all().map(mapEventSummary) };
  } catch (error) {
    return failure(error, "Failed to load Tournament history.");
  }
}

// Returns permanent profiles and the exact options supported by revised generation.
export function getTournamentConfigurationData() {
  try {
    return {
      success: true,
      data: {
        players: getConfigurationProfilesStatement.all().map((player) => ({
          id: Number(player.id),
          name: player.name,
          level: player.level,
          gender: player.gender,
        })),
        options: {
          divisions: [...TOURNAMENT_DIVISIONS],
          levels: [...TOURNAMENT_LEVELS],
          matchTypes: [...TOURNAMENT_MATCH_TYPES],
          categories: [...TOURNAMENT_CATEGORIES],
          categoriesByMatchType: {
            singles: ["mens", "womens", "no_gender"],
            doubles: ["mens", "womens", "mixed", "no_gender"],
          },
        },
      },
    };
  } catch (error) {
    return failure(error, "Failed to load Tournament configuration data.");
  }
}

// Persists one generated configuration and its complete child graph atomically.
const generateConfigurationTransaction = db.transaction((
  tournamentId,
  selectedPlayers,
  configuration,
  random,
) => {
  const tournament = getEventRowStatement.get(tournamentId);
  if (!tournament) throw new Error("Tournament not found.");
  if (tournament.status === "finished") {
    throw new Error("Finished Tournaments are read-only.");
  }

  const players = resolveCanonicalPlayers(selectedPlayers);
  const generated = generatePureTournamentConfiguration(
    players,
    configuration,
    random,
  );

  const configurationResult = insertConfigurationStatement.run(
    tournamentId,
    configuration.division,
    configuration.matchType,
    configuration.category,
    configuration.level,
  );
  const configurationId = Number(configurationResult.lastInsertRowid);

  const participantIdByPlayerId = new Map();
  for (const player of players) {
    const result = insertParticipantStatement.run(
      configurationId,
      player.id,
      player.level,
      player.gender,
    );
    participantIdByPlayerId.set(player.id, Number(result.lastInsertRowid));
  }

  const teamIdByTeamNumber = new Map();
  for (const group of generated.groups) {
    const groupResult = insertGroupStatement.run(
      configurationId,
      group.groupNumber,
      group.name,
    );
    const groupId = Number(groupResult.lastInsertRowid);

    for (const team of group.teams) {
      const teamResult = insertRevisedTeamStatement.run(
        tournamentId,
        configurationId,
        groupId,
        team.player1Id,
        team.player2Id,
        team.teamNumber,
      );
      const teamId = Number(teamResult.lastInsertRowid);
      teamIdByTeamNumber.set(team.teamNumber, teamId);

      for (const member of team.members) {
        insertTeamPlayerStatement.run(
          teamId,
          participantIdByPlayerId.get(member.playerId),
          member.slot,
        );
      }
    }

    for (const round of group.rounds) {
      const roundResult = insertRevisedRoundStatement.run(
        tournamentId,
        configurationId,
        groupId,
        round.roundNumber,
      );
      const roundId = Number(roundResult.lastInsertRowid);

      for (const match of round.matches) {
        insertRevisedMatchStatement.run(
          tournamentId,
          configurationId,
          groupId,
          roundId,
          teamIdByTeamNumber.get(match.teamANumber),
          teamIdByTeamNumber.get(match.teamBNumber),
        );
      }
    }
  }

  return configurationId;
});

// Generates and stores one exact division/type/category/level configuration.
export function generateTournamentEventConfiguration(
  tournamentId,
  selectedPlayers,
  division,
  matchType,
  category,
  level,
  random = Math.random,
) {
  try {
    const id = parseId(tournamentId, "Tournament not found.");
    const configurationId = generateConfigurationTransaction(
      id,
      selectedPlayers,
      { division, matchType, category, level },
      random,
    );
    const tournament = loadTournamentEvent(id);
    return {
      success: true,
      data: {
        tournament,
        configuration: tournament.configurations.find(
          (configuration) => configuration.id === configurationId,
        ) || null,
      },
    };
  } catch (error) {
    const message = error instanceof Error && /UNIQUE constraint failed: tournament_configurations/i.test(error.message)
      ? "This exact Tournament configuration already exists."
      : undefined;
    return failure(message ? new Error(message) : error, "Failed to generate Tournament configuration.");
  }
}

// Starts one waiting revised Tournament match and reserves a shared court.
const startEventMatchTransaction = db.transaction((matchId, courtId) => {
  const match = getRevisedMatchLifecycleStatement.get(matchId);
  if (!match) throw new Error("Tournament match not found.");
  if (match.tournament_status === "finished") {
    throw new Error("Finished Tournaments are read-only.");
  }
  if (match.status !== "waiting") {
    throw new Error(match.status === "playing"
      ? "This Tournament match has already started."
      : "Only a waiting Tournament match can be started.");
  }

  getCompleteMatchPlayerIds(match);

  const court = getCourtStatement.get(courtId);
  if (!court) throw new Error("Selected court was not found.");
  const courtConflict = getCourtConflictStatement.get(courtId, courtId, courtId);
  if (court.status !== "available" || courtConflict) {
    throw new Error("Selected court is no longer available.");
  }

  const playerConflict = getPlayingPlayerConflictStatement.get(
    match.team_a_id,
    match.team_b_id,
    matchId,
  );
  if (playerConflict) {
    const courtContext = playerConflict.court_name
      ? ` on ${playerConflict.court_name}`
      : "";
    throw new Error(
      `${playerConflict.name} is already playing another Tournament match${courtContext}.`,
    );
  }

  if (match.tournament_status === "draft") {
    const eventUpdate = db.prepare(`
      UPDATE tournaments
      SET status = 'ongoing'
      WHERE id = ? AND status = 'draft'
    `).run(match.tournament_id);
    if (eventUpdate.changes !== 1) {
      throw new Error("Tournament could not be started.");
    }
  } else if (match.tournament_status !== "ongoing") {
    throw new Error("Tournament is not available to start matches.");
  }

  if (reserveCourtStatement.run(courtId).changes !== 1) {
    throw new Error("Selected court is no longer available.");
  }

  const matchUpdate = db.prepare(`
    UPDATE tournament_matches
    SET court_id = ?, status = 'playing'
    WHERE id = ? AND status = 'waiting'
  `).run(courtId, matchId);
  if (matchUpdate.changes !== 1) {
    throw new Error("This Tournament match could not be started.");
  }

  return Number(match.tournament_id);
});

// Validates IDs and starts a revised Tournament match.
export function startTournamentEventMatch(matchId, courtId) {
  try {
    const numericMatchId = parseId(matchId, "Tournament match not found.");
    const numericCourtId = parseId(courtId, "Selected court was not found.");
    const tournamentId = startEventMatchTransaction(numericMatchId, numericCourtId);
    return { success: true, data: loadTournamentEvent(tournamentId) };
  } catch (error) {
    const ongoingConflict = error instanceof Error
      && /uq_tournaments_one_ongoing|UNIQUE constraint failed.*tournaments/i.test(error.message);
    return failure(
      ongoingConflict
        ? new Error("Only one Tournament may be ongoing at a time.")
        : error,
      "Failed to start Tournament match.",
    );
  }
}

// Finishes one playing match, awards lifetime stats once, and releases its court.
const finishEventMatchTransaction = db.transaction((matchId, winnerTeamId) => {
  const match = getRevisedMatchLifecycleStatement.get(matchId);
  if (!match) throw new Error("Tournament match not found.");
  if (match.tournament_status === "finished") {
    throw new Error("Finished Tournaments are read-only.");
  }
  if (match.status === "finished") {
    throw new Error("This Tournament match has already been completed.");
  }
  if (match.status !== "playing") {
    throw new Error("This Tournament match must be started before selecting a winner.");
  }
  if (match.court_id === null) {
    throw new Error("This Tournament match does not have an assigned court.");
  }
  if (
    winnerTeamId !== Number(match.team_a_id)
    && winnerTeamId !== Number(match.team_b_id)
  ) {
    throw new Error("The selected winner is not part of this Tournament match.");
  }

  const update = db.prepare(`
    UPDATE tournament_matches
    SET winner_team_id = ?, status = 'finished'
    WHERE id = ? AND status = 'playing'
  `).run(winnerTeamId, matchId);
  if (update.changes !== 1) {
    throw new Error("This Tournament match could not be completed.");
  }

  const teamPlayers = getCompleteMatchPlayerIds(match);

  const winningPlayerIds = new Set(
    getTeamPlayerIdsStatement.all(winnerTeamId, winnerTeamId)
      .map((row) => Number(row.player_id)),
  );
  if (winningPlayerIds.size === 0) {
    throw new Error("Tournament winning team has no participants.");
  }
  const expectedWinningCount = match.match_type === "singles" ? 1 : 2;
  if (winningPlayerIds.size !== expectedWinningCount) {
    throw new Error("Tournament winning team participants are incomplete.");
  }

  for (const playerId of teamPlayers) {
    const statement = winningPlayerIds.has(playerId)
      ? updateWinnerStatsStatement
      : updateLoserStatsStatement;
    if (statement.run(playerId).changes !== 1) {
      throw new Error("Tournament player statistics could not be updated.");
    }
  }

  releaseCourtStatement.run(match.court_id);
  return Number(match.tournament_id);
});

// Validates the winner and finishes a revised Tournament match atomically.
export function finishTournamentEventMatch(matchId, winnerTeamId) {
  try {
    const numericMatchId = parseId(matchId, "Tournament match not found.");
    const numericWinnerTeamId = parseId(
      winnerTeamId,
      "The selected winner is not part of this Tournament match.",
    );
    const tournamentId = finishEventMatchTransaction(
      numericMatchId,
      numericWinnerTeamId,
    );
    return { success: true, data: loadTournamentEvent(tournamentId) };
  } catch (error) {
    return failure(error, "Failed to finish Tournament match.");
  }
}

// Deletes exactly one editable configuration and releases any playing courts.
const resetConfigurationTransaction = db.transaction((configurationId) => {
  const configuration = db.prepare(`
    SELECT
      tournament_configurations.id,
      tournament_configurations.tournament_id,
      tournaments.status AS tournament_status
    FROM tournament_configurations
    JOIN tournaments
      ON tournaments.id = tournament_configurations.tournament_id
    WHERE tournament_configurations.id = ?
      AND tournaments.tournament_format_version >= 2
  `).get(configurationId);
  if (!configuration) throw new Error("Tournament configuration not found.");
  if (configuration.tournament_status === "finished") {
    throw new Error("Finished Tournaments are read-only.");
  }
  if (!new Set(["draft", "ongoing"]).has(configuration.tournament_status)) {
    throw new Error("Tournament configuration cannot be reset in its current state.");
  }

  const courtIds = db.prepare(`
    SELECT DISTINCT court_id
    FROM tournament_matches
    WHERE configuration_id = ?
      AND status = 'playing'
      AND court_id IS NOT NULL
  `).all(configurationId).map((row) => Number(row.court_id));

  const deleted = db.prepare(`
    DELETE FROM tournament_configurations
    WHERE id = ?
  `).run(configurationId);
  if (deleted.changes !== 1) {
    throw new Error("Tournament configuration could not be reset.");
  }

  for (const courtId of courtIds) releaseCourtStatement.run(courtId);
  return Number(configuration.tournament_id);
});

// Resets one configuration without reversing historical lifetime statistics.
export function resetTournamentEventConfiguration(configurationId) {
  try {
    const id = parseId(configurationId, "Tournament configuration not found.");
    const tournamentId = resetConfigurationTransaction(id);
    return { success: true, data: loadTournamentEvent(tournamentId) };
  } catch (error) {
    return failure(error, "Failed to reset Tournament configuration.");
  }
}

// Manually finishes an event only when no waiting or playing match remains.
const finishEventTransaction = db.transaction((tournamentId) => {
  const tournament = getEventRowStatement.get(tournamentId);
  if (!tournament) throw new Error("Tournament not found.");
  if (tournament.status === "finished") {
    throw new Error("This Tournament has already been finished.");
  }

  const unfinished = db.prepare(`
    SELECT COUNT(*) AS count
    FROM tournament_matches
    WHERE tournament_id = ?
      AND configuration_id IS NOT NULL
      AND status IN ('waiting', 'playing')
  `).get(tournamentId);
  if (Number(unfinished.count) > 0) {
    throw new Error(
      "All waiting and playing Tournament matches must be completed before finishing the Tournament.",
    );
  }

  const update = db.prepare(`
    UPDATE tournaments
    SET status = 'finished'
    WHERE id = ? AND status IN ('draft', 'ongoing')
  `).run(tournamentId);
  if (update.changes !== 1) throw new Error("Tournament could not be finished.");
  return tournamentId;
});

// Performs the explicit manual Tournament finish action.
export function finishTournamentEvent(tournamentId) {
  try {
    const id = parseId(tournamentId, "Tournament not found.");
    finishEventTransaction(id);
    return { success: true, data: loadTournamentEvent(id) };
  } catch (error) {
    return failure(error, "Failed to finish Tournament.");
  }
}
