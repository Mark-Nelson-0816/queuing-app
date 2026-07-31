import db from "./database.js";
import { generateRoundRobinSchedule, generateDoublesRoundRobinSchedule } from "../electron/roundRobinScheduler.js";
import { addToQueue } from "./queueQueries.js";

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

export function generateRoundRobinMatches(playerIds, matchType = 'singles') {
  if (!playerIds || playerIds.length < 2) return [];

  const minPlayers = matchType === 'doubles' ? 4 : 2;

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
    if (groupIds.length < minPlayers) continue; 

    if (matchType === 'doubles') {
      const schedule = generateDoublesRoundRobinSchedule(groupIds);

      for (const round of schedule) {
        for (const pairing of round.matches) {
          matches.push({
            player_one: pairing.player_one_id,
            player_two: pairing.player_two_id,
            team_one: pairing.team_one,
            team_two: pairing.team_two,
            round_number: round.round_number,
            match_type: 'doubles',
            status: "pending",
          });
        }
      }
    } else {
      const schedule = generateRoundRobinSchedule(groupIds);

      for (const round of schedule) {
        for (const pairing of round.matches) {
          matches.push({
            player_one: pairing.player_one_id,
            player_two: pairing.player_two_id,
            round_number: round.round_number,
            match_type: 'singles',
            status: "pending",
          });
        }
      }
    }
  }

  return matches;
}

export function saveRoundRobinMatches(matches) {
  // Delete existing match_players entries for RR matches first
  db.prepare(`
    DELETE FROM match_players WHERE source = 'round_robin'
  `).run();

  db.prepare(`DELETE FROM round_robin_matches`).run();

  const insert = db.prepare(`
    INSERT INTO round_robin_matches (player_one_id, player_two_id, match_type, round_number, status)
    VALUES (?, ?, ?, ?, 'pending')
  `);

  const insertMP = db.prepare(`
    INSERT INTO match_players (match_id, player_id, team, match_type, source)
    VALUES (?, ?, ?, ?, 'round_robin')
  `);

  const transaction = db.transaction(() => {
    db.prepare(`
      UPDATE courts
      SET status = 'available'
    `).run();

    for (const match of matches) {
      const result = insert.run(
        match.player_one,
        match.player_two,
        match.match_type || 'singles',
        match.round_number
      );
      const rrMatchId = result.lastInsertRowid;

      // Insert match_players entries
      if (match.match_type === 'doubles' && match.team_one && match.team_two) {
        // Team 1 players
        insertMP.run(rrMatchId, match.team_one[0], 1, 'doubles');
        insertMP.run(rrMatchId, match.team_one[1], 1, 'doubles');
        // Team 2 players
        insertMP.run(rrMatchId, match.team_two[0], 2, 'doubles');
        insertMP.run(rrMatchId, match.team_two[1], 2, 'doubles');
      } else {
        insertMP.run(rrMatchId, match.player_one, null, 'singles');
        insertMP.run(rrMatchId, match.player_two, null, 'singles');
      }
    }
  });

  transaction();
}

export function getRoundRobinMatches() {
  const matches = db.prepare(`
    SELECT
      rrm.id,
      rrm.status,
      rrm.court_id,
      rrm.round_number,
      rrm.created_at,
      rrm.match_type,
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

  // For doubles matches, fetch team member names from match_players
  return matches.map(match => {
    const result = { ...match };

    if (match.match_type === 'doubles') {
      const teamPlayers = db.prepare(`
        SELECT mp.player_id, mp.team, p.name
        FROM match_players mp
        JOIN players p ON p.id = mp.player_id
        WHERE mp.match_id = ? AND mp.source = 'round_robin'
        ORDER BY mp.team ASC, mp.id ASC
      `).all(match.id);

      const team1 = teamPlayers.filter(tp => tp.team === 1).map(tp => tp.name);
      const team2 = teamPlayers.filter(tp => tp.team === 2).map(tp => tp.name);

      result.team_one_names = team1;
      result.team_two_names = team2;
    }

    return result;
  });
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

export function endRoundRobinMatch(matchId, courtId, requeue = true) {
  const transaction = db.transaction(() => {

    const match = db.prepare(`
      SELECT id, player_one_id, player_two_id FROM round_robin_matches WHERE id = ?
    `).get(matchId);

    if (!match) {
      throw new Error("No active round robin match found");
    }

    db.prepare(`
      UPDATE round_robin_matches
      SET status = 'completed'
      WHERE id = ?
    `).run(matchId);

    db.prepare(`
      UPDATE players
      SET 
        status = 'waiting',
        matches_played = matches_played + 1
      WHERE id IN (?,?)
    `).run(
      match.player_one_id,
      match.player_two_id
    );

    // Requeue players if requested (addToQueue prevents duplicates)
    if (requeue) {
      addToQueue(match.player_one_id);
      addToQueue(match.player_two_id);
    }

    db.prepare(`
      UPDATE courts
      SET status = 'available'
      WHERE id = ?
    `).run(courtId);
  });

  transaction();

  return { success: true };
}
