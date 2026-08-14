import path from "node:path";

// Builds a local-date backup filename for the native Save dialog.
export function getDefaultBackupFileName(now = new Date()) {
  const dateLabel = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
  return `badminton-backup-${dateLabel}.db`;
}

// Runs the Save dialog and starts a backup only after the operator chooses a path.
export async function runDatabaseBackupDialog({
  showSaveDialog,
  documentsPath,
  createBackup,
  now = new Date(),
}) {
  const selection = await showSaveDialog({
    title: "Backup Database",
    defaultPath: path.join(documentsPath, getDefaultBackupFileName(now)),
    filters: [{ name: "SQLite Database", extensions: ["db"] }],
  });
  if (selection.canceled || !selection.filePath) {
    return { success: true, data: { cancelled: true } };
  }
  return createBackup(selection.filePath);
}
