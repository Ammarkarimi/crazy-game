'use strict';
/* Desktop wrapper (Windows / macOS / Linux) for Steam, itch.io app and direct sales. */
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 800,
    minHeight: 450,
    fullscreen: !process.argv.includes('--windowed'),
    backgroundColor: '#08060c',
    title: 'UMBRA',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: false,
    },
  });
  win.setMenu(null);
  win.once('ready-to-show', () => win.show());
  win.loadFile(path.join(__dirname, '..', 'index.html'));

  // F11 / Alt+Enter toggle fullscreen
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11' || (input.alt && input.key === 'Enter')) {
      win.setFullScreen(!win.isFullScreen());
      e.preventDefault();
    }
  });
  // Never navigate away from the game or open popups
  win.webContents.on('will-navigate', e => e.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
}

ipcMain.on('umbra:quit', () => app.quit());
ipcMain.on('umbra:fullscreen', () => { if (win) win.setFullScreen(!win.isFullScreen()); });

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
