// canvas.js - Infinite Canvas Manager
// High-performance panning, zooming, and coordinate mapping

const MIN_SCALE = 0.15;
const MAX_SCALE = 3.0;

let viewport = null;
let canvas = null;

let panX = 0;
let panY = 0;
let scale = 1.0;
let panning = false;
let panStart = { x: 0, y: 0 };
let needsRender = false;

// Default hotkeys
export let hotkeys = { zoom: 'Shift', hpan: 'Ctrl', home: 'Space' };

// Load hotkeys from localStorage
try {
  const saved = localStorage.getItem('mdway-hotkeys');
  if (saved) Object.assign(hotkeys, JSON.parse(saved));
} catch (e) {
  console.error('Failed to load hotkeys', e);
}

// Callback for redrawing connections when canvas transforms
let onCanvasTransformCallback = null;

function isModifierActive(modName, event) {
  if (modName === 'Shift') return event.shiftKey;
  if (modName === 'Ctrl') return event.ctrlKey;
  if (modName === 'Alt') return event.altKey;
  if (modName === 'None') return !event.shiftKey && !event.ctrlKey && !event.altKey;
  return false;
}

export function initCanvas(viewportEl, canvasEl, onTransform) {
  viewport = viewportEl;
  canvas = canvasEl;
  onCanvasTransformCallback = onTransform;

  // Viewport panning mousedown
  viewport.addEventListener('mousedown', e => {
    // Only pan on middle-click or left-click on empty viewport
    if (e.target !== viewport && e.target !== canvas) return;
    if (e.button !== 0 && e.button !== 1) return; // Left or middle click
    
    panning = true;
    panStart = { x: e.clientX - panX, y: e.clientY - panY };
    viewport.style.cursor = 'grabbing';
    e.preventDefault();
  });

  // Wheel zooming and panning
  viewport.addEventListener('wheel', e => {
    e.preventDefault();
    if (isModifierActive(hotkeys.zoom, e)) {
      // Zoom centered on cursor
      const factor = e.deltaY > 0 ? 0.92 : 1.08;
      const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale * factor));
      const rect = viewport.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;

      panX = mx - (mx - panX) * (newScale / scale);
      panY = my - (my - panY) * (newScale / scale);
      scale = newScale;
    } else if (isModifierActive(hotkeys.hpan, e)) {
      // Horizontal pan
      panX -= e.deltaY;
    } else {
      // Standard vertical/horizontal panning
      panX -= e.deltaX;
      panY -= e.deltaY;
    }
    scheduleRender();
  }, { passive: false });

  // Mouse move for panning
  window.addEventListener('mousemove', e => {
    if (panning) {
      panX = e.clientX - panStart.x;
      panY = e.clientY - panStart.y;
      scheduleRender();
    }
  });

  // Mouse up to end panning
  window.addEventListener('mouseup', () => {
    if (panning) {
      panning = false;
      viewport.style.cursor = 'default';
    }
  });

  // Hotkey listener for resetting view to center
  document.addEventListener('keydown', e => {
    // Ignore when typing in inputs/textareas
    if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;

    const hitHome = (hotkeys.home === 'Space' && e.code === 'Space') ||
                    (hotkeys.home === 'KeyH' && e.code === 'KeyH') ||
                    (hotkeys.home === 'Backquote' && e.code === 'Backquote') ||
                    (hotkeys.home === 'Escape' && e.key === 'Escape');

    if (hitHome) {
      e.preventDefault();
      resetView();
    }
  });

  // Render initial transform
  scheduleRender();
}

export function resetView() {
  panX = 0;
  panY = 0;
  scale = 1.0;
  scheduleRender();
}

export function scheduleRender() {
  if (!needsRender) {
    needsRender = true;
    requestAnimationFrame(render);
  }
}

function render() {
  needsRender = false;
  if (!canvas || !viewport) return;

  // Use translate3d for GPU hardware acceleration
  canvas.style.transformOrigin = '0 0';
  canvas.style.transform = `translate3d(${panX}px, ${panY}px, 0) scale(${scale})`;

  // Smooth CSS grid overlay background updates
  const gs = Math.round(26 * scale);
  viewport.style.backgroundSize = `${gs}px ${gs}px`;
  viewport.style.backgroundPosition = `${panX % gs}px ${panY % gs}px`;

  // Trigger connection lines update (if any registered)
  if (onCanvasTransformCallback) {
    onCanvasTransformCallback();
  }
}

// Convert screen viewport client coordinates to local canvas space
export function screenToCanvas(clientX, clientY) {
  if (!viewport) return { x: clientX, y: clientY };
  const rect = viewport.getBoundingClientRect();
  return {
    x: (clientX - rect.left - panX) / scale,
    y: (clientY - rect.top - panY) / scale
  };
}

// Get center of viewport mapped to local canvas space
export function getCanvasCenter() {
  if (!viewport) return { x: 0, y: 0 };
  const rect = viewport.getBoundingClientRect();
  return {
    x: (rect.width / 2 - panX) / scale,
    y: (rect.height / 2 - panY) / scale
  };
}

// Save hotkey settings
export function updateHotkeys(newHotkeys) {
  Object.assign(hotkeys, newHotkeys);
  try {
    localStorage.setItem('mdway-hotkeys', JSON.stringify(hotkeys));
  } catch (e) {
    console.error('Failed to save hotkeys', e);
  }
}

export function getTransform() {
  return { panX, panY, scale };
}

export function setTransform(x, y, s) {
  panX = x;
  panY = y;
  scale = s;
  scheduleRender();
}
