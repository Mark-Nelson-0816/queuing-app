import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { app } from "electron";

const testUserData = mkdtempSync(
  path.join(os.tmpdir(), "badminton-tournament-test-"),
);
const testDatabasePath = path.join(testUserData, "badminton.db");

// Simulate an existing installation whose tournament_matches table predates
// court assignment. init.js must migrate it without resetting the database.
const legacyDatabase = new Database(testDatabasePath);
legacyDatabase.exec(`
  CREATE TABLE tournament_matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tournament_id INTEGER NOT NULL,
    round_id INTEGER NOT NULL,
    team_a_id INTEGER NOT NULL,
    team_b_id INTEGER NOT NULL,
    winner_team_id INTEGER,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);
legacyDatabase.close();

app.setPath("userData", testUserData);

let db;

function flattenMatches(tournamentData) {
  return tournamentData.rounds.flatMap((round) => round.matches);
}

function assertFailure(result, expectedMessage) {
  assert.equal(result.success, false);
  assert.match(result.message, expectedMessage);
}

try {
  await import("../database/init.js");
  db = (await import("../database/database.js")).default;

  const {
    createRoundRobinTournament,
    finishTournament,
    finishTournamentMatch,
    getLatestTournament,
    getTournamentById,
    getTournamentMatches,
    getTournamentStandings,
    startTournamentMatch,
  } = await import("../database/tournamentQueries.js");
  const { getAvailableCourts, getCourts } = await import(
    "../database/courtQueries.js"
  );
  const { generateRoundRobinSchedule } = await import(
    "../database/tournamentLogic.js"
  );
  const {
    countPlayerLevels,
    getLevelClasses,
    normalizePlayerLevel,
  } = await import("../src/utils/playerLevel.js");

  const migratedColumns = db.prepare(
    "PRAGMA table_info(tournament_matches)",
  ).all();
  assert.equal(
    migratedColumns.some((column) => column.name === "court_id"),
    true,
  );

  for (const teamCount of [2, 3, 4, 5, 6]) {
    const scheduleTeams = Array.from(
      { length: teamCount },
      (_, index) => ({ id: index + 1 }),
    );
    const schedule = generateRoundRobinSchedule(scheduleTeams);
    const expectedRoundCount = teamCount % 2 === 0
      ? teamCount - 1
      : teamCount;
    const expectedMatchCount = teamCount * (teamCount - 1) / 2;
    const pairKeys = new Set();

    assert.equal(schedule.length, expectedRoundCount);

    for (const round of schedule) {
      const teamsUsedThisRound = new Set();

      for (const match of round.matches) {
        assert.notEqual(match.teamAId, match.teamBId);
        assert.equal(teamsUsedThisRound.has(match.teamAId), false);
        assert.equal(teamsUsedThisRound.has(match.teamBId), false);
        teamsUsedThisRound.add(match.teamAId);
        teamsUsedThisRound.add(match.teamBId);

        const pairKey = [match.teamAId, match.teamBId]
          .sort((first, second) => first - second)
          .join("-");
        assert.equal(pairKeys.has(pairKey), false);
        pairKeys.add(pairKey);
      }
    }

    assert.equal(pairKeys.size, expectedMatchCount);
  }

  assert.equal(normalizePlayerLevel("Upper Intermediate"), "upper_intermediate");
  assert.equal(normalizePlayerLevel("upper-intermediate"), "upper_intermediate");
  for (const [level, color] of [
    ["beginner", "yellow"],
    ["Beginner", "yellow"],
    ["intermediate", "green"],
    ["Intermediate", "green"],
    ["upper_intermediate", "blue"],
    ["Upper Intermediate", "blue"],
    ["advanced", "red"],
    ["Advanced", "red"],
  ]) {
    assert.match(getLevelClasses(level), new RegExp(color));
  }

  const selectedPlayers = [
    { level: "Beginner" },
    { level: "beginner" },
    { level: "Upper Intermediate" },
    { level: "advanced" },
  ];
  assert.deepEqual(countPlayerLevels([]), {
    beginner: 0,
    intermediate: 0,
    upper_intermediate: 0,
    advanced: 0,
  });
  assert.equal(countPlayerLevels(selectedPlayers.slice(0, 1)).beginner, 1);
  assert.equal(countPlayerLevels(selectedPlayers.slice(0, 3)).beginner, 2);
  assert.equal(countPlayerLevels(selectedPlayers.slice(0, 3)).upper_intermediate, 1);
  assert.deepEqual(countPlayerLevels(selectedPlayers), {
    beginner: 2,
    intermediate: 0,
    upper_intermediate: 1,
    advanced: 1,
  });

  const insertPlayer = db.prepare(`
    INSERT INTO players (name, level, gender)
    VALUES (?, ?, ?)
  `);
  const levels = [
    "beginner",
    "intermediate",
    "Upper Intermediate",
    "advanced",
    "beginner",
    "intermediate",
  ];
  const players = [];

  for (let index = 1; index <= 6; index += 1) {
    const result = insertPlayer.run(`Male ${index}`, levels[index - 1], "male");
    players.push({
      id: Number(result.lastInsertRowid),
      gender: "male",
      level: levels[index - 1],
    });
  }
  for (let index = 1; index <= 6; index += 1) {
    const result = insertPlayer.run(`Female ${index}`, levels[index - 1], "female");
    players.push({
      id: Number(result.lastInsertRowid),
      gender: "female",
      level: levels[index - 1],
    });
  }

  const insertCourt = db.prepare("INSERT INTO courts (name) VALUES (?)");
  const courtIds = ["Court 1", "Court 2", "Court 3"].map(
    (name) => Number(insertCourt.run(name).lastInsertRowid),
  );

  const malePlayers = players.filter((player) => player.gender === "male");
  const femalePlayers = players.filter((player) => player.gender === "female");
  const tournamentTableNames = [
    "tournaments",
    "tournament_teams",
    "tournament_rounds",
    "tournament_matches",
  ];

  assertFailure(
    createRoundRobinTournament([malePlayers[0]], "singles", "no_gender"),
    /at least two players/,
  );
  assertFailure(
    createRoundRobinTournament(malePlayers.slice(0, 3), "doubles", "no_gender"),
    /at least four players/,
  );
  assertFailure(
    createRoundRobinTournament(malePlayers.slice(0, 5), "doubles", "no_gender"),
    /even number of players/,
  );
  assertFailure(
    createRoundRobinTournament(
      [...malePlayers.slice(0, 3), femalePlayers[0]],
      "doubles",
      "mixed",
    ),
    /equal numbers of male and female players/,
  );
  assertFailure(
    createRoundRobinTournament(
      [malePlayers[0], femalePlayers[0]],
      "singles",
      "mens",
    ),
    /only include male players/,
  );
  assertFailure(
    createRoundRobinTournament(
      [femalePlayers[0], malePlayers[0]],
      "singles",
      "womens",
    ),
    /only include female players/,
  );

  const busyMatchResult = db.prepare(`
    INSERT INTO matches (player_one, player_two, status)
    VALUES (?, ?, 'playing')
  `).run(malePlayers[0].id, malePlayers[1].id);
  assertFailure(
    createRoundRobinTournament(malePlayers.slice(0, 2), "singles", "mens"),
    /not currently available for Tournament selection/,
  );
  db.prepare("DELETE FROM matches WHERE id = ?").run(
    Number(busyMatchResult.lastInsertRowid),
  );

  for (const tableName of tournamentTableNames) {
    const rowCount = db.prepare(
      `SELECT COUNT(*) AS count FROM ${tableName}`,
    ).get();
    assert.equal(
      rowCount.count,
      0,
      `${tableName} should stay empty after validation failures`,
    );
  }

  const singlesResult = createRoundRobinTournament(
    malePlayers.slice(0, 3),
    "singles",
    "mens",
  );
  assert.equal(singlesResult.success, true);
  const singles = singlesResult.data;
  assert.equal(singles.teams.length, 3);
  assert.equal(singles.rounds.length, 3);
  assert.equal(singles.summary.totalMatches, 3);
  assert.ok(singles.teams.every((team) => team.player2 === null));

  const reloadedSingles = getTournamentById(singles.tournament.id);
  assert.equal(reloadedSingles.success, true);
  assert.deepEqual(reloadedSingles.data.summary, singles.summary);
  assert.deepEqual(
    getTournamentMatches(singles.tournament.id).data.rounds,
    reloadedSingles.data.rounds,
  );
  assert.equal(
    getTournamentStandings(singles.tournament.id).data.standings.length,
    singles.teams.length,
  );
  assert.equal(getLatestTournament().data.tournament.id, singles.tournament.id);

  assertFailure(
    createRoundRobinTournament(malePlayers.slice(0, 2), "singles", "mens"),
    /ongoing tournament already exists/,
  );
  assertFailure(
    finishTournament(singles.tournament.id),
    /All matches must be completed/,
  );

  const singlesMatches = flattenMatches(singles);
  const [firstMatch, secondMatch, thirdMatch] = singlesMatches;
  const outsideTeam = singles.teams.find(
    (team) => team.id !== firstMatch.teamAId && team.id !== firstMatch.teamBId,
  );

  assertFailure(
    finishTournamentMatch(firstMatch.id, firstMatch.teamAId),
    /must be started/,
  );
  assertFailure(
    startTournamentMatch(firstMatch.id, undefined),
    /court was not found/,
  );
  assert.deepEqual(
    db.prepare(`
      SELECT court_id, status
      FROM tournament_matches
      WHERE id = ?
    `).get(firstMatch.id),
    { court_id: null, status: "pending" },
  );
  assertFailure(
    startTournamentMatch(firstMatch.id, 999999),
    /court was not found/,
  );

  const firstStart = startTournamentMatch(firstMatch.id, courtIds[0]);
  assert.equal(firstStart.success, true);
  let storedMatch = db.prepare(`
    SELECT court_id, status
    FROM tournament_matches
    WHERE id = ?
  `).get(firstMatch.id);
  assert.equal(Number(storedMatch.court_id), courtIds[0]);
  assert.equal(storedMatch.status, "playing");
  assert.equal(
    db.prepare("SELECT status FROM courts WHERE id = ?").get(courtIds[0]).status,
    "playing",
  );
  assert.equal(
    getAvailableCourts().some((court) => court.id === courtIds[0]),
    false,
  );

  const singlesCourt = getCourts().find((court) => court.id === courtIds[0]);
  assert.equal(singlesCourt.activeMatch.source, "tournament");
  assert.equal(singlesCourt.activeMatch.matchType, "singles");
  assert.equal(singlesCourt.activeMatch.roundNumber > 0, true);
  assert.equal(singlesCourt.activeMatch.teamA.players.length, 1);
  assert.equal(singlesCourt.activeMatch.teamB.players.length, 1);
  assert.deepEqual(
    singlesCourt.activeMatch.teamA.players.map((player) => player.name),
    [firstMatch.teamA.player1.name],
  );
  assert.deepEqual(
    singlesCourt.activeMatch.teamB.players.map((player) => player.name),
    [firstMatch.teamB.player1.name],
  );
  assert.ok(singlesCourt.activeMatch.players.every((player) => player.level));

  assertFailure(
    startTournamentMatch(firstMatch.id, courtIds[1]),
    /already started/,
  );
  assertFailure(
    startTournamentMatch(secondMatch.id, courtIds[0]),
    /no longer available/,
  );

  const secondStart = startTournamentMatch(secondMatch.id, courtIds[1]);
  assert.equal(secondStart.success, true);
  assert.equal(
    getCourts().find((court) => court.id === courtIds[1]).activeMatch.matchId,
    secondMatch.id,
  );

  db.prepare("UPDATE courts SET status = 'playing' WHERE id = ?").run(courtIds[2]);
  assert.equal(getAvailableCourts().length, 0);
  assertFailure(
    startTournamentMatch(thirdMatch.id, courtIds[2]),
    /no longer available/,
  );
  storedMatch = db.prepare(`
    SELECT court_id, status
    FROM tournament_matches
    WHERE id = ?
  `).get(thirdMatch.id);
  assert.equal(storedMatch.court_id, null);
  assert.equal(storedMatch.status, "pending");
  db.prepare("UPDATE courts SET status = 'available' WHERE id = ?").run(courtIds[2]);

  assertFailure(
    finishTournamentMatch(firstMatch.id, outsideTeam.id),
    /selected winner is not part of this match/,
  );

  const teamIds = singles.teams.map((team) => team.id);
  const desiredWinnerByPair = new Map([
    [[teamIds[0], teamIds[1]].sort((a, b) => a - b).join("-"), teamIds[0]],
    [[teamIds[1], teamIds[2]].sort((a, b) => a - b).join("-"), teamIds[1]],
    [[teamIds[0], teamIds[2]].sort((a, b) => a - b).join("-"), teamIds[2]],
  ]);
  const getDesiredWinner = (match) => desiredWinnerByPair.get(
    [match.teamAId, match.teamBId].sort((a, b) => a - b).join("-"),
  );

  const firstFinish = finishTournamentMatch(
    firstMatch.id,
    getDesiredWinner(firstMatch),
  );
  assert.equal(firstFinish.success, true);
  assert.equal(
    db.prepare("SELECT status FROM courts WHERE id = ?").get(courtIds[0]).status,
    "available",
  );
  assert.equal(
    getAvailableCourts().some((court) => court.id === courtIds[0]),
    true,
  );
  assert.equal(
    getCourts().find((court) => court.id === courtIds[0]).activeMatch,
    null,
  );
  assertFailure(
    finishTournamentMatch(firstMatch.id, firstMatch.teamAId),
    /already been completed/,
  );
  assertFailure(
    startTournamentMatch(firstMatch.id, courtIds[0]),
    /already finished/,
  );

  assert.equal(
    finishTournamentMatch(secondMatch.id, getDesiredWinner(secondMatch)).success,
    true,
  );
  assert.equal(startTournamentMatch(thirdMatch.id, courtIds[0]).success, true);
  const singlesAfterResults = finishTournamentMatch(
    thirdMatch.id,
    getDesiredWinner(thirdMatch),
  ).data;

  assert.equal(singlesAfterResults.tournament.status, "finished");
  assert.equal(singlesAfterResults.summary.pendingMatches, 0);
  assert.equal(singlesAfterResults.summary.playingMatches, 0);
  assert.equal(singlesAfterResults.outcome.type, "tie");
  assert.equal(singlesAfterResults.outcome.teams.length, 3);
  assert.ok(singlesAfterResults.standings.every((standing) => (
    standing.matchesPlayed === 2
    && standing.wins === 1
    && standing.losses === 1
  )));

  async function finishEveryPendingMatch(tournamentData) {
    let latestData = tournamentData;
    for (const match of flattenMatches(tournamentData)) {
      if (match.status === "finished") continue;
      const availableCourt = getAvailableCourts()[0];
      assert.ok(availableCourt, "a reusable court should be available");
      const startResult = startTournamentMatch(match.id, availableCourt.id);
      assert.equal(startResult.success, true);
      const result = finishTournamentMatch(match.id, match.teamAId);
      assert.equal(result.success, true);
      latestData = result.data;
    }
    return latestData;
  }

  const standardDoublesResult = createRoundRobinTournament(
    [...malePlayers.slice(0, 4), ...femalePlayers.slice(0, 4)],
    "doubles",
    "no_gender",
  );
  assert.equal(standardDoublesResult.success, true);
  assert.equal(standardDoublesResult.data.teams.length, 4);
  assert.equal(standardDoublesResult.data.rounds.length, 3);
  assert.equal(standardDoublesResult.data.summary.totalMatches, 6);
  assert.ok(standardDoublesResult.data.teams.every((team) => team.player2));

  const doublesMatch = flattenMatches(standardDoublesResult.data)[0];
  assert.equal(startTournamentMatch(doublesMatch.id, courtIds[0]).success, true);

  // Deliberately create a normal match with the same numeric ID as the active
  // tournament match. Court retrieval must keep the two sources separate.
  db.prepare(`
    INSERT INTO matches (id, court_id, player_one, player_two, status)
    VALUES (?, ?, ?, ?, 'playing')
  `).run(
    doublesMatch.id,
    courtIds[1],
    malePlayers[4].id,
    femalePlayers[4].id,
  );
  const insertMatchPlayer = db.prepare(`
    INSERT INTO match_players (match_id, player_id, team, match_type, source)
    VALUES (?, ?, ?, 'singles', 'normal')
  `);
  insertMatchPlayer.run(doublesMatch.id, malePlayers[4].id, 1);
  insertMatchPlayer.run(doublesMatch.id, femalePlayers[4].id, 2);
  db.prepare("UPDATE courts SET status = 'playing' WHERE id = ?").run(courtIds[1]);

  const occupiedCourts = getCourts();
  const tournamentCourt = occupiedCourts.find((court) => court.id === courtIds[0]);
  const normalCourt = occupiedCourts.find((court) => court.id === courtIds[1]);
  assert.equal(tournamentCourt.activeMatch.source, "tournament");
  assert.equal(normalCourt.activeMatch.source, "normal");
  assert.equal(tournamentCourt.activeMatch.matchId, normalCourt.activeMatch.matchId);
  assert.equal(tournamentCourt.activeMatch.teamA.players.length, 2);
  assert.equal(tournamentCourt.activeMatch.teamB.players.length, 2);
  assert.deepEqual(
    tournamentCourt.activeMatch.teamA.players.map((player) => player.name),
    [doublesMatch.teamA.player1.name, doublesMatch.teamA.player2.name],
  );
  assert.deepEqual(
    tournamentCourt.activeMatch.teamB.players.map((player) => player.name),
    [doublesMatch.teamB.player1.name, doublesMatch.teamB.player2.name],
  );
  assert.equal(normalCourt.activeMatch.teamA.players.length, 1);
  assert.equal(normalCourt.activeMatch.teamB.players.length, 1);
  assert.deepEqual(
    normalCourt.activeMatch.players.map((player) => player.name),
    ["Male 5", "Female 5"],
  );

  assert.equal(
    finishTournamentMatch(doublesMatch.id, doublesMatch.teamAId).success,
    true,
  );
  assert.equal(
    db.prepare("SELECT status FROM courts WHERE id = ?").get(courtIds[0]).status,
    "available",
  );
  assert.equal(
    db.prepare("SELECT status FROM courts WHERE id = ?").get(courtIds[1]).status,
    "playing",
    "finishing a tournament match must not release another match's court",
  );
  assert.equal(
    getCourts().find((court) => court.id === courtIds[1]).activeMatch.source,
    "normal",
  );

  db.prepare("UPDATE matches SET status = 'finished' WHERE id = ?").run(doublesMatch.id);
  db.prepare("UPDATE courts SET status = 'available' WHERE id = ?").run(courtIds[1]);

  const finishedStandardDoubles = await finishEveryPendingMatch(
    getTournamentById(standardDoublesResult.data.tournament.id).data,
  );
  assert.equal(finishedStandardDoubles.tournament.status, "finished");
  assert.equal(finishedStandardDoubles.outcome.type, "champion");

  const mixedDoublesResult = createRoundRobinTournament(
    [...malePlayers.slice(0, 4), ...femalePlayers.slice(0, 4)],
    "doubles",
    "mixed",
  );
  assert.equal(mixedDoublesResult.success, true);
  assert.equal(mixedDoublesResult.data.teams.length, 4);
  assert.equal(mixedDoublesResult.data.summary.totalMatches, 6);
  for (const team of mixedDoublesResult.data.teams) {
    assert.deepEqual(
      [team.player1.gender, team.player2.gender].sort(),
      ["female", "male"],
    );
  }

  const storedTeamIds = new Set(
    db.prepare("SELECT id FROM tournament_teams").all()
      .map((row) => Number(row.id)),
  );
  for (const match of flattenMatches(mixedDoublesResult.data)) {
    assert.equal(storedTeamIds.has(match.teamAId), true);
    assert.equal(storedTeamIds.has(match.teamBId), true);
  }

  const finishedMixedDoubles = await finishEveryPendingMatch(
    mixedDoublesResult.data,
  );
  assert.equal(finishedMixedDoubles.tournament.status, "finished");
  assert.equal(finishedMixedDoubles.summary.completedMatches, 6);

  const indexNames = new Set(
    db.prepare(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'index' AND name LIKE '%tournament%'
    `).all().map((row) => row.name),
  );
  assert.equal(indexNames.has("idx_tournament_teams_tournament_id"), true);
  assert.equal(indexNames.has("idx_tournament_rounds_tournament_id"), true);
  assert.equal(indexNames.has("idx_tournament_matches_tournament_id"), true);
  assert.equal(indexNames.has("idx_tournament_matches_round_id"), true);
  assert.equal(indexNames.has("idx_tournament_matches_court_id"), true);
  assert.equal(indexNames.has("uq_tournament_matches_pair"), true);
  assert.equal(indexNames.has("uq_tournament_matches_active_court"), true);

  console.log("Tournament and court integration tests passed.");
  console.log("Validated migration, schedules for 2-6 teams, tournament validation, atomic persistence, start/finish court transactions, no-court rollback, source-safe court data, singles/doubles public data, standings, completion, level colors, selected-level counts, and indexes.");
} catch (error) {
  console.error(error);
  if (db?.open) db.close();
  rmSync(testUserData, { recursive: true, force: true });
  app.exit(1);
}

if (db?.open) db.close();
rmSync(testUserData, { recursive: true, force: true });
app.quit();
