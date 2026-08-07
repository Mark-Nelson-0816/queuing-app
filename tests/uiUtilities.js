import assert from "node:assert/strict";
import { getPagination } from "../src/utils/pagination.js";
import { comparePlayerLevels } from "../src/utils/playerLevel.js";
import {
  buildRotationPreview,
  buildRotationSelectionStatus,
  countRankPreferences,
  getPlayerConfigurationReason,
} from "../src/utils/rotationUi.js";
import {
  getTournamentPreferencePriority,
  isTournamentCategoryEligible,
  isTournamentPlayerEligible,
} from "../src/utils/tournamentUi.js";

const players = Array.from({ length: 5 }, (_, index) => ({
  id: index + 1,
  name: `Player ${index + 1}`,
  level: "beginner",
  gender: index === 4 ? "female" : "male",
  rankPreference: index === 0 ? "adjacent_rank" : "same_rank",
  preferMens: true,
  preferWomens: true,
  preferMixed: true,
  preferNoGender: true,
  eligible: true,
  status: "available",
  matchCount: 0,
  teammateCounts: {},
  opponentCounts: {},
}));

const unsortedLevels = ["Advanced", "upper_intermediate", "Beginner", "Intermediate"];
assert.deepEqual(
  [...unsortedLevels].sort((first, second) => comparePlayerLevels(first, second, "asc")),
  ["Beginner", "Intermediate", "upper_intermediate", "Advanced"],
);
assert.deepEqual(
  [...unsortedLevels].sort((first, second) => comparePlayerLevels(first, second, "desc")),
  ["Advanced", "upper_intermediate", "Intermediate", "Beginner"],
);
assert.equal(comparePlayerLevels("unexpected", "beginner", "asc") > 0, true);

assert.deepEqual(getPagination(138, 1, 25), {
  currentPage: 1,
  totalPages: 6,
  startIndex: 0,
  endIndex: 25,
});
assert.deepEqual(getPagination(138, 99, 25), {
  currentPage: 6,
  totalPages: 6,
  startIndex: 125,
  endIndex: 138,
});
assert.deepEqual(getPagination(0, 1, 25), {
  currentPage: 1,
  totalPages: 1,
  startIndex: 0,
  endIndex: 0,
});

const noSelection = buildRotationPreview({
  players,
  selectedPlayerIds: [],
  locks: [],
  matchType: "doubles",
  category: "no_gender",
});
assert.equal(noSelection.canGenerate, false);
assert.match(noSelection.message, /Select at least 4/i);

const completeDoubles = buildRotationPreview({
  players,
  selectedPlayerIds: [1, 2, 3, 4],
  locks: [],
  matchType: "doubles",
  category: "no_gender",
});
assert.equal(completeDoubles.canGenerate, true);
assert.equal(completeDoubles.matches.length, 1);
assert.equal(completeDoubles.unmatchedPlayers.length, 0);

for (const playerCount of [10, 25, 50, 100]) {
  const selectionStatus = buildRotationSelectionStatus({
    selectedPlayers: Array.from({ length: playerCount }, (_, index) => ({
      id: index + 1,
      gender: index % 2 === 0 ? "male" : "female",
    })),
    matchType: "doubles",
    category: "no_gender",
  });
  assert.equal(selectionStatus.canGenerate, true);
  assert.equal(selectionStatus.estimatedMatches, Math.floor(playerCount / 4));
}

const invalidMixedStatus = buildRotationSelectionStatus({
  selectedPlayers: players.slice(0, 4),
  matchType: "doubles",
  category: "mixed",
});
assert.equal(invalidMixedStatus.canGenerate, false);
assert.equal(invalidMixedStatus.estimatedMatches, 0);

const extraPlayer = buildRotationPreview({
  players,
  selectedPlayerIds: [1, 2, 3, 4, 5],
  locks: [],
  matchType: "doubles",
  category: "no_gender",
});
assert.equal(extraPlayer.canGenerate, true);
assert.equal(extraPlayer.unmatchedPlayers.length, 1);
assert.equal(extraPlayer.tone, "attention");

