import assert from "node:assert/strict";
import { getPagination } from "../src/utils/pagination.js";
import {
  getFilteredEligiblePlayerIds,
  sortPlayersByMatchesToday,
} from "../src/utils/rotationUi.js";

const levels = ["beginner", "intermediate", "upper_intermediate", "advanced"];

// Builds the requested 200-player, evenly distributed renderer-style fixture.
const players = Array.from({ length: 200 }, (_, index) => ({
  id: index + 1,
  name: `Player ${String(index + 1).padStart(3, "0")}`,
  level: levels[Math.floor(index / 50)],
  gender: index % 2 === 0 ? "male" : "female",
  matchCount: index % 6,
}));
const reasons = new Map(players.map((player) => [
  player.id,
  player.id % 17 === 0 ? "Player is currently playing a rotation match." : "",
]));

function currentFilter({ search = "", level = "all", gender = "all" } = {}) {
  const query = search.trim().toLowerCase();
  return players.filter((player) => (
    (!query || player.name.toLowerCase().includes(query))
    && (level === "all" || player.level === level)
    && (gender === "all" || player.gender === gender)
  ));
}

// Search, level, and gender combine before the Matches Today ordering.
const combined = currentFilter({ search: "  PLAYER 0", level: "beginner", gender: "male" });
assert.equal(combined.length, 25);
assert.equal(combined.every((player) => player.level === "beginner" && player.gender === "male"), true);
assert.equal(currentFilter({ search: "not found" }).length, 0);

const allOrder = sortPlayersByMatchesToday(combined, "all");
assert.equal(allOrder, combined);
const lowest = sortPlayersByMatchesToday(combined, "lowest");
const highest = sortPlayersByMatchesToday(combined, "highest");
assert.deepEqual(lowest.map((player) => player.matchCount), [...lowest.map((player) => player.matchCount)].sort((a, b) => a - b));
assert.deepEqual(highest.map((player) => player.matchCount), [...highest.map((player) => player.matchCount)].sort((a, b) => b - a));
for (const count of [0, 1, 2, 3, 4, 5]) {
  assert.deepEqual(
    lowest.filter((player) => player.matchCount === count).map((player) => player.id),
    combined.filter((player) => player.matchCount === count).map((player) => player.id),
  );
}

// Sorting applies to all filtered rows before the page slice, at every page size.
for (const total of [0, 1, 10, 11, 20, 80, 200]) {
  const subset = players.slice(0, total);
  for (const pageSize of [10, 25, 50, 100]) {
    const pageIds = [];
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    for (let page = 1; page <= totalPages; page += 1) {
      const pagination = getPagination(total, page, pageSize);
      pageIds.push(...subset.slice(pagination.startIndex, pagination.endIndex).map((player) => player.id));
    }
    assert.deepEqual(pageIds, subset.map((player) => player.id));
    assert.equal(new Set(pageIds).size, total);
  }
}
const sortedAllRows = sortPlayersByMatchesToday(players, "lowest");
const firstPage = sortedAllRows.slice(0, 10);
assert.notDeepEqual(firstPage.map((player) => player.id), players.slice(0, 10).map((player) => player.id));

// Select All uses the complete filtered result rather than its visible page.
const eligibleIds = getFilteredEligiblePlayerIds(players, reasons);
assert.equal(eligibleIds.length, players.filter((player) => player.id % 17 !== 0).length);
assert.equal(eligibleIds.length > 10, true);
assert.equal(eligibleIds.every((id) => !reasons.get(id)), true);
assert.equal(new Set(eligibleIds).size, eligibleIds.length);

console.log("Rotation player-list scale checks passed (200 players, filters, stable sorting, pagination, and cross-page selection).");
