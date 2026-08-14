import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const mainSource = readFileSync(new URL("../electron/main.js", import.meta.url), "utf8");
const preloadSource = readFileSync(new URL("../electron/preload.cjs", import.meta.url), "utf8");

const contracts = [
  ["markAllRegisteredPlayersDone", "mark-all-registered-players-done"],
  ["backupDatabase", "backup-database"],
  ["clearOldRotationHistory", "clear-old-rotation-history"],
];

for (const [method, channel] of contracts) {
  assert.match(preloadSource, new RegExp(`${method}\\s*:`));
  assert.match(preloadSource, new RegExp(`ipcRenderer\\.invoke\\(["']${channel}["']`));
  assert.match(mainSource, new RegExp(`ipcMain\\.handle\\(["']${channel}["']`));
}

assert.match(preloadSource, /backupDatabase\s*:\s*\(\)\s*=>/);
assert.match(preloadSource, /clearOldRotationHistory\s*:\s*\(\)\s*=>/);

console.log("Database maintenance IPC/preload contract checks passed.");
