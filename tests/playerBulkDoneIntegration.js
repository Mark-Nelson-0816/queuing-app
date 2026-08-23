import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { app } from "electron";

app.disableHardwareAcceleration();
const testUserData = mkdtempSync(path.join(os.tmpdir(), "badminton-bulk-done-test-"));
app.setPath("userData", testUserData);

let db;

try {
  await import("../database/init.js");
  db = (await import("../database/database.js")).default;
  const players = await import("../database/playerQueries.js");

  const playerIds = [];
  for (let index = 0; index < 6; index += 1) {
    const result = players.addPlayer(
      `Bulk Player ${index + 1}`,
      "beginner",
      index % 2 ? "female" : "male",
      "",
      true,
      true,
      true,
      true,
      "same_rank",
    );
    assert.equal(result.success, true);
    playerIds.push(result.data.id);
    assert.equal(players.registerPlayer(result.data.id).success, true);
  }

  const registrationByPlayerId = new Map(db.prepare(`
    SELECT id, player_id
    FROM registered_players_today
    WHERE registered_date = DATE('now', 'localtime')
  `).all().map((row) => [Number(row.player_id), Number(row.id)]));
  const insertMatch = db.prepare(`
    INSERT INTO rotation_matches (
      queue_position, match_type, category, status, created_at, updated_at
    ) VALUES (?, 'singles', 'no_gender', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
  `);
  const insertParticipant = db.prepare(`
    INSERT INTO rotation_match_players (
      rotation_match_id, registered_player_id, player_id, team, slot
    ) VALUES (?, ?, ?, ?, 1)
  `);

  const waitingMatchId = Number(insertMatch.run(1, "waiting").lastInsertRowid);
  insertParticipant.run(waitingMatchId, registrationByPlayerId.get(playerIds[2]), playerIds[2], 1);
  insertParticipant.run(waitingMatchId, registrationByPlayerId.get(playerIds[3]), playerIds[3], 2);
  const playingMatchId = Number(insertMatch.run(null, "playing").lastInsertRowid);
  insertParticipant.run(playingMatchId, registrationByPlayerId.get(playerIds[4]), playerIds[4], 1);
  insertParticipant.run(playingMatchId, registrationByPlayerId.get(playerIds[5]), playerIds[5], 2);

  const beforeRows = db.prepare(`
    SELECT player_id, match_count, wins, losses
    FROM registered_players_today
    ORDER BY player_id
  `).all();
  const result = players.markAllRegisteredPlayersDone();
  assert.equal(result.success, true);
  assert.equal(result.data.markedDone, 2);
  assert.equal(result.data.skipped, 4);
  assert.deepEqual(
    result.data.skippedPlayers.map((player) => player.reason).sort(),
    ["assigned", "assigned", "playing", "playing"],
  );

  const registrations = db.prepare(`
    SELECT player_id, status, is_done_today, match_count, wins, losses
    FROM registered_players_today
    ORDER BY player_id
  `).all();
  assert.deepEqual(
    registrations.map((row) => Number(row.is_done_today)),
    [1, 1, 0, 0, 0, 0],
  );
  assert.deepEqual(
    registrations.map((row) => [row.match_count, row.wins, row.losses]),
    beforeRows.map((row) => [row.match_count, row.wins, row.losses]),
  );
  assert.equal(db.prepare("SELECT status FROM rotation_matches WHERE id = ?").get(waitingMatchId).status, "waiting");
  assert.equal(db.prepare("SELECT status FROM rotation_matches WHERE id = ?").get(playingMatchId).status, "playing");

  const repeated = players.markAllRegisteredPlayersDone();
  assert.equal(repeated.success, true);
  assert.equal(repeated.data.markedDone, 0);
  assert.equal(repeated.data.skipped, 4);

  console.log("Player bulk mark-done integration checks passed.");
} catch (error) {
  console.error(error);
  if (db?.open) db.close();
  rmSync(testUserData, { recursive: true, force: true });
  app.exit(1);
}

if (db?.open) db.close();
rmSync(testUserData, { recursive: true, force: true });
app.quit();
