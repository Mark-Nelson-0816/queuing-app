import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { app } from "electron";

const testUserData = mkdtempSync(path.join(os.tmpdir(), "badminton-settings-test-"));
app.setPath("userData", testUserData);

let db;

try {
  await import("../database/init.js");
  db = (await import("../database/database.js")).default;
  const settings = await import("../database/settingsQueries.js");

  assert.equal(settings.setSetting("theme", "dark").success, true);
  assert.equal(settings.setSetting("defaultMatchType", "singles").success, true);
  assert.equal(settings.getAllSettings().theme, "dark");
  assert.deepEqual(settings.getAllSettings(), {
    theme: "dark",
    defaultMatchType: "singles",
  });

  const info = settings.getApplicationInfo();
  assert.equal(typeof info.applicationName, "string");
  assert.equal(typeof info.version, "string");
  assert.equal(typeof info.electronVersion, "string");
  assert.match(info.sqliteVersion, /^\d+\.\d+\.\d+/);
  assert.equal(Number.isInteger(info.schemaVersion), true);
  assert.equal(info.databaseLocation, path.join(testUserData, "badminton.db"));
  assert.match(info.platform, /\(.+\)$/);

  console.log("Settings integration checks passed.");
} catch (error) {
  console.error(error);
  if (db?.open) db.close();
  rmSync(testUserData, { recursive: true, force: true });
  app.exit(1);
}

if (db?.open) db.close();
rmSync(testUserData, { recursive: true, force: true });
app.quit();
