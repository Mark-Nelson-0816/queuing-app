export const LEVEL_VALUES = {
  beginner: 1,
  intermediate: 2,
  upper_intermediate: 3,
  advanced: 4,
};

const VALID_MATCH_TYPES = new Set(["singles", "doubles"]);
const VALID_CATEGORIES = new Set(["no_gender", "mens", "womens", "mixed"]);
const VALID_RANK_PREFERENCES = new Set(["same_rank", "adjacent_rank"]);

// Reads category preferences from either renderer or database field names.
function getCategoryPreferences(player) {
  return {
    mens: Boolean(player.preferMens ?? player.prefer_mens),
    womens: Boolean(player.preferWomens ?? player.prefer_womens),
    mixed: Boolean(player.preferMixed ?? player.prefer_mixed),
    no_gender: Boolean(player.preferNoGender ?? player.prefer_no_gender),
  };
}

// Normalizes stored and user-entered skill level formats.
export function normalizeRotationLevel(level) {
  const normalized = String(level || "")
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");

  if (normalized === "upperintermediate") return "upper_intermediate";
  return normalized;
}

// Converts a normalized skill level into its numeric balance value.
export function getRotationLevelValue(level) {
  return LEVEL_VALUES[normalizeRotationLevel(level)] || 0;
}

// Normalizes gender values used by category checks.
export function normalizeRotationGender(gender) {
  return String(gender || "").trim().toLowerCase();
}

// Returns a supported rank preference with a safe same-rank default.
export function normalizeRankPreference(preference) {
  return VALID_RANK_PREFERENCES.has(preference)
    ? preference
    : "same_rank";
}

// Returns 0 for exact preference, 1 for No Gender fallback, or null if invalid.
export function getCategoryPreferencePriority(player, category) {
  const preferences = getCategoryPreferences(player);
  const hasStoredPreference = Object.values(preferences).some(Boolean);
  const gender = normalizeRotationGender(player.gender);

  if (category === "no_gender") {
    return !hasStoredPreference || preferences.no_gender ? 0 : null;
  }
  if (category === "mens" && gender !== "male") return null;
  if (category === "womens" && gender !== "female") return null;
  if (category === "mixed" && !["male", "female"].includes(gender)) return null;
  if (preferences[category]) return 0;

  // Use compatible No Gender players only when exact candidates are insufficient.
  return preferences.no_gender ? 1 : null;
}

// Checks whether exact or fallback preference allows a match category.
export function playerAllowsCategory(player, category) {
  return getCategoryPreferencePriority(player, category) !== null;
}

// Counts No Gender fillers without changing rank or team balance rules.
function countCategoryFallbacks(players, category) {
  if (category === "no_gender") return 0;
  return players.filter(
    (player) => getCategoryPreferencePriority(player, category) === 1,
  ).length;
}

// Validates match type and category combinations before generation.
function validateConfiguration(matchType, category) {
  if (!VALID_MATCH_TYPES.has(matchType)) {
    throw new Error("Invalid rotation match type.");
  }
  if (!VALID_CATEGORIES.has(category)) {
    throw new Error("Invalid rotation category.");
  }
  if (category === "mixed" && matchType !== "doubles") {
    throw new Error("Mixed category is only available for doubles.");
  }
}

// Returns the first gender or preference problem for a player.
function getCategoryError(player, category) {
  const gender = normalizeRotationGender(player.gender);
  if (category === "mens" && gender !== "male") {
    return "Men's matches may only include male players.";
  }
  if (category === "womens" && gender !== "female") {
    return "Women's matches may only include female players.";
  }
  if (category === "mixed" && !["male", "female"].includes(gender)) {
    return "Mixed doubles may only include male and female players.";
  }
  if (!playerAllowsCategory(player, category)) {
    return `Player does not prefer the ${category.replaceAll("_", " ")} category.`;
  }
  return null;
}

// Converts availability time into a sortable fairness value.
function fairnessTime(player) {
  const parsed = Date.parse(`${player.availableSince || player.createdAt || ""}Z`);
  return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed;
}

// Prioritizes longer waits, fewer matches, then stable player order.
function compareFairness(first, second) {
  return fairnessTime(first) - fairnessTime(second)
    || Number(first.matchCount || 0) - Number(second.matchCount || 0)
    || Number(first.id) - Number(second.id);
}

