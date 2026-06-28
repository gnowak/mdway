'use strict';
const { ipcRenderer } = require('electron');
const hljs   = require('highlight.js');
const { marked } = require('marked');

// marked: basic options only (no renderer override — we post-process instead)
marked.use({ gfm: true, breaks: true });

// ── Canvas state ──
const viewport = document.getElementById('viewport');
const canvas   = document.getElementById('canvas');
let panX = 0, panY = 0, scale = 1, panning = false, panStart = { x: 0, y: 0 };
const MIN_SCALE = 0.15, MAX_SCALE = 3;
let dragState = null, resizeState = null, zTop = 10;

function applyPan() {
  canvas.style.transformOrigin = '0 0';
  canvas.style.transform = 'translate(' + panX + 'px,' + panY + 'px) scale(' + scale + ')';
  const gs = Math.round(26 * scale);
  viewport.style.backgroundSize = gs + 'px ' + gs + 'px';
  viewport.style.backgroundPosition = (panX % gs) + 'px ' + (panY % gs) + 'px';
}

// ── Canvas pan ──
viewport.addEventListener('mousedown', e => {
  if (e.target !== viewport && e.target !== canvas) return;
  panning = true;
  panStart = { x: e.clientX - panX, y: e.clientY - panY };
  viewport.style.cursor = 'grabbing';
  e.preventDefault();
});
viewport.addEventListener('wheel', e => {
  e.preventDefault();
  if (e.shiftKey) {
    // Zoom toward cursor
    const factor = e.deltaY > 0 ? 0.92 : 1.08;
    const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale * factor));
    const rect = viewport.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    panX = mx - (mx - panX) * (newScale / scale);
    panY = my - (my - panY) * (newScale / scale);
    scale = newScale;
  } else if (e.ctrlKey) {
    // Horizontal scroll
    panX -= e.deltaY;
  } else {
    panX -= e.deltaX;
    panY -= e.deltaY;
  }
  applyPan();
}, { passive: false });
window.addEventListener('mousemove', e => {
  if (panning) { panX = e.clientX - panStart.x; panY = e.clientY - panStart.y; applyPan(); }
  if (dragState) {
    dragState.card.x = dragState.cx + (e.clientX - dragState.sx);
    dragState.card.y = dragState.cy + (e.clientY - dragState.sy);
    dragState.el.style.left = dragState.card.x + 'px';
    dragState.el.style.top  = dragState.card.y + 'px';
  }
  if (resizeState) {
    const w = Math.max(180, resizeState.sw + (e.clientX - resizeState.sx));
    const h = Math.max(60,  resizeState.sh + (e.clientY - resizeState.sy));
    resizeState.el.style.width = w + 'px';
    resizeState.bd.style.maxHeight = Math.max(40, h - 36) + 'px';
  }
});
window.addEventListener('mouseup', () => {
  if (panning)     { panning = false; viewport.style.cursor = 'default'; }
  if (dragState)   { dragState   = null; save(); }
  if (resizeState) { resizeState = null; save(); }
});

// ── Language maps ──
const LANG_COLOR = {
  javascript:'#f7df1e', typescript:'#3178c6', python:'#4b8bbe',
  bash:'#4eaa25', shell:'#4eaa25', css:'#264de4', html:'#e34c26',
  xml:'#f60', json:'#5b8dd9', yaml:'#cb171e', rust:'#dea584',
  go:'#00add8', java:'#ed8b00', c:'#a8b9cc', cpp:'#00599c',
  csharp:'#9b4f96', ruby:'#cc342d', sql:'#e38c00',
  markdown:'#a78bfa', text:'#55526b'
};
const LANG_LABEL = {
  javascript:'JS', typescript:'TS', python:'PY', bash:'SH', shell:'SH',
  css:'CSS', html:'HTML', xml:'XML', json:'JSON', yaml:'YAML',
  rust:'RS', go:'GO', java:'JAVA', c:'C', cpp:'C++', csharp:'C#',
  ruby:'RB', sql:'SQL', markdown:'MD', text:'TXT'
};
const DETECT = ['javascript','typescript','python','bash','css','html','xml',
  'json','yaml','rust','go','java','c','cpp','csharp','ruby','sql'];
