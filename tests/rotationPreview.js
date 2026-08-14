import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import {
  buildRotationSelectionStatus,
  getRotationGenerationFeedback,
  groupRotationUnmatchedPlayers,
} from "../src/utils/rotationUi.js";

// Creates a complete renderer-style Rotation player fixture.
function player(id, level, {
  gender = id % 2 ? "male" : "female",
  rankPreference = "same_rank",
  preferMens = true,
  preferWomens = true,
  preferMixed = true,
  preferNoGender = true,
  eligible = true,
} = {}) {
  return {
    id,
    name: `Player ${id}`,
    level,
    gender,
    rankPreference,
    preferMens,
    preferWomens,
    preferMixed,
    preferNoGender,
    eligible,
    status: eligible ? "available" : "playing",
    matchCount: id % 4,
    availableSince: `2026-08-14 08:${String(id % 60).padStart(2, "0")}:00`,
    teammateCounts: {},
    opponentCounts: {},
  };
}

function preview(players, matchType, category = "no_gender", locks = []) {
  return buildRotationSelectionStatus({
    selectedPlayers: players,
    locks,
    matchType,
    category,
  });
}

// Singles Same Rank and Adjacent Rank compatibility.
assert.equal(preview([
  player(1, "beginner"),
  player(2, "beginner"),
], "singles").canGenerate, true);
assert.equal(preview([
  player(1, "beginner"),
  player(2, "intermediate"),
], "singles").canGenerate, false);
assert.equal(preview([
  player(1, "beginner", { rankPreference: "adjacent_rank" }),
  player(2, "intermediate", { rankPreference: "adjacent_rank" }),
], "singles").canGenerate, true);
assert.equal(preview([
  player(1, "beginner", { rankPreference: "adjacent_rank" }),
  player(2, "intermediate", { rankPreference: "same_rank" }),
], "singles").canGenerate, false);
assert.equal(preview([
  player(1, "beginner", { rankPreference: "adjacent_rank" }),
  player(2, "upper_intermediate", { rankPreference: "adjacent_rank" }),
], "singles").canGenerate, false);

// Doubles Same Rank estimation counts only complete compatible level groups.
const beginnerFour = Array.from({ length: 4 }, (_, index) => player(index + 1, "beginner"));
const beginnerEight = Array.from({ length: 8 }, (_, index) => player(index + 1, "beginner"));
assert.equal(preview(beginnerFour, "doubles").estimatedMatches, 1);
assert.equal(preview(beginnerEight, "doubles").estimatedMatches, 2);
assert.equal(preview([
  player(1, "beginner"),
  player(2, "beginner"),
  player(3, "intermediate"),
  player(4, "intermediate"),
], "doubles").canGenerate, false);
assert.equal(preview([
  ...beginnerFour,
  ...Array.from({ length: 4 }, (_, index) => player(index + 5, "advanced")),
], "doubles").estimatedMatches, 2);

// Reproduces the reported incompatible Same Rank Doubles scenario.
const reportedScenario = [
  player(1, "beginner"),
  player(2, "beginner"),
  player(3, "upper_intermediate"),
  player(4, "advanced"),
];
const reportedPreview = preview(reportedScenario, "doubles");
assert.equal(reportedPreview.canGenerate, false);
assert.equal(reportedPreview.estimatedMatches, 0);
assert.match(reportedPreview.message, /four compatible players of the same level/i);
const correctedScenario = preview([
  ...reportedScenario,
  player(5, "beginner"),
  player(6, "beginner"),
], "doubles");
assert.equal(correctedScenario.canGenerate, true);
assert.equal(correctedScenario.estimatedMatches, 1);

// Mixed Doubles requires two players of each gender and valid mixed teams.
assert.equal(preview([
  player(1, "beginner", { gender: "male" }),
  player(2, "beginner", { gender: "male" }),
  player(3, "beginner", { gender: "female" }),
  player(4, "beginner", { gender: "female" }),
], "doubles", "mixed").canGenerate, true);
const invalidMixed = preview([
  player(1, "beginner", { gender: "male" }),
  player(2, "beginner", { gender: "male" }),
  player(3, "beginner", { gender: "male" }),
  player(4, "beginner", { gender: "female" }),
], "doubles", "mixed");
assert.equal(invalidMixed.canGenerate, false);
assert.match(invalidMixed.message, /two compatible male and two compatible female/i);

// Category fallback never bypasses the actual Men's/Women's gender rule.
const mensFallbackPlayers = Array.from({ length: 4 }, (_, index) => player(
  index + 1,
  "beginner",
  {
    gender: "male",
    preferMens: false,
    preferWomens: false,
    preferMixed: false,
    preferNoGender: true,
  },
));
assert.equal(preview(mensFallbackPlayers, "doubles", "mens").canGenerate, true);
assert.equal(preview([
  ...mensFallbackPlayers.slice(0, 3),
  player(4, "beginner", { gender: "female" }),
], "doubles", "mens").canGenerate, false);

