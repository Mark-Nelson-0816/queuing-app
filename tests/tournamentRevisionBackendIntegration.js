import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { app } from "electron";

const testUserData = mkdtempSync(
  path.join(os.tmpdir(), "badminton-tournament-revision-backend-"),
);
app.setPath("userData", testUserData);

let db;

// Makes randomized team/group membership repeatable in integration assertions.
function createSeededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

// Confirms a Tournament operation fails without throwing across the API boundary.
function assertFailure(result, expression) {
  assert.equal(result.success, false);
  assert.match(result.message, expression);
}

// Flattens the renderer-ready group/round match hierarchy.
function getConfigurationMatches(configuration) {
  return configuration.groups.flatMap((group) => (
    group.rounds.flatMap((round) => round.matches)
  ));
}

// Finds a generated match containing a permanent player profile.
function findMatchWithPlayer(configuration, playerId, status = "waiting") {
  return getConfigurationMatches(configuration).find((match) => (
    match.status === status
    && [match.teamA, match.teamB].some((team) => (
      team.players.some((player) => player.playerId === playerId)
    ))
  ));
}

// Converts an expected winner into authoritative score inputs.
function finishWithWinner(finishMatch, match, winnerTeamId) {
  return winnerTeamId === match.teamAId
    ? finishMatch(match.id, 21, 18)
    : finishMatch(match.id, 18, 21);
}

