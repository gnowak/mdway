// renderer.js - Shared Main Application Coordinator
// Initializes modules, binds global listeners, handles paste actions & settings

import { ipc } from 'ipc';
import { 
  initCanvas, 
  getCanvasCenter, 
  getTransform, 
  setTransform,
  screenToCanvas, 
  hotkeys, 
  updateHotkeys 
} from './canvas.js';
import { 
  initCards, 
  cards, 
  nextId, 
  createNewCard, 
  loadCards, 
  clearCards 
} from './card.js';
import { extensionManager } from 'extension-manager';

const canvasEl = document.getElementById('canvas');
const viewportEl = document.getElementById('viewport');

// --- Initialization ---
function init() {
  // 1. Initialize canvas transforms
  initCanvas(viewportEl, canvasEl, () => {
    // Canvas transform callback
  });

  // 2. Initialize card manager
  initCards(canvasEl, saveState);

  // 3. Bind window control clicks
  setupWindowControls();

  // 4. Bind file operations
  setupFileOperations();

  // 5. Bind hotkeys and settings modal
  setupSettingsModal();

  // 6. Bind paste handler
  setupPasteHandler();

  // 7. Load initial canvas layout
  loadInitialState();
}

// --- Window Controls ---
function setupWindowControls() {
  const closeBtn = document.getElementById('btn-close');
  const minBtn = document.getElementById('btn-min');
  const pinBtn = document.getElementById('btn-pin');

  if (closeBtn) closeBtn.addEventListener('click', () => ipc.close());
  if (minBtn) minBtn.addEventListener('click', () => ipc.minimize());

  // Float/pin state management
  if (pinBtn) {
    let pinned = true;
    try {
      const savedPin = localStorage.getItem('mdway-pinned');
      if (savedPin !== null) {
        pinned = JSON.parse(savedPin);
      }
    } catch (e) {}

    const syncPinState = () => {
      pinBtn.innerHTML = pinned ? '&#128204; pinned' : '&#128204; float';
      pinBtn.classList.toggle('on', pinned);
      ipc.setPin(pinned);
    };
    syncPinState();

    pinBtn.addEventListener('click', () => {
      pinned = !pinned;
      syncPinState();
      try {
        localStorage.setItem('mdway-pinned', JSON.stringify(pinned));
      } catch (e) {}
    });
  }
}

// --- File Operations ---
function setupFileOperations() {
  // Clear Workspace
  document.getElementById('btn-clear').addEventListener('click', () => {
    if (confirm('Are you sure you want to clear all cards?')) {
      clearCards();
      document.getElementById('hint').classList.remove('gone');
    }
  });

  // Save Canvas File
  document.getElementById('btn-save').addEventListener('click', async () => {
    const state = {
      cards: cards,
      nextId: nextId,
      transform: getTransform()
    };
    const res = await ipc.saveCanvas(state);
    if (res && res.success) {
      console.log('Saved to file:', res.filePath);
    }
  });

  // Open Canvas File
  document.getElementById('btn-open').addEventListener('click', async () => {
    const res = await ipc.loadCanvas();
    if (res && res.success && res.data) {
      loadCards(res.data.cards, res.data.nextId);
      if (res.data.transform) {
        const { panX, panY, scale } = res.data.transform;
        setTransform(panX, panY, scale);
      }
      document.getElementById('hint').classList.add('gone');
    }
  });

  // Global Keyboard Shortcuts (Ctrl+O / Ctrl+S)
  document.addEventListener('keydown', e => {
    // Only capture when inputs are not focused
    if (document.activeElement && 
        (document.activeElement.tagName === 'TEXTAREA' || document.activeElement.tagName === 'INPUT')) {
      return;
    }

    if (e.ctrlKey && e.key.toLowerCase() === 's') {
      e.preventDefault();
      document.getElementById('btn-save').click();
    }
    if (e.ctrlKey && e.key.toLowerCase() === 'o') {
      e.preventDefault();
      document.getElementById('btn-open').click();
    }
  });
}

