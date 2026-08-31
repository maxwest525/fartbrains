const { app, BrowserWindow, globalShortcut, shell, Tray, Menu, nativeImage } = require("electron");
const path = require("path");
const fs = require("fs");

/**
 * Fart Brains desktop shell.
 *
 * Loads the published web app when online so auth/backend keep working, and
 * falls back to the bundled offline build. The window is small, frameless-ish
 * and pinned always-on-top so it can live on the corner of the desktop.
 */
const APP_URL = process.env.FARTBRAIN_URL || "https://fartbrain.app";
const LOCAL_INDEX = path.join(__dirname, "..", "dist", "index.html");

let win = null;
let tray = null;

const createWindow = () => {
  win = new BrowserWindow({
    width: 460,
    height: 900,
    minWidth: 360,
    minHeight: 480,
    show: false,
    alwaysOnTop: true,
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    backgroundColor: "#1a1530",
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Float above full-screen apps and other always-on-top windows.
  win.setAlwaysOnTop(true, "floating");
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });

  win.loadURL(APP_URL).catch(() => {
    if (fs.existsSync(LOCAL_INDEX)) win.loadFile(LOCAL_INDEX);
  });

  win.webContents.on("did-fail-load", () => {
    if (fs.existsSync(LOCAL_INDEX)) win.loadFile(LOCAL_INDEX);
  });

  // Open external links in the real browser instead of hijacking the pad.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  win.once("ready-to-show", () => win.show());
  win.on("closed", () => { win = null; });
};

const toggleWindow = () => {
  if (!win) return createWindow();
  if (win.isVisible()) win.hide();
  else { win.show(); win.focus(); }
};

const togglePin = () => {
  if (!win) return;
  const pinned = !win.isAlwaysOnTop();
  win.setAlwaysOnTop(pinned, "floating");
  if (tray) tray.setToolTip(pinned ? "Fart Brains (pinned)" : "Fart Brains");
};

const createTray = () => {
  try {
    tray = new Tray(nativeImage.createEmpty());
    tray.setToolTip("Fart Brains (pinned)");
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: "Show / hide", click: toggleWindow },
      { label: "Toggle always on top", click: togglePin },
      { type: "separator" },
      { label: "Quit", click: () => app.quit() },
    ]));
  } catch {
    // Tray is optional; ignore on platforms without a tray surface.
  }
};

app.whenReady().then(() => {
  createWindow();
  createTray();
  globalShortcut.register("CommandOrControl+Shift+B", toggleWindow);
  globalShortcut.register("CommandOrControl+Shift+P", togglePin);

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("will-quit", () => globalShortcut.unregisterAll());
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
