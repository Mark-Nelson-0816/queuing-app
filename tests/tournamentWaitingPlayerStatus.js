import assert from "node:assert/strict";
import { buildPlayingTournamentPlayerMap } from "../src/utils/tournamentMatchStatus.js";

function team(id, players) {
  return {
    id,
    players: players.map(([playerId, name], index) => ({
      participantId: id * 10 + index,
      playerId,
      name,
    })),
  };
}

function configurationWithMatches(matches) {
  return [{
    id: 1,
    groups: [{ id: 1, rounds: [{ id: 1, matches }] }],
  }];
}

const waitingOnly = configurationWithMatches([{
  id: 1,
  status: "waiting",
  teamA: team(1, [[1, "Aaron"]]),
  teamB: team(2, [[2, "Ben"]]),
  court: null,
}]);
assert.equal(buildPlayingTournamentPlayerMap(waitingOnly).size, 0);

const activeSinglesAndDoubles = configurationWithMatches([
  {
    id: 2,
    status: "playing",
    teamA: team(3, [[1, "Aaron"]]),
    teamB: team(4, [[2, "Ben"]]),
    court: { id: 7, name: "Court 7" },
  },
  {
    id: 3,
    status: "playing",
    teamA: team(5, [[3, "Carlo"], [4, "Daniel"]]),
    teamB: team(6, [[5, "Ethan"], [6, "Finn"]]),
    court: { id: 8, name: "Court 8" },
  },
  {
    id: 4,
    status: "waiting",
    teamA: team(7, [[1, "Aaron"], [3, "Carlo"]]),
    teamB: team(8, [[7, "Gabe"], [8, "Henry"]]),
    court: null,
  },
]);
const playing = buildPlayingTournamentPlayerMap(activeSinglesAndDoubles);
assert.deepEqual([...playing.keys()].sort((a, b) => a - b), [1, 2, 3, 4, 5, 6]);
assert.deepEqual(playing.get(1), {
  playerId: 1,
  matchId: 2,
  courtId: 7,
  courtName: "Court 7",
});
assert.equal(playing.has(7), false);

const afterFinish = structuredClone(activeSinglesAndDoubles);
afterFinish[0].groups[0].rounds[0].matches[0].status = "finished";
afterFinish[0].groups[0].rounds[0].matches[1].status = "finished";
assert.equal(buildPlayingTournamentPlayerMap(afterFinish).size, 0);

console.log("Tournament waiting-player Playing status checks passed.");
