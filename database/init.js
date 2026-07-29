import db from "./database.js";


db.exec(`

CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    name TEXT NOT NULL,

    -- statistics
    matches_played INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,

    -- current state
    status TEXT DEFAULT 'waiting',
    -- waiting | playing | finished

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);



CREATE TABLE IF NOT EXISTS courts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    name TEXT NOT NULL,

    status TEXT DEFAULT 'available',
    -- available | playing

    current_match_id INTEGER,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY(current_match_id)
    REFERENCES matches(id)
);



CREATE TABLE IF NOT EXISTS queue (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    player_id INTEGER NOT NULL,

    position INTEGER,

    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,


    FOREIGN KEY(player_id)
    REFERENCES players(id)
);



CREATE TABLE IF NOT EXISTS matches (

    id INTEGER PRIMARY KEY AUTOINCREMENT,


    court_id INTEGER,


    player_one INTEGER NOT NULL,

    player_two INTEGER NOT NULL,


    start_time DATETIME,

    end_time DATETIME,


    status TEXT DEFAULT 'playing',
    -- waiting | playing | finished


    winner_id INTEGER,


    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,


    FOREIGN KEY(court_id)
    REFERENCES courts(id),


    FOREIGN KEY(player_one)
    REFERENCES players(id),


    FOREIGN KEY(player_two)
    REFERENCES players(id),


    FOREIGN KEY(winner_id)
    REFERENCES players(id)

);



CREATE TABLE IF NOT EXISTS match_history (

    id INTEGER PRIMARY KEY AUTOINCREMENT,


    player_one INTEGER NOT NULL,

    player_two INTEGER NOT NULL,


    played_at DATETIME DEFAULT CURRENT_TIMESTAMP,


    winner_id INTEGER,


    FOREIGN KEY(player_one)
    REFERENCES players(id),


    FOREIGN KEY(player_two)
    REFERENCES players(id),


    FOREIGN KEY(winner_id)
    REFERENCES players(id)

);



CREATE TABLE IF NOT EXISTS settings (

    id INTEGER PRIMARY KEY AUTOINCREMENT,

    key TEXT UNIQUE,

    value TEXT

);



`);

console.log("Database initialized");