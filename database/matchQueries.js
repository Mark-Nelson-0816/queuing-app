import db from "./database.js";


export function createMatch(){

    const waitingPlayers = db.prepare(`
        SELECT *
        FROM queue
        JOIN players 
        ON queue.player_id = players.id
        ORDER BY queue.joined_at ASC
    `).all();


    if(waitingPlayers.length < 2){
        return {
            success:false,
            error:"Not enough players"
        };
    }

    let playerOne = null;
    let playerTwo = null;

    for(let i = 0; i < waitingPlayers.length; i++){

        for(let j = i + 1; j < waitingPlayers.length; j++){

            if(waitingPlayers[i].level === waitingPlayers[j].level){

                const recentMatch = db.prepare(`
                    SELECT id FROM matches
                    WHERE (
                        (player_one = ? AND player_two = ?)
                        OR
                        (player_one = ? AND player_two = ?)
                    )
                    AND status = 'finished'
                    ORDER BY end_time DESC
                    LIMIT 1
                `).get(
                    waitingPlayers[i].player_id,
                    waitingPlayers[j].player_id,
                    waitingPlayers[j].player_id,
                    waitingPlayers[i].player_id
                );

                
                if(!recentMatch){
                    playerOne = waitingPlayers[i];
                    playerTwo = waitingPlayers[j];
                    break;
                }

            }

        }


        if(playerOne && playerTwo){
            break;
        }

    }

    
    if(!playerOne || !playerTwo){

        for(let i = 0; i < waitingPlayers.length; i++){

            for(let j = i + 1; j < waitingPlayers.length; j++){

                if(waitingPlayers[i].level === waitingPlayers[j].level){

                    playerOne = waitingPlayers[i];
                    playerTwo = waitingPlayers[j];
                    break;

                }

            }


            if(playerOne && playerTwo){
                break;
            }

        }

    }


    if(!playerOne || !playerTwo){
        return {
            success:false,
            error:"No opponent with same level"
        };
    }



    
    const court = db.prepare(`
        SELECT *
        FROM courts
        WHERE status = 'available'
        LIMIT 1
    `).get();


    if(!court){
        return {
            success:false,
            error:"No available court"
        };
    }



    const playerOneId = playerOne.player_id;
    const playerTwoId = playerTwo.player_id;



    
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
        playerOneId,
        playerTwoId
    );



    
    db.prepare(`
        DELETE FROM queue
        WHERE player_id IN (?,?)
    `).run(
        playerOneId,
        playerTwoId
    );



    
    db.prepare(`
        UPDATE players
        SET status='playing'
        WHERE id IN (?,?)
    `).run(
        playerOneId,
        playerTwoId
    );



    
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
            playerOne.name,
            playerTwo.name
        ]
    };

}

export function endMatch(courtId){
    
    const match = db.prepare(`
        SELECT *
        FROM matches
        WHERE court_id = ?
        AND status = 'playing'
    `).get(courtId);

    if(!match){
        throw new Error("No active match found");
    }

    
    db.prepare(`
        UPDATE matches
        SET 
            status = 'finished',
            end_time = datetime('now')
        WHERE id = ?
    `).run(match.id);

    
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

    
    const queueCount = db.prepare(`
        SELECT COUNT(*) as count FROM queue
    `).get().count;

    db.prepare(`
        INSERT INTO queue (player_id, position)
        VALUES (?, ?)
    `).run(match.player_one, queueCount + 1);

    db.prepare(`
        INSERT INTO queue (player_id, position)
        VALUES (?, ?)
    `).run(match.player_two, queueCount + 2);

    
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