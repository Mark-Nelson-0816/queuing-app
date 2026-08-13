import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { app } from "electron";
import {
  TOURNAMENT_DIVISIONS,
  TOURNAMENT_LEVELS,
} from "../database/tournamentGenerationLogic.js";

const testUserData = mkdtempSync(
  path.join(os.tmpdir(), "badminton-tournament-revision-matrix-"),
);
app.setPath("userData", testUserData);

let db;

try {
  await import("../database/init.js");
  db = (await import("../database/database.js")).default;
  const {
    createTournamentEvent,
    finishTournamentEventMatch,
    generateTournamentEventConfiguration,
    getTournamentEvent,
    listTournamentEvents,
    startTournamentEventMatch,
  } = await import("../database/tournamentQueries.js");

  const insertPlayer = db.prepare(`
    INSERT INTO players (name, level, gender)
    VALUES (?, ?, ?)
  `);
  const playersByLevel = new Map();
  db.transaction(() => {
    for (const level of TOURNAMENT_LEVELS) {
      const players = { male: [], female: [] };
      for (const gender of ["male", "female"]) {
        for (let index = 0; index < 4; index += 1) {
          players[gender].push(Number(insertPlayer.run(
            `${level}-${gender}-${index + 1}`,
            level,
            gender,
          ).lastInsertRowid));
        }
      }
      playersByLevel.set(level, players);
    }
  })();

  const event = createTournamentEvent(
    "Complete Matrix Tournament",
    "2026-01-05",
    "2026-01-09",
  );
  assert.equal(event.success, true, event.message);
  const tournamentId = event.data.tournament.id;
  const courtId = Number(db.prepare("INSERT INTO courts (name) VALUES ('Matrix Court')")
    .run().lastInsertRowid);

  const configurations = [];
  const matrixStartedAt = performance.now();
  for (const division of TOURNAMENT_DIVISIONS) {
    for (const level of TOURNAMENT_LEVELS) {
      const levelPlayers = playersByLevel.get(level);
      const fixtures = [
        ["singles", "mens", levelPlayers.male.slice(0, 2)],
        ["singles", "womens", levelPlayers.female.slice(0, 2)],
        ["singles", "no_gender", [levelPlayers.male[0], levelPlayers.female[0]]],
        ["doubles", "mens", levelPlayers.male],
        ["doubles", "womens", levelPlayers.female],
        ["doubles", "mixed", [...levelPlayers.male.slice(0, 2), ...levelPlayers.female.slice(0, 2)]],
        ["doubles", "no_gender", [...levelPlayers.male.slice(0, 2), ...levelPlayers.female.slice(0, 2)]],
      ];

      for (const [matchType, category, playerIds] of fixtures) {
        const generated = generateTournamentEventConfiguration(
          tournamentId,
          playerIds,
          division,
          matchType,
          category,
          level,
          () => 0.5,
        );
        assert.equal(generated.success, true, generated.message);
        assert.equal(generated.data.configuration.groups.length, 1);
        assert.equal(generated.data.configuration.groups[0].name, "Group A");
        assert.equal(generated.data.configuration.summary.totalTeams, 2);
        assert.equal(generated.data.configuration.summary.totalMatches, 1);
        configurations.push(generated.data.configuration);

        // Starting and finishing the first matrix match makes later generation ongoing-safe.
        if (configurations.length === 1) {
          const match = generated.data.configuration.groups[0].rounds[0].matches[0];
          const started = startTournamentEventMatch(match.id, courtId);
          assert.equal(started.success, true, started.message);
          assert.equal(started.data.tournament.status, "ongoing");
          const finished = finishTournamentEventMatch(match.id, match.teamAId);
          assert.equal(finished.success, true, finished.message);
        }
      }
    }
  }
  const matrixMs = performance.now() - matrixStartedAt;

  assert.equal(configurations.length, 168);
  const persisted = getTournamentEvent(tournamentId);
  assert.equal(persisted.success, true, persisted.message);
  assert.equal(persisted.data.tournament.status, "ongoing");
  assert.equal(persisted.data.configurations.length, 168);
  assert.equal(persisted.data.summary.totalMatches, 168);
  assert.equal(persisted.data.summary.finishedMatches, 1);
  assert.equal(persisted.data.summary.waitingMatches, 167);
  assert.equal(new Set(persisted.data.configurations.map((configuration) => [
      configuration.division,
      configuration.matchType,
      configuration.category,
      configuration.level,
    ].join(":"))).size, 168);

  const mixedSingles = generateTournamentEventConfiguration(
    tournamentId,
    playersByLevel.get("beginner").male.slice(0, 2),
    "adult",
    "singles",
    "mixed",
    "beginner",
  );
  assert.equal(mixedSingles.success, false);
  assert.match(mixedSingles.message, /only available for Doubles/i);
  assert.equal(getTournamentEvent(tournamentId).data.configurations.length, 168);

  const listStartedAt = performance.now();
  const listed = listTournamentEvents();
  const listMs = performance.now() - listStartedAt;
  const summary = listed.data.find((item) => item.id === tournamentId);
  assert.equal(summary.configurationCount, 168);
  assert.equal(summary.matchCount, 168);
  assert.equal(summary.finishedMatchCount, 1);
  assert.ok(matrixMs < 15000, `Persisted configuration matrix took ${matrixMs.toFixed(2)} ms`);
  assert.ok(listMs < 1000, `Matrix event listing took ${listMs.toFixed(2)} ms`);
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);

  console.log(`Persisted all 168 legal Tournament configurations in ${matrixMs.toFixed(2)} ms.`);
  console.log(`Listed the complete matrix event in ${listMs.toFixed(2)} ms.`);
  console.log("Tournament persisted configuration matrix checks passed.");
} catch (error) {
  console.error(error);
  if (db?.open) db.close();
  rmSync(testUserData, { recursive: true, force: true });
  app.exit(1);
}

if (db?.open) db.close();
rmSync(testUserData, { recursive: true, force: true });
app.quit();
