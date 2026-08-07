import db from "./database.js";
import {
  generateDoublesMatches,
  generateRotationMatches,
  getRotationLevelValue,
  normalizeRotationGender,
  normalizeRankPreference,
  playerAllowsCategory,
  validateRotationArrangement,
} from "./rotationLogic.js";

// Converts database errors into the consistent Rotation Queue API shape.
function failure(error, fallbackMessage) {
  return {
    success: false,
    message: error instanceof Error && error.message
      ? error.message
      : fallbackMessage,
  };
}

// Validates and converts IDs before they reach database operations.
function parsePositiveId(value, message) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new Error(message);
  return id;
}

// Safely reads warning arrays stored as JSON text.
function parseWarnings(value) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// Loads today's registered players in fair waiting order.
const getDailyPlayersStatement = db.prepare(`
  SELECT
    players.id,
    players.name,
    players.level,
    players.gender,
    players.rank_match_preference,
    players.prefer_mens,
    players.prefer_womens,
    players.prefer_mixed,
    players.prefer_no_gender,
    registered_players_today.id AS registration_id,
    registered_players_today.match_count,
    registered_players_today.wins,
    registered_players_today.losses,
    registered_players_today.status,
    registered_players_today.is_done_today,
    registered_players_today.available_since,
    registered_players_today.created_at
  FROM registered_players_today
  JOIN players
    ON players.id = registered_players_today.player_id
  WHERE registered_players_today.registered_date = CURRENT_DATE
  ORDER BY
    registered_players_today.available_since ASC,
    registered_players_today.created_at ASC,
    players.name ASC
`);

// Loads active teammate locks that apply today.
const getActiveLocksStatement = db.prepare(`
  SELECT
    player_team_locks.id,
    player_team_locks.player_1_id,
    player_team_locks.player_2_id,
    player_team_locks.lock_type,
    player_team_locks.lock_date,
    player_team_locks.created_at,
    player_1.name AS player_1_name,
    player_2.name AS player_2_name
  FROM player_team_locks
  JOIN players AS player_1 ON player_1.id = player_team_locks.player_1_id
  JOIN players AS player_2 ON player_2.id = player_team_locks.player_2_id
  WHERE player_team_locks.is_active = 1
    AND (
      player_team_locks.lock_type = 'permanent'
      OR player_team_locks.lock_date = CURRENT_DATE
    )
  ORDER BY player_team_locks.id ASC
`);

// Loads all Rotation Queue matches in operator-friendly status order.
const getRotationMatchRowsStatement = db.prepare(`
  SELECT
    rotation_matches.id,
    rotation_matches.queue_position,
    rotation_matches.match_type,
    rotation_matches.category,
    rotation_matches.status,
    rotation_matches.court_id,
    rotation_matches.winner_team,
    rotation_matches.team_a_strength,
    rotation_matches.team_b_strength,
    rotation_matches.balance_difference,
    rotation_matches.warnings,
    rotation_matches.validation_message,
    rotation_matches.start_time,
    rotation_matches.end_time,
    rotation_matches.created_at,
    rotation_matches.updated_at,
    courts.name AS court_name,
    courts.status AS court_status
  FROM rotation_matches
  LEFT JOIN courts ON courts.id = rotation_matches.court_id
  ORDER BY
    CASE rotation_matches.status
      WHEN 'playing' THEN 0
      WHEN 'waiting' THEN 1
      WHEN 'incomplete' THEN 2
      WHEN 'finished' THEN 3
      ELSE 4
    END,
    rotation_matches.queue_position ASC,
    rotation_matches.id DESC
`);

// Loads only complete, valid waiting matches in public queue order.
const getRotationNextUpRowsStatement = db.prepare(`
  SELECT
    rotation_matches.id,
    rotation_matches.queue_position,
    rotation_matches.match_type,
    rotation_matches.category,
    rotation_matches.status,
    rotation_matches.court_id,
    rotation_matches.winner_team,
    rotation_matches.team_a_strength,
    rotation_matches.team_b_strength,
    rotation_matches.balance_difference,
    rotation_matches.warnings,
    rotation_matches.validation_message,
    rotation_matches.start_time,
    rotation_matches.end_time,
    rotation_matches.created_at,
    rotation_matches.updated_at,
    NULL AS court_name,
    NULL AS court_status
  FROM rotation_matches
  WHERE rotation_matches.status = 'waiting'
    AND rotation_matches.queue_position IS NOT NULL
    AND rotation_matches.court_id IS NULL
    AND COALESCE(TRIM(rotation_matches.validation_message), '') = ''
    AND (
      SELECT COUNT(*)
      FROM rotation_match_players
      WHERE rotation_match_players.rotation_match_id = rotation_matches.id
    ) = CASE rotation_matches.match_type WHEN 'singles' THEN 2 ELSE 4 END
    AND (
      SELECT COUNT(*)
      FROM rotation_match_players
      WHERE rotation_match_players.rotation_match_id = rotation_matches.id
        AND rotation_match_players.team = 1
    ) = CASE rotation_matches.match_type WHEN 'singles' THEN 1 ELSE 2 END
    AND (
      SELECT COUNT(*)
      FROM rotation_match_players
      WHERE rotation_match_players.rotation_match_id = rotation_matches.id
        AND rotation_match_players.team = 2
    ) = CASE rotation_matches.match_type WHEN 'singles' THEN 1 ELSE 2 END
  ORDER BY
    rotation_matches.queue_position ASC,
    rotation_matches.created_at ASC,
    rotation_matches.id ASC
`);