try {
  await import("../database/init.js");
  db = (await import("../database/database.js")).default;
  const {
    createTournamentEvent,
    finishTournamentEvent,
    finishTournamentEventMatch,
    generateTournamentEventConfiguration,
    getTournamentEvent,
    getTournamentEventHistory,
    listTournamentEvents,
    resetTournamentEventConfiguration,
    startTournamentEventMatch,
  } = await import("../database/tournamentQueries.js");
  const { getCourts } = await import("../database/courtQueries.js");
  const { deletePlayerProfile } = await import("../database/playerQueries.js");

  assertFailure(
    createTournamentEvent("", "2026-09-01", "2026-09-02"),
    /name is required/i,
  );
  assertFailure(
    createTournamentEvent("Bad Dates", "2026-09-03", "2026-09-02"),
    /start date/i,
  );
  assertFailure(
    createTournamentEvent("Invalid Date", "2026-02-30", "2026-03-01"),
    /valid date/i,
  );

  const firstEvent = createTournamentEvent(
    "City Tournament",
    "2026-09-01",
    "2026-09-03",
  );
  const secondEvent = createTournamentEvent(
    "Junior Tournament",
    "2026-10-01",
    "2026-10-02",
  );
  assert.equal(firstEvent.success, true, firstEvent.message);
  assert.equal(secondEvent.success, true, secondEvent.message);
  assert.equal(firstEvent.data.tournament.status, "draft");
  assert.equal(secondEvent.data.tournament.status, "draft");
  const firstEventId = firstEvent.data.tournament.id;
  const secondEventId = secondEvent.data.tournament.id;

  let eventList = listTournamentEvents();
  assert.equal(eventList.success, true);
  assert.equal(eventList.data.length, 2);
  assert.ok(eventList.data.every((event) => event.status === "draft"));
  assert.deepEqual(getTournamentEventHistory().data, []);

  const insertPlayer = db.prepare(`
    INSERT INTO players (
      name,
      level,
      gender,
      prefer_mens,
      prefer_womens,
      prefer_mixed,
      prefer_no_gender
    ) VALUES (?, ?, ?, 0, 0, 0, 0)
  `);
  const players = [
    ["Aaron Backend", "beginner", "male"],
    ["Ben Backend", "beginner", "male"],
    ["Carlo Backend", "beginner", "male"],
    ["Daniel Backend", "beginner", "male"],
    ["Ethan Backend", "beginner", "male"],
    ["Anna Backend", "beginner", "female"],
    ["Bea Backend", "beginner", "female"],
    ["Chloe Backend", "beginner", "female"],
    ["Faith Backend", "beginner", "female"],
    ["Diana Backend", "advanced", "female"],
    ["Ella Backend", "advanced", "female"],
    ["Fiona Backend", "advanced", "female"],
    ["Gina Backend", "advanced", "female"],
  ].map(([name, level, gender]) => {
    const result = insertPlayer.run(name, level, gender);
    return {
      id: Number(result.lastInsertRowid),
      name,
      level,
      gender,
    };
  });
  const [
    aaron,
    ben,
    carlo,
    daniel,
    ethan,
    anna,
    bea,
    chloe,
    faith,
    diana,
    ella,
    fiona,
    gina,
  ] = players;

  const courtIds = ["Court 1", "Court 2", "Court 3"].map((name) => Number(
    db.prepare("INSERT INTO courts (name) VALUES (?)").run(name).lastInsertRowid,
  ));

  const baseCounts = Object.fromEntries([
    "tournament_configurations",
    "tournament_participants",
    "tournament_groups",
    "tournament_teams",
    "tournament_team_players",
    "tournament_rounds",
    "tournament_matches",
  ].map((table) => [
    table,
    Number(db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count),
  ]));

  assertFailure(generateTournamentEventConfiguration(
    firstEventId,
    [aaron.id, 999999],
    "adult",
    "singles",
    "mens",
    "beginner",
    createSeededRandom(1),
  ), /player 999999 was not found/i);
  for (const [table, count] of Object.entries(baseCounts)) {
    assert.equal(
      db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count,
      count,
      `${table} changed after missing-profile validation`,
    );
  }

  assertFailure(generateTournamentEventConfiguration(
    firstEventId,
    [aaron.id, aaron.id],
    "adult",
    "singles",
    "mens",
    "beginner",
  ), /only appear once/i);
  assertFailure(generateTournamentEventConfiguration(
    firstEventId,
    [aaron.id, diana.id],
    "adult",
    "singles",
    "no_gender",
    "beginner",
  ), /configuration level/i);
  assertFailure(generateTournamentEventConfiguration(
    firstEventId,
    [aaron.id, anna.id],
    "adult",
    "singles",
    "mens",
    "beginner",
  ), /only include male players/i);
  assertFailure(generateTournamentEventConfiguration(
    firstEventId,
    [aaron.id, ben.id, carlo.id],
    "u9",
    "singles",
    "mens",
    "beginner",
  ), /requires at least 4 teams/i);
  assertFailure(generateTournamentEventConfiguration(
    firstEventId,
    [aaron.id, ben.id, carlo.id, daniel.id, ethan.id, anna.id, bea.id],
    "u11",
    "singles",
    "no_gender",
    "beginner",
  ), /exactly 7 teams are not supported/i);
  for (const [table, count] of Object.entries(baseCounts)) {
    assert.equal(
      db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count,
      count,
      `${table} changed after team-count validation`,
    );
  }

  const adultSinglesResult = generateTournamentEventConfiguration(
    firstEventId,
    [aaron.id, ben.id, carlo.id, daniel.id],
    "adult",
    "singles",
    "mens",
    "beginner",
    createSeededRandom(10),
  );
  assert.equal(adultSinglesResult.success, true, adultSinglesResult.message);
  const adultSinglesId = adultSinglesResult.data.configuration.id;
  assert.equal(adultSinglesResult.data.configuration.participants.length, 4);
  assert.equal(adultSinglesResult.data.configuration.teams.length, 4);
  assert.equal(adultSinglesResult.data.configuration.groups.length, 1);
  assert.equal(getConfigurationMatches(adultSinglesResult.data.configuration).length, 6);
  assert.ok(getConfigurationMatches(adultSinglesResult.data.configuration).every(
    (match) => match.status === "waiting" && match.court === null,
  ));

  const countsBeforeDuplicate = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM tournament_configurations) AS configurations,
      (SELECT COUNT(*) FROM tournament_matches) AS matches
  `).get();
  assertFailure(generateTournamentEventConfiguration(
    firstEventId,
    [aaron.id, ben.id, carlo.id, daniel.id],
    "adult",
    "singles",
    "mens",
    "beginner",
  ), /exact Tournament configuration already exists/i);
  assert.deepEqual(db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM tournament_configurations) AS configurations,
      (SELECT COUNT(*) FROM tournament_matches) AS matches
  `).get(), countsBeforeDuplicate);

  // The same player may join an independent division configuration.
  const juniorSinglesResult = generateTournamentEventConfiguration(
    firstEventId,
    [aaron.id, ben.id, anna.id, bea.id],
    "u17",
    "singles",
    "no_gender",
    "beginner",
    createSeededRandom(20),
  );
  assert.equal(juniorSinglesResult.success, true, juniorSinglesResult.message);
  const juniorSinglesId = juniorSinglesResult.data.configuration.id;
  assert.equal(juniorSinglesResult.data.configuration.teams.length, 4);

  const mixedDoublesResult = generateTournamentEventConfiguration(
    firstEventId,
    [ben.id, carlo.id, daniel.id, ethan.id, anna.id, bea.id, chloe.id, faith.id],
    "adult",
    "doubles",
    "mixed",
    "beginner",
    createSeededRandom(30),
  );
  assert.equal(mixedDoublesResult.success, true, mixedDoublesResult.message);
  const mixedDoublesId = mixedDoublesResult.data.configuration.id;
  assert.equal(mixedDoublesResult.data.configuration.teams.length, 4);
  assert.ok(mixedDoublesResult.data.configuration.teams.every((team) => (
    new Set(team.players.map((player) => player.genderSnapshot)).size === 2
  )));

  const tiedGroupResult = generateTournamentEventConfiguration(
    firstEventId,
    [ben.id, carlo.id, daniel.id, ethan.id],
    "u13",
    "singles",
    "mens",
    "beginner",
    createSeededRandom(35),
  );
  assert.equal(tiedGroupResult.success, true, tiedGroupResult.message);
  const tiedGroupConfigurationId = tiedGroupResult.data.configuration.id;

  // A second draft gets valid matches but cannot become ongoing simultaneously.
  const secondEventConfiguration = generateTournamentEventConfiguration(
    secondEventId,
    [diana.id, ella.id, fiona.id, gina.id],
    "u15",
    "singles",
    "womens",
    "advanced",
    createSeededRandom(40),
  );
  assert.equal(
    secondEventConfiguration.success,
    true,
    secondEventConfiguration.message,
  );
  const secondEventMatch = getConfigurationMatches(
    secondEventConfiguration.data.configuration,
  ).find((match) => [match.teamA, match.teamB].some((team) => (
    team.players.some((player) => player.playerId === diana.id)
  )));

  // Names are current-profile data while level/gender remain Tournament snapshots.
  db.prepare(`
    UPDATE players
    SET name = 'Aaron Renamed', level = 'advanced', gender = 'female'
    WHERE id = ?
  `).run(aaron.id);
  let firstEventData = getTournamentEvent(firstEventId).data;
  const juniorParticipant = firstEventData.configurations
    .find((configuration) => configuration.id === juniorSinglesId)
    .participants.find((participant) => participant.playerId === aaron.id);
  assert.equal(juniorParticipant.name, "Aaron Renamed");
  assert.equal(juniorParticipant.levelSnapshot, "beginner");
  assert.equal(juniorParticipant.genderSnapshot, "male");
  assert.equal(juniorParticipant.currentLevel, "advanced");
  assert.equal(juniorParticipant.currentGender, "female");

  let adultSingles = firstEventData.configurations.find(
    (configuration) => configuration.id === adultSinglesId,
  );
  const aaronAdultMatch = findMatchWithPlayer(adultSingles, aaron.id);
  assert.ok(aaronAdultMatch);

  assertFailure(
    finishTournamentEventMatch(aaronAdultMatch.id, 21, 18),
    /must be started/i,
  );
  const startedAdultMatch = startTournamentEventMatch(
    aaronAdultMatch.id,
    courtIds[0],
  );
  assert.equal(startedAdultMatch.success, true, startedAdultMatch.message);
  assert.equal(startedAdultMatch.data.tournament.status, "ongoing");
  assert.equal(
    db.prepare("SELECT status FROM courts WHERE id = ?").get(courtIds[0]).status,
    "playing",
  );
  const publicTournamentMatch = getCourts()
    .find((court) => court.id === courtIds[0])
    .activeMatch;
  assert.equal(publicTournamentMatch.source, "tournament");
  assert.equal(publicTournamentMatch.tournamentName, "City Tournament");
  assert.equal(publicTournamentMatch.division, "adult");
  assert.equal(publicTournamentMatch.matchType, "singles");
  assert.equal(publicTournamentMatch.category, "mens");
  assert.equal(publicTournamentMatch.level, "beginner");
  assert.equal(publicTournamentMatch.groupName, "Group A");
  assert.equal(publicTournamentMatch.teamA.players.length, 1);
  assert.equal(publicTournamentMatch.teamB.players.length, 1);

  const juniorSingles = startedAdultMatch.data.configurations.find(
    (configuration) => configuration.id === juniorSinglesId,
  );
  const juniorMatch = findMatchWithPlayer(juniorSingles, aaron.id);
  assertFailure(
    startTournamentEventMatch(juniorMatch.id, courtIds[1]),
    /already playing another Tournament match on Court 1/i,
  );
  assert.equal(
    db.prepare("SELECT status FROM courts WHERE id = ?").get(courtIds[1]).status,
    "available",
  );

  const anotherWaitingMatch = getConfigurationMatches(
    startedAdultMatch.data.configurations.find(
      (configuration) => configuration.id === adultSinglesId,
    ),
  ).find((match) => match.status === "waiting");
  assertFailure(
    startTournamentEventMatch(anotherWaitingMatch.id, courtIds[0]),
    /court is no longer available/i,
  );

  assertFailure(
    startTournamentEventMatch(secondEventMatch.id, courtIds[2]),
    /one Tournament may be ongoing|UNIQUE constraint/i,
  );
  assert.equal(getTournamentEvent(secondEventId).data.tournament.status, "draft");
  assert.equal(
    db.prepare("SELECT status FROM courts WHERE id = ?").get(courtIds[2]).status,
    "available",
  );

  const winnerTeamId = aaronAdultMatch.teamAId;
  const matchPlayerIds = [aaronAdultMatch.teamA, aaronAdultMatch.teamB]
    .flatMap((team) => team.players.map((player) => player.playerId));
  const statsBeforeSingles = new Map(db.prepare(`
    SELECT id, total_matches_played, total_wins, total_losses
    FROM players
    WHERE id IN (${matchPlayerIds.map(() => "?").join(",")})
  `).all(...matchPlayerIds).map((row) => [Number(row.id), row]));
  assertFailure(
    finishTournamentEventMatch(aaronAdultMatch.id, 20, 20),
    /scores cannot be equal/i,
  );
  const finishedAdultMatch = finishWithWinner(
    finishTournamentEventMatch,
    aaronAdultMatch,
    winnerTeamId,
  );
  assert.equal(finishedAdultMatch.success, true, finishedAdultMatch.message);
  assert.equal(
    db.prepare("SELECT status FROM courts WHERE id = ?").get(courtIds[0]).status,
    "available",
  );
  for (const team of [aaronAdultMatch.teamA, aaronAdultMatch.teamB]) {
    const isWinner = team.id === winnerTeamId;
    for (const player of team.players) {
      const stats = db.prepare(`
        SELECT total_matches_played, total_wins, total_losses
        FROM players WHERE id = ?
      `).get(player.playerId);
      const before = statsBeforeSingles.get(player.playerId);
      assert.equal(stats.total_matches_played, before.total_matches_played + 1);
      assert.equal(stats.total_wins, before.total_wins + (isWinner ? 1 : 0));
      assert.equal(stats.total_losses, before.total_losses + (isWinner ? 0 : 1));
    }
  }
  const statsAfterSingles = db.prepare(`
    SELECT id, total_matches_played, total_wins, total_losses
    FROM players
    WHERE id IN (${matchPlayerIds.map(() => "?").join(",")})
    ORDER BY id
  `).all(...matchPlayerIds);
  assertFailure(
    finishTournamentEventMatch(aaronAdultMatch.id, 21, 18),
    /already been completed/i,
  );
  assert.deepEqual(db.prepare(`
    SELECT id, total_matches_played, total_wins, total_losses
    FROM players
    WHERE id IN (${matchPlayerIds.map(() => "?").join(",")})
    ORDER BY id
  `).all(...matchPlayerIds), statsAfterSingles);

  assertFailure(
    startTournamentEventMatch(aaronAdultMatch.id, courtIds[0]),
    /Only a waiting|already started/i,
  );

  // Complete the four-team group and verify the derived winner standings.
  assert.equal(startTournamentEventMatch(juniorMatch.id, courtIds[0]).success, true);
  const juniorChampionId = juniorMatch.teamBId;
  const juniorFinished = finishWithWinner(
    finishTournamentEventMatch,
    juniorMatch,
    juniorChampionId,
  );
  assert.equal(juniorFinished.success, true, juniorFinished.message);
  let juniorLifecycleData = juniorFinished.data;
  for (const match of getConfigurationMatches(juniorSingles)) {
    if (match.id === juniorMatch.id) continue;
    assert.equal(startTournamentEventMatch(match.id, courtIds[0]).success, true);
    const winnerTeamId = [match.teamAId, match.teamBId].includes(juniorChampionId)
      ? juniorChampionId
      : match.teamAId;
    const completed = finishWithWinner(finishTournamentEventMatch, match, winnerTeamId);
    assert.equal(completed.success, true, completed.message);
    juniorLifecycleData = completed.data;
  }
  const completedJuniorGroup = juniorLifecycleData.configurations
    .find((configuration) => configuration.id === juniorSinglesId)
    .groups[0];
  assert.equal(completedJuniorGroup.standings[0].wins, 3);
  assert.equal(completedJuniorGroup.result.type, "winner");
  assert.equal(completedJuniorGroup.result.team.id, juniorChampionId);

  // Complete Mixed Doubles and verify all four permanent profiles update once.
  const mixedConfiguration = juniorLifecycleData.configurations.find(
    (configuration) => configuration.id === mixedDoublesId,
  );
  const mixedMatch = getConfigurationMatches(mixedConfiguration)[0];
  const mixedPlayerIds = [mixedMatch.teamA, mixedMatch.teamB]
    .flatMap((team) => team.players.map((player) => player.playerId));
  const mixedStatsBefore = new Map(db.prepare(`
    SELECT id, total_matches_played, total_wins, total_losses
    FROM players
    WHERE id IN (${mixedPlayerIds.map(() => "?").join(",")})
  `).all(...mixedPlayerIds).map((row) => [Number(row.id), row]));
  assert.equal(startTournamentEventMatch(mixedMatch.id, courtIds[0]).success, true);
  const mixedFinished = finishWithWinner(
    finishTournamentEventMatch,
    mixedMatch,
    mixedMatch.teamAId,
  );
  assert.equal(mixedFinished.success, true, mixedFinished.message);
  for (const team of [mixedMatch.teamA, mixedMatch.teamB]) {
    const isWinner = team.id === mixedMatch.teamAId;
    for (const player of team.players) {
      const stats = db.prepare(`
        SELECT total_matches_played, total_wins, total_losses
        FROM players WHERE id = ?
      `).get(player.playerId);
      const before = mixedStatsBefore.get(player.playerId);
      assert.equal(stats.total_matches_played, before.total_matches_played + 1);
      assert.equal(stats.total_wins, before.total_wins + (isWinner ? 1 : 0));
      assert.equal(stats.total_losses, before.total_losses + (isWinner ? 0 : 1));
    }
  }
  assert.equal(
    db.prepare("SELECT COUNT(*) AS count FROM registered_players_today").get().count,
    0,
  );

  let mixedLifecycleData = mixedFinished.data;
  for (const match of getConfigurationMatches(mixedConfiguration)) {
    if (match.id === mixedMatch.id) continue;
    assert.equal(startTournamentEventMatch(match.id, courtIds[0]).success, true);
    const completed = finishWithWinner(finishTournamentEventMatch, match, match.teamAId);
    assert.equal(completed.success, true, completed.message);
    mixedLifecycleData = completed.data;
  }

  // A four-team result can produce a completed shared lead with no tiebreaker.
  let tiedConfiguration = mixedLifecycleData.configurations.find(
    (configuration) => configuration.id === tiedGroupConfigurationId,
  );
  const tiedTeamIds = tiedConfiguration.teams.map((team) => team.id);
  const [firstTiedTeamId, secondTiedTeamId, thirdTiedTeamId, fourthTiedTeamId] = tiedTeamIds;
  const tieWinnerByPair = new Map([
    [[firstTiedTeamId, secondTiedTeamId].sort((a, b) => a - b).join("-"), secondTiedTeamId],
    [[firstTiedTeamId, thirdTiedTeamId].sort((a, b) => a - b).join("-"), firstTiedTeamId],
    [[firstTiedTeamId, fourthTiedTeamId].sort((a, b) => a - b).join("-"), firstTiedTeamId],
    [[secondTiedTeamId, thirdTiedTeamId].sort((a, b) => a - b).join("-"), secondTiedTeamId],
    [[secondTiedTeamId, fourthTiedTeamId].sort((a, b) => a - b).join("-"), fourthTiedTeamId],
    [[thirdTiedTeamId, fourthTiedTeamId].sort((a, b) => a - b).join("-"), thirdTiedTeamId],
  ]);
  let tieLifecycleData = mixedLifecycleData;
  for (const match of getConfigurationMatches(tiedConfiguration)) {
    assert.equal(startTournamentEventMatch(match.id, courtIds[0]).success, true);
    const pairKey = [match.teamAId, match.teamBId]
      .sort((a, b) => a - b)
      .join("-");
    const finished = finishWithWinner(
      finishTournamentEventMatch,
      match,
      tieWinnerByPair.get(pairKey),
    );
    assert.equal(finished.success, true, finished.message);
    tieLifecycleData = finished.data;
  }
  tiedConfiguration = tieLifecycleData.configurations.find(
    (configuration) => configuration.id === tiedGroupConfigurationId,
  );
  assert.equal(tiedConfiguration.groups[0].result.type, "tie");
  assert.equal(tiedConfiguration.groups[0].result.wins, 2);
  assert.equal(tiedConfiguration.groups[0].result.teams.length, 2);
  assert.deepEqual(
    tiedConfiguration.groups[0].standings.map((standing) => standing.wins),
    [2, 2, 1, 1],
  );

  // Reset removes finished and playing data from one configuration only.
  firstEventData = tieLifecycleData;
  adultSingles = firstEventData.configurations.find(
    (configuration) => configuration.id === adultSinglesId,
  );
  const nextAdultMatch = getConfigurationMatches(adultSingles).find(
    (match) => match.status === "waiting",
  );
  assert.equal(startTournamentEventMatch(nextAdultMatch.id, courtIds[0]).success, true);
  const lifetimeBeforeReset = db.prepare(`
    SELECT total_matches_played, total_wins, total_losses
    FROM players WHERE id = ?
  `).get(aaron.id);
  const resetResult = resetTournamentEventConfiguration(adultSinglesId);
  assert.equal(resetResult.success, true, resetResult.message);
  assert.equal(
    resetResult.data.configurations.some(
      (configuration) => configuration.id === adultSinglesId,
    ),
    false,
  );
  assert.equal(
    resetResult.data.configurations.some(
      (configuration) => configuration.id === juniorSinglesId,
    ),
    true,
  );
  assert.equal(
    resetResult.data.configurations.some(
      (configuration) => configuration.id === mixedDoublesId,
    ),
    true,
  );
  assert.equal(
    resetResult.data.configurations.some(
      (configuration) => configuration.id === tiedGroupConfigurationId,
    ),
    true,
  );
  assert.equal(
    db.prepare("SELECT status FROM courts WHERE id = ?").get(courtIds[0]).status,
    "available",
  );
  assert.deepEqual(db.prepare(`
    SELECT total_matches_played, total_wins, total_losses
    FROM players WHERE id = ?
  `).get(aaron.id), lifetimeBeforeReset);
  for (const table of [
    "tournament_participants",
    "tournament_groups",
    "tournament_teams",
    "tournament_rounds",
    "tournament_matches",
  ]) {
    assert.equal(
      db.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE configuration_id = ?`)
        .get(adultSinglesId).count,
      0,
    );
  }

  // No waiting/playing matches remain, so the explicit finish is now allowed.
  const finishedEvent = finishTournamentEvent(firstEventId);
  assert.equal(finishedEvent.success, true, finishedEvent.message);
  assert.equal(finishedEvent.data.tournament.status, "finished");
  assertFailure(finishTournamentEvent(firstEventId), /already been finished/i);
  assertFailure(resetTournamentEventConfiguration(juniorSinglesId), /read-only/i);
  assertFailure(generateTournamentEventConfiguration(
    firstEventId,
    [ben.id, carlo.id],
    "u11",
    "singles",
    "mens",
    "beginner",
  ), /read-only/i);
  assertFailure(
    startTournamentEventMatch(juniorMatch.id, courtIds[0]),
    /read-only/i,
  );
  assertFailure(
    finishTournamentEventMatch(juniorMatch.id, 18, 21),
    /read-only/i,
  );

  const history = getTournamentEventHistory();
  assert.equal(history.success, true);
  assert.equal(history.data.length, 1);
  assert.equal(history.data[0].id, firstEventId);
  assert.equal(history.data[0].status, "finished");
  assert.equal(history.data[0].configurationCount, 3);
  assert.equal(getTournamentEvent(firstEventId).data.tournament.name, "City Tournament");

  // Tournament participation protects the permanent profile at query and FK levels.
  const protectedDelete = deletePlayerProfile(anna.id);
  assertFailure(protectedDelete, /history.*cannot be deleted safely/i);
  assert.throws(
    () => db.prepare("DELETE FROM players WHERE id = ?").run(anna.id),
    /Tournament history|FOREIGN KEY constraint/i,
  );

  // Finishing is rejected while another draft still has a waiting match.
  assertFailure(
    finishTournamentEvent(secondEventId),
    /waiting and playing Tournament matches/i,
  );

  // Rotation participation does not block a player on a different Tournament court.
  const registrationIds = [diana, ella].map((player) => Number(db.prepare(`
    INSERT INTO registered_players_today (player_id, status, is_done_today)
    VALUES (?, 'playing', 0)
  `).run(player.id).lastInsertRowid));
  const rotationMatchId = Number(db.prepare(`
    INSERT INTO rotation_matches (
      match_type,
      category,
      status,
      court_id,
      team_a_strength,
      team_b_strength,
      balance_difference
    ) VALUES ('singles', 'womens', 'playing', ?, 1, 1, 0)
  `).run(courtIds[1]).lastInsertRowid);
  db.prepare("UPDATE courts SET status = 'playing' WHERE id = ?").run(courtIds[1]);
  const insertRotationPlayer = db.prepare(`
    INSERT INTO rotation_match_players (
      rotation_match_id,
      registered_player_id,
      player_id,
      team,
      slot
    ) VALUES (?, ?, ?, ?, 1)
  `);
  insertRotationPlayer.run(rotationMatchId, registrationIds[0], diana.id, 1);
  insertRotationPlayer.run(rotationMatchId, registrationIds[1], ella.id, 2);

  const secondStart = startTournamentEventMatch(secondEventMatch.id, courtIds[0]);
  assert.equal(secondStart.success, true, secondStart.message);
  assert.equal(secondStart.data.tournament.status, "ongoing");

  eventList = listTournamentEvents();
  assert.equal(eventList.data.find((event) => event.id === firstEventId).status, "finished");
  assert.equal(eventList.data.find((event) => event.id === secondEventId).status, "ongoing");
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);

  console.log("Revised Tournament backend integration checks passed.");
} catch (error) {
  console.error(error);
  if (db?.open) db.close();
  rmSync(testUserData, { recursive: true, force: true });
  app.exit(1);
}

if (db?.open) db.close();
rmSync(testUserData, { recursive: true, force: true });
app.quit();
