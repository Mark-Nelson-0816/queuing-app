const { contextBridge, ipcRenderer } = require("electron");


contextBridge.exposeInMainWorld("api", {

  // Players

  searchPlayers: (name) =>
    ipcRenderer.invoke("search-players", name),

  addPlayer: (name, level, gender, contact, preferMens, preferWomens, preferMixed, preferNoGender, rankPreference) =>
    ipcRenderer.invoke("add-player", name, level, gender, contact, preferMens, preferWomens, preferMixed, preferNoGender, rankPreference),

  getPlayerManagementData: () =>
    ipcRenderer.invoke("get-player-management-data"),

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

  updatePlayerInfo: (id, name, level, gender, contact, preferMens, preferWomens, preferMixed, preferNoGender, rankPreference) =>
    ipcRenderer.invoke('update-player-info', id, name, level, gender, contact, preferMens, preferWomens, preferMixed, preferNoGender, rankPreference),

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


  //tournament
  createRoundRobinTournament: (players, matchType, category) =>
    ipcRenderer.invoke('create-round-robin-tournament', players, matchType, category),

  getTournament: (tournamentId) =>
    ipcRenderer.invoke('get-tournament', tournamentId),

  getLatestTournament: () =>
    ipcRenderer.invoke('get-latest-tournament'),

  getTournamentMatches: (tournamentId) =>
    ipcRenderer.invoke('get-tournament-matches', tournamentId),

  getTournamentStandings: (tournamentId) =>
    ipcRenderer.invoke('get-tournament-standings', tournamentId),

  startTournamentMatch: (matchId, courtId) =>
    ipcRenderer.invoke('start-tournament-match', matchId, courtId),

  finishTournamentMatch: (matchId, winnerTeamId) =>
    ipcRenderer.invoke('finish-tournament-match', matchId, winnerTeamId),

  finishTournament: (tournamentId) =>
    ipcRenderer.invoke('finish-tournament', tournamentId),



  // Courts
  getCourts: () =>
      ipcRenderer.invoke("get-courts"),

  getAvailableCourts: () =>
      ipcRenderer.invoke("get-available-courts"),

  addCourt: (name) =>
      ipcRenderer.invoke("add-court", name),

  removeCourt: (id) =>
      ipcRenderer.invoke("remove-court", id),



  // Rotation Queue
  getRotationState: () =>
    ipcRenderer.invoke("get-rotation-state"),

  getEligibleRotationPlayers: () =>
    ipcRenderer.invoke("get-eligible-rotation-players"),

  getActiveTeamLocks: () =>
    ipcRenderer.invoke("get-active-team-locks"),

  createTeamLock: (firstPlayerId, secondPlayerId, matchType, category) =>
    ipcRenderer.invoke(
      "create-team-lock",
      firstPlayerId,
      secondPlayerId,
      matchType,
      category,
    ),

  removeTeamLock: (lockId) =>
    ipcRenderer.invoke("remove-team-lock", lockId),

  updateRotationRankPreference: (playerId, preference) =>
    ipcRenderer.invoke(
      "update-rotation-rank-preference",
      playerId,
      preference,
    ),

  generateRotationMatches: (playerIds, matchType, category) =>
    ipcRenderer.invoke(
      "generate-rotation-matches",
      playerIds,
      matchType,
      category,
    ),

  getRotationMatches: () =>
    ipcRenderer.invoke("get-rotation-matches"),

  getRotationNextUpMatches: () =>
    ipcRenderer.invoke("get-rotation-next-up-matches"),

  updateWaitingMatch: (matchId, teamAIds, teamBIds) =>
    ipcRenderer.invoke(
      "update-waiting-match",
      matchId,
      teamAIds,
      teamBIds,
    ),

  rebalanceWaitingMatch: (matchId) =>
    ipcRenderer.invoke("rebalance-waiting-match", matchId),

  reorderWaitingMatch: (matchId, direction) =>
    ipcRenderer.invoke("reorder-waiting-match", matchId, direction),

  cancelWaitingMatch: (matchId) =>
    ipcRenderer.invoke("cancel-waiting-match", matchId),

  startRotationMatch: (matchId, courtId) =>
    ipcRenderer.invoke("start-rotation-match", matchId, courtId),

  finishRotationMatch: (matchId, winnerTeam, donePlayerIds) =>
    ipcRenderer.invoke(
      "finish-rotation-match",
      matchId,
      winnerTeam,
      donePlayerIds,
    ),

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
  getApplicationInfo: () =>
    ipcRenderer.invoke("get-application-info"),
});
