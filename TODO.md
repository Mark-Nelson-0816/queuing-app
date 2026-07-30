# Refactoring: Separate Player Management and Queue Management

## Steps

- [x] Plan approved
- [x] 1. Update `electron/main.js` - Remove auto-queue-add from `add-player`; add `delete-player` and `update-player` IPC handlers
- [x] 2. Update `electron/preload.cjs` - Expose `deletePlayer` and `updatePlayer` APIs
- [x] 3. Update `src/pages/Players.jsx` - Add player creation form with add/delete/update handlers
- [x] 4. Update `src/components/PlayerTable.jsx` - Add edit/delete functionality
- [x] 5. Update `src/components/QueueList.jsx` - Replace name input with player selector
- [x] 6. Update `src/pages/Queue.jsx` - Load registered players, use `addQueue(playerId)`
- [x] 7. Build and verify
