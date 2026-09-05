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

  assert.deepEqual(settings.getAllSettings(), {});
  assert.equal(settings.setSetting("theme", "dark").success, true);
  assert.equal(settings.setSetting("defaultMatchType", "singles").success, true);
  assert.equal(settings.getAllSettings().theme, "dark");
  assert.deepEqual(settings.getAllSettings(), {
    theme: "dark",
    defaultMatchType: "singles",
  });

  // Generic string keys remain supported, while malformed keys and values fail safely.
  assert.equal(settings.setSetting("customFutureSetting", 3).success, true);
  assert.equal(settings.getAllSettings().customFutureSetting, "3");
  for (const [key, value] of [
    [null, "value"],
    [undefined, "value"],
    ["", "value"],
    ["   ", "value"],
    ["invalidNullValue", null],
    ["invalidObjectValue", { enabled: true }],
  ]) {
    assert.equal(settings.setSetting(key, value).success, false);
  }
  assert.equal(settings.getAllSettings().invalidNullValue, undefined);
  assert.equal(settings.getAllSettings().invalidObjectValue, undefined);
  assert.equal(settings.getAllSettings().theme, "dark");

  // Repeated writes update one row and retain the latest value.
  for (const value of ["light", "dark", "system", "light"]) {
    assert.equal(settings.setSetting("theme", value).success, true);
  }
  assert.equal(settings.getAllSettings().theme, "light");
  assert.equal(db.prepare("SELECT COUNT(*) FROM settings WHERE key = 'theme'").pluck().get(), 1);

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
