import { app, BrowserWindow } from "electron";
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
import { addPlayer } from "../database/playerQueries.js";
import { addPlayerToQueue } from "../database/queueQueries.js";
import { createMatch } from "../database/matchQueries.js";
import {
  addCourt,
  removeCourt
} from "../database/courtQueries.js";
import {
  endMatch
} from "../database/matchQueries.js";


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("Preload path:", path.join(__dirname, "preload.cjs"));
function createWindow() {

  const win = new BrowserWindow({
    width: 1200,
    height: 800,

    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
    },
  });


  const indexPath = path.join(
    app.getAppPath(),
    "dist",
    "index.html"
  );

  win.loadFile(indexPath);
}

//players
ipcMain.handle("get-players", () => {
  const players = getPlayers();

  console.log("Players from DB:", players);

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

  console.log("Queue:", queue);

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

  addPlayerToQueue(playerId);


  return {
    success: true,
    id: playerId
  };

});

//matches
ipcMain.handle("create-match", () => {

  const match = createMatch();

  if (!match.success) {
    return match;
  }

  return {
    success: true,
    match
  };

});

ipcMain.handle("end-match", (event, courtId)=>{

  endMatch(courtId);

  return {
    success:true
  };

});

app.whenReady().then(() => {
  createWindow();
});