import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('ipc', () => ({
  ipc: {
    detectLanguage: vi.fn((text) => text.includes('# ') ? 'markdown' : 'text'),
    renderCardBody: vi.fn((text) => `<pre><code>${text}</code></pre>`),
    escapeHtml: vi.fn((text) => text),
    exportFile: vi.fn().mockResolvedValue({ success: true, filePath: 'test.txt' })
  }
}));

vi.mock('./canvas.js', () => ({
  getTransform: vi.fn(() => ({ scale: 1.0 })),
  screenToCanvas: vi.fn((x, y) => ({ x, y })),
  scheduleRender: vi.fn()
}));

vi.mock('extension-manager', () => ({
  extensionManager: {
    getLanguageStyle: vi.fn(() => null),
    hasRenderer: vi.fn(() => false),
    render: vi.fn(() => ''),
    runPostRender: vi.fn()
  }
}));

import { initCards, createNewCard, cards, clearCards, loadCards } from '../src/card.js';

describe('Card Manager', () => {
  let container;
  let onSave;

  beforeEach(() => {
    container = document.createElement('div');
    onSave = vi.fn();
    initCards(container, onSave);
    clearCards();
    onSave.mockClear();
  });

  it('should create new cards and inject DOM element', () => {
    const card = createNewCard('Hello world', 50, 60);

    expect(cards.length).toBe(1);
    expect(cards[0].text).toBe('Hello world');
    expect(cards[0].x).toBe(50);
    expect(cards[0].y).toBe(60);
    expect(cards[0].lang).toBe('text'); // default mock detect returned 'text'

    const cardEl = container.querySelector(`[data-id="${card.id}"]`);
    expect(cardEl).not.toBeNull();
    expect(cardEl.querySelector('.card-meta').textContent).toBe('1 line');
  });

  it('should auto-detect markdown language style', () => {
    const card = createNewCard('# Heading Title\nSome content', 10, 10);
    expect(card.lang).toBe('markdown');
    expect(card.showMd).toBe(true);

    const cardEl = container.querySelector(`[data-id="${card.id}"]`);
    expect(cardEl.querySelector('.badge').textContent).toBe('MD');
  });

  it('should support clearing all cards', () => {
    createNewCard('Card 1', 0, 0);
    createNewCard('Card 2', 0, 0);
    expect(cards.length).toBe(2);

    clearCards();
    expect(cards.length).toBe(0);
    expect(container.innerHTML).toBe('');
  });

  it('should support loading cards from serialized list', () => {
    const loadedList = [
      { id: 10, text: 'Loaded 1', x: 100, y: 100, w: 200, h: 100, lang: 'text', showMd: false },
      { id: 11, text: 'Loaded 2', x: 200, y: 200, w: 200, h: 150, lang: 'markdown', showMd: true }
    ];

    loadCards(loadedList, 12);
    expect(cards.length).toBe(2);
    expect(cards[0].id).toBe(10);
    expect(cards[1].id).toBe(11);

    const firstEl = container.querySelector('[data-id="10"]');
    expect(firstEl).not.toBeNull();
    expect(firstEl.style.width).toBe('200px');
  });

  it('should enter edit mode and save edits successfully', () => {
    const card = createNewCard('Original text', 10, 10);
    const cardEl = container.querySelector(`[data-id="${card.id}"]`);
    const editBtn = cardEl.querySelector('.edit-btn');
    const bd = cardEl.querySelector('.card-bd');

    // Click edit button
    editBtn.click();
    const textarea = bd.querySelector('textarea');
    expect(textarea).not.toBeNull();
    expect(textarea.value).toBe('Original text');

    // Simulate typing and saving
    textarea.value = 'Updated text content\nNew line';
    editBtn.click(); // clicks save (same button)

    expect(card.text).toBe('Updated text content\nNew line');
    expect(bd.querySelector('textarea')).toBeNull();
    expect(cardEl.querySelector('.card-meta').textContent).toBe('2 lines');
    expect(onSave).toHaveBeenCalled();
  });

  it('should support deleting cards', () => {
    const card = createNewCard('ToDelete', 0, 0);
    const cardEl = container.querySelector(`[data-id="${card.id}"]`);
    const deleteBtn = cardEl.querySelector('.x-btn');

    deleteBtn.click();
    expect(cards.length).toBe(0);
    expect(container.querySelector(`[data-id="${card.id}"]`)).toBeNull();
    expect(onSave).toHaveBeenCalled();
  });
});
