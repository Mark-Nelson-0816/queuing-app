import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { app } from "electron";

const testUserData = mkdtempSync(path.join(os.tmpdir(), "badminton-rotation-test-"));
const testDatabasePath = path.join(testUserData, "badminton.db");

// Existing-database fixture: both tables predate the new rotation columns.
const legacyDatabase = new Database(testDatabasePath);
legacyDatabase.exec(`
  CREATE TABLE players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    level TEXT NOT NULL DEFAULT 'beginner',
    gender TEXT DEFAULT 'male',
    contact_number TEXT DEFAULT 'N/A',
    prefer_mixed INTEGER DEFAULT 0,
    prefer_mens INTEGER DEFAULT 0,
    prefer_womens INTEGER DEFAULT 0,
    prefer_no_gender INTEGER DEFAULT 0,
    total_matches_played INTEGER DEFAULT 0,
    total_wins INTEGER DEFAULT 0,
    total_losses INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE registered_players_today (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id INTEGER NOT NULL,
    match_count INTEGER DEFAULT 0,
    wins INTEGER DEFAULT 0,
    losses INTEGER DEFAULT 0,
    status TEXT DEFAULT 'waiting',
    is_done_today INTEGER DEFAULT 0,
    registered_date DATE DEFAULT CURRENT_DATE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (player_id) REFERENCES players(id)
  );
  INSERT INTO players (
    name, level, gender, prefer_mens, prefer_no_gender
  ) VALUES ('Legacy Player', 'Beginner', 'male', 1, 1);
  INSERT INTO registered_players_today (player_id, status)
  VALUES (1, 'waiting');
`);
legacyDatabase.close();

app.setPath("userData", testUserData);
let db;

function expectFailure(result, expression) {
  assert.equal(result.success, false);
  assert.match(result.message, expression);
}

