export function formatPlayerPreferences(player) {
  return [
    player.preferMens && "Men's",
    player.preferWomens && "Women's",
    player.preferMixed && "Mixed",
    player.preferNoGender && "No Gender",
  ].filter(Boolean);
}

export function rankPreferenceLabel(preference) {
  return preference === "adjacent_rank"
    ? "Adjacent Rank Allowed"
    : "Same Rank Only";
}

export function genderLabel(gender) {
  if (!gender) return "Unknown";
  return gender.charAt(0).toUpperCase() + gender.slice(1).toLowerCase();
}
