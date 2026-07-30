# Round Robin Mode - Implementation Steps

## Step 1: Database
- [x] Create `database/roundRobinQueries.js` — DB queries for RR
- [x] Modify `database/init.js` — Add `round_robin_matches` table

## Step 2: Backend (Electron IPC)
- [x] Modify `electron/main.js` — Add IPC handlers for RR
- [x] Modify `electron/preload.cjs` — Add API methods for RR

## Step 3: Frontend
- [x] Create `src/pages/RoundRobin.jsx` — Main RR page component
- [x] Modify `src/components/Sidebar.jsx` — Add "Round Robin" nav item
- [x] Modify `src/App.jsx` — Add RR route

## Step 4: Testing
- [x] Run the app and verify everything works (vite build succeeded)

