import assert from "node:assert/strict";
import { getPagination } from "../src/utils/pagination.js";
import {
  buildRotationPreview,
  countRankPreferences,
  getPlayerConfigurationReason,
} from "../src/utils/rotationUi.js";

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

console.log("UI utility tests passed.");
