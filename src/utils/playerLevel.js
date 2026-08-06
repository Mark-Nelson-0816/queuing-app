import { normalizeRotationLevel } from "../../database/rotationLogic.js";

const LEVEL_DETAILS = {
  beginner: {
    label: "Beginner",
    badgeClasses: "bg-yellow-100 text-yellow-800 border-yellow-200",
    textClasses: "text-yellow-700 dark:text-yellow-300",
  },
  intermediate: {
    label: "Intermediate",
    badgeClasses: "bg-green-100 text-green-800 border-green-200",
    textClasses: "text-green-700 dark:text-green-300",
  },
  upper_intermediate: {
    label: "Upper Intermediate",
    badgeClasses: "bg-blue-100 text-blue-800 border-blue-200",
    textClasses: "text-blue-700 dark:text-blue-300",
  },
  advanced: {
    label: "Advanced",
    badgeClasses: "bg-red-100 text-red-800 border-red-200",
    textClasses: "text-red-700 dark:text-red-300",
  },
};

const DEFAULT_DETAILS = {
  label: "Unknown",
  badgeClasses: "bg-slate-100 text-slate-700 border-slate-200",
  textClasses: "text-slate-600 dark:text-slate-300",
};

export function normalizePlayerLevel(level) {
  return normalizeRotationLevel(level);
}

export function getLevelClasses(level) {
  return (LEVEL_DETAILS[normalizePlayerLevel(level)] || DEFAULT_DETAILS)
    .badgeClasses;
}

export function getLevelTextClasses(level) {
  return (LEVEL_DETAILS[normalizePlayerLevel(level)] || DEFAULT_DETAILS)
    .textClasses;
}

export function getLevelLabel(level) {
  return (LEVEL_DETAILS[normalizePlayerLevel(level)] || DEFAULT_DETAILS).label;
}

export function countPlayerLevels(players = []) {
  return players.reduce((counts, player) => {
    const normalizedLevel = normalizePlayerLevel(player?.level);

    if (normalizedLevel in counts) {
      counts[normalizedLevel] += 1;
    }

    return counts;
  }, {
    beginner: 0,
    intermediate: 0,
    upper_intermediate: 0,
    advanced: 0,
  });
}
