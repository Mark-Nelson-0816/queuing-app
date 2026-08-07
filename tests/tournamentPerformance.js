import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { app } from "electron";

const testUserData = mkdtempSync(
  path.join(os.tmpdir(), "badminton-tournament-performance-"),
);
app.setPath("userData", testUserData);

let db;

try {
  await import("../database/init.js");
  db = (await import("../database/database.js")).default;
  const { createRoundRobinTournament } = await import(
    "../database/tournamentQueries.js"
  );

  const insertPlayer = db.prepare(`
    INSERT INTO players (
      name,
      level,
      gender,
      prefer_mens,
      prefer_womens,
      prefer_mixed,
      prefer_no_gender
    )
    VALUES (?, ?, ?, 0, 0, 1, 1)
  `);
  const levels = [
    "beginner",
    "intermediate",
    "upper_intermediate",
    "advanced",
  ];

  for (const playerCount of [8, 16, 40, 80]) {
    const selectedPlayers = [];
    const playersPerGender = playerCount / 2;
    for (let index = 0; index < playerCount; index += 1) {
      const gender = index < playersPerGender ? "male" : "female";
      const result = insertPlayer.run(
        `${playerCount}-${gender}-${index + 1}`,
        levels[index % levels.length],
        gender,
      );
      selectedPlayers.push({ id: Number(result.lastInsertRowid) });
    }

    const startedAt = performance.now();
    const result = createRoundRobinTournament(
      selectedPlayers,
      "doubles",
      "mixed",
    );
    const durationMs = performance.now() - startedAt;

    assert.equal(result.success, true, result.message);
    const expectedTeams = playerCount / 2;
    const expectedMatches = expectedTeams * (expectedTeams - 1) / 2;
    assert.equal(result.data.teams.length, expectedTeams);
    assert.equal(result.data.summary.totalMatches, expectedMatches);
    assert.ok(durationMs < 5000, `${playerCount}-player generation took too long`);
    assert.ok(result.data.teams.every((team) => (
      team.player1?.gender === "male" && team.player2?.gender === "female"
    )));

    const teamPlayerIds = result.data.teams.flatMap((team) => (
      [team.player1.id, team.player2.id]
    ));
    assert.equal(new Set(teamPlayerIds).size, playerCount);

    const matchupKeys = new Set();
    for (const round of result.data.rounds) {
      const roundTeamIds = new Set();
      for (const match of round.matches) {
        assert.equal(roundTeamIds.has(match.teamAId), false);
        assert.equal(roundTeamIds.has(match.teamBId), false);
        roundTeamIds.add(match.teamAId);
        roundTeamIds.add(match.teamBId);
        const matchupKey = [match.teamAId, match.teamBId]
          .sort((first, second) => first - second)
          .join("-");
        assert.equal(matchupKeys.has(matchupKey), false);
        matchupKeys.add(matchupKey);
      }
    }
    assert.equal(matchupKeys.size, expectedMatches);
    console.log(`${playerCount} players: ${durationMs.toFixed(2)} ms, ${expectedMatches} matches`);

    db.prepare("DELETE FROM tournament_matches WHERE tournament_id = ?")
      .run(result.data.tournament.id);
    db.prepare("DELETE FROM tournament_rounds WHERE tournament_id = ?")
      .run(result.data.tournament.id);
    db.prepare("DELETE FROM tournament_teams WHERE tournament_id = ?")
      .run(result.data.tournament.id);
    db.prepare("DELETE FROM tournaments WHERE id = ?")
      .run(result.data.tournament.id);
  }

  console.log("Tournament performance checks passed.");
} finally {
  if (db) db.close();
  rmSync(testUserData, { recursive: true, force: true });
  app.quit();
}
