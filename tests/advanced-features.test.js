import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock imports
vi.mock('ipc', () => ({
  ipc: {
    close: vi.fn(),
    minimize: vi.fn(),
    setPin: vi.fn(),
    getLaunchFile: vi.fn().mockResolvedValue(null),
    onOpenLaunchFile: vi.fn(),
    detectLanguage: vi.fn((text) => text.includes('# ') ? 'markdown' : 'text'),
    renderCardBody: vi.fn((text) => `<pre><code>${text}</code></pre>`),
    escapeHtml: vi.fn((text) => text),
    exportFile: vi.fn().mockResolvedValue({ success: true, filePath: 'test.txt' })
  }
}));

vi.mock('./canvas.js', () => ({
  initCanvas: vi.fn(),
  getCanvasCenter: vi.fn(),
  getTransform: vi.fn(() => ({ panX: 0, panY: 0, scale: 1 })),
  setTransform: vi.fn(),
  screenToCanvas: vi.fn((x, y) => ({ x, y })),
  hotkeys: { zoom: 'Shift', hpan: 'Ctrl', home: 'Space' },
  updateHotkeys: vi.fn()
}));

vi.mock('extension-manager', () => ({
  extensionManager: {
    register: vi.fn(),
    handlePaste: vi.fn(),
    getLanguageStyle: vi.fn(() => null),
    hasRenderer: vi.fn((lang) => lang === 'color-palette'),
    render: vi.fn(() => ''),
    runPostRender: vi.fn()
  }
}));

import { initCards, createNewCard, cards, clearCards } from '../src/card.js';
import { 
  initHistory, 
  undoStack, 
  redoStack, 
  recordStateChange, 
  undo, 
  redo 
} from '../src/renderer.js';

describe('Advanced MDway Features', () => {
  let container;
  
  beforeEach(() => {
    container = document.createElement('div');
    initCards(container, vi.fn());
    localStorage.clear();
    clearCards();
    initHistory({ cards: [], nextId: 0, transform: { panX: 0, panY: 0, scale: 1 } });
  });

  it('should duplicate a card at a +30px offset', () => {
    const card = createNewCard('Hello world', 100, 100, { lang: 'markdown' });
    expect(cards.length).toBe(1);

    // Duplicate card
    createNewCard(card.text, card.x + 30, card.y + 30, {
      lang: card.lang,
      showMd: card.showMd,
      w: card.w,
      h: card.h
    });

    expect(cards.length).toBe(2);
    expect(cards[1].text).toBe('Hello world');
    expect(cards[1].x).toBe(130);
    expect(cards[1].y).toBe(130);
  });

  it('should extract color codes from text and spawn a color palette card', () => {
    const text = 'Here is a red hex #ff0000 and an rgb(0, 255, 0) color code.';
    const colorRegex = /(#[0-9a-f]{3,6}|rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)|hsl\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*\))/gi;
    const colors = text.match(colorRegex);
    expect(colors).not.toBeNull();
    expect(colors.length).toBe(2);

    const uniqueColors = [...new Set(colors.map(c => c.trim()))];
    const paletteText = uniqueColors.join('\n');

    const paletteCard = createNewCard(paletteText, 100, 100, {
      lang: 'color-palette',
      showMd: true,
      w: 240,
      h: 300
    });

    expect(paletteCard.lang).toBe('color-palette');
    expect(paletteCard.text).toBe('#ff0000\nrgb(0, 255, 0)');
  });

  it('should track undo and redo operations correctly', () => {
    // 1. Initial empty state recorded
    const state0 = { cards: [], nextId: 0, transform: { panX: 0, panY: 0, scale: 1 } };
    initHistory(state0);

    // 2. Add first card and record change
    createNewCard('Card 1', 100, 100);
    recordStateChange();
    
    expect(undoStack.length).toBe(1);
    expect(cards.length).toBe(1);

    // 3. Add second card and record change
    createNewCard('Card 2', 200, 200);
    recordStateChange();
    
    expect(undoStack.length).toBe(2);
    expect(cards.length).toBe(2);

    // 4. Undo last change
    undo();
    expect(cards.length).toBe(1);
    expect(cards[0].text).toBe('Card 1');
    expect(redoStack.length).toBe(1);

    // 5. Redo change
    redo();
    expect(cards.length).toBe(2);
    expect(redoStack.length).toBe(0);
  });
});
