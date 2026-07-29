import db from "./database.js";


export function createMatch(){

    // Get 2 players waiting longest
    const players = db.prepare(`
        SELECT *
        FROM queue
        JOIN players 
        ON queue.player_id = players.id
        ORDER BY queue.joined_at ASC
        LIMIT 2
    `).all();

    if(players.length < 2){
        return {
            success: false,
            error: "Not enough players"
        };
    }

    // Find available court
    const court = db.prepare(`
        SELECT *
        FROM courts
        WHERE status = 'available'
        LIMIT 1
    `).get();


    if(!court){
        return {
            success: false,
            error: "No available court"
        };
    }



    const playerOne = players[0].player_id;
    const playerTwo = players[1].player_id;



    // Create match
    const result = db.prepare(`
        INSERT INTO matches
        (
            court_id,
            player_one,
            player_two,
            start_time,
            status
        )
        VALUES (?, ?, ?, datetime('now'), 'playing')
    `).run(
        court.id,
        playerOne,
        playerTwo
    );



    // Remove players from queue
    db.prepare(`
        DELETE FROM queue
        WHERE player_id IN (?,?)
    `).run(
        playerOne,
        playerTwo
    );



    // Update player status
    db.prepare(`
        UPDATE players
        SET status='playing'
        WHERE id IN (?,?)
    `).run(
        playerOne,
        playerTwo
    );



    // Update court
    db.prepare(`
        UPDATE courts
        SET status='playing'
        WHERE id=?
    `).run(
        court.id
    );


    return {
        matchId: result.lastInsertRowid,
        court: court.name,
        players:[
            players[0].name,
            players[1].name
        ]
    };

}

export function endMatch(courtId){
    // Find active match
    const match = db.prepare(`
        SELECT *
        FROM matches
        WHERE court_id = ?
        AND status = 'playing'
    `).get(courtId);

    if(!match){
        throw new Error("No active match found");
    }

    // Finish match
    db.prepare(`
        UPDATE matches
        SET 
            status = 'finished',
            end_time = datetime('now')
        WHERE id = ?
    `).run(match.id);

    // Update players
    db.prepare(`
        UPDATE players
        SET 
            status = 'waiting',
            matches_played = matches_played + 1
        WHERE id IN (?,?)
    `).run(
        match.player_one,
        match.player_two
    );

    // Free court
    db.prepare(`
        UPDATE courts
        SET status = 'available'
        WHERE id = ?
    `).run(courtId);

    return {
        success:true,
        players:[
            match.player_one,
            match.player_two
        ]
    };

}