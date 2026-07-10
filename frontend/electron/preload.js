const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  selectFolder: () => ipcRenderer.invoke('select-folder'),

  browser: {
    create: (tabId) => ipcRenderer.send('browser-create', { tabId }),
    destroy: (tabId) => ipcRenderer.send('browser-destroy', { tabId }),
    navigate: (tabId, url) => ipcRenderer.send('browser-navigate', { tabId, url }),
    back: (tabId) => ipcRenderer.send('browser-back', { tabId }),
    forward: (tabId) => ipcRenderer.send('browser-forward', { tabId }),
    reload: (tabId) => ipcRenderer.send('browser-reload', { tabId }),
    setActive: (tabId, bounds) => ipcRenderer.send('browser-set-active', { tabId, bounds }),
    hideAll: () => ipcRenderer.send('browser-hide-all'),
    resize: (tabId, bounds) => ipcRenderer.send('browser-resize', { tabId, bounds }),
    getHistory: () => ipcRenderer.invoke('browser-get-history'),
    on: (event, callback) => {
      const handler = (_, data) => callback(data);
      ipcRenderer.on(event, handler);
      return handler;
    },
    off: (event, handler) => {
      ipcRenderer.removeListener(event, handler);
    },
  },
});
