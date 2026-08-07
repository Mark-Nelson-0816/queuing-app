const ELIGIBLE_STATUSES = new Set(["available", "waiting"]);

export function isTournamentCategoryEligible(player, category) {
  const gender = String(player?.gender || "").trim().toLowerCase();
  if (category === "mens") return gender === "male";
  if (category === "womens") return gender === "female";
  return true;
}

export function isTournamentPlayerEligible(player, category) {
  const status = String(player?.status || "").trim().toLowerCase();
  return ELIGIBLE_STATUSES.has(status)
    && isTournamentCategoryEligible(player, category);
}
