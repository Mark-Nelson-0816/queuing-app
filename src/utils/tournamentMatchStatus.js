// Builds one lookup of players who are currently in a playing Tournament match.
export function buildPlayingTournamentPlayerMap(configurations = []) {
  const playingPlayerById = new Map();

  for (const configuration of configurations) {
    for (const group of configuration.groups || []) {
      for (const round of group.rounds || []) {
        for (const match of round.matches || []) {
          if (match.status !== "playing") continue;

          for (const team of [match.teamA, match.teamB]) {
            for (const player of team?.players || []) {
              const playerId = Number(player.playerId);
              if (!Number.isInteger(playerId) || playerId <= 0) continue;

              playingPlayerById.set(playerId, {
                playerId,
                matchId: Number(match.id),
                courtId: match.court?.id === undefined
                  ? null
                  : Number(match.court.id),
                courtName: match.court?.name || null,
              });
            }
          }
        }
      }
    }
  }

  return playingPlayerById;
}
