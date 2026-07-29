import db from "./database.js";


export function getCourts(){

  const courts = db.prepare(`
    SELECT 
      courts.id,
      courts.name,
      courts.status,
      GROUP_CONCAT(players.name) AS players

    FROM courts

    LEFT JOIN matches
      ON matches.court_id = courts.id
      AND matches.status = 'playing'

    LEFT JOIN players
      ON players.id = matches.player_one
      OR players.id = matches.player_two

    GROUP BY courts.id

    ORDER BY courts.id ASC

  `).all();


  return courts.map(court => ({
    ...court,

    players: court.players
      ? court.players.split(",")
      : []

  }));

}



export function getAvailableCourt(){

  return db.prepare(`
    SELECT *
    FROM courts
    WHERE status = 'available'
    LIMIT 1
  `).get();

}



export function updateCourtStatus(id, status){

  return db.prepare(`
    UPDATE courts
    SET status = ?
    WHERE id = ?
  `).run(
    status,
    id
  );

}

export function addCourt(name){

    return db.prepare(`
        INSERT INTO courts(name)
        VALUES(?)
    `).run(name);

}


export function removeCourt(id){

    db.prepare(`
        DELETE FROM matches
        WHERE court_id = ?
    `).run(id);


    return db.prepare(`
        DELETE FROM courts
        WHERE id = ?
    `).run(id);

}