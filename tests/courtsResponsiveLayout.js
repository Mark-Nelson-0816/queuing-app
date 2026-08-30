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

const page = readSource("src/pages/Courts.jsx");
const card = readSource("src/components/CourtCard.jsx");

// The page keeps two readable cards on laptops and reserves three columns for wide desktops.
assert.match(page, /min-w-0 space-y-5/);
assert.match(page, /grid-cols-1 items-start gap-4 sm:grid-cols-2 2xl:grid-cols-3/);
assert.match(page, /flex flex-wrap items-center gap-3/);
assert.match(page, /min-w-0 flex-1 basis-64/);
assert.match(page, /shrink-0 whitespace-nowrap rounded-xl bg-green-500/);

// Team badges must stay inside their panel and retain the full player name in a tooltip.
assert.match(card, /const hasMultiplePlayers = team\.players\.length > 1/);
assert.match(card, /flex min-w-0 max-w-full flex-wrap gap-1\.5/);
assert.match(card, /inline-flex min-w-0 max-w-full items-center rounded-full/);
assert.match(card, /sm:max-w-\[calc\(50%-0\.1875rem\)\]/);
assert.match(card, /title=\{`\$\{player\.name\}/);
assert.match(card, /<span className="truncate">\{player\.name\}<\/span>/);

// Long court and Tournament names are constrained, while existing source distinctions remain explicit.
assert.match(card, /truncate text-lg font-bold/);
assert.match(card, /title=\{court\.name\}/);
assert.match(card, /activeMatch\?\.source === "tournament"/);
assert.match(card, /activeMatch\?\.source === "rotation"/);
assert.match(card, /Legacy Normal Match/);
assert.match(card, /activeMatch\.division === "adult" && activeMatch\.level && activeMatch\.level !== "all"/);
assert.match(card, /function formatDivision/);

// Content grows naturally instead of clipping the active match or forcing an equal card height.
assert.match(card, /min-h-\[7rem\]/);
assert.doesNotMatch(card, /overflow-hidden/);

console.log("Courts responsive-layout source checks passed.");
