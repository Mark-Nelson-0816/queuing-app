import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { app } from "electron";

const testUserData = mkdtempSync(
  path.join(os.tmpdir(), "badminton-tournament-minor-level-migration-"),
);
const databasePath = path.join(testUserData, "badminton.db");

// Builds the Phase 8 configuration schema with one historical minor-level record.
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
    CHECK (level IN ('beginner', 'intermediate', 'upper_intermediate', 'advanced')),
    CHECK (NOT (match_type = 'singles' AND category = 'mixed')),
    UNIQUE(tournament_id, division, match_type, category, level)
  );

  CREATE TABLE tournament_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    configuration_id INTEGER NOT NULL REFERENCES tournament_configurations(id) ON DELETE CASCADE,
    group_number INTEGER NOT NULL,
    name TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    CHECK (group_number > 0),
    CHECK (LENGTH(TRIM(name)) > 0),
    UNIQUE(configuration_id, group_number),
    UNIQUE(configuration_id, name)
  );

  INSERT INTO tournaments (
    name, start_date, end_date, tournament_format_version, status
  ) VALUES ('Historical Junior Open', '2026-06-01', '2026-06-02', 2, 'finished');
  INSERT INTO tournament_configurations (
    tournament_id, division, match_type, category, level
  ) VALUES (1, 'u17', 'singles', 'mens', 'intermediate');
  INSERT INTO tournament_configurations (
    tournament_id, division, match_type, category, level
  ) VALUES (1, 'adult', 'singles', 'mens', 'advanced');
  INSERT INTO tournament_configurations (
    tournament_id, division, match_type, category, level
  ) VALUES (1, 'u17', 'singles', 'mens', 'advanced');
  INSERT INTO tournament_groups (configuration_id, group_number, name)
  VALUES (1, 1, 'Group A');
`);
legacyDatabase.close();

app.setPath("userData", testUserData);
let db;

try {
  const { initDatabase } = await import("../database/init.js");
  db = (await import("../database/database.js")).default;
  const { getTournamentEvent } = await import("../database/tournamentQueries.js");

  // Migration preserves historical meaning and every child foreign key.
  assert.deepEqual(
    db.prepare(`
      SELECT division, match_type, category, level
      FROM tournament_configurations
      WHERE id = 1
    `).get(),
    {
      division: "u17",
      match_type: "singles",
      category: "mens",
      level: "intermediate",
    },
  );
  assert.equal(
    db.prepare("SELECT configuration_id FROM tournament_groups WHERE id = 1").get()
      .configuration_id,
    1,
  );
  assert.equal(
    db.prepare("SELECT level FROM tournament_configurations WHERE id = 2").get().level,
    "advanced",
  );
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  assert.match(
    db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'tournament_configurations'")
      .get().sql,
    /'all'/i,
  );
  const historicalEvent = getTournamentEvent(1);
  assert.equal(historicalEvent.success, true, historicalEvent.message);
  const historicalMinorConfigurations = historicalEvent.data.configurations.filter((configuration) => (
      configuration.division === "u17"
      && configuration.matchType === "singles"
      && configuration.category === "mens"
  ));
  assert.deepEqual(
    historicalMinorConfigurations.map((configuration) => configuration.level).sort(),
    ["advanced", "intermediate"],
  );

  const insertConfiguration = db.prepare(`
    INSERT INTO tournament_configurations (
      tournament_id, division, match_type, category, level
    ) VALUES (?, ?, ?, ?, ?)
  `);

  // The historical minor row occupies the same logical level-independent identity.
  assert.throws(
    () => insertConfiguration.run(1, "u17", "singles", "mens", "all"),
    /already exists/i,
  );
  const newMinorId = Number(
    insertConfiguration.run(1, "u17", "singles", "womens", "all").lastInsertRowid,
  );
  assert.ok(newMinorId > 3);
  assert.throws(
    () => insertConfiguration.run(1, "u17", "singles", "no_gender", "beginner"),
    /all player levels/i,
  );

  // Repeated startup initialization remains idempotent after migration.
  initDatabase();
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  assert.equal(
    db.prepare("SELECT COUNT(*) AS count FROM tournament_configurations").get().count,
    4,
  );

  console.log("Tournament minor-level migration integration checks passed.");
} catch (error) {
  console.error(error);
  if (db?.open) db.close();
  rmSync(testUserData, { recursive: true, force: true });
  app.exit(1);
}

if (db?.open) db.close();
rmSync(testUserData, { recursive: true, force: true });
app.quit();
