import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { app } from "electron";

const testUserData = mkdtempSync(
  path.join(os.tmpdir(), "badminton-tournament-score-"),
);
app.setPath("userData", testUserData);

let db;

function allMatches(configuration) {
  return configuration.groups.flatMap((group) => (
    group.rounds.flatMap((round) => round.matches)
  ));
}

function playerIds(team) {
  return team.players.map((player) => Number(player.playerId));
}

try {
  await import("../database/init.js");
  db = (await import("../database/database.js")).default;
  const {
    createTournamentEvent,
    finishTournamentEventMatch,
    generateTournamentEventConfiguration,
    getTournamentEvent,
    startTournamentEventMatch,
  } = await import("../database/tournamentQueries.js");

  const insertPlayer = db.prepare(`
    INSERT INTO players (name, level, gender)
    VALUES (?, 'beginner', ?)
  `);
  const singlesPlayerIds = ["Aaron", "Ben", "Carlo", "Daniel"].map((name) => Number(
    insertPlayer.run(`Score ${name}`, "male").lastInsertRowid,
  ));
  const doublesPlayerIds = Array.from({ length: 8 }, (_, index) => Number(
    insertPlayer.run(`Score Doubles ${index + 1}`, index % 2 === 0 ? "male" : "female")
      .lastInsertRowid,
  ));
  const allPlayerIds = [...singlesPlayerIds, ...doublesPlayerIds];
  const insertDaily = db.prepare(`
    INSERT INTO registered_players_today (player_id, match_count, wins, losses)
    VALUES (?, 7, 3, 4)
  `);
  db.transaction(() => allPlayerIds.forEach((playerId) => insertDaily.run(playerId)))();

  const courtId = Number(
    db.prepare("INSERT INTO courts (name) VALUES ('Score Court')").run().lastInsertRowid,
  );
  const event = createTournamentEvent("Score Tournament", "2026-08-29", "2026-08-30");
  assert.equal(event.success, true, event.message);
  const tournamentId = event.data.tournament.id;

  const singles = generateTournamentEventConfiguration(
    tournamentId,
    singlesPlayerIds,
    "adult",
    "singles",
    "mens",
    "beginner",
    () => 0.5,
  );
  assert.equal(singles.success, true, singles.message);
  const singlesMatches = allMatches(singles.data.configuration);
  const invalidTarget = singlesMatches[0];
  assert.equal(startTournamentEventMatch(invalidTarget.id, courtId).success, true);

  const invalidScores = [
    [undefined, 1, /Team A score is required/i],
    [1, undefined, /Team B score is required/i],
    [-1, 2, /Team A score must be a non-negative whole integer/i],
    [2, -1, /Team B score must be a non-negative whole integer/i],
    [1.5, 2, /Team A score must be a non-negative whole integer/i],
    [2, "1.5", /Team B score must be a non-negative whole integer/i],
    ["abc", 2, /Team A score must be a non-negative whole integer/i],
    [2, "abc", /Team B score must be a non-negative whole integer/i],
    [20, 20, /scores cannot be equal/i],
    [0, 0, /scores cannot be equal/i],
  ];
  for (const [teamAScore, teamBScore, message] of invalidScores) {
    const failed = finishTournamentEventMatch(invalidTarget.id, teamAScore, teamBScore);
    assert.equal(failed.success, false);
    assert.match(failed.message, message);
    const row = db.prepare(`
      SELECT status, winner_team_id, team_a_score, team_b_score, court_id
      FROM tournament_matches
      WHERE id = ?
    `).get(invalidTarget.id);
    assert.deepEqual(row, {
      status: "playing",
      winner_team_id: null,
      team_a_score: null,
      team_b_score: null,
      court_id: courtId,
    });
    assert.equal(db.prepare("SELECT status FROM courts WHERE id = ?").get(courtId).status, "playing");
    assert.equal(
      db.prepare(`
        SELECT SUM(total_matches_played) AS matches
        FROM players
        WHERE id IN (${allPlayerIds.map(() => "?").join(",")})
      `).get(...allPlayerIds).matches,
      0,
    );
  }

  const firstFinished = finishTournamentEventMatch(invalidTarget.id, 21, 18);
  assert.equal(firstFinished.success, true, firstFinished.message);
  let savedMatch = allMatches(firstFinished.data.configurations[0])
    .find((match) => match.id === invalidTarget.id);
  assert.equal(savedMatch.status, "finished");
  assert.equal(savedMatch.teamAScore, 21);
  assert.equal(savedMatch.teamBScore, 18);
  assert.equal(savedMatch.winnerTeamId, savedMatch.teamAId);
  assert.equal(db.prepare("SELECT status FROM courts WHERE id = ?").get(courtId).status, "available");
  const firstWinnerId = savedMatch.teamA.players[0].playerId;
  const firstLoserId = savedMatch.teamB.players[0].playerId;
  assert.deepEqual(
    db.prepare(`
      SELECT total_matches_played, total_wins, total_losses
      FROM players WHERE id = ?
    `).get(firstWinnerId),
    { total_matches_played: 1, total_wins: 1, total_losses: 0 },
  );
  assert.deepEqual(
    db.prepare(`
      SELECT total_matches_played, total_wins, total_losses
      FROM players WHERE id = ?
    `).get(firstLoserId),
    { total_matches_played: 1, total_wins: 0, total_losses: 1 },
  );

  const duplicate = finishTournamentEventMatch(invalidTarget.id, 5, 0);
  assert.equal(duplicate.success, false);
  assert.match(duplicate.message, /already been completed/i);
  savedMatch = allMatches(getTournamentEvent(tournamentId).data.configurations[0])
    .find((match) => match.id === invalidTarget.id);
  assert.equal(savedMatch.teamAScore, 21);
  assert.equal(savedMatch.teamBScore, 18);

  for (const [match, teamAScore, teamBScore, expectedWinner] of [
    [singlesMatches[1], 15, 21, "B"],
    [singlesMatches[2], 0, 1, "B"],
    [singlesMatches[3], 100, 99, "A"],
  ]) {
    assert.equal(startTournamentEventMatch(match.id, courtId).success, true);
    const finished = finishTournamentEventMatch(match.id, teamAScore, teamBScore);
    assert.equal(finished.success, true, finished.message);
    const result = finished.data.configurations
      .flatMap((configuration) => allMatches(configuration))
      .find((candidate) => candidate.id === match.id);
    assert.equal(
      result.winnerTeamId,
      expectedWinner === "A" ? result.teamAId : result.teamBId,
    );
  }

  const doubles = generateTournamentEventConfiguration(
    tournamentId,
    doublesPlayerIds,
    "adult",
    "doubles",
    "no_gender",
    "beginner",
    () => 0.5,
  );
  assert.equal(doubles.success, true, doubles.message);
  const doublesMatches = allMatches(doubles.data.configuration);
  for (const [match, teamAScore, teamBScore, expectedWinner] of [
    [doublesMatches[0], 30, 29, "A"],
    [doublesMatches[1], 5, 8, "B"],
  ]) {
    assert.equal(startTournamentEventMatch(match.id, courtId).success, true);
    const statsBefore = new Map(db.prepare(`
      SELECT id, total_matches_played, total_wins, total_losses
      FROM players
      WHERE id IN (?, ?, ?, ?)
    `).all(...[...playerIds(match.teamA), ...playerIds(match.teamB)]).map((row) => [Number(row.id), row]));
    const finished = finishTournamentEventMatch(match.id, teamAScore, teamBScore);
    assert.equal(finished.success, true, finished.message);
    const result = finished.data.configurations
      .flatMap((configuration) => allMatches(configuration))
      .find((candidate) => candidate.id === match.id);
    const winner = expectedWinner === "A" ? result.teamA : result.teamB;
    const winnerIds = new Set(playerIds(winner));
    for (const row of db.prepare(`
      SELECT id, total_matches_played, total_wins, total_losses
      FROM players
      WHERE id IN (?, ?, ?, ?)
    `).all(...[...playerIds(match.teamA), ...playerIds(match.teamB)])) {
      const before = statsBefore.get(Number(row.id));
      assert.equal(row.total_matches_played, before.total_matches_played + 1);
      assert.equal(row.total_wins, before.total_wins + (winnerIds.has(Number(row.id)) ? 1 : 0));
      assert.equal(row.total_losses, before.total_losses + (winnerIds.has(Number(row.id)) ? 0 : 1));
    }
  }

  // Tournament scores never alter today's Rotation statistics.
  assert.equal(
    db.prepare(`
      SELECT COUNT(*) AS count
      FROM registered_players_today
      WHERE match_count = 7 AND wins = 3 AND losses = 4
    `).get().count,
    allPlayerIds.length,
  );
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  assert.equal(db.prepare("PRAGMA integrity_check").pluck().get(), "ok");

  console.log("Tournament score integration checks passed.");
} catch (error) {
  console.error(error);
  if (db?.open) db.close();
  rmSync(testUserData, { recursive: true, force: true });
  app.exit(1);
}

if (db?.open) db.close();
rmSync(testUserData, { recursive: true, force: true });
app.quit();
