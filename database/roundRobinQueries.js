import db from "./database.js";

/**
 * Get all players from the players table
 * for selection in round robin tournament
 */
export function getAllPlayers() {
  return db.prepare(`
    SELECT id, name, level
    FROM players
    ORDER BY name ASC
  `).all();
}

/**
 * Generate all unique pairings from a list of player IDs
 * e.g. [1,2,3,4] -> [[1,2],[1,3],[1,4],[2,3],[2,4],[3,4]]
 */
export function generateRoundRobinMatches(playerIds) {
  if (!playerIds || playerIds.length < 2) return [];

  const matches = [];

  // Generate all unique pairs (combinatorial)
  for (let i = 0; i < playerIds.length; i++) {
    for (let j = i + 1; j < playerIds.length; j++) {
      matches.push({
        player_one: playerIds[i],
        player_two: playerIds[j],
        status: "pending",
      });
    }
  }

  return matches;
}

/**
 * Save generated round robin matches to the database
 * Clears any previous pending matches first
 */
export function saveRoundRobinMatches(matches) {
  const insert = db.prepare(`
    INSERT INTO round_robin_matches (player_one_id, player_two_id, status)
    VALUES (?, ?, 'pending')
  `);

  const transaction = db.transaction(() => {
    // Clear existing pending matches
    db.prepare(`DELETE FROM round_robin_matches WHERE status = 'pending'`).run();

    // Insert new matches
    for (const match of matches) {
      insert.run(match.player_one, match.player_two);
    }
  });

  transaction();
}

/**
 * Get all round robin matches with player names
 */
export function getRoundRobinMatches() {
  return db.prepare(`
    SELECT
      rrm.id,
      rrm.status,
      rrm.court_id,
      rrm.created_at,
      p1.name AS player_one_name,
      p1.id AS player_one_id,
      p2.name AS player_two_name,
      p2.id AS player_two_id
    FROM round_robin_matches rrm
    JOIN players p1 ON rrm.player_one_id = p1.id
    JOIN players p2 ON rrm.player_two_id = p2.id
    ORDER BY rrm.id ASC
  `).all();
}

/**
 * Assign a round robin match to a court
 * Sets status to 'playing' and records court_id
 */
export function assignMatchToCourt(matchId, courtId) {
  const court = db.prepare(`
    SELECT id, status FROM courts WHERE id = ?
  `).get(courtId);

  if (!court || court.status !== "available") {
    return { success: false, error: "Court is not available" };
  }

  const match = db.prepare(`
    SELECT id, status FROM round_robin_matches WHERE id = ?
  `).get(matchId);

  if (!match || match.status !== "pending") {
    return { success: false, error: "Match is not pending" };
  }

  const transaction = db.transaction(() => {
    // Update match status
    db.prepare(`
      UPDATE round_robin_matches
      SET status = 'playing', court_id = ?
      WHERE id = ?
    `).run(courtId, matchId);

    // Update court status
    db.prepare(`
      UPDATE courts
      SET status = 'playing'
      WHERE id = ?
    `).run(courtId);
  });

  transaction();

  return { success: true };
}

/**
 * End a round robin match playing on a court
 * Sets match status to 'completed' and frees the court
 */
export function endRoundRobinMatch(matchId, courtId) {
  const transaction = db.transaction(() => {
    // Update match status
    db.prepare(`
      UPDATE round_robin_matches
      SET status = 'completed'
      WHERE id = ?
    `).run(matchId);

    // Free the court
    db.prepare(`
      UPDATE courts
      SET status = 'available', current_match_id = NULL
      WHERE id = ?
    `).run(courtId);
  });

  transaction();

  return { success: true };
}

