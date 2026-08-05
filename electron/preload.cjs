const { contextBridge, ipcRenderer } = require("electron");


contextBridge.exposeInMainWorld("api", {

  // Players

  searchPlayers: (name) =>
    ipcRenderer.invoke("search-players", name),

  addPlayer: (name, level, gender, contact, preferMens, preferWomens, preferMixed, preferNoGender) =>
    ipcRenderer.invoke("add-player", name, level, gender, contact, preferMens, preferWomens, preferMixed, preferNoGender),

  registerPlayer: (id) => 
    ipcRenderer.invoke('register-player', id),

  getRegisteredPlayersToday: () =>
    ipcRenderer.invoke("get-registered-players-today"),

  getRegisteredPlayersTodayLevelCount: () =>
    ipcRenderer.invoke("get-registered-players-today-level-count"),

  removeRegisteredPlayer: (id) =>
    ipcRenderer.invoke("remove-registered-player", id),

  getPlayersProfile: (name) => 
    ipcRenderer.invoke("get-players-profile", name),

  updatePlayerInfo: (id, name, level, gender, contact, preferMens, preferWomens, preferMixed, preferNoGender) => 
    ipcRenderer.invoke('update-player-info', id, name, level, gender, contact, preferMens, preferWomens, preferMixed, preferNoGender),

  deletePlayerProfile: (id) => 
    ipcRenderer.invoke("delete-players-profile", id),

  getPlayerCards: () => 
    ipcRenderer.invoke("get-player-cards"),




  //old player function - not used in player management page (not sure if used in other pages)
  getPlayers: () =>
    ipcRenderer.invoke("get-players"),

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
  previewNextMatch: (matchType) =>
    ipcRenderer.invoke("preview-next-match", matchType),
  createMatch: (matchType) =>
    ipcRenderer.invoke("create-match", matchType),
  endMatch:(courtId, requeue)=>
    ipcRenderer.invoke(
      "end-match",
      courtId,
      requeue
    ),

  // Round Robin
  getRRPlayers: () =>
    ipcRenderer.invoke("get-rr-players"),
  generateRRMatches: (playerIds, matchType) =>
    ipcRenderer.invoke("generate-rr-matches", playerIds, matchType),
  getRRMatches: () =>
    ipcRenderer.invoke("get-rr-matches"),
  assignRRMatch: (matchId, courtId) =>
    ipcRenderer.invoke("assign-rr-match", matchId, courtId),
  endRRMatch: (matchId, courtId, requeue) =>
    ipcRenderer.invoke("end-rr-match", matchId, courtId, requeue),

  //datas
  resetAllData: () => 
    ipcRenderer.invoke("reset-all-data"),

  // Settings
  getSettings: () =>
    ipcRenderer.invoke("get-settings"),
  getSetting: (key) =>
    ipcRenderer.invoke("get-setting", key),
  updateSetting: (key, value) =>
    ipcRenderer.invoke("update-setting", key, value),
});
