import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { app } from "electron";
import { getTournamentGroupSizes } from "../database/tournamentGenerationLogic.js";
import {
  getEligibleTournamentProfiles,
  getTournamentSelectionDetails,
  validateTournamentSelection,
} from "../src/utils/tournamentSelection.js";

const testUserData = mkdtempSync(
  path.join(os.tmpdir(), "badminton-tournament-revision-performance-"),
);
app.setPath("userData", testUserData);

let db;

// Inserts one exact-level mixed pool using a single SQLite transaction.
function seedPlayers(count) {
  const insertPlayer = db.prepare(`
    INSERT INTO players (name, level, gender)
    VALUES (?, 'intermediate', ?)
  `);
  return db.transaction(() => Array.from({ length: count }, (_, index) => ({
    id: Number(insertPlayer.run(
      `Tournament Performance ${count}-${index + 1}`,
      index < count / 2 ? "male" : "female",
    ).lastInsertRowid),
    name: `Tournament Performance ${count}-${index + 1}`,
    level: "intermediate",
    gender: index < count / 2 ? "male" : "female",
  })))();
}

try {
  await import("../database/init.js");
  db = (await import("../database/database.js")).default;
  const {
    createTournamentEvent,
    generateTournamentEventConfiguration,
    getTournamentEvent,
    listTournamentEvents,
  } = await import("../database/tournamentQueries.js");

  const measurements = [];
  for (const playerCount of [80, 160, 640]) {
    const profiles = seedPlayers(playerCount);
    const playerIds = profiles.map((player) => player.id);
    const profileById = new Map(profiles.map((player) => [player.id, player]));

    const selectionStartedAt = performance.now();
    const eligible = getEligibleTournamentProfiles(
      profiles,
      "intermediate",
      "mixed",
    );
    const selection = getTournamentSelectionDetails(playerIds, eligible);
    const validation = validateTournamentSelection(
      playerIds,
      profileById,
      "doubles",
      "mixed",
    );
    const selectionMs = performance.now() - selectionStartedAt;
    assert.equal(eligible.length, playerCount);
    assert.equal(selection.selectedPlayers.length, playerCount);
    assert.equal(selection.genderCounts.male, playerCount / 2);
    assert.equal(selection.genderCounts.female, playerCount / 2);
    assert.equal(validation.ready, true);

    const event = createTournamentEvent(
      `Performance Event ${playerCount}`,
      "2026-12-01",
      "2026-12-03",
    );
    assert.equal(event.success, true, event.message);

    const transactionStartedAt = performance.now();
    const generated = generateTournamentEventConfiguration(
      event.data.tournament.id,
      playerIds,
      "u15",
      "doubles",
      "mixed",
      "intermediate",
      () => 0.5,
    );
    const transactionMs = performance.now() - transactionStartedAt;
    assert.equal(generated.success, true, generated.message);

    const configuration = generated.data.configuration;
    const teamCount = playerCount / 2;
    const expectedMatches = getTournamentGroupSizes(teamCount).reduce(
      (sum, size) => sum + size * (size - 1) / 2,
      0,
    );
    assert.equal(configuration.summary.totalParticipants, playerCount);
    assert.equal(configuration.summary.totalTeams, teamCount);
    assert.equal(configuration.summary.totalMatches, expectedMatches);
    assert.equal(configuration.teams.every((team) => team.players.length === 2), true);
    assert.equal(new Set(configuration.teams.map((team) => team.id)).size, teamCount);

    const retrievalStartedAt = performance.now();
    const retrieved = getTournamentEvent(event.data.tournament.id);
    const retrievalMs = performance.now() - retrievalStartedAt;
    assert.equal(retrieved.success, true, retrieved.message);
    assert.equal(retrieved.data.summary.totalMatches, expectedMatches);
    const payloadBytes = Buffer.byteLength(JSON.stringify(retrieved.data), "utf8");

    const listStartedAt = performance.now();
    const listed = listTournamentEvents();
    const listMs = performance.now() - listStartedAt;
    assert.equal(listed.success, true, listed.message);
    const summary = listed.data.find((item) => item.id === event.data.tournament.id);
    assert.equal(summary.configurationCount, 1);
    assert.equal(summary.matchCount, expectedMatches);

    assert.ok(selectionMs < 1000, `${playerCount}-player selection transform took too long`);
    assert.ok(transactionMs < 5000, `${playerCount}-player database generation took too long`);
    assert.ok(retrievalMs < 2000, `${playerCount}-player retrieval took too long`);
    assert.ok(listMs < 1000, `${playerCount}-player event listing took too long`);
    assert.ok(payloadBytes < 10 * 1024 * 1024, `${playerCount}-player payload is unexpectedly large`);

    measurements.push({
      players: playerCount,
      teams: teamCount,
      matches: expectedMatches,
      selectionMs: Number(selectionMs.toFixed(3)),
      transactionMs: Number(transactionMs.toFixed(3)),
      retrievalMs: Number(retrievalMs.toFixed(3)),
      listMs: Number(listMs.toFixed(3)),
      payloadKb: Number((payloadBytes / 1024).toFixed(1)),
    });

    db.prepare("DELETE FROM tournaments WHERE id = ?").run(event.data.tournament.id);
    db.prepare(`
      DELETE FROM players
      WHERE name LIKE ?
    `).run(`Tournament Performance ${playerCount}-%`);
  }

  console.table(measurements);
  console.log("Revised Tournament selection, transaction, retrieval, and payload performance checks passed.");
} catch (error) {
  console.error(error);
  if (db?.open) db.close();
  rmSync(testUserData, { recursive: true, force: true });
  app.exit(1);
}

if (db?.open) db.close();
rmSync(testUserData, { recursive: true, force: true });
app.quit();
