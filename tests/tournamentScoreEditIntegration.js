import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { app } from "electron";

const testUserData = mkdtempSync(
  path.join(os.tmpdir(), "badminton-tournament-score-edit-"),
);
app.setPath("userData", testUserData);

let db;

function allMatches(configuration) {
  return configuration.groups.flatMap((group) => (
    group.rounds.flatMap((round) => round.matches)
  ));
}

function teamPlayerIds(team) {
  return team.players.map((player) => Number(player.playerId));
}

function matchPlayerIds(match) {
  return [...teamPlayerIds(match.teamA), ...teamPlayerIds(match.teamB)];
}

function getStats(playerIds) {
  const placeholders = playerIds.map(() => "?").join(",");
  return new Map(db.prepare(`
    SELECT id, total_matches_played, total_wins, total_losses
    FROM players
    WHERE id IN (${placeholders})
  `).all(...playerIds).map((row) => [Number(row.id), row]));
}

function assertCurrentWinnerStats(match, baseline, winnerSide) {
  const winnerIds = new Set(teamPlayerIds(winnerSide === "A" ? match.teamA : match.teamB));
  const current = getStats(matchPlayerIds(match));
  for (const playerId of matchPlayerIds(match)) {
    const before = baseline.get(playerId);
    const after = current.get(playerId);
    assert.equal(after.total_matches_played, before.total_matches_played + 1);
    assert.equal(after.total_wins, before.total_wins + (winnerIds.has(playerId) ? 1 : 0));
    assert.equal(after.total_losses, before.total_losses + (winnerIds.has(playerId) ? 0 : 1));
  }
}

function getStoredMatch(matchId) {
  return db.prepare(`
    SELECT
      status,
      team_a_id,
      team_b_id,
      winner_team_id,
      team_a_score,
      team_b_score,
      court_id
    FROM tournament_matches
    WHERE id = ?
  `).get(matchId);
}

function standingsForMatch(eventData, matchId) {
  for (const configuration of eventData.configurations) {
    for (const group of configuration.groups) {
      if (allMatches({ groups: [group] }).some((match) => match.id === matchId)) {
        return new Map(group.standings.map((standing) => [standing.teamId, standing]));
      }
    }
  }
  throw new Error(`Standings for match ${matchId} were not found.`);
}

