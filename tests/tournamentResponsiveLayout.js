import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const readSource = (relativePath) => readFileSync(
  path.join(repositoryRoot, relativePath),
  "utf8",
);

const page = readSource("src/pages/Tournament.jsx");
const navigator = readSource("src/components/tournament/TournamentEventNavigator.jsx");
const options = readSource("src/components/tournament/TournamentOptions.jsx");
const players = readSource("src/components/tournament/RegisteredPlayers.jsx");
const summary = readSource("src/components/tournament/TournamentConfigurationSummary.jsx");
const matches = readSource("src/components/tournament/TournamentMatchManagement.jsx");

// Keep normal laptop widths single-column so event and match controls have room.
assert.match(page, /2xl:grid-cols-\[18rem_minmax\(0,1fr\)\]/);
assert.match(navigator, /grid gap-2 p-3 2xl:max-h-\[35rem\] 2xl:block/);
assert.match(navigator, /2xl:sticky 2xl:top-0/);

// Keep all configuration controls visible without forcing four narrow fields too early.
assert.match(options, /division === "adult" \? "2xl:grid-cols-4" : "2xl:grid-cols-3"/);
assert.match(options, /division === "adult" && \(/);

// Preserve the paginated, memoized selector and its across-page Select All behavior.
assert.match(players, /filteredPlayers\.map\(\(player\) => Number\(player\.id\)\)/);
assert.match(players, /getPagination\(filteredPlayers\.length, page, pageSize\)/);
assert.match(players, /xl:grid-cols-\[minmax\(14rem,1fr\)_auto\]/);

// Long names are contained while standings can scroll horizontally only when required.
assert.match(summary, /overflow-x-auto/);
assert.match(summary, /min-w-\[34rem\] w-full table-fixed/);
assert.match(summary, /break-words font-semibold/);
assert.match(matches, /xl:grid-cols-\[minmax\(0,1fr\)_auto_minmax\(0,1fr\)\]/);
assert.match(matches, /title=\{player\.name\}/);

// Score review/edit behavior remains in the existing wider confirmation dialogs.
assert.match(page, /title="Confirm Match Result"[\s\S]*maxWidthClass="max-w-2xl"/);
assert.match(page, /title="Confirm Result Update"[\s\S]*maxWidthClass="max-w-2xl"/);
assert.match(matches, /validateTournamentScoreInput/);
assert.match(matches, /canEditResult=\{!readOnly && tournament\.status === "ongoing"\}/);

console.log("Tournament responsive-layout source checks passed.");
