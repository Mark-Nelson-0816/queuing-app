import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import process from "node:process";
import { fileURLToPath } from "node:url";
import os from "node:os";
import path from "node:path";
import { app } from "electron";

app.disableHardwareAcceleration();

const mode = process.argv[2] || "create";
const inheritedUserData = process.env.BADMINTON_RESTART_TEST_USER_DATA;
const testUserData = inheritedUserData || mkdtempSync(
  path.join(os.tmpdir(), "badminton-tournament-restart-"),
);
const markerPath = path.join(testUserData, "tournament-restart-marker.json");
app.setPath("userData", testUserData);

function allMatches(configuration) {
  return configuration.groups.flatMap((group) => (
    group.rounds.flatMap((round) => round.matches)
  ));
}

function spawnRestart(nextMode) {
  const childEnvironment = {
    ...process.env,
    BADMINTON_RESTART_TEST_USER_DATA: testUserData,
  };
  delete childEnvironment.ELECTRON_RUN_AS_NODE;
  const child = spawnSync(
    process.execPath,
    [fileURLToPath(import.meta.url), nextMode],
    {
      cwd: process.cwd(),
      env: childEnvironment,
      encoding: "utf8",
      timeout: 30_000,
    },
  );
  if (child.stdout) process.stdout.write(child.stdout);
  if (child.stderr) process.stderr.write(child.stderr);
  assert.equal(child.status, 0, `${nextMode} restart exited with ${child.status}`);
}

async function runCreatePhase() {
  await import("../database/init.js");
  const db = (await import("../database/database.js")).default;
  const {
    createTournamentEvent,
    finishTournamentEventMatch,
    generateTournamentEventConfiguration,
    startTournamentEventMatch,
    updateTournamentMatchResult,
  } = await import("../database/tournamentQueries.js");

  const insertPlayer = db.prepare(`
    INSERT INTO players (name, level, gender)
    VALUES (?, ?, 'male')
  `);
  const playerIds = [
    ["Restart Beginner", "beginner"],
    ["Restart Intermediate", "intermediate"],
    ["Restart Upper", "upper_intermediate"],
    ["Restart Advanced", "advanced"],
  ].map(([name, level]) => Number(insertPlayer.run(name, level).lastInsertRowid));
  const courtId = Number(
    db.prepare("INSERT INTO courts (name) VALUES ('Restart Court')").run().lastInsertRowid,
  );
  const event = createTournamentEvent("Restart Tournament", "2026-08-29", "2026-08-31");
  assert.equal(event.success, true, event.message);
  const tournamentId = event.data.tournament.id;
  const generated = generateTournamentEventConfiguration(
    tournamentId,
    playerIds,
    "u15",
    "singles",
    "mens",
    "all",
    () => 0.5,
  );
  assert.equal(generated.success, true, generated.message);
  const firstMatch = allMatches(generated.data.configuration)[0];
  assert.equal(startTournamentEventMatch(firstMatch.id, courtId).success, true);
  assert.equal(finishTournamentEventMatch(firstMatch.id, 21, 17).success, true);
  assert.equal(updateTournamentMatchResult(firstMatch.id, 18, 21).success, true);

  const corrected = db.prepare(`
    SELECT status, winner_team_id, team_a_score, team_b_score
    FROM tournament_matches WHERE id = ?
  `).get(firstMatch.id);
  assert.equal(corrected.status, "finished");
  assert.equal(corrected.winner_team_id, firstMatch.teamBId);
  assert.equal(corrected.team_a_score, 18);
  assert.equal(corrected.team_b_score, 21);

  writeFileSync(markerPath, JSON.stringify({
    tournamentId,
    configurationId: generated.data.configuration.id,
    firstMatchId: firstMatch.id,
    correctedWinnerTeamId: firstMatch.teamBId,
    courtId,
    playerIds,
  }));
  db.close();

  spawnRestart("continue");
  spawnRestart("history");
  console.log("Tournament restart persistence checks passed across three processes.");
}

