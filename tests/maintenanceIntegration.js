import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { app } from "electron";
import {
  getDefaultBackupFileName,
  runDatabaseBackupDialog,
} from "../electron/databaseBackupDialog.js";

app.disableHardwareAcceleration();
const testUserData = mkdtempSync(path.join(os.tmpdir(), "badminton-maintenance-test-"));
app.setPath("userData", testUserData);

let db;

try {
  await import("../database/init.js");
  db = (await import("../database/database.js")).default;
  const maintenance = await import("../database/maintenanceQueries.js");

  db.prepare(`
    INSERT INTO players (
      name, level, gender, prefer_mens, prefer_womens,
      prefer_mixed, prefer_no_gender, total_matches_played, total_wins, total_losses
    ) VALUES ('Maintenance Player', 'beginner', 'male', 1, 0, 1, 1, 12, 7, 5)
  `).run();
  const playerId = Number(db.prepare("SELECT id FROM players WHERE name = 'Maintenance Player'").get().id);
  const registrationId = Number(db.prepare(`
    INSERT INTO registered_players_today (
      player_id, match_count, wins, losses, status, is_done_today
    ) VALUES (?, 3, 2, 1, 'available', 0)
  `).run(playerId).lastInsertRowid);
  db.prepare(`
    INSERT INTO tournaments (
      name, start_date, end_date, tournament_format_version, status
    ) VALUES ('Preserved Tournament', CURRENT_DATE, CURRENT_DATE, 2, 'draft')
  `).run();

  const insertMatch = db.prepare(`
    INSERT INTO rotation_matches (
      queue_position, match_type, category, status, end_time, created_at, updated_at
    ) VALUES (?, 'singles', 'no_gender', ?, ?, ?, ?)
  `);
  const cases = [
    [null, "finished", "-10 days"],
    [null, "cancelled", "-12 days"],
    [1, "waiting", "-20 days"],
    [2, "incomplete", "-20 days"],
    [null, "playing", "-20 days"],
    [null, "finished", "-2 days"],
    [null, "finished", "-6 days"],
  ];
  const matchIds = [];
  for (const [position, status, modifier] of cases) {
    const timestamp = db.prepare("SELECT DATETIME('now', ?) AS value").get(modifier).value;
    const result = insertMatch.run(position, status, timestamp, timestamp, timestamp);
    matchIds.push(Number(result.lastInsertRowid));
  }
  const insertParticipant = db.prepare(`
    INSERT INTO rotation_match_players (
      rotation_match_id, registered_player_id, player_id, team, slot
    ) VALUES (?, ?, ?, 1, 1)
  `);
  matchIds.forEach((matchId) => insertParticipant.run(matchId, registrationId, playerId));

  const cleared = maintenance.clearOldRotationHistory();
  assert.equal(cleared.success, true);
  assert.equal(cleared.data.deletedMatches, 2);
  assert.equal(cleared.data.retainedDays, 7);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM rotation_matches").get().count, 5);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM rotation_match_players").get().count, 5);
  assert.deepEqual(
    db.prepare("SELECT status FROM rotation_matches ORDER BY id").all().map((row) => row.status),
    ["waiting", "incomplete", "playing", "finished", "finished"],
  );
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM tournaments").get().count, 1);
  assert.deepEqual(
    db.prepare("SELECT total_matches_played, total_wins, total_losses FROM players WHERE id = ?").get(playerId),
    { total_matches_played: 12, total_wins: 7, total_losses: 5 },
  );
  assert.deepEqual(
    db.prepare("SELECT match_count, wins, losses FROM registered_players_today WHERE id = ?").get(registrationId),
    { match_count: 3, wins: 2, losses: 1 },
  );
  const nothingToClear = maintenance.clearOldRotationHistory();
  assert.equal(nothingToClear.success, true);
  assert.equal(nothingToClear.data.deletedMatches, 0);

  const backupPath = path.join(testUserData, "test-backup.db");
  const livePathRejected = await maintenance.backupDatabase(db.name);
  assert.equal(livePathRejected.success, false);
  assert.match(livePathRejected.message, /different location/i);
  const backupResult = await maintenance.backupDatabase(backupPath);
  assert.equal(backupResult.success, true);
  assert.equal(backupResult.data.fileName, "test-backup.db");
  assert.equal(existsSync(backupPath), true);
  const backup = new Database(backupPath, { readonly: true });
  assert.equal(backup.prepare("PRAGMA integrity_check").pluck().get(), "ok");
  assert.equal(backup.prepare("SELECT COUNT(*) FROM players").pluck().get(), 1);
  assert.equal(backup.prepare("SELECT COUNT(*) FROM tournaments").pluck().get(), 1);
  backup.close();
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM players").get().count, 1);

  let backupCalls = 0;
  const cancelled = await runDatabaseBackupDialog({
    documentsPath: testUserData,
    now: new Date(2026, 7, 14),
    showSaveDialog: async (options) => {
      assert.equal(path.basename(options.defaultPath), "badminton-backup-2026-08-14.db");
      return { canceled: true };
    },
    createBackup: async () => {
      backupCalls += 1;
      return { success: true };
    },
  });
  assert.deepEqual(cancelled, { success: true, data: { cancelled: true } });
  assert.equal(backupCalls, 0);
  assert.equal(getDefaultBackupFileName(new Date(2026, 7, 14)), "badminton-backup-2026-08-14.db");

  console.log("Database maintenance integration checks passed.");
} catch (error) {
  console.error(error);
  if (db?.open) db.close();
  rmSync(testUserData, { recursive: true, force: true });
  app.exit(1);
}

if (db?.open) db.close();
rmSync(testUserData, { recursive: true, force: true });
app.quit();
