const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  printSilent: () => ipcRenderer.send('print-silent')
});
