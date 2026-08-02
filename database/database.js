import Database from "better-sqlite3";
import path from "path";
import { app } from "electron";

const dbPath = path.join(
    app.getPath("userData"),
    "badminton.db"
);

const db = new Database(dbPath);

// Enable foreign key enforcement
db.pragma("foreign_keys = ON");

export default db;