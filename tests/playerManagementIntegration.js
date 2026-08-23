import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { app } from "electron";

app.disableHardwareAcceleration();
const testUserData = mkdtempSync(path.join(os.tmpdir(), "badminton-player-management-test-"));
app.setPath("userData", testUserData);

let db;

// Confirms an operation failed with the expected message.
function expectFailure(result, expression) {
  assert.equal(result.success, false);
  assert.match(result.message, expression);
}

try {
  await import("../database/init.js");
  db = (await import("../database/database.js")).default;
  const players = await import("../database/playerQueries.js");

  expectFailure(players.addPlayer(
    "",
    "beginner",
    "male",
    "",
    true,
    false,
    false,
    false,
    "same_rank",
  ), /name is required/i);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM players").get().count, 0);

  const first = players.addPlayer(
    "Alex Cruz",
    "Upper Intermediate",
    "Male",
    "09170000001",
    true,
    false,
    true,
    true,
    "adjacent_rank",
  );
  assert.equal(first.success, true);
  assert.equal(typeof first.data.id, "number");

  expectFailure(players.addPlayer(
    "  alex cruz ",
    "beginner",
    "male",
    "",
    true,
    false,
    false,
    false,
    "same_rank",
  ), /already exists/i);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM players").get().count, 1);

  const second = players.addPlayer(
    "Bea Santos",
    "beginner",
    "female",
    "",
    false,
    true,
    true,
    false,
    "same_rank",
  );
  assert.equal(second.success, true);

  let management = players.getPlayerManagementData();
  assert.equal(management.success, true);
  assert.equal(management.data.summary.totalProfiles, 2);
  assert.equal(management.data.profiles[0].level, "upper_intermediate");
  assert.equal(management.data.profiles[0].rankPreference, "adjacent_rank");

  const registration = players.registerPlayer(first.data.id);
  assert.equal(registration.success, true);
  assert.equal(registration.data.action, "registered");
  expectFailure(players.registerPlayer(first.data.id), /already registered/i);
  assert.equal(
    db.prepare("SELECT COUNT(*) AS count FROM registered_players_today WHERE player_id = ?").get(first.data.id).count,
    1,
  );

  management = players.getPlayerManagementData();
  assert.equal(management.data.summary.registeredToday, 1);
  assert.equal(management.data.summary.availableToday, 1);
  assert.equal(management.data.todayPlayers[0].status, "available");
  assert.equal(management.data.todayPlayers[0].preferMens, true);
  assert.equal(management.data.todayPlayers[0].preferWomens, false);
  assert.equal(management.data.todayPlayers[0].preferMixed, true);
  assert.equal(management.data.todayPlayers[0].preferNoGender, true);

  const markedDone = players.removeRegisteredPlayer(first.data.id);
  assert.equal(markedDone.success, true);
  management = players.getPlayerManagementData();
  assert.equal(management.data.summary.activeToday, 0);
  assert.equal(management.data.summary.doneToday, 1);
  assert.equal(management.data.todayPlayers[0].status, "done");
  assert.equal(players.getRegisteredPlayersToday().length, 0);

  const reactivated = players.registerPlayer(first.data.id);
  assert.equal(reactivated.success, true);
  assert.equal(reactivated.data.action, "reactivated");
  assert.equal(reactivated.data.registrationId, registration.data.registrationId);
  assert.equal(players.getRegisteredPlayersToday().length, 1);

  const updated = players.updatePlayerInfo(
    first.data.id,
    "Alex C. Cruz",
    "advanced",
    "male",
    "09179999999",
    false,
    false,
    true,
    true,
    "same_rank",
  );
  assert.equal(updated.success, true);
  const updatedRow = db.prepare("SELECT * FROM players WHERE id = ?").get(first.data.id);
  assert.equal(updatedRow.name, "Alex C. Cruz");
  assert.equal(updatedRow.rank_match_preference, "same_rank");
  assert.equal(updatedRow.prefer_mens, 0);
  assert.equal(updatedRow.prefer_mixed, 1);
  assert.equal(updatedRow.contact_number, "09179999999");

  db.prepare(`
    UPDATE players
    SET total_matches_played = 8, total_wins = 5, total_losses = 3
    WHERE id = ?
  `).run(first.data.id);
  db.prepare(`
    UPDATE registered_players_today
    SET match_count = 3, wins = 2, losses = 1
    WHERE player_id = ? AND registered_date = DATE('now', 'localtime')
  `).run(first.data.id);

  const waitingMatch = db.prepare(`
    INSERT INTO rotation_matches (
      queue_position, match_type, category, status
    ) VALUES (1, 'singles', 'no_gender', 'waiting')
  `).run();
  db.prepare(`
    INSERT INTO rotation_match_players (
      rotation_match_id, registered_player_id, player_id, team, slot
    ) VALUES (?, ?, ?, 1, 1)
  `).run(waitingMatch.lastInsertRowid, registration.data.registrationId, first.data.id);

  management = players.getPlayerManagementData();
  const assignedPlayer = management.data.todayPlayers.find((player) => player.id === first.data.id);
  assert.equal(assignedPlayer.status, "assigned");
  assert.equal(assignedPlayer.matchesToday, 3);
  assert.equal(assignedPlayer.winsToday, 2);
  assert.equal(assignedPlayer.lossesToday, 1);
  expectFailure(players.removeRegisteredPlayer(first.data.id), /waiting match/i);

  db.prepare(`
    UPDATE rotation_matches
    SET status = 'finished', end_time = CURRENT_TIMESTAMP, queue_position = NULL
    WHERE id = ?
  `).run(waitingMatch.lastInsertRowid);
  management = players.getPlayerManagementData();
  assert.equal(management.data.summary.completedRotationMatchesToday, 1);
  assert.equal(management.data.profiles.find((player) => player.id === first.data.id).lifetimeMatches, 8);

  expectFailure(players.deletePlayerProfile(first.data.id), /mark this player done/i);
  assert.equal(players.removeRegisteredPlayer(first.data.id).success, true);
  expectFailure(players.deletePlayerProfile(first.data.id), /history/i);

  const disposable = players.addPlayer(
    "Disposable Profile",
    "intermediate",
    "female",
    "",
    false,
    true,
    false,
    false,
    "same_rank",
  );
  assert.equal(disposable.success, true);
  assert.equal(players.deletePlayerProfile(disposable.data.id).success, true);
  assert.equal(db.prepare("SELECT 1 FROM players WHERE id = ?").get(disposable.data.id), undefined);

  db.prepare(`
    INSERT INTO registered_players_today (
      player_id, status, is_done_today, registered_date
    ) VALUES (?, 'done', 1, DATE('now', 'localtime', '-1 day'))
  `).run(second.data.id);
  management = players.getPlayerManagementData();
  assert.equal(management.data.summary.registeredToday, 1);
  assert.equal(management.data.profiles.find((player) => player.id === second.data.id).todayRegistration, null);

  assert.equal(db.pragma("foreign_key_check").length, 0);
  assert.equal(db.pragma("integrity_check", { simple: true }), "ok");
  console.log("Player Management integration checks passed.");
} finally {
  if (db) db.close();
  rmSync(testUserData, { recursive: true, force: true });
}

app.exit(0);
