import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import {
  TOURNAMENT_CATEGORIES,
  TOURNAMENT_ALL_LEVELS,
  TOURNAMENT_DIVISIONS,
  TOURNAMENT_LEVELS,
  assignTournamentTeamsToGroups,
  buildTournamentConfigurationTeams,
  generateTournamentConfiguration,
  generateTournamentGroupRoundRobin,
  getTournamentGroupLabel,
  getTournamentGroupSizes,
  validateTournamentConfiguration,
  validateTournamentConfigurationPlayers,
  validateTournamentTeamCount,
} from "../database/tournamentGenerationLogic.js";

const REQUIRED_TEAM_COUNTS = [
  4, 5, 6, 8, 9, 10, 11, 12, 13, 14, 15, 16,
];
const REQUIRED_GROUP_SIZES = new Map([
  [4, [4]],
  [5, [5]],
  [6, [6]],
  [8, [4, 4]],
  [9, [5, 4]],
  [10, [5, 5]],
  [11, [6, 5]],
  [12, [4, 4, 4]],
  [13, [5, 4, 4]],
  [14, [5, 5, 4]],
  [15, [5, 5, 5]],
  [16, [4, 4, 4, 4]],
]);

// Provides repeatable shuffles without changing production randomness.
function createSeededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

// Builds valid permanent-profile-shaped players for one configuration.
function makePlayers(playerCount, configuration, startId = 1) {
  return Array.from({ length: playerCount }, (_, index) => {
    let gender = index % 2 === 0 ? "male" : "female";
    if (configuration.category === "mens") gender = "male";
    if (configuration.category === "womens") gender = "female";

    return {
      id: startId + index,
      name: `Player ${startId + index}`,
      level: configuration.division === "adult"
        ? configuration.level
        : TOURNAMENT_LEVELS[index % TOURNAMENT_LEVELS.length],
      gender,
      // Revised Tournament generation deliberately ignores Rotation preferences.
      preferMens: false,
      preferWomens: false,
      preferMixed: false,
      preferNoGender: false,
      rankMatchPreference: "adjacent_rank",
    };
  });
}

// Verifies the mathematical and per-round guarantees for one generated group.
function assertValidGroupSchedule(group) {
  const groupTeamNumbers = new Set(
    group.teams.map((team) => team.teamNumber),
  );
  const expectedMatches = group.teams.length * (group.teams.length - 1) / 2;
  const expectedRounds = group.teams.length % 2 === 0
    ? group.teams.length - 1
    : group.teams.length;
  const pairKeys = new Set();
  let actualMatches = 0;

  assert.equal(group.rounds.length, expectedRounds);

  for (const round of group.rounds) {
    const roundTeamNumbers = new Set();

    for (const match of round.matches) {
      actualMatches += 1;
      assert.equal(match.status, "waiting");
      assert.notEqual(match.teamANumber, match.teamBNumber);
      assert.equal(groupTeamNumbers.has(match.teamANumber), true);
      assert.equal(groupTeamNumbers.has(match.teamBNumber), true);
      assert.equal(roundTeamNumbers.has(match.teamANumber), false);
      assert.equal(roundTeamNumbers.has(match.teamBNumber), false);
      roundTeamNumbers.add(match.teamANumber);
      roundTeamNumbers.add(match.teamBNumber);

      const pairKey = [match.teamANumber, match.teamBNumber]
        .sort((first, second) => first - second)
        .join("-");
      assert.equal(pairKeys.has(pairKey), false);
      pairKeys.add(pairKey);
    }
  }

  assert.equal(actualMatches, expectedMatches);
  assert.equal(pairKeys.size, expectedMatches);
}

// Verifies teams, snapshots, grouping, and schedules for one generated fixture.
function assertValidGeneration(players, configuration, generated, teamCount) {
  assert.deepEqual(generated.configuration, configuration);
  assert.equal(generated.teams.length, teamCount);
  assert.deepEqual(
    generated.groups.map((group) => group.teams.length),
    getTournamentGroupSizes(teamCount),
  );

  const selectedPlayerIds = new Set(players.map((player) => player.id));
  const generatedPlayerIds = [];
  const generatedTeamNumbers = [];

  for (const team of generated.teams) {
    generatedTeamNumbers.push(team.teamNumber);
    assert.equal(
      team.members.length,
      configuration.matchType === "singles" ? 1 : 2,
    );
    assert.equal(team.player1Id, team.members[0].playerId);
    assert.equal(team.player2Id, team.members[1]?.playerId ?? null);

    for (const member of team.members) {
      generatedPlayerIds.push(member.playerId);
      assert.equal(selectedPlayerIds.has(member.playerId), true);
      assert.equal(
        member.levelSnapshot,
        players.find((player) => player.id === member.playerId).level,
      );
      assert.equal(member.slot >= 1 && member.slot <= 2, true);
    }

    if (configuration.category === "mixed") {
      assert.deepEqual(
        new Set(team.members.map((member) => member.genderSnapshot)),
        new Set(["male", "female"]),
      );
    }
  }

  assert.equal(new Set(generatedPlayerIds).size, players.length);
  assert.equal(generatedPlayerIds.length, players.length);
  assert.equal(new Set(generatedTeamNumbers).size, teamCount);

  const groupedTeamNumbers = generated.groups.flatMap((group) => (
    group.teams.map((team) => team.teamNumber)
  ));
  assert.equal(groupedTeamNumbers.length, teamCount);
  assert.equal(new Set(groupedTeamNumbers).size, teamCount);

  for (let index = 0; index < generated.groups.length; index += 1) {
    const group = generated.groups[index];
    const label = getTournamentGroupLabel(index);
    assert.equal(group.groupNumber, index + 1);
    assert.equal(group.label, label);
    assert.equal(group.name, `Group ${label}`);
    assertValidGroupSchedule(group);
  }
}

