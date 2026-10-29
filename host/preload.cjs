// Exposes a tiny, read-mostly bridge to the launcher page. The page works without it (plain browser).
const { contextBridge, ipcRenderer } = require('electron');
const info = ipcRenderer.sendSync('mgb:info');
contextBridge.exposeInMainWorld('mgbHost', {
  version: info.version,
  platform: info.platform,
  getUpdate: () => ipcRenderer.invoke('mgb:update-state'),
  checkUpdate: () => ipcRenderer.invoke('mgb:update-check'),
  installUpdate: () => ipcRenderer.invoke('mgb:update-install'),
  onUpdate: (cb) => { ipcRenderer.on('mgb:update', (_e, s) => cb(s)); },
});
