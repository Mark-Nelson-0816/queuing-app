import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { app } from "electron";
import {
  getDefaultBackupFileName,
  runDatabaseBackupDialog,
} from "../electron/databaseBackupDialog.js";

const testUserData = mkdtempSync(path.join(os.tmpdir(), "badminton settings comprehensive "));
app.disableHardwareAcceleration();
app.setPath("userData", testUserData);

let db;

function assertSuccess(result) {
  assert.equal(result.success, true, result.message || result.error);
  return result.data;
}

function assertFailure(result, expression) {
  assert.equal(result.success, false);
  assert.match(result.message || result.error, expression);
}

function counts(database) {
  return database.prepare(`
    SELECT
      (SELECT COUNT(*) FROM players) AS players,
      (SELECT COUNT(*) FROM registered_players_today) AS registrations,
      (SELECT COUNT(*) FROM courts) AS courts,
      (SELECT COUNT(*) FROM rotation_matches) AS rotation_matches,
      (SELECT COUNT(*) FROM rotation_match_players) AS rotation_players,
      (SELECT COUNT(*) FROM player_team_locks) AS locks,
      (SELECT COUNT(*) FROM tournaments) AS tournaments,
      (SELECT COUNT(*) FROM settings) AS settings
  `).get();
}

function localDate(modifier) {
  return db.prepare(`SELECT DATE('now', 'localtime', ?) AS value`).get(modifier).value;
}

function localNoon(modifier) {
  return `${localDate(modifier)} 12:00:00`;
}

