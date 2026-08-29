import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { app } from "electron";

const testUserData = mkdtempSync(path.join(os.tmpdir(), "badminton-public-display-"));
app.disableHardwareAcceleration();
app.setPath("userData", testUserData);

let db;

// Returns one successful result payload and reports useful errors on failure.
function assertSuccess(result) {
  assert.equal(result.success, true, result.message || result.error);
  return result.data;
}

// Flattens one renderer-ready revised Tournament configuration into match rows.
function getTournamentMatches(configuration) {
  return configuration.groups.flatMap((group) => (
    group.rounds.flatMap((round) => round.matches)
  ));
}

// Returns the public screen's active-court subset from the authoritative query.
function getActivePublicCourts(getCourts) {
  return getCourts().filter((court) => (
    court.status === "playing" && court.activeMatch
  ));
}

// Checks source, teams, and ordered participant data on a displayed Court.
function assertDisplayedCourt(getCourts, courtId, source, matchType, expectedTeamA, expectedTeamB) {
  const court = getCourts().find((entry) => entry.id === courtId);
  assert.ok(court, `Court ${courtId} should be returned.`);
  assert.equal(court.status, "playing");
  assert.equal(court.activeMatch?.source, source);
  assert.equal(court.activeMatch?.matchType, matchType);
  assert.deepEqual(court.activeMatch.teamA.players.map((player) => player.id), expectedTeamA);
  assert.deepEqual(court.activeMatch.teamB.players.map((player) => player.id), expectedTeamB);
  const players = court.activeMatch.players.map((player) => player.id);
  assert.equal(new Set(players).size, players.length, "Displayed players must not duplicate.");
  return court;
}

