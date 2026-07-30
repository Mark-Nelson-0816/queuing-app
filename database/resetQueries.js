import db from "./database.js";

export function resetAllData() {

    const reset = db.transaction(() => {

        db.prepare("DELETE FROM round_robin_matches").run();
        db.prepare("DELETE FROM matches").run();
        db.prepare("DELETE FROM queue").run();
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