import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { app } from "electron";

const testUserData = mkdtempSync(path.join(os.tmpdir(), "badminton-courts-"));
app.disableHardwareAcceleration();
app.setPath("userData", testUserData);

let db;

// Confirms APIs use the standard result envelope for expected failures.
function assertFailure(result, expression) {
  assert.equal(result.success, false);
  assert.match(result.error || result.message, expression);
}

// Confirms a Court action completed without requiring a renderer refresh.
function assertSuccess(result) {
  assert.equal(result.success, true, result.error || result.message);
  return result.data;
}

// Flattens the renderer-ready revised Tournament groups into match rows.
function getTournamentMatches(configuration) {
  return configuration.groups.flatMap((group) => (
    group.rounds.flatMap((round) => round.matches)
  ));
}

try {
  await import("../database/init.js");
  db = (await import("../database/database.js")).default;
  const { addCourt, getAvailableCourts, getCourts, removeCourt } = await import(
    "../database/courtQueries.js"
  );
  const rotation = await import("../database/rotationQueries.js");
  const {
    createTournamentEvent,
    deleteTournamentEvent,
    finishTournamentEvent,
    finishTournamentEventMatch,
    generateTournamentEventConfiguration,
    startTournamentEventMatch,
  } = await import("../database/tournamentQueries.js");

  // The empty view and both Court APIs remain safe when no rows exist.
  assert.deepEqual(getCourts(), []);
  assert.deepEqual(getAvailableCourts(), []);

  const courtPageSource = readFileSync(
    new URL("../src/pages/Courts.jsx", import.meta.url),
    "utf8",
  );
  const courtCardSource = readFileSync(
    new URL("../src/components/CourtCard.jsx", import.meta.url),
    "utf8",
  );
  assert.match(courtPageSource, /No courts have been added yet\./);
  assert.match(courtPageSource, /isAddingCourt/);
  assert.match(courtPageSource, /disabled=\{isAddingCourt\}/);
  assert.match(courtCardSource, /court\.activeMatch/);

  // Each preload Court method maps to a real main-process handler.
  const preloadSource = readFileSync(
    new URL("../electron/preload.cjs", import.meta.url),
    "utf8",
  );
  const mainSource = readFileSync(
    new URL("../electron/main.js", import.meta.url),
    "utf8",
  );
  const apiPairs = [
    ["getCourts", "get-courts"],
    ["getAvailableCourts", "get-available-courts"],
    ["addCourt", "add-court"],
    ["removeCourt", "remove-court"],
  ];
  for (const [api, channel] of apiPairs) {
    assert.match(preloadSource, new RegExp(`${api}:\\s*\\([^)]*\\)\\s*=>[\\s\\S]*?${channel}`));
    assert.match(mainSource, new RegExp(`ipcMain\\.handle\\([\\"']${channel}[\\"']`));
  }

  // UI and direct callers share trimming and controlled validation behavior.
  const firstCourt = assertSuccess(addCourt("  Court 1  ")).courtId;
  const firstCourtRow = db.prepare(`
    SELECT name, status, created_at
    FROM courts
    WHERE id = ?
  `).get(firstCourt);
  assert.equal(firstCourtRow.name, "Court 1");
  assert.equal(firstCourtRow.status, "available");
  assert.ok(firstCourtRow.created_at);
  const courtA = assertSuccess(addCourt("Court A")).courtId;
  const courtB = assertSuccess(addCourt("Main Court")).courtId;
  assertSuccess(addCourt("Court 10"));
  assertSuccess(addCourt("Court   With   Spaces"));
  assertSuccess(addCourt("court lower"));
  assertSuccess(addCourt("Court 日本語"));
  assertSuccess(addCourt("L".repeat(600)));
  assertFailure(addCourt(""), /required/i);
  assertFailure(addCourt("   "), /required/i);
  assertFailure(addCourt(null), /required/i);
  assertFailure(addCourt(42), /required/i);

  // The current schema intentionally permits duplicate names, including rapid adds.
  const duplicateFirst = assertSuccess(addCourt("Court Duplicate")).courtId;
  const duplicateSecond = assertSuccess(addCourt(" Court Duplicate ")).courtId;
  const rapidFirst = assertSuccess(addCourt("Rapid Court")).courtId;
  const rapidSecond = assertSuccess(addCourt("Rapid Court")).courtId;
  assert.notEqual(duplicateFirst, duplicateSecond);
  assert.notEqual(rapidFirst, rapidSecond);
  assert.equal(
    db.prepare("SELECT COUNT(*) AS count FROM courts WHERE name = 'Rapid Court'").get().count,
    2,
  );

  // Scale read tests preserve insertion order and valid default availability.
  for (let index = 1; index <= 92; index += 1) {
    assertSuccess(addCourt(`Scale Court ${String(index).padStart(3, "0")}`));
  }
  const retrieveStarted = performance.now();
  const allCourts = getCourts();
  const retrieveElapsed = performance.now() - retrieveStarted;
  assert.equal(allCourts.length, 104);
  assert.deepEqual(
    allCourts.map((court) => court.id),
    [...allCourts].sort((left, right) => left.id - right.id).map((court) => court.id),
  );
  assert.equal(allCourts.every((court) => court.status === "available"), true);
  assert.equal(getAvailableCourts().length, 104);
  console.log(`Court retrieval: 104 rows in ${retrieveElapsed.toFixed(2)}ms.`);

  // Invalid and repeated deletes cannot remove another Court or claim success.
  for (const invalidId of [0, -1, "not-an-id", null, undefined, 999999]) {
    assertFailure(removeCourt(invalidId), /not found/i);
  }
  const unusedCourt = assertSuccess(addCourt("Unused Court")).courtId;
  assert.equal(assertSuccess(removeCourt(unusedCourt)).courtId, unusedCourt);
  assert.equal(db.prepare("SELECT id FROM courts WHERE id = ?").get(unusedCourt), undefined);
  assertFailure(removeCourt(unusedCourt), /not found/i);

  // Idle legacy history is safely removed with its dependent match-player rows.
  const legacyPlayerA = Number(db.prepare(`
    INSERT INTO players (name, level, gender) VALUES ('Legacy Court A', 'beginner', 'male')
  `).run().lastInsertRowid);
  const legacyPlayerB = Number(db.prepare(`
    INSERT INTO players (name, level, gender) VALUES ('Legacy Court B', 'beginner', 'male')
  `).run().lastInsertRowid);
  const historicalCourt = assertSuccess(addCourt("Historical Court")).courtId;
  const historicalMatch = Number(db.prepare(`
    INSERT INTO matches (court_id, player_one, player_two, status)
    VALUES (?, ?, ?, 'finished')
  `).run(historicalCourt, legacyPlayerA, legacyPlayerB).lastInsertRowid);
  db.prepare(`
    INSERT INTO match_players (match_id, player_id, source) VALUES (?, ?, 'normal')
  `).run(historicalMatch, legacyPlayerA);
  assertSuccess(removeCourt(historicalCourt));
  assert.equal(db.prepare("SELECT id FROM matches WHERE id = ?").get(historicalMatch), undefined);
  assert.equal(db.prepare("SELECT id FROM match_players WHERE match_id = ?").get(historicalMatch), undefined);

  // An active legacy normal match must be protected, just like Rotation/Tournament.
  const normalCourt = assertSuccess(addCourt("Normal Active Court")).courtId;
  const normalMatch = Number(db.prepare(`
    INSERT INTO matches (court_id, player_one, player_two, status)
    VALUES (?, ?, ?, 'playing')
  `).run(normalCourt, legacyPlayerA, legacyPlayerB).lastInsertRowid);
  db.prepare("UPDATE courts SET status = 'playing' WHERE id = ?").run(normalCourt);
  const normalCourtData = getCourts().find((court) => court.id === normalCourt);
  assert.equal(normalCourtData.activeMatch?.source, "normal");
  assertFailure(removeCourt(normalCourt), /active normal match/i);
  assert.ok(db.prepare("SELECT id FROM matches WHERE id = ?").get(normalMatch));
  db.prepare("UPDATE matches SET status = 'finished' WHERE id = ?").run(normalMatch);
  db.prepare("UPDATE courts SET status = 'available' WHERE id = ?").run(normalCourt);
  assertSuccess(removeCourt(normalCourt));

  // A real Rotation lifecycle reserves and releases a court through its backend.
  const rotationPlayerInsert = db.prepare(`
    INSERT INTO players (
      name, level, gender, prefer_mens, prefer_womens, prefer_mixed, prefer_no_gender
    ) VALUES (?, 'beginner', 'male', 1, 1, 1, 1)
  `);
  const registerPlayer = db.prepare(`
    INSERT INTO registered_players_today (player_id, status, is_done_today)
    VALUES (?, 'available', 0)
  `);
  const rotationPlayerIds = ["Rotation A", "Rotation B", "Rotation C", "Rotation D"]
    .map((name) => Number(rotationPlayerInsert.run(name).lastInsertRowid));
  for (const playerId of rotationPlayerIds) registerPlayer.run(playerId);
  const generatedRotation = rotation.generateAndSaveRotationMatches(
    rotationPlayerIds,
    "singles",
    "no_gender",
  );
  assert.equal(generatedRotation.success, true, generatedRotation.message);
  const rotationWaiting = rotation.getRotationState().data.matches
    .filter((match) => match.status === "waiting");
  assert.equal(rotationWaiting.length, 2);
  assert.equal(rotation.startRotationMatch(rotationWaiting[0].id, courtA).success, true);
  assert.equal(getCourts().find((court) => court.id === courtA).status, "playing");
  assert.equal(getCourts().find((court) => court.id === courtA).activeMatch?.source, "rotation");
  assert.equal(getAvailableCourts().some((court) => court.id === courtA), false);
  assertFailure(removeCourt(courtA), /active rotation match/i);
  const staleRotationStart = rotation.startRotationMatch(rotationWaiting[1].id, courtA);
  assert.equal(staleRotationStart.success, false);
  assert.match(staleRotationStart.message, /no longer available/i);

  // A real revised Tournament lifecycle cannot take a Rotation-occupied court.
  const tournamentPlayerInsert = db.prepare(`
    INSERT INTO players (name, level, gender) VALUES (?, 'beginner', 'male')
  `);
  const tournamentPlayerIds = ["Tournament A", "Tournament B"]
    .map((name) => Number(tournamentPlayerInsert.run(name).lastInsertRowid));
  const firstEvent = createTournamentEvent("Court Integration Event", "2026-08-20", "2026-08-21");
  assert.equal(firstEvent.success, true, firstEvent.message);
  const firstConfiguration = generateTournamentEventConfiguration(
    firstEvent.data.tournament.id,
    tournamentPlayerIds,
    "adult",
    "singles",
    "mens",
    "beginner",
    () => 0.5,
  );
  assert.equal(firstConfiguration.success, true, firstConfiguration.message);
  const firstTournamentMatch = getTournamentMatches(firstConfiguration.data.configuration)[0];
  const tournamentAgainstRotation = startTournamentEventMatch(firstTournamentMatch.id, courtA);
  assert.equal(tournamentAgainstRotation.success, false);
  assert.match(tournamentAgainstRotation.message, /no longer available/i);
  assert.equal(startTournamentEventMatch(firstTournamentMatch.id, courtB).success, true);
  assert.equal(getCourts().find((court) => court.id === courtB).activeMatch?.source, "tournament");

  // The reverse stale-state check also rejects a Rotation start on a Tournament court.
  const rotationAgainstTournament = rotation.startRotationMatch(rotationWaiting[1].id, courtB);
  assert.equal(rotationAgainstTournament.success, false);
  assert.match(rotationAgainstTournament.message, /no longer available/i);
  assert.equal(rotation.finishRotationMatch(rotationWaiting[0].id, 1, []).success, true);
  assert.equal(getCourts().find((court) => court.id === courtA).status, "available");
  assert.equal(getCourts().find((court) => court.id === courtB).status, "playing");
  assert.equal(
    finishTournamentEventMatch(firstTournamentMatch.id, firstTournamentMatch.teamAId).success,
    true,
  );
  assert.equal(getCourts().find((court) => court.id === courtB).status, "available");
  assert.equal(finishTournamentEvent(firstEvent.data.tournament.id).success, true);

  // One revised event cannot double-book a court, and deletion releases a court.
  const extraTournamentPlayers = ["Tournament C", "Tournament D", "Tournament E"]
    .map((name) => Number(tournamentPlayerInsert.run(name).lastInsertRowid));
  const secondEvent = createTournamentEvent("Court Delete Event", "2026-08-22", "2026-08-23");
  assert.equal(secondEvent.success, true, secondEvent.message);
  const secondConfiguration = generateTournamentEventConfiguration(
    secondEvent.data.tournament.id,
    extraTournamentPlayers,
    "adult",
    "singles",
    "mens",
    "beginner",
    () => 0.5,
  );
  assert.equal(secondConfiguration.success, true, secondConfiguration.message);
  const secondTournamentMatches = getTournamentMatches(secondConfiguration.data.configuration);
  assert.equal(startTournamentEventMatch(secondTournamentMatches[0].id, courtB).success, true);
  const duplicateTournamentCourt = startTournamentEventMatch(secondTournamentMatches[1].id, courtB);
  assert.equal(duplicateTournamentCourt.success, false);
  assert.match(duplicateTournamentCourt.message, /no longer available/i);
  assertFailure(removeCourt(courtB), /active tournament match/i);
  assert.equal(deleteTournamentEvent(secondEvent.data.tournament.id).success, true);
  assert.equal(getCourts().find((court) => court.id === courtB).status, "available");

  // A separate SQLite connection sees persisted playing-court state immediately.
  const restartCourt = assertSuccess(addCourt("Restart Court")).courtId;
  const restartMatch = Number(db.prepare(`
    INSERT INTO matches (court_id, player_one, player_two, status)
    VALUES (?, ?, ?, 'playing')
  `).run(restartCourt, legacyPlayerA, legacyPlayerB).lastInsertRowid);
  db.prepare("UPDATE courts SET status = 'playing' WHERE id = ?").run(restartCourt);
  const persistedDb = new Database(path.join(testUserData, "badminton.db"), { readonly: true });
  assert.equal(
    persistedDb.prepare("SELECT status FROM courts WHERE id = ?").get(restartCourt).status,
    "playing",
  );
  assert.ok(persistedDb.prepare(`
    SELECT id FROM matches WHERE court_id = ? AND status = 'playing'
  `).get(restartCourt));
  persistedDb.close();
  db.prepare("UPDATE matches SET status = 'finished' WHERE id = ?").run(restartMatch);
  db.prepare("UPDATE courts SET status = 'available' WHERE id = ?").run(restartCourt);

  // Lifecycle operations leave every active court source-safe and internally consistent.
  const foreignKeys = db.pragma("foreign_key_check");
  const integrity = db.pragma("integrity_check", { simple: true });
  const duplicateActiveCourts = db.prepare(`
    SELECT court_id
    FROM (
      SELECT court_id FROM matches WHERE status = 'playing' AND court_id IS NOT NULL
      UNION ALL
      SELECT court_id FROM rotation_matches WHERE status = 'playing' AND court_id IS NOT NULL
      UNION ALL
      SELECT court_id FROM tournament_matches WHERE status = 'playing' AND court_id IS NOT NULL
    )
    GROUP BY court_id
    HAVING COUNT(*) > 1
  `).all();
  const activeWithAvailableCourt = db.prepare(`
    SELECT active.court_id
    FROM (
      SELECT court_id FROM matches WHERE status = 'playing' AND court_id IS NOT NULL
      UNION ALL
      SELECT court_id FROM rotation_matches WHERE status = 'playing' AND court_id IS NOT NULL
      UNION ALL
      SELECT court_id FROM tournament_matches WHERE status = 'playing' AND court_id IS NOT NULL
    ) AS active
    JOIN courts ON courts.id = active.court_id
    WHERE courts.status = 'available'
  `).all();
  assert.deepEqual(foreignKeys, []);
  assert.equal(integrity, "ok");
  assert.deepEqual(duplicateActiveCourts, []);
  assert.deepEqual(activeWithAvailableCourt, []);

  console.log("Court integration tests passed.");
} finally {
  db?.close();
  rmSync(testUserData, { recursive: true, force: true });
  app.quit();
}
