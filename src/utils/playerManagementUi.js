import { comparePlayerLevels } from "./playerLevel.js";

// Compares numeric or text table values without changing their display format.
function compareValues(first, second) {
  if (typeof first === "number" && typeof second === "number") return first - second;
  return String(first || "").localeCompare(String(second || ""));
}

// Filters and sorts permanent profiles before client-side pagination.
export function filterAndSortProfiles(profiles, {
  search = "",
  levelFilter = "all",
  genderFilter = "all",
  rankFilter = "all",
  categoryFilter = "all",
  sort = { field: "name", direction: "asc" },
} = {}) {
  const searchText = search.trim().toLowerCase();
  const filtered = profiles.filter((player) => (
    (!searchText
      || player.name.toLowerCase().includes(searchText)
      || String(player.contactNumber || "").toLowerCase().includes(searchText))
    && (levelFilter === "all" || player.level === levelFilter)
    && (genderFilter === "all" || player.gender === genderFilter)
    && (rankFilter === "all" || player.rankPreference === rankFilter)
    && (categoryFilter === "all"
      || (categoryFilter === "mens" && player.preferMens)
      || (categoryFilter === "womens" && player.preferWomens)
      || (categoryFilter === "mixed" && player.preferMixed)
      || (categoryFilter === "no_gender" && player.preferNoGender))
  ));
  const getValue = (player) => ({
    name: player.name,
    level: player.level,
    gender: player.gender,
    matches: player.lifetimeMatches,
    results: player.lifetimeWins - player.lifetimeLosses,
  })[sort.field];

  return filtered.sort((first, second) => (
    sort.field === "level"
      ? comparePlayerLevels(first.level, second.level, sort.direction)
      : compareValues(getValue(first), getValue(second))
        * (sort.direction === "asc" ? 1 : -1)
  ));
}

// Filters and sorts today's registrations before client-side pagination.
export function filterAndSortTodayPlayers(players, {
  search = "",
  levelFilter = "all",
  genderFilter = "all",
  statusFilter = "all",
  sort = { field: "name", direction: "asc" },
} = {}) {
  const searchText = search.trim().toLowerCase();
  const filtered = players.filter((player) => (
    (!searchText || player.name.toLowerCase().includes(searchText))
    && (levelFilter === "all" || player.level === levelFilter)
    && (genderFilter === "all" || player.gender === genderFilter)
    && (statusFilter === "all" || player.status === statusFilter)
  ));
  const getValue = (player) => ({
    name: player.name,
    level: player.level,
    gender: player.gender,
    status: player.status,
    matches: player.matchesToday,
    results: player.winsToday - player.lossesToday,
  })[sort.field];

  return filtered.sort((first, second) => (
    sort.field === "level"
      ? comparePlayerLevels(first.level, second.level, sort.direction)
      : compareValues(getValue(first), getValue(second))
        * (sort.direction === "asc" ? 1 : -1)
  ));
}

// Returns profiles that can currently be registered and match modal filters.
export function filterRegistrationProfiles(profiles, {
  search = "",
  levelFilter = "all",
  genderFilter = "all",
} = {}) {
  const searchText = search.trim().toLowerCase();
  return profiles.filter((player) => (
    (!player.todayRegistration || player.todayRegistration.isDone)
    && (!searchText || player.name.toLowerCase().includes(searchText))
    && (levelFilter === "all" || player.level === levelFilter)
    && (genderFilter === "all" || player.gender === genderFilter)
  ));
}
