// Exposes a tiny, read-mostly bridge to the launcher page. The page works without it (plain browser).
const { contextBridge, ipcRenderer } = require('electron');
const info = ipcRenderer.sendSync('mgb:info');
// Steam Input can turn triggers into mouse clicks. When the mouse is off (Steam Deck, or --no-mouse), swallow every mouse
// event before any page script sees it; this preload runs first, so its capture listeners come first.
if (info.mouseOff) {
  for (const type of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'dblclick', 'auxclick', 'contextmenu', 'wheel']) {
    window.addEventListener(type, (e) => { e.stopImmediatePropagation(); e.preventDefault(); }, { capture: true, passive: false });
  }
}
contextBridge.exposeInMainWorld('mgbHost', {
  version: info.version,
  platform: info.platform,
  deck: !!info.deck,
  steam: !!info.steam,
  getUpdate: () => ipcRenderer.invoke('mgb:update-state'),
  checkUpdate: () => ipcRenderer.invoke('mgb:update-check'),
  installUpdate: () => ipcRenderer.invoke('mgb:update-install'),
  quit: () => ipcRenderer.invoke('mgb:quit'),
  onUpdate: (cb) => { ipcRenderer.on('mgb:update', (_e, s) => cb(s)); },
});
