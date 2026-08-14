import {
  generateDoublesMatches,
  normalizeRankPreference,
  playerAllowsCategory,
  validateRotationArrangement,
} from "../../database/rotationLogic.js";

// Explains why a player cannot join the current Rotation configuration.
export function getPlayerConfigurationReason(player, matchType, category) {
  if (!player.eligible) return player.reason || `Player is currently ${player.status || "unavailable"}.`;
  if (category === "mixed" && matchType !== "doubles") {
    return "Mixed category is only available for doubles.";
  }
  if (category === "mens" && player.gender !== "male") {
    return "Men's matches only allow male players.";
  }
  if (category === "womens" && player.gender !== "female") {
    return "Women's matches only allow female players.";
  }
  if (category === "mixed" && !["male", "female"].includes(player.gender)) {
    return "Mixed doubles requires a male or female gender value.";
  }
  if (!playerAllowsCategory(player, category)) {
    return "This player did not choose the selected match category.";
  }
  return "";
}

// Checks whether a player fits the current Rotation configuration.
export function playerFitsConfiguration(player, matchType, category) {
  return !getPlayerConfigurationReason(player, matchType, category);
}

// Sorts by today's Rotation count while preserving the existing order for ties.
export function sortPlayersByMatchesToday(players, direction) {
  if (direction === "all") return players;
  const multiplier = direction === "highest" ? -1 : 1;
  return players
    .map((player, index) => ({ player, index }))
    .sort((first, second) => (
      (Number(first.player.matchCount || 0) - Number(second.player.matchCount || 0))
        * multiplier
      || first.index - second.index
    ))
    .map(({ player }) => player);
}

// Returns every eligible player ID from the complete filtered result, not one page.
export function getFilteredEligiblePlayerIds(players, playerReasonById) {
  return players.reduce((ids, player) => {
    if (!playerReasonById.get(player.id)) ids.push(player.id);
    return ids;
  }, []);
}

// Builds a conservative bounded Singles preview without using the global solver.
function buildBoundedSinglesPreview(players, category) {
  const matchedIds = new Set();
  const matches = [];
  for (let firstIndex = 0; firstIndex < players.length; firstIndex += 1) {
    const first = players[firstIndex];
    if (matchedIds.has(first.id)) continue;
    for (let secondIndex = firstIndex + 1; secondIndex < players.length; secondIndex += 1) {
      const second = players[secondIndex];
      if (matchedIds.has(second.id)) continue;
      const validation = validateRotationArrangement({
        matchType: "singles",
        category,
        teamA: [first],
        teamB: [second],
      });
      if (!validation.valid) continue;
      matchedIds.add(first.id);
      matchedIds.add(second.id);
      matches.push({ teamA: [first], teamB: [second] });
      break;
    }
  }
  return {
    matches,
    unmatchedPlayers: players.filter((player) => !matchedIds.has(player.id)),
    warnings: [],
  };
}

// Explains the main compatibility rule blocking a complete preview match.
function getPreviewCompatibilityMessage(players, locks, matchType, category) {
  if (category === "mixed") {
    const maleCount = players.filter((player) => player.gender === "male").length;
    const femaleCount = players.filter((player) => player.gender === "female").length;
    if (maleCount < 2 || femaleCount < 2) {
      return "Mixed Doubles requires two compatible male and two compatible female players.";
    }
  }

  const selectedIds = new Set(players.map((player) => Number(player.id)));
  const incompleteLock = locks.find((lock) => {
    const firstId = Number(lock.player1Id ?? lock.player_1_id);
    const secondId = Number(lock.player2Id ?? lock.player_2_id);
    return selectedIds.has(firstId) !== selectedIds.has(secondId);
  });
  if (incompleteLock) {
    return "Both active locked teammates must be selected before their team can be matched.";
  }
  const selectedLock = locks.find((lock) => {
    const firstId = Number(lock.player1Id ?? lock.player_1_id);
    const secondId = Number(lock.player2Id ?? lock.player_2_id);
    return selectedIds.has(firstId) && selectedIds.has(secondId);
  });
  if (selectedLock) {
    return "The selected locked team has no balanced compatible opponent under the current rules.";
  }

  const hasSameRankPlayer = players.some(
    (player) => normalizeRankPreference(player.rankPreference) === "same_rank",
  );
  if (hasSameRankPlayer) {
    return matchType === "doubles"
      ? "Same Rank Only requires four compatible players of the same level for Doubles."
      : "Same Rank Only requires two compatible players of the same level for Singles.";
  }
  return matchType === "doubles"
    ? "No four-player group satisfies the adjacent-rank, category, lock, and team-balance rules."
    : "Singles requires same-level players or mutually allowed adjacent-rank opponents.";
}

