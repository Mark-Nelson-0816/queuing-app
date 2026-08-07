import { getCategoryPreferencePriority } from "../../database/rotationLogic.js";

const ELIGIBLE_STATUSES = new Set(["available", "waiting"]);

// Checks whether a player's gender fits the Tournament category.
export function isTournamentCategoryEligible(player, category) {
  const gender = String(player?.gender || "").trim().toLowerCase();
  if (category === "mens") return gender === "male";
  if (category === "womens") return gender === "female";
  return true;
}

// Ranks exact Tournament preferences before No Gender fallback.
export function getTournamentPreferencePriority(player, category) {
  // Preserve the Tournament's existing open No Gender selection behavior.
  if (category === "no_gender") return 0;
  return getCategoryPreferencePriority(player, category);
}

// Checks status, gender, and preference eligibility for Tournament selection.
export function isTournamentPlayerEligible(player, category) {
  const status = String(player?.status || "").trim().toLowerCase();
  return ELIGIBLE_STATUSES.has(status)
    && isTournamentCategoryEligible(player, category)
    && getTournamentPreferencePriority(player, category) !== null;
}