// Confirms the revised small-team rules and unchanged 8+ grouping behavior.
for (const [teamCount, sizes] of REQUIRED_GROUP_SIZES) {
  assert.deepEqual(getTournamentGroupSizes(teamCount), sizes);
}
for (const teamCount of [1, 2, 3]) {
  assert.throws(
    () => getTournamentGroupSizes(teamCount),
    /requires at least 4 teams/i,
  );
}
assert.throws(
  () => getTournamentGroupSizes(7),
  /exactly 7 teams are not supported/i,
);
assert.throws(
  () => getTournamentGroupSizes(2.5),
  /non-negative integer/i,
);
assert.equal(validateTournamentTeamCount(4), true);

for (let teamCount = 17; teamCount <= 500; teamCount += 1) {
  const sizes = getTournamentGroupSizes(teamCount);
  assert.equal(sizes.reduce((sum, size) => sum + size, 0), teamCount);
  assert.ok(sizes.every((size) => size >= 4 && size <= 6));
  assert.ok(Math.max(...sizes) - Math.min(...sizes) <= 1);
  assert.equal(sizes.length, Math.floor(teamCount / 4));
}

assert.equal(getTournamentGroupLabel(0), "A");
assert.equal(getTournamentGroupLabel(25), "Z");
assert.equal(getTournamentGroupLabel(26), "AA");
assert.equal(getTournamentGroupLabel(27), "AB");
assert.equal(getTournamentGroupLabel(701), "ZZ");
assert.equal(getTournamentGroupLabel(702), "AAA");

let generatedFixtureCount = 0;

// Exercises every Adult level and every level-independent minor Singles identity.
for (const division of TOURNAMENT_DIVISIONS) {
  const configurationLevels = division === "adult"
    ? TOURNAMENT_LEVELS
    : [TOURNAMENT_ALL_LEVELS];
  for (const level of configurationLevels) {
    for (const category of ["mens", "womens", "no_gender"]) {
      for (const teamCount of REQUIRED_TEAM_COUNTS) {
        const configuration = {
          division,
          matchType: "singles",
          category,
          level,
        };
        const players = makePlayers(teamCount, configuration);
        const generated = generateTournamentConfiguration(
          players,
          configuration,
          createSeededRandom(generatedFixtureCount + 1),
        );
        assertValidGeneration(players, configuration, generated, teamCount);
        generatedFixtureCount += 1;
      }
    }
  }
}

// Exercises every Adult level and every level-independent minor Doubles identity.
for (const division of TOURNAMENT_DIVISIONS) {
  const configurationLevels = division === "adult"
    ? TOURNAMENT_LEVELS
    : [TOURNAMENT_ALL_LEVELS];
  for (const level of configurationLevels) {
    for (const category of TOURNAMENT_CATEGORIES) {
      for (const teamCount of REQUIRED_TEAM_COUNTS) {
        const configuration = {
          division,
          matchType: "doubles",
          category,
          level,
        };
        const players = makePlayers(teamCount * 2, configuration);
        const generated = generateTournamentConfiguration(
          players,
          configuration,
          createSeededRandom(generatedFixtureCount + 1),
        );
        assertValidGeneration(players, configuration, generated, teamCount);
        generatedFixtureCount += 1;
      }
    }
  }
}

// Confirms all generated schedules are group-local with no cross-group pairing.
const crossGroupConfiguration = {
  division: "adult",
  matchType: "singles",
  category: "no_gender",
  level: "advanced",
};
const crossGroupResult = generateTournamentConfiguration(
  makePlayers(16, crossGroupConfiguration),
  crossGroupConfiguration,
  createSeededRandom(42),
);
const groupByTeamNumber = new Map();
for (const group of crossGroupResult.groups) {
  for (const team of group.teams) {
    groupByTeamNumber.set(team.teamNumber, group.groupNumber);
  }
  for (const round of group.rounds) {
    for (const match of round.matches) {
      assert.equal(
        groupByTeamNumber.get(match.teamANumber),
        groupByTeamNumber.get(match.teamBNumber),
      );
    }
  }
}