// Loads one match's players with registration, preference, and lock data.
const getRotationParticipantsStatement = db.prepare(`
  SELECT
    rotation_match_players.id,
    rotation_match_players.rotation_match_id,
    rotation_match_players.registered_player_id,
    rotation_match_players.player_id,
    rotation_match_players.team,
    rotation_match_players.slot,
    rotation_match_players.lock_id,
    players.name,
    players.level,
    players.gender,
    players.rank_match_preference,
    players.prefer_mens,
    players.prefer_womens,
    players.prefer_mixed,
    players.prefer_no_gender,
    registered_players_today.match_count,
    registered_players_today.wins,
    registered_players_today.losses,
    registered_players_today.status AS registration_status,
    registered_players_today.is_done_today,
    registered_players_today.available_since,
    player_team_locks.is_active AS lock_is_active
  FROM rotation_match_players
  JOIN players ON players.id = rotation_match_players.player_id
  JOIN registered_players_today
    ON registered_players_today.id = rotation_match_players.registered_player_id
  LEFT JOIN player_team_locks
    ON player_team_locks.id = rotation_match_players.lock_id
  WHERE rotation_match_players.rotation_match_id = ?
  ORDER BY rotation_match_players.team ASC, rotation_match_players.slot ASC
`);

// Maps a teammate lock into the renderer response shape.
function mapLock(row) {
  return {
    id: Number(row.id),
    player1Id: Number(row.player_1_id),
    player2Id: Number(row.player_2_id),
    player1Name: row.player_1_name,
    player2Name: row.player_2_name,
    lockType: row.lock_type,
    lockDate: row.lock_date,
    createdAt: row.created_at,
  };
}

// Returns all active teammate locks for today.
function loadActiveLocks() {
  return getActiveLocksStatement.all().map(mapLock);
}

// Maps a daily registration into the rotation player shape.
function mapDailyPlayer(row) {
  return {
    id: Number(row.id),
    registrationId: Number(row.registration_id),
    name: row.name,
    level: row.level,
    gender: normalizeRotationGender(row.gender),
    rankPreference: normalizeRankPreference(row.rank_match_preference),
    preferMens: Boolean(row.prefer_mens),
    preferWomens: Boolean(row.prefer_womens),
    preferMixed: Boolean(row.prefer_mixed),
    preferNoGender: Boolean(row.prefer_no_gender),
    matchCount: Number(row.match_count || 0),
    wins: Number(row.wins || 0),
    losses: Number(row.losses || 0),
    status: row.status,
    isDoneToday: Boolean(row.is_done_today),
    availableSince: row.available_since || row.created_at,
    createdAt: row.created_at,
    teammateCounts: {},
    opponentCounts: {},
  };
}

// Adds today's teammate and opponent repeat counts to each player.
function loadHistoryCounts(players) {
  const playersById = new Map(players.map((player) => [player.id, player]));
  const rows = db.prepare(`
    SELECT
      first.player_id AS first_player_id,
      first.team AS first_team,
      second.player_id AS second_player_id,
      second.team AS second_team
    FROM rotation_match_players AS first
    JOIN rotation_match_players AS second
      ON second.rotation_match_id = first.rotation_match_id
      AND second.player_id > first.player_id
    JOIN rotation_matches
      ON rotation_matches.id = first.rotation_match_id
    WHERE rotation_matches.status = 'finished'
      AND DATE(COALESCE(rotation_matches.end_time, rotation_matches.created_at)) = CURRENT_DATE
  `).all();

  for (const row of rows) {
    const first = playersById.get(Number(row.first_player_id));
    const second = playersById.get(Number(row.second_player_id));
    if (!first || !second) continue;
    const property = Number(row.first_team) === Number(row.second_team)
      ? "teammateCounts"
      : "opponentCounts";
    first[property][second.id] = Number(first[property][second.id] || 0) + 1;
    second[property][first.id] = Number(second[property][first.id] || 0) + 1;
  }
}

// Finds the active match source currently using a player.
function getPlayingSource(playerId) {
  const rotation = db.prepare(`
    SELECT rotation_matches.id
    FROM rotation_match_players
    JOIN rotation_matches
      ON rotation_matches.id = rotation_match_players.rotation_match_id
    WHERE rotation_match_players.player_id = ?
      AND rotation_matches.status = 'playing'
    LIMIT 1
  `).get(playerId);
  if (rotation) return "rotation";

  const tournament = db.prepare(`
    SELECT tournament_matches.id
    FROM tournament_matches
    JOIN tournament_teams AS team_a
      ON team_a.id = tournament_matches.team_a_id
    JOIN tournament_teams AS team_b
      ON team_b.id = tournament_matches.team_b_id
    WHERE tournament_matches.status = 'playing'
      AND ? IN (
        team_a.player_1_id,
        team_a.player_2_id,
        team_b.player_1_id,
        team_b.player_2_id
      )
    LIMIT 1
  `).get(playerId);
  if (tournament) return "tournament";

  const legacy = db.prepare(`
    SELECT matches.id
    FROM matches
    LEFT JOIN match_players
      ON match_players.match_id = matches.id
      AND match_players.source = 'normal'
    WHERE matches.status = 'playing'
      AND (
        matches.player_one = ?
        OR matches.player_two = ?
        OR match_players.player_id = ?
      )
    LIMIT 1
  `).get(playerId, playerId, playerId);
  return legacy ? "normal" : null;
}

// Finds another active Rotation Queue assignment for a player.
function getAssignedRotationMatch(playerId, excludedMatchId = null) {
  return db.prepare(`
    SELECT rotation_matches.id, rotation_matches.status
    FROM rotation_match_players
    JOIN rotation_matches
      ON rotation_matches.id = rotation_match_players.rotation_match_id
    WHERE rotation_match_players.player_id = ?
      AND rotation_matches.status IN ('waiting', 'incomplete', 'playing')
      AND (? IS NULL OR rotation_matches.id <> ?)
    LIMIT 1
  `).get(playerId, excludedMatchId, excludedMatchId);
}

