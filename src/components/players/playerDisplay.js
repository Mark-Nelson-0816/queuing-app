// Lists the match categories selected on a player profile.
export function formatPlayerPreferences(player) {
  return [
    player.preferMens && "Men's",
    player.preferWomens && "Women's",
    player.preferMixed && "Mixed",
    player.preferNoGender && "No Gender",
  ].filter(Boolean);
}

// Converts a stored rank preference into a readable label.
export function rankPreferenceLabel(preference) {
  return preference === "adjacent_rank"
    ? "Adjacent Rank Allowed"
    : "Same Rank Only";
}

// Formats a stored gender value for display.
export function genderLabel(gender) {
  if (!gender) return "Unknown";
  return gender.charAt(0).toUpperCase() + gender.slice(1).toLowerCase();
}
