const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const { URL } = require('url');

let win;
let launchFileContent = null;

function getFilePathFromArgs(argv = process.argv) {
  const args = argv.slice(app.isPackaged ? 1 : 2);
  for (const arg of args) {
    if (arg.startsWith('-')) continue;
    try {
      if (fs.existsSync(arg) && fs.statSync(arg).isFile()) {
        if (arg.endsWith('.mdway') || arg.endsWith('.json')) {
          return arg;
        }
      }
    } catch (e) {}
  }
  return null;
}

function readCanvasFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    return { success: true, data, filePath: path.basename(filePath) };
  } catch (err) {
    return { success: false, error: 'Could not load canvas file: ' + err.message };
  }
}

// Single Instance Lock
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on('second-instance', (event, commandLine) => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
      
      const filePath = getFilePathFromArgs(commandLine);
      if (filePath) {
        const fileData = readCanvasFile(filePath);
        if (fileData && fileData.success) {
          win.webContents.send('open-launch-file', fileData);
        }
      }
    }
  });

  app.whenReady().then(() => {
    // Check if launched with a file
    const filePath = getFilePathFromArgs();
    if (filePath) {
      launchFileContent = readCanvasFile(filePath);
    }

    win = new BrowserWindow({
      width: 600,
      height: 720,
      minWidth: 320,
      minHeight: 240,
      frame: false,
      backgroundColor: '#0d0d10',
      alwaysOnTop: true,
      resizable: true,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        sandbox: false,
        preload: path.join(__dirname, 'preload.js'),
        webviewTag: true
      },
    });
    
    // Load the standalone index.html located in the same directory
    win.loadFile(path.join(__dirname, 'index.html'));

    // Ctrl+Shift+I → detached DevTools for debugging
    win.webContents.on('before-input-event', (e, input) => {
      if (input.type === 'keyDown' && input.control && input.shift && input.key.toLowerCase() === 'i') {
        e.preventDefault();
        if (win.webContents.isDevToolsOpened()) {
          win.webContents.closeDevTools();
        } else {
          win.webContents.openDevTools({ mode: 'detach' });
        }
      }
    });
  });
}

app.on('window-all-closed', () => app.quit());

// --- Window control handlers ---
ipcMain.on('window-close', () => win.close());
ipcMain.on('window-minimize', () => win.minimize());
ipcMain.on('window-pin', (_, isPinned) => win.setAlwaysOnTop(isPinned, 'screen-saver'));

// --- Open folder in OS file explorer ---
ipcMain.handle('open-folder', (_, folderPath) => {
  shell.openPath(folderPath);
});

// --- Open URL in OS default web browser ---
ipcMain.handle('open-external', (_, url) => {
  shell.openExternal(url);
});

// --- Proxy Scryfall requests to bypass CORS ---
ipcMain.handle('scryfall-post', async (_, { url, body }) => {
  return new Promise((resolve) => {
    const payload = JSON.stringify(body);
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;

    const req = client.request({
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
        'User-Agent': 'MDway/1.0 (contact@mdway.app) Scryfall-Integration/1.0'
      }
    }, (res) => {
      let data = '';
      res.setEncoding('utf-8');
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        try {
          resolve({ success: true, data: JSON.parse(data) });
        } catch (e) {
          resolve({ success: false, error: 'JSON parse error: ' + data });
        }
      });
    });

    req.on('error', (err) => {
      resolve({ success: false, error: err.message });
    });

    req.write(payload);
    req.end();
  });
});

// --- File launch handlers ---
ipcMain.handle('get-launch-file', () => {
  const res = launchFileContent;
  launchFileContent = null;
  return res;
});