async function runContinuePhase() {
  await import("../database/init.js");
  const db = (await import("../database/database.js")).default;
  const {
    finishTournamentEvent,
    finishTournamentEventMatch,
    getTournamentEvent,
    startTournamentEventMatch,
  } = await import("../database/tournamentQueries.js");
  const marker = JSON.parse(readFileSync(markerPath, "utf8"));
  const loaded = getTournamentEvent(marker.tournamentId);
  assert.equal(loaded.success, true, loaded.message);
  assert.equal(loaded.data.tournament.status, "ongoing");
  const configuration = loaded.data.configurations.find(
    (candidate) => candidate.id === marker.configurationId,
  );
  assert.equal(configuration.division, "u15");
  assert.equal(configuration.level, "all");
  assert.deepEqual(
    new Set(configuration.participants.map((participant) => participant.levelSnapshot)),
    new Set(["beginner", "intermediate", "upper_intermediate", "advanced"]),
  );
  const firstMatch = allMatches(configuration).find((match) => match.id === marker.firstMatchId);
  assert.equal(firstMatch.teamAScore, 18);
  assert.equal(firstMatch.teamBScore, 21);
  assert.equal(firstMatch.winnerTeamId, marker.correctedWinnerTeamId);
  assert.equal(firstMatch.status, "finished");
  assert.equal(db.prepare("SELECT status FROM courts WHERE id = ?").get(marker.courtId).status, "available");

  for (const match of allMatches(configuration).filter((candidate) => candidate.status === "waiting")) {
    assert.equal(startTournamentEventMatch(match.id, marker.courtId).success, true);
    assert.equal(finishTournamentEventMatch(match.id, 21, 18).success, true);
  }
  const finished = finishTournamentEvent(marker.tournamentId);
  assert.equal(finished.success, true, finished.message);
  assert.equal(finished.data.tournament.status, "finished");
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  assert.equal(db.prepare("PRAGMA integrity_check").pluck().get(), "ok");
  db.close();
  console.log("Tournament restart continue phase passed.");
}

async function runHistoryPhase() {
  await import("../database/init.js");
  const db = (await import("../database/database.js")).default;
  const { getTournamentEventHistory, updateTournamentMatchResult } = await import(
    "../database/tournamentQueries.js"
  );
  const marker = JSON.parse(readFileSync(markerPath, "utf8"));
  const history = getTournamentEventHistory();
  assert.equal(history.success, true, history.message);
  assert.equal(history.data.some((event) => event.id === marker.tournamentId), true);
  const loadedEvent = history.data.find((event) => event.id === marker.tournamentId);
  assert.equal(loadedEvent.status, "finished");
  const detailed = (await import("../database/tournamentQueries.js"))
    .getTournamentEvent(marker.tournamentId);
  const correctedMatch = detailed.data.configurations
    .flatMap((configuration) => allMatches(configuration))
    .find((match) => match.id === marker.firstMatchId);
  assert.equal(correctedMatch.teamAScore, 18);
  assert.equal(correctedMatch.teamBScore, 21);
  assert.equal(correctedMatch.winnerTeamId, marker.correctedWinnerTeamId);
  assert.match(
    updateTournamentMatchResult(marker.firstMatchId, 21, 18).message,
    /only.*ongoing/i,
  );
  assert.deepEqual(db.prepare("PRAGMA foreign_key_check").all(), []);
  assert.equal(db.prepare("PRAGMA integrity_check").pluck().get(), "ok");
  db.close();
  console.log("Tournament restart history phase passed.");
}

try {
  if (mode === "continue") await runContinuePhase();
  else if (mode === "history") await runHistoryPhase();
  else await runCreatePhase();
} catch (error) {
  console.error(error);
  if (!inheritedUserData) rmSync(testUserData, { recursive: true, force: true });
  app.exit(1);
}

if (!inheritedUserData) rmSync(testUserData, { recursive: true, force: true });
app.quit();
