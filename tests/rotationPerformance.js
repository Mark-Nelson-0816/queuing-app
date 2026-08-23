import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { app } from "electron";

const testUserData = mkdtempSync(path.join(os.tmpdir(), "badminton-rotation-performance-"));
app.setPath("userData", testUserData);

let db;

// Creates an even mixed-doubles player pool with one shared rank.
function seedPlayers(count) {
  const insertPlayer = db.prepare(`
    INSERT INTO players (
      name,
      level,
      gender,
      prefer_mixed,
      prefer_no_gender,
      rank_match_preference
    ) VALUES (?, 'intermediate', ?, 1, 1, 'same_rank')
  `);
  const registerPlayer = db.prepare(`
    INSERT INTO registered_players_today (
      player_id,
      status,
      registered_date,
      available_since
    ) VALUES (?, 'available', DATE('now', 'localtime'), datetime('now', ?))
  `);
  const insertAll = db.transaction(() => {
    const playerIds = [];
    for (let index = 0; index < count; index += 1) {
      const result = insertPlayer.run(
        `Performance Player ${index + 1}`,
        index % 2 === 0 ? "male" : "female",
      );
      const playerId = Number(result.lastInsertRowid);
      playerIds.push(playerId);
      registerPlayer.run(playerId, `-${count - index} minutes`);
    }
    return playerIds;
  });
  return insertAll();
}

// Clears the isolated fixture between scale measurements.
function clearFixture() {
  db.exec(`
    DELETE FROM rotation_match_players;
    DELETE FROM rotation_matches;
    DELETE FROM player_team_locks;
    DELETE FROM registered_players_today;
    DELETE FROM players;
  `);
}

try {
  await import("../database/init.js");
  db = (await import("../database/database.js")).default;
  const { generateRotationMatches } = await import("../database/rotationLogic.js");
  const {
    generateAndSaveRotationMatches,
    getRotationState,
  } = await import("../database/rotationQueries.js");

  const measurements = [];
  for (const playerCount of [8, 16, 40, 80, 200]) {
    clearFixture();
    const playerIds = seedPlayers(playerCount);
    const selectedPlayers = getRotationState().data.players;

    const solverStartedAt = performance.now();
    const generated = generateRotationMatches({
      players: selectedPlayers,
      matchType: "doubles",
      category: "mixed",
      random: () => 0.5,
    });
    const solverMs = performance.now() - solverStartedAt;

    const totalStartedAt = performance.now();
    const saved = generateAndSaveRotationMatches(
      playerIds,
      "doubles",
      "mixed",
    );
    const totalMs = performance.now() - totalStartedAt;

    assert.equal(saved.success, true, saved.message);
    assert.equal(generated.matches.length, playerCount / 4);
    assert.equal(saved.data.generatedCount, playerCount / 4);
    assert.equal(saved.data.matches.length, playerCount / 4);
    assert.equal(saved.data.unmatchedPlayers.length, 0);
    measurements.push({
      players: playerCount,
      matches: saved.data.generatedCount,
      solverMs: Number(solverMs.toFixed(3)),
      totalMs: Number(totalMs.toFixed(3)),
    });
  }

  clearFixture();
  const impossiblePlayerIds = seedPlayers(80);
  db.prepare(`
    UPDATE players
    SET gender = 'male'
    WHERE id IN (${impossiblePlayerIds.slice(1).map(() => "?").join(", ")})
  `).run(...impossiblePlayerIds.slice(1));
  const impossibleStartedAt = performance.now();
  const impossible = generateAndSaveRotationMatches(
    impossiblePlayerIds,
    "doubles",
    "mixed",
  );
  const impossibleMs = performance.now() - impossibleStartedAt;
  assert.equal(impossible.success, true, impossible.message);
  assert.equal(impossible.data.generatedCount, 0);
  assert.equal(impossible.data.unmatchedPlayers.length, 80);

  console.table(measurements);
  console.log(`Impossible 79-male/1-female selection: ${impossibleMs.toFixed(3)} ms`);
  console.log("Rotation performance tests passed.");
} catch (error) {
  console.error(error);
  if (db?.open) db.close();
  rmSync(testUserData, { recursive: true, force: true });
  app.exit(1);
}

if (db?.open) db.close();
rmSync(testUserData, { recursive: true, force: true });
app.quit();
