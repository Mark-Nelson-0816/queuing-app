# Settings Page Revamp — Task Tracking

## Steps

- [x] 1. Create `database/settingsQueries.js` (get/set settings helpers using existing `settings` table)
- [x] 2. Wire up IPC handlers in `electron/main.js` (`get-settings`, `update-setting`)
- [x] 3. Expose `getSettings` / `updateSetting` in `electron/preload.cjs`
- [x] 4. Update `src/index.css` — make dark theme class-based (`.dark` / `.light` / system) so theme switching works
- [x] 5. Create `src/pages/Settings.jsx` — full-featured settings page (stats, appearance, preferences, data management, about)
- [x] 6. Update `src/App.jsx` — import new Settings page, apply persisted theme on startup
- [x] 7. Update `src/pages/Queue.jsx` — read default match type from settings
- [x] 8. Update `src/pages/Courts.jsx` — read auto-requeue default from settings
- [x] 9. Verify build with `npm run build` — ✅ Build succeeded (vite 8.1.5, 1801 modules, 2.49s)