try {
  await import("../database/init.js");
  db = (await import("../database/database.js")).default;
  const { addCourt, getCourts } = await import("../database/courtQueries.js");
  const rotation = await import("../database/rotationQueries.js");
  const {
    createTournamentEvent,
    deleteTournamentEvent,
    generateTournamentEventConfiguration,
    resetTournamentEventConfiguration,
    startTournamentEventMatch,
  } = await import("../database/tournamentQueries.js");
  const { getLevelTextClasses } = await import("../src/utils/playerLevel.js");

  const pageSource = readFileSync(
    new URL("../src/pages/PublicDisplayPage.jsx", import.meta.url),
    "utf8",
  );
  const displaySource = readFileSync(
    new URL("../src/components/PublicDisplay.jsx", import.meta.url),
    "utf8",
  );
  const appSource = readFileSync(new URL("../src/App.jsx", import.meta.url), "utf8");
  const preloadSource = readFileSync(
    new URL("../electron/preload.cjs", import.meta.url),
    "utf8",
  );
  const mainSource = readFileSync(new URL("../electron/main.js", import.meta.url), "utf8");

  // Public Display starts safely with no records and contains no mutation action.
  assert.deepEqual(getCourts(), []);
  assert.deepEqual(rotation.getRotationNextUpMatches().data.matches, []);
  assert.match(displaySource, /No active matches/);
  assert.match(displaySource, /Queue is empty/);
  assert.match(displaySource, /queueNext\.slice\(0, 6\)/);
  assert.doesNotMatch(pageSource, /startRotationMatch|finishRotationMatch|startTournamentMatch|finishTournamentMatch/);
  assert.match(appSource, /if \(activePage === "public"\)\s*\{\s*return <PublicDisplayPage \/>;\s*\}/);

  // Public refresh uses the two intended read-only IPC APIs and cleans up polling.
  const displayApiPairs = [
    ["getCourts", "get-courts"],
    ["getRotationNextUpMatches", "get-rotation-next-up-matches"],
  ];
  for (const [api, channel] of displayApiPairs) {
    assert.match(pageSource, new RegExp(`window\\.api\\.${api}`));
    assert.match(preloadSource, new RegExp(`${api}:\\s*\\([^)]*\\)\\s*=>[\\s\\S]*?${channel}`));
    assert.match(mainSource, new RegExp(`ipcMain\\.handle\\([\\"']${channel}[\\"']`));
  }
  assert.match(pageSource, /Promise\.allSettled/);
  assert.match(pageSource, /refreshInFlightRef\.current/);
  assert.match(pageSource, /Array\.isArray\(queueMatches\)/);
  assert.match(pageSource, /setInterval\(refreshData, 10000\)/);
  assert.match(pageSource, /clearInterval\(interval\)/);
  assert.match(pageSource, /setCourts\(\[\]\);\s*setCourtError\("Unable to load court information\."\)/);

  // Add scale data and verify the public Court order remains stable by ID.
  const courtIds = [];
  const retrievalTimings = new Map();
  for (let index = 1; index <= 100; index += 1) {
    const courtId = assertSuccess(addCourt(`Court ${index}`)).courtId;
    courtIds.push(courtId);
    if ([5, 10, 25, 100].includes(index)) {
      const started = performance.now();
      const courts = getCourts();
      retrievalTimings.set(index, performance.now() - started);
      assert.equal(courts.length, index);
      assert.deepEqual(courts.map((court) => court.id), courtIds);
      assert.equal(courts.every((court) => court.status === "available"), true);
    }
  }

  const insertRotationPlayer = db.prepare(`
    INSERT INTO players (
      name, level, gender, prefer_mens, prefer_womens, prefer_mixed, prefer_no_gender
    ) VALUES (?, ?, ?, 1, 1, 1, 1)
  `);
  const registerRotationPlayer = db.prepare(`
    INSERT INTO registered_players_today (player_id, status, is_done_today)
    VALUES (?, 'available', 0)
  `);
  const rotationPlayerIds = new Map();
  const seedRotationPlayers = (prefix, players, level = "beginner") => players.map((player) => {
    const id = Number(insertRotationPlayer.run(`${prefix} ${player.name}`, level, player.gender).lastInsertRowid);
    registerRotationPlayer.run(id);
    rotationPlayerIds.set(`${prefix} ${player.name}`, id);
    return id;
  });
  const createRotationMatch = (prefix, players, matchType, category, courtId, lockPair = null) => {
    const ids = seedRotationPlayers(prefix, players);
    if (lockPair) {
      assert.equal(
        rotation.createTeamLock(ids[lockPair[0]], ids[lockPair[1]], matchType, category).success,
        true,
      );
    }
    const generated = rotation.generateAndSaveRotationMatches(ids, matchType, category);
    assert.equal(generated.success, true, generated.message);
    const match = generated.data.matches.find((entry) => (
      entry.status === "waiting" && entry.players.every((player) => ids.includes(player.id))
    ));
    assert.ok(match, `${prefix} should create one waiting Rotation match.`);
    assert.equal(rotation.startRotationMatch(match.id, courtId).success, true);
    return { ids, matchId: match.id };
  };

  // Real Rotation lifecycles cover Singles, every displayed category, and locked teams.
  const rotationSingles = createRotationMatch(
    "Rot Single",
    [{ name: "O'Neil", gender: "male" }, { name: "Zoë", gender: "female" }],
    "singles",
    "no_gender",
    courtIds[0],
  );
  const rotationMens = createRotationMatch(
    "Rot Men",
    [{ name: "A", gender: "male" }, { name: "B", gender: "male" }, { name: "C", gender: "male" }, { name: "D", gender: "male" }],
    "doubles",
    "mens",
    courtIds[1],
    [0, 1],
  );
  const rotationWomens = createRotationMatch(
    "Rot Women",
    [{ name: "A", gender: "female" }, { name: "B", gender: "female" }, { name: "C", gender: "female" }, { name: "D", gender: "female" }],
    "doubles",
    "womens",
    courtIds[2],
  );
  const rotationMixed = createRotationMatch(
    "Rot Mixed",
    [{ name: "A", gender: "male" }, { name: "B", gender: "female" }, { name: "C", gender: "male" }, { name: "D", gender: "female" }],
    "doubles",
    "mixed",
    courtIds[3],
  );
  const rotationNoGender = createRotationMatch(
    "Rot Any",
    [{ name: "A", gender: "male" }, { name: "B", gender: "female" }, { name: "C", gender: "male" }, { name: "D", gender: "female" }],
    "doubles",
    "no_gender",
    courtIds[4],
  );

  const rotationCourt = getCourts().find((court) => court.id === courtIds[1]);
  assert.equal(rotationCourt.activeMatch.source, "rotation");
  assert.equal(rotationCourt.activeMatch.category, "mens");
  assert.deepEqual(
    rotationCourt.activeMatch.teamA.players.map((player) => player.id),
      rotation.getRotationState().data.matches.find((match) => match.id === rotationMens.matchId).teamA.map((player) => player.id),
  );
  assert.equal(
    [rotationCourt.activeMatch.teamA.players, rotationCourt.activeMatch.teamB.players]
      .some((team) => (
        team.some((player) => player.id === rotationMens.ids[0])
        && team.some((player) => player.id === rotationMens.ids[1])
      )),
    true,
  );
  for (const [entry, courtId, type] of [
    [rotationSingles, courtIds[0], "singles"],
    [rotationMens, courtIds[1], "doubles"],
    [rotationWomens, courtIds[2], "doubles"],
    [rotationMixed, courtIds[3], "doubles"],
    [rotationNoGender, courtIds[4], "doubles"],
  ]) {
    const match = rotation.getRotationState().data.matches.find((candidate) => candidate.id === entry.matchId);
    assertDisplayedCourt(
      getCourts,
      courtId,
      "rotation",
      type,
      match.teamA.map((player) => player.id),
      match.teamB.map((player) => player.id),
    );
  }

  // A real revised Tournament event supplies every division/category and mixed
  // profile levels for minor divisions to the public Court mapping.
  const insertTournamentPlayer = db.prepare(`
    INSERT INTO players (name, level, gender) VALUES (?, ?, ?)
  `);
  const seedTournamentPlayers = (prefix, definitions) => definitions.map((definition, index) => (
    Number(insertTournamentPlayer.run(`${prefix} ${definition.name || index + 1}`, definition.level, definition.gender).lastInsertRowid)
  ));
  const event = createTournamentEvent("Public Display Event", "2026-08-20", "2026-08-22");
  assert.equal(event.success, true, event.message);
  const eventId = event.data.tournament.id;
  const tournamentScenarios = [
    { division: "adult", type: "singles", category: "mens", level: "beginner", players: Array.from({ length: 4 }, () => ({ gender: "male" })) },
    { division: "u17", type: "singles", category: "womens", level: "intermediate", players: Array.from({ length: 4 }, () => ({ gender: "female" })) },
    { division: "u15", type: "singles", category: "no_gender", level: "upper_intermediate", players: Array.from({ length: 4 }, (_, index) => ({ gender: index % 2 === 0 ? "male" : "female" })) },
    { division: "u13", type: "doubles", category: "mens", level: "advanced", players: Array.from({ length: 8 }, () => ({ gender: "male" })) },
    { division: "u11", type: "doubles", category: "womens", level: "beginner", players: Array.from({ length: 8 }, () => ({ gender: "female" })) },
    { division: "u9", type: "doubles", category: "mixed", level: "intermediate", players: Array.from({ length: 8 }, (_, index) => ({ gender: index % 2 === 0 ? "male" : "female" })) },
    { division: "adult", type: "doubles", category: "no_gender", level: "upper_intermediate", players: Array.from({ length: 8 }, (_, index) => ({ gender: index % 2 === 0 ? "male" : "female" })) },
  ];
  const activeTournamentScenarios = [];
  for (const [index, scenario] of tournamentScenarios.entries()) {
    const playerIds = seedTournamentPlayers(
      `Tournament ${scenario.division} ${scenario.type} ${scenario.category}`,
      scenario.players.map((player, playerIndex) => ({
        ...player,
        name: `${player.gender}-${playerIndex + 1}`,
        level: scenario.division === "adult"
          ? scenario.level
          : ["beginner", "intermediate", "upper_intermediate", "advanced"][playerIndex % 4],
      })),
    );
    const generated = generateTournamentEventConfiguration(
      eventId,
      playerIds,
      scenario.division,
      scenario.type,
      scenario.category,
      scenario.level,
      () => 0.5,
    );
    assert.equal(generated.success, true, generated.message);
    const match = getTournamentMatches(generated.data.configuration)[0];
    const courtId = courtIds[5 + index];
    assert.equal(startTournamentEventMatch(match.id, courtId).success, true);
    activeTournamentScenarios.push({ ...scenario, playerIds, match, courtId, configurationId: generated.data.configuration.id });
  }

  for (const scenario of activeTournamentScenarios) {
    const displayed = assertDisplayedCourt(
      getCourts,
      scenario.courtId,
      "tournament",
      scenario.type,
      scenario.match.teamA.players.map((player) => player.playerId),
      scenario.match.teamB.players.map((player) => player.playerId),
    );
    assert.equal(displayed.activeMatch.division, scenario.division);
    assert.equal(displayed.activeMatch.category, scenario.category);
    assert.equal(
      displayed.activeMatch.level,
      scenario.division === "adult" ? scenario.level : "all",
    );
    assert.ok(displayed.activeMatch.groupName);
    assert.ok(Number.isInteger(displayed.activeMatch.roundNumber));
  }
  assert.match(displaySource, /formatDivision\(match\.division\)/);
  assert.match(displaySource, /match\.division === "adult" \? formatLabel\(match\.level\) : null/);
  assert.equal(getLevelTextClasses("beginner").includes("yellow"), true);
  assert.equal(getLevelTextClasses("intermediate").includes("green"), true);
  assert.equal(getLevelTextClasses("upper_intermediate").includes("blue"), true);
  assert.equal(getLevelTextClasses("advanced").includes("red"), true);

  // A fresh connection to the same persisted database retains active Court state.
  const reopenedDatabase = new Database(path.join(testUserData, "badminton.db"), { readonly: true });
  assert.equal(
    reopenedDatabase.prepare("SELECT status FROM courts WHERE id = ?").get(courtIds[0]).status,
    "playing",
  );
  assert.ok(reopenedDatabase.prepare(`
    SELECT id FROM rotation_matches WHERE court_id = ? AND status = 'playing'
  `).get(courtIds[0]));
  reopenedDatabase.close();

  // Waiting/finished source rows never replace a currently playing Court card.
  const nextUpIds = seedRotationPlayers("Next Up", [{ name: "One", gender: "male" }, { name: "Two", gender: "female" }]);
  assert.equal(rotation.generateAndSaveRotationMatches(nextUpIds, "singles", "no_gender").success, true);
  const nextUp = rotation.getRotationNextUpMatches();
  assert.equal(nextUp.success, true);
  assert.equal(nextUp.data.matches.length, 1);
  assert.equal(nextUp.data.matches[0].source, "rotation");
  assert.deepEqual(nextUp.data.matches[0].players.map((player) => player.id).sort((a, b) => a - b), [...nextUpIds].sort((a, b) => a - b));
  assert.equal(getActivePublicCourts(getCourts).some((court) => (
    court.activeMatch.source === "rotation"
    && court.activeMatch.matchId === nextUp.data.matches[0].id
  )), false);
  assert.equal(getActivePublicCourts(getCourts).length, 12);

  // Legacy normal matches remain intentionally display-compatible and source-safe.
  const legacyPlayerA = Number(insertTournamentPlayer.run("Legacy-Á", "advanced", "male").lastInsertRowid);
  const legacyPlayerB = Number(insertTournamentPlayer.run("Legacy-Long-Hyphenated-Name", "advanced", "female").lastInsertRowid);
  const legacyMatchId = Number(db.prepare(`
    INSERT INTO matches (court_id, player_one, player_two, status)
    VALUES (?, ?, ?, 'playing')
  `).run(courtIds[20], legacyPlayerA, legacyPlayerB).lastInsertRowid);
  db.prepare("UPDATE courts SET status = 'playing' WHERE id = ?").run(courtIds[20]);
  assertDisplayedCourt(getCourts, courtIds[20], "normal", "singles", [legacyPlayerA], [legacyPlayerB]);
  db.prepare("UPDATE matches SET status = 'finished' WHERE id = ?").run(legacyMatchId);
  db.prepare("UPDATE courts SET status = 'available' WHERE id = ?").run(courtIds[20]);
  assert.equal(getCourts().find((court) => court.id === courtIds[20]).activeMatch, null);

  // Profile names are live current-profile data for both active match sources.
  db.prepare("UPDATE players SET name = 'Rotation Renamed' WHERE id = ?").run(rotationMens.ids[0]);
  assert.equal(getCourts().find((court) => court.id === courtIds[1]).activeMatch.players.some((player) => player.name === "Rotation Renamed"), true);
  const tournamentProfileId = activeTournamentScenarios[0].match.teamA.players[0].playerId;
  db.prepare("UPDATE players SET name = 'Tournament Renamed' WHERE id = ?").run(tournamentProfileId);
  assert.equal(getCourts().find((court) => court.id === activeTournamentScenarios[0].courtId).activeMatch.players.some((player) => player.name === "Tournament Renamed"), true);

  // Finishing a Rotation match clears stale display data before the next match starts.
  assert.equal(rotation.finishRotationMatch(rotationSingles.matchId, 1, []).success, true);
  const releasedRotationCourt = getCourts().find((court) => court.id === courtIds[0]);
  assert.equal(releasedRotationCourt.status, "available");
  assert.equal(releasedRotationCourt.activeMatch, null);
  assert.deepEqual(releasedRotationCourt.players, []);
  const replacementIds = seedRotationPlayers("Replacement", [{ name: "A", gender: "male" }, { name: "B", gender: "female" }]);
  assert.equal(rotation.generateAndSaveRotationMatches(replacementIds, "singles", "no_gender").success, true);
  const replacementMatch = rotation.getRotationState().data.matches.find((match) => (
    match.status === "waiting" && match.players.every((player) => replacementIds.includes(player.id))
  ));
  assert.equal(rotation.startRotationMatch(replacementMatch.id, courtIds[0]).success, true);
  assertDisplayedCourt(
    getCourts,
    courtIds[0],
    "rotation",
    "singles",
    replacementMatch.teamA.map((player) => player.id),
    replacementMatch.teamB.map((player) => player.id),
  );

  // A reset and event delete immediately clear public Court mappings and release courts.
  const resetScenario = activeTournamentScenarios[3];
  assert.equal(resetTournamentEventConfiguration(resetScenario.configurationId).success, true);
  assert.equal(getCourts().find((court) => court.id === resetScenario.courtId).activeMatch, null);
  assert.equal(deleteTournamentEvent(eventId).success, true);
  for (const scenario of activeTournamentScenarios.filter((entry) => entry !== resetScenario)) {
    const court = getCourts().find((entry) => entry.id === scenario.courtId);
    assert.equal(court.status, "available");
    assert.equal(court.activeMatch, null);
  }

  // Repeated public-data reads do not write any database state.
  const snapshotBeforeReads = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM courts) AS courts,
      (SELECT COUNT(*) FROM rotation_matches) AS rotation_matches,
      (SELECT COUNT(*) FROM tournament_matches) AS tournament_matches,
      (SELECT COALESCE(SUM(total_matches_played), 0) FROM players) AS lifetime_matches,
      (SELECT COALESCE(SUM(match_count), 0) FROM registered_players_today) AS daily_matches
  `).get();
  for (let index = 0; index < 5; index += 1) {
    getCourts();
    rotation.getRotationNextUpMatches();
  }
  const snapshotAfterReads = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM courts) AS courts,
      (SELECT COUNT(*) FROM rotation_matches) AS rotation_matches,
      (SELECT COUNT(*) FROM tournament_matches) AS tournament_matches,
      (SELECT COALESCE(SUM(total_matches_played), 0) FROM players) AS lifetime_matches,
      (SELECT COALESCE(SUM(match_count), 0) FROM registered_players_today) AS daily_matches
  `).get();
  assert.deepEqual(snapshotAfterReads, snapshotBeforeReads);

  // Finish remaining Rotation matches and verify no active display ghosts remain.
  const activeRotationMatches = rotation.getRotationState().data.matches
    .filter((match) => match.status === "playing");
  for (const match of activeRotationMatches) {
    assert.equal(rotation.finishRotationMatch(match.id, 1, []).success, true);
  }
  assert.equal(getActivePublicCourts(getCourts).length, 0);

  // The final authoritative state has no cross-source Court conflict or corruption.
  const foreignKeyViolations = db.pragma("foreign_key_check");
  const integrity = db.pragma("integrity_check", { simple: true });
  const duplicateActiveCourtMappings = db.prepare(`
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
  const playingMissingCourt = db.prepare(`
    SELECT court_id
    FROM rotation_matches
    WHERE status = 'playing' AND court_id IS NULL
    UNION ALL
    SELECT court_id
    FROM tournament_matches
    WHERE status = 'playing' AND court_id IS NULL
  `).all();
  assert.deepEqual(foreignKeyViolations, []);
  assert.equal(integrity, "ok");
  assert.deepEqual(duplicateActiveCourtMappings, []);
  assert.deepEqual(playingMissingCourt, []);

  console.log(`Public Display retrieval timings: ${[5, 10, 25, 100].map((count) => `${count}=${retrievalTimings.get(count).toFixed(2)}ms`).join(", ")}.`);
  console.log("Public Display integration tests passed.");
} finally {
  db?.close();
  rmSync(testUserData, { recursive: true, force: true });
  app.quit();
}
