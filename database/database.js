console.log("DATABASE FILE LOADED");

import Database from "better-sqlite3";
import path from "path";
import { app } from "electron";

const dbPath = path.join(
    app.getPath("userData"),
    "badminton.db"
);

console.log("Database location:", dbPath);

const db = new Database(dbPath);

export default db;