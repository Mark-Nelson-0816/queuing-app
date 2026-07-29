const { contextBridge, ipcRenderer } = require("electron");


contextBridge.exposeInMainWorld("api", {

  // Players
  getPlayers: () =>
    ipcRenderer.invoke("get-players"),

  addPlayer: (name) =>
    ipcRenderer.invoke("add-player", name),



  // Courts
  getCourts: () =>
    ipcRenderer.invoke("get-courts"),



  // Queue
  getQueue: () =>
    ipcRenderer.invoke("get-queue"),

  addQueue: (playerId) =>
    ipcRenderer.invoke("add-queue", playerId),

  removeQueue: (id) =>
    ipcRenderer.invoke("remove-queue", id),


});