// --- Paste Handler & Scraping ---
function setupPasteHandler() {
  document.addEventListener('paste', async e => {
    // Skip if typing inside a textarea/input
    if (document.activeElement && 
        (document.activeElement.tagName === 'TEXTAREA' || document.activeElement.tagName === 'INPUT')) {
      return;
    }

    // 1. Check for images in clipboard
    const items = (e.clipboardData || window.clipboardData).items;
    let hasImage = false;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        hasImage = true;
        
        const file = items[i].getAsFile();
        const reader = new FileReader();
        reader.onload = function() {
          const base64Data = this.result; // Data URL format
          const text = `![Pasted Image](${base64Data})`;
          const center = getCanvasCenter();
          const j = () => (Math.random() - 0.5) * 50;
          const x = center.x - 200 + j();
          const y = center.y - 120 + j();

          const el = createNewCard(text, x, y, { lang: 'markdown', showMd: true });
          animateCardSpawn(el);
          document.getElementById('hint').classList.add('gone');
        };
        reader.readAsDataURL(file);
        break;
      }
    }

    if (hasImage) return;

    // 2. Parse text pastes
    const text = ((e.clipboardData || window.clipboardData).getData('text') || '').trim();
    if (!text) return;

    const center = getCanvasCenter();
    const j = () => (Math.random() - 0.5) * 50;
    const x = center.x - 200 + j();
    const y = center.y - 80 + j();

    // A. Intercept paste with extensions first
    const handled = await extensionManager.handlePaste(text, {
      center,
      createNewCard,
      saveState,
      animateCardSpawn
    });
    if (handled) return;

    // B. Check if the pasted text is a URL
    const urlRegex = /^(https?:\/\/[^\s]+)$/i;
    if (urlRegex.test(text)) {
      // Create a markdown card with a loading notice
      const placeholderText = `# Loading link...\n[${text}](${text})`;
      const card = createNewCard(placeholderText, x, y, { lang: 'markdown', showMd: true });
      
      const el = document.querySelector(`.card[data-id="${card.id}"]`);
      if (el) animateCardSpawn(el);
      document.getElementById('hint').classList.add('gone');

      // Fetch metadata from scraper
      ipc.fetchLinkMetadata(text).then(meta => {
        let content;
        if (meta && meta.success) {
          content = `# [${meta.title}](${meta.url})\n\n`;
          if (meta.description) {
            content += `> ${meta.description}\n\n`;
          }
          if (meta.image) {
            content += `![Preview Image](${meta.image})\n`;
          }
        } else {
          content = `# [Link](${text})\n\n*(Could not load page preview metadata)*`;
        }

        // Update card parameters
        card.text = content;
        card.lang = 'markdown';
        card.showMd = true;

        // Re-render card body
        if (el) {
          const bd = el.querySelector('.card-bd');
          bd.innerHTML = ipc.renderCardBody(card.text, card.lang, card.showMd);

          const badge = el.querySelector('.badge');
          badge.textContent = 'MD';
          badge.style.background = '#a78bfa';

          const lines = card.text.split('\n').length;
          el.querySelector('.card-meta').textContent = `${lines} line${lines !== 1 ? 's' : ''}`;
          
          // Re-render mermaid diagrams if any found in response
          const mermaidNodes = bd.querySelectorAll('.mermaid');
          if (mermaidNodes.length && typeof window.mermaid !== 'undefined') {
            mermaidNodes.forEach(n => n.setAttribute('data-rendered', '1'));
            try {
              window.mermaid.run({ nodes: [...mermaidNodes] });
            } catch (_) {}
          }
        }
        saveState();
      });
    } else {
      // Normal text/code card creation
      const el = createNewCard(text, x, y);
      animateCardSpawn(el);
      document.getElementById('hint').classList.add('gone');
    }
  });
}

function animateCardSpawn(el) {
  if (!el) return;
  el.style.cssText += ';opacity:0;transform:scale(0.88) translateY(6px);transition:opacity .2s,transform .2s';
  requestAnimationFrame(() => {
    el.style.opacity = '1';
    el.style.transform = el.style.transform.replace('scale(0.88) translateY(6px)', '').trim();
  });
}

