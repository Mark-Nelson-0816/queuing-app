import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { app } from "electron";

const testUserData = mkdtempSync(
  path.join(os.tmpdir(), "badminton-tournament-lifecycle-hardening-"),
);
app.setPath("userData", testUserData);

let db;

// Flattens one renderer-ready configuration into its persisted matches.
function getMatches(configuration) {
  return configuration.groups.flatMap((group) => (
    group.rounds.flatMap((round) => round.matches)
  ));
}

// Confirms a Tournament API failure without depending on thrown IPC errors.
function assertFailure(result, expression) {
  assert.equal(result.success, false);
  assert.match(result.message, expression);
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
    resetTournamentEventConfiguration,
    startTournamentEventMatch,
  } = await import("../database/tournamentQueries.js");
  const { deletePlayerProfile } = await import("../database/playerQueries.js");
  const { getAvailableCourts } = await import("../database/courtQueries.js");

  const insertPlayer = db.prepare(`
    INSERT INTO players (name, level, gender)
    VALUES (?, 'beginner', 'male')
  `);
  const players = ["Lifecycle A", "Lifecycle B", "Lifecycle C", "Lifecycle D"]
    .map((name) => ({ id: Number(insertPlayer.run(name).lastInsertRowid), name }));
  const [playerA] = players;

  const registerToday = db.prepare(`
    INSERT INTO registered_players_today (
      player_id,
      match_count,
      wins,
      losses,
      status,
      is_done_today
    ) VALUES (?, 7, 4, 3, 'available', 0)
  `);
  for (const player of players) registerToday.run(player.id);
  const dailyBefore = db.prepare(`
    SELECT player_id, match_count, wins, losses, status, is_done_today
    FROM registered_players_today
    ORDER BY player_id
  `).all();

  const courtIds = ["Lifecycle Court 1", "Lifecycle Court 2"].map((name) => Number(
    db.prepare("INSERT INTO courts (name) VALUES (?)").run(name).lastInsertRowid,
  ));

  const firstEvent = createTournamentEvent(
    "January Multi-Day Tournament",
    "2026-01-02",
    "2026-01-05",
  );
  const secondEvent = createTournamentEvent(
    "February Multi-Day Tournament",
    "2026-02-10",
    "2026-02-14",
  );
  assert.equal(firstEvent.success, true, firstEvent.message);
  assert.equal(secondEvent.success, true, secondEvent.message);
  const firstEventId = firstEvent.data.tournament.id;
  const secondEventId = secondEvent.data.tournament.id;

  const firstConfiguration = generateTournamentEventConfiguration(
    firstEventId,
    players.map((player) => player.id),
    "adult",
    "singles",
    "mens",
    "beginner",
    () => 0.5,
  );
  assert.equal(firstConfiguration.success, true, firstConfiguration.message);
  const firstConfigurationId = firstConfiguration.data.configuration.id;
  const firstMatches = getMatches(firstConfiguration.data.configuration);
  assert.equal(firstMatches.length, 6);
  assert.equal(firstMatches.filter((match) => (
    [match.teamA, match.teamB].some((team) => (
      team.players.some((player) => player.playerId === playerA.id)
    ))
  )).length, 3, "one player should retain several waiting round-robin matches");

  const activeMatch = firstMatches.find((match) => (
    [match.teamA, match.teamB].some((team) => (
      team.players.some((player) => player.playerId === playerA.id)
    ))
  ));
  const started = startTournamentEventMatch(activeMatch.id, courtIds[0]);
  assert.equal(started.success, true, started.message);
  assert.equal(started.data.tournament.status, "ongoing");
  assertFailure(finishTournamentEvent(firstEventId), /waiting and playing/i);

  // New configurations remain legal while this event is already ongoing.
  const ongoingConfiguration = generateTournamentEventConfiguration(
    firstEventId,
    players.map((player) => player.id),
    "u17",
    "singles",
    "mens",
    "beginner",
    () => 0.5,
  );
  assert.equal(ongoingConfiguration.success, true, ongoingConfiguration.message);
  const ongoingConfigurationId = ongoingConfiguration.data.configuration.id;
  const overlappingWaitingMatch = getMatches(ongoingConfiguration.data.configuration)
    .find((match) => [match.teamA, match.teamB].some((team) => (
      team.players.some((player) => player.playerId === playerA.id)
    )));
  assertFailure(
    startTournamentEventMatch(overlappingWaitingMatch.id, courtIds[1]),
    /already playing another Tournament match on Lifecycle Court 1/i,
  );

  const lifetimeBeforeFinish = db.prepare(`
    SELECT id, total_matches_played, total_wins, total_losses
    FROM players
    WHERE id IN (?, ?)
    ORDER BY id
  `).all(
    activeMatch.teamA.players[0].playerId,
    activeMatch.teamB.players[0].playerId,
  );
  const finished = finishTournamentEventMatch(activeMatch.id, 21, 18);
  assert.equal(finished.success, true, finished.message);
  const lifetimeAfterFinish = db.prepare(`
    SELECT id, total_matches_played, total_wins, total_losses
    FROM players
    WHERE id IN (?, ?)
    ORDER BY id
  `).all(
    activeMatch.teamA.players[0].playerId,
    activeMatch.teamB.players[0].playerId,
  );
  assert.notDeepEqual(lifetimeAfterFinish, lifetimeBeforeFinish);
  assertFailure(
    finishTournamentEventMatch(activeMatch.id, 21, 18),
    /already been completed/i,
  );
  assert.deepEqual(db.prepare(`
    SELECT id, total_matches_played, total_wins, total_losses
    FROM players
    WHERE id IN (?, ?)
    ORDER BY id
  `).all(
    activeMatch.teamA.players[0].playerId,
    activeMatch.teamB.players[0].playerId,
  ), lifetimeAfterFinish);
  assert.deepEqual(db.prepare(`
    SELECT player_id, match_count, wins, losses, status, is_done_today
    FROM registered_players_today
    ORDER BY player_id
  `).all(), dailyBefore);

  // Reset removes finished/waiting/playing rows, releases courts, and keeps lifetime totals.
  const latestFirstConfiguration = getTournamentEvent(firstEventId).data.configurations
    .find((configuration) => configuration.id === firstConfigurationId);
  const secondPlayingMatch = getMatches(latestFirstConfiguration)
    .find((match) => match.status === "waiting");
  assert.equal(startTournamentEventMatch(secondPlayingMatch.id, courtIds[0]).success, true);
  const reset = resetTournamentEventConfiguration(firstConfigurationId);
  assert.equal(reset.success, true, reset.message);
  assert.equal(reset.data.configurations.some(
    (configuration) => configuration.id === firstConfigurationId,
  ), false);
  assert.equal(reset.data.configurations.some(
    (configuration) => configuration.id === ongoingConfigurationId,
  ), true);
  assert.equal(getAvailableCourts().some((court) => court.id === courtIds[0]), true);
  assert.deepEqual(db.prepare(`
    SELECT id, total_matches_played, total_wins, total_losses
    FROM players
    WHERE id IN (?, ?)
    ORDER BY id
  `).all(
    activeMatch.teamA.players[0].playerId,
    activeMatch.teamB.players[0].playerId,
  ), lifetimeAfterFinish);

  const regenerated = generateTournamentEventConfiguration(
    firstEventId,
    players.map((player) => player.id),
    "adult",
    "singles",
    "mens",
    "beginner",
    () => 0.5,
  );
  assert.equal(regenerated.success, true, regenerated.message);

  assertFailure(finishTournamentEvent(firstEventId), /waiting and playing/i);
  const startedOngoing = startTournamentEventMatch(
    overlappingWaitingMatch.id,
    courtIds[0],
  );
  assert.equal(startedOngoing.success, true, startedOngoing.message);
  assertFailure(finishTournamentEvent(firstEventId), /waiting and playing/i);
  assert.equal(finishTournamentEventMatch(
    overlappingWaitingMatch.id,
    18,
    21,
  ).success, true);

  // Complete the other matches in this four-team configuration before finishing.
  for (const match of getMatches(ongoingConfiguration.data.configuration)) {
    if (match.id === overlappingWaitingMatch.id) continue;
    assert.equal(startTournamentEventMatch(match.id, courtIds[0]).success, true);
    assert.equal(finishTournamentEventMatch(match.id, 21, 18).success, true);
  }

  // History keeps snapshots but resolves the corrected current profile name.
  db.prepare(`
    UPDATE players
    SET name = 'Lifecycle A Corrected', level = 'advanced', gender = 'female'
    WHERE id = ?
  `).run(playerA.id);
  const snapshot = getTournamentEvent(firstEventId).data.configurations
    .find((configuration) => configuration.id === ongoingConfigurationId)
    .participants.find((participant) => participant.playerId === playerA.id);
  assert.equal(snapshot.name, "Lifecycle A Corrected");
  assert.equal(snapshot.levelSnapshot, "beginner");
  assert.equal(snapshot.genderSnapshot, "male");
  assert.equal(snapshot.currentLevel, "advanced");
  assert.equal(snapshot.currentGender, "female");
  db.prepare("DELETE FROM registered_players_today WHERE player_id = ?").run(playerA.id);
  assertFailure(deletePlayerProfile(playerA.id), /history.*cannot be deleted safely/i);

  // Remove the regenerated waiting configuration so the completed event can finish.
  assert.equal(resetTournamentEventConfiguration(
    regenerated.data.configuration.id,
  ).success, true);
  const finishedEvent = finishTournamentEvent(firstEventId);
  assert.equal(finishedEvent.success, true, finishedEvent.message);
  assert.equal(finishedEvent.data.tournament.status, "finished");
  assertFailure(resetTournamentEventConfiguration(ongoingConfigurationId), /read-only/i);
  assertFailure(generateTournamentEventConfiguration(
    firstEventId,
    players.map((player) => player.id),
    "u9",
    "singles",
    "mens",
    "beginner",
  ), /read-only/i);

  // A different dated draft may finish independently and remain alongside prior history.
  const finishedSecondEvent = finishTournamentEvent(secondEventId);
  assert.equal(finishedSecondEvent.success, true, finishedSecondEvent.message);
  const history = getTournamentEventHistory();
  assert.equal(history.success, true, history.message);
  assert.deepEqual(history.data.map((event) => event.id), [secondEventId, firstEventId]);
  assert.deepEqual(history.data.map((event) => event.startDate), [
    "2026-02-10",
    "2026-01-02",
  ]);
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);

  console.log("Tournament lifecycle hardening checks passed.");
} catch (error) {
  console.error(error);
  if (db?.open) db.close();
  rmSync(testUserData, { recursive: true, force: true });
  app.exit(1);
}

if (db?.open) db.close();
rmSync(testUserData, { recursive: true, force: true });
app.quit();
