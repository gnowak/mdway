// card.js - Sticky-Note Card Manager
// Modular card creation, mouse drag/resize, and rendering

import { ipc } from 'ipc';
import { getTransform, screenToCanvas, scheduleRender } from './canvas.js';
import { extensionManager } from 'extension-manager';

export let cards = [];
export let nextId = 0;
let zTop = 10;
let canvasContainer = null;
let onSaveCallback = null;

let dragState = null;
let resizeState = null;

const LANG_COLOR = {
  javascript: '#f7df1e', typescript: '#3178c6', python: '#4b8bbe',
  bash: '#4eaa25', shell: '#4eaa25', css: '#264de4', html: '#e34c26',
  xml: '#f60', json: '#5b8dd9', yaml: '#cb171e', rust: '#dea584',
  go: '#00add8', java: '#ed8b00', c: '#a8b9cc', cpp: '#00599c',
  csharp: '#9b4f96', ruby: '#cc342d', sql: '#e38c00',
  markdown: '#a78bfa', text: '#55526b'
};

const LANG_LABEL = {
  javascript: 'JS', typescript: 'TS', python: 'PY', bash: 'SH', shell: 'SH',
  css: 'CSS', html: 'HTML', xml: 'XML', json: 'JSON', yaml: 'YAML',
  rust: 'RS', go: 'GO', java: 'JAVA', c: 'C', cpp: 'C++', csharp: 'C#',
  ruby: 'RB', sql: 'SQL', markdown: 'MD', text: 'TXT'
};

const EXT_MAP = {
  javascript: 'js', typescript: 'ts', python: 'py', bash: 'sh', shell: 'sh',
  css: 'css', html: 'html', xml: 'xml', json: 'json', yaml: 'yml',
  rust: 'rs', go: 'go', java: 'java', c: 'c', cpp: 'cpp', csharp: 'cs',
  ruby: 'rb', sql: 'sql', markdown: 'md', text: 'txt'
};

export function initCards(container, onSave) {
  canvasContainer = container;
  onSaveCallback = onSave;

  window.addEventListener('mousemove', handleMouseMove);
  window.addEventListener('mouseup', handleMouseUp);
}

export function clearCards() {
  if (canvasContainer) canvasContainer.innerHTML = '';
  cards = [];
  nextId = 0;
  save();
}

export function loadCards(cardsList, nextVal) {
  clearCards();
  nextId = nextVal || 0;
  if (cardsList && cardsList.length) {
    cardsList.forEach(c => {
      cards.push(c);
      makeCardDOM(c);
    });
  }
}

function save() {
  if (onSaveCallback) onSaveCallback();
}

export function createNewCard(text, x, y, opts = {}) {
  const id = opts.id !== undefined ? opts.id : nextId++;
  const lang = opts.lang || ipc.detectLanguage(text);
  const showMd = opts.showMd !== undefined ? opts.showMd : (lang === 'markdown' || extensionManager.hasRenderer(lang));
  const w = opts.w || 400;
  const h = opts.h || null;
  const deckData = opts.deckData || null;
  const showWebview = opts.showWebview !== undefined ? opts.showWebview : false;

  const card = { id, text, x, y, w, h, lang, showMd, deckData, showWebview };
  if (opts.id === undefined) {
    cards.push(card);
  }

  makeCardDOM(card);
  save();
  return card;
}

