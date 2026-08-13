import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { app } from "electron";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testDirectory, "..");
const mainSource = readFileSync(
  path.join(repositoryRoot, "electron", "main.js"),
  "utf8",
);
const preloadSource = readFileSync(
  path.join(repositoryRoot, "electron", "preload.cjs"),
  "utf8",
);

// Collects literal channel names so every preload call has a registered handler.
function collectChannels(source, expression) {
  return [...source.matchAll(expression)].map((match) => match[1]);
}

const handlerChannels = new Set(collectChannels(
  mainSource,
  /ipcMain\.handle\(\s*["']([^"']+)["']/g,
));
const invokedChannels = collectChannels(
  preloadSource,
  /ipcRenderer\.invoke\(\s*["']([^"']+)["']/g,
);
for (const channel of invokedChannels) {
  assert.equal(
    handlerChannels.has(channel),
    true,
    `Preload channel ${channel} has no ipcMain handler`,
  );
}

const revisedChannels = [
  "create-tournament",
  "list-tournaments",
  "get-tournament",
  "get-tournament-history",
  "delete-tournament",
  "get-tournament-configuration-data",
  "generate-tournament-configuration",
  "reset-tournament-configuration",
  "start-tournament-match",
  "finish-tournament-match",
  "finish-tournament",
];
for (const channel of revisedChannels) {
  assert.equal(handlerChannels.has(channel), true, `${channel} handler is missing`);
  assert.equal(invokedChannels.includes(channel), true, `${channel} preload call is missing`);
}

// Confirms the renderer-facing method names and explicit positional arguments.
for (const snippet of [
  "createTournament: (name, startDate, endDate)",
  "listTournaments: ()",
  "getTournament: (tournamentId)",
  "getTournamentHistory: ()",
  "deleteTournament: (tournamentId)",
  "getTournamentConfigurationData: ()",
  "resetTournamentConfiguration: (configurationId)",
  "startTournamentMatch: (matchId, courtId)",
  "finishTournamentMatch: (matchId, winnerTeamId)",
  "finishTournament: (tournamentId)",
]) {
  assert.equal(preloadSource.includes(snippet), true, `${snippet} is missing`);
}
assert.match(
  preloadSource,
  /generateTournamentConfiguration:\s*\(\s*tournamentId,\s*playerIds,\s*division,\s*matchType,\s*category,\s*level,/s,
);

// Obsolete single-event creation and latest-event APIs must stay removed.
assert.equal(preloadSource.includes("createRoundRobinTournament:"), false);
assert.equal(preloadSource.includes("getLatestTournament:"), false);
assert.equal(handlerChannels.has("create-round-robin-tournament"), false);
assert.equal(handlerChannels.has("get-latest-tournament"), false);

const testUserData = mkdtempSync(
  path.join(os.tmpdir(), "badminton-tournament-ipc-contract-"),
);
app.setPath("userData", testUserData);

let db;

try {
  await import("../database/init.js");
  db = (await import("../database/database.js")).default;
  const tournamentQueries = await import("../database/tournamentQueries.js");

  for (const functionName of [
    "createTournamentEvent",
    "deleteTournamentEvent",
    "listTournamentEvents",
    "getTournamentEvent",
    "getTournamentEventHistory",
    "getTournamentConfigurationData",
    "generateTournamentEventConfiguration",
    "resetTournamentEventConfiguration",
    "startTournamentMatch",
    "finishTournamentMatch",
    "finishTournamentEvent",
  ]) {
    assert.equal(
      typeof tournamentQueries[functionName],
      "function",
      `${functionName} backend export is missing`,
    );
  }

  const insertPlayer = db.prepare(`
    INSERT INTO players (name, level, gender, prefer_no_gender)
    VALUES (?, 'beginner', 'male', 0)
  `);
  const playerIds = ["IPC Aaron", "IPC Ben"].map((name) => Number(
    insertPlayer.run(name).lastInsertRowid,
  ));
  const courtId = Number(db.prepare(`
    INSERT INTO courts (name) VALUES ('IPC Court')
  `).run().lastInsertRowid);

  const configurationData = tournamentQueries.getTournamentConfigurationData();
  assert.equal(configurationData.success, true);
  assert.deepEqual(
    configurationData.data.players.map((player) => player.id),
    playerIds,
  );
  assert.deepEqual(configurationData.data.options.divisions, [
    "adult", "u17", "u15", "u13", "u11", "u9",
  ]);
  assert.deepEqual(
    configurationData.data.options.categoriesByMatchType.singles,
    ["mens", "womens", "no_gender"],
  );
  assert.deepEqual(
    configurationData.data.options.categoriesByMatchType.doubles,
    ["mens", "womens", "mixed", "no_gender"],
  );
  assert.equal("preferMens" in configurationData.data.players[0], false);
  assert.equal("status" in configurationData.data.players[0], false);

  const created = tournamentQueries.createTournamentEvent(
    "IPC Tournament",
    "2026-11-01",
    "2026-11-02",
  );
  assert.equal(created.success, true, created.message);
  const tournamentId = created.data.tournament.id;
  const generated = tournamentQueries.generateTournamentEventConfiguration(
    tournamentId,
    playerIds,
    "adult",
    "singles",
    "mens",
    "beginner",
    () => 0.5,
  );
  assert.equal(generated.success, true, generated.message);
  const match = generated.data.configuration.groups[0].rounds[0].matches[0];

  // Shared IPC-facing lifecycle functions dispatch by configuration_id.
  const started = tournamentQueries.startTournamentMatch(match.id, courtId);
  assert.equal(started.success, true, started.message);
  assert.equal(started.data.tournament.status, "ongoing");
  assert.equal(
    started.data.configurations[0].groups[0].rounds[0].matches[0].status,
    "playing",
  );

  const finished = tournamentQueries.finishTournamentMatch(
    match.id,
    match.teamAId,
  );
  assert.equal(finished.success, true, finished.message);
  assert.equal(
    finished.data.configurations[0].groups[0].rounds[0].matches[0].status,
    "finished",
  );

  assert.equal(tournamentQueries.finishTournamentEvent(tournamentId).success, true);
  assert.equal(tournamentQueries.getTournamentEventHistory().data.length, 1);
  assert.equal(tournamentQueries.listTournamentEvents().data.length, 1);

  console.log("Tournament IPC and preload contract checks passed.");
} catch (error) {
  console.error(error);
  if (db?.open) db.close();
  rmSync(testUserData, { recursive: true, force: true });
  app.exit(1);
}

if (db?.open) db.close();
rmSync(testUserData, { recursive: true, force: true });
app.quit();
