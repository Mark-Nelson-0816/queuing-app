import db from "./database.js";
console.log("INIT DATABASE RUNNING");

// Creates the schema and applies safe compatibility migrations atomically.
const initDatabase = db.transaction(() => {

// Creates every table and base index needed by current and legacy features.
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

    rank_match_preference TEXT NOT NULL DEFAULT 'same_rank',
    -- same_rank | adjacent_rank

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

    status TEXT DEFAULT 'available',
    -- available | assigned | playing | done

    is_done_today INTEGER DEFAULT 0,
    -- 1 = done playing for the whole day, else 0 
    
    registered_date DATE DEFAULT CURRENT_DATE,
    available_since DATETIME DEFAULT CURRENT_TIMESTAMP,
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

CREATE TABLE IF NOT EXISTS player_team_locks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_1_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    player_2_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    lock_type TEXT NOT NULL DEFAULT 'today',
    lock_date DATE NOT NULL DEFAULT CURRENT_DATE,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CHECK (player_1_id < player_2_id),
    CHECK (lock_type IN ('today', 'permanent'))
);

CREATE TABLE IF NOT EXISTS rotation_matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    queue_position INTEGER,
    match_type TEXT NOT NULL,
    category TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'waiting',
    court_id INTEGER REFERENCES courts(id) ON DELETE SET NULL,
    winner_team INTEGER,
    team_a_strength INTEGER NOT NULL DEFAULT 0,
    team_b_strength INTEGER NOT NULL DEFAULT 0,
    balance_difference INTEGER NOT NULL DEFAULT 0,
    warnings TEXT NOT NULL DEFAULT '[]',
    validation_message TEXT DEFAULT NULL,
    start_time DATETIME,
    end_time DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CHECK (match_type IN ('singles', 'doubles')),
    CHECK (category IN ('no_gender', 'mens', 'womens', 'mixed')),
    CHECK (status IN ('waiting', 'incomplete', 'playing', 'finished', 'cancelled')),
    CHECK (winner_team IS NULL OR winner_team IN (1, 2))
);

CREATE TABLE IF NOT EXISTS rotation_match_players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    rotation_match_id INTEGER NOT NULL
        REFERENCES rotation_matches(id) ON DELETE CASCADE,
    registered_player_id INTEGER NOT NULL
        REFERENCES registered_players_today(id),
    player_id INTEGER NOT NULL REFERENCES players(id),
    team INTEGER NOT NULL,
    slot INTEGER NOT NULL,
    lock_id INTEGER REFERENCES player_team_locks(id) ON DELETE SET NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CHECK (team IN (1, 2)),
    CHECK (slot IN (1, 2)),
    UNIQUE(rotation_match_id, registered_player_id),
    UNIQUE(rotation_match_id, team, slot)
);

`);

// Adds court assignment to tournament matches on older databases.
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

// Adds rank preference support to player profiles created by older versions.
const playerColumns = db.prepare(`PRAGMA table_info(players)`).all();
if (!playerColumns.some((column) => column.name === "rank_match_preference")) {
    db.exec(`
        ALTER TABLE players
        ADD COLUMN rank_match_preference TEXT NOT NULL DEFAULT 'same_rank'
    `);
}

// Adds fair-wait timing to older daily registration tables.
const registrationColumns = db.prepare(`
    PRAGMA table_info(registered_players_today)
`).all();
if (!registrationColumns.some((column) => column.name === "available_since")) {
    db.exec(`
        ALTER TABLE registered_players_today
        ADD COLUMN available_since DATETIME
    `);
}

// Normalizes legacy daily statuses and fills missing availability timestamps.
db.exec(`
    UPDATE registered_players_today
    SET available_since = COALESCE(available_since, created_at, CURRENT_TIMESTAMP);

    UPDATE registered_players_today
    SET status = CASE
        WHEN is_done_today = 1 THEN 'done'
        WHEN status IN ('waiting', 'finished') THEN 'available'
        ELSE status
    END;
`);

// Adds lookup indexes, active-court protections, and teammate-lock safeguards.
db.exec(`
    CREATE INDEX IF NOT EXISTS idx_tournament_matches_court_id
        ON tournament_matches(court_id);

    CREATE UNIQUE INDEX IF NOT EXISTS uq_tournament_matches_active_court
        ON tournament_matches(court_id)
        WHERE court_id IS NOT NULL AND status = 'playing';

    CREATE INDEX IF NOT EXISTS idx_rotation_matches_status_position
        ON rotation_matches(status, queue_position);

    CREATE INDEX IF NOT EXISTS idx_rotation_matches_court_id
        ON rotation_matches(court_id);

    CREATE INDEX IF NOT EXISTS idx_rotation_match_players_match_id
        ON rotation_match_players(rotation_match_id);

    CREATE INDEX IF NOT EXISTS idx_rotation_match_players_registration_id
        ON rotation_match_players(registered_player_id);

    CREATE INDEX IF NOT EXISTS idx_player_team_locks_active_date
        ON player_team_locks(lock_date, is_active);

    CREATE UNIQUE INDEX IF NOT EXISTS uq_rotation_active_court
        ON rotation_matches(court_id)
        WHERE court_id IS NOT NULL AND status = 'playing';

    CREATE UNIQUE INDEX IF NOT EXISTS uq_rotation_waiting_position
        ON rotation_matches(queue_position)
        WHERE queue_position IS NOT NULL
          AND status IN ('waiting', 'incomplete');

    CREATE UNIQUE INDEX IF NOT EXISTS uq_active_team_lock_pair
        ON player_team_locks(lock_date, player_1_id, player_2_id)
        WHERE is_active = 1;

    CREATE TRIGGER IF NOT EXISTS prevent_overlapping_active_team_lock
    BEFORE INSERT ON player_team_locks
    WHEN NEW.is_active = 1
    BEGIN
        SELECT CASE WHEN EXISTS (
            SELECT 1
            FROM player_team_locks
            WHERE is_active = 1
              AND lock_date = NEW.lock_date
              AND (
                  player_1_id IN (NEW.player_1_id, NEW.player_2_id)
                  OR player_2_id IN (NEW.player_1_id, NEW.player_2_id)
              )
        ) THEN RAISE(ABORT, 'A player already belongs to an active teammate lock.') END;
    END;
`);

});


// Run initialization once when the backend database module is loaded.
initDatabase();

console.log("Database initialized");
