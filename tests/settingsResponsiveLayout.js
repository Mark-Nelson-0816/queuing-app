import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const source = readFileSync(
  path.join(repositoryRoot, "src/pages/Settings.jsx"),
  "utf8",
);

// Laptop widths retain two readable summary cards and one full-width settings card.
assert.match(source, /min-w-0 space-y-5/);
assert.match(source, /grid gap-3 sm:grid-cols-2 2xl:grid-cols-3/);
assert.match(source, /grid items-start gap-5 2xl:grid-cols-2/);
assert.match(source, /className="2xl:col-span-2"/);

// Segmented controls keep operational labels on one line and use a balanced 2x2 fallback.
assert.match(source, /const optionGrid = options\.length === 4/);
assert.match(source, /"grid-cols-2 2xl:grid-cols-4"/);
assert.match(source, /min-w-0 whitespace-nowrap rounded-lg/);
assert.match(source, /whitespace-nowrap rounded-xl border px-3 py-2\.5 text-sm/);

// Long descriptions and paths stay in their cards, while buttons and toggles remain stable.
assert.match(source, /flex min-w-0 flex-col gap-3 py-3 sm:flex-row/);
assert.match(source, /self-start whitespace-nowrap rounded-xl/);
assert.match(source, /relative mt-0\.5 inline-flex h-6 w-11 shrink-0/);
assert.match(source, /font-mono text-xs \[overflow-wrap:anywhere\]/);
assert.match(source, /Desktop Configuration/);

// Preserve the existing Settings behavior and confirmation wiring.
assert.match(source, /Promise\.allSettled/);
assert.match(source, /current\[key\] === value/);
assert.match(source, /window\.api\.backupDatabase/);
assert.match(source, /showBackupConfirm/);
assert.doesNotMatch(source, /window\.api\.resetAllData/);
assert.doesNotMatch(source, /showResetConfirm/);
assert.doesNotMatch(source, />Reset Application Data</);

console.log("Settings responsive-layout source checks passed.");