function makeCardDOM(card) {
  const langStyle = extensionManager.getLanguageStyle(card.lang);
  const color = langStyle ? langStyle.color : (LANG_COLOR[card.lang] || LANG_COLOR.text);
  const label = langStyle ? langStyle.label : (LANG_LABEL[card.lang] || card.lang.slice(0, 4).toUpperCase());
  const lines = card.text.split('\n').length;

  const el = document.createElement('div');
  el.className = 'card';
  el.dataset.id = card.id;
  
  // Use GPU-accelerated transform
  el.style.transform = `translate3d(${card.x}px, ${card.y}px, 0)`;
  el.style.zIndex = ++zTop;
  el.style.width = card.w + 'px';

  // URL matching for embedded view option
  const urlRegexGlobal = /(https?:\/\/[^\s]+)/gi;
  const urls = card.text.match(urlRegexGlobal);
  let webviewUrl = null;
  if (urls && urls.length > 0) {
    webviewUrl = urls[0].replace(/[()]/g, '');
  }

  // Set default height if webview is shown and no height exists
  if (card.showWebview && !card.h) {
    card.h = 320;
  }
  if (card.h) el.style.height = card.h + 'px';

  // Toggle markdown buttons are shown for Markdown and custom extension renderer types
  const isToggleable = (card.lang === 'markdown' || extensionManager.hasRenderer(card.lang));
  const mdBtn = isToggleable
    ? `<button class="cbtn md-btn ${card.showMd ? 'on' : ''}" title="Toggle View Mode" aria-label="Toggle View Mode" aria-pressed="${card.showMd}">&lang;/&rang;</button>`
    : '';

  const colorRegex = /(#[0-9a-f]{3,6}|rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)|hsl\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*\))/gi;
  const hasColors = card.text.match(colorRegex);
  const dropperBtn = hasColors
    ? `<button class="cbtn dropper-btn" title="Extract Color Palette" aria-label="Extract Color Palette">🎨</button>`
    : '';

  const copyBtn = `<button class="cbtn copy-btn" title="Duplicate Card" aria-label="Duplicate Card">⎘</button>`;

  // Webview toggle button (standalone only)
  const showWebviewBtn = (webviewUrl && typeof window.api !== 'undefined');
  const webviewBtn = showWebviewBtn
    ? `<button class="cbtn webview-btn ${card.showWebview ? 'on' : ''}" title="Toggle Embed View" aria-label="Toggle Embed View">🌐</button>`
    : '';

  // Header and resizers
  el.innerHTML = `
    <div class="card-hd">
      <span class="badge" style="background:${color}; color:#000;">${label}</span>
      <span class="card-meta">${lines} line${lines !== 1 ? 's' : ''}</span>
      ${webviewBtn}
      ${mdBtn}
      ${dropperBtn}
      ${copyBtn}
      <button class="cbtn export-btn" title="Export Card" aria-label="Export Card">💾</button>
      <button class="cbtn edit-btn" title="Edit Card" aria-label="Edit Card">&#9998;</button>
      <button class="cbtn x-btn" title="Delete Card" aria-label="Delete Card">&#x2715;</button>
    </div>
    <div class="card-bd"></div>
    <div class="resizer n"></div>
    <div class="resizer s"></div>
    <div class="resizer e"></div>
    <div class="resizer w"></div>
    <div class="resizer nw"></div>
    <div class="resizer ne"></div>
    <div class="resizer sw"></div>
    <div class="resizer se"></div>
  `;

  canvasContainer.appendChild(el);
  renderCardBodyContent(el, card);
  wireCardEvents(el, card);
}

function renderCardBodyContent(el, card) {
  const bd = el.querySelector('.card-bd');
  if (!bd) return;

  if (card.showWebview && typeof window.api !== 'undefined') {
    const urlRegexGlobal = /(https?:\/\/[^\s]+)/gi;
    const urls = card.text.match(urlRegexGlobal);
    let webviewUrl = '';
    if (urls && urls.length > 0) {
      webviewUrl = urls[0].replace(/[()]/g, '');
    }

    bd.innerHTML = `
      <div class="webview-controls" style="display:flex; gap:6px; padding:4px; border-bottom:1px solid var(--border); background:rgba(0,0,0,0.2); align-items:center;">
        <button class="cbtn wv-back" title="Back" style="font-size:10px; width:20px; height:20px; padding:0; flex-shrink:0; cursor:pointer;">◀</button>
        <button class="cbtn wv-forward" title="Forward" style="font-size:10px; width:20px; height:20px; padding:0; flex-shrink:0; cursor:pointer;">▶</button>
        <button class="cbtn wv-reload" title="Reload" style="font-size:10px; width:20px; height:20px; padding:0; flex-shrink:0; cursor:pointer;">↻</button>
        <input type="text" class="wv-url" value="${webviewUrl}" readonly style="flex:1; font-size:10px; height:18px; padding:2px 6px; border:1px solid var(--border); background:rgba(0,0,0,0.4); color:var(--text); outline:none; border-radius:3px;">
        <button class="cbtn wv-open" title="Open in browser" style="font-size:10px; width:20px; height:20px; padding:0; flex-shrink:0; cursor:pointer;">🌐</button>
      </div>
      <webview src="${webviewUrl}" style="width:100%; height:calc(100% - 28px); min-height:220px; background:#fff;" allowpopups></webview>
    `;

    const wv = bd.querySelector('webview');
    const btnBack = bd.querySelector('.wv-back');
    const btnForward = bd.querySelector('.wv-forward');
    const btnReload = bd.querySelector('.wv-reload');
    const btnOpen = bd.querySelector('.wv-open');
    const inputUrl = bd.querySelector('.wv-url');

    if (wv) {
      btnBack.addEventListener('click', () => { if (typeof wv.canGoBack === 'function' && wv.canGoBack()) wv.goBack(); });
      btnForward.addEventListener('click', () => { if (typeof wv.canGoForward === 'function' && wv.canGoForward()) wv.goForward(); });
      btnReload.addEventListener('click', () => wv.reload());
      btnOpen.addEventListener('click', () => { ipc.openExternal(inputUrl.value || webviewUrl); });

      wv.addEventListener('did-navigate', (e) => { inputUrl.value = e.url; });
      wv.addEventListener('did-navigate-in-page', (e) => { inputUrl.value = e.url; });
    }
  } else if (card.showMd && extensionManager.hasRenderer(card.lang)) {
    bd.innerHTML = extensionManager.render(card.lang, card);
  } else {
    bd.innerHTML = ipc.renderCardBody(card.text, card.lang, card.showMd);
    if (card.showMd && card.lang === 'markdown') {
      runMermaid(bd);
    }
  }
}

function deleteCard(id) {
  cards = cards.filter(c => c.id !== id);
  save();
}

function wireCardEvents(el, card) {
  const hd = el.querySelector('.card-hd');
  const bd = el.querySelector('.card-bd');
  const xBtn = el.querySelector('.x-btn');
  const editBtn = el.querySelector('.edit-btn');
  const mdBtn = el.querySelector('.md-btn');
  const exportBtn = el.querySelector('.export-btn');
  const copyBtn = el.querySelector('.copy-btn');
  const dropperBtn = el.querySelector('.dropper-btn');
  let editing = false;

  // Intercept mousedown in Chainsaw Mode
  el.addEventListener('mousedown', e => {
    if (window.mdwayChainsawMode) {
      e.stopPropagation();
      e.preventDefault();
      el.remove();
      deleteCard(card.id);
    }
  }, true);

  el.addEventListener('mousedown', () => {
    el.style.zIndex = ++zTop;
  }, true);

  // Bind resizers
  el.querySelectorAll('.resizer').forEach(r => {
    r.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      e.stopPropagation();
      e.preventDefault();

      const classes = r.classList;
      const dir = {
        top:    classes.contains('n') || classes.contains('nw') || classes.contains('ne'),
        bottom: classes.contains('s') || classes.contains('sw') || classes.contains('se'),
        left:   classes.contains('w') || classes.contains('nw') || classes.contains('sw'),
        right:  classes.contains('e') || classes.contains('ne') || classes.contains('se')
      };

      resizeState = {
        el,
        bd,
        card,
        dir,
        sx: e.clientX,
        sy: e.clientY,
        sw: el.offsetWidth,
        sh: el.offsetHeight,
        sl: card.x,
        st: card.y,
        aspect: el.offsetWidth / el.offsetHeight
      };
    });
  });

  // Handle scroll bubbles
  bd.addEventListener('wheel', e => {
    const transform = getTransform();
    const isZoomActive = (transform.zoom === 'Shift' && e.shiftKey) || 
                         (transform.zoom === 'Ctrl' && e.ctrlKey) || 
                         (transform.zoom === 'Alt' && e.altKey);
    const isPanActive = (transform.hpan === 'Ctrl' && e.ctrlKey) || 
                        (transform.hpan === 'Shift' && e.shiftKey) || 
                        (transform.hpan === 'Alt' && e.altKey);

    if (isZoomActive || isPanActive) {
      // allow scroll to bubble to viewport
    } else {
      e.stopPropagation();
    }
  });

  // Handle card body dragging specifically for SVG & Color cards
  if (card.lang === 'svg' || card.lang === 'color-code' || card.lang === 'color-palette') {
    bd.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      const interactive = e.target.closest('input, button, a, select, textarea');
      if (interactive) {
        e.stopPropagation();
        return;
      }
      dragState = { card, el, sx: e.clientX, sy: e.clientY, cx: card.x, cy: card.y };
      e.stopPropagation();
      e.preventDefault();
    });
  } else {
    bd.addEventListener('mousedown', e => e.stopPropagation());
  }

  // Delete Card
  xBtn.addEventListener('click', e => {
    e.stopPropagation();
    el.remove();
    deleteCard(card.id);
  });

  // Copy / Duplicate Card
  if (copyBtn) {
    copyBtn.addEventListener('click', e => {
      e.stopPropagation();
      navigator.clipboard.writeText(card.text).catch(() => {});
      createNewCard(card.text, card.x + 30, card.y + 30, {
        lang: card.lang,
        showMd: card.showMd,
        w: card.w,
        h: card.h,
        deckData: card.deckData,
        showWebview: card.showWebview
      });
    });
  }

  // Webview Toggle Click
  const webviewBtn = el.querySelector('.webview-btn');
  if (webviewBtn) {
    webviewBtn.addEventListener('click', e => {
      e.stopPropagation();
      card.showWebview = !card.showWebview;
      webviewBtn.classList.toggle('on', card.showWebview);

      if (card.showWebview && !card.h) {
        card.h = 320;
        el.style.height = '320px';
      }

      renderCardBodyContent(el, card);
      save();
    });
  }

  // Prevent link navigation hijacking in standalone mode
  el.addEventListener('click', e => {
    const a = e.target.closest('a');
    if (a && a.href) {
      e.preventDefault();
      if (a.href.startsWith('http://') || a.href.startsWith('https://')) {
        ipc.openExternal(a.href);
      }
    }
  });

  // Eyedropper Color Extractor Card
  if (dropperBtn) {
    const colorRegex = /(#[0-9a-f]{3,6}|rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)|hsl\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*\))/gi;
    dropperBtn.addEventListener('click', e => {
      e.stopPropagation();
      const colors = card.text.match(colorRegex);
      if (colors && colors.length > 0) {
        const uniqueColors = [...new Set(colors.map(c => c.trim()))];
        const paletteText = uniqueColors.join('\n');
        
        createNewCard(paletteText, card.x + card.w + 24, card.y, {
          lang: 'color-palette',
          showMd: true,
          w: 240,
          h: 300
        });
      }
    });
  }

  // Export Card
  if (exportBtn) {
    exportBtn.addEventListener('click', async e => {
      e.stopPropagation();
      
      const ext = EXT_MAP[card.lang] || 'txt';
      const headingMatch = card.text.match(/^#+\s+(.+)$/m);
      let baseName = headingMatch ? headingMatch[1].trim() : `card-${card.id}`;
      baseName = baseName.replace(/[^a-zA-Z0-9_\-]/g, '_').substring(0, 30).trim();
      if (!baseName) {
        baseName = `card-${card.id}`;
      }
      const defaultFilename = `${baseName}.${ext}`;

      const userFilename = prompt("Export Card - Confirm filename and type:", defaultFilename);
      if (userFilename === null) return; // User cancelled

      let finalFilename = userFilename.trim();
      if (!finalFilename) return;

      const dotIndex = finalFilename.lastIndexOf('.');
      let enteredExt = ext;
      if (dotIndex === -1) {
        finalFilename = `${finalFilename}.${ext}`;
      } else {
        enteredExt = finalFilename.substring(dotIndex + 1);
      }

      const label = LANG_LABEL[card.lang] || card.lang.toUpperCase();
      const filters = [
        { name: `${label} Files (*.${enteredExt})`, extensions: [enteredExt] },
        { name: 'All Files (*.*)', extensions: ['*'] }
      ];

      const res = await ipc.exportFile(card.text, finalFilename, filters);
      if (res && res.success) {
        console.log('Card exported to:', res.filePath);
      }
    });
  }

  // Edit/Save Card Text
  editBtn.addEventListener('click', e => {
    e.stopPropagation();
    if (editing) {
      const ta = bd.querySelector('textarea');
      if (ta) {
        card.text = ta.value;
        
        const prevLang = card.lang;
        card.lang = ipc.detectLanguage(card.text);
        card.showMd = (card.lang === 'markdown' || extensionManager.hasRenderer(card.lang));
        
        // If it is no longer custom rendered, clear deckData
        if (!extensionManager.hasRenderer(card.lang) && extensionManager.hasRenderer(prevLang)) {
          card.deckData = null;
        }

        renderCardBodyContent(el, card);
        extensionManager.runPostRender(el, card, { createNewCard });

        const langStyle = extensionManager.getLanguageStyle(card.lang);
        const b = el.querySelector('.badge');
        b.textContent = langStyle ? langStyle.label : (LANG_LABEL[card.lang] || card.lang.slice(0, 4).toUpperCase());
        b.style.background = langStyle ? langStyle.color : (LANG_COLOR[card.lang] || LANG_COLOR.text);
        
        const linesCount = card.text.split('\n').length;
        el.querySelector('.card-meta').textContent = `${linesCount} line${linesCount !== 1 ? 's' : ''}`;
        
        save();
      }
      editing = false;
      editBtn.innerHTML = '&#9998;';
      editBtn.title = 'Edit Card';
      editBtn.setAttribute('aria-label', 'Edit Card');
    } else {
      bd.innerHTML = `<textarea spellcheck="false">${ipc.escapeHtml(card.text)}</textarea>`;
      const ta = bd.querySelector('textarea');
      ta.addEventListener('mousedown', e => e.stopPropagation());
      ta.addEventListener('wheel', e => e.stopPropagation(), { passive: true });
      ta.focus();
      editing = true;
      editBtn.innerHTML = '&#10003;';
      editBtn.title = 'Save Changes';
      editBtn.setAttribute('aria-label', 'Save Changes');
    }
  });

  bd.addEventListener('dblclick', () => {
    if (!editing) editBtn.click();
  });

  // Toggle Render/Source Button
  if (mdBtn) {
    mdBtn.addEventListener('click', e => {
      e.stopPropagation();
      card.showMd = !card.showMd;
      mdBtn.classList.toggle('on', card.showMd);
      mdBtn.setAttribute('aria-pressed', card.showMd);
      renderCardBodyContent(el, card);
      extensionManager.runPostRender(el, card, { createNewCard });
      save();
    });
  }

  // Bind drag header
  hd.addEventListener('mousedown', e => {
    if (e.button !== 0 || e.target.classList.contains('cbtn')) return;
    dragState = { card, el, sx: e.clientX, sy: e.clientY, cx: card.x, cy: card.y };
    e.stopPropagation();
    e.preventDefault();
  });

  // Initial trigger wiring for extensions
  extensionManager.runPostRender(el, card, { createNewCard });
}

function runMermaid(container) {
  if (typeof window.mermaid === 'undefined') return;
  const nodes = [...container.querySelectorAll('.mermaid:not([data-rendered])')];
  if (!nodes.length) return;
  nodes.forEach(n => n.setAttribute('data-rendered', '1'));

  const p = typeof window.mermaid.run === 'function'
    ? window.mermaid.run({ nodes })
    : Promise.resolve(window.mermaid.init(undefined, nodes));

  if (p && typeof p.catch === 'function') {
    p.catch(err => {
      if (!nodes[0].querySelector('svg')) {
        nodes[0].innerHTML = `<div class="mermaid-err">Parse error — ${ipc.escapeHtml(String(err))}</div>`;
      }
    });
  }
}

function handleMouseMove(e) {
  const transform = getTransform();

  // Card Drag Move
  if (dragState) {
    const dx = (e.clientX - dragState.sx) / transform.scale;
    const dy = (e.clientY - dragState.sy) / transform.scale;

    dragState.card.x = dragState.cx + dx;
    dragState.card.y = dragState.cy + dy;

    dragState.el.style.transform = `translate3d(${dragState.card.x}px, ${dragState.card.y}px, 0)`;
  }

  // Card Resizer
  if (resizeState) {
    const r = resizeState;
    const dx = (e.clientX - r.sx) / transform.scale;
    const dy = (e.clientY - r.sy) / transform.scale;

    let w = r.sw;
    let h = r.sh;
    let l = r.sl;
    let t = r.st;

    // Proposed dimensions
    let proposedW = r.sw;
    if (r.dir.right) {
      proposedW = r.sw + (e.altKey ? dx * 2 : dx);
    } else if (r.dir.left) {
      proposedW = r.sw - (e.altKey ? dx * 2 : dx);
    }

    let proposedH = r.sh;
    if (r.dir.bottom) {
      proposedH = r.sh + (e.altKey ? dy * 2 : dy);
    } else if (r.dir.top) {
      proposedH = r.sh - (e.altKey ? dy * 2 : dy);
    }

    // Photoshop Shift Aspect Constraint
    if (e.shiftKey) {
      const aspect = r.aspect;
      if ((r.dir.left || r.dir.right) && (r.dir.top || r.dir.bottom)) {
        const scaleX = proposedW / r.sw;
        const scaleY = proposedH / r.sh;
        const scaleVal = (Math.abs(dx) / r.sw > Math.abs(dy) / r.sh) ? scaleX : scaleY;
        w = r.sw * scaleVal;
        h = r.sh * scaleVal;
      } else if (r.dir.left || r.dir.right) {
        w = proposedW;
        h = w / aspect;
      } else if (r.dir.top || r.dir.bottom) {
        h = proposedH;
        w = h * aspect;
      }
    } else {
      w = proposedW;
      h = proposedH;
    }

    // Minimum Bounds
    const minW = 180;
    const minH = 60;
    if (w < minW) {
      w = minW;
      if (e.shiftKey) h = w / r.aspect;
    }
    if (h < minH) {
      h = minH;
      if (e.shiftKey) w = h * r.aspect;
    }

    // Alt key scales from center
    if (e.altKey) {
      l = r.sl - (w - r.sw) / 2;
      t = r.st - (h - r.sh) / 2;
    } else {
      if (r.dir.left) l = r.sl + (r.sw - w);
      if (r.dir.top)  t = r.st + (r.sh - h);
    }

    r.el.style.width = w + 'px';
    r.el.style.height = h + 'px';
    r.el.style.transform = `translate3d(${l}px, ${t}px, 0)`;

    r.card.w = w;
    r.card.h = h;
    r.card.x = l;
    r.card.y = t;
  }
}

function handleMouseUp(e) {
  if (dragState) {
    dragState = null;
    save();
  }
  if (resizeState) {
    resizeState = null;
    save();
  }
}
