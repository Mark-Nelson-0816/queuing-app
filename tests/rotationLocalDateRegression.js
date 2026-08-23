import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { app } from "electron";

app.disableHardwareAcceleration();
const testUserData = mkdtempSync(path.join(os.tmpdir(), "badminton-rotation-local-date-"));
app.setPath("userData", testUserData);

let db;
let exitCode = 0;

function expectSuccess(result) {
  assert.equal(result.success, true, result.message);
  return result.data;
}

try {
  await import("../database/init.js");
  db = (await import("../database/database.js")).default;
  const players = await import("../database/playerQueries.js");
  const rotation = await import("../database/rotationQueries.js");

  // Rotation runtime queries must use the application's local business day.
  const rotationSource = readFileSync(
    new URL("../database/rotationQueries.js", import.meta.url),
    "utf8",
  );
  assert.match(
    rotationSource,
    /registered_players_today\.registered_date = \(DATE\('now', 'localtime'\)\)/,
  );
  assert.match(
    rotationSource,
    /DATE\(COALESCE\(rotation_matches\.end_time, rotation_matches\.created_at\), 'localtime'\) = \(DATE\('now', 'localtime'\)\)/,
  );

  const localDate = db.prepare("SELECT DATE('now', 'localtime') AS value").get().value;
  const yesterday = db.prepare("SELECT DATE('now', 'localtime', '-1 day') AS value").get().value;
  const boundary = db.prepare(`
    SELECT
      DATE('2026-08-23 15:59:59', 'localtime') AS before_midnight,
      DATE('2026-08-23 16:00:00', 'localtime') AS at_midnight
  `).get();
  assert.deepEqual(boundary, {
    before_midnight: "2026-08-23",
    at_midnight: "2026-08-24",
  });

  const firstId = expectSuccess(players.addPlayer(
    "Rotation Local First", "beginner", "male", "", true, false, false, true, "same_rank",
  )).id;
  const secondId = expectSuccess(players.addPlayer(
    "Rotation Local Second", "beginner", "male", "", true, false, false, true, "same_rank",
  )).id;
  const priorDayId = expectSuccess(players.addPlayer(
    "Rotation Prior Day", "beginner", "male", "", true, false, false, true, "same_rank",
  )).id;

  expectSuccess(players.registerPlayer(firstId));
  expectSuccess(players.registerPlayer(secondId));
  db.prepare(`
    INSERT INTO registered_players_today (
      player_id, status, is_done_today, match_count, registered_date, available_since
    ) VALUES (?, 'available', 0, 5, ?, datetime('now', '-1 day'))
  `).run(priorDayId, yesterday);

  // Only local-today registrations are returned to Rotation, with their stored daily count.
  const initialState = expectSuccess(rotation.getRotationState());
  assert.deepEqual(initialState.players.map((player) => player.id).sort((a, b) => a - b), [firstId, secondId]);
  assert.deepEqual(initialState.players.map((player) => player.matchCount), [0, 0]);

  // Finishing a real Rotation match updates current-day counters, never the prior-day row.
  const generated = expectSuccess(rotation.generateAndSaveRotationMatches(
    [firstId, secondId], "singles", "mens",
  ));
  const matchId = generated.matches[0].id;
  const courtId = Number(db.prepare("INSERT INTO courts (name) VALUES ('Rotation Date Court')").run().lastInsertRowid);
  expectSuccess(rotation.startRotationMatch(matchId, courtId));
  expectSuccess(rotation.finishRotationMatch(matchId, 1, []));

  const finishedState = expectSuccess(rotation.getRotationState());
  assert.deepEqual(
    finishedState.players.map((player) => [player.id, player.matchCount]).sort((a, b) => a[0] - b[0]),
    [[firstId, 1], [secondId, 1]],
  );
  assert.equal(
    db.prepare(`
      SELECT match_count
      FROM registered_players_today
      WHERE player_id = ? AND registered_date = ?
    `).get(priorDayId, yesterday).match_count,
    5,
  );

  assert.deepEqual(db.pragma("foreign_key_check"), []);
  assert.equal(db.pragma("integrity_check", { simple: true }), "ok");
  console.log("ROTATION_LOCAL_DATE_SUMMARY", JSON.stringify({
    tests: 10,
    localDate,
    yesterday,
    boundary,
    finishedDailyCounts: [1, 1],
  }));
} catch (error) {
  console.error(error);
  exitCode = 1;
} finally {
  if (db?.open) db.close();
  rmSync(testUserData, { recursive: true, force: true });
  app.exit(exitCode);
}
