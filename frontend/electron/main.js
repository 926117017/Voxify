const { app, BrowserWindow, Menu, ipcMain, dialog, WebContentsView, protocol } = require('electron');
const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

let mainWindow, backendProcess, server;
const isDev = !app.isPackaged;

// ── BrowserView 管理 (WebContentsView) ──
const browserTabs = new Map(); // tabId → { view, url, title }
const browsingHistory = []; // { url, title, lastVisitTime }
const historySet = new Set(); // 去重用
let activeTabId = null;

function createBrowserView(tabId) {
  if (browserTabs.has(tabId)) return;
  const view = new WebContentsView({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  const entry = { view, url: 'about:home', title: '新标签页' };
  browserTabs.set(tabId, entry);

  view.webContents.on('page-title-updated', (e, title) => {
    entry.title = title;
    send('browser-title-changed', { tabId, title });
    // 更新历史记录中的标题
    for (const item of browsingHistory) {
      if (item.url === entry.url) {
        item.title = title;
        break;
      }
    }
  });
  view.webContents.on('did-navigate', (e, url) => {
    // goBack() 导航到 about:blank 说明没有更多历史了，回到首页
    if (url === 'about:blank' && !view.webContents.canGoBack()) {
      hideAllBrowserViews();
      send('browser-back-exhausted', { tabId });
      return;
    }
    entry.url = url;
    send('browser-url-changed', { tabId, url });
    sendNavState(tabId);
    if (url !== 'about:home' && !historySet.has(url)) {
      historySet.add(url);
      browsingHistory.push({ url, title: entry.title || url, lastVisitTime: Date.now() });
    }
  });
  view.webContents.on('did-navigate-in-page', (e, url) => {
    if (e.isMainFrame) {
      entry.url = url;
      send('browser-url-changed', { tabId, url });
      sendNavState(tabId);
      if (url !== 'about:home' && !historySet.has(url)) {
        historySet.add(url);
        browsingHistory.push({ url, title: entry.title || url, lastVisitTime: Date.now() });
      }
    }
  });
  view.webContents.on('did-start-loading', () => {
    send('browser-loading-start', { tabId });
  });
  view.webContents.on('did-stop-loading', () => {
    send('browser-loading-stop', { tabId });
    sendNavState(tabId);
  });

  view.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const proto = new URL(url).protocol;
      if (proto === 'http:' || proto === 'https:') {
        view.webContents.loadURL(url);
      }
    } catch {}
    return { action: 'deny' };
  });

  view.webContents.on('will-navigate', (e, url) => {
    try {
      const proto = new URL(url).protocol;
      if (proto !== 'http:' && proto !== 'https:') {
        e.preventDefault();
      }
    } catch {
      e.preventDefault();
    }
  });
}

function destroyBrowserView(tabId) {
  const entry = browserTabs.get(tabId);
  if (!entry) return;
  if (mainWindow && !mainWindow.isDestroyed()) {
    try { mainWindow.contentView.removeChildView(entry.view); } catch {}
  }
  entry.view.webContents.close();
  browserTabs.delete(tabId);
}

function showBrowserView(tabId, bounds) {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  const entry = browserTabs.get(tabId);
  if (!entry) return;
  // 先移除所有
  for (const [, e] of browserTabs) {
    try { mainWindow.contentView.removeChildView(e.view); } catch {}
  }
  // 添加并设置 bounds
  mainWindow.contentView.addChildView(entry.view);
  if (bounds) {
    entry.view.setBounds(bounds);
  }
}

function hideAllBrowserViews() {
  if (!mainWindow || mainWindow.isDestroyed()) return;
  for (const [, e] of browserTabs) {
    try { mainWindow.contentView.removeChildView(e.view); } catch {}
  }
}

function send(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send(channel, data);
  }
}

function sendNavState(tabId) {
  const entry = browserTabs.get(tabId);
  if (!entry) return;
  const wc = entry.view.webContents;
  send('browser-nav-state', {
    tabId,
    canGoBack: wc.canGoBack(),
    canGoForward: wc.canGoForward(),
  });
}

// ── IPC Handlers ──
ipcMain.on('browser-create', (e, { tabId }) => {
  createBrowserView(tabId);
});

ipcMain.on('browser-destroy', (e, { tabId }) => {
  destroyBrowserView(tabId);
});

ipcMain.on('browser-navigate', (e, { tabId, url }) => {
  let entry = browserTabs.get(tabId);
  if (!entry) {
    createBrowserView(tabId);
    entry = browserTabs.get(tabId);
  }
  entry.url = url;
  entry.view.webContents.loadURL(url);
});