// Reads prior teammate or opponent counts for one player pair.
function countHistory(player, property, otherPlayerId) {
  const history = player[property] || {};
  return Number(history[otherPlayerId] || history[String(otherPlayerId)] || 0);
}

// Checks whether two singles players satisfy their rank preferences.
function getPairCompatibility(first, second) {
  const firstLevel = getRotationLevelValue(first.level);
  const secondLevel = getRotationLevelValue(second.level);
  if (!firstLevel || !secondLevel) return null;

  const difference = Math.abs(firstLevel - secondLevel);
  if (difference === 0) return { exact: true };
  if (
    difference === 1
    && normalizeRankPreference(first.rankPreference) === "adjacent_rank"
    && normalizeRankPreference(second.rankPreference) === "adjacent_rank"
  ) {
    return { exact: false };
  }
  return null;
}

// Ranks candidate match sets by coverage, fairness, balance, and repeats.
function compareSolutions(first, second) {
  if (!second) return 1;
  return first.matchCount - second.matchCount
    || second.categoryFallbackCount - first.categoryFallbackCount
    || first.exactCount - second.exactCount
    || first.fairnessScore - second.fairnessScore
    || second.balanceTotal - first.balanceTotal
    || second.teammateRepeatTotal - first.teammateRepeatTotal
    || second.opponentRepeatTotal - first.opponentRepeatTotal
    || second.randomScore - first.randomScore;
}

// Creates the base result used by the match-set solver.
function createEmptySolution() {
  return {
    matches: [],
    matchCount: 0,
    categoryFallbackCount: 0,
    exactCount: 0,
    fairnessScore: 0,
    balanceTotal: 0,
    teammateRepeatTotal: 0,
    opponentRepeatTotal: 0,
    randomScore: 0,
  };
}

// Adds one candidate match and its scoring values to a partial solution.
function addCandidateToSolution(candidate, solution) {
  return {
    matches: [candidate.match, ...solution.matches],
    matchCount: solution.matchCount + 1,
    categoryFallbackCount:
      solution.categoryFallbackCount + candidate.categoryFallbackCount,
    exactCount: solution.exactCount + (candidate.exact ? 1 : 0),
    fairnessScore: solution.fairnessScore + candidate.fairnessScore,
    balanceTotal: solution.balanceTotal + candidate.balanceDifference,
    teammateRepeatTotal:
      solution.teammateRepeatTotal + candidate.teammateRepeatCount,
    opponentRepeatTotal:
      solution.opponentRepeatTotal + candidate.opponentRepeatCount,
    randomScore: solution.randomScore + candidate.randomScore,
  };
}

// Explains why a singles player could not receive an opponent.
function singlesUnmatchedReason(player, players) {
  const hasSameLevel = players.some((candidate) => (
    candidate.id !== player.id
    && normalizeRotationLevel(candidate.level) === normalizeRotationLevel(player.level)
  ));
  if (normalizeRankPreference(player.rankPreference) === "same_rank") {
    return hasSameLevel
      ? "Singles requires pairs; no remaining same-rank opponent was available."
      : "No same-rank opponent was available.";
  }
  const hasCompatibleOpponent = players.some((candidate) => (
    candidate.id !== player.id && getPairCompatibility(player, candidate)
  ));
  return hasCompatibleOpponent
    ? "Singles requires pairs; no remaining compatible opponent was available."
    : "No compatible same-rank or adjacent-rank opponent was available.";
}

