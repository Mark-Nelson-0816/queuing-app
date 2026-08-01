import db from "./database.js";
import { addToQueue } from "./queueQueries.js";


export function previewNextMatch(matchType = 'singles'){

    const waitingPlayers = db.prepare(`
        SELECT queue.id AS queue_id, players.id AS player_id, players.name, players.level, players.status, queue.joined_at
        FROM queue
        JOIN players 
        ON queue.player_id = players.id
        ORDER BY queue.joined_at ASC
    `).all();

    const requiredPlayers = matchType === 'doubles' ? 4 : 2;

    if(waitingPlayers.length < requiredPlayers){
        return {
            success: false,
            matchType,
            error: `Not enough players. Need ${requiredPlayers} for ${matchType}.`
        };
    }

    let matchedPlayers = [];

    // Strict FIFO queue behavior: take the first player in queue,
    // then find the next earliest players with the same level
    for(let i = 0; i < waitingPlayers.length; i++){

        const level = waitingPlayers[i].level;
        const sameLevel = [waitingPlayers[i]];

        for(let j = i + 1; j < waitingPlayers.length && sameLevel.length < requiredPlayers; j++){
            if(waitingPlayers[j].level === level){
                sameLevel.push(waitingPlayers[j]);
            }
        }

        if(sameLevel.length >= requiredPlayers){
            matchedPlayers = sameLevel.slice(0, requiredPlayers);
            break;
        }

    }

    if(matchedPlayers.length < requiredPlayers){
        return {
            success: false,
            matchType,
            error: `Waiting for more players of the same level`
        };
    }

    if (matchType === 'doubles') {
        return {
            success: true,
            matchType: 'doubles',
            teams: {
                team1: [matchedPlayers[0], matchedPlayers[1]],
                team2: [matchedPlayers[2], matchedPlayers[3]]
            }
        };
    }

    return {
        success: true,
        matchType: 'singles',
        players: [matchedPlayers[0], matchedPlayers[1]]
    };

}


export function createMatch(matchType = 'singles'){

    const waitingPlayers = db.prepare(`
        SELECT *
        FROM queue
        JOIN players 
        ON queue.player_id = players.id
        ORDER BY queue.joined_at ASC
    `).all();

    const requiredPlayers = matchType === 'doubles' ? 4 : 2;

    if(waitingPlayers.length < requiredPlayers){
        return {
            success:false,
            error: `Not enough players. Need ${requiredPlayers} for ${matchType}.`
        };
    }

    let matchedPlayers = [];
    let playerObjects = [];

    // Strict FIFO queue behavior: take the first player in queue,
    // then find the next earliest players with the same level
    for(let i = 0; i < waitingPlayers.length; i++){

        const level = waitingPlayers[i].level;
        const sameLevel = [waitingPlayers[i]];

        for(let j = i + 1; j < waitingPlayers.length && sameLevel.length < requiredPlayers; j++){
            if(waitingPlayers[j].level === level){
                sameLevel.push(waitingPlayers[j]);
            }
        }

        if(sameLevel.length >= requiredPlayers){
            matchedPlayers = sameLevel.slice(0, requiredPlayers).map(p => p.player_id);
            playerObjects = sameLevel.slice(0, requiredPlayers);
            break;
        }

    }


    if(matchedPlayers.length < requiredPlayers){
        return {
            success:false,
            error: `Not enough same-level players for ${matchType}. Need ${requiredPlayers}.`
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


    // For doubles: team 1 = players[0,1], team 2 = players[2,3]
    // For singles: player_one = first, player_two = second
    const playerOneId = matchedPlayers[0];
    const playerTwoId = matchedPlayers[1];

    
    const result = db.prepare(`
        INSERT INTO matches
        (
            court_id,
            player_one,
            player_two,
            match_type,
            start_time,
            status
        )
        VALUES (?, ?, ?, ?, datetime('now'), 'playing')
    `).run(
        court.id,
        playerOneId,
        playerTwoId,
        matchType
    );

    const matchId = result.lastInsertRowid;

    // Insert match_players entries
    const insertMP = db.prepare(`
        INSERT INTO match_players (match_id, player_id, team, match_type, source)
        VALUES (?, ?, ?, ?, 'normal')
    `);

    if (matchType === 'doubles') {
        // Team 1: players[0], players[1]; Team 2: players[2], players[3]
        insertMP.run(matchId, matchedPlayers[0], 1, 'doubles');
        insertMP.run(matchId, matchedPlayers[1], 1, 'doubles');
        insertMP.run(matchId, matchedPlayers[2], 2, 'doubles');
        insertMP.run(matchId, matchedPlayers[3], 2, 'doubles');
    } else {
        insertMP.run(matchId, matchedPlayers[0], null, 'singles');
        insertMP.run(matchId, matchedPlayers[1], null, 'singles');
    }


    // Build parameterized placeholders for IN clauses
    const placeholders = matchedPlayers.map(() => '?').join(',');
    
    db.prepare(`
        DELETE FROM queue
        WHERE player_id IN (${placeholders})
    `).run(...matchedPlayers);


    
    db.prepare(`
        UPDATE players
        SET status='playing'
        WHERE id IN (${placeholders})
    `).run(...matchedPlayers);


    
    db.prepare(`
        UPDATE courts
        SET status='playing'
        WHERE id=?
    `).run(
        court.id
    );



    return {
        matchId,
        court: court.name,
        matchType,
        players: playerObjects.map(p => p.name),
        teams: matchType === 'doubles' ? {
            team1: [playerObjects[0].name, playerObjects[1].name],
            team2: [playerObjects[2].name, playerObjects[3].name]
        } : undefined
    };

}

export function endMatch(courtId, requeue = true){
    
    // Helper to free players from match_players
    const freePlayers = (matchId, source) => {
        const matchPlayers = db.prepare(`
            SELECT player_id FROM match_players
            WHERE match_id = ? AND source = ?
        `).all(matchId, source);

        const playerIds = matchPlayers.map(p => p.player_id);
        const placeholders = playerIds.map(() => '?').join(',');

        db.prepare(`
            UPDATE players
            SET 
                status = 'waiting'
            WHERE id IN (${placeholders})
        `).run(...playerIds);

        if(requeue){
            for(const pid of playerIds){
                addToQueue(pid);
            }
        }

        return playerIds;
    };

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

        const playerIds = freePlayers(match.id, 'normal');

        
        db.prepare(`
            UPDATE courts
            SET status = 'available'
            WHERE id = ?
        `).run(courtId);

        return {
            success:true,
            type: 'normal',
            matchType: match.match_type || 'singles',
            players: playerIds
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

    const playerIds = freePlayers(rrMatch.id, 'round_robin');

    
    db.prepare(`
        UPDATE courts
        SET status = 'available'
        WHERE id = ?
    `).run(courtId);

    return {
        success:true,
        type: 'round_robin',
        matchType: rrMatch.match_type || 'singles',
        players: playerIds
    };

}
