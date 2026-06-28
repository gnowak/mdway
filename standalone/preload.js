const { contextBridge, ipcRenderer } = require('electron');
const hljs = require('highlight.js');
const { marked } = require('marked');

// Configure marked
marked.use({ gfm: true, breaks: true });

// --- Helper Functions for HTML escaping ---
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function unesc(s) {
  return String(s)
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
}

const DETECT = ['javascript', 'typescript', 'python', 'bash', 'css', 'html', 'xml',
  'json', 'yaml', 'rust', 'go', 'java', 'c', 'cpp', 'csharp', 'ruby', 'sql'];

const MD_RE = [/^#{1,6}\s/m, /\*\*[^*]+\*\*/, /\[.+\]\(.+\)/, /^[-*+]\s/m, /^>\s/m, /```/, /^---$/m];

function detectLang(t) {
  if (MD_RE.filter(r => r.test(t)).length >= 2) return 'markdown';
  try {
    return hljs.highlightAuto(t, DETECT).language || 'text';
  } catch {
    return 'text';
  }
}

function translateManaSymbols(html) {
  const placeholders = [];
  // Protect pre blocks
  let tempHtml = html.replace(/<pre[\s\S]*?<\/pre>/gi, (match) => {
    placeholders.push(match);
    return `__PRE_BLOCK_PLACEHOLDER_${placeholders.length - 1}__`;
  });

  // Protect inline code blocks
  tempHtml = tempHtml.replace(/<code[\s\S]*?<\/code>/gi, (match) => {
    placeholders.push(match);
    return `__PRE_BLOCK_PLACEHOLDER_${placeholders.length - 1}__`;
  });

  // Replace MTG mana symbols with Scryfall SVG links
  tempHtml = tempHtml.replace(/\{([A-Za-z0-9/∞½]+)\}/g, (m, g) => {
    const symbol = g.replace(/\//g, '').toUpperCase();
    return `<img src="https://svgs.scryfall.io/card-symbols/${symbol}.svg" class="mtg-mana-symbol" alt="${g}" style="height: 0.9em; width: 0.9em; vertical-align: middle; margin: 0 1px; display: inline-block;">`;
  });

  // Restore protected blocks
  return tempHtml.replace(/__PRE_BLOCK_PLACEHOLDER_(\d+)__/g, (m, id) => {
    return placeholders[parseInt(id, 10)];
  });
}

function renderMarkdown(text) {
  let html = marked.parse(text);
  html = html.replace(
    /<pre><code(?:\s+class="([^"]*)")?>([\s\S]*?)<\/code><\/pre>/gi,
    (match, cls, encoded) => {
      const lang = cls ? cls.replace(/^language-/, '') : '';
      const raw  = unesc(encoded);

      if (lang === 'mermaid') {
        return '<div class="mermaid-wrap"><div class="mermaid">' + raw + '</div></div>';
      }

      try {
        const v = (lang && hljs.getLanguage(lang))
          ? hljs.highlight(raw, { language: lang }).value
          : hljs.highlightAuto(raw).value;
        return '<pre><code class="hljs">' + v + '</code></pre>';
      } catch {
        return '<pre><code class="hljs">' + esc(raw) + '</code></pre>';
      }
    }
  );
  html = translateManaSymbols(html);
  return '<div class="mdv">' + html + '</div>';
}

function renderBody(text, lang, showMd) {
  if (showMd) return renderMarkdown(text);
  try {
    const v = (lang && lang !== 'text' && lang !== 'markdown')
      ? hljs.highlight(text, { language: lang }).value
      : hljs.highlightAuto(text, DETECT).value;
    return '<pre><code class="hljs">' + v + '</code></pre>';
  } catch {
    return '<pre><code class="hljs">' + esc(text) + '</code></pre>';
  }
}

// Expose safe APIs to the renderer
contextBridge.exposeInMainWorld('api', {
  // Window control actions
  close: () => ipcRenderer.send('window-close'),
  minimize: () => ipcRenderer.send('window-minimize'),
  setPin: (pinned) => ipcRenderer.send('window-pin', pinned),

  // File operations
  saveCanvas: (data) => ipcRenderer.invoke('file-save', data),
  loadCanvas: () => ipcRenderer.invoke('file-load'),
  exportFile: (content, defaultFilename, filters) => ipcRenderer.invoke('file-export', { content, defaultFilename, filters }),
  getLaunchFile: () => ipcRenderer.invoke('get-launch-file'),
  onOpenLaunchFile: (callback) => {
    const subscription = (_, data) => callback(data);
    ipcRenderer.on('open-launch-file', subscription);
    return () => {
      ipcRenderer.removeListener('open-launch-file', subscription);
    };
  },

  // URL Scraper metadata fetcher
  fetchLinkMetadata: (url) => ipcRenderer.invoke('fetch-url-metadata', url),

  // Ollama LLM integration helper
  queryOllama: (model, prompt) => ipcRenderer.invoke('ollama-query', { model, prompt }),

  // Markdown rendering & Syntax highlighting functions
  renderCardBody: (text, lang, showMd) => renderBody(text, lang, showMd),
  detectLanguage: (text) => detectLang(text),
  escapeHtml: (text) => esc(text),

  // Open a folder path in the OS file explorer
  openFolder: (folderPath) => ipcRenderer.invoke('open-folder', folderPath),

  // Open a URL in the OS default web browser
  openExternal: (url) => ipcRenderer.invoke('open-external', url)
});