// Finds the best non-overlapping set of fair, rank-compatible singles matches.
function generateSinglesMatches(
  players,
  random = Math.random,
  category = "no_gender",
) {
  const orderedPlayers = [...players].sort(compareFairness);
  const candidatesByPlayer = new Map(
    orderedPlayers.map((player) => [Number(player.id), []]),
  );

  for (let firstIndex = 0; firstIndex < orderedPlayers.length; firstIndex += 1) {
    for (
      let secondIndex = firstIndex + 1;
      secondIndex < orderedPlayers.length;
      secondIndex += 1
    ) {
      const first = orderedPlayers[firstIndex];
      const second = orderedPlayers[secondIndex];
      const compatibility = getPairCompatibility(first, second);
      if (!compatibility) continue;

      const candidate = {
        mask: (1n << BigInt(firstIndex)) | (1n << BigInt(secondIndex)),
        categoryFallbackCount: countCategoryFallbacks([first, second], category),
        exact: compatibility.exact,
        fairnessScore:
          (orderedPlayers.length - firstIndex)
          + (orderedPlayers.length - secondIndex),
        balanceDifference: Math.abs(
          getRotationLevelValue(first.level) - getRotationLevelValue(second.level),
        ),
        teammateRepeatCount: 0,
        opponentRepeatCount:
          countHistory(first, "opponentCounts", second.id)
          + countHistory(second, "opponentCounts", first.id),
        randomScore: random(),
        match: {
          teamA: [first],
          teamB: [second],
          teamAStrength: getRotationLevelValue(first.level),
          teamBStrength: getRotationLevelValue(second.level),
          balanceDifference: Math.abs(
            getRotationLevelValue(first.level) - getRotationLevelValue(second.level),
          ),
          warnings: compatibility.exact
            ? []
            : ["Adjacent-rank fallback used."],
        },
      };
      candidatesByPlayer.get(Number(first.id)).push(candidate);
      candidatesByPlayer.get(Number(second.id)).push(candidate);
    }
  }

  const fullMask = (1n << BigInt(orderedPlayers.length)) - 1n;
  const memo = new Map();

  // Uses memoized search to choose the best non-overlapping candidates.
  function solve(mask) {
    if (mask === 0n) return createEmptySolution();
    const memoKey = mask.toString();
    if (memo.has(memoKey)) return memo.get(memoKey);

    let firstIndex = 0;
    while ((mask & (1n << BigInt(firstIndex))) === 0n) firstIndex += 1;
    const player = orderedPlayers[firstIndex];
    let best = solve(mask & ~(1n << BigInt(firstIndex)));

    for (const candidate of candidatesByPlayer.get(Number(player.id))) {
      if ((mask & candidate.mask) !== candidate.mask) continue;
      const proposed = addCandidateToSolution(
        candidate,
        solve(mask & ~candidate.mask),
      );
      if (compareSolutions(proposed, best) > 0) best = proposed;
    }

    memo.set(memoKey, best);
    return best;
  }

  const solution = solve(fullMask);
  const matchedIds = new Set(
    solution.matches.flatMap((match) => [
      ...match.teamA.map((player) => Number(player.id)),
      ...match.teamB.map((player) => Number(player.id)),
    ]),
  );

  return {
    matches: solution.matches.sort((first, second) => (
      Math.min(...[...first.teamA, ...first.teamB].map(fairnessTime))
      - Math.min(...[...second.teamA, ...second.teamB].map(fairnessTime))
    )),
    unmatchedPlayers: orderedPlayers
      .filter((player) => !matchedIds.has(Number(player.id)))
      .map((player) => ({
        ...player,
        reason: singlesUnmatchedReason(player, orderedPlayers),
      })),
  };
}

// Normalizes teammate locks for arrangement checks.
function buildLockPairs(locks) {
  return locks.map((lock) => ({
    id: Number(lock.id),
    player1Id: Number(lock.player1Id ?? lock.player_1_id),
    player2Id: Number(lock.player2Id ?? lock.player_2_id),
  }));
}

// Finds the active teammate lock containing a player.
function getLockForPlayer(lockPairs, playerId) {
  return lockPairs.find((lock) => (
    lock.player1Id === Number(playerId) || lock.player2Id === Number(playerId)
  ));
}

// Ensures locked teammates remain together in a doubles arrangement.
function arrangementRespectsLocks(teamA, teamB, lockPairs) {
  const teamAIds = new Set(teamA.map((player) => Number(player.id)));
  const teamBIds = new Set(teamB.map((player) => Number(player.id)));
  return lockPairs.every((lock) => {
    const inA = teamAIds.has(lock.player1Id) || teamAIds.has(lock.player2Id);
    const inB = teamBIds.has(lock.player1Id) || teamBIds.has(lock.player2Id);
    if (!inA && !inB) return true;
    return (
      teamAIds.has(lock.player1Id) && teamAIds.has(lock.player2Id)
    ) || (
      teamBIds.has(lock.player1Id) && teamBIds.has(lock.player2Id)
    );
  });
}

