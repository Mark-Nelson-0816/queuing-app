/**
 * Round Robin Scheduler — Circle Method
 *
 * Generates a proper round-robin schedule directly for a list of player IDs,
 * instead of generating all matches first and grouping them afterward.
 *
 * Guarantees, for the given list of playerIds:
 *   - Every player appears at most once per round (no double-booking).
 *   - No duplicate matchups.
 *   - Every player eventually plays every other player exactly once.
 *   - N players -> (N - 1) rounds if N is even, N rounds if N is odd (one bye per round).
 *   - N players -> floor(N / 2) matches per round.
 */
export function generateRoundRobinSchedule(playerIds) {
  if (!Array.isArray(playerIds) || playerIds.length < 2) {
    return [];
  }

  const players = [...playerIds];
  const hasBye = players.length % 2 !== 0;
  if (hasBye) {
    players.push(null); // null = "bye" placeholder so the pairing math stays even
  }

  const n = players.length;
  const totalRounds = n - 1;
  const fixed = players[0];
  let rotating = players.slice(1);

  const rounds = [];

  for (let roundIndex = 0; roundIndex < totalRounds; roundIndex++) {
    const roundPlayers = [fixed, ...rotating];
    const matches = [];

    for (let i = 0; i < n / 2; i++) {
      const playerA = roundPlayers[i];
      const playerB = roundPlayers[n - 1 - i];

      // Skip the pairing that includes the bye placeholder
      if (playerA !== null && playerB !== null) {
        matches.push({ player_one_id: playerA, player_two_id: playerB });
      }
    }

    rounds.push({
      round_number: roundIndex + 1,
      matches,
    });

    // Rotate every player except the fixed one (classic circle method)
    rotating.unshift(rotating.pop());
  }

  return rounds;
}