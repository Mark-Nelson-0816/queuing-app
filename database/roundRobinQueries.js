import db from "./database.js";
import { generateRoundRobinSchedule } from "../electron/roundRobinScheduler.js";

function ensureRoundNumberColumn() {
  const columns = db.prepare(`PRAGMA table_info(round_robin_matches)`).all();
  const hasColumn = columns.some((col) => col.name === "round_number");
  if (!hasColumn) {
    db.prepare(`ALTER TABLE round_robin_matches ADD COLUMN round_number INTEGER`).run();
  }
}
ensureRoundNumberColumn();

export function getAllPlayers() {
  return db.prepare(`
    SELECT id, name, level
    FROM players
    ORDER BY name ASC
  `).all();
}

export function generateRoundRobinMatches(playerIds) {
  if (!playerIds || playerIds.length < 2) return [];

  const players = db.prepare(`
    SELECT id, level FROM players WHERE id IN (${playerIds.map(() => '?').join(',')})
  `).all(...playerIds);

  const levelGroups = {};
  for (const player of players) {
    if (!levelGroups[player.level]) {
      levelGroups[player.level] = [];
    }
    levelGroups[player.level].push(player.id);
  }

  const matches = [];

  for (const level in levelGroups) {
    const groupIds = levelGroups[level];
    if (groupIds.length < 2) continue; 

    const schedule = generateRoundRobinSchedule(groupIds);

    for (const round of schedule) {
      for (const pairing of round.matches) {
        matches.push({
          player_one: pairing.player_one_id,
          player_two: pairing.player_two_id,
          round_number: round.round_number,
          status: "pending",
        });
      }
    }
  }

  return matches;
}

export function saveRoundRobinMatches(matches) {
  const insert = db.prepare(`
    INSERT INTO round_robin_matches (player_one_id, player_two_id, round_number, status)
    VALUES (?, ?, ?, 'pending')
  `);

  const transaction = db.transaction(() => {
    db.prepare(`DELETE FROM round_robin_matches`).run();

    db.prepare(`
      UPDATE courts
      SET status = 'available'
    `).run();

    for (const match of matches) {
      insert.run(match.player_one, match.player_two, match.round_number);
    }
  });

  transaction();
}

export function getRoundRobinMatches() {
  return db.prepare(`
    SELECT
      rrm.id,
      rrm.status,
      rrm.court_id,
      rrm.round_number,
      rrm.created_at,
      p1.name AS player_one_name,
      p1.id AS player_one_id,
      p1.level AS player_one_level,
      p2.name AS player_two_name,
      p2.id AS player_two_id,
      p2.level AS player_two_level
    FROM round_robin_matches rrm
    JOIN players p1 ON rrm.player_one_id = p1.id
    JOIN players p2 ON rrm.player_two_id = p2.id
    ORDER BY rrm.round_number ASC, rrm.id ASC
  `).all();
}

export function assignMatchToCourt(matchId, courtId) {
  const court = db.prepare(`
    SELECT id, status FROM courts WHERE id = ?
  `).get(courtId);

  if (!court || court.status !== "available") {
    return { success: false, error: "Court is not available" };
  }

  const match = db.prepare(`
    SELECT id, status, player_one_id, player_two_id FROM round_robin_matches WHERE id = ?
  `).get(matchId);

  if (!match || match.status !== "pending") {
    return { success: false, error: "Match is not pending" };
  }

  const activeMatch = db.prepare(`
    SELECT id FROM round_robin_matches
    WHERE status = 'playing'
    AND (player_one_id = ? OR player_two_id = ? OR player_one_id = ? OR player_two_id = ?)
    LIMIT 1
  `).get(
    match.player_one_id, match.player_one_id,
    match.player_two_id, match.player_two_id
  );

  if (activeMatch) {
    return { success: false, error: "One of the players is already playing in another match" };
  }

  const transaction = db.transaction(() => {

    db.prepare(`
      UPDATE round_robin_matches
      SET status = 'playing', court_id = ?
      WHERE id = ?
    `).run(courtId, matchId);

    db.prepare(`
      UPDATE courts
      SET status = 'playing'
      WHERE id = ?
    `).run(courtId);
  });

  transaction();

  return { success: true };
}

export function endRoundRobinMatch(matchId, courtId) {
  const transaction = db.transaction(() => {

    db.prepare(`
      UPDATE round_robin_matches
      SET status = 'completed'
      WHERE id = ?
    `).run(matchId);

    db.prepare(`
      UPDATE courts
      SET status = 'available'
      WHERE id = ?
    `).run(courtId);
  });

  transaction();

  return { success: true };
}