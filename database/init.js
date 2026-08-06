import db from "./database.js";
console.log("INIT DATABASE RUNNING");

const initDatabase = db.transaction(() => {

db.exec(`

CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    level TEXT NOT NULL DEFAULT 'beginner',
    -- beginner | intermediate | upper_intermediate | advanced

    gender TEXT DEFAULT 'male',
    contact_number TEXT DEFAULT 'N/A',

    prefer_mixed INTEGER DEFAULT 0,
    prefer_mens INTEGER DEFAULT 0,
    prefer_womens INTEGER DEFAULT 0,
    prefer_no_gender INTEGER DEFAULT 0,

    -- preferred match type - no_gender | mens | womens | mixed

    total_matches_played INTEGER DEFAULT 0,
    total_wins INTEGER DEFAULT 0,
    total_losses INTEGER DEFAULT 0,

    -- moved to registered_players_today
    -- status TEXT DEFAULT 'waiting',
    -- waiting | playing | finished

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS registered_players_today (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id INTEGER NOT NULL,
    match_count INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,

    status TEXT DEFAULT 'waiting',
    -- waiting | playing | finished

    is_done_today INTEGER DEFAULT 0,
    -- 1 = done playing for the whole day, else 0 
    
    registered_date DATE DEFAULT CURRENT_DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (player_id) REFERENCES players(id)
);

CREATE TABLE IF NOT EXISTS tournaments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    match_type TEXT NOT NULL DEFAULT 'doubles',
    -- singles | doubles

    category TEXT NOT NULL DEFAULT 'mens',
    -- no_gender | mens | womens | mixed

    status TEXT NOT NULL DEFAULT 'ongoing',
    -- ongoing | finished

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tournament_teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,

    player_1_id INTEGER DEFAULT NULL,
    player_2_id INTEGER DEFAULT NULL,

    team_number INTEGER NOT NULL,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tournament_rounds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,

    round_number INTEGER NOT NULL,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tournament_matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,

    round_id INTEGER NOT NULL REFERENCES tournament_rounds(id) ON DELETE CASCADE,

    team_a_id INTEGER NOT NULL REFERENCES tournament_teams(id),

    team_b_id INTEGER NOT NULL REFERENCES tournament_teams(id),

    winner_team_id INTEGER REFERENCES tournament_teams(id),

    court_id INTEGER REFERENCES courts(id) ON DELETE SET NULL,

    status TEXT NOT NULL DEFAULT 'pending',
    -- pending | playing | finished

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tournament_teams_tournament_id
    ON tournament_teams(tournament_id);

CREATE INDEX IF NOT EXISTS idx_tournament_rounds_tournament_id
    ON tournament_rounds(tournament_id);

CREATE INDEX IF NOT EXISTS idx_tournament_matches_tournament_id
    ON tournament_matches(tournament_id);

CREATE INDEX IF NOT EXISTS idx_tournament_matches_round_id
    ON tournament_matches(round_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tournament_teams_number
    ON tournament_teams(tournament_id, team_number);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tournament_rounds_number
    ON tournament_rounds(tournament_id, round_number);

CREATE UNIQUE INDEX IF NOT EXISTS uq_tournament_matches_pair
    ON tournament_matches(
        tournament_id,
        (CASE WHEN team_a_id < team_b_id THEN team_a_id ELSE team_b_id END),
        (CASE WHEN team_a_id < team_b_id THEN team_b_id ELSE team_a_id END)
    );




-- not used in players & tournament

CREATE TABLE IF NOT EXISTS courts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'available',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE IF NOT EXISTS queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    registered_player_id INTEGER NOT NULL,
    position INTEGER,
    joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (registered_player_id) REFERENCES registered_players_today(id)
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
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (player_one) REFERENCES players(id),
    FOREIGN KEY (player_two) REFERENCES players(id),
    FOREIGN KEY (winner_id) REFERENCES players(id),
    FOREIGN KEY (court_id) REFERENCES courts(id)
);


CREATE TABLE IF NOT EXISTS match_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_one INTEGER NOT NULL,
    player_two INTEGER NOT NULL,
    played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    winner_id INTEGER,
    FOREIGN KEY (player_one) REFERENCES players(id),
    FOREIGN KEY (player_two) REFERENCES players(id),
    FOREIGN KEY (winner_id) REFERENCES players(id)
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

CREATE TABLE IF NOT EXISTS match_players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    match_id INTEGER NOT NULL REFERENCES matches(id),
    player_id INTEGER NOT NULL REFERENCES players(id),

    team INTEGER DEFAULT NULL,

    match_type TEXT NOT NULL DEFAULT 'singles',
    source TEXT NOT NULL DEFAULT 'normal'
);

`);

const tournamentMatchColumns = db.prepare(`
    PRAGMA table_info(tournament_matches)
`).all();

const hasTournamentCourtId = tournamentMatchColumns.some(
    (column) => column.name === "court_id"
);

if (!hasTournamentCourtId) {
    db.exec(`
        ALTER TABLE tournament_matches
        ADD COLUMN court_id INTEGER REFERENCES courts(id) ON DELETE SET NULL
    `);
}

db.exec(`
    CREATE INDEX IF NOT EXISTS idx_tournament_matches_court_id
        ON tournament_matches(court_id);

    CREATE UNIQUE INDEX IF NOT EXISTS uq_tournament_matches_active_court
        ON tournament_matches(court_id)
        WHERE court_id IS NOT NULL AND status = 'playing';
`);

});


initDatabase();

console.log("Database initialized");
