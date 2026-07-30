const { contextBridge, ipcRenderer } = require("electron");


contextBridge.exposeInMainWorld("api", {

  // Players
  getPlayers: () =>
    ipcRenderer.invoke("get-players"),

addPlayer: (name, level) =>
    ipcRenderer.invoke("add-player", name, level),

  deletePlayer: (id) =>
    ipcRenderer.invoke("delete-player", id),

  updatePlayer: (id, name, level) =>
    ipcRenderer.invoke("update-player", id, name, level),



  // Courts
  getCourts: () =>
      ipcRenderer.invoke("get-courts"),

  addCourt: (name) =>
      ipcRenderer.invoke("add-court", name),

  removeCourt: (id) =>
      ipcRenderer.invoke("remove-court", id),



  // Queue
  getQueue: () =>
    ipcRenderer.invoke("get-queue"),

  addQueue: (playerId) =>
    ipcRenderer.invoke("add-queue", playerId),

  removeQueue: (id) =>
    ipcRenderer.invoke("remove-queue", id),

  //matches
  createMatch: () =>
    ipcRenderer.invoke("create-match"),
  endMatch:(courtId)=>
    ipcRenderer.invoke(
      "end-match",
      courtId
    ),

  // Round Robin
  getRRPlayers: () =>
    ipcRenderer.invoke("get-rr-players"),
  generateRRMatches: (playerIds) =>
    ipcRenderer.invoke("generate-rr-matches", playerIds),
  getRRMatches: () =>
    ipcRenderer.invoke("get-rr-matches"),
  assignRRMatch: (matchId, courtId) =>
    ipcRenderer.invoke("assign-rr-match", matchId, courtId),
  endRRMatch: (matchId, courtId) =>
    ipcRenderer.invoke("end-rr-match", matchId, courtId),

  //datas
  resetAllData: () => 
    ipcRenderer.invoke("reset-all-data"),
});
