import { playerAllowsCategory } from "./rotationLogic.js";

const VALID_MATCH_TYPES = new Set(["singles", "doubles"]);
const VALID_CATEGORIES = new Set(["no_gender", "mens", "womens", "mixed"]);

// Returns a shuffled copy without changing the original player list.
function shuffle(items, random = Math.random) {
  const shuffled = [...items];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [
      shuffled[randomIndex],
      shuffled[index],
    ];
  }

  return shuffled;
}

// Validates participant count, gender, category, and match-type rules.
export function validateTournamentPlayers(
  players,
  matchType = "doubles",
  category = "no_gender",
) {
  if (!VALID_MATCH_TYPES.has(matchType)) {
    throw new Error("Invalid tournament match type.");
  }

  if (!VALID_CATEGORIES.has(category)) {
    throw new Error("Invalid tournament category.");
  }

  if (category === "mixed" && matchType !== "doubles") {
    throw new Error("Mixed category is only available for doubles.");
  }

  if (!Array.isArray(players)) {
    throw new Error("Please select tournament players.");
  }

  const playerIds = players.map((player) => Number(player?.id));
  if (playerIds.some((id) => !Number.isInteger(id) || id <= 0)) {
    throw new Error("One or more selected players are invalid.");
  }

  if (new Set(playerIds).size !== playerIds.length) {
    throw new Error("A player can only be selected once.");
  }

  if (matchType === "singles" && players.length < 2) {
    throw new Error("Please select at least two players.");
  }

  if (matchType === "doubles" && players.length < 4) {
    throw new Error("Doubles requires at least four players.");
  }

  if (category === "mens" && players.some((player) => player.gender !== "male")) {
    throw new Error("Men's tournaments may only include male players.");
  }

  if (category === "womens" && players.some((player) => player.gender !== "female")) {
    throw new Error("Women's tournaments may only include female players.");
  }

  if (
    category !== "no_gender"
    && players.some((player) => !playerAllowsCategory(player, category))
  ) {
    throw new Error("One or more players do not prefer this tournament category.");
  }

  if (matchType === "doubles" && players.length % 2 !== 0) {
    throw new Error("Doubles requires an even number of players.");
  }

  if (category === "mixed") {
    const maleCount = players.filter((player) => player.gender === "male").length;
    const femaleCount = players.filter((player) => player.gender === "female").length;

    if (maleCount + femaleCount !== players.length) {
      throw new Error("Mixed doubles may only include male and female players.");
    }

    if (maleCount !== femaleCount) {
      throw new Error("Mixed doubles requires equal numbers of male and female players.");
    }
  }

  return true;
}

// Shuffles valid players into singles or doubles tournament teams.
export function buildTournamentTeams(
  players,
  matchType = "doubles",
  category = "no_gender",
  random = Math.random,
) {
  validateTournamentPlayers(players, matchType, category);

  if (matchType === "singles") {
    return shuffle(players, random).map((player, index) => ({
      teamNumber: index + 1,
      player1Id: Number(player.id),
      player2Id: null,
    }));
  }

  if (category === "mixed") {
    const malePlayers = shuffle(
      players.filter((player) => player.gender === "male"),
      random,
    );
    const femalePlayers = shuffle(
      players.filter((player) => player.gender === "female"),
      random,
    );

    return malePlayers.map((malePlayer, index) => ({
      teamNumber: index + 1,
      player1Id: Number(malePlayer.id),
      player2Id: Number(femalePlayers[index].id),
    }));
  }

  const shuffledPlayers = shuffle(players, random);
  const teams = [];

  for (let index = 0; index < shuffledPlayers.length; index += 2) {
    teams.push({
      teamNumber: teams.length + 1,
      player1Id: Number(shuffledPlayers[index].id),
      player2Id: Number(shuffledPlayers[index + 1].id),
    });
  }

  return teams;
}

// Uses the circle method so every team plays every other team once.
export function generateRoundRobinSchedule(teams) {
  if (!Array.isArray(teams) || teams.length < 2) {
    throw new Error("A round-robin tournament requires at least two teams.");
  }

  const teamIds = teams.map((team) => Number(team?.id));
  if (teamIds.some((id) => !Number.isInteger(id) || id <= 0)) {
    throw new Error("All tournament teams must have valid database IDs.");
  }

  if (new Set(teamIds).size !== teamIds.length) {
    throw new Error("Tournament team IDs must be unique.");
  }

  // A null participant gives each real team one bye when the count is odd.
  const rotation = [...teamIds];
  if (rotation.length % 2 !== 0) {
    rotation.push(null);
  }

  const participantCount = rotation.length;
  const totalRounds = participantCount - 1;
  const rounds = [];

  for (let roundIndex = 0; roundIndex < totalRounds; roundIndex += 1) {
    const matches = [];

    for (let index = 0; index < participantCount / 2; index += 1) {
      const teamAId = rotation[index];
      const teamBId = rotation[participantCount - 1 - index];

      if (teamAId !== null && teamBId !== null) {
        matches.push({ teamAId, teamBId });
      }
    }

    rounds.push({
      roundNumber: roundIndex + 1,
      matches,
    });

    const lastTeam = rotation.pop();
    rotation.splice(1, 0, lastTeam);
  }

  return rounds;
}

// Calculates played, wins, and losses directly from finished matches.
export function calculateTournamentStandings(teams, matches) {
  const standingsByTeam = new Map(
    teams.map((team) => [
      Number(team.id),
      {
        teamId: Number(team.id),
        teamNumber: Number(team.teamNumber),
        team,
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
      },
    ]),
  );

  for (const match of matches) {
    if (match.status !== "finished") continue;

    const teamA = standingsByTeam.get(Number(match.teamAId));
    const teamB = standingsByTeam.get(Number(match.teamBId));
    const winnerTeamId = Number(match.winnerTeamId);

    if (!teamA || !teamB) continue;

    teamA.matchesPlayed += 1;
    teamB.matchesPlayed += 1;

    if (winnerTeamId === teamA.teamId) {
      teamA.wins += 1;
      teamB.losses += 1;
    } else if (winnerTeamId === teamB.teamId) {
      teamB.wins += 1;
      teamA.losses += 1;
    }
  }

  return [...standingsByTeam.values()].sort((first, second) => (
    second.wins - first.wins
    || first.losses - second.losses
    || first.teamNumber - second.teamNumber
  ));
}

// Returns a unique champion or an explicit first-place tie.
export function getTournamentOutcome(standings, tournamentStatus) {
  if (tournamentStatus !== "finished" || standings.length === 0) {
    return null;
  }

  const highestWinCount = standings[0].wins;
  const firstPlaceTeams = standings.filter(
    (standing) => standing.wins === highestWinCount,
  );

  if (firstPlaceTeams.length === 1) {
    return {
      type: "champion",
      wins: highestWinCount,
      team: firstPlaceTeams[0].team,
    };
  }

  return {
    type: "tie",
    wins: highestWinCount,
    teams: firstPlaceTeams.map((standing) => standing.team),
  };
}
