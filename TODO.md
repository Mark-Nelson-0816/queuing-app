# TODO: End Match Fix + Requeue Feature

## Steps

- [x] 1. Analyze codebase and plan
- [x] 2. Modify `database/matchQueries.js` - update `endMatch()` to handle both match types and requeue parameter
- [x] 3. Modify `database/roundRobinQueries.js` - update `endRoundRobinMatch()` to accept requeue parameter
- [x] 4. Modify `electron/main.js` - update IPC handlers to pass requeue
- [x] 5. Modify `electron/preload.cjs` - update API to pass requeue
- [x] 6. Modify `src/components/CourtCard.jsx` - add requeue checkbox
- [x] 7. Modify `src/pages/Courts.jsx` - pass requeue to API
- [x] 8. Modify `src/pages/RoundRobin.jsx` - pass requeue to API
- [x] 9. Verify build - ✅ Build succeeded