assert.match(getPlayerConfigurationReason(players[4], "doubles", "mens"), /male players/i);
assert.deepEqual(countRankPreferences(players.slice(0, 3)), {
  same_rank: 2,
  adjacent_rank: 1,
});

assert.equal(isTournamentPlayerEligible({ status: "available", gender: "male", preferMens: true }, "mens"), true);
assert.equal(isTournamentPlayerEligible({ status: "waiting", gender: "female", preferWomens: true }, "womens"), true);
assert.equal(isTournamentPlayerEligible({ status: "playing", gender: "male", preferMens: true }, "mens"), false);
assert.equal(isTournamentPlayerEligible({ status: "assigned", gender: "male", preferMens: true }, "mens"), false);
assert.equal(isTournamentPlayerEligible({ status: "finished", gender: "female", preferWomens: true }, "womens"), false);
assert.equal(isTournamentPlayerEligible({ status: "done", gender: "female" }, "no_gender"), false);
assert.equal(isTournamentCategoryEligible({ gender: "female" }, "mens"), false);
assert.equal(isTournamentCategoryEligible({ gender: "male" }, "womens"), false);
assert.equal(isTournamentPlayerEligible({ status: "available", gender: "female" }, "mens"), false);
assert.equal(isTournamentPlayerEligible({ status: "available", gender: "female", preferMixed: true }, "mixed"), true);

const maleNoGenderPlayer = {
  status: "available",
  gender: "male",
  preferMens: false,
  preferWomens: false,
  preferMixed: false,
  preferNoGender: true,
};
const femaleNoGenderPlayer = { ...maleNoGenderPlayer, gender: "female" };
assert.equal(getTournamentPreferencePriority(maleNoGenderPlayer, "mens"), 1);
assert.equal(isTournamentPlayerEligible(maleNoGenderPlayer, "mens"), true);
assert.equal(isTournamentPlayerEligible(femaleNoGenderPlayer, "mens"), false);
assert.equal(isTournamentPlayerEligible(femaleNoGenderPlayer, "womens"), true);
assert.equal(isTournamentPlayerEligible(maleNoGenderPlayer, "mixed"), true);
assert.equal(isTournamentPlayerEligible(femaleNoGenderPlayer, "mixed"), true);
assert.equal(
  getTournamentPreferencePriority({ ...maleNoGenderPlayer, preferMens: true }, "mens"),
  0,
);
assert.equal(
  isTournamentPlayerEligible({ ...maleNoGenderPlayer, status: "playing" }, "mens"),
  false,
);
assert.equal(
  isTournamentPlayerEligible({ ...femaleNoGenderPlayer, status: "done" }, "womens"),
  false,
);
assert.equal(
  isTournamentPlayerEligible({
    ...maleNoGenderPlayer,
    preferNoGender: false,
    preferWomens: true,
  }, "mens"),
  false,
);
assert.equal(isTournamentPlayerEligible({
  ...maleNoGenderPlayer,
  preferNoGender: false,
}, "mens"), false);
assert.equal(isTournamentPlayerEligible({
  ...maleNoGenderPlayer,
  preferNoGender: false,
  preferMens: false,
}, "no_gender"), true);

const fallbackPreviewPlayers = [
  ...players.slice(0, 3).map((player) => ({
    ...player,
    preferMens: true,
    preferWomens: false,
    preferMixed: false,
    preferNoGender: false,
  })),
  {
    ...players[3],
    preferMens: false,
    preferWomens: false,
    preferMixed: false,
    preferNoGender: true,
  },
];
const fallbackPreview = buildRotationPreview({
  players: fallbackPreviewPlayers,
  selectedPlayerIds: fallbackPreviewPlayers.map((player) => player.id),
  locks: [],
  matchType: "doubles",
  category: "mens",
});
assert.equal(fallbackPreview.canGenerate, true);
assert.equal(fallbackPreview.matches.length, 1);

console.log("UI utility tests passed.");
