import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { app } from "electron";

app.disableHardwareAcceleration();
const testUserData = mkdtempSync(path.join(os.tmpdir(), "badminton-players-legacy-date-"));
app.setPath("userData", testUserData);
const oldDatabasePath = path.join(testUserData, "badminton.db");
let db;
let exitCode = 0;

try {
  // Simulate an installed database created before the local-date schema default.
  const legacy = new Database(oldDatabasePath);
  legacy.exec(`
    CREATE TABLE players (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      level TEXT NOT NULL DEFAULT 'beginner',
      gender TEXT DEFAULT 'male',
      contact_number TEXT DEFAULT 'N/A',
      prefer_mixed INTEGER DEFAULT 0,
      prefer_mens INTEGER DEFAULT 0,
      prefer_womens INTEGER DEFAULT 0,
      prefer_no_gender INTEGER DEFAULT 0,
      total_matches_played INTEGER DEFAULT 0,
      total_wins INTEGER DEFAULT 0,
      total_losses INTEGER DEFAULT 0,
      rank_match_preference TEXT NOT NULL DEFAULT 'same_rank',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE registered_players_today (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id INTEGER NOT NULL,
      match_count INTEGER DEFAULT 0,
      wins INTEGER DEFAULT 0,
      losses INTEGER DEFAULT 0,
      status TEXT DEFAULT 'available',
      is_done_today INTEGER DEFAULT 0,
      registered_date DATE DEFAULT CURRENT_DATE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (player_id) REFERENCES players(id)
    );
  `);
  legacy.close();

  await import("../database/init.js");
  db = (await import("../database/database.js")).default;
  const players = await import("../database/playerQueries.js");

  const legacyDefault = db.prepare("PRAGMA table_info(registered_players_today)").all()
    .find((column) => column.name === "registered_date").dflt_value;
  assert.match(legacyDefault, /CURRENT_DATE/i);

  const created = players.addPlayer(
    "Legacy Default Safe",
    "beginner",
    "male",
    "",
    true,
    false,
    false,
    false,
    "same_rank",
  );
  assert.equal(created.success, true);
  const registered = players.registerPlayer(created.data.id);
  assert.equal(registered.success, true);
  assert.equal(
    db.prepare("SELECT registered_date FROM registered_players_today WHERE id = ?").get(registered.data.registrationId).registered_date,
    db.prepare("SELECT DATE('now', 'localtime') AS value").get().value,
  );
  assert.equal(players.getRegisteredPlayersToday().length, 1);
  assert.deepEqual(db.pragma("foreign_key_check"), []);
  console.log("PLAYERS_LEGACY_LOCAL_DATE_MIGRATION_SUMMARY", JSON.stringify({
    tests: 4,
    retainedLegacyDefault: legacyDefault,
    explicitProductionRegistrationDate: db.prepare(
      "SELECT registered_date FROM registered_players_today WHERE id = ?",
    ).get(registered.data.registrationId).registered_date,
  }));
} catch (error) {
  console.error(error);
  exitCode = 1;
} finally {
  if (db?.open) db.close();
  rmSync(testUserData, { recursive: true, force: true });
  app.exit(exitCode);
}
