const { app, BrowserWindow, ipcMain } = require('electron');
const { fork } = require('child_process');
const path = require('path');
const net = require('net');

// The most aggressive and standard way for silent printing
app.commandLine.appendSwitch('kiosk-printing');
app.commandLine.appendSwitch('disable-print-preview');

let mainWindow;
let serverProcess;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'كافيتيريا جامعة أفريقيا - Africa University Cafeteria',
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  mainWindow.maximize();

  // Universal Silent Print (Works with Kiosk Flags)
  ipcMain.on('print-silent', (event) => {
    event.sender.print({ silent: true, printBackground: true });
  });
  
  // Wait a moment for the Express server to be ready
  checkServerReady(5000, () => {
    mainWindow.loadURL('http://localhost:5000');
  });

  mainWindow.webContents.on('did-fail-load', () => {
    setTimeout(() => {
      mainWindow.loadURL('http://localhost:5000');
    }, 1500);
  });
}

function checkServerReady(port, cb) {
  const socket = new net.Socket();
  socket.setTimeout(200);
  socket.on('connect', () => {
    socket.destroy();
    cb();
  });
  socket.on('error', () => {
    socket.destroy();
    setTimeout(() => checkServerReady(port, cb), 500);
  });
  socket.on('timeout', () => {
    socket.destroy();
    setTimeout(() => checkServerReady(port, cb), 500);
  });
  socket.connect(port, '127.0.0.1');
}

app.whenReady().then(() => {
  const basePath = app.isPackaged 
    ? path.join(process.resourcesPath, 'backend') 
    : path.join(__dirname, 'backend');
  
  // Create safe directory for DB in user data folder instead of Program Files
  const dbPath = path.join(app.getPath('userData'), 'database');
  const requireFs = require('fs');
  if (!requireFs.existsSync(dbPath)) {
    requireFs.mkdirSync(dbPath, { recursive: true });
  }

  // Auto-copy bundled database to userData on first run so data isn't lost on new computers
  const targetDbFile = path.join(dbPath, 'cafeteria.db');
  const sourceDbFile = path.join(basePath, 'src', 'database', 'cafeteria.db');
  
  if (!requireFs.existsSync(targetDbFile) && requireFs.existsSync(sourceDbFile)) {
    console.log('First run: Copying bundled database to safe userData directory...');
    requireFs.copyFileSync(sourceDbFile, targetDbFile);
  }

  // Also copy license if exists
  const targetLicense = path.join(dbPath, '.license');
  const sourceLicense = path.join(basePath, 'src', 'database', '.license');
  if (!requireFs.existsSync(targetLicense) && requireFs.existsSync(sourceLicense)) {
    requireFs.copyFileSync(sourceLicense, targetLicense);
  }

  const serverProcessEnv = { 
      ...process.env, 
      PORT: '5000', 
      NODE_ENV: 'production',
      ELECTRON_RUN_AS_NODE: '1',
      DB_PATH: path.join(dbPath, 'cafeteria.db'),
      LICENSE_PATH: path.join(dbPath, '.license'),
      CLEAN_DB: 'false'
  };

  serverProcess = fork(path.join(basePath, 'src', 'index.js'), [], {
    cwd: basePath,
    env: serverProcessEnv,
    stdio: 'pipe'
  });

  let serverErrorLog = '';
  serverProcess.stderr.on('data', (data) => {
    serverErrorLog += data.toString();
    console.error('Backend Error:', data.toString());
  });

  serverProcess.stdout.on('data', (data) => {
    console.log('Backend:', data.toString());
  });

  serverProcess.on('exit', (code) => {
    const { dialog } = require('electron');
    dialog.showErrorBox('خادم النظام توقف', `توقف السيرفر بشكل مفاجئ (Code: ${code}).\n\nError:\n${serverErrorLog}`);
  });

  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('quit', () => {
  if (serverProcess) {
    serverProcess.kill();
  }
});
