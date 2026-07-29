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

ipcMain.handle("add-player", (event, name) => {

  const playerId = addPlayer(name);

  addPlayerToQueue(playerId);


  return {
    success: true,
    id: playerId
  };

});

app.whenReady().then(() => {
  createWindow();
});