// Validates one UI score without making the renderer authoritative for results.
function parseScore(value, teamLabel) {
  if (value === null || value === undefined || String(value).trim() === "") {
    return { valid: false, message: `${teamLabel} score is required.` };
  }
  const text = String(value).trim();
  if (!/^\d+$/.test(text)) {
    return {
      valid: false,
      message: `${teamLabel} score must be a non-negative whole integer.`,
    };
  }
  const score = Number(text);
  if (!Number.isSafeInteger(score) || score < 0) {
    return {
      valid: false,
      message: `${teamLabel} score must be a non-negative whole integer.`,
    };
  }
  return { valid: true, score };
}

// Provides immediate score feedback before the backend repeats validation.
export function validateTournamentScoreInput(teamAValue, teamBValue) {
  const teamA = parseScore(teamAValue, "Team A");
  if (!teamA.valid) return teamA;
  const teamB = parseScore(teamBValue, "Team B");
  if (!teamB.valid) return teamB;
  if (teamA.score === teamB.score) {
    return { valid: false, message: "Tournament match scores cannot be equal." };
  }
  return {
    valid: true,
    message: "Ready to review result.",
    teamAScore: teamA.score,
    teamBScore: teamB.score,
    winnerSide: teamA.score > teamB.score ? "A" : "B",
  };
}