// Invalid configuration and participant cases must fail before persistence.
const baseConfiguration = {
  division: "adult",
  matchType: "singles",
  category: "mens",
  level: "beginner",
};
assert.equal(validateTournamentConfiguration(baseConfiguration), true);
assert.throws(
  () => validateTournamentConfiguration({ ...baseConfiguration, division: "u19" }),
  /division/i,
);
assert.throws(
  () => validateTournamentConfiguration({ ...baseConfiguration, level: "elite" }),
  /level/i,
);
assert.equal(validateTournamentConfiguration({
  ...baseConfiguration,
  division: "u17",
  level: TOURNAMENT_ALL_LEVELS,
}), true);
assert.throws(
  () => validateTournamentConfiguration({ ...baseConfiguration, division: "u17" }),
  /all player levels/i,
);
assert.throws(
  () => validateTournamentConfiguration({ ...baseConfiguration, matchType: "teams" }),
  /match type/i,
);
assert.throws(
  () => validateTournamentConfiguration({ ...baseConfiguration, category: "mixed" }),
  /only available for Doubles/i,
);
for (const teamCount of [1, 2, 3, 7]) {
  assert.throws(
    () => generateTournamentConfiguration(
      makePlayers(teamCount, baseConfiguration),
      baseConfiguration,
      createSeededRandom(teamCount),
    ),
    teamCount === 7
      ? /exactly 7 teams are not supported/i
      : /requires at least 4 teams/i,
  );
}

const doublesConfiguration = {
  ...baseConfiguration,
  matchType: "doubles",
};
for (const playerCount of [2, 4, 6, 14]) {
  assert.throws(
    () => generateTournamentConfiguration(
      makePlayers(playerCount, doublesConfiguration),
      doublesConfiguration,
      createSeededRandom(playerCount + 100),
    ),
    playerCount === 14
      ? /exactly 7 teams are not supported/i
      : /requires at least 4 teams/i,
  );
}
assert.throws(
  () => validateTournamentConfigurationPlayers(
    makePlayers(5, doublesConfiguration),
    doublesConfiguration,
  ),
  /even number.*Add one more player/i,
);

const wrongGenderPlayers = makePlayers(4, doublesConfiguration);
wrongGenderPlayers[3] = { ...wrongGenderPlayers[3], gender: "female" };
assert.throws(
  () => validateTournamentConfigurationPlayers(
    wrongGenderPlayers,
    doublesConfiguration,
  ),
  /only include male players/i,
);

const womensConfiguration = {
  ...doublesConfiguration,
  category: "womens",
};
const wrongWomensGender = makePlayers(4, womensConfiguration);
wrongWomensGender[0] = { ...wrongWomensGender[0], gender: "male" };
assert.throws(
  () => validateTournamentConfigurationPlayers(
    wrongWomensGender,
    womensConfiguration,
  ),
  /only include female players/i,
);

const wrongLevelPlayers = makePlayers(2, baseConfiguration);
wrongLevelPlayers[1] = { ...wrongLevelPlayers[1], level: "advanced" };
assert.throws(
  () => validateTournamentConfigurationPlayers(
    wrongLevelPlayers,
    baseConfiguration,
  ),
  /does not match the configuration level/i,
);

const duplicatePlayers = makePlayers(2, baseConfiguration);
duplicatePlayers[1] = { ...duplicatePlayers[1], id: duplicatePlayers[0].id };
assert.throws(
  () => validateTournamentConfigurationPlayers(
    duplicatePlayers,
    baseConfiguration,
  ),
  /only appear once/i,
);

const mixedConfiguration = {
  ...doublesConfiguration,
  category: "mixed",
};
const unequalMixedPlayers = makePlayers(6, mixedConfiguration).map(
  (player, index) => ({ ...player, gender: index < 4 ? "male" : "female" }),
);
assert.throws(
  () => validateTournamentConfigurationPlayers(
    unequalMixedPlayers,
    mixedConfiguration,
  ),
  /2 more female players/i,
);

const reverseUnequalMixedPlayers = makePlayers(6, mixedConfiguration).map(
  (player, index) => ({ ...player, gender: index < 2 ? "male" : "female" }),
);
assert.throws(
  () => validateTournamentConfigurationPlayers(
    reverseUnequalMixedPlayers,
    mixedConfiguration,
  ),
  /2 more male players/i,
);