// Explains whether a player can enter a new Rotation Queue match.
function getEligibility(player) {
  if (player.isDoneToday || player.status === "done") {
    return { eligible: false, reason: "Player is marked done for today." };
  }
  const playingSource = getPlayingSource(player.id);
  if (playingSource) {
    return {
      eligible: false,
      reason: `Player is currently playing a ${playingSource} match.`,
    };
  }
  const assignedMatch = getAssignedRotationMatch(player.id);
  if (assignedMatch) {
    return {
      eligible: false,
      reason: "Player is already assigned to another waiting or playing match.",
    };
  }
  if (!["available", "waiting"].includes(player.status)) {
    return {
      eligible: false,
      reason: `Player is not available (${player.status}).`,
    };
  }
  return { eligible: true, reason: "" };
}

// Builds today's players with history, lock, and eligibility details.
function loadDailyPlayers() {
  const players = getDailyPlayersStatement.all().map(mapDailyPlayer);
  loadHistoryCounts(players);
  const locks = loadActiveLocks();
  const lockByPlayerId = new Map();
  for (const lock of locks) {
    lockByPlayerId.set(lock.player1Id, lock);
    lockByPlayerId.set(lock.player2Id, lock);
  }

  return players.map((player) => {
    const eligibility = getEligibility(player);
    const lock = lockByPlayerId.get(player.id) || null;
    return {
      ...player,
      ...eligibility,
      lock,
      lockedTeammateId: lock
        ? (lock.player1Id === player.id ? lock.player2Id : lock.player1Id)
        : null,
      lockedTeammateName: lock
        ? (lock.player1Id === player.id ? lock.player2Name : lock.player1Name)
        : null,
    };
  });
}

// Maps a stored match participant into the shared player shape.
function mapParticipant(row) {
  return {
    participantId: Number(row.id),
    registrationId: Number(row.registered_player_id),
    id: Number(row.player_id),
    name: row.name,
    level: row.level,
    gender: normalizeRotationGender(row.gender),
    rankPreference: normalizeRankPreference(row.rank_match_preference),
    preferMens: Boolean(row.prefer_mens),
    preferWomens: Boolean(row.prefer_womens),
    preferMixed: Boolean(row.prefer_mixed),
    preferNoGender: Boolean(row.prefer_no_gender),
    matchCount: Number(row.match_count || 0),
    wins: Number(row.wins || 0),
    losses: Number(row.losses || 0),
    status: row.registration_status,
    isDoneToday: Boolean(row.is_done_today),
    availableSince: row.available_since,
    team: Number(row.team),
    slot: Number(row.slot),
    lockId: row.lock_id === null ? null : Number(row.lock_id),
    isLocked: Boolean(row.lock_id && row.lock_is_active),
  };
}