// Evaluates whether all selected players can produce at least one legal match.
function evaluateSelectedPlayers({ selectedPlayers, locks, matchType, category }) {
  const required = matchType === "doubles" ? 4 : 2;
  if (selectedPlayers.length === 0) {
    return {
      canGenerate: false,
      estimatedMatches: 0,
      tone: "blocked",
      message: `Select at least ${required} available players to build a ${matchType} match.`,
    };
  }
  if (selectedPlayers.length < required) {
    const remaining = required - selectedPlayers.length;
    return {
      canGenerate: false,
      estimatedMatches: 0,
      tone: "blocked",
      message: `Need ${remaining} more compatible player${remaining === 1 ? "" : "s"} for ${matchType}.`,
    };
  }

  const invalidPlayer = selectedPlayers.find((player) => (
    getPlayerConfigurationReason(player, matchType, category)
  ));
  if (invalidPlayer) {
    return {
      canGenerate: false,
      estimatedMatches: 0,
      tone: "blocked",
      matches: [],
      unmatchedPlayers: selectedPlayers,
      warnings: [],
      message: `${invalidPlayer.name}: ${getPlayerConfigurationReason(invalidPlayer, matchType, category)}`,
    };
  }

  try {
    const result = matchType === "doubles"
      ? {
        ...generateDoublesMatches(selectedPlayers, locks, category, () => 0.5),
        warnings: [],
      }
      : buildBoundedSinglesPreview(selectedPlayers, category);
    const estimatedMatches = result.matches.length;
    const canGenerate = estimatedMatches > 0;
    const unmatchedCount = result.unmatchedPlayers.length;
    if (!canGenerate) {
      return {
        ...result,
        canGenerate: false,
        estimatedMatches: 0,
        tone: "blocked",
        message: `No complete compatible match can be formed. ${getPreviewCompatibilityMessage(selectedPlayers, locks, matchType, category)}`,
      };
    }
    return {
      ...result,
      canGenerate: true,
      estimatedMatches,
      tone: unmatchedCount > 0 || result.warnings.length > 0 ? "attention" : "ready",
      message: unmatchedCount > 0
        ? `${estimatedMatches} complete compatible match${estimatedMatches === 1 ? "" : "es"} can be generated. ${unmatchedCount} selected player${unmatchedCount === 1 ? "" : "s"} may remain unmatched.`
        : `Selected players can form ${estimatedMatches} complete compatible match${estimatedMatches === 1 ? "" : "es"}. Final compatibility is validated again when Generate Matches is clicked.`,
    };
  } catch (error) {
    return {
      canGenerate: false,
      estimatedMatches: 0,
      tone: "blocked",
      matches: [],
      unmatchedPlayers: selectedPlayers,
      warnings: [],
      message: error instanceof Error ? error.message : "This selection cannot generate a match.",
    };
  }
}

// Checks compatibility-aware readiness without running the exhaustive Singles solver.
export function buildRotationSelectionStatus({
  selectedPlayers,
  locks = [],
  matchType,
  category,
}) {
  return evaluateSelectedPlayers({ selectedPlayers, locks, matchType, category });
}

// Builds the same match preview used by saved Rotation generation.
export function buildRotationPreview({
  players,
  selectedPlayerIds,
  locks,
  matchType,
  category,
}) {
  const selectedIds = new Set(selectedPlayerIds.map(Number));
  const selectedPlayers = players.filter((player) => selectedIds.has(player.id));
  return {
    selectedPlayers,
    ...evaluateSelectedPlayers({ selectedPlayers, locks, matchType, category }),
  };
}

// Groups unmatched players by shared backend explanation for compact notes.
export function groupRotationUnmatchedPlayers(unmatchedPlayers) {
  const groups = new Map();
  for (const player of unmatchedPlayers) {
    const reason = player.reason || "No complete compatible match was available.";
    if (!groups.has(reason)) groups.set(reason, []);
    groups.get(reason).push(player);
  }
  return [...groups].map(([reason, players]) => ({ reason, players }));
}

// Chooses truthful success or warning feedback after generation finishes.
export function getRotationGenerationFeedback(generatedCount, unmatchedCount) {
  const count = Number(generatedCount || 0);
  const unmatched = Number(unmatchedCount || 0);
  if (count === 0) {
    return {
      tone: "warning",
      message: "No compatible complete matches were generated.",
    };
  }
  return {
    tone: "success",
    message: unmatched > 0
      ? `Generated ${count} Rotation match${count === 1 ? "" : "es"}. ${unmatched} selected player${unmatched === 1 ? "" : "s"} remain unmatched.`
      : `Generated ${count} Rotation match${count === 1 ? "" : "es"} and saved ${count === 1 ? "it" : "them"} in queue order.`,
  };
}

// Counts selected same-rank and adjacent-rank preferences.
export function countRankPreferences(players) {
  return players.reduce((counts, player) => {
    const preference = normalizeRankPreference(player.rankPreference);
    counts[preference] += 1;
    return counts;
  }, { same_rank: 0, adjacent_rank: 0 });
}
