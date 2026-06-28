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

export let appearance = { theme: 'blue-jays', font: 'sans' };

window.mdwayChainsawMode = false;
export let skipChainsawWarning = false;
export let isRestoringState = false;

// Load chainsaw mode warning preference
try {
  const savedSkip = localStorage.getItem('mdway-skip-chainsaw-warning');
  if (savedSkip !== null) {
    skipChainsawWarning = JSON.parse(savedSkip);
  }
} catch (e) {}

// Load appearance settings on startup
try {
  const saved = localStorage.getItem('mdway-appearance');
  if (saved) Object.assign(appearance, JSON.parse(saved));
} catch (e) {
  console.error('Failed to load appearance settings', e);
}

export function applyAppearance() {
  document.body.className = `theme-${appearance.theme} font-${appearance.font}`;
}

export function updateAppearance(newAppearance) {
  Object.assign(appearance, newAppearance);
  try {
    localStorage.setItem('mdway-appearance', JSON.stringify(appearance));
  } catch (e) {
    console.error('Failed to save appearance settings', e);
  }
  applyAppearance();
}

// Call applyAppearance right away so it styles the page immediately
applyAppearance();

// --- Initialization ---
async function init() {
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

  // 7. Bind Chainsaw deletion mode controls
  setupChainsawMode();

  // 8. Bind undo/redo click buttons
  const btnUndo = document.getElementById('btn-undo');
  if (btnUndo) btnUndo.addEventListener('click', undo);
  const btnRedo = document.getElementById('btn-redo');
  if (btnRedo) btnRedo.addEventListener('click', redo);

  // 9. Check if launched with a file, otherwise load initial state
  isRestoringState = true;
  try {
    const launchData = await ipc.getLaunchFile();
    if (launchData && launchData.success && launchData.data) {
      loadCards(launchData.data.cards, launchData.data.nextId);
      if (launchData.data.transform) {
        const { panX, panY, scale } = launchData.data.transform;
        setTransform(panX, panY, scale);
      }
      document.getElementById('hint').classList.add('gone');
      initHistory(launchData.data);
    } else {
      loadInitialState();
    }
  } catch (e) {
    console.error('Error fetching launch file:', e);
    loadInitialState();
  } finally {
    isRestoringState = false;
  }

  // 10. Register second-instance listener
  ipc.onOpenLaunchFile((fileData) => {
    if (fileData && fileData.success && fileData.data) {
      if (confirm(`Open "${fileData.filePath}"? This will replace your current canvas.`)) {
        isRestoringState = true;
        try {
          loadCards(fileData.data.cards, fileData.data.nextId);
          if (fileData.data.transform) {
            const { panX, panY, scale } = fileData.data.transform;
            setTransform(panX, panY, scale);
          }
          document.getElementById('hint').classList.add('gone');
          initHistory(fileData.data);
          try {
            localStorage.setItem('mdway', JSON.stringify(fileData.data));
          } catch (e) {}
        } finally {
          isRestoringState = false;
        }
      }
    }
  });
}

export let pinnedOnStartup = false;
try {
  const savedStartup = localStorage.getItem('mdway-pin-on-startup');
  if (savedStartup !== null) {
    pinnedOnStartup = JSON.parse(savedStartup);
  }
} catch (e) {}

export let pinned = pinnedOnStartup;

export function syncPinState() {
  const pinBtn = document.getElementById('btn-pin');
  if (pinBtn) {
    pinBtn.innerHTML = pinned ? '&#128204; pinned' : '&#128204; float';
    pinBtn.classList.toggle('on', pinned);
    pinBtn.title = pinned 
      ? "Window is Pinned (Always on Top). Click to set to Float (let other windows overlap)." 
      : "Window is Floating (standard window overlapping). Click to Pin (Always on Top).";
  }
  ipc.setPin(pinned);
}

export function updatePinState(newState) {
  pinned = newState;
  syncPinState();
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
    syncPinState();
    pinBtn.addEventListener('click', () => {
      updatePinState(!pinned);
    });
  }
}

