import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const rotationSource = readFileSync(
  new URL("../src/components/rotation/RotationPlayerPool.jsx", import.meta.url),
  "utf8",
);
const queueSource = readFileSync(
  new URL("../src/pages/Queue.jsx", import.meta.url),
  "utf8",
);
const profilesSource = readFileSync(
  new URL("../src/components/players/AllPlayersTable.jsx", import.meta.url),
  "utf8",
);
const todaySource = readFileSync(
  new URL("../src/components/players/RegisteredPlayersTable.jsx", import.meta.url),
  "utf8",
);
const playersPageSource = readFileSync(
  new URL("../src/pages/Players.jsx", import.meta.url),
  "utf8",
);
const settingsSource = readFileSync(
  new URL("../src/pages/Settings.jsx", import.meta.url),
  "utf8",
);

assert.match(rotationSource, /Matches Today: All/);
assert.match(rotationSource, /Matches Today: Lowest/);
assert.match(rotationSource, /Matches Today: Highest/);
assert.doesNotMatch(rotationSource, /Matches Today: [012]|Matches Today: 3\+/);
assert.ok(
  rotationSource.indexOf("sortPlayersByMatchesToday(defaultOrderedPlayers")
    < rotationSource.indexOf("getPagination(filteredPlayers.length"),
);
assert.match(rotationSource, /getFilteredEligiblePlayerIds\(filteredPlayers/);
assert.doesNotMatch(rotationSource, /Select all eligible players on this page/);
assert.match(rotationSource, /Select all eligible players in filtered results/);
assert.match(rotationSource, /onSelectionChange\(\(current\) =>/);
assert.match(rotationSource, /buildRotationSelectionStatus\(/);
assert.match(queueSource, /noticeTone === "warning"/);
assert.match(queueSource, /groupRotationUnmatchedPlayers/);

for (const source of [profilesSource, todaySource]) {
  assert.match(source, /table-fixed/);
  assert.match(source, /<colgroup>/);
  assert.doesNotMatch(source, /overflow-y-auto|max-h-/);
}
assert.match(profilesSource, /Add Profile<\/button>/);
assert.match(todaySource, /"Mark All Done"/);
assert.match(playersPageSource, /window\.api\.markAllRegisteredPlayersDone\(\)/);
assert.match(settingsSource, /window\.api\.backupDatabase\(\)/);
assert.match(settingsSource, /window\.api\.clearOldRotationHistory\(\)/);

console.log("Focused revision UI contract checks passed.");
