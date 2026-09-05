import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function readSource(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

const playersPage = readSource("src/pages/Players.jsx");
const profilesTable = readSource("src/components/players/AllPlayersTable.jsx");
const todayTable = readSource("src/components/players/RegisteredPlayersTable.jsx");
const profileModal = readSource("src/components/players/PlayerProfileModal.jsx");
const registerModal = readSource("src/components/players/RegisterPlayerToday.jsx");
const playerBadges = readSource("src/components/players/PlayerBadges.jsx");
const sharedModal = readSource("src/components/Modal.jsx");

// The page and both table cards must be allowed to shrink beside the sidebar.
assert.match(playersPage, /min-w-0 space-y-3/);
assert.match(profilesTable, /min-w-0 overflow-hidden/);
assert.match(todayTable, /min-w-0 overflow-hidden/);

// Responsive fixed-column tables use their available card width and keep emergency horizontal scrolling.
for (const tableSource of [profilesTable, todayTable]) {
  assert.match(tableSource, /overflow-x-auto/);
  assert.match(tableSource, /<table className="w-full table-fixed/);
  assert.match(tableSource, /<colgroup>/);
  assert.doesNotMatch(tableSource, /overflow-y-auto|max-h-\[/);
}
assert.doesNotMatch(profilesTable, /min-w-\[1080px\]/);
assert.doesNotMatch(todayTable, /min-w-\[1000px\]/);

// Compact data badges remain single-line while profile actions can wrap inside narrow columns.
assert.match(playerBadges, /inline-flex whitespace-nowrap rounded-full/);
assert.match(profilesTable, /flex flex-wrap items-center justify-end/);
assert.match(profilesTable, /whitespace-nowrap rounded-lg bg-\[var\(--primary\)\]/);
assert.match(todayTable, /whitespace-nowrap rounded-lg border/);

// Long values expose the full content while retaining controlled table widths.
assert.match(profilesTable, /title=\{player\.name\} className="truncate/);
assert.match(todayTable, /title=\{player\.lockedTeammate\.name\}/);

// Player forms remain usable inside the existing height-bounded modal shell.
assert.match(sharedModal, /max-h-\[92vh\]/);
assert.match(sharedModal, /overflow-y-auto/);
assert.match(profileModal, /space-y-4/);
assert.match(profileModal, /flex flex-wrap justify-end/);
assert.match(registerModal, /max-h-\[46vh\]/);
assert.match(registerModal, /flex flex-wrap items-center justify-between/);

console.log("Players responsive-layout contract checks passed.");
