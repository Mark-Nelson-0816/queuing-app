import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getPagination } from "../src/utils/pagination.js";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

assert.deepEqual(getPagination(27, 1, 10), {
  currentPage: 1,
  totalPages: 3,
  startIndex: 0,
  endIndex: 10,
});
assert.deepEqual(getPagination(27, 1, 25), {
  currentPage: 1,
  totalPages: 2,
  startIndex: 0,
  endIndex: 25,
});
assert.deepEqual(getPagination(27, 2, 25), {
  currentPage: 2,
  totalPages: 2,
  startIndex: 25,
  endIndex: 27,
});

for (const relativePath of [
  "src/components/tournament/RegisteredPlayers.jsx",
  "src/components/tournament/TournamentMatchManagement.jsx",
  "src/components/players/AllPlayersTable.jsx",
  "src/components/players/RegisteredPlayersTable.jsx",
]) {
  const source = readFileSync(path.join(repositoryRoot, relativePath), "utf8");
  assert.doesNotMatch(
    source,
    /overflow-y-auto|max-h-\[/,
    `${relativePath} must let pagination control vertical length`,
  );
}

const tournamentSelectorSource = readFileSync(
  path.join(repositoryRoot, "src/components/tournament/RegisteredPlayers.jsx"),
  "utf8",
);
// Select All must use the complete search-filtered result, not only the page or all profiles.
assert.match(tournamentSelectorSource, /filteredPlayers\.map\(\(player\) => Number\(player\.id\)\)/);
assert.match(tournamentSelectorSource, /filteredPlayers\.every\(\(player\) => selectedIdSet\.has\(Number\(player\.id\)\)\)/);

console.log("Tournament paginated-layout checks passed for 10, 25, and partial pages.");