// Checks that a doubles team contains one male and one female player.
function isMixedTeam(team) {
  return team.length === 2
    && team.some((player) => normalizeRotationGender(player.gender) === "male")
    && team.some((player) => normalizeRotationGender(player.gender) === "female");
}

// Validates doubles rank spread while allowing balanced locked teams.
function getDoublesRankCompatibility(teamA, teamB, lockPairs) {
  const players = [...teamA, ...teamB];
  const levelValues = players.map((player) => getRotationLevelValue(player.level));
  if (levelValues.some((value) => !value)) return null;

  const allSame = new Set(levelValues).size === 1;
  if (allSame) return { exact: true, warnings: [] };
  if (players.some((player) => normalizeRankPreference(player.rankPreference) === "same_rank")) {
    return null;
  }

  const playerById = new Map(players.map((player) => [Number(player.id), player]));
  const hasWideLockedTeam = lockPairs.some((lock) => {
    const first = playerById.get(lock.player1Id);
    const second = playerById.get(lock.player2Id);
    return first && second && Math.abs(
      getRotationLevelValue(first.level) - getRotationLevelValue(second.level),
    ) > 1;
  });
  // Allows a wide level gap only when those teammates are explicitly locked.
  const teamWideGapIsExplicitlyLocked = (team) => {
    const teamIds = new Set(team.map((player) => Number(player.id)));
    const teamLevels = team.map((player) => getRotationLevelValue(player.level));
    if (Math.max(...teamLevels) - Math.min(...teamLevels) <= 1) return true;
    return lockPairs.some((lock) => (
      teamIds.has(lock.player1Id) && teamIds.has(lock.player2Id)
    ));
  };
  const teamAStrength = teamA.reduce(
    (total, player) => total + getRotationLevelValue(player.level),
    0,
  );
  const teamBStrength = teamB.reduce(
    (total, player) => total + getRotationLevelValue(player.level),
    0,
  );
  const balanceDifference = Math.abs(teamAStrength - teamBStrength);

  if (hasWideLockedTeam) {
    return teamWideGapIsExplicitlyLocked(teamA)
      && teamWideGapIsExplicitlyLocked(teamB)
      && balanceDifference <= 1
      ? {
        exact: false,
        warnings: ["Different-rank locked team balanced by team strength."],
      }
      : null;
  }

  return Math.max(...levelValues) - Math.min(...levelValues) <= 1
    ? { exact: false, warnings: ["Adjacent-rank fallback used."] }
    : null;
}

// Counts prior matches where two players were teammates.
function teammateRepeatCount(team) {
  const [first, second] = team;
  return countHistory(first, "teammateCounts", second.id)
    + countHistory(second, "teammateCounts", first.id);
}

// Counts prior opponent pairings across both teams.
function opponentRepeatCount(teamA, teamB) {
  let total = 0;
  for (const first of teamA) {
    for (const second of teamB) {
      total += countHistory(first, "opponentCounts", second.id);
      total += countHistory(second, "opponentCounts", first.id);
    }
  }
  return total;
}

// Returns the three unique ways to split four players into two teams.
function getArrangements(group) {
  return [
    [[group[0], group[1]], [group[2], group[3]]],
    [[group[0], group[2]], [group[1], group[3]]],
    [[group[0], group[3]], [group[1], group[2]]],
  ];
}

