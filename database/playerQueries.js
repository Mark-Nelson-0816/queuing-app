import db from "./database.js";
import {
  getRotationLevelValue,
  normalizeRankPreference,
  normalizeRotationGender,
  normalizeRotationLevel,
} from "./rotationLogic.js";

const VALID_GENDERS = new Set(["male", "female"]);
const VALID_RANK_PREFERENCES = new Set(["same_rank", "adjacent_rank"]);

// Converts database errors into the consistent API failure shape.
function failure(error, fallbackMessage) {
  return {
    success: false,
    message: error instanceof Error && error.message
      ? error.message
      : fallbackMessage,
  };
}

// Validates and converts a player ID before using it in a query.
function parsePlayerId(value) {
  const id = Number(value);
  if (!Number.isInteger(id) || id <= 0) throw new Error("Player not found.");
  return id;
}

// Normalizes and validates fields shared by player create and update operations.
function normalizePlayerInput({
  name,
  level,
  gender,
  contact,
  preferMens,
  preferWomens,
  preferMixed,
  preferNoGender,
  rankPreference,
}) {
  const normalizedName = String(name || "").trim();
  const normalizedLevel = String(level || "").trim();
  const normalizedGender = normalizeRotationGender(gender);
  const normalizedRankPreference = normalizeRankPreference(rankPreference);
  const preferences = {
    preferMens: Boolean(preferMens),
    preferWomens: Boolean(preferWomens),
    preferMixed: Boolean(preferMixed),
    preferNoGender: Boolean(preferNoGender),
  };

  if (!normalizedName) throw new Error("Full name is required.");
  if (!getRotationLevelValue(normalizedLevel)) {
    throw new Error("Please select a valid skill level.");
  }
  if (!VALID_GENDERS.has(normalizedGender)) {
    throw new Error("Please select a valid gender.");
  }
  if (!VALID_RANK_PREFERENCES.has(rankPreference)) {
    throw new Error("Please select a valid rank-match preference.");
  }
  if (!Object.values(preferences).some(Boolean)) {
    throw new Error("Select at least one preferred match category.");
  }

  return {
    name: normalizedName,
    level: normalizeRotationLevel(normalizedLevel),
    gender: normalizedGender,
    contact: String(contact || "").trim() || "N/A",
    rankPreference: normalizedRankPreference,
    ...preferences,
  };
}

// Finds another profile with the same trimmed, case-insensitive name.
function findDuplicateName(name, excludedPlayerId = null) {
  return db.prepare(`
    SELECT id
    FROM players
    WHERE LOWER(TRIM(name)) = LOWER(?)
      AND (? IS NULL OR id <> ?)
    LIMIT 1
  `).get(name, excludedPlayerId, excludedPlayerId);
}

// Maps a profile row into the Player Management response shape.
function mapProfile(row) {
  const hasTodayRegistration = row.today_registration_id !== null
    && row.today_registration_id !== undefined;
  return {
    id: Number(row.id),
    name: row.name,
    level: normalizeRotationLevel(row.level),
    gender: normalizeRotationGender(row.gender),
    contactNumber: row.contact_number || "N/A",
    rankPreference: normalizeRankPreference(row.rank_match_preference),
    preferMens: Boolean(row.prefer_mens),
    preferWomens: Boolean(row.prefer_womens),
    preferMixed: Boolean(row.prefer_mixed),
    preferNoGender: Boolean(row.prefer_no_gender),
    lifetimeMatches: Number(row.total_matches_played || 0),
    lifetimeWins: Number(row.total_wins || 0),
    lifetimeLosses: Number(row.total_losses || 0),
    createdAt: row.created_at,
    todayRegistration: hasTodayRegistration
      ? {
        id: Number(row.today_registration_id),
        status: row.today_is_done ? "done" : row.today_status,
        isDone: Boolean(row.today_is_done),
      }
      : null,
  };
}

