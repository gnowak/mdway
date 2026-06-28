// web/ipc.js - Web/Browser implementation of the IPC interface

export const ipc = {
  close: () => {
    console.log('[Web] Close window is unsupported in browser.');
  },
  minimize: () => {
    console.log('[Web] Minimize window is unsupported in browser.');
  },
  setPin: (pinned) => {
    console.log('[Web] Pin window is unsupported in browser. Pin state:', pinned);
  },
  saveCanvas: async (data) => {
    console.log('[Web] Saving canvas to file');
    try {
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'canvas.mdway';
      a.click();
      URL.revokeObjectURL(url);
      return { success: true, filePath: 'canvas.mdway' };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },
  loadCanvas: async () => {
    console.log('[Web] Opening file dialog');
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.mdway,.json';
      input.style.display = 'none';

      input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) {
          resolve({ success: false });
          return;
        }

        const reader = new FileReader();
        reader.onload = (evt) => {
          try {
            const data = JSON.parse(evt.target.result);
            resolve({ success: true, data, filePath: file.name });
          } catch (err) {
            resolve({ success: false, error: 'Could not load canvas file: ' + err.message });
          }
        };
        reader.onerror = () => {
          resolve({ success: false, error: 'File read error' });
        };
        reader.readAsText(file);
      };

      document.body.appendChild(input);
      input.click();
      document.body.removeChild(input);
    });
  },
  exportFile: async (content, defaultFilename, filters) => {
    console.log('[Web] Exporting card to file:', defaultFilename);
    try {
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = defaultFilename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return { success: true, filePath: defaultFilename };
    } catch (e) {
      return { success: false, error: e.message };
    }
  },
  getLaunchFile: async () => {
    return null;
  },
  onOpenLaunchFile: (callback) => {
    return () => {};
  },
  fetchLinkMetadata: async (url) => {
    console.log('[Web] Fetching metadata for', url);
    return {
      success: true,
      url,
      title: url.replace(/^https?:\/\/(www\.)?/i, ''),
      description: 'Web scraper requires a backend. Running in web fallback mode.',
      image: ''
    };
  },
  queryOllama: async (model, prompt) => {
    console.log('[Web] Querying local Ollama API');
    try {
      const response = await fetch('http://127.0.0.1:11434/api/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ model, prompt, stream: false })
      });
      const data = await response.json();
      return { success: true, data };
    } catch (e) {
      return { success: false, error: 'Ollama is offline or unreachable: ' + e.message };
    }
  },

  // Client-side markdown rendering & language detection
  renderCardBody: (text, lang, showMd) => {
    const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const unesc = (s) => String(s)
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'");

    if (showMd && typeof window.marked !== 'undefined') {
      try {
        let html = window.marked.parse(text);
        html = html.replace(
          /<pre><code(?:\s+class="([^"]*)")?>([\s\S]*?)<\/code><\/pre>/gi,
          (match, cls, encoded) => {
            const l = cls ? cls.replace(/^language-/, '') : '';
            const raw = unesc(encoded);

            if (l === 'mermaid') {
              return '<div class="mermaid-wrap"><div class="mermaid">' + raw + '</div></div>';
            }

            try {
              if (typeof window.hljs !== 'undefined') {
                const v = (l && window.hljs.getLanguage(l))
                  ? window.hljs.highlight(raw, { language: l }).value
                  : window.hljs.highlightAuto(raw).value;
                return '<pre><code class="hljs">' + v + '</code></pre>';
              }
            } catch {}
            return '<pre><code class="hljs">' + esc(raw) + '</code></pre>';
          }
        );

        // Protect code/pre blocks and replace MTG symbols with Scryfall SVG links
        const translateManaSymbols = (htmlStr) => {
          const placeholders = [];
          let temp = htmlStr.replace(/<pre[\s\S]*?<\/pre>/gi, (m) => {
            placeholders.push(m);
            return `__PRE_BLOCK_PLACEHOLDER_${placeholders.length - 1}__`;
          });
          temp = temp.replace(/<code[\s\S]*?<\/code>/gi, (m) => {
            placeholders.push(m);
            return `__PRE_BLOCK_PLACEHOLDER_${placeholders.length - 1}__`;
          });
          temp = temp.replace(/\{([A-Za-z0-9/∞½]+)\}/g, (m, g) => {
            const symbol = g.replace(/\//g, '').toUpperCase();
            return `<img src="https://svgs.scryfall.io/card-symbols/${symbol}.svg" class="mtg-mana-symbol" alt="${g}" style="height: 0.9em; width: 0.9em; vertical-align: middle; margin: 0 1px; display: inline-block;">`;
          });
          return temp.replace(/__PRE_BLOCK_PLACEHOLDER_(\d+)__/g, (m, id) => {
            return placeholders[parseInt(id, 10)];
          });
        };

        html = translateManaSymbols(html);
        return '<div class="mdv">' + html + '</div>';
      } catch (e) {
        console.error('Markdown render error', e);
      }
    }

    try {
      if (typeof window.hljs !== 'undefined') {
        const v = (lang && lang !== 'text' && lang !== 'markdown')
          ? window.hljs.highlight(text, { language: lang }).value
          : window.hljs.highlightAuto(text).value;
        return '<pre><code class="hljs">' + v + '</code></pre>';
      }
    } catch {}

    return '<pre><code class="hljs">' + esc(text) + '</code></pre>';
  },
  detectLanguage: (text) => {
    const MD_RE = [/^#{1,6}\s/m, /\*\*[^*]+\*\*/, /\[.+\]\(.+\)/, /^[-*+]\s/m, /^>\s/m, /```/, /^---$/m];
    if (MD_RE.filter(r => r.test(text)).length >= 2) return 'markdown';

    if (typeof window.hljs !== 'undefined') {
      const DETECT = ['javascript', 'typescript', 'python', 'bash', 'css', 'html', 'xml',
        'json', 'yaml', 'rust', 'go', 'java', 'c', 'cpp', 'csharp', 'ruby', 'sql'];
      try {
        return window.hljs.highlightAuto(text, DETECT).language || 'text';
      } catch {
        return 'text';
      }
    }
    return 'text';
  },
  escapeHtml: (text) => {
    return String(text).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  },
  openFolder: async () => {
    console.log('[Web] openFolder is not supported in the browser.');
    return null;
  },
  openExternal: async (url) => {
    window.open(url, '_blank');
    return true;
  }
};