// Minor divisions ignore level but continue enforcing every category constraint.
const minorMensConfiguration = {
  division: "u15",
  matchType: "doubles",
  category: "mens",
  level: TOURNAMENT_ALL_LEVELS,
};
const invalidMinorMens = makePlayers(8, minorMensConfiguration);
invalidMinorMens[0] = { ...invalidMinorMens[0], gender: "female" };
assert.throws(
  () => validateTournamentConfigurationPlayers(invalidMinorMens, minorMensConfiguration),
  /only include male players/i,
);
const minorWomensConfiguration = { ...minorMensConfiguration, category: "womens" };
const invalidMinorWomens = makePlayers(8, minorWomensConfiguration);
invalidMinorWomens[0] = { ...invalidMinorWomens[0], gender: "male" };
assert.throws(
  () => validateTournamentConfigurationPlayers(invalidMinorWomens, minorWomensConfiguration),
  /only include female players/i,
);
const invalidMinorOdd = makePlayers(9, {
  ...minorMensConfiguration,
  category: "no_gender",
});
assert.throws(
  () => validateTournamentConfigurationPlayers(
    invalidMinorOdd,
    { ...minorMensConfiguration, category: "no_gender" },
  ),
  /even number/i,
);
const invalidMinorMixed = makePlayers(8, {
  ...minorMensConfiguration,
  category: "mixed",
}).map((player, index) => ({ ...player, gender: index < 5 ? "male" : "female" }));
assert.throws(
  () => validateTournamentConfigurationPlayers(
    invalidMinorMixed,
    { ...minorMensConfiguration, category: "mixed" },
  ),
  /2 more female players/i,
);
assert.throws(
  () => generateTournamentConfiguration(
    makePlayers(4, { ...minorMensConfiguration, matchType: "singles", category: "mixed" }),
    { ...minorMensConfiguration, matchType: "singles", category: "mixed" },
  ),
  /only available for Doubles/i,
);
const duplicateMinorPlayers = makePlayers(8, minorMensConfiguration);
duplicateMinorPlayers[1] = { ...duplicateMinorPlayers[1], id: duplicateMinorPlayers[0].id };
assert.throws(
  () => validateTournamentConfigurationPlayers(duplicateMinorPlayers, minorMensConfiguration),
  /only appear once/i,
);

// Small valid configurations use one group and the existing circle method.
for (const [teamCount, expectedMatches] of [[4, 6], [5, 10], [6, 15]]) {
  const generated = generateTournamentConfiguration(
    makePlayers(teamCount, baseConfiguration),
    baseConfiguration,
    createSeededRandom(teamCount + 200),
  );
  assert.deepEqual(generated.groups.map((group) => group.teams.length), [teamCount]);
  assert.equal(
    generated.groups[0].rounds.reduce((sum, round) => sum + round.matches.length, 0),
    expectedMatches,
  );
  assertValidGroupSchedule(generated.groups[0]);
}

// Direct helpers also reject duplicate teams and preserve one-member Singles.
const validSinglesPlayers = makePlayers(4, baseConfiguration);
const validSinglesTeams = buildTournamentConfigurationTeams(
  validSinglesPlayers,
  baseConfiguration,
  createSeededRandom(10),
);
assert.ok(validSinglesTeams.every((team) => team.members.length === 1));
assert.throws(
  () => assignTournamentTeamsToGroups([
    validSinglesTeams[0],
    { ...validSinglesTeams[1], teamNumber: validSinglesTeams[0].teamNumber },
  ]),
  /team numbers must be unique/i,
);
assert.throws(
  () => generateTournamentGroupRoundRobin([
    validSinglesTeams[0],
    { ...validSinglesTeams[1], teamNumber: validSinglesTeams[0].teamNumber },
  ]),
  /team numbers must be unique/i,
);

// Large selections must remain bounded and responsive.
const performanceResults = [];
for (const playerCount of [80, 160, 640]) {
  const configuration = {
    division: "u17",
    matchType: "doubles",
    category: "mixed",
    level: TOURNAMENT_ALL_LEVELS,
  };
  const players = makePlayers(playerCount, configuration, playerCount * 10);
  const startedAt = performance.now();
  const generated = generateTournamentConfiguration(
    players,
    configuration,
    createSeededRandom(playerCount),
  );
  const durationMs = performance.now() - startedAt;
  const teamCount = playerCount / 2;

  assertValidGeneration(players, configuration, generated, teamCount);
  assert.ok(durationMs < 2000, `${playerCount}-player generation took too long`);
  performanceResults.push({ playerCount, durationMs });
}

console.log(
  `Tournament generation logic checks passed across ${generatedFixtureCount} matrix fixtures.`,
);
for (const result of performanceResults) {
  console.log(`${result.playerCount} players: ${result.durationMs.toFixed(2)} ms`);
}
