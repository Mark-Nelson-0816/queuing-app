import db from "./database.js";


export function addPlayer(name) {

    // Check if player already exists
    const existingPlayer = db.prepare(`
        SELECT id
        FROM players
        WHERE name = ?
    `).get(name);


    if (existingPlayer) {
        return existingPlayer.id;
    }


    // Create new player
    const result = db.prepare(`
        INSERT INTO players(name)
        VALUES(?)
    `).run(name);


    return result.lastInsertRowid;
}



export function getPlayers() {

  return db.prepare(`
    SELECT *
    FROM players
    ORDER BY id DESC
  `).all();

}