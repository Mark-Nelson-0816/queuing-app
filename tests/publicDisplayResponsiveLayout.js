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
assert.match(display, /const MAX_COLUMNS = 6/);
assert.match(display, /function getOptimalColumns\(count\)/);
assert.match(display, /if \(count <= 2\) return count/);
assert.match(display, /while \(Math\.ceil\(count \/ rows\) > MAX_COLUMNS\)/);
assert.match(display, /function chunkIntoRows\(items, columns\)/);
assert.match(display, /function getDensity\(columns, rowCount\)/);
assert.match(display, /const \{ rows: courtRows, styles \} = useMemo/);
assert.match(display, /courtRows\.map\(\(rowCourts, rowIndex\)/);
assert.match(display, /rowCourts\.map\(\(court\)/);
assert.match(display, /<AvailableCourtCard key=\{court\.id\}/);

// Court cards use their full grid cell with compact, vertical per-player teams.
assert.match(display, /title=\{court\.name\}/);
assert.match(display, /title=\{player\.name\}/);
assert.match(display, /flex h-full min-h-0 min-w-0 max-w-full flex-col/);
assert.match(display, /grid min-h-0 min-w-0 flex-1 grid-rows-\[minmax\(0,1fr\)_auto_minmax\(0,1fr\)\]/);
assert.match(display, /grid min-w-0 grid-cols-1/);
assert.match(display, /min-w-0 max-w-full overflow-hidden rounded-lg/);
assert.match(display, /overflow-hidden truncate whitespace-nowrap font-bold/);
assert.match(display, /text-base leading-5 2xl:text-lg 2xl:leading-6/);
assert.match(display, /text-\[clamp\(0\.9375rem,1\.1vw,1\.25rem\)\] leading-tight 2xl:text-xl 2xl:leading-6/);
assert.doesNotMatch(display, /team\?\.players\.length > 1 \? "grid-cols-2"/);
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
