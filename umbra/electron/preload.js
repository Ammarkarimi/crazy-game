'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('umbraDesktop', {
  quit: () => ipcRenderer.send('umbra:quit'),
  toggleFullscreen: () => ipcRenderer.send('umbra:fullscreen'),
});
