import {
  generateRotationMatches,
  normalizeRankPreference,
  playerAllowsCategory,
} from "../../database/rotationLogic.js";

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

export function playerFitsConfiguration(player, matchType, category) {
  return !getPlayerConfigurationReason(player, matchType, category);
}

export function buildRotationPreview({
  players,
  selectedPlayerIds,
  locks,
  matchType,
  category,
}) {
  const selectedIds = new Set(selectedPlayerIds.map(Number));
  const selectedPlayers = players.filter((player) => selectedIds.has(player.id));
  const required = matchType === "doubles" ? 4 : 2;
  const base = {
    selectedPlayers,
    matches: [],
    unmatchedPlayers: [],
    warnings: [],
    canGenerate: false,
    tone: "blocked",
  };

  if (selectedPlayers.length === 0) {
    return { ...base, message: `Select at least ${required} available players to build a ${matchType} match.` };
  }
  if (selectedPlayers.length < required) {
    const remaining = required - selectedPlayers.length;
    return {
      ...base,
      message: `Need ${remaining} more compatible player${remaining === 1 ? "" : "s"} for ${matchType}.`,
    };
  }

  try {
    const result = generateRotationMatches({
      players: selectedPlayers,
      locks,
      matchType,
      category,
      random: () => 0.5,
    });
    const canGenerate = result.matches.length > 0;
    const needsAttention = canGenerate && (
      result.unmatchedPlayers.length > 0 || result.warnings.length > 0
    );
    let message = `${result.matches.length} complete match${result.matches.length === 1 ? "" : "es"} ready to generate.`;
    if (!canGenerate) {
      message = result.unmatchedPlayers[0]?.reason
        || result.warnings[0]
        || "No complete compatible match can be generated from this selection.";
    } else if (result.unmatchedPlayers.length > 0) {
      message += ` ${result.unmatchedPlayers.length} selected player${result.unmatchedPlayers.length === 1 ? "" : "s"} will remain available.`;
    }
    return {
      ...base,
      ...result,
      canGenerate,
      tone: !canGenerate ? "blocked" : needsAttention ? "attention" : "ready",
      message,
    };
  } catch (error) {
    return {
      ...base,
      message: error instanceof Error ? error.message : "This selection cannot generate a match.",
    };
  }
}

export function countRankPreferences(players) {
  return players.reduce((counts, player) => {
    const preference = normalizeRankPreference(player.rankPreference);
    counts[preference] += 1;
    return counts;
  }, { same_rank: 0, adjacent_rank: 0 });
}
