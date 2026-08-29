import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function readSource(relativePath) {
  return readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
}

const queuePage = readSource("src/pages/Queue.jsx");
const playerPool = readSource("src/components/rotation/RotationPlayerPool.jsx");
const matches = readSource("src/components/rotation/RotationMatches.jsx");

// Rotation content must shrink beside either Sidebar state without widening the page.
assert.match(queuePage, /min-w-0 space-y-4/);
assert.match(playerPool, /grid min-w-0 grid-cols-1/);
assert.match(playerPool, /xl:grid-cols-\[17rem_minmax\(0,1fr\)\]/);

// The dense player filters must not use their wide five-column layout prematurely.
assert.match(playerPool, /md:grid-cols-2 2xl:grid-cols-/);
assert.match(playerPool, /min-w-0 w-full rounded-xl border/);
assert.match(playerPool, /Select all eligible players in filtered results/);
assert.match(playerPool, /whitespace-nowrap sm:ml-auto/);

// Player rows keep operational controls stable while long names can truncate.
assert.match(playerPool, /title=\{player\.name\} className="min-w-0 flex-1 truncate/);
assert.match(playerPool, /shrink-0 whitespace-nowrap rounded-full/);
assert.match(playerPool, /whitespace-nowrap text-\[10px\]/);

// Match-card teams and controls use bounded columns and wrapping action groups.
assert.match(matches, /grid-cols-\[minmax\(0,1fr\)_auto_minmax\(0,1fr\)\]/);
assert.match(matches, /flex flex-wrap gap-2/);
assert.match(matches, /inline-flex max-w-full items-center truncate whitespace-nowrap/);
assert.match(matches, /ml-0 inline-flex items-center gap-1 whitespace-nowrap/);
assert.match(matches, /flex w-full min-w-0 flex-wrap gap-2/);

// Rotation modal footers keep complete actions together and the finish list is height-bounded.
assert.match(queuePage, /max-h-56 space-y-2 overflow-y-auto/);
assert.match(queuePage, /whitespace-nowrap rounded-xl bg-\[var\(--success\)\]/);
assert.match(playerPool, /Lock Teammates/);
assert.match(playerPool, /shrink-0 whitespace-nowrap font-semibold disabled:opacity-40/);

console.log("Rotation responsive-layout contract checks passed.");