// --- File Operations ---
function setupFileOperations() {
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

  // Global Keyboard Shortcuts (Ctrl+O / Ctrl+S / Ctrl+Z / Ctrl+Y)
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
    if (e.ctrlKey && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      undo();
    }
    if (e.ctrlKey && e.key.toLowerCase() === 'y') {
      e.preventDefault();
      redo();
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
      // Create a minimal placeholder card — content will be set to spinner HTML below
      const card = createNewCard(text, x, y, { lang: 'markdown', showMd: false });

      const el = document.querySelector(`.card[data-id="${card.id}"]`);
      if (el) {
        animateCardSpawn(el);

        // Show animated spinner in the card body immediately
        const bd = el.querySelector('.card-bd');
        let shortHost = text;
        try { shortHost = new URL(text).hostname; } catch (_) {}
        bd.innerHTML = `<div class="link-loading"><div class="link-spinner"></div><span>Fetching preview…</span><span class="link-loading-url">${shortHost}</span></div>`;

        // Update badge to show LINK state
        const badge = el.querySelector('.badge');
        if (badge) { badge.textContent = 'LINK'; badge.style.background = '#0ea5e9'; }
      }
      document.getElementById('hint').classList.add('gone');

      // Helper to resolve the card with final content
      const resolveCard = (meta) => {
        let content;
        if (meta && meta.success && meta.title) {
          content = `# [${meta.title}](${meta.url || text})\n\n`;
          if (meta.description) content += `> ${meta.description}\n\n`;
          if (meta.image) content += `![Preview](${meta.image})\n`;
        } else {
          // Graceful fallback — just render the raw link
          content = `[${text}](${text})`;
        }

        card.text = content;
        card.lang = 'markdown';
        card.showMd = true;

        if (el) {
          const bd = el.querySelector('.card-bd');
          bd.innerHTML = ipc.renderCardBody(card.text, card.lang, card.showMd);

          const badge = el.querySelector('.badge');
          if (badge) { badge.textContent = 'MD'; badge.style.background = '#a78bfa'; }

          const lines = card.text.split('\n').length;
          const meta2 = el.querySelector('.card-meta');
          if (meta2) meta2.textContent = `${lines} line${lines !== 1 ? 's' : ''}`;

          const mermaidNodes = bd.querySelectorAll('.mermaid');
          if (mermaidNodes.length && typeof window.mermaid !== 'undefined') {
            mermaidNodes.forEach(n => n.setAttribute('data-rendered', '1'));
            try { window.mermaid.run({ nodes: [...mermaidNodes] }); } catch (_) {}
          }
        }
        saveState();
      };

      // Race: IPC fetch vs. 12s client-side timeout guard
      const clientTimeout = new Promise(resolve =>
        setTimeout(() => resolve({ success: false, error: 'Client timeout' }), 12000)
      );

      Promise.race([ipc.fetchLinkMetadata(text), clientTimeout])
        .then(resolveCard)
        .catch(() => resolveCard({ success: false }));
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

// --- Modal Focus Trap Helper ---
function enableFocusTrap(overlayEl) {
  const focusableSelectors = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';
  const focusableElements = overlayEl.querySelectorAll(focusableSelectors);
  if (focusableElements.length === 0) return null;
  
  const previouslyFocused = document.activeElement;
  
  // Set initial focus to the close button (if available) or the first focusable element
  const closeBtn = overlayEl.querySelector('.sbox-close');
  if (closeBtn) {
    closeBtn.focus();
  } else {
    focusableElements[0].focus();
  }
  
  const keydownHandler = function(e) {
    if (e.key !== 'Tab') return;
    
    // Query elements dynamically in case some are hidden or changed
    const elements = [...overlayEl.querySelectorAll(focusableSelectors)].filter(
      el => el.tabIndex !== -1 && el.offsetWidth > 0 && el.offsetHeight > 0
    );
    if (elements.length === 0) return;
    
    const first = elements[0];
    const last = elements[elements.length - 1];
    
    if (e.shiftKey) {
      if (document.activeElement === first) {
        last.focus();
        e.preventDefault();
      }
    } else {
      if (document.activeElement === last) {
        first.focus();
        e.preventDefault();
      }
    }
  };
  
  overlayEl.addEventListener('keydown', keydownHandler);
  
  return {
    disable: () => {
      overlayEl.removeEventListener('keydown', keydownHandler);
      if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
        previouslyFocused.focus();
      }
    }
  };
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
  const selectTheme = document.getElementById('opt-theme');
  const selectFont = document.getElementById('opt-font');
  const selectPinStartup = document.getElementById('opt-pin-startup');
  const selectChainsawWarn = document.getElementById('opt-chainsaw-warn');
  const sboxClearBtn = document.getElementById('sbox-clear-btn');
  const sboxWelcomeBtn = document.getElementById('sbox-welcome-btn');
  const sboxOpenExtBtn = document.getElementById('sbox-open-ext-btn');
  const extListContainer = document.getElementById('sbox-extensions-list');

  let settingsTrap = null;
  let helpTrap = null;

  const openSettings = () => {
    selectZoom.value = hotkeys.zoom;
    selectHpan.value = hotkeys.hpan;
    selectHome.value = hotkeys.home;
    selectTheme.value = appearance.theme;
    selectFont.value = appearance.font;
    if (selectPinStartup) {
      selectPinStartup.value = pinnedOnStartup ? 'true' : 'false';
    }
    if (selectChainsawWarn) {
      selectChainsawWarn.value = skipChainsawWarning ? 'true' : 'false';
    }

    // Populate extensions checklist dynamically
    if (extListContainer) {
      extListContainer.innerHTML = '';
      extensionManager.extensions.forEach(name => {
        const isEnabled = extensionManager.isExtensionEnabled(name);
        const label = document.createElement('label');
        label.className = 'sbox-checkbox-row';
        label.innerHTML = `
          <input type="checkbox" class="sbox-ext-toggle" data-name="${name}" ${isEnabled ? 'checked' : ''}>
          <span>${name}</span>
        `;
        extListContainer.appendChild(label);
      });
    }

    settingsOverlay.classList.add('open');
    settingsTrap = enableFocusTrap(settingsOverlay);
  };

  const closeSettings = () => {
    settingsOverlay.classList.remove('open');
    if (settingsTrap) {
      settingsTrap.disable();
      settingsTrap = null;
    }
  };

  if (btnSettings) {
    btnSettings.addEventListener('click', openSettings);
  }

  if (sboxCloseBtn) sboxCloseBtn.addEventListener('click', closeSettings);
  if (settingsOverlay) {
    settingsOverlay.addEventListener('mousedown', e => {
      if (e.target === settingsOverlay) closeSettings();
    });
  }

  if (sboxSaveBtn) {
    sboxSaveBtn.addEventListener('click', () => {
      const updatedHotkeys = {
        zoom: selectZoom.value,
        hpan: selectHpan.value,
        home: selectHome.value
      };
      updateHotkeys(updatedHotkeys);

      const updatedAppearance = {
        theme: selectTheme.value,
        font: selectFont.value
      };
      updateAppearance(updatedAppearance);

      if (selectPinStartup) {
        const startupValue = selectPinStartup.value === 'true';
        pinnedOnStartup = startupValue;
        try {
          localStorage.setItem('mdway-pin-on-startup', JSON.stringify(pinnedOnStartup));
        } catch (e) {}
        updatePinState(pinnedOnStartup);
      }

      if (selectChainsawWarn) {
        skipChainsawWarning = selectChainsawWarn.value === 'true';
        try {
          localStorage.setItem('mdway-skip-chainsaw-warning', JSON.stringify(skipChainsawWarning));
        } catch (e) {}
      }

      // Check extensions checkboxes
      let extensionStateChanged = false;
      if (extListContainer) {
        const toggles = extListContainer.querySelectorAll('.sbox-ext-toggle');
        toggles.forEach(toggle => {
          const name = toggle.dataset.name;
          const wasEnabled = extensionManager.isExtensionEnabled(name);
          const isNowEnabled = toggle.checked;
          if (wasEnabled !== isNowEnabled) {
            extensionManager.setExtensionEnabled(name, isNowEnabled);
            extensionStateChanged = true;
          }
        });
      }

      closeSettings();

      if (extensionStateChanged) {
        location.reload();
      }
    });
  }

  if (sboxClearBtn) {
    sboxClearBtn.addEventListener('click', () => {
      if (confirm('Are you sure you want to clear all cards? This cannot be undone.')) {
        clearCards();
        // Spawn the welcome card so the board is never left blank
        isRestoringState = true;
        try {
          const welcomeText = `# MDway\n\n`
            + `Paste code, text, or web links anywhere on the canvas:\n\n`
            + `- **Ctrl+V** &mdash; drop a new card (pasting a link auto-scrapes metadata!)\n`
            + `- Paste a standard MTG decklist to fetch Scryfall card details automatically!\n`
            + `- Drag **header** to move cards (direct body dragging works for SVG & Color swatches!)\n`
            + `- **Double-click** card body to edit\n`
            + `- **Ctrl+Shift+I** &mdash; open developer console (standalone)\n`
            + `- Click **?** in the titlebar for the quick cheatsheet guide`;
          const firstCard = createNewCard(welcomeText, window.innerWidth / 2 - 200, window.innerHeight / 2 - 150, { lang: 'markdown', showMd: true });
          initHistory({ cards: [firstCard], nextId, transform: { panX: 0, panY: 0, scale: 1 } });
        } finally {
          isRestoringState = false;
        }
        document.getElementById('hint').classList.add('gone');
        closeSettings();
      }
    });
  }

  if (sboxWelcomeBtn) {
    sboxWelcomeBtn.addEventListener('click', () => {
      const welcomeText = `# MDway\n\n`
        + `Paste code, text, or web links anywhere on the canvas:\n\n`
        + `- **Ctrl+V** &mdash; drop a new card (pasting a link auto-scrapes metadata!)\n`
        + `- Paste a standard MTG decklist to fetch Scryfall card details automatically!\n`
        + `- Drag **header** to move cards (direct body dragging works for SVG & Color swatches!)\n`
        + `- **Double-click** card body to edit\n`
        + `- **Ctrl+Shift+I** &mdash; open developer console (standalone)\n`
        + `- Click **?** in the titlebar for the quick cheatsheet guide`;

      const transform = getTransform();
      const x = -transform.panX / transform.scale + (window.innerWidth / (2 * transform.scale)) - 200;
      const y = -transform.panY / transform.scale + (window.innerHeight / (2 * transform.scale)) - 150;

      createNewCard(welcomeText, x, y, { lang: 'markdown', showMd: true });
      document.getElementById('hint').classList.add('gone');
      closeSettings();
    });
  }

  if (sboxOpenExtBtn) {
    sboxOpenExtBtn.addEventListener('click', async () => {
      // Resolve extensions path relative to src/renderer.js → ../extensions
      const extPath = new URL('../extensions', import.meta.url).pathname
        .replace(/^\/([A-Za-z]:)/, '$1') // strip leading slash on Windows drive letters
        .replace(/\//g, '\\');
      await ipc.openFolder(extPath);
    });
  }

  if (sboxResetBtn) {
    sboxResetBtn.addEventListener('click', () => {
      selectZoom.value = 'Shift';
      selectHpan.value = 'Ctrl';
      selectHome.value = 'Space';
      selectTheme.value = 'blue-jays';
      selectFont.value = 'sans';
      if (selectPinStartup) {
        selectPinStartup.value = 'false';
      }
      if (selectChainsawWarn) {
        selectChainsawWarn.value = 'false';
      }

      if (extListContainer) {
        const toggles = extListContainer.querySelectorAll('.sbox-ext-toggle');
        toggles.forEach(toggle => {
          toggle.checked = true;
        });
      }
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

  const openHelp = () => {
    helpOverlay.classList.add('open');
    helpTrap = enableFocusTrap(helpOverlay);
  };

  const closeHelp = () => {
    helpOverlay.classList.remove('open');
    if (helpTrap) {
      helpTrap.disable();
      helpTrap = null;
    }
  };

  if (btnHelp && helpOverlay && helpClose) {
    btnHelp.addEventListener('click', openHelp);
    helpClose.addEventListener('click', closeHelp);
    helpOverlay.addEventListener('mousedown', e => {
      if (e.target === helpOverlay) closeHelp();
    });
  }

  // Intercept Escape key globally in capture phase to close modals first
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      let closedAny = false;
      if (settingsOverlay && settingsOverlay.classList.contains('open')) {
        closeSettings();
        closedAny = true;
      }
      if (helpOverlay && helpOverlay.classList.contains('open')) {
        closeHelp();
        closedAny = true;
      }
      const chainsawOverlay = document.getElementById('chainsaw-overlay');
      if (chainsawOverlay && chainsawOverlay.classList.contains('open')) {
        chainsawOverlay.classList.remove('open');
        closedAny = true;
      }
      if (closedAny) {
        e.preventDefault();
        e.stopPropagation();
      }
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
      e.preventDefault();
      redo();
    }
  }, true);
}

// --- State Serialization & History ---
export const undoStack = [];
export const redoStack = [];
const maxHistory = 50;
let lastRecordedStateJson = null;

export function initHistory(initialState) {
  undoStack.length = 0;
  redoStack.length = 0;
  lastRecordedStateJson = JSON.stringify(initialState);
  updateUndoRedoButtons();
}

export function recordStateChange() {
  const currentState = {
    cards: JSON.parse(JSON.stringify(cards)),
    nextId: nextId,
    transform: getTransform()
  };
  const currentStateJson = JSON.stringify(currentState);
  
  if (lastRecordedStateJson && lastRecordedStateJson !== currentStateJson) {
    const lastStateObj = JSON.parse(lastRecordedStateJson);
    undoStack.push(lastStateObj);
    if (undoStack.length > maxHistory) {
      undoStack.shift();
    }
    redoStack.length = 0;
    updateUndoRedoButtons();
  }
  
  lastRecordedStateJson = currentStateJson;
}

export function undo() {
  if (undoStack.length === 0) return;
  
  isRestoringState = true;
  try {
    const currentState = {
      cards: JSON.parse(JSON.stringify(cards)),
      nextId: nextId,
      transform: getTransform()
    };
    redoStack.push(currentState);
    
    const prevState = undoStack.pop();
    applyStateObj(prevState);
    updateUndoRedoButtons();
  } finally {
    isRestoringState = false;
  }
}

export function redo() {
  if (redoStack.length === 0) return;
  
  isRestoringState = true;
  try {
    const currentState = {
      cards: JSON.parse(JSON.stringify(cards)),
      nextId: nextId,
      transform: getTransform()
    };
    undoStack.push(currentState);
    
    const nextState = redoStack.pop();
    applyStateObj(nextState);
    updateUndoRedoButtons();
  } finally {
    isRestoringState = false;
  }
}

function applyStateObj(stateObj) {
  loadCards(stateObj.cards, stateObj.nextId);
  if (stateObj.transform) {
    const { panX, panY, scale } = stateObj.transform;
    setTransform(panX, panY, scale);
  }
  
  try {
    localStorage.setItem('mdway', JSON.stringify(stateObj));
  } catch (e) {}
  
  lastRecordedStateJson = JSON.stringify(stateObj);
}

export function updateUndoRedoButtons() {
  const undoBtn = document.getElementById('btn-undo');
  const redoBtn = document.getElementById('btn-redo');
  if (undoBtn) undoBtn.classList.toggle('disabled', undoStack.length === 0);
  if (redoBtn) redoBtn.classList.toggle('disabled', redoStack.length === 0);
}

function saveState() {
  if (isRestoringState) return;
  
  try {
    const layout = {
      cards: cards,
      nextId: nextId,
      transform: getTransform()
    };
    recordStateChange();
    localStorage.setItem('mdway', JSON.stringify(layout));
  } catch (e) {
    console.error('Failed to autosave layout', e);
  }
}
window.mdwayAutosave = saveState;

function loadInitialState() {
  isRestoringState = true;
  try {
    const data = JSON.parse(localStorage.getItem('mdway') || 'null');
    if (data && data.cards && data.cards.length) {
      loadCards(data.cards, data.nextId);
      if (data.transform) {
        const { panX, panY, scale } = data.transform;
        setTransform(panX, panY, scale);
      }
      document.getElementById('hint').classList.add('gone');
      initHistory(data);
      return;
    }
  } catch (e) {
    console.error('Failed to load state', e);
  } finally {
    isRestoringState = false;
  }

  // Load empty/default board helper
  isRestoringState = true;
  try {
    const welcomeText = `# MDway\n\n`
      + `Paste code, text, or web links anywhere on the canvas:\n\n`
      + `- **Ctrl+V** &mdash; drop a new card (pasting a link auto-scrapes metadata!)\n`
      + `- Paste a standard MTG decklist to fetch Scryfall card details automatically!\n`
      + `- Drag **header** to move cards (direct body dragging works for SVG & Color swatches!)\n`
      + `- **Double-click** card body to edit\n`
      + `- **Ctrl+Shift+I** &mdash; open developer console (standalone)\n`
      + `- Click **?** in the titlebar for the quick cheatsheet guide`;
    const firstCard = createNewCard(welcomeText, window.innerWidth / 2 - 200, window.innerHeight / 2 - 150, { lang: 'markdown', showMd: true });
    initHistory({
      cards: [firstCard],
      nextId: nextId,
      transform: { panX: 0, panY: 0, scale: 1 }
    });
  } finally {
    isRestoringState = false;
  }
}

// --- Chainsaw Mode Control ---
function setupChainsawMode() {
  const btnChainsaw = document.getElementById('btn-chainsaw');
  const chainsawOverlay = document.getElementById('chainsaw-overlay');
  const chainsawConfirm = document.getElementById('chainsaw-confirm-btn');
  const chainsawCancel = document.getElementById('chainsaw-cancel-btn');
  const chainsawSkipSelect = document.getElementById('chainsaw-warn-skip');

  if (btnChainsaw && chainsawOverlay && chainsawConfirm && chainsawCancel) {
    let focusTrap = null;

    const openChainsawWarn = () => {
      if (chainsawSkipSelect) {
        chainsawSkipSelect.value = skipChainsawWarning ? 'true' : 'false';
      }
      chainsawOverlay.classList.add('open');
      focusTrap = enableFocusTrap(chainsawOverlay);
    };

    const closeChainsawWarn = () => {
      chainsawOverlay.classList.remove('open');
      if (focusTrap) {
        focusTrap.disable();
        focusTrap = null;
      }
    };

    btnChainsaw.addEventListener('click', () => {
      if (!window.mdwayChainsawMode && !skipChainsawWarning) {
        openChainsawWarn();
      } else {
        toggleChainsawMode(!window.mdwayChainsawMode);
      }
    });

    chainsawConfirm.addEventListener('click', () => {
      if (chainsawSkipSelect) {
        skipChainsawWarning = chainsawSkipSelect.value === 'true';
        try {
          localStorage.setItem('mdway-skip-chainsaw-warning', JSON.stringify(skipChainsawWarning));
        } catch (e) {}

        const selectChainsawWarn = document.getElementById('opt-chainsaw-warn');
        if (selectChainsawWarn) {
          selectChainsawWarn.value = skipChainsawWarning ? 'true' : 'false';
        }
      }
      closeChainsawWarn();
      toggleChainsawMode(true);
    });

    chainsawCancel.addEventListener('click', () => {
      closeChainsawWarn();
    });

    chainsawOverlay.addEventListener('mousedown', e => {
      if (e.target === chainsawOverlay) closeChainsawWarn();
    });
  }
}

function toggleChainsawMode(activate) {
  const btnChainsaw = document.getElementById('btn-chainsaw');
  if (!btnChainsaw) return;

  window.mdwayChainsawMode = activate;
  btnChainsaw.classList.toggle('on', window.mdwayChainsawMode);
  if (window.mdwayChainsawMode) {
    btnChainsaw.style.background = '#dc2626';
    btnChainsaw.style.borderColor = '#dc2626';
    btnChainsaw.style.color = '#fff';
    btnChainsaw.innerHTML = '&#9785; destructive';
    document.body.classList.add('chainsaw-active');
  } else {
    btnChainsaw.style.background = '';
    btnChainsaw.style.borderColor = '';
    btnChainsaw.style.color = '';
    btnChainsaw.innerHTML = '&#x1F99A; chainsaw';
    document.body.classList.remove('chainsaw-active');
  }
}

// Boot the app
window.addEventListener('DOMContentLoaded', init);
