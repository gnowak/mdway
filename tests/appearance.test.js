import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock imports
vi.mock('ipc', () => ({
  ipc: {
    close: vi.fn(),
    minimize: vi.fn(),
    setPin: vi.fn(),
    getLaunchFile: vi.fn().mockResolvedValue(null),
    onOpenLaunchFile: vi.fn()
  }
}));

vi.mock('./canvas.js', () => ({
  initCanvas: vi.fn(),
  getCanvasCenter: vi.fn(),
  getTransform: vi.fn(),
  setTransform: vi.fn(),
  screenToCanvas: vi.fn(),
  hotkeys: { zoom: 'Shift', hpan: 'Ctrl', home: 'Space' },
  updateHotkeys: vi.fn()
}));

vi.mock('./card.js', () => ({
  initCards: vi.fn(),
  cards: [],
  nextId: 0,
  createNewCard: vi.fn(),
  loadCards: vi.fn(),
  clearCards: vi.fn()
}));

vi.mock('extension-manager', () => ({
  extensionManager: {
    register: vi.fn(),
    handlePaste: vi.fn(),
    hasRenderer: vi.fn(() => false),
    render: vi.fn()
  }
}));

import { 
  appearance, 
  applyAppearance, 
  updateAppearance, 
  pinned, 
  updatePinState,
  pinnedOnStartup
} from '../src/renderer.js';

describe('Appearance Manager', () => {
  beforeEach(() => {
    localStorage.clear();
    // Reset body classes
    document.body.className = '';
  });

  it('should initialize with default appearance settings', () => {
    expect(appearance.theme).toBe('blue-jays');
    expect(appearance.font).toBe('sans');
  });

  it('should apply appearance settings as classes on document body', () => {
    applyAppearance();
    expect(document.body.classList.contains('theme-blue-jays')).toBe(true);
    expect(document.body.classList.contains('font-sans')).toBe(true);
  });

  it('should update appearance settings, save to localStorage, and update DOM classes', () => {
    updateAppearance({ theme: 'pastel', font: 'mono' });

    expect(appearance.theme).toBe('pastel');
    expect(appearance.font).toBe('mono');

    // Check DOM classes
    expect(document.body.className).toBe('theme-pastel font-mono');

    // Check localStorage
    const saved = JSON.parse(localStorage.getItem('mdway-appearance'));
    expect(saved).toEqual({ theme: 'pastel', font: 'mono' });
  });

  it('should initialize window pinning as false and handle session updates', () => {
    // Default should be false (float)
    expect(pinned).toBe(false);
    expect(pinnedOnStartup).toBe(false);

    updatePinState(true);
    // session state is true
    expect(pinned).toBe(true);
    // but startup preference is still false (no write to localStorage)
    expect(pinnedOnStartup).toBe(false);
    expect(localStorage.getItem('mdway-pin-on-startup')).toBeNull();
  });
});
