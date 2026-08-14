import path from "node:path";
import db from "./database.js";

// Converts maintenance errors into the shared renderer result shape.
function failure(error, fallbackMessage) {
  return {
    success: false,
    message: error instanceof Error && error.message
      ? error.message
      : fallbackMessage,
  };
}

// Creates a consistent SQLite backup at the main-process-selected destination.
export async function backupDatabase(destinationPath) {
  try {
    if (path.resolve(destinationPath) === path.resolve(db.name)) {
      throw new Error("Choose a different location from the live application database.");
    }
    await db.backup(destinationPath);
    return {
      success: true,
      data: {
        cancelled: false,
        fileName: path.basename(destinationPath),
      },
    };
  } catch (error) {
    return failure(error, "Failed to back up the database.");
  }
}

// Removes finished or cancelled Rotation matches older than the current seven-day window.
export function clearOldRotationHistory() {
  try {
    const transaction = db.transaction(() => {
      const cutoffDate = db.prepare(`
        SELECT DATE('now', 'localtime', '-6 days') AS cutoff_date
      `).get().cutoff_date;
      const result = db.prepare(`
        DELETE FROM rotation_matches
        WHERE status IN ('finished', 'cancelled')
          AND DATE(COALESCE(end_time, updated_at, created_at), 'localtime') < ?
      `).run(cutoffDate);

      return {
        deletedMatches: result.changes,
        cutoffDate,
        retainedDays: 7,
      };
    });

    return { success: true, data: transaction() };
  } catch (error) {
    return failure(error, "Failed to clear old Rotation history.");
  }
}
