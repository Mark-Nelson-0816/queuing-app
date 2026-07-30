import db from "./database.js";
console.log("INIT DATABASE RUNNING");

const initDatabase = db.transaction(() => {

db.exec(`

CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,

    level TEXT NOT NULL DEFAULT 'Beginner',

    matches_played INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,

    status TEXT DEFAULT 'waiting',
    -- waiting | playing | finished

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS courts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'available',
    current_match_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id INTEGER NOT NULL,
    position INTEGER,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    court_id INTEGER,
    player_one INTEGER NOT NULL,
    player_two INTEGER NOT NULL,
    start_time DATETIME,
    end_time DATETIME,
    status TEXT DEFAULT 'playing',
    winner_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS match_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_one INTEGER NOT NULL,
    player_two INTEGER NOT NULL,
    played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    winner_id INTEGER
);


CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE,
    value TEXT
);


CREATE TABLE IF NOT EXISTS round_robin_matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_one_id INTEGER NOT NULL,
    player_two_id INTEGER NOT NULL,
    status TEXT DEFAULT 'pending',
    court_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (player_one_id) REFERENCES players(id),
    FOREIGN KEY (player_two_id) REFERENCES players(id),
    FOREIGN KEY (court_id) REFERENCES courts(id)
);

`);

});


initDatabase();

console.log("Database initialized");