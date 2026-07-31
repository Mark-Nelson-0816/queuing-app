import db from "./database.js";
import { addToQueue } from "./queueQueries.js";


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

    // Strict FIFO queue behavior: take the first player in queue,
    // then find the next earliest player with the same level
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

export function endMatch(courtId, requeue = true){
    
    // First check normal queue matches table
    let match = db.prepare(`
        SELECT *
        FROM matches
        WHERE court_id = ?
        AND status = 'playing'
    `).get(courtId);

    if(match){
        
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

// Requeue players if requested (addToQueue prevents duplicates)
        if(requeue){
            addToQueue(match.player_one);
            addToQueue(match.player_two);
        }

        
        db.prepare(`
            UPDATE courts
            SET status = 'available'
            WHERE id = ?
        `).run(courtId);

        return {
            success:true,
            type: 'normal',
            players:[
                match.player_one,
                match.player_two
            ]
        };
    }

    // If no normal match found, check round_robin_matches table
    const rrMatch = db.prepare(`
        SELECT *
        FROM round_robin_matches
        WHERE court_id = ?
        AND status = 'playing'
    `).get(courtId);

    if(!rrMatch){
        throw new Error("No active match found");
    }

    
    db.prepare(`
        UPDATE round_robin_matches
        SET 
            status = 'completed'
        WHERE id = ?
    `).run(rrMatch.id);

    
    db.prepare(`
        UPDATE players
        SET 
            status = 'waiting',
            matches_played = matches_played + 1
        WHERE id IN (?,?)
    `).run(
        rrMatch.player_one_id,
        rrMatch.player_two_id
    );

    // Requeue players if requested
    if(requeue){
        addToQueue(rrMatch.player_one_id);
        addToQueue(rrMatch.player_two_id);
    }

    
    db.prepare(`
        UPDATE courts
        SET status = 'available'
        WHERE id = ?
    `).run(courtId);

    return {
        success:true,
        type: 'round_robin',
        players:[
            rrMatch.player_one_id,
            rrMatch.player_two_id
        ]
    };

}
