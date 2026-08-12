const { contextBridge, ipcRenderer } = require("electron");


// Exposes a limited Promise-based IPC API to the React renderer.
contextBridge.exposeInMainWorld("api", {

  // Player profile and daily-registration operations.

  addPlayer: (name, level, gender, contact, preferMens, preferWomens, preferMixed, preferNoGender, rankPreference) =>
    ipcRenderer.invoke("add-player", name, level, gender, contact, preferMens, preferWomens, preferMixed, preferNoGender, rankPreference),

  getPlayerManagementData: () =>
    ipcRenderer.invoke("get-player-management-data"),

  registerPlayer: (id) =>
    ipcRenderer.invoke('register-player', id),

  getRegisteredPlayersToday: () =>
    ipcRenderer.invoke("get-registered-players-today"),

  removeRegisteredPlayer: (id) =>
    ipcRenderer.invoke("remove-registered-player", id),

  updatePlayerInfo: (id, name, level, gender, contact, preferMens, preferWomens, preferMixed, preferNoGender, rankPreference) =>
    ipcRenderer.invoke('update-player-info', id, name, level, gender, contact, preferMens, preferWomens, preferMixed, preferNoGender, rankPreference),

  deletePlayerProfile: (id) =>
    ipcRenderer.invoke("delete-players-profile", id),

  // Legacy Tournament calls remain until the current Tournament page is replaced.
  createRoundRobinTournament: (players, matchType, category) =>
    ipcRenderer.invoke('create-round-robin-tournament', players, matchType, category),

  getLatestTournament: () =>
    ipcRenderer.invoke('get-latest-tournament'),

  // Revised Tournament event, configuration, history, and lifecycle operations.
  createTournament: (name, startDate, endDate) =>
    ipcRenderer.invoke("create-tournament", name, startDate, endDate),

  listTournaments: () =>
    ipcRenderer.invoke("list-tournaments"),

  getTournament: (tournamentId) =>
    ipcRenderer.invoke("get-tournament", tournamentId),

  getTournamentHistory: () =>
    ipcRenderer.invoke("get-tournament-history"),

  getTournamentConfigurationData: () =>
    ipcRenderer.invoke("get-tournament-configuration-data"),

  generateTournamentConfiguration: (
    tournamentId,
    playerIds,
    division,
    matchType,
    category,
    level,
  ) => ipcRenderer.invoke(
    "generate-tournament-configuration",
    tournamentId,
    playerIds,
    division,
    matchType,
    category,
    level,
  ),

  resetTournamentConfiguration: (configurationId) =>
    ipcRenderer.invoke("reset-tournament-configuration", configurationId),

  startTournamentMatch: (matchId, courtId) =>
    ipcRenderer.invoke('start-tournament-match', matchId, courtId),

  finishTournamentMatch: (matchId, winnerTeamId) =>
    ipcRenderer.invoke('finish-tournament-match', matchId, winnerTeamId),

  finishTournament: (tournamentId) =>
    ipcRenderer.invoke("finish-tournament", tournamentId),

  // Court state and management operations.
  getCourts: () =>
      ipcRenderer.invoke("get-courts"),

  getAvailableCourts: () =>
      ipcRenderer.invoke("get-available-courts"),

  addCourt: (name) =>
      ipcRenderer.invoke("add-court", name),

  removeCourt: (id) =>
      ipcRenderer.invoke("remove-court", id),



  // Rotation Queue state, generation, and match lifecycle operations.
  getRotationState: () =>
    ipcRenderer.invoke("get-rotation-state"),

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

  // Application data reset operation.
  resetAllData: () => 
    ipcRenderer.invoke("reset-all-data"),

  // Persisted settings and application information operations.
  getSettings: () =>
    ipcRenderer.invoke("get-settings"),
  updateSetting: (key, value) =>
    ipcRenderer.invoke("update-setting", key, value),
  getApplicationInfo: () =>
    ipcRenderer.invoke("get-application-info"),
});
