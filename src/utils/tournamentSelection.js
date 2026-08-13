import { normalizePlayerLevel } from "./playerLevel.js";

// Keeps permanent profiles matching one Tournament configuration's level and gender.
export function getEligibleTournamentProfiles(players, level, category) {
  return players.filter((player) => {
    if (normalizePlayerLevel(player.level) !== level) return false;
    const gender = String(player.gender || "").toLowerCase();
    if (category === "mens") return gender === "male";
    if (category === "womens") return gender === "female";
    return gender === "male" || gender === "female";
  });
}

// Builds selected lookup, rows, and Mixed gender counts in one player-list pass.
export function getTournamentSelectionDetails(selectedIds, eligiblePlayers) {
  const selectedIdSet = new Set(selectedIds.map(Number));
  const selectedPlayers = [];
  const genderCounts = { male: 0, female: 0 };

  for (const player of eligiblePlayers) {
    if (!selectedIdSet.has(Number(player.id))) continue;
    selectedPlayers.push(player);
    const gender = String(player.gender || "").toLowerCase();
    if (gender === "male") genderCounts.male += 1;
    if (gender === "female") genderCounts.female += 1;
  }

  return { selectedIdSet, selectedPlayers, genderCounts };
}

// Returns the lightweight readiness message shown before backend validation.
export function validateTournamentSelection(
  selectedIds,
  profileById,
  matchType,
  category,
) {
  const count = selectedIds.length;
  if (matchType === "singles") {
    if (count < 2) {
      const missing = 2 - count;
      return {
        ready: false,
        message: `${count} players selected. Singles requires at least 2 players. Add ${missing} more ${missing === 1 ? "player" : "players"}.`,
      };
    }
    return { ready: true, message: "Ready to generate." };
  }

  if (count < 4) {
    const missing = 4 - count;
    return {
      ready: false,
      message: `${count} players selected. Doubles requires at least 4 players. Add ${missing} more ${missing === 1 ? "player" : "players"}.`,
    };
  }

  if (category === "mixed") {
    const genderCounts = selectedIds.reduce((counts, playerId) => {
      const gender = String(profileById.get(Number(playerId))?.gender || "").toLowerCase();
      if (gender === "male") counts.male += 1;
      if (gender === "female") counts.female += 1;
      return counts;
    }, { male: 0, female: 0 });

    if (genderCounts.male !== genderCounts.female) {
      const missingGender = genderCounts.male > genderCounts.female ? "female" : "male";
      const missing = Math.abs(genderCounts.male - genderCounts.female);
      return {
        ready: false,
        message: `Mixed Doubles requires equal male and female players. Add ${missing} ${missingGender} ${missing === 1 ? "player" : "players"}.`,
      };
    }
  } else if (count % 2 !== 0) {
    return {
      ready: false,
      message: `${count} players selected. Doubles requires an even number of players. Add 1 more player.`,
    };
  }

  return { ready: true, message: "Ready to generate." };
}