// Maps today's registration data and computed activity status for the renderer.
function mapTodayPlayer(row) {
  return {
    id: Number(row.id),
    registrationId: Number(row.registration_id),
    name: row.name,
    level: normalizeRotationLevel(row.level),
    gender: normalizeRotationGender(row.gender),
    rankPreference: normalizeRankPreference(row.rank_match_preference),
    preferMens: Boolean(row.prefer_mens),
    preferWomens: Boolean(row.prefer_womens),
    preferMixed: Boolean(row.prefer_mixed),
    preferNoGender: Boolean(row.prefer_no_gender),
    status: row.display_status,
    storedStatus: row.stored_status,
    isDoneToday: Boolean(row.is_done_today),
    matchesToday: Number(row.match_count || 0),
    winsToday: Number(row.wins || 0),
    lossesToday: Number(row.losses || 0),
    availableSince: row.available_since,
    registeredAt: row.registered_at,
    lockedTeammate: row.lock_id === null
      ? null
      : {
        lockId: Number(row.lock_id),
        id: Number(row.locked_teammate_id),
        name: row.locked_teammate_name,
        level: row.locked_teammate_level,
      },
  };
}

// Loads every profile with its latest registration for today, when present.
const playerManagementProfilesStatement = db.prepare(`
  SELECT
    players.*,
    registered_players_today.id AS today_registration_id,
    registered_players_today.status AS today_status,
    registered_players_today.is_done_today AS today_is_done
  FROM players
  LEFT JOIN registered_players_today
    ON registered_players_today.id = (
      SELECT current_registration.id
      FROM registered_players_today AS current_registration
      WHERE current_registration.player_id = players.id
        AND current_registration.registered_date = (DATE('now', 'localtime'))
      ORDER BY current_registration.is_done_today ASC, current_registration.id DESC
      LIMIT 1
    )
  ORDER BY players.name COLLATE NOCASE ASC, players.id ASC
`);

// Computes today's real player status across every active match source.
const playerManagementTodayStatement = db.prepare(`
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
    registered_players_today.status AS stored_status,
    registered_players_today.is_done_today,
    registered_players_today.match_count,
    registered_players_today.wins,
    registered_players_today.losses,
    registered_players_today.available_since,
    registered_players_today.created_at AS registered_at,
    player_team_locks.id AS lock_id,
    locked_teammate.id AS locked_teammate_id,
    locked_teammate.name AS locked_teammate_name,
    locked_teammate.level AS locked_teammate_level,
    CASE
      WHEN registered_players_today.is_done_today = 1 THEN 'done'
      WHEN EXISTS (
        SELECT 1
        FROM rotation_match_players
        JOIN rotation_matches
          ON rotation_matches.id = rotation_match_players.rotation_match_id
        WHERE rotation_match_players.player_id = players.id
          AND rotation_matches.status = 'playing'
      ) OR EXISTS (
        SELECT 1
        FROM tournament_matches
        JOIN tournament_teams AS team_a
          ON team_a.id = tournament_matches.team_a_id
        JOIN tournament_teams AS team_b
          ON team_b.id = tournament_matches.team_b_id
        WHERE tournament_matches.status = 'playing'
          AND players.id IN (
            team_a.player_1_id,
            team_a.player_2_id,
            team_b.player_1_id,
            team_b.player_2_id
          )
      ) OR EXISTS (
        SELECT 1
        FROM matches
        LEFT JOIN match_players
          ON match_players.match_id = matches.id
          AND match_players.source = 'normal'
        WHERE matches.status = 'playing'
          AND (
            matches.player_one = players.id
            OR matches.player_two = players.id
            OR match_players.player_id = players.id
          )
      ) THEN 'playing'
      WHEN EXISTS (
        SELECT 1
        FROM rotation_match_players
        JOIN rotation_matches
          ON rotation_matches.id = rotation_match_players.rotation_match_id
        WHERE rotation_match_players.player_id = players.id
          AND rotation_matches.status IN ('waiting', 'incomplete')
      ) OR registered_players_today.status = 'assigned' THEN 'assigned'
      WHEN registered_players_today.status = 'playing' THEN 'playing'
      ELSE 'available'
    END AS display_status
  FROM registered_players_today
  JOIN players
    ON players.id = registered_players_today.player_id
  LEFT JOIN player_team_locks
    ON player_team_locks.is_active = 1
    AND (
      player_team_locks.lock_type = 'permanent'
      OR player_team_locks.lock_date = (DATE('now', 'localtime'))
    )
    AND players.id IN (
      player_team_locks.player_1_id,
      player_team_locks.player_2_id
    )
  LEFT JOIN players AS locked_teammate
    ON locked_teammate.id = CASE
      WHEN player_team_locks.player_1_id = players.id
        THEN player_team_locks.player_2_id
      ELSE player_team_locks.player_1_id
    END
  WHERE registered_players_today.registered_date = (DATE('now', 'localtime'))
    AND registered_players_today.id = (
      SELECT current_registration.id
      FROM registered_players_today AS current_registration
      WHERE current_registration.player_id = registered_players_today.player_id
        AND current_registration.registered_date = (DATE('now', 'localtime'))
      ORDER BY current_registration.is_done_today ASC, current_registration.id DESC
      LIMIT 1
    )
  ORDER BY
    registered_players_today.is_done_today ASC,
    registered_players_today.created_at ASC,
    players.name COLLATE NOCASE ASC
`);

