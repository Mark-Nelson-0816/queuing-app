export const TOURNAMENT_DIVISIONS = Object.freeze([
  "adult",
  "u17",
  "u15",
  "u13",
  "u11",
  "u9",
]);

export const TOURNAMENT_LEVELS = Object.freeze([
  "beginner",
  "intermediate",
  "upper_intermediate",
  "advanced",
]);

export const TOURNAMENT_MATCH_TYPES = Object.freeze([
  "singles",
  "doubles",
]);

export const TOURNAMENT_CATEGORIES = Object.freeze([
  "mens",
  "womens",
  "mixed",
  "no_gender",
]);

const VALID_DIVISIONS = new Set(TOURNAMENT_DIVISIONS);
const VALID_LEVELS = new Set(TOURNAMENT_LEVELS);
const VALID_MATCH_TYPES = new Set(TOURNAMENT_MATCH_TYPES);
const VALID_CATEGORIES = new Set(TOURNAMENT_CATEGORIES);
const VALID_GENDERS = new Set(["male", "female"]);

const FIXED_GROUP_SIZES = new Map([
  [2, [2]],
  [3, [3]],
  [4, [4]],
  [5, [3, 2]],
  [6, [3, 3]],
  [7, [4, 3]],
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

// Returns a shuffled copy so Tournament generation never mutates its inputs.
function shuffle(items, random) {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [
      shuffled[randomIndex],
      shuffled[index],
    ];
  }

  return shuffled;
}

// Requires the caller's random source to behave like Math.random.
function validateRandom(random) {
  if (typeof random !== "function") {
    throw new Error("Tournament generation requires a random function.");
  }
}

// Returns a useful Mixed Doubles shortage message for the smaller gender group.
function getMixedShortageMessage(maleCount, femaleCount) {
  const neededCount = Math.abs(maleCount - femaleCount);
  const neededGender = maleCount < femaleCount ? "male" : "female";
  const playerWord = neededCount === 1 ? "player" : "players";
  return `Mixed Doubles needs ${neededCount} more ${neededGender} ${playerWord}.`;
}

// Creates the participant snapshot definition stored later by persistence logic.
function createTeamMember(player, slot) {
  return {
    slot,
    playerId: Number(player.id),
    levelSnapshot: player.level,
    genderSnapshot: player.gender,
  };
}

// Creates a pure team definition without pretending display numbers are DB IDs.
function createTeamDefinition(teamNumber, players) {
  const members = players.map((player, index) => (
    createTeamMember(player, index + 1)
  ));

  return {
    teamNumber,
    player1Id: members[0].playerId,
    player2Id: members[1]?.playerId ?? null,
    members,
  };
}

// Validates the four fields that uniquely identify a Tournament configuration.
export function validateTournamentConfiguration(configuration) {
  if (!configuration || typeof configuration !== "object") {
    throw new Error("Tournament configuration is required.");
  }

  const {
    division,
    matchType,
    category,
    level,
  } = configuration;

  if (!VALID_DIVISIONS.has(division)) {
    throw new Error("Invalid Tournament division.");
  }

  if (!VALID_MATCH_TYPES.has(matchType)) {
    throw new Error("Invalid Tournament match type.");
  }

  if (!VALID_CATEGORIES.has(category)) {
    throw new Error("Invalid Tournament category.");
  }

  if (!VALID_LEVELS.has(level)) {
    throw new Error("Invalid Tournament level.");
  }

  if (matchType === "singles" && category === "mixed") {
    throw new Error("Mixed category is only available for Doubles.");
  }

  return true;
}

// Validates profile IDs, exact level, gender, and participant-count rules.
export function validateTournamentConfigurationPlayers(players, configuration) {
  validateTournamentConfiguration(configuration);

  if (!Array.isArray(players)) {
    throw new Error("Please select Tournament players.");
  }

  const playerIds = players.map((player) => Number(player?.id));
  if (playerIds.some((id) => !Number.isInteger(id) || id <= 0)) {
    throw new Error("One or more selected Tournament players are invalid.");
  }

  if (new Set(playerIds).size !== playerIds.length) {
    throw new Error("A player can only appear once in this Tournament configuration.");
  }

  for (const player of players) {
    if (!VALID_GENDERS.has(player.gender)) {
      throw new Error(`${player.name || "A selected player"} has an invalid gender.`);
    }

    if (player.level !== configuration.level) {
      throw new Error(
        `${player.name || "A selected player"} does not match the configuration level.`,
      );
    }
  }

  if (configuration.matchType === "singles") {
    if (players.length < 2) {
      throw new Error("Singles requires at least two players.");
    }
  } else {
    if (players.length < 4) {
      throw new Error("Doubles requires at least four players.");
    }

    if (configuration.category === "mixed") {
      let maleCount = 0;
      let femaleCount = 0;

      for (const player of players) {
        if (player.gender === "male") maleCount += 1;
        if (player.gender === "female") femaleCount += 1;
      }

      if (maleCount !== femaleCount) {
        throw new Error(getMixedShortageMessage(maleCount, femaleCount));
      }
    } else if (players.length % 2 !== 0) {
      throw new Error(
        "Doubles requires an even number of players. Add one more player.",
      );
    }
  }

  if (
    configuration.category === "mens"
    && players.some((player) => player.gender !== "male")
  ) {
    throw new Error("Men's Tournament configurations may only include male players.");
  }

  if (
    configuration.category === "womens"
    && players.some((player) => player.gender !== "female")
  ) {
    throw new Error("Women's Tournament configurations may only include female players.");
  }

  return true;
}

// Randomly creates Singles, standard Doubles, or Mixed Doubles team definitions.
export function buildTournamentConfigurationTeams(
  players,
  configuration,
  random = Math.random,
) {
  validateRandom(random);
  validateTournamentConfigurationPlayers(players, configuration);

  if (configuration.matchType === "singles") {
    return shuffle(players, random).map((player, index) => (
      createTeamDefinition(index + 1, [player])
    ));
  }

  if (configuration.category === "mixed") {
    const malePlayers = shuffle(
      players.filter((player) => player.gender === "male"),
      random,
    );
    const femalePlayers = shuffle(
      players.filter((player) => player.gender === "female"),
      random,
    );

    return malePlayers.map((malePlayer, index) => (
      createTeamDefinition(index + 1, [malePlayer, femalePlayers[index]])
    ));
  }

  const shuffledPlayers = shuffle(players, random);
  const teams = [];

  for (let index = 0; index < shuffledPlayers.length; index += 2) {
    teams.push(createTeamDefinition(
      teams.length + 1,
      [shuffledPlayers[index], shuffledPlayers[index + 1]],
    ));
  }

  return teams;
}

// Calculates deterministic group sizes using the required fixed table first.
export function getTournamentGroupSizes(teamCount) {
  if (!Number.isInteger(teamCount) || teamCount < 2) {
    throw new Error("Tournament generation requires at least two teams.");
  }

  const fixedSizes = FIXED_GROUP_SIZES.get(teamCount);
  if (fixedSizes) return [...fixedSizes];

  // The maximum group count with a four-team minimum gives balanced 4-5 groups.
  const groupCount = Math.floor(teamCount / 4);
  const baseSize = Math.floor(teamCount / groupCount);
  const largerGroupCount = teamCount % groupCount;

  return Array.from(
    { length: groupCount },
    (_, index) => baseSize + (index < largerGroupCount ? 1 : 0),
  );
}

// Converts a zero-based group index into A..Z, AA..AZ, BA, and beyond.
export function getTournamentGroupLabel(groupIndex) {
  if (!Number.isInteger(groupIndex) || groupIndex < 0) {
    throw new Error("Tournament group index must be a non-negative integer.");
  }

  let remaining = groupIndex + 1;
  let label = "";

  while (remaining > 0) {
    remaining -= 1;
    label = String.fromCharCode(65 + (remaining % 26)) + label;
    remaining = Math.floor(remaining / 26);
  }

  return label;
}

// Shuffles teams once, then assigns every team to exactly one sized group.
export function assignTournamentTeamsToGroups(teams, random = Math.random) {
  validateRandom(random);

  if (!Array.isArray(teams)) {
    throw new Error("Tournament teams are required for grouping.");
  }

  const teamNumbers = teams.map((team) => Number(team?.teamNumber));
  if (teamNumbers.some((number) => !Number.isInteger(number) || number <= 0)) {
    throw new Error("Every Tournament team requires a valid team number.");
  }

  if (new Set(teamNumbers).size !== teamNumbers.length) {
    throw new Error("Tournament team numbers must be unique.");
  }

  const groupSizes = getTournamentGroupSizes(teams.length);
  const shuffledTeams = shuffle(teams, random);
  const groups = [];
  let teamOffset = 0;

  for (let index = 0; index < groupSizes.length; index += 1) {
    const size = groupSizes[index];
    const label = getTournamentGroupLabel(index);
    groups.push({
      groupNumber: index + 1,
      label,
      name: `Group ${label}`,
      teams: shuffledTeams.slice(teamOffset, teamOffset + size),
    });
    teamOffset += size;
  }

  return groups;
}

// Uses the bounded circle method for one group's unique team-number pairings.
export function generateTournamentGroupRoundRobin(teams) {
  if (!Array.isArray(teams) || teams.length < 2) {
    throw new Error("A Tournament group requires at least two teams.");
  }

  const teamNumbers = teams.map((team) => Number(team?.teamNumber));
  if (teamNumbers.some((number) => !Number.isInteger(number) || number <= 0)) {
    throw new Error("Every Tournament team requires a valid team number.");
  }

  if (new Set(teamNumbers).size !== teamNumbers.length) {
    throw new Error("Tournament team numbers must be unique.");
  }

  const rotation = [...teamNumbers];
  if (rotation.length % 2 !== 0) rotation.push(null);

  const rounds = [];
  const totalRounds = rotation.length - 1;

  for (let roundIndex = 0; roundIndex < totalRounds; roundIndex += 1) {
    const matches = [];

    for (let index = 0; index < rotation.length / 2; index += 1) {
      const teamANumber = rotation[index];
      const teamBNumber = rotation[rotation.length - 1 - index];

      if (teamANumber !== null && teamBNumber !== null) {
        matches.push({
          teamANumber,
          teamBNumber,
          status: "waiting",
        });
      }
    }

    rounds.push({
      roundNumber: roundIndex + 1,
      matches,
    });

    const lastTeam = rotation.pop();
    rotation.splice(1, 0, lastTeam);
  }

  return rounds;
}

// Builds complete in-memory definitions for one revised Tournament configuration.
export function generateTournamentConfiguration(
  players,
  configuration,
  random = Math.random,
) {
  const teams = buildTournamentConfigurationTeams(
    players,
    configuration,
    random,
  );
  const groups = assignTournamentTeamsToGroups(teams, random).map((group) => ({
    ...group,
    rounds: generateTournamentGroupRoundRobin(group.teams),
  }));

  return {
    configuration: {
      division: configuration.division,
      matchType: configuration.matchType,
      category: configuration.category,
      level: configuration.level,
    },
    teams,
    groups,
  };
}
