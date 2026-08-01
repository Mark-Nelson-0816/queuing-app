import db from "./database.js";

export function getQueue() {
  return db.prepare(`
    SELECT
      queue.id,
      players.name,
      players.level,
      queue.position,
      queue.joined_at,
      players.status,

      COUNT(DISTINCT match_players.match_id) AS matches_played

    FROM queue

    JOIN players
      ON queue.player_id = players.id

    LEFT JOIN match_players
      ON match_players.player_id = players.id
      AND match_players.source IN ('normal', 'round_robin')

    GROUP BY players.id, queue.id

    ORDER BY queue.joined_at ASC

  `).all();
}

export function isPlayerInQueue(playerId) {
  const existing = db.prepare(`
    SELECT id FROM queue WHERE player_id = ?
  `).get(playerId);

  return !!existing;
}

export function addToQueue(playerId) {
  
  if (isPlayerInQueue(playerId)) {
    return { success: false, error: "Player is already in the queue" };
  }

  const position = db.prepare(`
    SELECT COUNT(*) as count
    FROM queue
  `).get().count + 1;

  db.prepare(`
    INSERT INTO queue(player_id, position)
    VALUES (?, ?)
  `).run(playerId, position);

  return { success: true };
}

export function removeFromQueue(id) {
  return db.prepare(`
    DELETE FROM queue
    WHERE id = ?
  `).run(id);
}

export function addPlayerToQueue(playerId) {
  const position = db.prepare(`
    SELECT COUNT(*) as count
    FROM queue
  `).get().count + 1;

  return db.prepare(`
    INSERT INTO queue(player_id, position)
    VALUES (?, ?)
  `).run(playerId, position);
}