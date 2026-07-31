import db from "./database.js";


export function getCourts(){

  const courts = db.prepare(`
    SELECT 
      courts.id,
      courts.name,
      courts.status,
      GROUP_CONCAT(DISTINCT players.name) AS players,
      CASE WHEN COUNT(DISTINCT match_players.player_id) = 4 THEN 'doubles' ELSE 'singles' END AS match_type

    FROM courts

    LEFT JOIN (
      SELECT court_id, id AS match_id FROM matches WHERE status = 'playing'
      UNION
      SELECT court_id, id AS match_id FROM round_robin_matches WHERE status = 'playing'
    ) AS active_matches
      ON active_matches.court_id = courts.id

    LEFT JOIN match_players
      ON match_players.match_id = active_matches.match_id

    LEFT JOIN players
      ON players.id = match_players.player_id

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

    db.prepare(`
        UPDATE round_robin_matches
        SET court_id = NULL, status = 'pending'
        WHERE court_id = ?
    `).run(id);

    return db.prepare(`
        DELETE FROM courts
        WHERE id = ?
    `).run(id);

}
