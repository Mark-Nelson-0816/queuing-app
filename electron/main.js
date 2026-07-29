import { app, BrowserWindow } from "electron";
import path from "path";

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
  });

  const indexPath = path.join(
    app.getAppPath(),
    "dist",
    "index.html"
  );

  win.loadFile(indexPath);
}

app.whenReady().then(() => {
  createWindow();
});