// Adjacent Doubles still requires mutual permission, a one-level span, and balance.
const validAdjacentDoubles = [
  player(1, "beginner", { rankPreference: "adjacent_rank" }),
  player(2, "beginner", { rankPreference: "adjacent_rank" }),
  player(3, "intermediate", { rankPreference: "adjacent_rank" }),
  player(4, "intermediate", { rankPreference: "adjacent_rank" }),
];
assert.equal(preview(validAdjacentDoubles, "doubles").canGenerate, true);
assert.equal(preview([
  ...validAdjacentDoubles.slice(0, 3),
  player(4, "intermediate", { rankPreference: "same_rank" }),
], "doubles").canGenerate, false);

// Active teammate locks are passed through the same bounded Doubles generator.
const validLock = [{ id: 1, player1Id: 1, player2Id: 2 }];
assert.equal(preview(beginnerFour, "doubles", "no_gender", validLock).canGenerate, true);
const missingPartnerLock = [{ id: 2, player1Id: 1, player2Id: 99 }];
const missingPartnerPreview = preview(beginnerFour, "doubles", "no_gender", missingPartnerLock);
assert.equal(missingPartnerPreview.canGenerate, false);
assert.match(missingPartnerPreview.message, /both active locked teammates/i);
const incompatibleLockedPlayers = [
  player(1, "beginner", { rankPreference: "adjacent_rank" }),
  player(2, "advanced", { rankPreference: "adjacent_rank" }),
  player(3, "beginner", { rankPreference: "adjacent_rank" }),
  player(4, "intermediate", { rankPreference: "adjacent_rank" }),
];
assert.equal(preview(
  incompatibleLockedPlayers,
  "doubles",
  "no_gender",
  validLock,
).canGenerate, false);
assert.match(preview(
  incompatibleLockedPlayers,
  "doubles",
  "no_gender",
  validLock,
).message, /locked team has no balanced compatible opponent/i);

// Partial selections remain Ready when at least one legal complete match exists.
const partialPreview = preview([
  ...beginnerFour,
  player(5, "advanced"),
], "doubles");
assert.equal(partialPreview.canGenerate, true);
assert.equal(partialPreview.estimatedMatches, 1);
assert.equal(partialPreview.tone, "attention");
assert.match(partialPreview.message, /remain unmatched/i);

// Preview rejects stale unavailable players because canonical generation would reject them.
const unavailablePreview = preview([
  ...beginnerFour.slice(0, 3),
  player(4, "beginner", { eligible: false }),
], "doubles");
assert.equal(unavailablePreview.canGenerate, false);
assert.match(unavailablePreview.message, /currently playing/i);

// All selected players are evaluated regardless of how the UI paginates them.
const crossPagePlayers = Array.from({ length: 12 }, (_, index) => player(index + 1, "beginner"));
assert.equal(preview(crossPagePlayers, "doubles").estimatedMatches, 3);

// Generation feedback reserves green success for at least one saved match.
assert.deepEqual(getRotationGenerationFeedback(0, 4), {
  tone: "warning",
  message: "No compatible complete matches were generated.",
});
assert.equal(getRotationGenerationFeedback(2, 0).tone, "success");
assert.match(getRotationGenerationFeedback(1, 4).message, /4 selected players remain unmatched/i);
assert.deepEqual(groupRotationUnmatchedPlayers([
  { id: 1, name: "A", reason: "Shared reason" },
  { id: 2, name: "B", reason: "Shared reason" },
  { id: 3, name: "C", reason: "Different reason" },
]).map((group) => [group.reason, group.players.length]), [
  ["Shared reason", 2],
  ["Different reason", 1],
]);

// Large bounded Doubles previews stay responsive and avoid IPC/database work.
for (const playerCount of [40, 80]) {
  const largePlayers = Array.from(
    { length: playerCount },
    (_, index) => player(index + 1, "beginner"),
  );
  const startedAt = performance.now();
  const result = preview(largePlayers, "doubles");
  const elapsedMs = performance.now() - startedAt;
  assert.equal(result.estimatedMatches, playerCount / 4);
  assert.ok(elapsedMs < 1000, `${playerCount}-player preview took ${elapsedMs.toFixed(2)} ms`);
  console.log(`${playerCount}-player Rotation preview: ${elapsedMs.toFixed(2)} ms`);

  const singlesStartedAt = performance.now();
  const singlesResult = preview(largePlayers, "singles");
  const singlesElapsedMs = performance.now() - singlesStartedAt;
  assert.equal(singlesResult.estimatedMatches, playerCount / 2);
  assert.ok(
    singlesElapsedMs < 1000,
    `${playerCount}-player Singles preview took ${singlesElapsedMs.toFixed(2)} ms`,
  );
  console.log(`${playerCount}-player Singles preview: ${singlesElapsedMs.toFixed(2)} ms`);
}

console.log("Rotation compatibility-aware preview checks passed.");