// Builds every valid four-player doubles arrangement for the solver.
function buildDoublesCandidates(players, category, lockPairs, random) {
  const candidates = [];
  const indexById = new Map(
    players.map((player, index) => [Number(player.id), index]),
  );

  for (let a = 0; a < players.length - 3; a += 1) {
    for (let b = a + 1; b < players.length - 2; b += 1) {
      for (let c = b + 1; c < players.length - 1; c += 1) {
        for (let d = c + 1; d < players.length; d += 1) {
          const group = [players[a], players[b], players[c], players[d]];
          const groupIds = new Set(group.map((player) => Number(player.id)));
          const hasPartialLock = lockPairs.some((lock) => (
            groupIds.has(lock.player1Id) !== groupIds.has(lock.player2Id)
          ));
          if (hasPartialLock) continue;

          for (const [teamA, teamB] of getArrangements(group)) {
            if (category === "mixed" && (!isMixedTeam(teamA) || !isMixedTeam(teamB))) {
              continue;
            }
            if (!arrangementRespectsLocks(teamA, teamB, lockPairs)) continue;

            const rankCompatibility = getDoublesRankCompatibility(
              teamA,
              teamB,
              lockPairs,
            );
            if (!rankCompatibility) continue;

            const teamAStrength = teamA.reduce(
              (total, player) => total + getRotationLevelValue(player.level),
              0,
            );
            const teamBStrength = teamB.reduce(
              (total, player) => total + getRotationLevelValue(player.level),
              0,
            );
            const mask = group.reduce(
              (value, player) => value | (1n << BigInt(indexById.get(Number(player.id)))),
              0n,
            );
            const lockIds = lockPairs
              .filter((lock) => groupIds.has(lock.player1Id))
              .map((lock) => lock.id);

            candidates.push({
              mask,
              categoryFallbackCount: countCategoryFallbacks(group, category),
              exact: rankCompatibility.exact,
              fairnessScore: group.reduce(
                (score, player) => score + (players.length - indexById.get(Number(player.id))),
                0,
              ),
              balanceDifference: Math.abs(teamAStrength - teamBStrength),
              teammateRepeatCount:
                teammateRepeatCount(teamA) + teammateRepeatCount(teamB),
              opponentRepeatCount: opponentRepeatCount(teamA, teamB),
              randomScore: random(),
              match: {
                teamA,
                teamB,
                teamAStrength,
                teamBStrength,
                balanceDifference: Math.abs(teamAStrength - teamBStrength),
                warnings: rankCompatibility.warnings,
                lockIds,
              },
            });
          }
        }
      }
    }
  }
  return candidates;
}

// Explains why a doubles player could not be placed in a complete match.
function doublesUnmatchedReason(player, selectedPlayers, lockPairs, category) {
  const lock = getLockForPlayer(lockPairs, player.id);
  if (lock) {
    const partnerId = lock.player1Id === Number(player.id)
      ? lock.player2Id
      : lock.player1Id;
    if (!selectedPlayers.some((candidate) => Number(candidate.id) === partnerId)) {
      return "Locked teammate is not selected.";
    }
    return "Locked team has no balanced compatible opponent.";
  }
  if (category === "mixed") {
    return "Mixed doubles requires two male and two female compatible players.";
  }
  return "Doubles requires four compatible players per match.";
}

// Finds the best non-overlapping set of balanced doubles matches.
export function generateDoublesMatches(
  players,
  locks = [],
  category = "no_gender",
  random = Math.random,
) {
  const orderedPlayers = [...players].sort(compareFairness);
  const lockPairs = buildLockPairs(locks);
  const candidates = buildDoublesCandidates(
    orderedPlayers,
    category,
    lockPairs,
    random,
  );
  const candidatesByIndex = new Map(
    orderedPlayers.map((_, index) => [index, []]),
  );
  for (const candidate of candidates) {
    for (let index = 0; index < orderedPlayers.length; index += 1) {
      if ((candidate.mask & (1n << BigInt(index))) !== 0n) {
        candidatesByIndex.get(index).push(candidate);
      }
    }
  }

  const memo = new Map();
  // Uses memoized search to choose the best non-overlapping candidates.
  function solve(mask) {
    if (mask === 0n) return createEmptySolution();
    const memoKey = mask.toString();
    if (memo.has(memoKey)) return memo.get(memoKey);

    let firstIndex = 0;
    while ((mask & (1n << BigInt(firstIndex))) === 0n) firstIndex += 1;
    let best = solve(mask & ~(1n << BigInt(firstIndex)));

    for (const candidate of candidatesByIndex.get(firstIndex)) {
      if ((mask & candidate.mask) !== candidate.mask) continue;
      const proposed = addCandidateToSolution(
        candidate,
        solve(mask & ~candidate.mask),
      );
      if (compareSolutions(proposed, best) > 0) best = proposed;
    }

    memo.set(memoKey, best);
    return best;
  }

  const fullMask = (1n << BigInt(orderedPlayers.length)) - 1n;
  const solution = solve(fullMask);
  const matchedIds = new Set(
    solution.matches.flatMap((match) => [
      ...match.teamA.map((player) => Number(player.id)),
      ...match.teamB.map((player) => Number(player.id)),
    ]),
  );

  return {
    matches: solution.matches.sort((first, second) => (
      Math.min(...[...first.teamA, ...first.teamB].map(fairnessTime))
      - Math.min(...[...second.teamA, ...second.teamB].map(fairnessTime))
    )),
    unmatchedPlayers: orderedPlayers
      .filter((player) => !matchedIds.has(Number(player.id)))
      .map((player) => ({
        ...player,
        reason: doublesUnmatchedReason(player, orderedPlayers, lockPairs, category),
      })),
  };
}

