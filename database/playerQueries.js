import db from "./database.js";


export function addPlayer(name, level, gender, contact, preferMens, preferWomens, preferMixed, preferNoGender) {
  
    const preferMensNum = preferMens ? 1 : 0;
    const preferWomensNum = preferWomens ? 1 : 0;
    const preferMixedNum = preferMixed ? 1 : 0;
    const preferNoGenderNum = preferNoGender ? 1 : 0;

    const existingPlayer = db.prepare(`
        SELECT id
        FROM players
        WHERE name = ?
    `).get(name);


    if (existingPlayer) {
        return {message: 'Player already exists.'};
    }

    
    const result = db.prepare(`
        INSERT INTO players(name, level, gender, contact_number, prefer_mens, prefer_womens, prefer_mixed, prefer_no_gender)
        VALUES(?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name, level, gender, contact, preferMensNum, preferWomensNum, preferMixedNum, preferNoGenderNum);


    return result.lastInsertRowid;
}

export function searchPlayers(name) {

  return db.prepare(`
    SELECT p.id, p.name, p.level, p.prefer_mens, p.prefer_womens, p.prefer_mixed, p.prefer_no_gender,
    CASE
      WHEN r.id IS NULL THEN 1
      WHEN r.is_done_today = 1 THEN 1
      ELSE 0 
    END AS can_register

    FROM players p 
    LEFT JOIN registered_players_today r ON r.player_id = p.id AND r.registered_date = CURRENT_DATE 
    WHERE p.name LIKE ?
    ORDER BY p.name ASC
  `).all(`%${name}%`);

}

export function getPlayersProfile(name) {

  return db.prepare(`
    SELECT * FROM players WHERE name LIKE ? ORDER BY name ASC LIMIT 50
  `).all(`%${name || ''}%`);

}

export function registerPlayer(id) {

  const registeredPlayer = db.prepare(`
    SELECT is_done_today
    FROM registered_players_today
    WHERE player_id = ?
      AND registered_date = CURRENT_DATE
  `).get(id);

  if (!registeredPlayer) {
    db.prepare(`
      INSERT INTO registered_players_today (player_id)
      VALUES (?)
    `).run(id);

    return;
  }

  if (registeredPlayer.is_done_today === 1) {
    db.prepare(`
      UPDATE registered_players_today
      SET is_done_today = 0
      WHERE player_id = ?
        AND registered_date = CURRENT_DATE
    `).run(id);
  }

}

export function updatePlayerInfo(id, name, level, gender, contact, preferMens, preferWomens, preferMixed, preferNoGender){

    const preferMensNum = preferMens ? 1 : 0;
    const preferWomensNum = preferWomens ? 1 : 0;
    const preferMixedNum = preferMixed ? 1 : 0;
    const preferNoGenderNum = preferNoGender ? 1 : 0;

  return db.prepare(`
    UPDATE players SET name = ?, level = ?, gender = ?, contact_number = ?, prefer_mens = ?, prefer_womens = ?, prefer_mixed = ?, prefer_no_gender = ? WHERE id =?`).run(name, level, gender, contact, preferMensNum, preferWomensNum, preferMixedNum, preferNoGenderNum, id)
}

export function getRegisteredPlayersToday() {

  return db.prepare(`
    SELECT p.id, p.name, p.level, p.gender, r.status, r.match_count
    FROM players p
    JOIN registered_players_today r ON r.player_id = p.id
    WHERE r.registered_date = CURRENT_DATE AND r.is_done_today = 0
    ORDER BY r.created_at ASC
  `).all();

}

export function getRegisteredPlayersTodayLevelCount() {
  return db.prepare(`
    SELECT
      SUM(CASE WHEN p.level = 'beginner' THEN 1 ELSE 0 END) AS beginner,
      SUM(CASE WHEN p.level = 'intermediate' THEN 1 ELSE 0 END) AS intermediate,
      SUM(CASE WHEN p.level = 'upper_intermediate' THEN 1 ELSE 0 END) AS upper_intermediate,
      SUM(CASE WHEN p.level = 'advanced' THEN 1 ELSE 0 END) AS advanced
    FROM registered_players_today r
    JOIN players p
      ON r.player_id = p.id
  `).get();
}

export function removeRegisteredPlayer(id) {

  return db.prepare(`
    UPDATE registered_players_today SET is_done_today = 1 WHERE player_id = ? AND registered_date = CURRENT_DATE
  `).run(id);

}

export function deletePlayerProfile(id) {

  const transaction = db.transaction(()=>{
    db.prepare(`
      DELETE FROM registered_players_today
      WHERE player_id = ?
    `).run(id);

    db.prepare(`
      DELETE FROM players
      WHERE id = ?
    `).run(id);
  });

  transaction();
}

export function getPlayerCards() {

  const allPlayers = db.prepare(`
    SELECT COUNT(id) AS total
    FROM players
  `).get();

  const currentPlayers = db.prepare(`
    SELECT COUNT(id) AS total
    FROM registered_players_today
    WHERE registered_date = CURRENT_DATE
      AND is_done_today = 0
  `).get();

  const overallPlayersToday = db.prepare(`
    SELECT COUNT(id) AS total
    FROM registered_players_today
    WHERE registered_date = CURRENT_DATE
  `).get();

  const playing = db.prepare(`
    SELECT COUNT(id) AS total
    FROM registered_players_today
    WHERE registered_date = CURRENT_DATE
      AND is_done_today = 0
      AND status = 'playing'
  `).get();

  const totalMatches = 0; // TODO

  return {
    allPlayers: allPlayers.total,
    currentPlayers: currentPlayers.total,
    overallPlayersToday: overallPlayersToday.total,
    playing: playing.total,
    totalMatches
  };
}

//old player function - not used in player management page (not sure if used in other pages)
export function getPlayers() {

  return db.prepare(`
    SELECT
      players.*,
      COUNT(DISTINCT match_players.match_id) AS matches_played
    FROM players
    LEFT JOIN match_players ON match_players.player_id = players.id
      AND match_players.source IN ('normal', 'round_robin')
    GROUP BY players.id
    ORDER BY players.id DESC
  `).all();

}

export function deletePlayer(id) {
  // Prevent deleting a player who is currently playing
  const activeNormalMatch = db.prepare(`
    SELECT id FROM matches
    WHERE (player_one = ? OR player_two = ?) AND status = 'playing'
  `).get(id, id);

  const activeRRMatch = db.prepare(`
    SELECT id FROM round_robin_matches
    WHERE (player_one_id = ? OR player_two_id = ?) AND status = 'playing'
  `).get(id, id);

  if (activeNormalMatch || activeRRMatch) {
    return {
      success: false,
      error: "Cannot delete a player who is currently playing. End their match first."
    };
  }

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