// --- Settings Modal ---
function setupSettingsModal() {
  const settingsOverlay = document.getElementById('settings-overlay');
  const btnSettings = document.getElementById('btn-settings');
  const sboxCloseBtn = document.getElementById('sbox-close-btn');
  const sboxSaveBtn = document.getElementById('sbox-save-btn');
  const sboxResetBtn = document.getElementById('sbox-reset-btn');

  const selectZoom = document.getElementById('hk-zoom');
  const selectHpan = document.getElementById('hk-hpan');
  const selectHome = document.getElementById('hk-home');

  if (btnSettings) {
    btnSettings.addEventListener('click', () => {
      selectZoom.value = hotkeys.zoom;
      selectHpan.value = hotkeys.hpan;
      selectHome.value = hotkeys.home;
      settingsOverlay.classList.add('open');
    });
  }

  const closeSettings = () => settingsOverlay.classList.remove('open');
  if (sboxCloseBtn) sboxCloseBtn.addEventListener('click', closeSettings);
  if (settingsOverlay) {
    settingsOverlay.addEventListener('mousedown', e => {
      if (e.target === settingsOverlay) closeSettings();
    });
  }

  if (sboxSaveBtn) {
    sboxSaveBtn.addEventListener('click', () => {
      const updated = {
        zoom: selectZoom.value,
        hpan: selectHpan.value,
        home: selectHome.value
      };
      updateHotkeys(updated);
      closeSettings();
    });
  }

  if (sboxResetBtn) {
    sboxResetBtn.addEventListener('click', () => {
      selectZoom.value = 'Shift';
      selectHpan.value = 'Ctrl';
      selectHome.value = 'Space';
    });
  }

  // Settings File Buttons
  const sboxOpenBtn = document.getElementById('sbox-open-btn');
  if (sboxOpenBtn) {
    sboxOpenBtn.addEventListener('click', () => {
      closeSettings();
      document.getElementById('btn-open').click();
    });
  }

  const sboxSaveBtnFile = document.getElementById('sbox-save-btn-file');
  if (sboxSaveBtnFile) {
    sboxSaveBtnFile.addEventListener('click', () => {
      closeSettings();
      document.getElementById('btn-save').click();
    });
  }

  // Help/Legend Toggle "?" Button
  const btnHelp = document.getElementById('btn-help');
  const helpOverlay = document.getElementById('help-overlay');
  const helpClose = document.getElementById('help-close-btn');

  if (btnHelp && helpOverlay && helpClose) {
    btnHelp.addEventListener('click', () => {
      helpOverlay.classList.add('open');
    });
    helpClose.addEventListener('click', () => {
      helpOverlay.classList.remove('open');
    });
    helpOverlay.addEventListener('mousedown', e => {
      if (e.target === helpOverlay) helpOverlay.classList.remove('open');
    });
  }
}

// --- State Serialization ---
function saveState() {
  try {
    const layout = {
      cards: cards,
      nextId: nextId,
      transform: getTransform()
    };
    localStorage.setItem('mdway', JSON.stringify(layout));
  } catch (e) {
    console.error('Failed to autosave layout', e);
  }
}

function loadInitialState() {
  try {
    const data = JSON.parse(localStorage.getItem('mdway') || 'null');
    if (data && data.cards && data.cards.length) {
      loadCards(data.cards, data.nextId);
      if (data.transform) {
        const { panX, panY, scale } = data.transform;
        setTransform(panX, panY, scale);
      }
      document.getElementById('hint').classList.add('gone');
      return;
    }
  } catch (e) {
    console.error('Failed to load state', e);
  }

  // Load default welcome card if workspace is empty
  const welcomeText = `# MDway\n\nPaste code, text, or web links anywhere.\n\n`
    + `- **Ctrl+V** &mdash; drop a new card (pasting a link auto-scrapes metadata!)\n`
    + `- Paste a standard MTG decklist to fetch Scryfall card details automatically!\n`
    + `- Drag **header** to move cards around\n`
    + `- **Double-click** card body to edit\n`
    + `- **Ctrl+Shift+I** &mdash; open developer window (standalone)\n`
    + `- Click **?** in the titlebar for the quick cheatsheet`;

  createNewCard(welcomeText, 60, 40, { lang: 'markdown', showMd: true });
}

// Boot the app
window.addEventListener('DOMContentLoaded', init);
