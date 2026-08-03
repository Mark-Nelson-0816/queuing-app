import { app, BrowserWindow, Menu } from "electron";
import { globalShortcut } from "electron";
import path from "path";
import { fileURLToPath } from "url";

import "../database/init.js";

import { ipcMain } from "electron";
import { getPlayers } from "../database/playerQueries.js";
import { searchPlayers } from "../database/playerQueries.js";
import { registerPlayer } from "../database/playerQueries.js";
import { getRegisteredPlayersToday } from "../database/playerQueries.js";
import { removeRegisteredPlayer } from "../database/playerQueries.js";
import { getPlayersProfile } from "../database/playerQueries.js";
import { updatePlayerInfo } from "../database/playerQueries.js";
import { deletePlayerProfile } from "../database/playerQueries.js";
import { getPlayerCards } from "../database/playerQueries.js";

import { getCourts } from "../database/courtQueries.js";
import { 
  getQueue,
  addToQueue,
  removeFromQueue
} from "../database/queueQueries.js";
import { addPlayer, deletePlayer, updatePlayer } from "../database/playerQueries.js";
import { createMatch, previewNextMatch } from "../database/matchQueries.js";
import {
  addCourt,
  removeCourt
} from "../database/courtQueries.js";
import {
  endMatch
} from "../database/matchQueries.js";
import {
  getAllPlayers,
  generateRoundRobinMatches,
  saveRoundRobinMatches,
  getRoundRobinMatches,
  assignMatchToCourt,
  endRoundRobinMatch
} from "../database/roundRobinQueries.js";
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
   mainWindow.webContents.openDevTools();
  const indexPath = path.join(
    app.getAppPath(),
    "dist",
    "index.html"
  );

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

ipcMain.handle("add-player", (event, name, level, contact, preferMens, preferWomens, preferMixed, preferNoGender) => {

  const playerId = addPlayer(name, level, contact, preferMens, preferWomens, preferMixed, preferNoGender);

  if(playerId.message && playerId.message === 'Player already exists.'){
    return {message: playerId.message};
  }

  return {
    success: true,
    id: playerId
  };

});

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

ipcMain.handle('get-registered-players-today', (event) => {
  return getRegisteredPlayersToday();
});

ipcMain.handle('remove-registered-player', (event, id) => {
  return removeRegisteredPlayer(id);
});

ipcMain.handle("update-player-info", (event, id, name, level, contact, preferMens, preferWomens, preferMixed, preferNoGender) => {
  return updatePlayerInfo(id, name, level, contact, preferMens, preferWomens, preferMixed, preferNoGender);
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

//courts
ipcMain.handle("get-courts", () => {
  const courts = getCourts();

  return courts;
});

ipcMain.handle("add-court", (event, name)=>{

    return addCourt(name);

});


ipcMain.handle("remove-court", (event, id)=>{

    return removeCourt(id);

});

//queue
ipcMain.handle("get-queue", () => {

  const queue = getQueue();

  return queue;

});


ipcMain.handle("add-queue", (event, playerId) => {

  return addToQueue(playerId);

});


ipcMain.handle("remove-queue", (event, id) => {

  return removeFromQueue(id);

});

//matches
ipcMain.handle("preview-next-match", (event, matchType) => {
  return previewNextMatch(matchType || 'singles');
});

ipcMain.handle("create-match", (event, matchType) => {

  const match = createMatch(matchType || 'singles');

  if (!match.success) {
    return match;
  }

  return {
    success: true,
    match
  };

});

ipcMain.handle("end-match", (event, courtId, requeue)=>{

  endMatch(courtId, requeue);

  return {
    success:true
  };

});

// Round Robin
ipcMain.handle("get-rr-players", () => {
  return getAllPlayers();
});

ipcMain.handle("generate-rr-matches", (event, playerIds, matchType) => {
  const matches = generateRoundRobinMatches(playerIds, matchType || 'singles');
  saveRoundRobinMatches(matches);
  return { success: true };
});

ipcMain.handle("get-rr-matches", () => {
  return getRoundRobinMatches();
});

ipcMain.handle("assign-rr-match", (event, matchId, courtId) => {
  return assignMatchToCourt(matchId, courtId);
});

ipcMain.handle("end-rr-match", (event, matchId, courtId, requeue) => {
  return endRoundRobinMatch(matchId, courtId, requeue);
});

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
