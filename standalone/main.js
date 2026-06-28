const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const { URL } = require('url');

let win;

app.whenReady().then(() => {
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

app.on('window-all-closed', () => app.quit());

// --- Window control handlers ---
ipcMain.on('window-close', () => win.close());
ipcMain.on('window-minimize', () => win.minimize());
ipcMain.on('window-pin', (_, isPinned) => win.setAlwaysOnTop(isPinned, 'screen-saver'));

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

// Native implementation of a metadata scraper to avoid external package overhead
function fetchUrlMetadata(targetUrl) {
  return new Promise((resolve) => {
    try {
      if (!/^https?:\/\//i.test(targetUrl)) {
        targetUrl = 'https://' + targetUrl;
      }
      const parsedUrl = new URL(targetUrl);
      const client = parsedUrl.protocol === 'https:' ? https : http;

      const req = client.get(targetUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
        }
      }, (res) => {
        // Handle redirects (e.g. 301, 302)
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const nextUrl = new URL(res.headers.location, targetUrl).href;
          resolve(fetchUrlMetadata(nextUrl));
          return;
        }

        let html = '';
        res.setEncoding('utf-8');
        res.on('data', (chunk) => {
          html += chunk;
          // Stop downloading if we have read past typical head tags (64KB max)
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

      req.setTimeout(4000, () => {
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
