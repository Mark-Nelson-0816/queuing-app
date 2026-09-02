import Database from "better-sqlite3";
import path from "path";
import { app } from "electron";

// Stores the SQLite database in Electron's per-user application directory.
const dbPath = path.join(
    app.getPath("userData"),
    "badminton.db"
);

const db = new Database(dbPath);

// Enforces relationships and cascade rules declared by the schema.
db.pragma("foreign_keys = ON");
console.log(dbPath);

export default db;