// Maps one saved Rotation Queue match and its participants.
function mapRotationMatch(row) {
  const participants = getRotationParticipantsStatement.all(row.id).map(mapParticipant);
  return {
    source: "rotation",
    id: Number(row.id),
    queuePosition: row.queue_position === null ? null : Number(row.queue_position),
    matchType: row.match_type,
    category: row.category,
    status: row.status,
    courtId: row.court_id === null ? null : Number(row.court_id),
    court: row.court_id === null
      ? null
      : {
        id: Number(row.court_id),
        name: row.court_name || "Unknown Court",
        status: row.court_status || "unknown",
      },
    winnerTeam: row.winner_team === null ? null : Number(row.winner_team),
    teamAStrength: Number(row.team_a_strength || 0),
    teamBStrength: Number(row.team_b_strength || 0),
    balanceDifference: Number(row.balance_difference || 0),
    warnings: parseWarnings(row.warnings),
    validationMessage: row.validation_message || "",
    teamA: participants.filter((player) => player.team === 1),
    teamB: participants.filter((player) => player.team === 2),
    players: participants,
    startTime: row.start_time,
    endTime: row.end_time,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Returns all saved Rotation Queue matches.
function loadRotationMatches() {
  return getRotationMatchRowsStatement.all().map(mapRotationMatch);
}

// Returns only valid waiting matches for the public Next Up display.
function loadRotationNextUpMatches() {
  return getRotationNextUpRowsStatement.all().map(mapRotationMatch);
}

// Counts Rotation Queue matches by lifecycle status.
function createRotationSummary(matches) {
  return {
    waiting: matches.filter((match) => match.status === "waiting").length,
    incomplete: matches.filter((match) => match.status === "incomplete").length,
    playing: matches.filter((match) => match.status === "playing").length,
    finished: matches.filter((match) => match.status === "finished").length,
  };
}

// Returns Rotation Queue matches with summary counts.
export function getRotationMatches() {
  try {
    const matches = loadRotationMatches();
    return {
      success: true,
      data: { matches, summary: createRotationSummary(matches) },
    };
  } catch (error) {
    return failure(error, "Failed to load rotation matches.");
  }
}

// Returns valid waiting matches for the public display.
export function getRotationNextUpMatches() {
  try {
    return {
      success: true,
      data: { matches: loadRotationNextUpMatches() },
    };
  } catch (error) {
    return failure(error, "Failed to load the Rotation Queue's next matches.");
  }
}

// Returns players, locks, matches, and summary in one state snapshot.
export function getRotationState() {
  try {
    const players = loadDailyPlayers();
    const locks = loadActiveLocks();
    const matches = loadRotationMatches();
    return {
      success: true,
      data: {
        players,
        locks,
        matches,
        summary: createRotationSummary(matches),
      },
    };
  } catch (error) {
    return failure(error, "Failed to load the rotation queue.");
  }
}

// Validates that a proposed teammate lock fits the match category.
function assertCategoryPair(players, matchType, category) {
  if (!["singles", "doubles"].includes(matchType)) {
    throw new Error("Invalid rotation match type.");
  }
  if (!["no_gender", "mens", "womens", "mixed"].includes(category)) {
    throw new Error("Invalid rotation category.");
  }
  if (category === "mixed" && matchType !== "doubles") {
    throw new Error("Mixed category is only available for doubles.");
  }
  if (matchType === "singles") return;
  if (category === "mens" && players.some((player) => player.gender !== "male")) {
    throw new Error("Men's locks may only include male players.");
  }
  if (category === "womens" && players.some((player) => player.gender !== "female")) {
    throw new Error("Women's locks may only include female players.");
  }
  if (
    category === "mixed"
    && !(
      players.some((player) => player.gender === "male")
      && players.some((player) => player.gender === "female")
    )
  ) {
    throw new Error("A mixed doubles lock requires one male and one female player.");
  }
  for (const player of players) {
    if (!playerAllowsCategory(player, category)) {
      throw new Error(`${player.name} does not prefer this match category.`);
    }
  }
}

// Validates and creates a teammate lock atomically.
const createTeamLockTransaction = db.transaction((firstPlayerId, secondPlayerId, matchType, category) => {
  if (firstPlayerId === secondPlayerId) {
    throw new Error("A player cannot be locked with themselves.");
  }
  const players = loadDailyPlayers().filter((player) => (
    player.id === firstPlayerId || player.id === secondPlayerId
  ));
  if (players.length !== 2) {
    throw new Error("Both teammates must be registered today.");
  }
  if (players.some((player) => !player.eligible)) {
    throw new Error("Both teammates must be available before creating a lock.");
  }
  assertCategoryPair(players, matchType, category);

  const existing = loadActiveLocks().find((lock) => (
    [lock.player1Id, lock.player2Id].includes(firstPlayerId)
    || [lock.player1Id, lock.player2Id].includes(secondPlayerId)
  ));
  if (existing) {
    throw new Error("A player already belongs to an active teammate lock.");
  }

  const player1Id = Math.min(firstPlayerId, secondPlayerId);
  const player2Id = Math.max(firstPlayerId, secondPlayerId);
  const result = db.prepare(`
    INSERT INTO player_team_locks (
      player_1_id,
      player_2_id,
      lock_type,
      lock_date,
      is_active
    )
    VALUES (?, ?, 'today', CURRENT_DATE, 1)
  `).run(player1Id, player2Id);
  return Number(result.lastInsertRowid);
});

// Creates an active teammate lock for two available players.
export function createTeamLock(firstPlayerId, secondPlayerId, matchType, category) {
  try {
    const firstId = parsePositiveId(firstPlayerId, "First teammate was not found.");
    const secondId = parsePositiveId(secondPlayerId, "Second teammate was not found.");
    createTeamLockTransaction(firstId, secondId, matchType, category);
    return { success: true, data: getRotationState().data };
  } catch (error) {
    return failure(error, "Failed to create teammate lock.");
  }
}

// Deactivates a lock and revalidates affected waiting matches atomically.
const removeTeamLockTransaction = db.transaction((lockId) => {
  const lock = db.prepare(`
    SELECT *
    FROM player_team_locks
    WHERE id = ? AND is_active = 1
  `).get(lockId);
  if (!lock) throw new Error("Active teammate lock not found.");

  const playingSource = getPlayingSource(lock.player_1_id)
    || getPlayingSource(lock.player_2_id);
  if (playingSource) {
    throw new Error("A teammate lock cannot be removed while either player is playing.");
  }

  const affectedMatches = db.prepare(`
    SELECT DISTINCT rotation_match_id
    FROM rotation_match_players
    WHERE lock_id = ?
      AND rotation_match_id IN (
        SELECT id FROM rotation_matches WHERE status IN ('waiting', 'incomplete')
      )
  `).all(lockId);

  db.prepare(`
    UPDATE player_team_locks
    SET is_active = 0
    WHERE id = ?
  `).run(lockId);
  db.prepare(`
    UPDATE rotation_match_players
    SET lock_id = NULL
    WHERE lock_id = ?
      AND rotation_match_id IN (
        SELECT id FROM rotation_matches WHERE status IN ('waiting', 'incomplete')
      )
  `).run(lockId);
  for (const affectedMatch of affectedMatches) {
    revalidateStoredWaitingMatch(Number(affectedMatch.rotation_match_id));
  }
});

// Removes an active teammate lock when neither player is playing.
export function removeTeamLock(lockId) {
  try {
    removeTeamLockTransaction(parsePositiveId(lockId, "Teammate lock not found."));
    return { success: true, data: getRotationState().data };
  } catch (error) {
    return failure(error, "Failed to remove teammate lock.");
  }
}

// Updates rank preference only while the player is unassigned.
export function updateRotationRankPreference(playerId, preference) {
  try {
    const id = parsePositiveId(playerId, "Player not found.");
    const normalizedPreference = normalizeRankPreference(preference);
    if (normalizedPreference !== preference) {
      return { success: false, message: "Invalid rank-match preference." };
    }
    if (getPlayingSource(id)) {
      return { success: false, message: "Rank preference cannot change while the player is playing." };
    }
    if (getAssignedRotationMatch(id)) {
      return {
        success: false,
        message: "Rank preference cannot change while the player is assigned to a waiting match.",
      };
    }
    const result = db.prepare(`
      UPDATE players
      SET rank_match_preference = ?
      WHERE id = ?
    `).run(normalizedPreference, id);
    if (result.changes !== 1) return { success: false, message: "Player not found." };
    return { success: true, data: getRotationState().data };
  } catch (error) {
    return failure(error, "Failed to update rank preference.");
  }
}

// Returns the next position after all current waiting matches.
function getNextQueuePosition() {
  return Number(db.prepare(`
    SELECT COALESCE(MAX(queue_position), 0) + 1 AS next_position
    FROM rotation_matches
    WHERE status IN ('waiting', 'incomplete')
  `).get().next_position);
}

// Finds the active lock associated with a generated participant.
function findPlayerLock(locks, playerId) {
  return locks.find((lock) => (
    lock.player1Id === Number(playerId) || lock.player2Id === Number(playerId)
  ));
}

// Generates and stores all compatible waiting matches atomically.
const generateRotationTransaction = db.transaction((selectedPlayerIds, matchType, category) => {
  if (!Array.isArray(selectedPlayerIds)) throw new Error("Please select rotation players.");
  const dailyPlayers = loadDailyPlayers();
  const playersById = new Map(dailyPlayers.map((player) => [player.id, player]));
  const selectedPlayers = selectedPlayerIds.map((value) => {
    const id = parsePositiveId(value, "One or more selected players are invalid.");
    const player = playersById.get(id);
    if (!player) throw new Error("One or more selected players are not registered today.");
    if (!player.eligible) throw new Error(`${player.name}: ${player.reason}`);
    return player;
  });
  const selectedIdSet = new Set(selectedPlayers.map((player) => player.id));
  const locks = loadActiveLocks().filter((lock) => (
    selectedIdSet.has(lock.player1Id) || selectedIdSet.has(lock.player2Id)
  ));
  // Generate the best compatible arrangements before inserting records.
  const generated = generateRotationMatches({
    players: selectedPlayers,
    matchType,
    category,
    locks,
  });

  let queuePosition = getNextQueuePosition();
  const generatedCount = generated.matches.length;
  const insertMatch = db.prepare(`
    INSERT INTO rotation_matches (
      queue_position,
      match_type,
      category,
      status,
      team_a_strength,
      team_b_strength,
      balance_difference,
      warnings
    )
    VALUES (?, ?, ?, 'waiting', ?, ?, ?, ?)
  `);
  const insertParticipant = db.prepare(`
    INSERT INTO rotation_match_players (
      rotation_match_id,
      registered_player_id,
      player_id,
      team,
      slot,
      lock_id
    )
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  // Persist each match, participant slot, and assigned player status.
  for (const generatedMatch of generated.matches) {
    const matchResult = insertMatch.run(
      queuePosition,
      matchType,
      category,
      generatedMatch.teamAStrength,
      generatedMatch.teamBStrength,
      generatedMatch.balanceDifference,
      JSON.stringify(generatedMatch.warnings || []),
    );
    const matchId = Number(matchResult.lastInsertRowid);
    for (const [teamIndex, team] of [generatedMatch.teamA, generatedMatch.teamB].entries()) {
      for (const [slotIndex, player] of team.entries()) {
        const lock = findPlayerLock(locks, player.id);
        insertParticipant.run(
          matchId,
          player.registrationId,
          player.id,
          teamIndex + 1,
          slotIndex + 1,
          lock?.id || null,
        );
        db.prepare(`
          UPDATE registered_players_today
          SET status = 'assigned'
          WHERE id = ? AND status IN ('available', 'waiting')
        `).run(player.registrationId);
      }
    }
    queuePosition += 1;
  }

  const currentMatches = loadRotationMatches();
  return {
    matches: currentMatches,
    generatedCount,
    unmatchedPlayers: generated.unmatchedPlayers,
    warnings: generated.warnings,
    summary: createRotationSummary(currentMatches),
  };
});

// Validates selected IDs and saves generated Rotation Queue matches.
export function generateAndSaveRotationMatches(selectedPlayerIds, matchType, category) {
  try {
    return {
      success: true,
      data: generateRotationTransaction(selectedPlayerIds, matchType, category),
    };
  } catch (error) {
    return failure(error, "Failed to generate rotation matches.");
  }
}

// Loads the raw database row for one Rotation Queue match.
function loadMatchRow(matchId) {
  return db.prepare(`SELECT * FROM rotation_matches WHERE id = ?`).get(matchId);
}

// Loads mapped participants for one Rotation Queue match.
function loadMatchParticipants(matchId) {
  return getRotationParticipantsStatement.all(matchId).map(mapParticipant);
}

// Totals numeric skill values for one team.
function calculateStrength(players) {
  return players.reduce(
    (total, player) => total + getRotationLevelValue(player.level),
    0,
  );
}

// Recomputes status, balance, warnings, and validation after a match change.
function revalidateStoredWaitingMatch(matchId) {
  const match = loadMatchRow(matchId);
  if (!match || !["waiting", "incomplete"].includes(match.status)) return;
  const participants = loadMatchParticipants(matchId);
  const teamA = participants.filter((player) => player.team === 1);
  const teamB = participants.filter((player) => player.team === 2);
  const expectedPlayerCount = match.match_type === "doubles" ? 4 : 2;
  let status = "incomplete";
  let validationMessage = `${match.match_type === "doubles" ? "Doubles" : "Singles"} requires ${expectedPlayerCount} players.`;
  let warnings = [];

  if (participants.length === expectedPlayerCount) {
    const validation = validateRotationArrangement({
      matchType: match.match_type,
      category: match.category,
      teamA,
      teamB,
      locks: getArrangementLocks(participants),
    });
    if (validation.valid) {
      status = "waiting";
      validationMessage = null;
      warnings = validation.warnings || [];
    } else {
      validationMessage = validation.message;
    }
  }

  const teamAStrength = calculateStrength(teamA);
  const teamBStrength = calculateStrength(teamB);
  db.prepare(`
    UPDATE rotation_matches
    SET
      status = ?,
      team_a_strength = ?,
      team_b_strength = ?,
      balance_difference = ?,
      warnings = ?,
      validation_message = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    status,
    teamAStrength,
    teamBStrength,
    Math.abs(teamAStrength - teamBStrength),
    JSON.stringify(warnings),
    validationMessage,
    matchId,
  );
}

// Returns active locks involving players in one arrangement.
function getArrangementLocks(players) {
  const playerIds = new Set(players.map((player) => player.id));
  return loadActiveLocks().filter((lock) => (
    playerIds.has(lock.player1Id) || playerIds.has(lock.player2Id)
  ));
}

// Validates players selected while editing a waiting match.
function validateEditedPlayers(playerIds, matchId) {
  const uniqueIds = new Set(playerIds);
  if (uniqueIds.size !== playerIds.length) {
    throw new Error("A player cannot occupy multiple match slots.");
  }
  const dailyPlayers = loadDailyPlayers();
  const playersById = new Map(dailyPlayers.map((player) => [player.id, player]));
  const currentPlayerIds = new Set(
    loadMatchParticipants(matchId).map((player) => player.id),
  );
  return playerIds.map((playerId) => {
    const player = playersById.get(playerId);
    if (!player) throw new Error("Every match player must be registered today.");
    if (player.isDoneToday) throw new Error(`${player.name} is marked done for today.`);
    if (getPlayingSource(playerId)) throw new Error(`${player.name} is currently playing.`);
    const otherMatch = getAssignedRotationMatch(playerId, matchId);
    if (otherMatch) throw new Error(`${player.name} is assigned to another match.`);
    const allowedStatuses = currentPlayerIds.has(playerId)
      ? ["assigned", "available", "waiting"]
      : ["available", "waiting"];
    if (!allowedStatuses.includes(player.status)) {
      throw new Error(`${player.name} is not currently available.`);
    }
    return player;
  });
}

// Replaces waiting-match teams and updates affected player assignments.
function writeWaitingArrangement(match, teamA, teamB) {
  const players = [...teamA, ...teamB];
  const locks = getArrangementLocks(players);
  const expectedPlayerCount = match.match_type === "doubles" ? 4 : 2;
  let status = "incomplete";
  let validationMessage = `${match.match_type === "doubles" ? "Doubles" : "Singles"} requires ${expectedPlayerCount} players.`;
  let warnings = [];

  if (players.length === expectedPlayerCount) {
    const validation = validateRotationArrangement({
      matchType: match.match_type,
      category: match.category,
      teamA,
      teamB,
      locks,
    });
    if (validation.valid) {
      status = "waiting";
      validationMessage = null;
      warnings = validation.warnings || [];
    } else {
      validationMessage = validation.message;
    }
  }

  // Replace participant slots before updating registration statuses.
  const oldParticipants = loadMatchParticipants(match.id);
  db.prepare(`DELETE FROM rotation_match_players WHERE rotation_match_id = ?`).run(match.id);
  const insertParticipant = db.prepare(`
    INSERT INTO rotation_match_players (
      rotation_match_id,
      registered_player_id,
      player_id,
      team,
      slot,
      lock_id
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const [teamIndex, team] of [teamA, teamB].entries()) {
    for (const [slotIndex, player] of team.entries()) {
      insertParticipant.run(
        match.id,
        player.registrationId,
        player.id,
        teamIndex + 1,
        slotIndex + 1,
        findPlayerLock(locks, player.id)?.id || null,
      );
    }
  }

  const newRegistrationIds = new Set(players.map((player) => player.registrationId));
  for (const participant of oldParticipants) {
    if (!newRegistrationIds.has(participant.registrationId)) {
      db.prepare(`
        UPDATE registered_players_today
        SET status = 'available', available_since = CURRENT_TIMESTAMP
        WHERE id = ? AND is_done_today = 0
      `).run(participant.registrationId);
    }
  }
  for (const player of players) {
    db.prepare(`
      UPDATE registered_players_today
      SET status = 'assigned'
      WHERE id = ? AND is_done_today = 0
    `).run(player.registrationId);
  }

  const teamAStrength = calculateStrength(teamA);
  const teamBStrength = calculateStrength(teamB);
  db.prepare(`
    UPDATE rotation_matches
    SET
      status = ?,
      team_a_strength = ?,
      team_b_strength = ?,
      balance_difference = ?,
      warnings = ?,
      validation_message = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    status,
    teamAStrength,
    teamBStrength,
    Math.abs(teamAStrength - teamBStrength),
    JSON.stringify(warnings),
    validationMessage,
    match.id,
  );
}

// Applies an operator-edited waiting arrangement atomically.
const updateWaitingMatchTransaction = db.transaction((matchId, teamAIds, teamBIds) => {
  const match = loadMatchRow(matchId);
  if (!match) throw new Error("Rotation match not found.");
  if (!["waiting", "incomplete"].includes(match.status)) {
    throw new Error("Only waiting or incomplete matches can be edited.");
  }
  const normalizedTeamAIds = (teamAIds || []).map((id) => parsePositiveId(id, "Invalid Team A player."));
  const normalizedTeamBIds = (teamBIds || []).map((id) => parsePositiveId(id, "Invalid Team B player."));
  const expectedTeamSize = match.match_type === "doubles" ? 2 : 1;
  if (
    normalizedTeamAIds.length > expectedTeamSize
    || normalizedTeamBIds.length > expectedTeamSize
  ) {
    throw new Error(`Each team may contain at most ${expectedTeamSize} player${expectedTeamSize === 1 ? "" : "s"}.`);
  }
  const players = validateEditedPlayers(
    [...normalizedTeamAIds, ...normalizedTeamBIds],
    matchId,
  );
  const playersById = new Map(players.map((player) => [player.id, player]));
  writeWaitingArrangement(
    match,
    normalizedTeamAIds.map((id) => playersById.get(id)),
    normalizedTeamBIds.map((id) => playersById.get(id)),
  );
});

// Updates the teams and players in a waiting or incomplete match.
export function updateWaitingMatch(matchId, teamAIds, teamBIds) {
  try {
    updateWaitingMatchTransaction(
      parsePositiveId(matchId, "Rotation match not found."),
      teamAIds,
      teamBIds,
    );
    return { success: true, data: getRotationState().data };
  } catch (error) {
    return failure(error, "Failed to update waiting match.");
  }
}

// Rebuilds the most balanced valid teams for a waiting match.
const rebalanceWaitingMatchTransaction = db.transaction((matchId) => {
  const match = loadMatchRow(matchId);
  if (!match) throw new Error("Rotation match not found.");
  if (!["waiting", "incomplete"].includes(match.status)) {
    throw new Error("Only waiting matches can be rebalanced.");
  }
  const participants = loadMatchParticipants(matchId);
  const expected = match.match_type === "doubles" ? 4 : 2;
  if (participants.length !== expected) {
    throw new Error("Fill every match slot before rebalancing.");
  }

  if (match.match_type === "singles") {
    writeWaitingArrangement(match, [participants[0]], [participants[1]]);
    return;
  }
  const generated = generateDoublesMatches(
    participants,
    getArrangementLocks(participants),
    match.category,
    () => 0.5,
  );
  if (generated.matches.length !== 1) {
    throw new Error("No valid balanced arrangement exists for these players.");
  }
  writeWaitingArrangement(
    match,
    generated.matches[0].teamA,
    generated.matches[0].teamB,
  );
});

// Rebalances a complete waiting match without changing its players.
export function rebalanceWaitingMatch(matchId) {
  try {
    rebalanceWaitingMatchTransaction(
      parsePositiveId(matchId, "Rotation match not found."),
    );
    return { success: true, data: getRotationState().data };
  } catch (error) {
    return failure(error, "Failed to rebalance waiting match.");
  }
}

// Compacts waiting queue positions into a stable 1-based sequence.
function normalizeQueuePositions() {
  const rows = db.prepare(`
    SELECT id
    FROM rotation_matches
    WHERE status IN ('waiting', 'incomplete')
    ORDER BY queue_position ASC, created_at ASC, id ASC
  `).all();
  // Temporary negative positions avoid collisions with the unique queue index.
  rows.forEach((row, index) => {
    db.prepare(`UPDATE rotation_matches SET queue_position = ? WHERE id = ?`)
      .run(-(index + 1), row.id);
  });
  rows.forEach((row, index) => {
    db.prepare(`UPDATE rotation_matches SET queue_position = ? WHERE id = ?`)
      .run(index + 1, row.id);
  });
}

// Swaps one waiting match with its nearest queue neighbor atomically.
const reorderWaitingMatchTransaction = db.transaction((matchId, direction) => {
  const match = loadMatchRow(matchId);
  if (!match || !["waiting", "incomplete"].includes(match.status)) {
    throw new Error("Waiting match not found.");
  }
  if (!["up", "down"].includes(direction)) throw new Error("Invalid queue direction.");
  const operator = direction === "up" ? "<" : ">";
  const order = direction === "up" ? "DESC" : "ASC";
  const target = db.prepare(`
    SELECT id, queue_position
    FROM rotation_matches
    WHERE status IN ('waiting', 'incomplete')
      AND queue_position ${operator} ?
    ORDER BY queue_position ${order}
    LIMIT 1
  `).get(match.queue_position);
  if (!target) return;
  // Use a temporary position so the two queue rows can swap safely.
  db.prepare(`UPDATE rotation_matches SET queue_position = -999999 WHERE id = ?`).run(match.id);
  db.prepare(`UPDATE rotation_matches SET queue_position = ? WHERE id = ?`)
    .run(match.queue_position, target.id);
  db.prepare(`UPDATE rotation_matches SET queue_position = ? WHERE id = ?`)
    .run(target.queue_position, match.id);
});

// Moves a waiting match one position up or down.
export function reorderWaitingMatch(matchId, direction) {
  try {
    reorderWaitingMatchTransaction(
      parsePositiveId(matchId, "Waiting match not found."),
      direction,
    );
    return { success: true, data: getRotationState().data };
  } catch (error) {
    return failure(error, "Failed to reorder waiting match.");
  }
}

// Cancels a waiting match and returns its players to available status.
const cancelWaitingMatchTransaction = db.transaction((matchId) => {
  const match = loadMatchRow(matchId);
  if (!match || !["waiting", "incomplete"].includes(match.status)) {
    throw new Error("Only waiting or incomplete matches can be cancelled.");
  }
  const participants = loadMatchParticipants(matchId);
  db.prepare(`
    UPDATE rotation_matches
    SET status = 'cancelled', queue_position = NULL, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(matchId);
  for (const participant of participants) {
    db.prepare(`
      UPDATE registered_players_today
      SET status = 'available', available_since = CURRENT_TIMESTAMP
      WHERE id = ? AND is_done_today = 0
    `).run(participant.registrationId);
  }
  normalizeQueuePositions();
});

// Cancels a waiting or incomplete Rotation Queue match.
export function cancelWaitingMatch(matchId) {
  try {
    cancelWaitingMatchTransaction(
      parsePositiveId(matchId, "Rotation match not found."),
    );
    return { success: true, data: getRotationState().data };
  } catch (error) {
    return failure(error, "Failed to cancel waiting match.");
  }
}

// Revalidates stored teams and participant availability before match start.
function validateStoredMatch(match) {
  const participants = loadMatchParticipants(match.id);
  const teamA = participants.filter((player) => player.team === 1);
  const teamB = participants.filter((player) => player.team === 2);
  const validation = validateRotationArrangement({
    matchType: match.match_type,
    category: match.category,
    teamA,
    teamB,
    locks: getArrangementLocks(participants),
  });
  if (!validation.valid) throw new Error(validation.message);
  for (const player of participants) {
    const playingSource = getPlayingSource(player.id);
    if (playingSource) {
      throw new Error(`${player.name} is currently playing a ${playingSource} match.`);
    }
    const registration = db.prepare(`
      SELECT status, is_done_today, registered_date
      FROM registered_players_today
      WHERE id = ?
    `).get(player.registrationId);
    if (
      !registration
      || registration.registered_date !== db.prepare(`SELECT CURRENT_DATE AS value`).get().value
      || registration.is_done_today
      || registration.status !== "assigned"
    ) {
      throw new Error(`${player.name} is no longer eligible to start this match.`);
    }
  }
  return participants;
}

// Reserves a court and starts a valid waiting match atomically.
const startRotationMatchTransaction = db.transaction((matchId, courtId) => {
  const match = loadMatchRow(matchId);
  if (!match) throw new Error("Rotation match not found.");
  if (match.status === "playing") throw new Error("This rotation match has already started.");
  if (["finished", "cancelled"].includes(match.status)) {
    throw new Error("This rotation match can no longer be started.");
  }
  if (match.status !== "waiting") {
    throw new Error("Complete and validate this match before starting it.");
  }
  const participants = validateStoredMatch(match);
  const court = db.prepare(`SELECT id, status FROM courts WHERE id = ?`).get(courtId);
  if (!court) throw new Error("Selected court was not found.");
  // Check every match source before reserving the selected court.
  const occupied = db.prepare(`
    SELECT 1 AS occupied
    WHERE EXISTS (SELECT 1 FROM matches WHERE court_id = ? AND status = 'playing')
       OR EXISTS (SELECT 1 FROM rotation_matches WHERE court_id = ? AND status = 'playing')
       OR EXISTS (SELECT 1 FROM tournament_matches WHERE court_id = ? AND status = 'playing')
  `).get(courtId, courtId, courtId);
  if (court.status !== "available" || occupied) {
    throw new Error("Selected court is no longer available.");
  }
  const courtUpdate = db.prepare(`
    UPDATE courts SET status = 'playing' WHERE id = ? AND status = 'available'
  `).run(courtId);
  if (courtUpdate.changes !== 1) throw new Error("Selected court is no longer available.");
  const matchUpdate = db.prepare(`
    UPDATE rotation_matches
    SET
      court_id = ?,
      status = 'playing',
      start_time = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND status = 'waiting'
  `).run(courtId, matchId);
  if (matchUpdate.changes !== 1) throw new Error("This rotation match could not be started.");
  for (const participant of participants) {
    db.prepare(`
      UPDATE registered_players_today
      SET status = 'playing'
      WHERE id = ? AND status = 'assigned'
    `).run(participant.registrationId);
  }
  normalizeQueuePositions();
});

// Validates IDs and starts a Rotation Queue match on a court.
export function startRotationMatch(matchId, courtId) {
  try {
    startRotationMatchTransaction(
      parsePositiveId(matchId, "Rotation match not found."),
      parsePositiveId(courtId, "Selected court was not found."),
    );
    return { success: true, data: getRotationState().data };
  } catch (error) {
    return failure(error, "Failed to start rotation match.");
  }
}

// Saves the result, updates statistics, and releases the court atomically.
const finishRotationMatchTransaction = db.transaction((matchId, winnerTeam, donePlayerIds) => {
  const match = loadMatchRow(matchId);
  if (!match) throw new Error("Rotation match not found.");
  if (match.status === "finished") throw new Error("This rotation match has already been completed.");
  if (match.status !== "playing") throw new Error("Only a playing rotation match can be completed.");
  if (![1, 2].includes(winnerTeam)) throw new Error("The selected winner is not part of this match.");
  if (match.court_id === null) throw new Error("This match does not have an assigned court.");
  const participants = loadMatchParticipants(matchId);
  const participantIds = new Set(participants.map((player) => player.id));
  const doneIds = new Set((donePlayerIds || []).map((value) => (
    parsePositiveId(value, "Invalid done-player selection.")
  )));
  if ([...doneIds].some((playerId) => !participantIds.has(playerId))) {
    throw new Error("Only players in this match can be marked done.");
  }

  const update = db.prepare(`
    UPDATE rotation_matches
    SET
      winner_team = ?,
      status = 'finished',
      end_time = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND status = 'playing'
  `).run(winnerTeam, matchId);
  if (update.changes !== 1) throw new Error("This rotation match could not be completed.");

  // Update today's and lifetime statistics for every participant.
  for (const player of participants) {
    const won = player.team === winnerTeam;
    const isDone = doneIds.has(player.id);
    db.prepare(`
      UPDATE registered_players_today
      SET
        match_count = match_count + 1,
        wins = wins + ?,
        losses = losses + ?,
        status = ?,
        is_done_today = ?,
        available_since = CASE WHEN ? = 1 THEN available_since ELSE CURRENT_TIMESTAMP END
      WHERE id = ?
    `).run(
      won ? 1 : 0,
      won ? 0 : 1,
      isDone ? "done" : "available",
      isDone ? 1 : 0,
      isDone ? 1 : 0,
      player.registrationId,
    );
    db.prepare(`
      UPDATE players
      SET
        total_matches_played = total_matches_played + 1,
        total_wins = total_wins + ?,
        total_losses = total_losses + ?
      WHERE id = ?
    `).run(won ? 1 : 0, won ? 0 : 1, player.id);
  }

  // Release the court only when no match source still uses it.
  db.prepare(`
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
  `).run(match.court_id);
});

// Completes a playing Rotation Queue match and returns updated queue state.
export function finishRotationMatch(matchId, winnerTeam, donePlayerIds = []) {
  try {
    finishRotationMatchTransaction(
      parsePositiveId(matchId, "Rotation match not found."),
      Number(winnerTeam),
      donePlayerIds,
    );
    return { success: true, data: getRotationState().data };
  } catch (error) {
    return failure(error, "Failed to finish rotation match.");
  }
}
