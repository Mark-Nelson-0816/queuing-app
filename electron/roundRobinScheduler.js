
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