try {
  const { initDatabase } = await import("../database/init.js");
  db = (await import("../database/database.js")).default;
  const {
    createTournamentEvent,
    finishTournamentEventMatch,
    generateTournamentEventConfiguration,
    getTournamentEvent,
    startTournamentEventMatch,
    updateTournamentMatchResult,
  } = await import("../database/tournamentQueries.js");

  const insertPlayer = db.prepare(`
    INSERT INTO players (name, level, gender)
    VALUES (?, 'beginner', ?)
  `);
  const singlesPlayerIds = ["Aaron", "Ben", "Carlo", "Daniel"].map((name) => Number(
    insertPlayer.run(`Edit ${name}`, "male").lastInsertRowid,
  ));
  const doublesPlayerIds = Array.from({ length: 8 }, (_, index) => Number(
    insertPlayer.run(`Edit Doubles ${index + 1}`, index % 2 === 0 ? "male" : "female")
      .lastInsertRowid,
  ));
  const allPlayerIds = [...singlesPlayerIds, ...doublesPlayerIds];
  const insertDaily = db.prepare(`
    INSERT INTO registered_players_today (player_id, match_count, wins, losses)
    VALUES (?, 9, 4, 5)
  `);
  db.transaction(() => allPlayerIds.forEach((playerId) => insertDaily.run(playerId)))();

  const historicalCourtId = Number(
    db.prepare("INSERT INTO courts (name) VALUES ('Edit Historical Court')").run().lastInsertRowid,
  );
  const event = createTournamentEvent("Result Editing", "2026-08-29", "2026-08-30");
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
  const primaryMatch = singlesMatches[0];
  const primaryIds = new Set(matchPlayerIds(primaryMatch));
  const disjointMatch = singlesMatches.find((match) => (
    match.id !== primaryMatch.id
    && matchPlayerIds(match).every((playerId) => !primaryIds.has(playerId))
  ));
  assert.ok(disjointMatch, "A four-team round should contain a disjoint match");

  const primaryBaseline = getStats(matchPlayerIds(primaryMatch));
  assert.equal(startTournamentEventMatch(primaryMatch.id, historicalCourtId).success, true);
  assert.equal(finishTournamentEventMatch(primaryMatch.id, 21, 17).success, true);
  assertCurrentWinnerStats(primaryMatch, primaryBaseline, "A");

  // An old match correction must not affect a Court now occupied by another match.
  assert.equal(startTournamentEventMatch(disjointMatch.id, historicalCourtId).success, true);
  const sameWinnerUpdate = updateTournamentMatchResult(primaryMatch.id, 21, 19);
  assert.equal(sameWinnerUpdate.success, true, sameWinnerUpdate.message);
  const standingsBeforeFlip = standingsForMatch(sameWinnerUpdate.data, primaryMatch.id);
  assert.deepEqual(getStoredMatch(primaryMatch.id), {
    status: "finished",
    team_a_id: primaryMatch.teamAId,
    team_b_id: primaryMatch.teamBId,
    winner_team_id: primaryMatch.teamAId,
    team_a_score: 21,
    team_b_score: 19,
    court_id: historicalCourtId,
  });
  assertCurrentWinnerStats(primaryMatch, primaryBaseline, "A");
  assert.equal(db.prepare("SELECT status FROM courts WHERE id = ?").get(historicalCourtId).status, "playing");
  assert.equal(getStoredMatch(disjointMatch.id).status, "playing");

  // Waiting and playing matches cannot use the correction API.
  const waitingMatch = singlesMatches.find((match) => (
    ![primaryMatch.id, disjointMatch.id].includes(match.id)
  ));
  assert.match(updateTournamentMatchResult(waitingMatch.id, 21, 18).message, /only a finished/i);
  assert.match(updateTournamentMatchResult(disjointMatch.id, 21, 18).message, /only a finished/i);

  const disjointBaseline = getStats(matchPlayerIds(disjointMatch));
  assert.equal(finishTournamentEventMatch(disjointMatch.id, 17, 21).success, true);
  assert.equal(updateTournamentMatchResult(disjointMatch.id, 15, 21).success, true);
  assertCurrentWinnerStats(disjointMatch, disjointBaseline, "B");

  // Repeated edits always represent exactly the current winner and never add matches.
  const flippedPrimary = updateTournamentMatchResult(primaryMatch.id, 18, 21);
  assert.equal(flippedPrimary.success, true, flippedPrimary.message);
  const standingsAfterFlip = standingsForMatch(flippedPrimary.data, primaryMatch.id);
  assert.equal(
    standingsAfterFlip.get(primaryMatch.teamAId).wins,
    standingsBeforeFlip.get(primaryMatch.teamAId).wins - 1,
  );
  assert.equal(
    standingsAfterFlip.get(primaryMatch.teamBId).wins,
    standingsBeforeFlip.get(primaryMatch.teamBId).wins + 1,
  );
  assertCurrentWinnerStats(primaryMatch, primaryBaseline, "B");
  assert.equal(updateTournamentMatchResult(primaryMatch.id, 16, 21).success, true);
  assertCurrentWinnerStats(primaryMatch, primaryBaseline, "B");
  assert.equal(updateTournamentMatchResult(primaryMatch.id, 22, 20).success, true);
  assertCurrentWinnerStats(primaryMatch, primaryBaseline, "A");
  const noChangeStats = getStats(matchPlayerIds(primaryMatch));
  assert.equal(updateTournamentMatchResult(primaryMatch.id, 22, 20).success, true);
  assert.deepEqual(getStats(matchPlayerIds(primaryMatch)), noChangeStats);

  // Invalid corrections roll back scores, winner, stats, status, and Court history.
  const invalidSnapshot = getStoredMatch(primaryMatch.id);
  const invalidStats = getStats(matchPlayerIds(primaryMatch));
  for (const [teamAScore, teamBScore, expression] of [
    [undefined, 1, /Team A score is required/i],
    [1, undefined, /Team B score is required/i],
    [-1, 2, /non-negative whole integer/i],
    [2, -1, /non-negative whole integer/i],
    [1.5, 2, /non-negative whole integer/i],
    [2, "1.5", /non-negative whole integer/i],
    ["bad", 2, /non-negative whole integer/i],
    [2, "bad", /non-negative whole integer/i],
    [0, 0, /scores cannot be equal/i],
    [20, 20, /scores cannot be equal/i],
  ]) {
    const invalid = updateTournamentMatchResult(primaryMatch.id, teamAScore, teamBScore);
    assert.equal(invalid.success, false);
    assert.match(invalid.message, expression);
    assert.deepEqual(getStoredMatch(primaryMatch.id), invalidSnapshot);
    assert.deepEqual(getStats(matchPlayerIds(primaryMatch)), invalidStats);
  }

  // Corrupt aggregates cannot be driven negative, and partial stat transfers roll back.
  const unsafeOldWinnerId = teamPlayerIds(disjointMatch.teamB)[0];
  const safeWinnerStats = db.prepare(`
    SELECT total_wins FROM players WHERE id = ?
  `).get(unsafeOldWinnerId);
  db.prepare("UPDATE players SET total_wins = 0 WHERE id = ?").run(unsafeOldWinnerId);
  const unsafeStatsSnapshot = getStats(matchPlayerIds(disjointMatch));
  const unsafeMatchSnapshot = getStoredMatch(disjointMatch.id);
  const unsafeCorrection = updateTournamentMatchResult(disjointMatch.id, 21, 18);
  assert.equal(unsafeCorrection.success, false);
  assert.match(unsafeCorrection.message, /cannot safely reverse/i);
  assert.deepEqual(getStats(matchPlayerIds(disjointMatch)), unsafeStatsSnapshot);
  assert.deepEqual(getStoredMatch(disjointMatch.id), unsafeMatchSnapshot);
  db.prepare("UPDATE players SET total_wins = ? WHERE id = ?")
    .run(safeWinnerStats.total_wins, unsafeOldWinnerId);

  // Doubles winner changes correct all four profiles without adding matches.
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
  const doublesMatch = allMatches(doubles.data.configuration)[0];
  const doublesBaseline = getStats(matchPlayerIds(doublesMatch));
  assert.equal(startTournamentEventMatch(doublesMatch.id, historicalCourtId).success, true);
  assert.equal(finishTournamentEventMatch(doublesMatch.id, 21, 17).success, true);
  assert.equal(updateTournamentMatchResult(doublesMatch.id, 21, 19).success, true);
  assertCurrentWinnerStats(doublesMatch, doublesBaseline, "A");
  assert.equal(updateTournamentMatchResult(doublesMatch.id, 18, 21).success, true);
  assertCurrentWinnerStats(doublesMatch, doublesBaseline, "B");

  // Migrated winner-only revised results accept their first explicit scores.
  const nullScoreMatches = singlesMatches.filter((match) => (
    ![primaryMatch.id, disjointMatch.id, waitingMatch.id].includes(match.id)
  )).slice(0, 2);
  for (const nullScoreMatch of nullScoreMatches) {
    assert.equal(startTournamentEventMatch(nullScoreMatch.id, historicalCourtId).success, true);
    assert.equal(finishTournamentEventMatch(nullScoreMatch.id, 21, 17).success, true);
  }
  db.exec("DROP TRIGGER validate_revised_tournament_match_update");
  for (const nullScoreMatch of nullScoreMatches) {
    db.prepare(`
      UPDATE tournament_matches
      SET team_a_score = NULL, team_b_score = NULL
      WHERE id = ?
    `).run(nullScoreMatch.id);
  }
  initDatabase();

  const nullSameWinnerStats = getStats(matchPlayerIds(nullScoreMatches[0]));
  assert.equal(updateTournamentMatchResult(nullScoreMatches[0].id, 30, 29).success, true);
  assert.deepEqual(getStats(matchPlayerIds(nullScoreMatches[0])), nullSameWinnerStats);

  const nullFlipBaseline = getStats(matchPlayerIds(nullScoreMatches[1]));
  assert.equal(updateTournamentMatchResult(nullScoreMatches[1].id, 18, 21).success, true);
  const oldWinnerIds = new Set(teamPlayerIds(nullScoreMatches[1].teamA));
  const nullFlipAfter = getStats(matchPlayerIds(nullScoreMatches[1]));
  for (const playerId of matchPlayerIds(nullScoreMatches[1])) {
    const before = nullFlipBaseline.get(playerId);
    const after = nullFlipAfter.get(playerId);
    assert.equal(after.total_matches_played, before.total_matches_played);
    assert.equal(after.total_wins, before.total_wins + (oldWinnerIds.has(playerId) ? -1 : 1));
    assert.equal(after.total_losses, before.total_losses + (oldWinnerIds.has(playerId) ? 1 : -1));
  }

  // Direct SQL protections still reject invalid corrected storage.
  assert.throws(() => db.prepare(`
    UPDATE tournament_matches SET team_a_score = -1, team_b_score = -2 WHERE id = ?
  `).run(primaryMatch.id), /CHECK constraint|non-negative/i);
  assert.throws(() => db.prepare(`
    UPDATE tournament_matches SET team_a_score = 20, team_b_score = 20 WHERE id = ?
  `).run(primaryMatch.id), /scores cannot be equal/i);
  assert.throws(() => db.prepare(`
    UPDATE tournament_matches
    SET team_a_score = 21, team_b_score = 18, winner_team_id = team_b_id
    WHERE id = ?
  `).run(primaryMatch.id), /winner must match/i);

  // Draft and finished events are protected even when the renderer is bypassed.
  db.prepare("UPDATE tournaments SET status = 'draft' WHERE id = ?").run(tournamentId);
  assert.match(updateTournamentMatchResult(primaryMatch.id, 21, 18).message, /only.*ongoing/i);
  db.prepare("UPDATE tournaments SET status = 'ongoing' WHERE id = ?").run(tournamentId);
  db.prepare("UPDATE tournaments SET status = 'finished' WHERE id = ?").run(tournamentId);
  assert.match(updateTournamentMatchResult(primaryMatch.id, 21, 18).message, /only.*ongoing/i);

  const refreshed = getTournamentEvent(tournamentId);
  assert.equal(refreshed.success, true, refreshed.message);
  const correctedPrimary = refreshed.data.configurations
    .flatMap((configuration) => allMatches(configuration))
    .find((match) => match.id === primaryMatch.id);
  assert.equal(correctedPrimary.status, "finished");
  assert.equal(correctedPrimary.winnerTeamId, correctedPrimary.teamAId);

  // Tournament corrections never touch today's Rotation statistics.
  assert.equal(db.prepare(`
    SELECT COUNT(*) AS count
    FROM registered_players_today
    WHERE match_count = 9 AND wins = 4 AND losses = 5
  `).get().count, allPlayerIds.length);
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  assert.equal(db.prepare("PRAGMA integrity_check").pluck().get(), "ok");

  console.log("Tournament result-edit integration checks passed.");
} catch (error) {
  console.error(error);
  if (db?.open) db.close();
  rmSync(testUserData, { recursive: true, force: true });
  app.exit(1);
}

if (db?.open) db.close();
rmSync(testUserData, { recursive: true, force: true });
app.quit();
