import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateTournamentScoreInput } from "../src/utils/tournamentScore.js";

const readSource = (relativePath) => readFileSync(
  new URL(`../${relativePath}`, import.meta.url),
  "utf8",
);

for (const [teamA, teamB, winnerSide] of [
  [21, 18, "A"],
  [15, 21, "B"],
  [0, 1, "B"],
  [100, 99, "A"],
]) {
  assert.deepEqual(validateTournamentScoreInput(String(teamA), String(teamB)), {
    valid: true,
    message: "Ready to review result.",
    teamAScore: teamA,
    teamBScore: teamB,
    winnerSide,
  });
}

for (const [teamA, teamB, message] of [
  ["", "1", /Team A score is required/i],
  ["1", "", /Team B score is required/i],
  ["-1", "2", /non-negative whole integer/i],
  ["2", "-1", /non-negative whole integer/i],
  ["1.5", "2", /non-negative whole integer/i],
  ["abc", "2", /non-negative whole integer/i],
  ["20", "20", /cannot be equal/i],
  ["0", "0", /cannot be equal/i],
]) {
  const result = validateTournamentScoreInput(teamA, teamB);
  assert.equal(result.valid, false);
  assert.match(result.message, message);
}

const managementSource = readSource(
  "src/components/tournament/TournamentMatchManagement.jsx",
);
const pageSource = readSource("src/pages/Tournament.jsx");
const summarySource = readSource(
  "src/components/tournament/TournamentConfigurationSummary.jsx",
);

assert.match(managementSource, /Team A Score/);
assert.match(managementSource, /Team B Score/);
assert.match(managementSource, /min="0"/);
assert.match(managementSource, /step="1"/);
assert.match(managementSource, /Review Result/);
assert.doesNotMatch(managementSource, /Choose as Winner/);
assert.match(pageSource, /title="Confirm Match Result"/);
assert.match(pageSource, /Automatic Winner/);
assert.match(pageSource, /Confirm Result/);
assert.match(pageSource, /resultConfirmation\.teamAScore/);
assert.match(pageSource, /resultConfirmation\.teamBScore/);
assert.match(pageSource, /onClick=\{\(\) => setResultConfirmation\(null\)\}/);
assert.match(summarySource, /Final Score:/);
assert.match(summarySource, /Number\.isInteger\(match\.teamAScore\)/);

console.log("Tournament score UI contract checks passed.");
