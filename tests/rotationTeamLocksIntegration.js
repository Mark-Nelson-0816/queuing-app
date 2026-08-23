import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { app } from "electron";

app.disableHardwareAcceleration();
const testUserData = mkdtempSync(path.join(os.tmpdir(), "badminton-rotation-locks-"));
app.setPath("userData", testUserData);

let db;
let exitCode = 0;

function expectSuccess(result) {
  assert.equal(result.success, true, result.message);
  return result.data;
}

function expectFailure(result, message) {
  assert.equal(result.success, false);
  assert.match(result.message, message);
}

function teamIds(match) {
  return [match.teamA, match.teamB].map((team) => team.map((player) => Number(player.id)).sort((a, b) => a - b));
}

function containsTeam(match, ids) {
  const expected = [...ids].sort((a, b) => a - b);
  return teamIds(match).some((team) => JSON.stringify(team) === JSON.stringify(expected));
}

try {
  await import("../database/init.js");
  db = (await import("../database/database.js")).default;
  const players = await import("../database/playerQueries.js");
  const rotation = await import("../database/rotationQueries.js");
  const logic = await import("../database/rotationLogic.js");
  const { buildRotationSelectionStatus } = await import("../src/utils/rotationUi.js");

  let sequence = 0;
  function addDaily(name, gender, level = "intermediate", rankPreference = "same_rank", preferences = {}) {
    sequence += 1;
    const profile = expectSuccess(players.addPlayer(
      `${name} ${sequence}`,
      level,
      gender,
      "",
      preferences.mens ?? true,
      preferences.womens ?? true,
      preferences.mixed ?? true,
      preferences.noGender ?? true,
      rankPreference,
    ));
    expectSuccess(players.registerPlayer(profile.id));
    return profile.id;
  }

  function currentPlayers(ids) {
    const selected = new Set(ids);
    return expectSuccess(rotation.getRotationState()).players.filter((player) => selected.has(player.id));
  }

  // No lock is still the ordinary valid Doubles path.
  const unlocked = [addDaily("Unlinked A", "male"), addDaily("Unlinked B", "male"), addDaily("Unlinked C", "male"), addDaily("Unlinked D", "male")];
  const noLockResult = logic.generateRotationMatches({
    players: currentPlayers(unlocked), matchType: "doubles", category: "mens", locks: [], random: () => 0.5,
  });
  assert.equal(noLockResult.matches.length, 1);

  // One lock remains a team when paired against loose players; extra loose players stay unmatched.
  const oneLock = [addDaily("One Lock A", "male"), addDaily("One Lock B", "male"), addDaily("Loose A", "male"), addDaily("Loose B", "male"), addDaily("Loose Extra", "male")];
  const oneLockId = expectSuccess(rotation.createTeamLock(oneLock[0], oneLock[1], "doubles", "mens")).locks[0].id;
  db.prepare(`
    UPDATE registered_players_today
    SET match_count = CASE WHEN player_id = ? THEN 8 WHEN player_id = ? THEN 5 ELSE match_count END
    WHERE player_id IN (?, ?) AND registered_date = DATE('now', 'localtime')
  `).run(oneLock[0], oneLock[1], oneLock[0], oneLock[1]);
  const oneLockResult = expectSuccess(rotation.generateAndSaveRotationMatches(oneLock, "doubles", "mens"));
  assert.equal(oneLockResult.generatedCount, 1);
  assert.equal(oneLockResult.unmatchedPlayers.length, 1);
  const oneLockMatch = oneLockResult.matches.find((match) => match.players.some((player) => player.lockId === oneLockId));
  assert.equal(containsTeam(oneLockMatch, oneLock.slice(0, 2)), true);
  assert.equal(new Set(oneLockMatch.players.map((player) => player.id)).size, 4);
  expectSuccess(rotation.cancelWaitingMatch(oneLockMatch.id));
  expectSuccess(rotation.removeTeamLock(oneLockId));

  // Two independently locked teams play each other and do not duplicate a participant.
  const twoLocks = [addDaily("Two Lock A", "female"), addDaily("Two Lock B", "female"), addDaily("Two Lock C", "female"), addDaily("Two Lock D", "female")];
  const firstLockId = expectSuccess(rotation.createTeamLock(twoLocks[0], twoLocks[1], "doubles", "womens")).locks[0].id;
  const secondLockId = expectSuccess(rotation.createTeamLock(twoLocks[2], twoLocks[3], "doubles", "womens")).locks.find((lock) => lock.id !== firstLockId).id;
  const twoLockResult = expectSuccess(rotation.generateAndSaveRotationMatches(twoLocks, "doubles", "womens"));
  assert.equal(twoLockResult.generatedCount, 1);
  const twoLockMatch = twoLockResult.matches[0];
  assert.equal(containsTeam(twoLockMatch, twoLocks.slice(0, 2)), true);
  assert.equal(containsTeam(twoLockMatch, twoLocks.slice(2, 4)), true);
  assert.equal(new Set(twoLockMatch.players.map((player) => player.id)).size, 4);
  expectSuccess(rotation.cancelWaitingMatch(twoLockMatch.id));
  expectSuccess(rotation.removeTeamLock(firstLockId));
  expectSuccess(rotation.removeTeamLock(secondLockId));

  // Category validation is authoritative when creating a lock.
  const men = [addDaily("Mens A", "male"), addDaily("Mens B", "male")];
  assert.equal(expectSuccess(rotation.createTeamLock(...men, "doubles", "mens")).locks.length > 0, true);
  const women = [addDaily("Womens A", "female"), addDaily("Womens B", "female")];
  assert.equal(expectSuccess(rotation.createTeamLock(...women, "doubles", "womens")).locks.length > 0, true);
  const mixed = [addDaily("Mixed A", "male"), addDaily("Mixed B", "female")];
  assert.equal(expectSuccess(rotation.createTeamLock(...mixed, "doubles", "mixed")).locks.length > 0, true);
  const noGender = [addDaily("No Gender A", "male"), addDaily("No Gender B", "female")];
  assert.equal(expectSuccess(rotation.createTeamLock(...noGender, "doubles", "no_gender")).locks.length > 0, true);
  expectFailure(rotation.createTeamLock(men[0], women[0], "doubles", "mens"), /male players/);
  expectFailure(rotation.createTeamLock(women[0], men[0], "doubles", "womens"), /female players/);
  expectFailure(rotation.createTeamLock(men[1], men[0], "doubles", "mixed"), /one male and one female/);

  // Same Rank respects locks; adjacent rank supports a mutually adjacent locked pair.
  const strict = [addDaily("Strict A", "male", "beginner"), addDaily("Strict B", "male", "beginner"), addDaily("Strict C", "male", "beginner"), addDaily("Strict D", "male", "beginner")];
  const strictLock = expectSuccess(rotation.createTeamLock(strict[0], strict[1], "doubles", "mens")).locks.find((lock) => lock.player1Id === strict[0] || lock.player2Id === strict[0]);
  const strictResult = expectSuccess(rotation.generateAndSaveRotationMatches(strict, "doubles", "mens"));
  assert.equal(strictResult.generatedCount, 1);
  assert.equal(containsTeam(strictResult.matches[0], strict.slice(0, 2)), true);
  expectSuccess(rotation.cancelWaitingMatch(strictResult.matches[0].id));
  expectSuccess(rotation.removeTeamLock(strictLock.id));

  const adjacent = [
    addDaily("Adjacent A", "male", "beginner", "adjacent_rank"),
    addDaily("Adjacent B", "male", "intermediate", "adjacent_rank"),
    addDaily("Adjacent C", "male", "beginner", "adjacent_rank"),
    addDaily("Adjacent D", "male", "intermediate", "adjacent_rank"),
  ];
  const adjacentLock = expectSuccess(rotation.createTeamLock(adjacent[0], adjacent[1], "doubles", "mens")).locks.find((lock) => lock.player1Id === adjacent[0] || lock.player2Id === adjacent[0]);
  const adjacentResult = expectSuccess(rotation.generateAndSaveRotationMatches(adjacent, "doubles", "mens"));
  assert.equal(adjacentResult.generatedCount, 1);
  assert.equal(containsTeam(adjacentResult.matches[0], adjacent.slice(0, 2)), true);
  expectSuccess(rotation.cancelWaitingMatch(adjacentResult.matches[0].id));
  expectSuccess(rotation.removeTeamLock(adjacentLock.id));

  // Partial locks are blocked consistently by preview and backend, without persisted partial rows.
  const partial = [addDaily("Partial A", "male"), addDaily("Partial B", "male"), addDaily("Partial C", "male"), addDaily("Partial D", "male"), addDaily("Partial E", "male")];
  const partialLock = expectSuccess(rotation.createTeamLock(partial[0], partial[1], "doubles", "mens")).locks.find((lock) => lock.player1Id === partial[0] || lock.player2Id === partial[0]);
  const preview = buildRotationSelectionStatus({ selectedPlayers: currentPlayers([partial[0], partial[2], partial[3], partial[4]]), locks: [partialLock], matchType: "doubles", category: "mens" });
  assert.equal(preview.canGenerate, false);
  const beforePartialRows = db.prepare("SELECT COUNT(*) AS count FROM rotation_matches").get().count;
  const partialResult = expectSuccess(rotation.generateAndSaveRotationMatches([partial[0], partial[2], partial[3], partial[4]], "doubles", "mens"));
  assert.equal(partialResult.generatedCount, 0);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM rotation_matches").get().count, beforePartialRows);
  const duplicateResult = expectSuccess(rotation.generateAndSaveRotationMatches([...partial, partial[0]], "doubles", "mens"));
  assert.equal(duplicateResult.generatedCount, 1);
  assert.equal(new Set(duplicateResult.matches[0].players.map((player) => player.id)).size, 4);
  expectSuccess(rotation.cancelWaitingMatch(duplicateResult.matches[0].id));
  expectSuccess(rotation.removeTeamLock(partialLock.id));

  // Existing locks cannot be created or used when the member is unavailable.
  const unavailable = [addDaily("Unavailable A", "male"), addDaily("Unavailable B", "male")];
  db.prepare("UPDATE registered_players_today SET status = 'playing' WHERE player_id = ? AND registered_date = DATE('now', 'localtime')").run(unavailable[0]);
  expectFailure(rotation.createTeamLock(...unavailable, "doubles", "mens"), /available/);
  db.prepare("UPDATE registered_players_today SET status = 'done', is_done_today = 1 WHERE player_id = ? AND registered_date = DATE('now', 'localtime')").run(unavailable[0]);
  expectFailure(rotation.createTeamLock(...unavailable, "doubles", "mens"), /available/);
  const unregistered = expectSuccess(players.addPlayer("Unregistered Lock", "intermediate", "male", "", true, false, false, true, "same_rank")).id;
  expectFailure(rotation.createTeamLock(unregistered, unavailable[1], "doubles", "mens"), /registered today/);

  const lockedDone = [addDaily("Locked Done A", "male"), addDaily("Locked Done B", "male"), addDaily("Locked Done C", "male"), addDaily("Locked Done D", "male")];
  const lockedDoneId = expectSuccess(rotation.createTeamLock(lockedDone[0], lockedDone[1], "doubles", "mens")).locks.find((lock) => (
    lock.player1Id === lockedDone[0] || lock.player2Id === lockedDone[0]
  )).id;
  db.prepare(`
    UPDATE registered_players_today
    SET status = 'done', is_done_today = 1
    WHERE player_id = ? AND registered_date = DATE('now', 'localtime')
  `).run(lockedDone[0]);
  expectFailure(rotation.generateAndSaveRotationMatches(lockedDone, "doubles", "mens"), /done for today/);
  expectSuccess(rotation.removeTeamLock(lockedDoneId));

  // A persisted lock is protected during its actual Waiting -> Playing -> Finished lifecycle.
  const lifecycle = [addDaily("Lifecycle A", "male"), addDaily("Lifecycle B", "male"), addDaily("Lifecycle C", "male"), addDaily("Lifecycle D", "male")];
  const lifecycleLockId = expectSuccess(rotation.createTeamLock(lifecycle[0], lifecycle[1], "doubles", "mens")).locks.find((lock) => lock.player1Id === lifecycle[0] || lock.player2Id === lifecycle[0]).id;
  const lifecycleResult = expectSuccess(rotation.generateAndSaveRotationMatches(lifecycle, "doubles", "mens"));
  const lifecycleMatch = lifecycleResult.matches[0];
  const courtId = Number(db.prepare("INSERT INTO courts (name) VALUES ('Lock Test Court')").run().lastInsertRowid);
  expectSuccess(rotation.startRotationMatch(lifecycleMatch.id, courtId));
  expectFailure(rotation.removeTeamLock(lifecycleLockId), /while either player is playing/);
  expectSuccess(rotation.finishRotationMatch(lifecycleMatch.id, 1, []));
  expectSuccess(rotation.removeTeamLock(lifecycleLockId));

  assert.deepEqual(db.pragma("foreign_key_check"), []);
  assert.equal(db.pragma("integrity_check", { simple: true }), "ok");
  console.log("ROTATION_TEAM_LOCK_SUMMARY", JSON.stringify({ scenarios: 16 }));
} catch (error) {
  console.error(error);
  exitCode = 1;
} finally {
  if (db?.open) db.close();
  rmSync(testUserData, { recursive: true, force: true });
  app.exit(exitCode);
}