// Builds the complete Player Management payload and summary counts.
function loadPlayerManagementData() {
  const profiles = playerManagementProfilesStatement.all().map(mapProfile);
  const todayPlayers = playerManagementTodayStatement.all().map(mapTodayPlayer);
  const completedRotationMatchesToday = Number(db.prepare(`
    SELECT COUNT(*) AS count
    FROM rotation_matches
    WHERE status = 'finished'
      AND DATE(end_time, 'localtime') = (DATE('now', 'localtime'))
  `).get().count || 0);

  return {
    profiles,
    todayPlayers,
    summary: {
      totalProfiles: profiles.length,
      registeredToday: todayPlayers.length,
      activeToday: todayPlayers.filter((player) => !player.isDoneToday).length,
      availableToday: todayPlayers.filter((player) => player.status === "available").length,
      assignedToday: todayPlayers.filter((player) => player.status === "assigned").length,
      playingToday: todayPlayers.filter((player) => player.status === "playing").length,
      doneToday: todayPlayers.filter((player) => player.status === "done").length,
      completedRotationMatchesToday,
    },
  };
}

// Returns profiles, today's players, and summary counts.
export function getPlayerManagementData() {
  try {
    return { success: true, data: loadPlayerManagementData() };
  } catch (error) {
    return failure(error, "Failed to load Player Management data.");
  }
}

// Creates a validated player profile with match preferences.
export function addPlayer(
  name,
  level,
  gender,
  contact,
  preferMens,
  preferWomens,
  preferMixed,
  preferNoGender,
  rankPreference = "same_rank",
) {
  try {
    const player = normalizePlayerInput({
      name,
      level,
      gender,
      contact,
      preferMens,
      preferWomens,
      preferMixed,
      preferNoGender,
      rankPreference,
    });
    if (findDuplicateName(player.name)) {
      return { success: false, message: "Player already exists." };
    }

    const result = db.prepare(`
      INSERT INTO players (
        name,
        level,
        gender,
        contact_number,
        prefer_mens,
        prefer_womens,
        prefer_mixed,
        prefer_no_gender,
        rank_match_preference
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      player.name,
      player.level,
      player.gender,
      player.contact,
      player.preferMens ? 1 : 0,
      player.preferWomens ? 1 : 0,
      player.preferMixed ? 1 : 0,
      player.preferNoGender ? 1 : 0,
      player.rankPreference,
    );

    return {
      success: true,
      data: { id: Number(result.lastInsertRowid) },
    };
  } catch (error) {
    return failure(error, "Failed to add player profile.");
  }
}

// Updates all editable fields on an existing player profile.
export function updatePlayerInfo(
  playerId,
  name,
  level,
  gender,
  contact,
  preferMens,
  preferWomens,
  preferMixed,
  preferNoGender,
  rankPreference = "same_rank",
) {
  try {
    const id = parsePlayerId(playerId);
    const existing = db.prepare(`SELECT id FROM players WHERE id = ?`).get(id);
    if (!existing) return { success: false, message: "Player not found." };

    const player = normalizePlayerInput({
      name,
      level,
      gender,
      contact,
      preferMens,
      preferWomens,
      preferMixed,
      preferNoGender,
      rankPreference,
    });
    if (findDuplicateName(player.name, id)) {
      return { success: false, message: "Another player already uses this name." };
    }

    db.prepare(`
      UPDATE players
      SET
        name = ?,
        level = ?,
        gender = ?,
        contact_number = ?,
        prefer_mens = ?,
        prefer_womens = ?,
        prefer_mixed = ?,
        prefer_no_gender = ?,
        rank_match_preference = ?
      WHERE id = ?
    `).run(
      player.name,
      player.level,
      player.gender,
      player.contact,
      player.preferMens ? 1 : 0,
      player.preferWomens ? 1 : 0,
      player.preferMixed ? 1 : 0,
      player.preferNoGender ? 1 : 0,
      player.rankPreference,
      id,
    );

    return { success: true, data: { id } };
  } catch (error) {
    return failure(error, "Failed to update player profile.");
  }
}

// Registers a player for today or reactivates a player marked done.
export function registerPlayer(playerId) {
  try {
    const id = parsePlayerId(playerId);
    const player = db.prepare(`SELECT id, name FROM players WHERE id = ?`).get(id);
    if (!player) return { success: false, message: "Player not found." };

    // Prevents duplicate or partial daily registration changes.
    const transaction = db.transaction(() => {
      const registration = db.prepare(`
        SELECT id, is_done_today
        FROM registered_players_today
        WHERE player_id = ? AND registered_date = (DATE('now', 'localtime'))
        ORDER BY is_done_today ASC, id DESC
        LIMIT 1
      `).get(id);

      // Create the first registration for this player today.
      if (!registration) {
        const result = db.prepare(`
          INSERT INTO registered_players_today (
            player_id, status, is_done_today, registered_date, available_since
          ) VALUES (?, 'available', 0, DATE('now', 'localtime'), CURRENT_TIMESTAMP)
        `).run(id);
        return {
          registrationId: Number(result.lastInsertRowid),
          action: "registered",
        };
      }

      if (!registration.is_done_today) {
        throw new Error(`${player.name} is already registered today.`);
      }

      // Reactivate the existing daily record instead of adding a duplicate.
      db.prepare(`
        UPDATE registered_players_today
        SET
          is_done_today = 0,
          status = 'available',
          available_since = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(registration.id);
      return {
        registrationId: Number(registration.id),
        action: "reactivated",
      };
    });

    return { success: true, data: transaction() };
  } catch (error) {
    return failure(error, "Failed to register player today.");
  }
}