try {
  await import("../database/init.js");
  db = (await import("../database/database.js")).default;
  const settings = await import("../database/settingsQueries.js");
  const maintenance = await import("../database/maintenanceQueries.js");
  const rotation = await import("../database/rotationQueries.js");
  const { getCourts } = await import("../database/courtQueries.js");
  const { getPlayerManagementData } = await import("../database/playerQueries.js");
  const { listTournamentEvents } = await import("../database/tournamentQueries.js");

  const settingsPageSource = readFileSync(
    new URL("../src/pages/Settings.jsx", import.meta.url),
    "utf8",
  );
  const preloadSource = readFileSync(
    new URL("../electron/preload.cjs", import.meta.url),
    "utf8",
  );
  const mainSource = readFileSync(
    new URL("../electron/main.js", import.meta.url),
    "utf8",
  );
  const appSource = readFileSync(
    new URL("../src/App.jsx", import.meta.url),
    "utf8",
  );
  const queueSource = readFileSync(
    new URL("../src/pages/Queue.jsx", import.meta.url),
    "utf8",
  );
  const tournamentSource = readFileSync(
    new URL("../src/pages/Tournament.jsx", import.meta.url),
    "utf8",
  );

  // The Settings dashboard calls only read APIs during its initial load.
  const loadBefore = counts(db);
  for (let index = 0; index < 3; index += 1) {
    settings.getAllSettings();
    getPlayerManagementData();
    getCourts();
    rotation.getRotationMatches();
    listTournamentEvents();
    settings.getApplicationInfo();
  }
  assert.deepEqual(counts(db), loadBefore);
  assert.match(settingsPageSource, /Promise\.allSettled/);
  assert.match(settingsPageSource, /showBackupConfirm/);
  assert.match(settingsPageSource, /showClearHistoryConfirm/);
  assert.doesNotMatch(settingsPageSource, /showResetConfirm/);
  assert.doesNotMatch(settingsPageSource, /window\.api\.resetAllData/);
  assert.doesNotMatch(settingsPageSource, />Reset Application Data</);
  assert.match(settingsPageSource, /backupActionRef\.current/);
  assert.match(settingsPageSource, /clearHistoryActionRef\.current/);
  assert.match(settingsPageSource, /current\[key\] === value/);

  // Settings use generic upserts, persist across independent database reads, and do not duplicate keys.
  for (const [key, value] of [
    ["theme", "dark"],
    ["defaultMatchType", "singles"],
    ["autoRequeue", "false"],
    ["defaultTournamentMatchType", "singles"],
    ["defaultTournamentCategory", "no_gender"],
  ]) {
    assert.equal(settings.setSetting(key, value).success, true);
  }
  assert.equal(settings.setSetting("theme", "system").success, true);
  assert.equal(settings.getAllSettings().theme, "system");
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM settings WHERE key = 'theme'").get().count, 1);
  const reopened = new Database(path.join(testUserData, "badminton.db"), { readonly: true });
  assert.equal(reopened.prepare("SELECT value FROM settings WHERE key = 'theme'").pluck().get(), "system");
  reopened.close();
  const info = settings.getApplicationInfo();
  assert.equal(info.databaseLocation, db.name);
  assert.match(info.sqliteVersion, /^\d+\.\d+\.\d+/);

  // Each known preference stays independent, and repeated saves retain one latest row.
  assert.deepEqual(
    Object.fromEntries(Object.entries(settings.getAllSettings()).filter(([key]) => [
      "theme",
      "defaultMatchType",
      "autoRequeue",
      "defaultTournamentMatchType",
      "defaultTournamentCategory",
    ].includes(key))),
    {
      theme: "system",
      defaultMatchType: "singles",
      autoRequeue: "false",
      defaultTournamentMatchType: "singles",
      defaultTournamentCategory: "no_gender",
    },
  );
  for (const value of ["light", "dark", "system", "dark"]) {
    assert.equal(settings.setSetting("theme", value).success, true);
  }
  assert.equal(settings.getAllSettings().theme, "dark");
  assert.equal(db.prepare("SELECT COUNT(*) FROM settings WHERE key = 'theme'").pluck().get(), 1);

  // Production consumers read persisted values and apply their existing safe fallbacks.
  assert.match(appSource, /const theme = data\.theme \|\| "light"/);
  assert.match(appSource, /theme === "dark" \? "dark" : "light"/);
  assert.match(queueSource, /settingsRequest\.value\.autoRequeue !== "false"/);
  assert.match(queueSource, /\["singles", "doubles"\]\.includes\(defaultMatchType\)/);
  assert.match(queueSource, /!hasSavedRotationDraft/);
  assert.match(queueSource, /setDonePlayerIds\(autoRequeue \? \[\] : match\.players\.map/);
  assert.match(tournamentSource, /defaultTournamentMatchType === "singles" \? "singles" : "doubles"/);
  assert.match(tournamentSource, /allowedCategories\.includes\(settings\.defaultTournamentCategory\)/);
  assert.match(tournamentSource, /: "no_gender"/);

  // Unknown string keys are supported, but malformed keys and values do not create rows.
  assert.equal(settings.setSetting("futureSetting", true).success, true);
  assert.equal(settings.getAllSettings().futureSetting, "true");
  const settingsCountBeforeInvalidWrites = db.prepare("SELECT COUNT(*) FROM settings").pluck().get();
  for (const [key, value] of [
    [null, "value"],
    [undefined, "value"],
    ["", "value"],
    ["   ", "value"],
    ["invalidNullValue", null],
    ["invalidObjectValue", { enabled: true }],
  ]) {
    assert.equal(settings.setSetting(key, value).success, false);
  }
  assert.equal(db.prepare("SELECT COUNT(*) FROM settings").pluck().get(), settingsCountBeforeInvalidWrites);
  assert.equal(settings.getAllSettings().theme, "dark");

  // Seed current data, old/recent history, an active match, a lock, and Tournament data.
  const insertPlayer = db.prepare(`
    INSERT INTO players (
      name, level, gender, prefer_mens, prefer_womens, prefer_mixed, prefer_no_gender,
      total_matches_played, total_wins, total_losses
    ) VALUES (?, 'beginner', 'male', 1, 1, 1, 1, 12, 7, 5)
  `);
  const playerIds = ["Settings A", "Settings B"].map((name) => Number(insertPlayer.run(name).lastInsertRowid));
  const registrationInsert = db.prepare(`
    INSERT INTO registered_players_today (
      player_id, match_count, wins, losses, status, is_done_today
    ) VALUES (?, 3, 2, 1, 'available', 0)
  `);
  const registrationIds = playerIds.map((id) => Number(registrationInsert.run(id).lastInsertRowid));
  const courtId = Number(db.prepare("INSERT INTO courts (name) VALUES ('Settings Court')").run().lastInsertRowid);
  const lockId = Number(db.prepare(`
    INSERT INTO player_team_locks (player_1_id, player_2_id, lock_type, lock_date, is_active)
    VALUES (?, ?, 'today', DATE('now', 'localtime'), 1)
  `).run(...playerIds).lastInsertRowid);
  const tournamentId = Number(db.prepare(`
    INSERT INTO tournaments (name, start_date, end_date, tournament_format_version, status)
    VALUES ('Settings Preserved Tournament', DATE('now', 'localtime'), DATE('now', 'localtime'), 2, 'draft')
  `).run().lastInsertRowid);

  const insertRotationMatch = db.prepare(`
    INSERT INTO rotation_matches (
      queue_position, match_type, category, status, court_id, end_time, created_at, updated_at
    ) VALUES (?, 'singles', 'no_gender', ?, ?, ?, ?, ?)
  `);
  const insertParticipants = db.prepare(`
    INSERT INTO rotation_match_players (
      rotation_match_id, registered_player_id, player_id, team, slot, lock_id
    ) VALUES (?, ?, ?, ?, 1, ?)
  `);
  const createRotationRecord = (status, modifier, options = {}) => {
    const timestamp = localNoon(modifier);
    const matchId = Number(insertRotationMatch.run(
      options.queuePosition ?? null,
      status,
      options.courtId ?? null,
      status === "finished" || status === "cancelled" ? timestamp : null,
      timestamp,
      timestamp,
    ).lastInsertRowid);
    insertParticipants.run(matchId, registrationIds[0], playerIds[0], 1, options.lockId ?? null);
    insertParticipants.run(matchId, registrationIds[1], playerIds[1], 2, options.lockId ?? null);
    return matchId;
  };

  const retainedToday = createRotationRecord("finished", "0 days");
  const retainedOne = createRotationRecord("finished", "-1 days");
  const retainedSix = createRotationRecord("finished", "-6 days");
  const deletedSeven = createRotationRecord("finished", "-7 days");
  const deletedEight = createRotationRecord("cancelled", "-8 days");
  const deletedYear = createRotationRecord("finished", "-1 year");
  const waitingId = createRotationRecord("waiting", "-30 days", { queuePosition: 1, lockId });
  const playingId = createRotationRecord("playing", "-30 days", { courtId });
  db.prepare("UPDATE courts SET status = 'playing' WHERE id = ?").run(courtId);

  // Backup uses SQLite's consistent backup API without mutating the source database.
  const sourceBeforeBackup = counts(db);
  const backupDirectory = path.join(testUserData, "Backup Folder Å");
  mkdirSync(backupDirectory);
  const backupPath = path.join(backupDirectory, "settings backup.db");
  const backupStarted = performance.now();
  const backupResult = await maintenance.backupDatabase(backupPath);
  const backupElapsed = performance.now() - backupStarted;
  assertSuccess(backupResult);
  assert.equal(existsSync(backupPath), true);
  assert.ok(statSync(backupPath).size > 0);
  const backup = new Database(backupPath, { readonly: true });
  assert.equal(backup.prepare("PRAGMA integrity_check").pluck().get(), "ok");
  assert.deepEqual(backup.pragma("foreign_key_check"), []);
  assert.deepEqual(counts(backup), sourceBeforeBackup);
  assert.equal(backup.prepare("SELECT id FROM tournaments WHERE id = ?").get(tournamentId).id, tournamentId);
  assert.equal(backup.prepare("SELECT value FROM settings WHERE key = 'theme'").pluck().get(), "dark");
  backup.close();
  assert.deepEqual(counts(db), sourceBeforeBackup);
  assert.ok(getCourts().find((court) => court.id === courtId)?.activeMatch);
  assert.equal(rotation.getRotationMatches().success, true);

  const secondBackupPath = path.join(testUserData, "second-backup.db");
  assertSuccess(await maintenance.backupDatabase(secondBackupPath));
  assert.equal(existsSync(secondBackupPath), true);
  assertFailure(await maintenance.backupDatabase(db.name), /different location/i);
  assertFailure(await maintenance.backupDatabase(db.name.toUpperCase()), /different location/i);
  assertFailure(await maintenance.backupDatabase(path.join(testUserData, "missing", "backup.db")), /unable|open|directory/i);
  assertFailure(await maintenance.backupDatabase(testUserData), /unable|open|directory/i);
  assertFailure(await maintenance.backupDatabase(), /path|argument/i);
  let backupCalls = 0;
  const cancelled = await runDatabaseBackupDialog({
    documentsPath: testUserData,
    now: new Date(2026, 7, 23),
    showSaveDialog: async () => ({ canceled: true }),
    createBackup: async () => { backupCalls += 1; },
  });
  assert.deepEqual(cancelled, { success: true, data: { cancelled: true } });
  assert.equal(backupCalls, 0);
  assert.equal(getDefaultBackupFileName(new Date(2026, 7, 23)), "badminton-backup-2026-08-23.db");

  // The current seven-day window keeps today through six local calendar days ago.
  const cleanup = maintenance.clearOldRotationHistory();
  const cutoffDate = localDate("-6 days");
  assert.equal(cleanup.success, true);
  assert.equal(cleanup.data.cutoffDate, cutoffDate);
  assert.equal(cleanup.data.retainedDays, 7);
  assert.equal(cleanup.data.deletedMatches, 3);
  for (const id of [retainedToday, retainedOne, retainedSix, waitingId, playingId]) {
    assert.ok(db.prepare("SELECT id FROM rotation_matches WHERE id = ?").get(id));
  }
  for (const id of [deletedSeven, deletedEight, deletedYear]) {
    assert.equal(db.prepare("SELECT id FROM rotation_matches WHERE id = ?").get(id), undefined);
  }
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM rotation_match_players WHERE rotation_match_id IN (?, ?, ?)").get(deletedSeven, deletedEight, deletedYear).count, 0);
  assert.ok(db.prepare("SELECT id FROM player_team_locks WHERE id = ?").get(lockId));
  assert.equal(db.prepare("SELECT id FROM tournaments WHERE id = ?").get(tournamentId).id, tournamentId);
  assert.equal(db.prepare("SELECT status FROM courts WHERE id = ?").get(courtId).status, "playing");
  assert.equal(getCourts().find((court) => court.id === courtId).activeMatch?.source, "rotation");
  assert.deepEqual(
    db.prepare("SELECT total_matches_played, total_wins, total_losses FROM players WHERE id = ?").get(playerIds[0]),
    { total_matches_played: 12, total_wins: 7, total_losses: 5 },
  );
  assert.deepEqual(
    db.prepare("SELECT match_count, wins, losses FROM registered_players_today WHERE id = ?").get(registrationIds[0]),
    { match_count: 3, wins: 2, losses: 1 },
  );
  assert.equal(maintenance.clearOldRotationHistory().data.deletedMatches, 0);
  assert.equal(maintenance.clearOldRotationHistory().data.deletedMatches, 0);

  // A trigger failure makes the cleanup statement roll back its entire deletion.
  const rollbackFirst = createRotationRecord("finished", "-30 days");
  const rollbackSecond = createRotationRecord("finished", "-31 days");
  db.exec(`
    CREATE TRIGGER fail_settings_cleanup
    BEFORE DELETE ON rotation_matches
    WHEN OLD.id = ${rollbackSecond}
    BEGIN
      SELECT RAISE(ABORT, 'Injected cleanup failure');
    END;
  `);
  assertFailure(maintenance.clearOldRotationHistory(), /Injected cleanup failure/);
  assert.ok(db.prepare("SELECT id FROM rotation_matches WHERE id = ?").get(rollbackFirst));
  assert.ok(db.prepare("SELECT id FROM rotation_matches WHERE id = ?").get(rollbackSecond));
  db.exec("DROP TRIGGER fail_settings_cleanup");
  assert.equal(maintenance.clearOldRotationHistory().data.deletedMatches, 2);

  // Local date conversion follows the current Philippine business-day convention.
  assert.equal(db.prepare("SELECT DATE('2026-08-23 15:59:59', 'localtime') AS value").get().value, "2026-08-23");
  assert.equal(db.prepare("SELECT DATE('2026-08-23 16:00:00', 'localtime') AS value").get().value, "2026-08-24");

  // Cleanup comfortably handles meaningful historical volume in a single transaction.
  const bulkInsert = db.prepare(`
    INSERT INTO rotation_matches (match_type, category, status, end_time, created_at, updated_at)
    VALUES ('singles', 'no_gender', 'finished', ?, ?, ?)
  `);
  const oldTimestamp = localNoon("-90 days");
  for (let index = 0; index < 1000; index += 1) bulkInsert.run(oldTimestamp, oldTimestamp, oldTimestamp);
  const largeBackupPath = path.join(testUserData, "large-history-backup.db");
  const largeBackupStarted = performance.now();
  assertSuccess(await maintenance.backupDatabase(largeBackupPath));
  const largeBackupElapsed = performance.now() - largeBackupStarted;
  const largeBackup = new Database(largeBackupPath, { readonly: true });
  assert.equal(largeBackup.prepare("PRAGMA integrity_check").pluck().get(), "ok");
  assert.equal(largeBackup.prepare("SELECT COUNT(*) FROM rotation_matches").pluck().get(), 1005);
  largeBackup.close();
  const cleanupStarted = performance.now();
  assert.equal(maintenance.clearOldRotationHistory().data.deletedMatches, 1000);
  const cleanupElapsed = performance.now() - cleanupStarted;

  // Every Settings API used by the page has a matching preload/main IPC contract.
  const contracts = [
    ["getSettings", "get-settings"],
    ["getPlayerManagementData", "get-player-management-data"],
    ["getCourts", "get-courts"],
    ["getRotationMatches", "get-rotation-matches"],
    ["listTournaments", "list-tournaments"],
    ["getApplicationInfo", "get-application-info"],
    ["updateSetting", "update-setting"],
    ["backupDatabase", "backup-database"],
    ["clearOldRotationHistory", "clear-old-rotation-history"],
  ];
  for (const [method, channel] of contracts) {
    assert.match(preloadSource, new RegExp(`${method}\\s*:`));
    assert.match(preloadSource, new RegExp(`ipcRenderer\\.invoke\\(["']${channel}["']`));
    assert.match(mainSource, new RegExp(`ipcMain\\.handle\\(["']${channel}["']`));
  }

  assert.deepEqual(db.pragma("foreign_key_check"), []);
  assert.equal(db.pragma("integrity_check", { simple: true }), "ok");
  console.log(`Settings backup=${backupElapsed.toFixed(2)}ms; large backup=${largeBackupElapsed.toFixed(2)}ms; cleanup(1000)=${cleanupElapsed.toFixed(2)}ms.`);
  console.log("Settings comprehensive integration tests passed.");
} finally {
  db?.close();
  rmSync(testUserData, { recursive: true, force: true });
  app.quit();
}