const MD_RE = [/^#{1,6}\s/m, /\*\*[^*]+\*\*/, /\[.+\]\(.+\)/, /^[-*+]\s/m, /^>\s/m, /```/, /^---$/m];

function detectLang(t) {
  if (MD_RE.filter(r => r.test(t)).length >= 2) return 'markdown';
  try { return hljs.highlightAuto(t, DETECT).language || 'text'; } catch { return 'text'; }
}
function esc(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function unesc(s) {
  return String(s)
    .replace(/&lt;/g,'<').replace(/&gt;/g,'>')
    .replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'");
}

// ── Markdown rendering (post-process for mermaid + hljs) ──
function renderMarkdown(text) {
  // 1. Parse with marked — produces <pre><code class="language-X">...</code></pre>
  let html = marked.parse(text);

  // 2. Post-process code blocks
  html = html.replace(
    /<pre><code(?:\s+class="([^"]*)")?>([\s\S]*?)<\/code><\/pre>/gi,
    (match, cls, encoded) => {
      // Extract language from class like "language-mermaid"
      const lang = cls ? cls.replace(/^language-/, '') : '';
      const raw  = unesc(encoded);          // ← decode HTML entities

      if (lang === 'mermaid') {
        // Wrap in mermaid div — mermaid.run() will render it
        return '<div class="mermaid-wrap"><div class="mermaid">' + raw + '</div></div>';
      }

      // Re-highlight code blocks with hljs
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
  } catch { return '<pre><code class="hljs">' + esc(text) + '</code></pre>'; }
}

// ── Mermaid rendering ──
function runMermaid(container) {
  if (typeof mermaid === 'undefined') return;
  const nodes = [...container.querySelectorAll('.mermaid:not([data-rendered])')];
  if (!nodes.length) return;
  nodes.forEach(n => n.setAttribute('data-rendered', '1'));

  // mermaid v10+: mermaid.run({ nodes })
  // mermaid v9:   mermaid.init(config, nodes)
  const p = typeof mermaid.run === 'function'
    ? mermaid.run({ nodes })
    : Promise.resolve(mermaid.init(undefined, nodes));

  if (p && typeof p.catch === 'function') {
    p.catch(err => {
      nodes.forEach(n => {
        if (!n.querySelector('svg'))
          n.innerHTML = '<div class="mermaid-err">Parse error — ' + esc(String(err)) + '</div>';
      });
    });
  }
}

// ── Cards ──
let cards = [], nextId = 0;

function makeCard(text, x, y, opts) {
  opts = opts || {};
  const id     = (opts.id !== undefined) ? opts.id : nextId++;
  const lang   = opts.lang   || detectLang(text);
  const showMd = (opts.showMd !== undefined) ? opts.showMd : (lang === 'markdown');
  const card   = { id, text, x, y, lang, showMd };
  if (opts.id === undefined) cards.push(card);

  const color = LANG_COLOR[lang] || LANG_COLOR.text;
  const label = LANG_LABEL[lang] || lang.slice(0, 4).toUpperCase();
  const lines = text.split('\n').length;

  const el = document.createElement('div');
  el.className  = 'card';
  el.style.cssText = 'left:' + x + 'px;top:' + y + 'px;z-index:' + (++zTop);

  const mdBtn = (lang === 'markdown')
    ? '<button class="cbtn md-btn' + (showMd ? ' on' : '') + '">&lang;/&rang;</button>'
    : '';

  el.innerHTML =
    '<div class="card-hd">'
    + '<span class="badge" style="background:' + color + '">' + label + '</span>'
    + '<span class="card-meta">' + lines + ' line' + (lines !== 1 ? 's' : '') + '</span>'
    + mdBtn
    + '<button class="cbtn edit-btn">&#9998;</button>'
    + '<button class="cbtn x-btn">&#x2715;</button>'
    + '</div>'
    + '<div class="card-bd">' + renderBody(text, lang, showMd) + '</div>'
    + '<div class="rh"></div>';

  canvas.appendChild(el);
  const bd = el.querySelector('.card-bd');
  if (showMd) runMermaid(bd);
  wire(el, card);
  return el;
}

function wire(el, card) {
  const hd      = el.querySelector('.card-hd');
  const bd      = el.querySelector('.card-bd');
  const xBtn    = el.querySelector('.x-btn');
  const editBtn = el.querySelector('.edit-btn');
  const mdBtn   = el.querySelector('.md-btn');
  const rh      = el.querySelector('.rh');
  let editing   = false;

  el.addEventListener('mousedown', () => { el.style.zIndex = ++zTop; }, true);

  // Scroll inside card — don't propagate to canvas pan
  bd.addEventListener('wheel',     e => e.stopPropagation(), { passive: true });
  bd.addEventListener('mousedown', e => e.stopPropagation());

  xBtn.addEventListener('click', e => {
    e.stopPropagation();
    el.remove();
    cards = cards.filter(c => c.id !== card.id);
    save();
  });

  editBtn.addEventListener('click', e => {
    e.stopPropagation();
    if (editing) {
      const ta = bd.querySelector('textarea');
      if (ta) {
        card.text   = ta.value;
        card.lang   = detectLang(card.text);
        card.showMd = (card.lang === 'markdown');
        bd.innerHTML = renderBody(card.text, card.lang, card.showMd);
        if (card.showMd) runMermaid(bd);
        const b = el.querySelector('.badge');
        b.textContent  = LANG_LABEL[card.lang] || card.lang.slice(0, 4).toUpperCase();
        b.style.background = LANG_COLOR[card.lang] || LANG_COLOR.text;
        save();
      }
      editing = false;
      editBtn.innerHTML = '&#9998;';
    } else {
      bd.innerHTML = '<textarea spellcheck="false">' + esc(card.text) + '</textarea>';
      const ta = bd.querySelector('textarea');
      ta.addEventListener('mousedown', e => e.stopPropagation());
      ta.addEventListener('wheel',     e => e.stopPropagation(), { passive: true });
      ta.focus();
      editing = true;
      editBtn.innerHTML = '&#10003;';
    }
  });

  bd.addEventListener('dblclick', () => { if (!editing) editBtn.click(); });

  if (mdBtn) {
    mdBtn.addEventListener('click', e => {
      e.stopPropagation();
      card.showMd = !card.showMd;
      mdBtn.classList.toggle('on', card.showMd);
      bd.innerHTML = renderBody(card.text, card.lang, card.showMd);
      if (card.showMd) runMermaid(bd);
      save();
    });
  }

  hd.addEventListener('mousedown', e => {
    if (e.button !== 0 || e.target.classList.contains('cbtn')) return;
    dragState = { card, el, sx: e.clientX, sy: e.clientY, cx: card.x, cy: card.y };
    e.stopPropagation();
  });

  rh.addEventListener('mousedown', e => {
    e.stopPropagation();
    resizeState = { el, bd, sx: e.clientX, sy: e.clientY, sw: el.offsetWidth, sh: el.offsetHeight };
  });
}

// ── Paste → new card ──
document.addEventListener('paste', e => {
  const text = ((e.clipboardData || window.clipboardData).getData('text') || '').trim();
  if (!text) return;
  const vw = viewport.getBoundingClientRect();
  const j  = () => (Math.random() - 0.5) * 50;
  const x  = vw.width  / 2 - panX - 200 + j();
  const y  = vw.height / 2 - panY -  80 + j();
  const el = makeCard(text, x, y);
  el.style.cssText += ';opacity:0;transform:scale(0.88) translateY(6px);transition:opacity .2s,transform .2s';
  requestAnimationFrame(() => { el.style.opacity = '1'; el.style.transform = 'scale(1) translateY(0)'; });
  document.getElementById('hint').classList.add('gone');
  save();
});

// ── Titlebar ──
document.getElementById('btn-close').addEventListener('click', () => ipcRenderer.send('close'));
document.getElementById('btn-min').addEventListener('click',   () => ipcRenderer.send('minimize'));

let pinned = true;
document.getElementById('btn-pin').addEventListener('click', () => {
  pinned = !pinned;
  const b = document.getElementById('btn-pin');
  b.innerHTML = pinned ? '&#128204; pinned' : '&#128204; float';
  b.classList.toggle('on', pinned);
  ipcRenderer.send('pin', pinned);
});

document.getElementById('btn-clear').addEventListener('click', () => {
  canvas.innerHTML = '';
  cards = []; nextId = 0;
  save();
  document.getElementById('hint').classList.remove('gone');
});

// Spacebar → reset pan + zoom to home
document.addEventListener('keydown', e => {
  if (e.code !== 'Space') return;
  if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
  e.preventDefault();
  panX = 0; panY = 0; scale = 1;
  applyPan();
});

// ── Persist ──
function save() {
  try { localStorage.setItem('mdway', JSON.stringify({ cards, nextId })); } catch (e) {}
}

function load() {
  try {
    const d = JSON.parse(localStorage.getItem('mdway') || 'null');
    if (d && d.cards && d.cards.length) {
      nextId = d.nextId || d.cards.length;
      d.cards.forEach(c => {
        cards.push(c);
        makeCard(c.text, c.x, c.y, { id: c.id, lang: c.lang, showMd: c.showMd });
      });
      document.getElementById('hint').classList.add('gone');
      return;
    }
  } catch (e) {}
  // Welcome card
  makeCard(
    '# MDway\n\nPaste code or markdown anywhere.\n\n'
    + '- **Ctrl+V** \u2014 drop a new card\n'
    + '- Drag **header** to move\n'
    + '- **Scroll** inside a card to read\n'
    + '- **Double-click** body to edit\n'
    + '- **\u27e8/\u27e9** toggles markdown render\n'
    + '- **Ctrl+Shift+I** \u2014 DevTools\n'
    + '- **\uD83D\uDCCC pinned** keeps this above all windows',
    50, 20, { lang: 'markdown', showMd: true }
  );
}

applyPan();
load();
