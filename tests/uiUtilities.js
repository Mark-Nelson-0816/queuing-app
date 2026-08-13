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
  getEligibleTournamentProfiles,
  getTournamentSelectionDetails,
  validateTournamentSelection,
} from "../src/utils/tournamentSelection.js";

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

const tournamentProfiles = [
  { id: 101, name: "Mens Beginner", level: "beginner", gender: "male" },
  { id: 102, name: "Womens Beginner", level: "Beginner", gender: "female" },
  { id: 103, name: "Mens Intermediate", level: "intermediate", gender: "male" },
];
assert.deepEqual(
  getEligibleTournamentProfiles(tournamentProfiles, "beginner", "mens").map((player) => player.id),
  [101],
);
assert.deepEqual(
  getEligibleTournamentProfiles(tournamentProfiles, "beginner", "womens").map((player) => player.id),
  [102],
);
assert.deepEqual(
  getEligibleTournamentProfiles(tournamentProfiles, "beginner", "no_gender").map((player) => player.id),
  [101, 102],
);
assert.deepEqual(
  getEligibleTournamentProfiles(tournamentProfiles, "beginner", "mixed").map((player) => player.id),
  [101, 102],
);
const tournamentSelection = getTournamentSelectionDetails(
  [101, 102],
  tournamentProfiles,
);
assert.equal(tournamentSelection.selectedIdSet.has(101), true);
assert.deepEqual(tournamentSelection.genderCounts, { male: 1, female: 1 });
assert.equal(validateTournamentSelection(
  [101, 102, 103, 104],
  new Map([
    [101, tournamentProfiles[0]],
    [102, tournamentProfiles[1]],
    [103, tournamentProfiles[2]],
    [104, { id: 104, gender: "female" }],
  ]),
  "doubles",
  "mixed",
).ready, true);

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
