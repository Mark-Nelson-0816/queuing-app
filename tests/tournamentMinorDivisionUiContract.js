import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  getEligibleTournamentProfiles,
} from "../src/utils/tournamentSelection.js";

const readSource = (relativePath) => readFileSync(
  new URL(`../${relativePath}`, import.meta.url),
  "utf8",
);

const profiles = [
  { id: 1, name: "Beginner Male", level: "beginner", gender: "male" },
  { id: 2, name: "Intermediate Female", level: "intermediate", gender: "female" },
  { id: 3, name: "Upper Male", level: "upper_intermediate", gender: "male" },
  { id: 4, name: "Advanced Female", level: "advanced", gender: "female" },
];

// Every minor division ignores the hidden level while preserving category gender rules.
for (const division of ["u17", "u15", "u13", "u11", "u9"]) {
  assert.deepEqual(
    getEligibleTournamentProfiles(profiles, division, "beginner", "no_gender")
      .map((player) => player.id),
    [1, 2, 3, 4],
  );
  assert.deepEqual(
    getEligibleTournamentProfiles(profiles, division, "advanced", "mens")
      .map((player) => player.id),
    [1, 3],
  );
  assert.deepEqual(
    getEligibleTournamentProfiles(profiles, division, "intermediate", "womens")
      .map((player) => player.id),
    [2, 4],
  );
}

assert.deepEqual(
  getEligibleTournamentProfiles(profiles, "adult", "beginner", "no_gender")
    .map((player) => player.id),
  [1],
);

const optionsSource = readSource("src/components/tournament/TournamentOptions.jsx");
const pageSource = readSource("src/pages/Tournament.jsx");
const summarySource = readSource("src/components/tournament/TournamentConfigurationSummary.jsx");
const matchSource = readSource("src/components/tournament/TournamentMatchManagement.jsx");
const publicDisplaySource = readSource("src/components/PublicDisplay.jsx");

assert.match(optionsSource, /division === "adult" && \(/);
assert.match(pageSource, /division === "adult" \? level : "all"/);
assert.match(pageSource, /division !== "adult" \|\| configuration\.level === level/);
assert.match(pageSource, /configuration\.id === openedConfigurationId/);
assert.match(summarySource, /configuration\.division === "adult" && \(/);
assert.match(matchSource, /configuration\.division === "adult" && \(/);
assert.match(
  publicDisplaySource,
  /match\.division === "adult" \? formatLabel\(match\.level\) : null/,
);

console.log("Tournament minor-division UI contract checks passed.");
