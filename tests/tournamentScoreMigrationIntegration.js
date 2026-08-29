import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { app } from "electron";

const testUserData = mkdtempSync(
  path.join(os.tmpdir(), "badminton-tournament-score-migration-"),
);
const databasePath = path.join(testUserData, "badminton.db");

// Creates the current Tournament shape immediately before score columns existed.
const legacyDatabase = new Database(databasePath);
legacyDatabase.exec(`
  PRAGMA foreign_keys = ON;

  CREATE TABLE tournaments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT DEFAULT NULL,
    start_date DATE DEFAULT NULL,
    end_date DATE DEFAULT NULL,
    tournament_format_version INTEGER NOT NULL DEFAULT 1,
    match_type TEXT NOT NULL DEFAULT 'doubles',
    category TEXT NOT NULL DEFAULT 'mens',
    status TEXT NOT NULL DEFAULT 'draft',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE tournament_configurations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    division TEXT NOT NULL,
    match_type TEXT NOT NULL,
    category TEXT NOT NULL,
    level TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CHECK (division IN ('adult', 'u17', 'u15', 'u13', 'u11', 'u9')),
    CHECK (match_type IN ('singles', 'doubles')),
    CHECK (category IN ('mens', 'womens', 'mixed', 'no_gender')),
    CHECK (level IN ('beginner', 'intermediate', 'upper_intermediate', 'advanced', 'all')),
    CHECK (NOT (match_type = 'singles' AND category = 'mixed')),
    UNIQUE(tournament_id, division, match_type, category, level)
  );
  CREATE TABLE tournament_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    configuration_id INTEGER NOT NULL REFERENCES tournament_configurations(id) ON DELETE CASCADE,
    group_number INTEGER NOT NULL,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(configuration_id, group_number),
    UNIQUE(configuration_id, name)
  );
  CREATE TABLE tournament_teams (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    configuration_id INTEGER DEFAULT NULL REFERENCES tournament_configurations(id) ON DELETE CASCADE,
    group_id INTEGER DEFAULT NULL REFERENCES tournament_groups(id) ON DELETE SET NULL,
    player_1_id INTEGER DEFAULT NULL,
    player_2_id INTEGER DEFAULT NULL,
    team_number INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE tournament_rounds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    configuration_id INTEGER DEFAULT NULL REFERENCES tournament_configurations(id) ON DELETE CASCADE,
    group_id INTEGER DEFAULT NULL REFERENCES tournament_groups(id) ON DELETE CASCADE,
    round_number INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE courts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    status TEXT DEFAULT 'available',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE tournament_matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tournament_id INTEGER NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
    configuration_id INTEGER DEFAULT NULL REFERENCES tournament_configurations(id) ON DELETE CASCADE,
    group_id INTEGER DEFAULT NULL REFERENCES tournament_groups(id) ON DELETE CASCADE,
    round_id INTEGER NOT NULL REFERENCES tournament_rounds(id) ON DELETE CASCADE,
    team_a_id INTEGER NOT NULL REFERENCES tournament_teams(id),
    team_b_id INTEGER NOT NULL REFERENCES tournament_teams(id),
    winner_team_id INTEGER REFERENCES tournament_teams(id),
    court_id INTEGER REFERENCES courts(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  INSERT INTO tournaments (
    name, start_date, end_date, tournament_format_version, status
  ) VALUES ('Pre-Score Revised History', '2026-08-01', '2026-08-02', 2, 'finished');
  INSERT INTO tournament_configurations (
    tournament_id, division, match_type, category, level
  ) VALUES (1, 'adult', 'singles', 'mens', 'beginner');
  INSERT INTO tournament_groups (configuration_id, group_number, name)
  VALUES (1, 1, 'Group A');
  INSERT INTO tournament_teams (
    tournament_id, configuration_id, group_id, team_number
  ) VALUES (1, 1, 1, 1), (1, 1, 1, 2);
  INSERT INTO tournament_rounds (
    tournament_id, configuration_id, group_id, round_number
  ) VALUES (1, 1, 1, 1);
  INSERT INTO tournament_matches (
    tournament_id, configuration_id, group_id, round_id,
    team_a_id, team_b_id, winner_team_id, status
  ) VALUES (1, 1, 1, 1, 1, 2, 1, 'finished');

  INSERT INTO tournaments (
    name, start_date, end_date, tournament_format_version,
    match_type, category, status
  ) VALUES (NULL, NULL, NULL, 1, 'singles', 'mens', 'finished');
  INSERT INTO tournament_teams (tournament_id, team_number)
  VALUES (2, 1), (2, 2);
  INSERT INTO tournament_rounds (tournament_id, round_number)
  VALUES (2, 1);
  INSERT INTO tournament_matches (
    tournament_id, round_id, team_a_id, team_b_id, winner_team_id, status
  ) VALUES (2, 2, 3, 4, 3, 'finished');
`);
legacyDatabase.close();

app.setPath("userData", testUserData);
let db;

try {
  const { initDatabase } = await import("../database/init.js");
  db = (await import("../database/database.js")).default;
  const { getTournamentEvent } = await import("../database/tournamentQueries.js");

  const columns = new Set(
    db.prepare("PRAGMA table_info(tournament_matches)").all().map((column) => column.name),
  );
  assert.equal(columns.has("team_a_score"), true);
  assert.equal(columns.has("team_b_score"), true);

  for (const matchId of [1, 2]) {
    assert.deepEqual(
      db.prepare(`
        SELECT status, winner_team_id, team_a_score, team_b_score
        FROM tournament_matches WHERE id = ?
      `).get(matchId),
      {
        status: "finished",
        winner_team_id: matchId === 1 ? 1 : 3,
        team_a_score: null,
        team_b_score: null,
      },
    );
  }

  const historical = getTournamentEvent(1);
  assert.equal(historical.success, true, historical.message);
  const historicalMatch = historical.data.configurations[0].groups[0].rounds[0].matches[0];
  assert.equal(historicalMatch.status, "finished");
  assert.equal(historicalMatch.winnerTeamId, 1);
  assert.equal(historicalMatch.teamAScore, null);
  assert.equal(historicalMatch.teamBScore, null);

  initDatabase();
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  assert.equal(db.prepare("PRAGMA integrity_check").pluck().get(), "ok");
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM tournament_matches").get().count, 2);

  console.log("Tournament score migration integration checks passed.");
} catch (error) {
  console.error(error);
  if (db?.open) db.close();
  rmSync(testUserData, { recursive: true, force: true });
  app.exit(1);
}

if (db?.open) db.close();
rmSync(testUserData, { recursive: true, force: true });
app.quit();
