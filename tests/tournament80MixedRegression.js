import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { app } from "electron";
import { getPagination } from "../src/utils/pagination.js";
import {
  getEligibleTournamentProfiles,
  getTournamentSelectionDetails,
} from "../src/utils/tournamentSelection.js";

app.disableHardwareAcceleration();
const testUserData = mkdtempSync(path.join(os.tmpdir(), "badminton-tournament-80-mixed-"));
app.setPath("userData", testUserData);

let db;
let exitCode = 0;

function getMatches(configuration) {
  return configuration.groups.flatMap((group) => (
    group.rounds.flatMap((round) => round.matches)
  ));
}

try {
  await import("../database/init.js");
  db = (await import("../database/database.js")).default;
  const tournament = await import("../database/tournamentQueries.js");

  const insertProfile = db.prepare(`
    INSERT INTO players (name, level, gender)
    VALUES (?, ?, ?)
  `);
  const levels = ["beginner", "intermediate", "upper_intermediate", "advanced"];
  const profiles = [];
  for (const level of levels) {
    for (let index = 0; index < 50; index += 1) {
      const id = Number(insertProfile.run(
        `Tournament ${level} ${index + 1}`,
        level,
        index < 25 ? "male" : "female",
      ).lastInsertRowid);
      profiles.push({ id, level, gender: index < 25 ? "male" : "female" });
    }
  }

  // Tournament selection intentionally uses permanent profiles, not daily availability.
  assert.equal(profiles.length, 200);
  const intermediateProfiles = getEligibleTournamentProfiles(
    profiles,
    "intermediate",
    "mixed",
  );
  assert.equal(intermediateProfiles.length, 50);
  const selected = getTournamentSelectionDetails(
    intermediateProfiles.map((player) => player.id),
    intermediateProfiles,
  );
  assert.equal(selected.selectedPlayers.length, 50);
  assert.deepEqual(selected.genderCounts, { male: 25, female: 25 });
  for (const pageSize of [10, 25, 50, 100]) {
    const seen = [];
    const pages = Math.ceil(intermediateProfiles.length / pageSize);
    for (let page = 1; page <= pages; page += 1) {
      const range = getPagination(intermediateProfiles.length, page, pageSize);
      seen.push(...intermediateProfiles.slice(range.startIndex, range.endIndex).map((player) => player.id));
    }
    assert.deepEqual(seen, intermediateProfiles.map((player) => player.id));
  }

  // Use one exact-level 80-player configuration: 40 male plus 40 female profiles.
  const mixed80 = Array.from({ length: 80 }, (_, index) => {
    const id = Number(insertProfile.run(
      `Tournament 80 Mixed ${index + 1}`,
      "intermediate",
      index < 40 ? "male" : "female",
    ).lastInsertRowid);
    return id;
  });
  const event = tournament.createTournamentEvent(
    "80 Player Mixed Regression",
    "2026-12-01",
    "2026-12-02",
  );
  assert.equal(event.success, true, event.message);
  const generated = tournament.generateTournamentEventConfiguration(
    event.data.tournament.id,
    mixed80,
    "adult",
    "doubles",
    "mixed",
    "intermediate",
    () => 0.5,
  );
  assert.equal(generated.success, true, generated.message);
  const configuration = generated.data.configuration;
  const matches = getMatches(configuration);

  // Current revision is group round robin: 40 teams -> ten Groups of four -> 60 matches.
  assert.equal(configuration.participants.length, 80);
  assert.equal(configuration.teams.length, 40);
  assert.equal(configuration.groups.length, 10);
  assert.equal(matches.length, 60);
  assert.equal(configuration.groups.reduce((sum, group) => sum + group.rounds[0].matches.length, 0), 20);
  assert.ok(configuration.groups.every((group) => group.teams.length === 4 && group.rounds.length === 3));

  const memberIds = configuration.teams.flatMap((team) => team.players.map((player) => player.playerId));
  assert.equal(memberIds.length, 80);
  assert.equal(new Set(memberIds).size, 80);
  assert.ok(configuration.teams.every((team) => new Set(team.players.map((player) => player.genderSnapshot)).size === 2));

  const matchupKeys = new Set();
  for (const group of configuration.groups) {
    for (const round of group.rounds) {
      const roundTeamIds = new Set();
      for (const match of round.matches) {
        assert.notEqual(match.teamAId, match.teamBId);
        assert.equal(roundTeamIds.has(match.teamAId), false);
        assert.equal(roundTeamIds.has(match.teamBId), false);
        roundTeamIds.add(match.teamAId);
        roundTeamIds.add(match.teamBId);
        const key = [match.teamAId, match.teamBId].sort((a, b) => a - b).join("-");
        assert.equal(matchupKeys.has(key), false);
        matchupKeys.add(key);
      }
    }
  }
  assert.equal(matchupKeys.size, 60);

  const counts = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM tournament_participants) AS participants,
      (SELECT COUNT(*) FROM tournament_teams WHERE configuration_id = ?) AS teams,
      (SELECT COUNT(*) FROM tournament_groups WHERE configuration_id = ?) AS groups,
      (SELECT COUNT(*) FROM tournament_rounds WHERE configuration_id = ?) AS rounds,
      (SELECT COUNT(*) FROM tournament_matches WHERE configuration_id = ?) AS matches
  `).get(configuration.id, configuration.id, configuration.id, configuration.id);
  assert.deepEqual(counts, { participants: 80, teams: 40, groups: 10, rounds: 30, matches: 60 });
  assert.deepEqual(db.pragma("foreign_key_check"), []);
  assert.equal(db.pragma("integrity_check", { simple: true }), "ok");
  console.log("TOURNAMENT_80_MIXED_SUMMARY", JSON.stringify({
    profiles: 200,
    selected: 80,
    teams: 40,
    groups: 10,
    firstRoundMatches: 20,
    rounds: 30,
    matches: 60,
  }));
} catch (error) {
  console.error(error);
  exitCode = 1;
} finally {
  if (db?.open) db.close();
  rmSync(testUserData, { recursive: true, force: true });
  app.exit(exitCode);
}
