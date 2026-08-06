import { app, BrowserWindow, Menu } from "electron";
import { globalShortcut } from "electron";
import path from "path";
import { fileURLToPath } from "url";

import "../database/init.js";

import { ipcMain } from "electron";
//players
import { getPlayers, searchPlayers, registerPlayer, getRegisteredPlayersToday, getRegisteredPlayersTodayLevelCount, removeRegisteredPlayer, getPlayersProfile, updatePlayerInfo, deletePlayerProfile, getPlayerCards, getPlayerManagementData, } from "../database/playerQueries.js";

//tournament
import {
  createRoundRobinTournament,
  finishTournament,
  finishTournamentMatch,
  getLatestTournament,
  getTournamentById,
  getTournamentMatches,
  getTournamentStandings,
  startTournamentMatch,
} from "../database/tournamentQueries.js";

import { getAvailableCourts, getCourts } from "../database/courtQueries.js";
import { addPlayer, deletePlayer, updatePlayer } from "../database/playerQueries.js";
import {
  addCourt,
  removeCourt
} from "../database/courtQueries.js";
import {
  cancelWaitingMatch,
  createTeamLock,
  finishRotationMatch,
  generateAndSaveRotationMatches,
  getActiveTeamLocks,
  getEligibleRotationPlayers,
  getRotationMatches,
  getRotationState,
  rebalanceWaitingMatch,
  removeTeamLock,
  reorderWaitingMatch,
  startRotationMatch,
  updateRotationRankPreference,
  updateWaitingMatch,
} from "../database/rotationQueries.js";

import { resetAllData } from "../database/resetQueries.js";
import { getSetting, getAllSettings, setSetting } from "../database/settingsQueries.js";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;

console.log("Preload path:", path.join(__dirname, "preload.cjs"));
function createWindow() {

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    fullscreenable: true,

    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
    },
  });

  mainWindow.maximize();
  
  if (app.isPackaged) {
    const indexPath = path.join(
      app.getAppPath(),
      "dist",
      "index.html"
    );

    mainWindow.loadFile(indexPath);
  } else {
    mainWindow.loadURL("http://localhost:5173");
  }
}

//players

ipcMain.handle("add-player", (event, name, level, gender, contact, preferMens, preferWomens, preferMixed, preferNoGender, rankPreference) => (
  addPlayer(name, level, gender, contact, preferMens, preferWomens, preferMixed, preferNoGender, rankPreference)
));

ipcMain.handle("get-player-management-data", () => getPlayerManagementData());

ipcMain.handle('search-players', (event, name) =>{
  const players = searchPlayers(name);

  return players;
});

ipcMain.handle('register-player', (event, id) =>{

  return registerPlayer(id);

});

ipcMain.handle('get-players-profile', (event, name) => {
  return getPlayersProfile(name);
});

ipcMain.handle('get-registered-players-today', () => {
  return getRegisteredPlayersToday();
});

ipcMain.handle('get-registered-players-today-level-count', () => {
  return getRegisteredPlayersTodayLevelCount();
});

ipcMain.handle('remove-registered-player', (event, id) => {
  return removeRegisteredPlayer(id);
});

ipcMain.handle("update-player-info", (event, id, name, level, gender, contact, preferMens, preferWomens, preferMixed, preferNoGender, rankPreference) => {
  return updatePlayerInfo(id, name, level, gender, contact, preferMens, preferWomens, preferMixed, preferNoGender, rankPreference);
});

ipcMain.handle("delete-players-profile", (event, id) => {
  return deletePlayerProfile(id);

});

ipcMain.handle("get-player-cards", () => {
  return getPlayerCards();
});

//old player function - not used in player management page (not sure if used in other pages)
ipcMain.handle("get-players", () => {
  const players = getPlayers();

  return players;
});

ipcMain.handle("delete-player", (event, id) => {
  return deletePlayer(id);
});

ipcMain.handle("update-player", (event, id, name, level) => {
  return updatePlayer(id, name, level);
});

