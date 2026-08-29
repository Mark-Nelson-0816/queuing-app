import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateTournamentScoreInput } from "../src/utils/tournamentScore.js";

const managementSource = readFileSync(
  new URL("../src/components/tournament/TournamentMatchManagement.jsx", import.meta.url),
  "utf8",
);
const pageSource = readFileSync(
  new URL("../src/pages/Tournament.jsx", import.meta.url),
  "utf8",
);
const preloadSource = readFileSync(
  new URL("../electron/preload.cjs", import.meta.url),
  "utf8",
);
const mainSource = readFileSync(
  new URL("../electron/main.js", import.meta.url),
  "utf8",
);

// Revision 4 reuses the exact Revision 3 score rules.
for (const [teamA, teamB, winnerSide] of [[21, 19, "A"], [18, 21, "B"], [100, 99, "A"]]) {
  const validation = validateTournamentScoreInput(teamA, teamB);
  assert.equal(validation.valid, true);
  assert.equal(validation.winnerSide, winnerSide);
}
for (const [teamA, teamB] of [["", 1], [-1, 2], [1.5, 2], ["bad", 2], [0, 0]]) {
  assert.equal(validateTournamentScoreInput(teamA, teamB).valid, false);
}

// Edit is restricted to a non-read-only ongoing event and finished cards.
assert.match(managementSource, /isFinished && canEditResult/);
assert.match(managementSource, /!readOnly && tournament\.status === "ongoing"/);
assert.match(managementSource, />\s*Edit Result\s*</);
assert.match(managementSource, /Number\.isInteger\(match\.teamAScore\).*String\(match\.teamAScore\)/s);
assert.match(managementSource, /No score changes to review/);
assert.match(managementSource, /onReviewResultUpdate/);

// The update confirmation names both teams, compares scores, and derives the new winner.
assert.match(pageSource, /title="Confirm Result Update"/);
assert.match(pageSource, /Old Score:/);
assert.match(pageSource, /New Score:/);
assert.match(pageSource, />New Winner</);
assert.match(pageSource, /scoreResult\.winnerSide === "A" \? match\.teamA : match\.teamB/);
assert.match(pageSource, />\s*Go Back\s*</);
assert.equal(pageSource.includes('"Confirm Update"'), true);
assert.match(pageSource, /updateResultLockRef\.current/);
assert.match(pageSource, /window\.api\.updateTournamentMatchResult/);

// A separate explicit IPC contract avoids overloading first-time finish.
assert.match(preloadSource, /updateTournamentMatchResult: \(matchId, teamAScore, teamBScore\)/);
assert.match(preloadSource, /'update-tournament-match-result', matchId, teamAScore, teamBScore/);
assert.match(mainSource, /ipcMain\.handle\('update-tournament-match-result'/);
assert.doesNotMatch(managementSource, /Edit Result[\s\S]{0,200}Select Winner/);

console.log("Tournament result-edit UI contract checks passed.");
