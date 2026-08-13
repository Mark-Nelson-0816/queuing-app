import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { app } from "electron";

const testUserData = mkdtempSync(
  path.join(os.tmpdir(), "badminton-tournament-deletion-"),
);
app.setPath("userData", testUserData);

let db;

function getMatches(configuration) {
  return configuration.groups.flatMap((group) => (
    group.rounds.flatMap((round) => round.matches)
  ));
}

function assertFailure(result, expression) {
  assert.equal(result.success, false);
  assert.match(result.message, expression);
}

function getEventOwnedCounts(tournamentId) {
  return {
    configurations: Number(db.prepare(`
      SELECT COUNT(*) AS count FROM tournament_configurations WHERE tournament_id = ?
    `).get(tournamentId).count),
    participants: Number(db.prepare(`
      SELECT COUNT(*) AS count
      FROM tournament_participants
      JOIN tournament_configurations
        ON tournament_configurations.id = tournament_participants.configuration_id
      WHERE tournament_configurations.tournament_id = ?
    `).get(tournamentId).count),
    teams: Number(db.prepare(`
      SELECT COUNT(*) AS count FROM tournament_teams WHERE tournament_id = ?
    `).get(tournamentId).count),
    groups: Number(db.prepare(`
      SELECT COUNT(*) AS count
      FROM tournament_groups
      JOIN tournament_configurations
        ON tournament_configurations.id = tournament_groups.configuration_id
      WHERE tournament_configurations.tournament_id = ?
    `).get(tournamentId).count),
    rounds: Number(db.prepare(`
      SELECT COUNT(*) AS count FROM tournament_rounds WHERE tournament_id = ?
    `).get(tournamentId).count),
    matches: Number(db.prepare(`
      SELECT COUNT(*) AS count FROM tournament_matches WHERE tournament_id = ?
    `).get(tournamentId).count),
  };
}