// Validates an operator-edited match against size, category, rank, and lock rules.
export function validateRotationArrangement({
  matchType,
  category,
  teamA,
  teamB,
  locks = [],
}) {
  validateConfiguration(matchType, category);
  const expectedTeamSize = matchType === "doubles" ? 2 : 1;
  const players = [...teamA, ...teamB];

  if (teamA.length !== expectedTeamSize || teamB.length !== expectedTeamSize) {
    return {
      valid: false,
      message: `${matchType === "doubles" ? "Doubles" : "Singles"} requires ${expectedTeamSize} player${expectedTeamSize === 1 ? "" : "s"} on each team.`,
    };
  }
  if (new Set(players.map((player) => Number(player.id))).size !== players.length) {
    return { valid: false, message: "A player cannot occupy multiple match slots." };
  }
  for (const player of players) {
    const categoryError = getCategoryError(player, category);
    if (categoryError) return { valid: false, message: categoryError };
  }

  if (matchType === "singles") {
    return getPairCompatibility(teamA[0], teamB[0])
      ? { valid: true, message: "" }
      : { valid: false, message: "The selected singles players have incompatible rank preferences." };
  }
  if (category === "mixed" && (!isMixedTeam(teamA) || !isMixedTeam(teamB))) {
    return { valid: false, message: "Each mixed doubles team requires one male and one female player." };
  }

  const lockPairs = buildLockPairs(locks);
  if (!arrangementRespectsLocks(teamA, teamB, lockPairs)) {
    return { valid: false, message: "Active locked teammates must remain on the same team." };
  }
  const compatibility = getDoublesRankCompatibility(teamA, teamB, lockPairs);
  return compatibility
    ? { valid: true, message: "", warnings: compatibility.warnings }
    : { valid: false, message: "The selected doubles players have incompatible rank preferences or team balance." };
}

// Validates selected players and delegates to singles or doubles generation.
export function generateRotationMatches({
  players,
  matchType = "doubles",
  category = "no_gender",
  locks = [],
  random = Math.random,
}) {
  validateConfiguration(matchType, category);
  if (!Array.isArray(players)) throw new Error("Please select rotation players.");

  const warnings = [];
  const uniquePlayers = [];
  const seenPlayerIds = new Set();
  for (const player of players) {
    const playerId = Number(player?.id);
    if (!Number.isInteger(playerId) || playerId <= 0) {
      throw new Error("One or more selected players are invalid.");
    }
    if (seenPlayerIds.has(playerId)) {
      warnings.push(`${player.name || "A player"} was selected more than once and was only used once.`);
      continue;
    }
    if (!getRotationLevelValue(player.level)) {
      throw new Error(`${player.name || "A selected player"} has an invalid skill level.`);
    }
    const categoryError = getCategoryError(player, category);
    if (categoryError) throw new Error(`${player.name}: ${categoryError}`);
    seenPlayerIds.add(playerId);
    uniquePlayers.push({
      ...player,
      id: playerId,
      gender: normalizeRotationGender(player.gender),
      rankPreference: normalizeRankPreference(player.rankPreference),
    });
  }

  const required = matchType === "doubles" ? 4 : 2;
  if (uniquePlayers.length < required) {
    throw new Error(
      `${matchType === "doubles" ? "Doubles" : "Singles"} requires at least ${required} eligible players.`,
    );
  }

  const result = matchType === "doubles"
    ? generateDoublesMatches(uniquePlayers, locks, category, random)
    : generateSinglesMatches(uniquePlayers, random, category);

  if (result.matches.length === 0) {
    warnings.push("No complete compatible match could be generated.");
  }
  return { ...result, warnings };
}
