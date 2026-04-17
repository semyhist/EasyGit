/**
 * EasyGit — Electron Preload
 * Exposes safe IPC bridges between renderer and main process.
 */
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Show a native OS notification
  showNotification: (title, body) =>
    ipcRenderer.invoke('show-notification', { title, body }),

  // Save a file via native dialog
  saveFile: (content, defaultName) =>
    ipcRenderer.invoke('save-file', { content, defaultName }),

  // Get app version
  getVersion: () => ipcRenderer.invoke('get-version'),
});