//tournament
ipcMain.handle('create-round-robin-tournament', (event, selectedPlayers, matchType, category) => {
  return createRoundRobinTournament(selectedPlayers, matchType, category);
});

ipcMain.handle('get-tournament', (event, tournamentId) => {
  return getTournamentById(tournamentId);
});

ipcMain.handle('get-latest-tournament', () => {
  return getLatestTournament();
});

ipcMain.handle('get-tournament-matches', (event, tournamentId) => {
  return getTournamentMatches(tournamentId);
});

ipcMain.handle('get-tournament-standings', (event, tournamentId) => {
  return getTournamentStandings(tournamentId);
});

ipcMain.handle('start-tournament-match', (event, matchId, courtId) => {
  return startTournamentMatch(matchId, courtId);
});

ipcMain.handle('finish-tournament-match', (event, matchId, winnerTeamId) => {
  return finishTournamentMatch(matchId, winnerTeamId);
});

ipcMain.handle('finish-tournament', (event, tournamentId) => {
  return finishTournament(tournamentId);
});



//courts
ipcMain.handle("get-courts", () => {
  const courts = getCourts();

  return courts;
});

ipcMain.handle("get-available-courts", () => {
  return getAvailableCourts();
});

ipcMain.handle("add-court", (event, name)=>{

    return addCourt(name);

});


ipcMain.handle("remove-court", (event, id)=>{

    return removeCourt(id);

});

//rotation queue
ipcMain.handle("get-rotation-state", () => getRotationState());

ipcMain.handle("get-eligible-rotation-players", () => (
  getEligibleRotationPlayers()
));

ipcMain.handle("get-active-team-locks", () => getActiveTeamLocks());

ipcMain.handle(
  "create-team-lock",
  (event, firstPlayerId, secondPlayerId, matchType, category) => (
    createTeamLock(firstPlayerId, secondPlayerId, matchType, category)
  ),
);

ipcMain.handle("remove-team-lock", (event, lockId) => removeTeamLock(lockId));

ipcMain.handle(
  "update-rotation-rank-preference",
  (event, playerId, preference) => (
    updateRotationRankPreference(playerId, preference)
  ),
);

ipcMain.handle(
  "generate-rotation-matches",
  (event, playerIds, matchType, category) => (
    generateAndSaveRotationMatches(playerIds, matchType, category)
  ),
);

ipcMain.handle("get-rotation-matches", () => getRotationMatches());

ipcMain.handle(
  "update-waiting-match",
  (event, matchId, teamAIds, teamBIds) => (
    updateWaitingMatch(matchId, teamAIds, teamBIds)
  ),
);

ipcMain.handle("rebalance-waiting-match", (event, matchId) => (
  rebalanceWaitingMatch(matchId)
));

ipcMain.handle("reorder-waiting-match", (event, matchId, direction) => (
  reorderWaitingMatch(matchId, direction)
));

ipcMain.handle("cancel-waiting-match", (event, matchId) => (
  cancelWaitingMatch(matchId)
));

ipcMain.handle("start-rotation-match", (event, matchId, courtId) => (
  startRotationMatch(matchId, courtId)
));

ipcMain.handle(
  "finish-rotation-match",
  (event, matchId, winnerTeam, donePlayerIds) => (
    finishRotationMatch(matchId, winnerTeam, donePlayerIds)
  ),
);

// Round Robin

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);

  globalShortcut.register("F11", () => {
    const isFullScreen = mainWindow.isFullScreen();
    mainWindow.setFullScreen(!isFullScreen);
  });


  createWindow();
});

//datas
ipcMain.handle("reset-all-data", () => {
    return resetAllData();
});

// Settings
ipcMain.handle("get-settings", () => {
  return getAllSettings();
});

ipcMain.handle("update-setting", (event, key, value) => {
  return setSetting(key, value);
});

ipcMain.handle("get-setting", (event, key) => {
  return getSetting(key);
});
