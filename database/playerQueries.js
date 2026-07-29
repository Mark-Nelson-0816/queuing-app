import db from "./database.js";


export function addPlayer(name) {

  const result = db.prepare(`
    INSERT INTO players(name)
    VALUES (?)
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