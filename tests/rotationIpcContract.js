import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const preload = readFileSync(
  new URL("../electron/preload.cjs", import.meta.url),
  "utf8",
);
const main = readFileSync(
  new URL("../electron/main.js", import.meta.url),
  "utf8",
);

// Keeps every renderer Rotation API aligned with its main-process IPC handler.
const contracts = [
  ["getRotationState", "get-rotation-state", []],
  ["createTeamLock", "create-team-lock", ["firstPlayerId", "secondPlayerId", "matchType", "category"]],
  ["removeTeamLock", "remove-team-lock", ["lockId"]],
  ["updateRotationRankPreference", "update-rotation-rank-preference", ["playerId", "preference"]],
  ["generateRotationMatches", "generate-rotation-matches", ["playerIds", "matchType", "category"]],
  ["getRotationMatches", "get-rotation-matches", []],
  ["getRotationNextUpMatches", "get-rotation-next-up-matches", []],
  ["updateWaitingMatch", "update-waiting-match", ["matchId", "teamAIds", "teamBIds"]],
  ["rebalanceWaitingMatch", "rebalance-waiting-match", ["matchId"]],
  ["reorderWaitingMatch", "reorder-waiting-match", ["matchId", "direction"]],
  ["cancelWaitingMatch", "cancel-waiting-match", ["matchId"]],
  ["startRotationMatch", "start-rotation-match", ["matchId", "courtId"]],
  ["finishRotationMatch", "finish-rotation-match", ["matchId", "winnerTeam", "donePlayerIds"]],
];

for (const [apiName, channel, args] of contracts) {
  const invocation = args.length === 0
    ? `ipcRenderer\\.invoke\\(\\s*"${channel}"\\s*\\)`
    : `ipcRenderer\\.invoke\\(\\s*"${channel}"\\s*,\\s*${args.join("\\s*,\\s*")}\\s*,?\\s*\\)`;
  assert.match(preload, new RegExp(`${apiName}:\\s*\\([^)]*\\)\\s*=>[\\s\\S]{0,220}?${invocation}`));
  assert.match(main, new RegExp(`ipcMain.handle\\(\\s*"${channel}"`));
}

console.log(`Rotation IPC/preload contract checks passed (${contracts.length} APIs).`);
