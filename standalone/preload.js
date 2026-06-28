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

  // URL Scraper metadata fetcher
  fetchLinkMetadata: (url) => ipcRenderer.invoke('fetch-url-metadata', url),

  // Ollama LLM integration helper
  queryOllama: (model, prompt) => ipcRenderer.invoke('ollama-query', { model, prompt }),

  // Markdown rendering & Syntax highlighting functions
  renderCardBody: (text, lang, showMd) => renderBody(text, lang, showMd),
  detectLanguage: (text) => detectLang(text),
  escapeHtml: (text) => esc(text)
});
