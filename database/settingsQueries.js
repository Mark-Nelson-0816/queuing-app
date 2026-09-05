import db from "./database.js";
import path from "path";
import process from "node:process";
import { app } from "electron";

// Returns all settings as a renderer-friendly key-value object.
export function getAllSettings() {
  const rows = db.prepare("SELECT key, value FROM settings").all();
  const settings = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }
  return settings;
}

// Inserts or updates one setting value.
export function setSetting(key, value) {
  if (typeof key !== "string" || key.trim().length === 0) {
    return { success: false, message: "Setting key must be a non-empty string." };
  }
  if (!["string", "number", "boolean"].includes(typeof value)) {
    return { success: false, message: "Setting value must be a string, number, or boolean." };
  }

  db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(key, String(value));

  return { success: true };
}

// Returns application, runtime, platform, and database metadata.
export function getApplicationInfo() {
  const sqliteVersion = db.prepare("SELECT sqlite_version() AS version").get().version;
  const schemaVersion = Number(db.pragma("user_version", { simple: true }) || 0);

  return {
    applicationName: app.getName(),
    version: app.getVersion(),
    electronVersion: process.versions.electron,
    sqliteVersion,
    schemaVersion,
    platform: `${process.platform} (${process.arch})`,
    databaseLocation: path.join(app.getPath("userData"), "badminton.db"),
    developer: "Not configured",
  };
}

