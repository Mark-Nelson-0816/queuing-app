import db from "./database.js";


export function getQueue() {

  return db.prepare(`
    SELECT 
      queue.id,
      players.name,
      queue.position,
      queue.joined_at,
      players.status

    FROM queue

    JOIN players
    ON queue.player_id = players.id

    ORDER BY queue.position ASC
  `).all();

}



export function addToQueue(playerId) {

  const position = db.prepare(`
    SELECT COUNT(*) as count
    FROM queue
  `).get().count + 1;


  return db.prepare(`
    INSERT INTO queue(player_id, position)
    VALUES (?, ?)
  `)
  .run(playerId, position);

}



export function removeFromQueue(id) {

  return db.prepare(`
    DELETE FROM queue
    WHERE id = ?
  `)
  .run(id);

}

export function addPlayerToQueue(playerId) {

  const position = db.prepare(`
    SELECT COUNT(*) as count
    FROM queue
  `).get().count + 1;


  return db.prepare(`
    INSERT INTO queue(player_id, position)
    VALUES (?, ?)
  `)
  .run(playerId, position);

}