// Finds whether a player is assigned or playing in any match source.
function getPlayerActivity(playerId) {
  const rotation = db.prepare(`
    SELECT rotation_matches.status
    FROM rotation_match_players
    JOIN rotation_matches
      ON rotation_matches.id = rotation_match_players.rotation_match_id
    WHERE rotation_match_players.player_id = ?
      AND rotation_matches.status IN ('waiting', 'incomplete', 'playing')
    LIMIT 1
  `).get(playerId);
  if (rotation) return rotation.status === "playing" ? "playing" : "assigned";

  const tournament = db.prepare(`
    SELECT 1 AS active
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
  if (tournament) return "playing";

  const normal = db.prepare(`
    SELECT 1 AS active
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
  return normal ? "playing" : null;
}

// Marks a player done for today after confirming they have no active assignment.
export function removeRegisteredPlayer(playerId) {
  try {
    const id = parsePlayerId(playerId);
    const registration = db.prepare(`
      SELECT id, is_done_today
      FROM registered_players_today
      WHERE player_id = ? AND registered_date = (DATE('now', 'localtime'))
      ORDER BY is_done_today ASC, id DESC
      LIMIT 1
    `).get(id);
    if (!registration) {
      return { success: false, message: "Player is not registered today." };
    }
    if (registration.is_done_today) {
      return { success: false, message: "Player is already marked done today." };
    }

    const activity = getPlayerActivity(id);
    if (activity === "playing") {
      return {
        success: false,
        message: "Finish the player's active match before marking them done.",
      };
    }
    if (activity === "assigned") {
      return {
        success: false,
        message: "Cancel or edit the player's waiting match before marking them done.",
      };
    }

    db.prepare(`
      UPDATE registered_players_today
      SET is_done_today = 1, status = 'done'
      WHERE id = ?
    `).run(registration.id);
    return { success: true, data: { id, status: "done" } };
  } catch (error) {
    return failure(error, "Failed to mark player done today.");
  }
}

// Marks every unassigned, non-playing daily registration done in one transaction.
export function markAllRegisteredPlayersDone() {
  try {
    const transaction = db.transaction(() => {
      const activePlayers = playerManagementTodayStatement
        .all()
        .map(mapTodayPlayer)
        .filter((player) => !player.isDoneToday);
      const eligiblePlayers = activePlayers.filter(
        (player) => !["assigned", "playing"].includes(player.status),
      );
      const skippedPlayers = activePlayers
        .filter((player) => ["assigned", "playing"].includes(player.status))
        .map((player) => ({
          playerId: player.id,
          name: player.name,
          reason: player.status,
        }));

      let markedDone = 0;
      if (eligiblePlayers.length > 0) {
        const eligibleRegistrationIds = eligiblePlayers.map(
          (player) => player.registrationId,
        );
        const result = db.prepare(`
          UPDATE registered_players_today
          SET is_done_today = 1, status = 'done'
          WHERE registered_date = (DATE('now', 'localtime'))
            AND is_done_today = 0
            AND id IN (SELECT value FROM json_each(?))
        `).run(JSON.stringify(eligibleRegistrationIds));
        markedDone = result.changes;
      }

      return {
        markedDone,
        skipped: skippedPlayers.length,
        skippedPlayers,
      };
    });

    return { success: true, data: transaction() };
  } catch (error) {
    return failure(error, "Failed to mark today's players done.");
  }
}

// Checks every match and lock table before allowing permanent profile deletion.
function playerHasHistory(playerId) {
  const checks = [
    [`SELECT 1 FROM rotation_match_players WHERE player_id = ? LIMIT 1`, [playerId]],
    [`SELECT 1 FROM tournament_participants WHERE player_id = ? LIMIT 1`, [playerId]],
    [`SELECT 1 FROM tournament_teams WHERE player_1_id = ? OR player_2_id = ? LIMIT 1`, [playerId, playerId]],
    [`SELECT 1 FROM player_team_locks WHERE player_1_id = ? OR player_2_id = ? LIMIT 1`, [playerId, playerId]],
    [`SELECT 1 FROM match_players WHERE player_id = ? LIMIT 1`, [playerId]],
    [`SELECT 1 FROM matches WHERE player_one = ? OR player_two = ? OR winner_id = ? LIMIT 1`, [playerId, playerId, playerId]],
    [`SELECT 1 FROM match_history WHERE player_one = ? OR player_two = ? OR winner_id = ? LIMIT 1`, [playerId, playerId, playerId]],
    [`SELECT 1 FROM round_robin_matches WHERE player_one_id = ? OR player_two_id = ? LIMIT 1`, [playerId, playerId]],
  ];
  return checks.some(([sql, parameters]) => db.prepare(sql).get(...parameters));
}

// Deletes a profile only when it has no active registration or saved history.
export function deletePlayerProfile(playerId) {
  try {
    const id = parsePlayerId(playerId);
    const player = db.prepare(`SELECT id, name FROM players WHERE id = ?`).get(id);
    if (!player) return { success: false, message: "Player not found." };

    const activeRegistration = db.prepare(`
      SELECT id
      FROM registered_players_today
      WHERE player_id = ?
        AND registered_date = (DATE('now', 'localtime'))
        AND is_done_today = 0
    `).get(id);
    if (activeRegistration) {
      return {
        success: false,
        message: "Mark this player done today before deleting their profile.",
      };
    }
    if (playerHasHistory(id)) {
      return {
        success: false,
        message: "This profile has match, tournament, or teammate-lock history and cannot be deleted safely.",
      };
    }

    // Removes the profile and its unprotected registration data atomically.
    const transaction = db.transaction(() => {
      db.prepare(`
        DELETE FROM queue
        WHERE registered_player_id IN (
          SELECT id FROM registered_players_today WHERE player_id = ?
        )
      `).run(id);
      db.prepare(`DELETE FROM registered_players_today WHERE player_id = ?`).run(id);
      db.prepare(`DELETE FROM players WHERE id = ?`).run(id);
    });
    transaction();
    return { success: true, data: { id } };
  } catch (error) {
    return failure(error, "Failed to delete player profile.");
  }
}

// Kept for Tournament and older callers. This intentionally returns only active
// current-date registrations, not Player Management's done rows.
export function getRegisteredPlayersToday() {
  return playerManagementTodayStatement
    .all()
    .map(mapTodayPlayer)
    .filter((player) => !player.isDoneToday);
}
