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

const page = readSource("src/pages/PublicDisplayPage.jsx");
const display = readSource("src/components/PublicDisplay.jsx");

// Keep the read-only refresh source and structured Rotation teams for Next Up.
assert.match(page, /\.filter\(\(match\) => match\.source === "rotation"\)/);
assert.match(page, /const teamA = match\.teamA\.map\(\(player\) => player\.name\)/);
assert.match(page, /const teamB = match\.teamB\.map\(\(player\) => player\.name\)/);
assert.match(page, /setInterval\(refreshData, 10000\)/);
assert.match(page, /Promise\.allSettled/);
assert.doesNotMatch(page, /startRotationMatch|finishRotationMatch|startTournamentMatch|finishTournamentMatch/);

// Keep venue-monitor content inside the renderer viewport with Next Up on the right.
assert.match(display, /flex h-screen min-h-0 flex-col overflow-hidden/);
assert.match(display, /grid-cols-\[minmax\(0,1fr\)_17rem\]/);
assert.match(display, /function getCourtLayout\(activeCourtCount\)/);
assert.match(display, /activeCourtCount === 2/);
assert.match(display, /activeCourtCount <= 4/);
assert.match(display, /Math\.ceil\(activeCourtCount \/ 3\)/);
assert.match(display, /gridTemplateRows: `repeat\(\$\{courtLayout\.rows\}, minmax\(0, 1fr\)\)`/);

// Court cards use their full grid cell and compact, one-line player boxes.
assert.match(display, /title=\{court\.name\}/);
assert.match(display, /title=\{player\.name\}/);
assert.match(display, /flex h-full min-h-0 min-w-0 max-w-full flex-col/);
assert.match(display, /flex min-h-0 min-w-0 flex-1 flex-col justify-center/);
assert.match(display, /team\?\.players\.length > 1 \? "grid-cols-2" : "grid-cols-1"/);
assert.match(display, /min-w-0 max-w-full overflow-hidden rounded-lg/);
assert.match(display, /overflow-hidden truncate whitespace-nowrap font-bold/);
assert.doesNotMatch(display, /grid-cols-1 xl:grid-cols-2/);
assert.match(display, /match\.division === "adult" \? formatLabel\(match\.level\) : null/);
assert.match(display, /matchMetadata\.join/);

// Next Up keeps its six-item cap, a stable queue number, and separate readable teams.
assert.match(display, /queueNext\.slice\(0, 6\)/);
assert.match(display, /function NextUpTeams\(\{ entry, compact \}\)/);
assert.match(display, /entry\.teamA\.map\(\(name, index\)/);
assert.match(display, /entry\.teamB\.map\(\(name, index\)/);
assert.match(display, /key=\{`a-\$\{index\}`\}/);
assert.match(display, /key=\{`b-\$\{index\}`\}/);
assert.doesNotMatch(display, /teamA\.join\(" \/ "\)/);
assert.doesNotMatch(display, /teamB\.join\(" \/ "\)/);

console.log("Public Display responsive-layout source checks passed.");