try {
  await import("../database/init.js");
  db = (await import("../database/database.js")).default;
  const {
    createTournamentEvent,
    deleteTournamentEvent,
    finishTournamentEvent,
    finishTournamentEventMatch,
    generateTournamentEventConfiguration,
    getTournamentEvent,
    getTournamentEventHistory,
    listTournamentEvents,
    startTournamentEventMatch,
  } = await import("../database/tournamentQueries.js");
  const { deletePlayerProfile } = await import("../database/playerQueries.js");

  const insertPlayer = db.prepare(`
    INSERT INTO players (name, level, gender)
    VALUES (?, 'beginner', 'male')
  `);
  const playerIds = ["Delete A", "Delete B", "Delete C", "Delete D", "Delete E"]
    .map((name) => Number(insertPlayer.run(name).lastInsertRowid));
  const registerToday = db.prepare(`
    INSERT INTO registered_players_today (
      player_id, match_count, wins, losses, status, is_done_today
    ) VALUES (?, 4, 2, 2, 'available', 0)
  `);
  for (const playerId of playerIds) registerToday.run(playerId);

  const courtIds = ["Delete Court 1", "Delete Court 2"].map((name) => Number(
    db.prepare("INSERT INTO courts (name) VALUES (?)").run(name).lastInsertRowid,
  ));
  const rotationMatchId = Number(db.prepare(`
    INSERT INTO rotation_matches (
      queue_position, match_type, category, status
    ) VALUES (1, 'singles', 'no_gender', 'waiting')
  `).run().lastInsertRowid);

  // A separate draft and its profile references must survive every other deletion.
  const survivingDraft = createTournamentEvent(
    "Surviving Draft",
    "2026-08-01",
    "2026-08-02",
  );
  assert.equal(survivingDraft.success, true, survivingDraft.message);
  const survivingId = survivingDraft.data.tournament.id;
  assert.equal(generateTournamentEventConfiguration(
    survivingId,
    [playerIds[3], playerIds[4]],
    "adult",
    "singles",
    "mens",
    "beginner",
    () => 0.5,
  ).success, true);

  const draftToDelete = createTournamentEvent(
    "Draft To Delete",
    "2026-08-03",
    "2026-08-04",
  );
  const draftId = draftToDelete.data.tournament.id;
  assert.equal(generateTournamentEventConfiguration(
    draftId,
    [playerIds[0], playerIds[1]],
    "adult",
    "singles",
    "mens",
    "beginner",
    () => 0.5,
  ).success, true);
  assert.ok(Object.values(getEventOwnedCounts(draftId)).every((count) => count > 0));
  assert.equal(deleteTournamentEvent(draftId).success, true);
  assert.deepEqual(getEventOwnedCounts(draftId), {
    configurations: 0,
    participants: 0,
    teams: 0,
    groups: 0,
    rounds: 0,
    matches: 0,
  });
  assertFailure(deleteTournamentEvent(draftId), /not found/i);
  assert.equal(getTournamentEvent(survivingId).success, true);

  // Deleting an ongoing event releases its court but preserves recorded statistics.
  const ongoing = createTournamentEvent(
    "Ongoing To Delete",
    "2026-08-05",
    "2026-08-06",
  );
  const ongoingId = ongoing.data.tournament.id;
  const ongoingConfiguration = generateTournamentEventConfiguration(
    ongoingId,
    playerIds.slice(0, 3),
    "adult",
    "singles",
    "mens",
    "beginner",
    () => 0.5,
  );
  assert.equal(ongoingConfiguration.success, true, ongoingConfiguration.message);
  const ongoingMatches = getMatches(ongoingConfiguration.data.configuration);
  assert.equal(startTournamentEventMatch(ongoingMatches[0].id, courtIds[0]).success, true);
  assert.equal(finishTournamentEventMatch(
    ongoingMatches[0].id,
    ongoingMatches[0].teamAId,
  ).success, true);
  assert.equal(startTournamentEventMatch(ongoingMatches[1].id, courtIds[0]).success, true);
  const lifetimeBeforeDelete = db.prepare(`
    SELECT id, total_matches_played, total_wins, total_losses
    FROM players
    ORDER BY id
  `).all();
  const dailyBeforeDelete = db.prepare(`
    SELECT player_id, match_count, wins, losses, status, is_done_today
    FROM registered_players_today
    ORDER BY player_id
  `).all();

  const deletedOngoing = deleteTournamentEvent(ongoingId);
  assert.equal(deletedOngoing.success, true, deletedOngoing.message);
  assert.deepEqual(deletedOngoing.data, { tournamentId: ongoingId });
  assert.equal(db.prepare("SELECT status FROM courts WHERE id = ?").get(courtIds[0]).status, "available");
  assert.equal(db.prepare(`
    SELECT COUNT(*) AS count FROM tournaments WHERE status = 'ongoing'
  `).get().count, 0);
  assert.deepEqual(db.prepare(`
    SELECT id, total_matches_played, total_wins, total_losses
    FROM players
    ORDER BY id
  `).all(), lifetimeBeforeDelete);
  assert.deepEqual(db.prepare(`
    SELECT player_id, match_count, wins, losses, status, is_done_today
    FROM registered_players_today
    ORDER BY player_id
  `).all(), dailyBeforeDelete);

  // Finished history may also be permanently removed without reversing its result.
  const finished = createTournamentEvent(
    "Finished To Delete",
    "2026-08-07",
    "2026-08-08",
  );
  const finishedId = finished.data.tournament.id;
  const finishedConfiguration = generateTournamentEventConfiguration(
    finishedId,
    [playerIds[0], playerIds[1]],
    "adult",
    "singles",
    "mens",
    "beginner",
    () => 0.5,
  );
  const finishedMatch = getMatches(finishedConfiguration.data.configuration)[0];
  assert.equal(startTournamentEventMatch(finishedMatch.id, courtIds[1]).success, true);
  assert.equal(finishTournamentEventMatch(
    finishedMatch.id,
    finishedMatch.teamBId,
  ).success, true);
  assert.equal(finishTournamentEvent(finishedId).success, true);
  assert.equal(getTournamentEventHistory().data.some((event) => event.id === finishedId), true);
  const lifetimeAfterFinishedMatch = db.prepare(`
    SELECT id, total_matches_played, total_wins, total_losses
    FROM players
    ORDER BY id
  `).all();
  assert.equal(deleteTournamentEvent(finishedId).success, true);
  assert.equal(getTournamentEventHistory().data.some((event) => event.id === finishedId), false);
  assertFailure(getTournamentEvent(finishedId), /not found/i);
  assert.deepEqual(db.prepare(`
    SELECT id, total_matches_played, total_wins, total_losses
    FROM players
    ORDER BY id
  `).all(), lifetimeAfterFinishedMatch);

  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM players").get().count, playerIds.length);
  assert.equal(db.prepare(`
    SELECT COUNT(*) AS count FROM rotation_matches WHERE id = ?
  `).get(rotationMatchId).count, 1);
  assert.equal(listTournamentEvents().data.length, 1);
  assert.equal(listTournamentEvents().data[0].id, survivingId);
  db.prepare(`
    UPDATE registered_players_today
    SET status = 'done', is_done_today = 1
    WHERE player_id = ?
  `).run(playerIds[3]);
  assertFailure(deletePlayerProfile(playerIds[3]), /history.*cannot be deleted safely/i);

  console.log("Tournament permanent-deletion integration checks passed.");
} catch (error) {
  console.error(error);
  if (db?.open) db.close();
  rmSync(testUserData, { recursive: true, force: true });
  app.exit(1);
}

if (db?.open) db.close();
rmSync(testUserData, { recursive: true, force: true });
app.quit();
