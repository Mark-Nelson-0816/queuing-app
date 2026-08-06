import db from "./database.js";

export function resetAllData() {

    const reset = db.transaction(() => {

        db.prepare("DELETE FROM rotation_match_players").run();
        db.prepare("DELETE FROM rotation_matches").run();
        db.prepare("DELETE FROM player_team_locks").run();
        db.prepare("DELETE FROM match_players").run();
        db.prepare("DELETE FROM round_robin_matches").run();
        db.prepare("DELETE FROM matches").run();
        db.prepare("DELETE FROM tournament_matches").run();
        db.prepare("DELETE FROM tournament_rounds").run();
        db.prepare("DELETE FROM tournament_teams").run();
        db.prepare("DELETE FROM tournaments").run();
        db.prepare("DELETE FROM queue").run();
        db.prepare("DELETE FROM registered_players_today").run();
        db.prepare("DELETE FROM players").run();
        db.prepare("DELETE FROM courts").run();

        db.prepare(`
            INSERT INTO courts(name, status)
            VALUES
            ('Court 1', 'available'),
            ('Court 2', 'available'),
            ('Court 3', 'available')
        `).run();

        db.prepare("DELETE FROM sqlite_sequence").run();
    });

    reset();

    return {
        success: true
    };
}
