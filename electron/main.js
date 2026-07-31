import { app, BrowserWindow, Menu } from "electron";
import { globalShortcut } from "electron";
import path from "path";
import { fileURLToPath } from "url";

import "../database/init.js";

import { ipcMain } from "electron";
import { getPlayers } from "../database/playerQueries.js";
import { getCourts } from "../database/courtQueries.js";
import { 
  getQueue,
  addToQueue,
  removeFromQueue
} from "../database/queueQueries.js";
import { addPlayer, deletePlayer, updatePlayer } from "../database/playerQueries.js";
import { createMatch } from "../database/matchQueries.js";
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

  const indexPath = path.join(
    app.getAppPath(),
    "dist",
    "index.html"
  );

  mainWindow.loadFile(indexPath);
}

//players
ipcMain.handle("get-players", () => {
  const players = getPlayers();

  return players;
});

//courts
ipcMain.handle("get-courts", () => {
  const courts = getCourts();

  console.log("Courts from DB:", courts);

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

ipcMain.handle("add-player", (event, name, level) => {

  const playerId = addPlayer(name, level);

  return {
    success: true,
    id: playerId
  };

});

ipcMain.handle("delete-player", (event, id) => {
  return deletePlayer(id);
});

ipcMain.handle("update-player", (event, id, name, level) => {
  return updatePlayer(id, name, level);
});

//matches
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