// --- File dialog operations ---
ipcMain.handle('file-save', async (_, data) => {
  const { filePath } = await dialog.showSaveDialog(win, {
    title: 'Save MDway Canvas',
    defaultPath: 'canvas.mdway',
    filters: [
      { name: 'MDway Canvas (*.mdway)', extensions: ['mdway'] },
      { name: 'JSON Files (*.json)', extensions: ['json'] }
    ]
  });
  if (filePath) {
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
      return { success: true, filePath: path.basename(filePath) };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
  return { success: false };
});

ipcMain.handle('file-load', async () => {
  const { filePaths } = await dialog.showOpenDialog(win, {
    title: 'Open MDway Canvas',
    filters: [
      { name: 'MDway Canvas (*.mdway)', extensions: ['mdway'] },
      { name: 'JSON Files (*.json)', extensions: ['json'] }
    ],
    properties: ['openFile']
  });
  if (filePaths && filePaths.length > 0) {
    try {
      const content = fs.readFileSync(filePaths[0], 'utf-8');
      const data = JSON.parse(content);
      return { success: true, data, filePath: path.basename(filePaths[0]) };
    } catch (err) {
      return { success: false, error: 'Could not load canvas file: ' + err.message };
    }
  }
  return { success: false };
});

ipcMain.handle('file-export', async (_, { content, defaultFilename, filters }) => {
  const { filePath } = await dialog.showSaveDialog(win, {
    title: 'Export Card Content',
    defaultPath: defaultFilename,
    filters: filters || [
      { name: 'All Files (*.*)', extensions: ['*'] }
    ]
  });
  if (filePath) {
    try {
      fs.writeFileSync(filePath, content, 'utf-8');
      return { success: true, filePath: path.basename(filePath) };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }
  return { success: false };
});


// --- URL Scraper ---
ipcMain.handle('fetch-url-metadata', async (_, targetUrl) => {
  return fetchUrlMetadata(targetUrl);
});

// --- Ollama API Helper ---
ipcMain.handle('ollama-query', async (_, { model, prompt }) => {
  return new Promise((resolve) => {
    const payload = JSON.stringify({ model, prompt, stream: false });
    const req = http.request({
      hostname: '127.0.0.1',
      port: 11434,
      path: '/api/generate',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve({ success: true, data: JSON.parse(body) });
        } catch (e) {
          resolve({ success: false, error: 'JSON parse error: ' + body });
        }
      });
    });

    req.on('error', (err) => {
      resolve({ success: false, error: 'Ollama is offline or unreachable: ' + err.message });
    });

    req.write(payload);
    req.end();
  });
});

function fetchUrlMetadata(targetUrl, redirectDepth = 0) {
  return new Promise((resolve) => {
    if (redirectDepth > 5) {
      resolve({ success: false, error: 'Too many redirects', url: targetUrl });
      return;
    }
    try {
      if (!/^https?:\/\//i.test(targetUrl)) {
        targetUrl = 'https://' + targetUrl;
      }
      const parsedUrl = new URL(targetUrl);
      const isHttps = parsedUrl.protocol === 'https:';
      const client = isHttps ? https : http;

      const reqOptions = {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9'
        }
      };
      if (isHttps) {
        reqOptions.rejectUnauthorized = false;
      }

      const req = client.get(targetUrl, reqOptions, (res) => {
        // Handle redirects (e.g. 301, 302, 307, 308)
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume(); // drain the response so the socket can be reused
          const nextUrl = new URL(res.headers.location, targetUrl).href;
          resolve(fetchUrlMetadata(nextUrl, redirectDepth + 1));
          return;
        }

        let html = '';
        res.setEncoding('utf-8');
        res.on('data', (chunk) => {
          html += chunk;
          // Stop downloading after 64KB — enough for all <head> tags
          if (html.length > 65536) {
            req.destroy();
          }
        });

        res.on('end', () => {
          resolve(parseHtmlMetadata(html, targetUrl));
        });
      });

      req.on('error', (err) => {
        resolve({ success: false, error: err.message, url: targetUrl });
      });

      req.setTimeout(10000, () => {
        req.destroy();
        resolve({ success: false, error: 'Request timed out', url: targetUrl });
      });
    } catch (e) {
      resolve({ success: false, error: e.message, url: targetUrl });
    }
  });
}

function parseHtmlMetadata(html, url) {
  const result = { success: true, url, title: '', description: '', image: '' };

  // Parse HTML <title>
  let match = html.match(/<title[^>]*>([\s\S]*?)<\/code>/i); // Wait, the original code had: match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i); Let's fix that!
  match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (match) result.title = match[1].trim();

  // Parse OpenGraph Title
  match = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i) ||
          html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:title["']/i);
  if (match) result.title = match[1].trim();

  // Parse Meta Description
  match = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ||
          html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
  if (match) result.description = match[1].trim();

  // Parse OpenGraph Description
  match = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) ||
          html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i);
  if (match) result.description = match[1].trim();

  // Parse OpenGraph Image
  match = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i) ||
          html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  if (match) result.image = match[1].trim();

  // Clean XML/HTML entities
  for (const key of ['title', 'description']) {
    if (result[key]) {
      result[key] = result[key]
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
    }
  }

  // Fallback if title is empty
  if (!result.title) {
    try {
      result.title = new URL(url).hostname;
    } catch (_) {
      result.title = url;
    }
  }

  return result;
}