try {
  await import("../database/init.js");
  await import("../database/init.js?rotation-migration-idempotence=1");
  db = (await import("../database/database.js")).default;

  const logic = await import("../database/rotationLogic.js");
  const rotation = await import("../database/rotationQueries.js");
  const { resetAllData } = await import("../database/resetQueries.js");
  const { getAvailableCourts, getCourts } = await import("../database/courtQueries.js");
  const {
    finishTournamentMatch,
    startTournamentMatch,
  } = await import("../database/tournamentQueries.js");

  const playerColumns = db.prepare("PRAGMA table_info(players)").all();
  const registrationColumns = db.prepare(
    "PRAGMA table_info(registered_players_today)",
  ).all();
  assert.equal(
    playerColumns.some((column) => column.name === "rank_match_preference"),
    true,
  );
  assert.equal(
    registrationColumns.some((column) => column.name === "available_since"),
    true,
  );
  assert.equal(
    db.prepare("SELECT status FROM registered_players_today WHERE id = 1").get().status,
    "available",
  );
  for (const table of [
    "player_team_locks",
    "rotation_matches",
    "rotation_match_players",
  ]) {
    assert.ok(db.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
    ).get(table));
  }

  const basePlayer = (id, level, options = {}) => ({
    id,
    name: options.name || `Player ${id}`,
    level,
    gender: options.gender || "male",
    rankPreference: options.rankPreference || "same_rank",
    matchCount: options.matchCount || 0,
    availableSince: options.availableSince || `2026-08-06 0${id}:00:00`,
    preferMens: true,
    preferWomens: true,
    preferMixed: true,
    preferNoGender: true,
    teammateCounts: options.teammateCounts || {},
    opponentCounts: options.opponentCounts || {},
  });

  assert.throws(() => logic.generateRotationMatches({
    players: [],
    matchType: "singles",
    category: "no_gender",
  }), /at least 2/);
  assert.throws(() => logic.generateRotationMatches({
    players: [basePlayer(1, "beginner")],
    matchType: "singles",
    category: "no_gender",
  }), /at least 2/);

  const duplicateSelection = logic.generateRotationMatches({
    players: [
      basePlayer(1, "beginner"),
      basePlayer(1, "beginner"),
      basePlayer(2, "beginner"),
    ],
    matchType: "singles",
    category: "no_gender",
    random: () => 0.5,
  });
  assert.equal(duplicateSelection.matches.length, 1);
  assert.match(duplicateSelection.warnings[0], /more than once/);

  assert.throws(() => logic.generateRotationMatches({
    players: [
      basePlayer(1, "beginner", { gender: "male" }),
      basePlayer(2, "beginner", { gender: "female" }),
    ],
    matchType: "singles",
    category: "mens",
  }), /only include male/);
  assert.throws(() => logic.generateRotationMatches({
    players: [
      basePlayer(1, "beginner", { gender: "male" }),
      basePlayer(2, "beginner", { gender: "female" }),
    ],
    matchType: "singles",
    category: "womens",
  }), /only include female/);

  const validMixed = logic.generateRotationMatches({
    players: [
      basePlayer(1, "intermediate", { gender: "Male" }),
      basePlayer(2, "intermediate", { gender: "Female" }),
      basePlayer(3, "intermediate", { gender: "male" }),
      basePlayer(4, "intermediate", { gender: "female" }),
    ],
    matchType: "doubles",
    category: "mixed",
    random: () => 0.5,
  });
  assert.equal(validMixed.matches.length, 1);
  assert.equal(validMixed.matches[0].teamA.some((player) => player.gender === "male"), true);
  assert.equal(validMixed.matches[0].teamA.some((player) => player.gender === "female"), true);

  const invalidMixed = logic.generateRotationMatches({
    players: [
      basePlayer(1, "intermediate", { gender: "male" }),
      basePlayer(2, "intermediate", { gender: "male" }),
      basePlayer(3, "intermediate", { gender: "male" }),
      basePlayer(4, "intermediate", { gender: "female" }),
    ],
    matchType: "doubles",
    category: "mixed",
    random: () => 0.5,
  });
  assert.equal(invalidMixed.matches.length, 0);
  assert.match(invalidMixed.unmatchedPlayers[0].reason, /two male and two female/);

  const sameRankTwo = logic.generateRotationMatches({
    players: [basePlayer(1, "Beginner"), basePlayer(2, "beginner")],
    matchType: "singles",
    category: "no_gender",
    random: () => 0.5,
  });
  assert.equal(sameRankTwo.matches.length, 1);
  assert.equal(sameRankTwo.unmatchedPlayers.length, 0);

  const sameRankThree = logic.generateRotationMatches({
    players: [1, 2, 3].map((id) => basePlayer(id, "beginner")),
    matchType: "singles",
    category: "no_gender",
    random: () => 0.5,
  });
  assert.equal(sameRankThree.matches.length, 1);
  assert.equal(sameRankThree.unmatchedPlayers.length, 1);
  assert.match(
    sameRankThree.unmatchedPlayers[0].reason,
    /no remaining same-rank opponent/,
  );
  assert.deepEqual(
    [...sameRankThree.matches[0].teamA, ...sameRankThree.matches[0].teamB]
      .map((player) => player.id)
      .sort(),
    [1, 2],
  );

  const fewerMatchesFairness = logic.generateRotationMatches({
    players: [
      basePlayer(1, "beginner", { matchCount: 5, availableSince: "2026-08-06 08:00:00" }),
      basePlayer(2, "beginner", { matchCount: 0, availableSince: "2026-08-06 08:00:00" }),
      basePlayer(3, "beginner", { matchCount: 0, availableSince: "2026-08-06 08:00:00" }),
    ],
    matchType: "singles",
    category: "no_gender",
    random: () => 0.5,
  });
  assert.deepEqual(
    [...fewerMatchesFairness.matches[0].teamA, ...fewerMatchesFairness.matches[0].teamB]
      .map((player) => player.id)
      .sort(),
    [2, 3],
  );

  const sameRankFour = logic.generateRotationMatches({
    players: [1, 2, 3, 4].map((id) => basePlayer(id, "beginner")),
    matchType: "singles",
    category: "no_gender",
    random: () => 0.5,
  });
  assert.equal(sameRankFour.matches.length, 2);

  const adjacentSingles = logic.generateRotationMatches({
    players: [
      basePlayer(1, "intermediate", { rankPreference: "adjacent_rank" }),
      basePlayer(2, "upper_intermediate", { rankPreference: "adjacent_rank" }),
    ],
    matchType: "singles",
    category: "no_gender",
    random: () => 0.5,
  });
  assert.equal(adjacentSingles.matches.length, 1);
  assert.match(adjacentSingles.matches[0].warnings[0], /Adjacent-rank/);

  const strictAdjacent = logic.generateRotationMatches({
    players: [
      basePlayer(1, "intermediate", { rankPreference: "same_rank" }),
      basePlayer(2, "upper_intermediate", { rankPreference: "adjacent_rank" }),
    ],
    matchType: "singles",
    category: "no_gender",
    random: () => 0.5,
  });
  assert.equal(strictAdjacent.matches.length, 0);

  const largeGapSingles = logic.generateRotationMatches({
    players: [
      basePlayer(1, "beginner", { rankPreference: "adjacent_rank" }),
      basePlayer(2, "advanced", { rankPreference: "adjacent_rank" }),
    ],
    matchType: "singles",
    category: "no_gender",
    random: () => 0.5,
  });
  assert.equal(largeGapSingles.matches.length, 0);

  const repeatedAvoidance = logic.generateRotationMatches({
    players: [
      basePlayer(1, "beginner", { opponentCounts: { 2: 5 } }),
      basePlayer(2, "beginner", { opponentCounts: { 1: 5 } }),
      basePlayer(3, "beginner"),
      basePlayer(4, "beginner"),
    ],
    matchType: "singles",
    category: "no_gender",
    random: () => 0.5,
  });
  assert.equal(repeatedAvoidance.matches.length, 2);
  assert.equal(repeatedAvoidance.matches.some((match) => (
    new Set([...match.teamA, ...match.teamB].map((player) => player.id)).has(1)
    && new Set([...match.teamA, ...match.teamB].map((player) => player.id)).has(2)
  )), false);

  const teammateAvoidance = logic.generateRotationMatches({
    players: [
      basePlayer(1, "intermediate", { teammateCounts: { 2: 5 } }),
      basePlayer(2, "intermediate", { teammateCounts: { 1: 5 } }),
      basePlayer(3, "intermediate", { teammateCounts: { 4: 5 } }),
      basePlayer(4, "intermediate", { teammateCounts: { 3: 5 } }),
    ],
    matchType: "doubles",
    category: "no_gender",
    random: () => 0.5,
  });
  assert.equal(teammateAvoidance.matches.length, 1);
  for (const team of [
    teammateAvoidance.matches[0].teamA,
    teammateAvoidance.matches[0].teamB,
  ]) {
    const idsInTeam = new Set(team.map((player) => player.id));
    assert.equal(idsInTeam.has(1) && idsInTeam.has(2), false);
    assert.equal(idsInTeam.has(3) && idsInTeam.has(4), false);
  }

  const sameRankDoubles = logic.generateRotationMatches({
    players: [1, 2, 3, 4].map((id) => basePlayer(id, "intermediate")),
    matchType: "doubles",
    category: "no_gender",
    random: () => 0.5,
  });
  assert.equal(sameRankDoubles.matches.length, 1);
  assert.equal(sameRankDoubles.matches[0].balanceDifference, 0);

  const defaultDoubles = logic.generateRotationMatches({
    players: [1, 2, 3, 4].map((id) => basePlayer(id, "intermediate")),
    category: "no_gender",
    random: () => 0.5,
  });
  assert.equal(defaultDoubles.matches.length, 1);
  assert.equal(defaultDoubles.matches[0].teamA.length, 2);
  assert.equal(defaultDoubles.matches[0].teamB.length, 2);

  const eightDoubles = logic.generateRotationMatches({
    players: [1, 2, 3, 4, 5, 6, 7, 8].map((id) => basePlayer(id, "intermediate")),
    matchType: "doubles",
    category: "no_gender",
    random: () => 0.5,
  });
  assert.equal(eightDoubles.matches.length, 2);

  const wideLockedPlayers = [
    basePlayer(1, "beginner", { rankPreference: "adjacent_rank" }),
    basePlayer(2, "advanced", { rankPreference: "adjacent_rank" }),
    basePlayer(3, "intermediate", { rankPreference: "adjacent_rank" }),
    basePlayer(4, "upper_intermediate", { rankPreference: "adjacent_rank" }),
  ];
  const wideLocked = logic.generateRotationMatches({
    players: wideLockedPlayers,
    matchType: "doubles",
    category: "no_gender",
    locks: [{ id: 1, player1Id: 1, player2Id: 2 }],
    random: () => 0.5,
  });
  assert.equal(wideLocked.matches.length, 1);
  assert.equal(wideLocked.matches[0].balanceDifference, 0);
  const lockedTeam = [wideLocked.matches[0].teamA, wideLocked.matches[0].teamB]
    .find((team) => team.some((player) => player.id === 1));
  assert.deepEqual(lockedTeam.map((player) => player.id).sort(), [1, 2]);

  const unlockedWideOpponent = logic.generateRotationMatches({
    players: [
      basePlayer(1, "beginner", { rankPreference: "adjacent_rank" }),
      basePlayer(2, "advanced", { rankPreference: "adjacent_rank" }),
      basePlayer(3, "beginner", { rankPreference: "adjacent_rank" }),
      basePlayer(4, "advanced", { rankPreference: "adjacent_rank" }),
    ],
    matchType: "doubles",
    category: "no_gender",
    locks: [{ id: 1, player1Id: 1, player2Id: 2 }],
    random: () => 0.5,
  });
  assert.equal(unlockedWideOpponent.matches.length, 0);
  assert.match(unlockedWideOpponent.unmatchedPlayers[0].reason, /Locked team/);

  const twoWideLockedTeams = logic.generateRotationMatches({
    players: [
      basePlayer(1, "beginner", { rankPreference: "adjacent_rank" }),
      basePlayer(2, "advanced", { rankPreference: "adjacent_rank" }),
      basePlayer(3, "beginner", { rankPreference: "adjacent_rank" }),
      basePlayer(4, "advanced", { rankPreference: "adjacent_rank" }),
    ],
    matchType: "doubles",
    category: "no_gender",
    locks: [
      { id: 1, player1Id: 1, player2Id: 2 },
      { id: 2, player1Id: 3, player2Id: 4 },
    ],
    random: () => 0.5,
  });
  assert.equal(twoWideLockedTeams.matches.length, 1);
  assert.equal(twoWideLockedTeams.matches[0].balanceDifference, 0);

  const strictWideLocked = logic.generateRotationMatches({
    players: wideLockedPlayers.map((player, index) => (
      index === 0 ? { ...player, rankPreference: "same_rank" } : player
    )),
    matchType: "doubles",
    category: "no_gender",
    locks: [{ id: 1, player1Id: 1, player2Id: 2 }],
    random: () => 0.5,
  });
  assert.equal(strictWideLocked.matches.length, 0);
  assert.match(strictWideLocked.unmatchedPlayers[0].reason, /Locked team|Doubles/);

  const insertPlayer = db.prepare(`
    INSERT INTO players (
      name,
      level,
      gender,
      rank_match_preference,
      prefer_mens,
      prefer_womens,
      prefer_mixed,
      prefer_no_gender
    ) VALUES (?, ?, ?, ?, 1, 1, 1, 1)
  `);
  const insertRegistration = db.prepare(`
    INSERT INTO registered_players_today (
      player_id,
      status,
      is_done_today,
      available_since
    ) VALUES (?, 'available', 0, ?)
  `);

  function addDailyPlayer(name, level, gender, rankPreference, minute) {
    const playerId = Number(
      insertPlayer.run(name, level, gender, rankPreference).lastInsertRowid,
    );
    const registrationId = Number(
      insertRegistration.run(
        playerId,
        `2026-08-06 10:${String(minute).padStart(2, "0")}:00`,
      ).lastInsertRowid,
    );
    return { playerId, registrationId };
  }

  const daily = [
    addDailyPlayer("Beginner Man", "beginner", "male", "adjacent_rank", 1),
    addDailyPlayer("Advanced Man", "advanced", "male", "adjacent_rank", 2),
    addDailyPlayer("Intermediate Man", "intermediate", "male", "adjacent_rank", 3),
    addDailyPlayer("Upper Man", "upper_intermediate", "male", "adjacent_rank", 4),
    addDailyPlayer("Same Man 1", "intermediate", "male", "same_rank", 5),
    addDailyPlayer("Same Man 2", "intermediate", "male", "same_rank", 6),
    addDailyPlayer("Same Woman 1", "intermediate", "female", "same_rank", 7),
    addDailyPlayer("Same Woman 2", "intermediate", "female", "same_rank", 8),
    addDailyPlayer("Extra Man 1", "intermediate", "male", "same_rank", 9),
    addDailyPlayer("Extra Man 2", "intermediate", "male", "same_rank", 10),
    addDailyPlayer("Extra Woman 1", "intermediate", "female", "same_rank", 11),
    addDailyPlayer("Extra Woman 2", "intermediate", "female", "same_rank", 12),
  ];
  const ids = daily.map((entry) => entry.playerId);
  db.prepare("INSERT INTO courts (name) VALUES ('Court A'), ('Court B'), ('Court C')").run();

  const eligibleResult = rotation.getEligibleRotationPlayers();
  assert.equal(eligibleResult.success, true);
  assert.equal(eligibleResult.data.find((player) => player.id === 1).eligible, true);

  const initialRotationCount = db.prepare("SELECT COUNT(*) AS count FROM rotation_matches").get().count;
  expectFailure(
    rotation.generateAndSaveRotationMatches([], "singles", "no_gender"),
    /at least 2/,
  );
  expectFailure(
    rotation.generateAndSaveRotationMatches([ids[4], ids[6]], "singles", "mens"),
    /only include male/,
  );
  assert.equal(
    db.prepare("SELECT COUNT(*) AS count FROM rotation_matches").get().count,
    initialRotationCount,
  );

  expectFailure(
    rotation.createTeamLock(ids[0], ids[0], "doubles", "no_gender"),
    /cannot be locked with themselves/,
  );
  expectFailure(
    rotation.createTeamLock(ids[4], ids[5], "doubles", "mixed"),
    /one male and one female/,
  );

  const wideLockResult = rotation.createTeamLock(
    ids[0],
    ids[1],
    "doubles",
    "no_gender",
  );
  assert.equal(wideLockResult.success, true);
  expectFailure(
    rotation.createTeamLock(ids[0], ids[2], "doubles", "no_gender"),
    /already belongs/,
  );

  const wideGenerated = rotation.generateAndSaveRotationMatches(
    [ids[0], ids[1], ids[2], ids[3]],
    "doubles",
    "no_gender",
  );
  assert.equal(wideGenerated.success, true);
  assert.equal(wideGenerated.data.summary.waiting, 1);
  let state = rotation.getRotationState().data;
  let wideMatch = state.matches.find((match) => match.status === "waiting");
  assert.equal(wideMatch.balanceDifference, 0);
  assert.equal(wideMatch.players.every((player) => player.status === "assigned"), true);

  const activeWideLock = rotation.getActiveTeamLocks().data[0];
  const unlocked = rotation.removeTeamLock(activeWideLock.id);
  assert.equal(unlocked.success, true);
  state = rotation.getRotationState().data;
  wideMatch = state.matches.find((match) => match.id === wideMatch.id);
  assert.equal(wideMatch.status, "incomplete");
  assert.match(wideMatch.validationMessage, /incompatible/);
  assert.equal(rotation.cancelWaitingMatch(wideMatch.id).success, true);

  const sameFour = [ids[4], ids[5], ids[6], ids[7]];
  const generated = rotation.generateAndSaveRotationMatches(
    sameFour,
    "doubles",
    "no_gender",
  );
  assert.equal(generated.success, true);
  state = rotation.getRotationState().data;
  let editableMatch = state.matches.find((match) => (
    match.status === "waiting" && match.players.some((player) => player.id === ids[4])
  ));
  assert.ok(editableMatch);

  const removedPlayerId = editableMatch.teamB[1].id;
  assert.equal(rotation.updateWaitingMatch(
    editableMatch.id,
    editableMatch.teamA.map((player) => player.id),
    editableMatch.teamB.slice(0, 1).map((player) => player.id),
  ).success, true);
  state = rotation.getRotationState().data;
  editableMatch = state.matches.find((match) => match.id === editableMatch.id);
  assert.equal(editableMatch.status, "incomplete");
  assert.equal(
    state.players.find((player) => player.id === removedPlayerId).eligible,
    true,
  );

  db.prepare(`
    UPDATE registered_players_today SET status = 'playing'
    WHERE player_id = ? AND registered_date = CURRENT_DATE
  `).run(removedPlayerId);
  expectFailure(rotation.updateWaitingMatch(
    editableMatch.id,
    editableMatch.teamA.map((player) => player.id),
    [...editableMatch.teamB.map((player) => player.id), removedPlayerId],
  ), /not currently available/);
  db.prepare(`
    UPDATE registered_players_today SET status = 'available'
    WHERE player_id = ? AND registered_date = CURRENT_DATE
  `).run(removedPlayerId);

  const refilledMatch = rotation.updateWaitingMatch(
    editableMatch.id,
    [...editableMatch.teamB.map((player) => player.id), removedPlayerId],
    editableMatch.teamA.map((player) => player.id),
  );
  assert.equal(refilledMatch.success, true, refilledMatch.message);
  assert.equal(rotation.rebalanceWaitingMatch(editableMatch.id).success, true);

  const eightIds = [ids[4], ids[5], ids[6], ids[7], ids[8], ids[9], ids[10], ids[11]];
  // Cancel the edited match so all eight are available for two new matches.
  assert.equal(rotation.cancelWaitingMatch(editableMatch.id).success, true);
  const twoMatches = rotation.generateAndSaveRotationMatches(
    eightIds,
    "doubles",
    "no_gender",
  );
  assert.equal(twoMatches.success, true);
  state = rotation.getRotationState().data;
  let waitingMatches = state.matches
    .filter((match) => match.status === "waiting")
    .sort((first, second) => first.queuePosition - second.queuePosition);
  assert.equal(waitingMatches.length, 2);
  const originalSecondId = waitingMatches[1].id;
  assert.equal(rotation.reorderWaitingMatch(originalSecondId, "up").success, true);
  waitingMatches = rotation.getRotationState().data.matches
    .filter((match) => match.status === "waiting")
    .sort((first, second) => first.queuePosition - second.queuePosition);
  assert.equal(waitingMatches[0].id, originalSecondId);

  const firstWaiting = waitingMatches[0];
  const secondWaiting = waitingMatches[1];
  const courtA = Number(db.prepare("SELECT id FROM courts WHERE name = 'Court A'").get().id);
  const courtB = Number(db.prepare("SELECT id FROM courts WHERE name = 'Court B'").get().id);
  const courtC = Number(db.prepare("SELECT id FROM courts WHERE name = 'Court C'").get().id);
  assert.equal(rotation.startRotationMatch(firstWaiting.id, courtA).success, true);
  expectFailure(rotation.startRotationMatch(firstWaiting.id, courtB), /already started/);
  expectFailure(rotation.startRotationMatch(secondWaiting.id, courtA), /no longer available/);
  expectFailure(rotation.finishRotationMatch(secondWaiting.id, 1, []), /Only a playing/);
  expectFailure(rotation.finishRotationMatch(firstWaiting.id, 3, []), /not part of this match/);
  expectFailure(rotation.updateWaitingMatch(
    firstWaiting.id,
    firstWaiting.teamA.map((player) => player.id),
    firstWaiting.teamB.map((player) => player.id),
  ), /Only waiting/);

  const rotationCourt = getCourts().find((court) => court.id === courtA);
  assert.equal(rotationCourt.activeMatch.source, "rotation");
  assert.equal(rotationCourt.activeMatch.matchType, "doubles");
  assert.deepEqual(
    rotationCourt.activeMatch.teamA.players.map((player) => player.name),
    firstWaiting.teamA.map((player) => player.name),
  );
  assert.equal(getAvailableCourts().some((court) => court.id === courtA), false);

  // A court may become stale/occupied after the selection modal opens.
  db.prepare("UPDATE courts SET status = 'playing' WHERE id IN (?, ?)").run(courtB, courtC);
  assert.equal(getAvailableCourts().length, 0);
  expectFailure(rotation.startRotationMatch(secondWaiting.id, courtC), /no longer available/);
  db.prepare("UPDATE courts SET status = 'available' WHERE id IN (?, ?)").run(courtB, courtC);

  // A tournament match deliberately receives the same numeric ID on another court.
  const tournamentId = Number(db.prepare(`
    INSERT INTO tournaments (match_type, category, status)
    VALUES ('singles', 'no_gender', 'ongoing')
  `).run().lastInsertRowid);
  const tournamentTeamInsert = db.prepare(`
    INSERT INTO tournament_teams (tournament_id, player_1_id, team_number)
    VALUES (?, ?, ?)
  `);
  const teamAId = Number(tournamentTeamInsert.run(
    tournamentId,
    secondWaiting.teamA[0].id,
    1,
  ).lastInsertRowid);
  const teamBId = Number(tournamentTeamInsert.run(
    tournamentId,
    secondWaiting.teamB[0].id,
    2,
  ).lastInsertRowid);
  const roundId = Number(db.prepare(`
    INSERT INTO tournament_rounds (tournament_id, round_number) VALUES (?, 1)
  `).run(tournamentId).lastInsertRowid);
  db.prepare(`
    INSERT INTO tournament_matches (
      id, tournament_id, round_id, team_a_id, team_b_id, status
    ) VALUES (?, ?, ?, ?, ?, 'pending')
  `).run(firstWaiting.id, tournamentId, roundId, teamAId, teamBId);
  assert.equal(startTournamentMatch(firstWaiting.id, courtB).success, true);
  const simultaneousCourts = getCourts();
  const activeRotation = simultaneousCourts.find((court) => court.id === courtA).activeMatch;
  const activeTournament = simultaneousCourts.find((court) => court.id === courtB).activeMatch;
  assert.equal(activeRotation.matchId, activeTournament.matchId);
  assert.equal(activeRotation.source, "rotation");
  assert.equal(activeTournament.source, "tournament");
  expectFailure(
    rotation.startRotationMatch(secondWaiting.id, courtC),
    /currently playing a tournament match/,
  );
  const tournamentPlayerIds = [
    secondWaiting.teamA[0].id,
    secondWaiting.teamB[0].id,
  ].sort((first, second) => first - second);
  const tournamentPlayingLockId = Number(db.prepare(`
    INSERT INTO player_team_locks (
      player_1_id, player_2_id, lock_type, lock_date, is_active
    ) VALUES (?, ?, 'today', CURRENT_DATE, 1)
  `).run(...tournamentPlayerIds).lastInsertRowid);
  expectFailure(
    rotation.removeTeamLock(tournamentPlayingLockId),
    /while either player is playing/,
  );
  assert.equal(finishTournamentMatch(firstWaiting.id, teamAId).success, true);
  assert.equal(rotation.removeTeamLock(tournamentPlayingLockId).success, true);

  const donePlayerId = firstWaiting.teamB[0].id;
  const winnerIds = new Set(firstWaiting.teamA.map((player) => player.id));
  assert.equal(rotation.finishRotationMatch(
    firstWaiting.id,
    1,
    [donePlayerId],
  ).success, true);
  expectFailure(
    rotation.finishRotationMatch(firstWaiting.id, 1, []),
    /already been completed/,
  );
  assert.equal(db.prepare("SELECT status FROM courts WHERE id = ?").get(courtA).status, "available");
  assert.equal(getCourts().find((court) => court.id === courtA).activeMatch, null);

  for (const player of firstWaiting.players) {
    const registration = db.prepare(`
      SELECT match_count, wins, losses, status, is_done_today
      FROM registered_players_today
      WHERE player_id = ? AND registered_date = CURRENT_DATE
    `).get(player.id);
    assert.equal(registration.match_count, 1);
    assert.equal(registration.wins, winnerIds.has(player.id) ? 1 : 0);
    assert.equal(registration.losses, winnerIds.has(player.id) ? 0 : 1);
    assert.equal(registration.status, player.id === donePlayerId ? "done" : "available");
    assert.equal(Boolean(registration.is_done_today), player.id === donePlayerId);
    const lifetime = db.prepare(`
      SELECT total_matches_played, total_wins, total_losses FROM players WHERE id = ?
    `).get(player.id);
    assert.equal(lifetime.total_matches_played, 1);
    assert.equal(lifetime.total_wins, winnerIds.has(player.id) ? 1 : 0);
    assert.equal(lifetime.total_losses, winnerIds.has(player.id) ? 0 : 1);
  }

  // Locks remain protected after the match starts, and duplicate start/finish
  // attempts remain harmless because every lifecycle operation is transactional.
  assert.equal(rotation.cancelWaitingMatch(secondWaiting.id).success, true);
  const lockablePlayers = rotation.getEligibleRotationPlayers().data
    .filter((player) => player.eligible && logic.normalizeRotationLevel(player.level) === "intermediate")
    .slice(0, 4);
  assert.equal(lockablePlayers.length, 4);
  const playingLock = rotation.createTeamLock(
    lockablePlayers[0].id,
    lockablePlayers[1].id,
    "doubles",
    "no_gender",
  );
  assert.equal(playingLock.success, true, playingLock.message);
  const playingLockId = rotation.getActiveTeamLocks().data[0].id;
  expectFailure(
    rotation.createTeamLock(
      lockablePlayers[0].id,
      lockablePlayers[1].id,
      "doubles",
      "no_gender",
    ),
    /already belongs/,
  );
  const lockedGenerated = rotation.generateAndSaveRotationMatches(
    lockablePlayers.map((player) => player.id),
    "doubles",
    "no_gender",
  );
  assert.equal(lockedGenerated.success, true, lockedGenerated.message);
  const lockedWaitingMatch = rotation.getRotationState().data.matches.find((match) => (
    match.status === "waiting"
    && match.players.some((player) => player.lockId === playingLockId)
  ));
  assert.ok(lockedWaitingMatch);
  assert.equal(rotation.startRotationMatch(lockedWaitingMatch.id, courtA).success, true);
  expectFailure(rotation.removeTeamLock(playingLockId), /while either player is playing/);
  assert.equal(rotation.finishRotationMatch(lockedWaitingMatch.id, 2, []).success, true);

  // Persistence/reload and database protections.
  const reloaded = rotation.getRotationState();
  assert.equal(reloaded.success, true);
  assert.equal(
    reloaded.data.matches.find((match) => match.id === firstWaiting.id).status,
    "finished",
  );
  const indexes = new Set(db.prepare(`
    SELECT name FROM sqlite_master WHERE type = 'index'
  `).all().map((row) => row.name));
  assert.equal(indexes.has("uq_rotation_active_court"), true);
  assert.equal(indexes.has("uq_rotation_waiting_position"), true);
  assert.equal(indexes.has("uq_active_team_lock_pair"), true);
  assert.equal(db.pragma("foreign_keys", { simple: true }), 1);
  assert.deepEqual(db.pragma("foreign_key_check"), []);
  assert.deepEqual(db.pragma("integrity_check"), [{ integrity_check: "ok" }]);

  assert.equal(resetAllData().success, true);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM players").get().count, 0);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM rotation_matches").get().count, 0);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM tournaments").get().count, 0);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM courts").get().count, 3);

  console.log("Rotation queue integration tests passed.");
  console.log("Validated existing-schema migration, rank compatibility, fairness, locks, unmatched players, waiting edits, rebalancing, ordering, cancellation, source-safe courts, lifecycle transactions, statistics, player return/done state, and persistence.");
} catch (error) {
  console.error(error);
  if (db?.open) db.close();
  rmSync(testUserData, { recursive: true, force: true });
  app.exit(1);
}

if (db?.open) db.close();
rmSync(testUserData, { recursive: true, force: true });
app.quit();