ipcMain.on('browser-back', (e, { tabId }) => {
  const entry = browserTabs.get(tabId);
  if (entry) {
    if (entry.view.webContents.canGoBack()) {
      entry.view.webContents.goBack();
    } else {
      hideAllBrowserViews();
      send('browser-back-exhausted', { tabId });
    }
  }
});

ipcMain.on('browser-forward', (e, { tabId }) => {
  const entry = browserTabs.get(tabId);
  if (entry && entry.view.webContents.canGoForward()) {
    entry.view.webContents.goForward();
  }
});

ipcMain.on('browser-reload', (e, { tabId }) => {
  const entry = browserTabs.get(tabId);
  if (entry) entry.view.webContents.reload();
});

ipcMain.on('browser-set-active', (e, { tabId, bounds }) => {
  activeTabId = tabId;
  showBrowserView(tabId, bounds);
});

ipcMain.on('browser-hide-all', () => {
  activeTabId = null;
  hideAllBrowserViews();
});

ipcMain.on('browser-resize', (e, { tabId, bounds }) => {
  const entry = browserTabs.get(tabId);
  if (entry) entry.view.setBounds(bounds);
});

ipcMain.handle('browser-get-history', async () => {
  return browsingHistory.slice().reverse();
});

// ── Backend ──
function startBackend() {
  const backendDir = isDev
    ? path.join(__dirname, '..', '..', 'backend')
    : path.join(process.resourcesPath, 'backend');
  backendProcess = spawn('python', [
    '-m', 'uvicorn', 'app.main:app',
    '--host', '127.0.0.1', '--port', '8866',
  ], {
    cwd: backendDir,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, HTTP_PROXY: '', HTTPS_PROXY: '' },
  });
  backendProcess.stdout.on('data', (d) => process.stdout.write(`[backend] ${d}`));
  backendProcess.stderr.on('data', (d) => process.stderr.write(`[backend] ${d}`));
  backendProcess.on('error', (err) => console.error('Backend failed:', err.message));
}

function stopBackend() {
  if (backendProcess) { backendProcess.kill(); backendProcess = null; }
}

function serveFile(res, filePath) {
  const ext = path.extname(filePath);
  const mime = {
    '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
    '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
    '.woff2': 'font/woff2', '.json': 'application/json', '.txt': 'text/plain',
  };
  res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
}

function startStaticServer() {
  const outDir = path.join(app.getAppPath(), 'out');
  return new Promise((resolve) => {
    server = http.createServer((req, res) => {
      const url = req.url.split('?')[0].split('#')[0];
      let p = path.join(outDir, url === '/' ? 'index.html' : url);
      if (!fs.existsSync(p)) {
        const html = path.join(outDir, url + '.html');
        p = fs.existsSync(html) ? html : path.join(outDir, '404.html');
      }
      serveFile(res, p);
    });
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
}

async function createWindow() {
  const port = await startStaticServer();
  mainWindow = new BrowserWindow({
    width: 1200, height: 800, minWidth: 900, minHeight: 600,
    title: 'Voxify',
    icon: path.join(app.getAppPath(), 'public', 'app-icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, nodeIntegration: false,
    },
  });

  if (process.argv.includes('--dev')) {
    mainWindow.loadURL('http://localhost:3000');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadURL(`http://127.0.0.1:${port}`);
  }

  mainWindow.on('closed', () => { mainWindow = null; });

  mainWindow.on('resize', () => {
    send('browser-window-resized', {});
  });
}

ipcMain.handle('select-folder', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
  });
  return result.canceled ? null : result.filePaths[0];
});

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);

  // 静默吞掉网站尝试打开的自定义协议（如 bytedance:// snssdk:// 等），阻止 Windows 弹出"获取打开应用"对话框
  const ignoredSchemes = ['bytedance', 'snssdk', 'sslocal', 'toutiao', 'aweme', 'douyin', 'douyinweb', 'webcard', 'Bytedance'];
  for (const scheme of ignoredSchemes) {
    try {
      protocol.handle(scheme, () => new Response('', { status: 200, headers: { 'content-type': 'text/html' } }));
    } catch {}
  }

  startBackend();
  createWindow();
});
app.on('window-all-closed', () => {
  stopBackend();
  if (server) server.close();
  for (const [tabId] of browserTabs) destroyBrowserView(tabId);
  if (process.platform !== 'darwin') app.quit();
});
app.on('before-quit', () => {
  stopBackend();
  if (server) server.close();
  for (const [tabId] of browserTabs) destroyBrowserView(tabId);
});
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
