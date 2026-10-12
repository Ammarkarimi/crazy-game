'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('hyperchaosDesktop', {
  quit: () => ipcRenderer.send('hc:quit'),
  toggleFullscreen: () => ipcRenderer.send('hc:fullscreen'),
});
