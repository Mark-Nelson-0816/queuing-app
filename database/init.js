import db from "./database.js";
console.log("INIT DATABASE RUNNING");

// Adds one nullable compatibility column when an installed database predates it.
function addColumnIfMissing(tableName, columnName, columnDefinition) {
    const columns = db.prepare(`PRAGMA table_info(${tableName})`).all();
    if (!columns.some((column) => column.name === columnName)) {
        db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnDefinition}`);
    }
}

// Creates the schema and applies safe compatibility migrations atomically.
export const initDatabase = db.transaction(() => {

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
    
    registered_date DATE DEFAULT (DATE('now', 'localtime')),
    available_since DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (player_id) REFERENCES players(id)
);

CREATE TABLE IF NOT EXISTS tournaments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    name TEXT DEFAULT NULL,
    start_date DATE DEFAULT NULL,
    end_date DATE DEFAULT NULL,

    tournament_format_version INTEGER NOT NULL DEFAULT 1,
    -- 1 = legacy single-configuration model, 2 = revised event model

    match_type TEXT NOT NULL DEFAULT 'doubles',
    -- legacy single-configuration field

    category TEXT NOT NULL DEFAULT 'mens',
    -- legacy single-configuration field

    status TEXT NOT NULL DEFAULT 'draft',
    -- draft | ongoing | finished

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tournament_configurations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tournament_id INTEGER NOT NULL
        REFERENCES tournaments(id) ON DELETE CASCADE,
    division TEXT NOT NULL,
    match_type TEXT NOT NULL,
    category TEXT NOT NULL,
    level TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CHECK (division IN ('adult', 'u17', 'u15', 'u13', 'u11', 'u9')),
    CHECK (match_type IN ('singles', 'doubles')),
    CHECK (category IN ('mens', 'womens', 'mixed', 'no_gender')),
    CHECK (level IN (
        'beginner',
        'intermediate',
        'upper_intermediate',
        'advanced'
    )),
    CHECK (NOT (match_type = 'singles' AND category = 'mixed')),
    UNIQUE(tournament_id, division, match_type, category, level)
);

CREATE TABLE IF NOT EXISTS tournament_participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    configuration_id INTEGER NOT NULL
        REFERENCES tournament_configurations(id) ON DELETE CASCADE,
    player_id INTEGER NOT NULL
        REFERENCES players(id) ON DELETE RESTRICT,
    level_snapshot TEXT NOT NULL,
    gender_snapshot TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CHECK (level_snapshot IN (
        'beginner',
        'intermediate',
        'upper_intermediate',
        'advanced'
    )),
    CHECK (gender_snapshot IN ('male', 'female')),
    UNIQUE(configuration_id, player_id)
);

CREATE TABLE IF NOT EXISTS tournament_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    configuration_id INTEGER NOT NULL
        REFERENCES tournament_configurations(id) ON DELETE CASCADE,
    group_number INTEGER NOT NULL,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CHECK (group_number > 0),
    CHECK (LENGTH(TRIM(name)) > 0),
    UNIQUE(configuration_id, group_number),
    UNIQUE(configuration_id, name)
);

CREATE TABLE IF NOT EXISTS tournament_teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,

    configuration_id INTEGER DEFAULT NULL
        REFERENCES tournament_configurations(id) ON DELETE CASCADE,
    group_id INTEGER DEFAULT NULL
        REFERENCES tournament_groups(id) ON DELETE SET NULL,

    player_1_id INTEGER DEFAULT NULL,
    player_2_id INTEGER DEFAULT NULL,

    team_number INTEGER NOT NULL,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tournament_team_players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    team_id INTEGER NOT NULL
        REFERENCES tournament_teams(id) ON DELETE CASCADE,
    participant_id INTEGER NOT NULL UNIQUE
        REFERENCES tournament_participants(id) ON DELETE CASCADE,
    slot INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CHECK (slot IN (1, 2)),
    UNIQUE(team_id, slot)
);

CREATE TABLE IF NOT EXISTS tournament_rounds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,

    configuration_id INTEGER DEFAULT NULL
        REFERENCES tournament_configurations(id) ON DELETE CASCADE,
    group_id INTEGER DEFAULT NULL
        REFERENCES tournament_groups(id) ON DELETE CASCADE,

    round_number INTEGER NOT NULL,

    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tournament_matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,

    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,

    configuration_id INTEGER DEFAULT NULL
        REFERENCES tournament_configurations(id) ON DELETE CASCADE,
    group_id INTEGER DEFAULT NULL
        REFERENCES tournament_groups(id) ON DELETE CASCADE,

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
    lock_date DATE NOT NULL DEFAULT (DATE('now', 'localtime')),
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

// Extends legacy Tournament tables without rewriting or deleting their rows.
addColumnIfMissing("tournaments", "name", "name TEXT DEFAULT NULL");
addColumnIfMissing("tournaments", "start_date", "start_date DATE DEFAULT NULL");
addColumnIfMissing("tournaments", "end_date", "end_date DATE DEFAULT NULL");
addColumnIfMissing(
    "tournaments",
    "tournament_format_version",
    "tournament_format_version INTEGER NOT NULL DEFAULT 1",
);

addColumnIfMissing(
    "tournament_teams",
    "configuration_id",
    `configuration_id INTEGER DEFAULT NULL
        REFERENCES tournament_configurations(id) ON DELETE CASCADE`,
);
addColumnIfMissing(
    "tournament_teams",
    "group_id",
    `group_id INTEGER DEFAULT NULL
        REFERENCES tournament_groups(id) ON DELETE SET NULL`,
);

addColumnIfMissing(
    "tournament_rounds",
    "configuration_id",
    `configuration_id INTEGER DEFAULT NULL
        REFERENCES tournament_configurations(id) ON DELETE CASCADE`,
);
addColumnIfMissing(
    "tournament_rounds",
    "group_id",
    `group_id INTEGER DEFAULT NULL
        REFERENCES tournament_groups(id) ON DELETE CASCADE`,
);

addColumnIfMissing(
    "tournament_matches",
    "configuration_id",
    `configuration_id INTEGER DEFAULT NULL
        REFERENCES tournament_configurations(id) ON DELETE CASCADE`,
);
addColumnIfMissing(
    "tournament_matches",
    "group_id",
    `group_id INTEGER DEFAULT NULL
        REFERENCES tournament_groups(id) ON DELETE CASCADE`,
);
addColumnIfMissing(
    "tournament_matches",
    "court_id",
    "court_id INTEGER REFERENCES courts(id) ON DELETE SET NULL",
);

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

// Adds normalized Tournament indexes and keeps legacy numbering compatible.
db.exec(`
    DROP INDEX IF EXISTS uq_tournament_teams_number;
    DROP INDEX IF EXISTS uq_tournament_rounds_number;

    CREATE UNIQUE INDEX IF NOT EXISTS uq_tournament_teams_number
        ON tournament_teams(tournament_id, team_number)
        WHERE configuration_id IS NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS uq_tournament_teams_configuration_number
        ON tournament_teams(configuration_id, team_number)
        WHERE configuration_id IS NOT NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS uq_tournament_rounds_number
        ON tournament_rounds(tournament_id, round_number)
        WHERE configuration_id IS NULL;

    CREATE UNIQUE INDEX IF NOT EXISTS uq_tournament_rounds_group_number
        ON tournament_rounds(group_id, round_number)
        WHERE group_id IS NOT NULL;

    CREATE INDEX IF NOT EXISTS idx_tournaments_status
        ON tournaments(status);

    CREATE INDEX IF NOT EXISTS idx_tournaments_history
        ON tournaments(status, start_date DESC, end_date DESC, id DESC);

    CREATE INDEX IF NOT EXISTS idx_tournament_configurations_tournament_id
        ON tournament_configurations(tournament_id);

    CREATE INDEX IF NOT EXISTS idx_tournament_participants_configuration_id
        ON tournament_participants(configuration_id);

    CREATE INDEX IF NOT EXISTS idx_tournament_participants_player_id
        ON tournament_participants(player_id);

    CREATE INDEX IF NOT EXISTS idx_tournament_groups_configuration_id
        ON tournament_groups(configuration_id, group_number);

    CREATE INDEX IF NOT EXISTS idx_tournament_teams_configuration_group
        ON tournament_teams(configuration_id, group_id, team_number);

    CREATE INDEX IF NOT EXISTS idx_tournament_team_players_team_id
        ON tournament_team_players(team_id);

    CREATE INDEX IF NOT EXISTS idx_tournament_team_players_participant_id
        ON tournament_team_players(participant_id);

    CREATE INDEX IF NOT EXISTS idx_tournament_rounds_configuration_group
        ON tournament_rounds(configuration_id, group_id, round_number);

    CREATE INDEX IF NOT EXISTS idx_tournament_matches_configuration_group_status
        ON tournament_matches(configuration_id, group_id, status, id);

    CREATE INDEX IF NOT EXISTS idx_tournament_matches_status_court
        ON tournament_matches(status, court_id);

    CREATE INDEX IF NOT EXISTS idx_tournament_matches_team_a_status
        ON tournament_matches(team_a_id, status);

    CREATE INDEX IF NOT EXISTS idx_tournament_matches_team_b_status
        ON tournament_matches(team_b_id, status);

    CREATE UNIQUE INDEX IF NOT EXISTS uq_tournament_matches_group_pair
        ON tournament_matches(
            group_id,
            (CASE WHEN team_a_id < team_b_id THEN team_a_id ELSE team_b_id END),
            (CASE WHEN team_a_id < team_b_id THEN team_b_id ELSE team_a_id END)
        )
        WHERE group_id IS NOT NULL;
`);

// Enforces revised Tournament event fields while legacy rows remain readable.
db.exec(`
    CREATE TRIGGER IF NOT EXISTS validate_revised_tournament_insert
    BEFORE INSERT ON tournaments
    WHEN NEW.tournament_format_version >= 2
    BEGIN
        SELECT CASE WHEN NEW.status NOT IN ('draft', 'ongoing', 'finished')
            THEN RAISE(ABORT, 'Invalid Tournament status.') END;
        SELECT CASE WHEN NEW.name IS NULL OR LENGTH(TRIM(NEW.name)) = 0
            THEN RAISE(ABORT, 'Tournament name is required.') END;
        SELECT CASE WHEN NEW.start_date IS NULL OR NEW.end_date IS NULL
            THEN RAISE(ABORT, 'Tournament start and end dates are required.') END;
        SELECT CASE WHEN NEW.start_date > NEW.end_date
            THEN RAISE(ABORT, 'Tournament start date must not be after its end date.') END;
    END;

    CREATE TRIGGER IF NOT EXISTS validate_revised_tournament_update
    BEFORE UPDATE OF name, start_date, end_date, status, tournament_format_version
    ON tournaments
    WHEN NEW.tournament_format_version >= 2
    BEGIN
        SELECT CASE WHEN NEW.status NOT IN ('draft', 'ongoing', 'finished')
            THEN RAISE(ABORT, 'Invalid Tournament status.') END;
        SELECT CASE WHEN NEW.name IS NULL OR LENGTH(TRIM(NEW.name)) = 0
            THEN RAISE(ABORT, 'Tournament name is required.') END;
        SELECT CASE WHEN NEW.start_date IS NULL OR NEW.end_date IS NULL
            THEN RAISE(ABORT, 'Tournament start and end dates are required.') END;
        SELECT CASE WHEN NEW.start_date > NEW.end_date
            THEN RAISE(ABORT, 'Tournament start date must not be after its end date.') END;
    END;

    CREATE TRIGGER IF NOT EXISTS prevent_second_ongoing_tournament_insert
    BEFORE INSERT ON tournaments
    WHEN NEW.status = 'ongoing'
    BEGIN
        SELECT CASE WHEN EXISTS (
            SELECT 1 FROM tournaments WHERE status = 'ongoing'
        ) THEN RAISE(ABORT, 'Only one Tournament may be ongoing at a time.') END;
    END;

    CREATE TRIGGER IF NOT EXISTS prevent_second_ongoing_tournament_update
    BEFORE UPDATE OF status ON tournaments
    WHEN NEW.status = 'ongoing' AND OLD.status <> 'ongoing'
    BEGIN
        SELECT CASE WHEN EXISTS (
            SELECT 1
            FROM tournaments
            WHERE status = 'ongoing' AND id <> OLD.id
        ) THEN RAISE(ABORT, 'Only one Tournament may be ongoing at a time.') END;
    END;
`);

// Keeps revised configurations and participant snapshots in their proper scope.
db.exec(`
    CREATE TRIGGER IF NOT EXISTS validate_tournament_configuration_insert
    BEFORE INSERT ON tournament_configurations
    BEGIN
        SELECT CASE WHEN NOT EXISTS (
            SELECT 1
            FROM tournaments
            WHERE id = NEW.tournament_id
              AND tournament_format_version >= 2
        ) THEN RAISE(ABORT, 'Tournament configuration requires a revised Tournament event.') END;
    END;

    CREATE TRIGGER IF NOT EXISTS validate_tournament_configuration_update
    BEFORE UPDATE OF tournament_id ON tournament_configurations
    BEGIN
        SELECT CASE WHEN NOT EXISTS (
            SELECT 1
            FROM tournaments
            WHERE id = NEW.tournament_id
              AND tournament_format_version >= 2
        ) THEN RAISE(ABORT, 'Tournament configuration requires a revised Tournament event.') END;
    END;

    CREATE TRIGGER IF NOT EXISTS validate_tournament_participant_insert
    BEFORE INSERT ON tournament_participants
    BEGIN
        SELECT CASE WHEN NOT EXISTS (
            SELECT 1
            FROM tournament_configurations
            WHERE id = NEW.configuration_id
              AND level = NEW.level_snapshot
        ) THEN RAISE(ABORT, 'Tournament participant level must match its configuration.') END;
        SELECT CASE WHEN EXISTS (
            SELECT 1
            FROM tournament_configurations
            WHERE id = NEW.configuration_id
              AND category = 'mens'
              AND NEW.gender_snapshot <> 'male'
        ) THEN RAISE(ABORT, 'Men''s Tournament participants must be male.') END;
        SELECT CASE WHEN EXISTS (
            SELECT 1
            FROM tournament_configurations
            WHERE id = NEW.configuration_id
              AND category = 'womens'
              AND NEW.gender_snapshot <> 'female'
        ) THEN RAISE(ABORT, 'Women''s Tournament participants must be female.') END;
    END;

    CREATE TRIGGER IF NOT EXISTS validate_tournament_participant_update
    BEFORE UPDATE OF configuration_id, level_snapshot, gender_snapshot
    ON tournament_participants
    BEGIN
        SELECT CASE WHEN NOT EXISTS (
            SELECT 1
            FROM tournament_configurations
            WHERE id = NEW.configuration_id
              AND level = NEW.level_snapshot
        ) THEN RAISE(ABORT, 'Tournament participant level must match its configuration.') END;
        SELECT CASE WHEN EXISTS (
            SELECT 1
            FROM tournament_configurations
            WHERE id = NEW.configuration_id
              AND category = 'mens'
              AND NEW.gender_snapshot <> 'male'
        ) THEN RAISE(ABORT, 'Men''s Tournament participants must be male.') END;
        SELECT CASE WHEN EXISTS (
            SELECT 1
            FROM tournament_configurations
            WHERE id = NEW.configuration_id
              AND category = 'womens'
              AND NEW.gender_snapshot <> 'female'
        ) THEN RAISE(ABORT, 'Women''s Tournament participants must be female.') END;
    END;
`);

// Validates revised team ownership without restricting legacy team rows.
db.exec(`
    CREATE TRIGGER IF NOT EXISTS validate_revised_tournament_team_insert
    BEFORE INSERT ON tournament_teams
    WHEN NEW.configuration_id IS NOT NULL OR NEW.group_id IS NOT NULL
    BEGIN
        SELECT CASE WHEN NEW.configuration_id IS NULL OR NEW.group_id IS NULL
            THEN RAISE(ABORT, 'Tournament team configuration and group are required.') END;
        SELECT CASE WHEN NOT EXISTS (
            SELECT 1
            FROM tournament_configurations
            WHERE id = NEW.configuration_id
              AND tournament_id = NEW.tournament_id
        ) THEN RAISE(ABORT, 'Tournament team does not belong to this event.') END;
        SELECT CASE WHEN NEW.group_id IS NOT NULL AND NOT EXISTS (
            SELECT 1
            FROM tournament_groups
            WHERE id = NEW.group_id
              AND configuration_id = NEW.configuration_id
        ) THEN RAISE(ABORT, 'Tournament team group does not belong to its configuration.') END;
    END;

    CREATE TRIGGER IF NOT EXISTS validate_revised_tournament_team_update
    BEFORE UPDATE OF tournament_id, configuration_id, group_id ON tournament_teams
    WHEN (NEW.configuration_id IS NOT NULL OR NEW.group_id IS NOT NULL)
      AND EXISTS (
          SELECT 1
          FROM tournament_configurations
          WHERE id = NEW.configuration_id
      )
    BEGIN
        SELECT CASE WHEN NEW.configuration_id IS NULL OR NEW.group_id IS NULL
            THEN RAISE(ABORT, 'Tournament team configuration and group are required.') END;
        SELECT CASE WHEN NOT EXISTS (
            SELECT 1
            FROM tournament_configurations
            WHERE id = NEW.configuration_id
              AND tournament_id = NEW.tournament_id
        ) THEN RAISE(ABORT, 'Tournament team does not belong to this event.') END;
        SELECT CASE WHEN NEW.group_id IS NOT NULL AND NOT EXISTS (
            SELECT 1
            FROM tournament_groups
            WHERE id = NEW.group_id
              AND configuration_id = NEW.configuration_id
        ) THEN RAISE(ABORT, 'Tournament team group does not belong to its configuration.') END;
    END;

    CREATE TRIGGER IF NOT EXISTS validate_tournament_team_player_insert
    BEFORE INSERT ON tournament_team_players
    BEGIN
        SELECT CASE WHEN NOT EXISTS (
            SELECT 1
            FROM tournament_teams
            JOIN tournament_participants
              ON tournament_participants.id = NEW.participant_id
            WHERE tournament_teams.id = NEW.team_id
              AND tournament_teams.configuration_id IS NOT NULL
              AND tournament_teams.configuration_id = tournament_participants.configuration_id
        ) THEN RAISE(ABORT, 'Tournament team player does not belong to its configuration.') END;
        SELECT CASE WHEN NEW.slot <> 1 AND EXISTS (
            SELECT 1
            FROM tournament_teams
            JOIN tournament_configurations
              ON tournament_configurations.id = tournament_teams.configuration_id
            WHERE tournament_teams.id = NEW.team_id
              AND tournament_configurations.match_type = 'singles'
        ) THEN RAISE(ABORT, 'Singles teams may contain only one player.') END;
    END;

    CREATE TRIGGER IF NOT EXISTS validate_tournament_team_player_update
    BEFORE UPDATE OF team_id, participant_id, slot ON tournament_team_players
    BEGIN
        SELECT CASE WHEN NOT EXISTS (
            SELECT 1
            FROM tournament_teams
            JOIN tournament_participants
              ON tournament_participants.id = NEW.participant_id
            WHERE tournament_teams.id = NEW.team_id
              AND tournament_teams.configuration_id IS NOT NULL
              AND tournament_teams.configuration_id = tournament_participants.configuration_id
        ) THEN RAISE(ABORT, 'Tournament team player does not belong to its configuration.') END;
        SELECT CASE WHEN NEW.slot <> 1 AND EXISTS (
            SELECT 1
            FROM tournament_teams
            JOIN tournament_configurations
              ON tournament_configurations.id = tournament_teams.configuration_id
            WHERE tournament_teams.id = NEW.team_id
              AND tournament_configurations.match_type = 'singles'
        ) THEN RAISE(ABORT, 'Singles teams may contain only one player.') END;
    END;
`);

// Validates revised round and match relationships and their lifecycle fields.
db.exec(`
    CREATE TRIGGER IF NOT EXISTS validate_revised_tournament_round_insert
    BEFORE INSERT ON tournament_rounds
    WHEN NEW.configuration_id IS NOT NULL OR NEW.group_id IS NOT NULL
    BEGIN
        SELECT CASE WHEN NEW.configuration_id IS NULL OR NEW.group_id IS NULL
            THEN RAISE(ABORT, 'Tournament round configuration and group are required.') END;
        SELECT CASE WHEN NOT EXISTS (
            SELECT 1
            FROM tournament_configurations
            JOIN tournament_groups
              ON tournament_groups.configuration_id = tournament_configurations.id
            WHERE tournament_configurations.id = NEW.configuration_id
              AND tournament_configurations.tournament_id = NEW.tournament_id
              AND tournament_groups.id = NEW.group_id
        ) THEN RAISE(ABORT, 'Tournament round does not belong to its event and group.') END;
    END;

    CREATE TRIGGER IF NOT EXISTS validate_revised_tournament_round_update
    BEFORE UPDATE OF tournament_id, configuration_id, group_id ON tournament_rounds
    WHEN NEW.configuration_id IS NOT NULL OR NEW.group_id IS NOT NULL
    BEGIN
        SELECT CASE WHEN NEW.configuration_id IS NULL OR NEW.group_id IS NULL
            THEN RAISE(ABORT, 'Tournament round configuration and group are required.') END;
        SELECT CASE WHEN NOT EXISTS (
            SELECT 1
            FROM tournament_configurations
            JOIN tournament_groups
              ON tournament_groups.configuration_id = tournament_configurations.id
            WHERE tournament_configurations.id = NEW.configuration_id
              AND tournament_configurations.tournament_id = NEW.tournament_id
              AND tournament_groups.id = NEW.group_id
        ) THEN RAISE(ABORT, 'Tournament round does not belong to its event and group.') END;
    END;

    CREATE TRIGGER IF NOT EXISTS validate_revised_tournament_match_insert
    BEFORE INSERT ON tournament_matches
    WHEN NEW.configuration_id IS NOT NULL OR NEW.group_id IS NOT NULL
    BEGIN
        SELECT CASE WHEN NEW.configuration_id IS NULL OR NEW.group_id IS NULL
            THEN RAISE(ABORT, 'Tournament match configuration and group are required.') END;
        SELECT CASE WHEN NEW.status NOT IN ('waiting', 'playing', 'finished')
            THEN RAISE(ABORT, 'Invalid revised Tournament match status.') END;
        SELECT CASE WHEN NEW.team_a_id = NEW.team_b_id
            THEN RAISE(ABORT, 'A Tournament team cannot play itself.') END;
        SELECT CASE WHEN NEW.winner_team_id IS NOT NULL
          AND NEW.winner_team_id NOT IN (NEW.team_a_id, NEW.team_b_id)
            THEN RAISE(ABORT, 'Tournament winner must belong to the match.') END;
        SELECT CASE WHEN NEW.status = 'waiting'
          AND (NEW.court_id IS NOT NULL OR NEW.winner_team_id IS NOT NULL)
            THEN RAISE(ABORT, 'Waiting Tournament matches cannot have a court or winner.') END;
        SELECT CASE WHEN NEW.status = 'playing'
          AND (NEW.court_id IS NULL OR NEW.winner_team_id IS NOT NULL)
            THEN RAISE(ABORT, 'Playing Tournament matches require a court and no winner.') END;
        SELECT CASE WHEN NEW.status = 'finished' AND NEW.winner_team_id IS NULL
            THEN RAISE(ABORT, 'Finished Tournament matches require a winner.') END;
        SELECT CASE WHEN NOT EXISTS (
            SELECT 1
            FROM tournament_configurations
            JOIN tournament_groups
              ON tournament_groups.configuration_id = tournament_configurations.id
            JOIN tournament_rounds
              ON tournament_rounds.configuration_id = tournament_configurations.id
             AND tournament_rounds.group_id = tournament_groups.id
            JOIN tournament_teams AS team_a
              ON team_a.configuration_id = tournament_configurations.id
             AND team_a.group_id = tournament_groups.id
            JOIN tournament_teams AS team_b
              ON team_b.configuration_id = tournament_configurations.id
             AND team_b.group_id = tournament_groups.id
            WHERE tournament_configurations.id = NEW.configuration_id
              AND tournament_configurations.tournament_id = NEW.tournament_id
              AND tournament_groups.id = NEW.group_id
              AND tournament_rounds.id = NEW.round_id
              AND team_a.id = NEW.team_a_id
              AND team_b.id = NEW.team_b_id
        ) THEN RAISE(ABORT, 'Tournament match relationships are inconsistent.') END;
    END;

    CREATE TRIGGER IF NOT EXISTS validate_revised_tournament_match_update
    BEFORE UPDATE OF tournament_id, configuration_id, group_id, round_id,
        team_a_id, team_b_id, winner_team_id, court_id, status
    ON tournament_matches
    WHEN NEW.configuration_id IS NOT NULL OR NEW.group_id IS NOT NULL
    BEGIN
        SELECT CASE WHEN NEW.configuration_id IS NULL OR NEW.group_id IS NULL
            THEN RAISE(ABORT, 'Tournament match configuration and group are required.') END;
        SELECT CASE WHEN NEW.status NOT IN ('waiting', 'playing', 'finished')
            THEN RAISE(ABORT, 'Invalid revised Tournament match status.') END;
        SELECT CASE WHEN NEW.team_a_id = NEW.team_b_id
            THEN RAISE(ABORT, 'A Tournament team cannot play itself.') END;
        SELECT CASE WHEN NEW.winner_team_id IS NOT NULL
          AND NEW.winner_team_id NOT IN (NEW.team_a_id, NEW.team_b_id)
            THEN RAISE(ABORT, 'Tournament winner must belong to the match.') END;
        SELECT CASE WHEN NEW.status = 'waiting'
          AND (NEW.court_id IS NOT NULL OR NEW.winner_team_id IS NOT NULL)
            THEN RAISE(ABORT, 'Waiting Tournament matches cannot have a court or winner.') END;
        SELECT CASE WHEN NEW.status = 'playing'
          AND (NEW.court_id IS NULL OR NEW.winner_team_id IS NOT NULL)
            THEN RAISE(ABORT, 'Playing Tournament matches require a court and no winner.') END;
        SELECT CASE WHEN NEW.status = 'finished' AND NEW.winner_team_id IS NULL
            THEN RAISE(ABORT, 'Finished Tournament matches require a winner.') END;
        SELECT CASE WHEN NOT EXISTS (
            SELECT 1
            FROM tournament_configurations
            JOIN tournament_groups
              ON tournament_groups.configuration_id = tournament_configurations.id
            JOIN tournament_rounds
              ON tournament_rounds.configuration_id = tournament_configurations.id
             AND tournament_rounds.group_id = tournament_groups.id
            JOIN tournament_teams AS team_a
              ON team_a.configuration_id = tournament_configurations.id
             AND team_a.group_id = tournament_groups.id
            JOIN tournament_teams AS team_b
              ON team_b.configuration_id = tournament_configurations.id
             AND team_b.group_id = tournament_groups.id
            WHERE tournament_configurations.id = NEW.configuration_id
              AND tournament_configurations.tournament_id = NEW.tournament_id
              AND tournament_groups.id = NEW.group_id
              AND tournament_rounds.id = NEW.round_id
              AND team_a.id = NEW.team_a_id
              AND team_b.id = NEW.team_b_id
        ) THEN RAISE(ABORT, 'Tournament match relationships are inconsistent.') END;
    END;
`);

// Protects both legacy and revised Tournament participants from direct deletion.
db.exec(`
    CREATE TRIGGER IF NOT EXISTS prevent_tournament_participant_profile_delete
    BEFORE DELETE ON players
    WHEN EXISTS (
        SELECT 1
        FROM tournament_participants
        WHERE player_id = OLD.id
    ) OR EXISTS (
        SELECT 1
        FROM tournament_teams
        WHERE player_1_id = OLD.id OR player_2_id = OLD.id
    )
    BEGIN
        SELECT RAISE(ABORT, 'Player has Tournament history and cannot be deleted.');
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

// Adds a database-level ongoing-event guard when legacy data is already valid.
const ongoingTournamentCount = db.prepare(`
    SELECT COUNT(*) AS count
    FROM tournaments
    WHERE status = 'ongoing'
`).get().count;

if (ongoingTournamentCount <= 1) {
    db.exec(`
        CREATE UNIQUE INDEX IF NOT EXISTS uq_tournaments_one_ongoing
        ON tournaments((1))
        WHERE status = 'ongoing'
    `);
}

});


// Run initialization once when the backend database module is loaded.
initDatabase();

console.log("Database initialized");
