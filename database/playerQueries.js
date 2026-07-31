import db from "./database.js";


export function addPlayer(name, level) {

    
    const existingPlayer = db.prepare(`
        SELECT id
        FROM players
        WHERE name = ?
    `).get(name);


    if (existingPlayer) {
        return existingPlayer.id;
    }


    
    const result = db.prepare(`
        INSERT INTO players(name, level)
        VALUES(?, ?)
    `).run(name, level);


    return result.lastInsertRowid;
}



export function getPlayers() {

  return db.prepare(`
    SELECT *
    FROM players
    ORDER BY id DESC
  `).all();

}

export function deletePlayer(id) {
  const transaction = db.transaction(() => {
    
    db.prepare(`DELETE FROM match_players WHERE player_id = ?`).run(id);
    db.prepare(`DELETE FROM queue WHERE player_id = ?`).run(id);
    
    db.prepare(`DELETE FROM round_robin_matches WHERE player_one_id = ? OR player_two_id = ?`).run(id, id);
    
    db.prepare(`DELETE FROM matches WHERE player_one = ? OR player_two = ?`).run(id, id);
    
    db.prepare(`DELETE FROM match_history WHERE player_one = ? OR player_two = ?`).run(id, id);
    
    db.prepare(`DELETE FROM players WHERE id = ?`).run(id);
  });

  transaction();
  return { success: true };
}

export function updatePlayer(id, name, level) {
  db.prepare(`
    UPDATE players
    SET name = ?, level = ?
    WHERE id = ?
  `).run(name, level, id);

  return { success: true };
}
