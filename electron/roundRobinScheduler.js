
export function generateRoundRobinSchedule(playerIds) {
  if (!Array.isArray(playerIds) || playerIds.length < 2) {
    return [];
  }

  const players = [...playerIds];
  const hasBye = players.length % 2 !== 0;
  if (hasBye) {
    players.push(null); 
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

      
      if (playerA !== null && playerB !== null) {
        matches.push({ player_one_id: playerA, player_two_id: playerB });
      }
    }

    rounds.push({
      round_number: roundIndex + 1,
      matches,
    });

    
    rotating.unshift(rotating.pop());
  }

  return rounds;
}

/**
 * Generate doubles round-robin schedule for a group of players.
 * 
 * Strategy: Partition players into fixed teams of 2 (by FIFO order),
 * then schedule team-vs-team matches using the circle method.
 * 
 * Example with 4 players [1,2,3,4]:
 *   Team A = [1,2], Team B = [3,4]
 *   Round 1: Team A vs Team B
 * 
 * Example with 6 players [1,2,3,4,5,6]:
 *   Team A = [1,2], Team B = [3,4], Team C = [5,6]
 *   Round 1: Team A vs Team C, Team B (bye)
 *   Round 2: Team A vs Team B, Team C (bye)
 *   Round 3: Team B vs Team C, Team A (bye)
 * 
 * @param {number[]} playerIds - Array of player IDs (must be >= 4)
 * @returns {Array} Array of rounds with doubles match objects
 */
export function generateDoublesRoundRobinSchedule(playerIds) {
  if (!Array.isArray(playerIds) || playerIds.length < 4) {
    return [];
  }

  // Ensure even number of players for doubles
  const ids = [...playerIds];
  if (ids.length % 2 !== 0) {
    // Odd number: drop the last player so we have an even count
    ids.pop();
  }

  // Partition players into fixed teams of 2 (FIFO order)
  // Team 1: ids[0], ids[1]; Team 2: ids[2], ids[3]; etc.
  const teams = [];
  for (let i = 0; i < ids.length; i += 2) {
    teams.push([ids[i], ids[i + 1]]);
  }

  // Use team indices (0, 1, 2, ...) with the circle method
  const teamIndices = teams.map((_, idx) => idx);
  const schedule = generateRoundRobinSchedule(teamIndices);

  // Convert team indices back to player IDs
  const rounds = schedule.map(round => ({
    round_number: round.round_number,
    matches: round.matches.map(m => ({
      team_one: teams[m.player_one_id],
      team_two: teams[m.player_two_id],
      player_one_id: teams[m.player_one_id][0],
      player_two_id: teams[m.player_two_id][0]
    }))
  }));

  return rounds;
}
