const { app, BrowserWindow, ipcMain } = require('electron');

let win;

app.whenReady().then(() => {
  win = new BrowserWindow({
    width: 580,
    height: 700,
    minWidth: 300,
    minHeight: 200,
    frame: false,
    backgroundColor: '#0d0d10',
    alwaysOnTop: true,
    resizable: true,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
  });
  win.loadFile('index.html');

  // Ctrl+Shift+I → detached DevTools for debugging
  win.webContents.on('before-input-event', (e, input) => {
    if (input.control && input.shift && input.key === 'I') {
      win.webContents.openDevTools({ mode: 'detach' });
    }
  });
});

app.on('window-all-closed', () => app.quit());

ipcMain.on('pin', (_, v) => win.setAlwaysOnTop(v, 'screen-saver'));
ipcMain.on('minimize', () => win.minimize());
ipcMain.on('close', () => win.close());
