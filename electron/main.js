import { app, BrowserWindow, Menu } from "electron";
import { globalShortcut } from "electron";
import path from "path";
import { fileURLToPath } from "url";

import "../database/init.js";

import { ipcMain } from "electron";
//players
import { registerPlayer, getRegisteredPlayersToday, removeRegisteredPlayer, updatePlayerInfo, deletePlayerProfile, getPlayerManagementData, } from "../database/playerQueries.js";

//tournament
import {
  createTournamentEvent,
  deleteTournamentEvent,
  finishTournamentEvent,
  finishTournamentMatch,
  generateTournamentEventConfiguration,
  getTournamentConfigurationData,
  getTournamentEvent,
  getTournamentEventHistory,
  listTournamentEvents,
  resetTournamentEventConfiguration,
  startTournamentMatch,
} from "../database/tournamentQueries.js";

import { getAvailableCourts, getCourts } from "../database/courtQueries.js";
import { addPlayer } from "../database/playerQueries.js";
import {
  addCourt,
  removeCourt
} from "../database/courtQueries.js";
import {
  cancelWaitingMatch,
  createTeamLock,
  finishRotationMatch,
  generateAndSaveRotationMatches,
  getRotationNextUpMatches,
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
import { getApplicationInfo, getAllSettings, setSetting } from "../database/settingsQueries.js";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;

// Creates the main desktop window and loads the packaged or development UI.
function createWindow() {

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    fullscreenable: true,

    icon: path.join(__dirname, "../public/icon.ico"),

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

// Player IPC handlers connect renderer requests to player database operations.

// Creates a new player profile.
ipcMain.handle("add-player", (event, name, level, gender, contact, preferMens, preferWomens, preferMixed, preferNoGender, rankPreference) => (
  addPlayer(name, level, gender, contact, preferMens, preferWomens, preferMixed, preferNoGender, rankPreference)
));

// Returns profiles, today's players, and Player Management summary counts.
ipcMain.handle("get-player-management-data", () => getPlayerManagementData());

// Registers or reactivates a player for today.
ipcMain.handle('register-player', (event, id) =>{

  return registerPlayer(id);

});

// Returns active player registrations for today.
ipcMain.handle('get-registered-players-today', () => {
  return getRegisteredPlayersToday();
});

// Marks a registered player as done for today.
ipcMain.handle('remove-registered-player', (event, id) => {
  return removeRegisteredPlayer(id);
});

// Updates a complete player profile.
ipcMain.handle("update-player-info", (event, id, name, level, gender, contact, preferMens, preferWomens, preferMixed, preferNoGender, rankPreference) => {
  return updatePlayerInfo(id, name, level, gender, contact, preferMens, preferWomens, preferMixed, preferNoGender, rankPreference);
});

// Deletes a profile only when it has no protected history.
ipcMain.handle("delete-players-profile", (event, id) => {
  return deletePlayerProfile(id);

});

// Creates a revised draft Tournament event with inclusive event dates.
ipcMain.handle("create-tournament", (event, name, startDate, endDate) => (
  createTournamentEvent(name, startDate, endDate)
));

// Lists revised Tournament events in operator-friendly status/date order.
ipcMain.handle("list-tournaments", () => listTournamentEvents());

// Loads one revised Tournament with configurations, groups, and match results.
ipcMain.handle("get-tournament", (event, tournamentId) => (
  getTournamentEvent(tournamentId)
));

// Lists finished revised Tournament events for history navigation.
ipcMain.handle("get-tournament-history", () => getTournamentEventHistory());

// Permanently deletes one revised Tournament event and its owned data.
ipcMain.handle("delete-tournament", (event, tournamentId) => (
  deleteTournamentEvent(tournamentId)
));

// Returns permanent profiles and legal revised configuration options.
ipcMain.handle("get-tournament-configuration-data", () => (
  getTournamentConfigurationData()
));

// Atomically generates one exact revised Tournament configuration.
ipcMain.handle(
  "generate-tournament-configuration",
  (
    event,
    tournamentId,
    playerIds,
    division,
    matchType,
    category,
    level,
  ) => generateTournamentEventConfiguration(
    tournamentId,
    playerIds,
    division,
    matchType,
    category,
    level,
  ),
);

// Deletes one editable revised configuration without reversing lifetime stats.
ipcMain.handle("reset-tournament-configuration", (event, configurationId) => (
  resetTournamentEventConfiguration(configurationId)
));

// Starts either model by explicitly inspecting the match's configuration link.
ipcMain.handle('start-tournament-match', (event, matchId, courtId) => {
  return startTournamentMatch(matchId, courtId);
});

// Finishes either model by explicitly inspecting the match's configuration link.
ipcMain.handle('finish-tournament-match', (event, matchId, winnerTeamId) => {
  return finishTournamentMatch(matchId, winnerTeamId);
});

// Manually finishes a revised Tournament after every generated match is finished.
ipcMain.handle("finish-tournament", (event, tournamentId) => (
  finishTournamentEvent(tournamentId)
));

// Court IPC handlers expose court state and management actions.
// Returns every court with any active match attached.
ipcMain.handle("get-courts", () => {
  const courts = getCourts();

  return courts;
});

// Returns courts that have no active match.
ipcMain.handle("get-available-courts", () => {
  return getAvailableCourts();
});

// Adds a court by name.
ipcMain.handle("add-court", (event, name)=>{

    return addCourt(name);

});


// Removes a court when no protected active match uses it.
ipcMain.handle("remove-court", (event, id)=>{

    return removeCourt(id);

});

// Rotation Queue IPC handlers expose queue state and operator actions.
// Returns players, locks, matches, and queue summary in one response.
ipcMain.handle("get-rotation-state", () => getRotationState());

// Creates a teammate lock for the selected category.
ipcMain.handle(
  "create-team-lock",
  (event, firstPlayerId, secondPlayerId, matchType, category) => (
    createTeamLock(firstPlayerId, secondPlayerId, matchType, category)
  ),
);

// Removes an active teammate lock.
ipcMain.handle("remove-team-lock", (event, lockId) => removeTeamLock(lockId));

// Updates a player's same-rank or adjacent-rank preference.
ipcMain.handle(
  "update-rotation-rank-preference",
  (event, playerId, preference) => (
    updateRotationRankPreference(playerId, preference)
  ),
);

// Generates and stores waiting Rotation Queue matches.
ipcMain.handle(
  "generate-rotation-matches",
  (event, playerIds, matchType, category) => (
    generateAndSaveRotationMatches(playerIds, matchType, category)
  ),
);

// Returns all saved Rotation Queue matches.
ipcMain.handle("get-rotation-matches", () => getRotationMatches());

// Returns valid waiting matches in public-display queue order.
ipcMain.handle("get-rotation-next-up-matches", () => (
  getRotationNextUpMatches()
));

// Replaces the players and teams in a waiting match.
ipcMain.handle(
  "update-waiting-match",
  (event, matchId, teamAIds, teamBIds) => (
    updateWaitingMatch(matchId, teamAIds, teamBIds)
  ),
);

// Rebalances the teams in a complete waiting match.
ipcMain.handle("rebalance-waiting-match", (event, matchId) => (
  rebalanceWaitingMatch(matchId)
));

// Moves a waiting match up or down in queue order.
ipcMain.handle("reorder-waiting-match", (event, matchId, direction) => (
  reorderWaitingMatch(matchId, direction)
));

// Cancels a waiting match and releases its players.
ipcMain.handle("cancel-waiting-match", (event, matchId) => (
  cancelWaitingMatch(matchId)
));

// Starts a waiting Rotation Queue match on a court.
ipcMain.handle("start-rotation-match", (event, matchId, courtId) => (
  startRotationMatch(matchId, courtId)
));

// Finishes a Rotation Queue match and updates player statistics.
ipcMain.handle(
  "finish-rotation-match",
  (event, matchId, winnerTeam, donePlayerIds) => (
    finishRotationMatch(matchId, winnerTeam, donePlayerIds)
  ),
);

// Starts Electron after initialization and registers the fullscreen shortcut.
app.whenReady().then(() => {
  Menu.setApplicationMenu(null);

  globalShortcut.register("F11", () => {
    const isFullScreen = mainWindow.isFullScreen();
    mainWindow.setFullScreen(!isFullScreen);
  });


  createWindow();
});

// Resets application data and restores default courts.
ipcMain.handle("reset-all-data", () => {
    return resetAllData();
});

// Settings IPC handlers read and update persisted application preferences.
// Returns all saved settings.
ipcMain.handle("get-settings", () => {
  return getAllSettings();
});

// Saves one setting value.
ipcMain.handle("update-setting", (event, key, value) => {
  return setSetting(key, value);
});

// Returns runtime, platform, and database information.
ipcMain.handle("get-application-info", () => getApplicationInfo());
