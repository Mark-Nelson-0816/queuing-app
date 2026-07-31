# Doubles (2v2) Support - Implementation Plan

## Steps

### Phase 1: Database Schema & Migration
- [x] 1. Update `database/init.js` — Add `match_players` table + migration for existing data
- [x] 2. Update `database/resetQueries.js` — Clear match_players on reset
- [x] 3. Update `database/playerQueries.js` — Cascade delete match_players entries

### Phase 2: Backend Queries
- [x] 4. Update `database/courtQueries.js` — Use match_players for player JOINs
- [x] 5. Update `database/matchQueries.js` — createMatch() supports singles/doubles
- [x] 6. Update `database/matchQueries.js` — endMatch() frees 2 or 4 players
- [x] 7. Update `electron/roundRobinScheduler.js` — Add doubles scheduling algorithm
- [x] 8. Update `database/roundRobinQueries.js` — Doubles RR generation support

### Phase 3: IPC Layer
- [x] 9. Update `electron/main.js` — Pass matchType through IPC handlers
- [x] 10. Update `electron/preload.cjs` — Expose matchType params in API

### Phase 4: Frontend UI
- [x] 11. Update `src/pages/Queue.jsx` — Add Singles/Doubles toggle
- [x] 12. Update `src/pages/RoundRobin.jsx` — Add Singles/Doubles toggle + team render
- [x] 13. Update `src/components/CourtCard.jsx` — Team vs team rendering
- [x] 14. Update `src/components/PublicDisplay.jsx` — Team vs team rendering

### Phase 5: Build & Verify
- [x] 15. `npm run build` — ✅ Build succeeded

