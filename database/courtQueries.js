import db from "./database.js";

export function getCourts() {
  return db.prepare(`
    SELECT *
    FROM courts
    ORDER BY id ASC
  `).all();
}