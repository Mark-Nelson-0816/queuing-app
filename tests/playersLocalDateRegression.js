import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { app } from "electron";

app.disableHardwareAcceleration();
const testUserData = mkdtempSync(path.join(os.tmpdir(), "badminton-players-local-date-"));
app.setPath("userData", testUserData);

let db;
let exitCode = 0;

function localCalendarDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function expectSuccess(result) {
  assert.equal(result.success, true, result.message);
  return result.data;
}

try {
  await import("../database/init.js");
  db = (await import("../database/database.js")).default;
  const players = await import("../database/playerQueries.js");

  const dateValues = db.prepare(`
    SELECT
      CURRENT_DATE AS utc_date,
      DATE('now', 'localtime') AS local_date
  `).get();
  const nodeLocalDate = localCalendarDate();
  assert.equal(dateValues.local_date, nodeLocalDate);
  assert.match(dateValues.local_date, /^\d{4}-\d{2}-\d{2}$/);

  const registrationSchema = db.prepare("PRAGMA table_info(registered_players_today)").all();
  const lockSchema = db.prepare("PRAGMA table_info(player_team_locks)").all();
  const registeredDateDefault = registrationSchema.find((column) => column.name === "registered_date").dflt_value;
  const lockDateDefault = lockSchema.find((column) => column.name === "lock_date").dflt_value;
  const createdAtDefault = registrationSchema.find((column) => column.name === "created_at").dflt_value;
  assert.match(registeredDateDefault, /DATE\('now',\s*'localtime'\)/i);
  assert.match(lockDateDefault, /DATE\('now',\s*'localtime'\)/i);
  assert.match(createdAtDefault, /CURRENT_TIMESTAMP/i);
  const playerQueriesSource = readFileSync(
    new URL("../database/playerQueries.js", import.meta.url),
    "utf8",
  );
  assert.match(
    playerQueriesSource,
    /DATE\(end_time, 'localtime'\) = \(DATE\('now', 'localtime'\)\)/,
  );

  const firstId = expectSuccess(players.addPlayer(
    "Local Date First",
    "beginner",
    "male",
    "",
    true,
    false,
    false,
    false,
    "same_rank",
  )).id;
  const secondId = expectSuccess(players.addPlayer(
    "Local Date Second",
    "beginner",
    "female",
    "",
    false,
    true,
    false,
    false,
    "same_rank",
  )).id;

  // Verifies fresh-schema defaults when a date is omitted by an insert.
  const rawRegistrationId = Number(db.prepare(`
    INSERT INTO registered_players_today (player_id)
    VALUES (?)
  `).run(firstId).lastInsertRowid);
  assert.equal(
    db.prepare("SELECT registered_date FROM registered_players_today WHERE id = ?").get(rawRegistrationId).registered_date,
    dateValues.local_date,
  );
  const rawLockId = Number(db.prepare(`
    INSERT INTO player_team_locks (player_1_id, player_2_id)
    VALUES (?, ?)
  `).run(firstId, secondId).lastInsertRowid);
  assert.equal(
    db.prepare("SELECT lock_date FROM player_team_locks WHERE id = ?").get(rawLockId).lock_date,
    dateValues.local_date,
  );

  // A production registration writes the business date explicitly, protecting old databases.
  db.prepare("DELETE FROM registered_players_today WHERE id = ?").run(rawRegistrationId);
  const registration = expectSuccess(players.registerPlayer(firstId));
  const currentDaily = db.prepare(`
    SELECT id, player_id, registered_date, status, is_done_today
    FROM registered_players_today
    WHERE id = ?
  `).get(registration.registrationId);
  assert.deepEqual(
    [Number(currentDaily.player_id), currentDaily.registered_date, currentDaily.status, Number(currentDaily.is_done_today)],
    [firstId, dateValues.local_date, "available", 0],
  );
  assert.deepEqual(players.getRegisteredPlayersToday().map((player) => player.id), [firstId]);

  // Yesterday remains historical and does not block current-local-date registration.
  db.prepare(`
    INSERT INTO registered_players_today (
      player_id, status, is_done_today, registered_date
    ) VALUES (?, 'done', 1, DATE('now', 'localtime', '-1 day'))
  `).run(secondId);
  const secondRegistration = expectSuccess(players.registerPlayer(secondId));
  assert.equal(
    db.prepare("SELECT registered_date FROM registered_players_today WHERE id = ?").get(secondRegistration.registrationId).registered_date,
    dateValues.local_date,
  );
  assert.equal(players.getPlayerManagementData().data.todayPlayers.length, 2);

  // Individual and bulk Done use the same local date and leave yesterday untouched.
  expectSuccess(players.removeRegisteredPlayer(firstId));
  const bulkDone = expectSuccess(players.markAllRegisteredPlayersDone());
  assert.equal(bulkDone.markedDone, 1);
  const dates = db.prepare(`
    SELECT registered_date, is_done_today
    FROM registered_players_today
    WHERE player_id = ?
    ORDER BY id
  `).all(secondId);
  assert.deepEqual(dates.map((row) => [row.registered_date, Number(row.is_done_today)]), [
    [db.prepare("SELECT DATE('now', 'localtime', '-1 day') AS value").get().value, 1],
    [dateValues.local_date, 1],
  ]);

  // Deterministic local-time conversion at the Manila midnight boundary.
  const boundary = db.prepare(`
    SELECT
      DATE('2026-08-23 15:59:59', 'localtime') AS before_midnight,
      DATE('2026-08-23 16:00:00', 'localtime') AS at_midnight
  `).get();
  assert.deepEqual(boundary, {
    before_midnight: "2026-08-23",
    at_midnight: "2026-08-24",
  });

  assert.deepEqual(db.pragma("foreign_key_check"), []);
  assert.equal(db.pragma("integrity_check", { simple: true }), "ok");
  console.log("PLAYERS_LOCAL_DATE_SUMMARY", JSON.stringify({
    tests: 11,
    utcDate: dateValues.utc_date,
    sqliteLocalDate: dateValues.local_date,
    nodeLocalDate,
    registeredDateDefault,
    lockDateDefault,
    createdAtDefault,
    boundary,
  }));
} catch (error) {
  console.error(error);
  exitCode = 1;
} finally {
  if (db?.open) db.close();
  rmSync(testUserData, { recursive: true, force: true });
  app.exit(exitCode);
}
