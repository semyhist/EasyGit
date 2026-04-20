/**
 * EasyGit — Electron Main Process
 * Fullscreen window, native title bar, IPC handlers, auto-updater.
 */

const { app, BrowserWindow, ipcMain, Notification, dialog, shell, session } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const fs   = require('fs');

// ── Keep reference to window ──
let mainWindow;

// ── Dev mode detection ──
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// ── Create Window ──
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    // Start maximized
    show: false,
    // Native Windows title bar (frame: true is default)
    frame: true,
    autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'logo', 'logowithbg.png'),
    backgroundColor: '#0d1117',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: true,
    },
  });

  // Load the app
  if (isDev) {
    // Dev: load from local server if running, otherwise from file
    mainWindow.loadURL('http://localhost:3333').catch(() => {
      mainWindow.loadFile(path.join(__dirname, '..', 'index.html'));
    });
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    mainWindow.loadFile(path.join(__dirname, '..', 'index.html'));
  }

  // Show maximized once ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize();
    mainWindow.show();
  });

  // Open external links in browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  // Close = quit
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ── App Lifecycle ──

app.whenReady().then(() => {
  // Remove CORS/CSP restrictions for AI API calls — must be set before window creation
  session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
    const { requestHeaders, url } = details;
    if (
      url.includes('api.openai.com') ||
      url.includes('api.anthropic.com') ||
      url.includes('api.groq.com') ||
      url.includes('generativelanguage.googleapis.com') ||
      url.includes('openrouter.ai') ||
      url.includes('api.github.com')
    ) {
      delete requestHeaders['Origin'];
      delete requestHeaders['Referer'];
    }
    callback({ requestHeaders });
  });

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const { responseHeaders, url } = details;
    if (
      url.includes('api.openai.com') ||
      url.includes('api.anthropic.com') ||
      url.includes('api.groq.com') ||
      url.includes('generativelanguage.googleapis.com') ||
      url.includes('openrouter.ai') ||
      url.includes('api.github.com')
    ) {
      responseHeaders['access-control-allow-origin'] = ['*'];
      delete responseHeaders['content-security-policy'];
      delete responseHeaders['x-frame-options'];
    }
    callback({ responseHeaders });
  });

  createWindow();

  // macOS: re-create window if dock icon is clicked
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  // Check for updates after a short delay
  if (!isDev) {
    setTimeout(() => {
      autoUpdater.checkForUpdatesAndNotify();
    }, 5000);
  }
});

// Quit when all windows closed (Windows/Linux)
app.on('window-all-closed', () => {
  app.quit();
});

// ── IPC Handlers ──

// Show OS notification
ipcMain.handle('show-notification', (_, { title, body }) => {
  if (Notification.isSupported()) {
    const notif = new Notification({
      title,
      body,
      icon: path.join(__dirname, '..', 'logo', 'logowithbg.png'),
    });
    notif.show();
    notif.on('click', () => {
      if (mainWindow) { mainWindow.show(); mainWindow.focus(); }
    });
  }
});

// Save file via native dialog
ipcMain.handle('save-file', async (_, { content, defaultName }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: defaultName || 'README.md',
    filters: [
      { name: 'Markdown', extensions: ['md'] },
      { name: 'All Files', extensions: ['*'] },
    ],
  });

  if (!result.canceled && result.filePath) {
    fs.writeFileSync(result.filePath, content, 'utf8');
    return { success: true, filePath: result.filePath };
  }
  return { success: false };
});

// Get app version
ipcMain.handle('get-version', () => app.getVersion());

// ── Auto-Updater Events ──

autoUpdater.setFeedURL({
  provider: 'github',
  owner: 'semyhist',
  repo: 'EasyGit',
});

autoUpdater.on('update-available', () => {
  if (mainWindow) {
    mainWindow.webContents.executeJavaScript(`
      UI.toast('A new version of EasyGit is available! Downloading...', 'info', 6000);
    `).catch(() => {});
  }
});

autoUpdater.on('update-downloaded', () => {
  dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: 'Update Ready',
    message: 'A new version of EasyGit has been downloaded.',
    detail: 'Restart the app to apply the update.',
    buttons: ['Restart Now', 'Later'],
    defaultId: 0,
  }).then(({ response }) => {
    if (response === 0) autoUpdater.quitAndInstall();
  });
});

autoUpdater.on('error', (err) => {
  console.error('AutoUpdater error:', err.message);
});
