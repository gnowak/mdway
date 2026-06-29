import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock ipc before importing
vi.mock('ipc', () => ({
  ipc: {
    escapeHtml: vi.fn(s => s),
    renderCardBody: vi.fn(s => s),
    detectLanguage: vi.fn(() => 'markdown'),
    queryScryfall: vi.fn(async () => ({
      success: true,
      data: {
        data: [
          { name: 'Black Lotus', type_line: 'Artifact', prices: { usd: '25000.00' }, mana_cost: '{0}', oracle_text: 'T, Sacrifice: Add 3 mana.' },
          { name: 'Ancestral Recall', type_line: 'Instant', prices: { usd: '5000.00' }, mana_cost: '{U}', oracle_text: 'Target player draws 3 cards.' }
        ]
      }
    }))
  }
}));

import { ExtensionManager } from '../src/extension-manager.js';
import { MtgExtension } from '../extensions/mtg/mtg-extension.js';

describe('Extension Manager & MTG Extension', () => {
  let manager;

  beforeEach(() => {
    manager = new ExtensionManager();
    // Mock global fetch
    global.fetch = vi.fn();
  });

  it('should register extensions and languages', () => {
    const mockExt = {
      onInit: vi.fn(mgr => {
        mgr.registerLanguage({ name: 'mock-lang', label: 'MOCK', color: '#ff0000' });
      })
    };

    manager.register(mockExt);
    expect(mockExt.onInit).toHaveBeenCalledWith(manager);

    const style = manager.getLanguageStyle('mock-lang');
    expect(style).not.toBeNull();
    expect(style.label).toBe('MOCK');
    expect(style.color).toBe('#ff0000');
  });

  it('should register and execute paste handlers', async () => {
    const mockHandler = vi.fn().mockResolvedValue(true);
    manager.registerPasteHandler(mockHandler);

    const context = { value: 'context' };
    const handled = await manager.handlePaste('some pasted text', context);

    expect(handled).toBe(true);
    expect(mockHandler).toHaveBeenCalledWith('some pasted text', context);
  });

  it('should register and invoke custom renderers', () => {
    const mockRender = vi.fn(card => `rendered:${card.text}`);
    manager.registerRenderer('custom-lang', mockRender);

    expect(manager.hasRenderer('custom-lang')).toBe(true);
    expect(manager.hasRenderer('another-lang')).toBe(false);

    const card = { text: 'myCardData' };
    const result = manager.render('custom-lang', card);
    expect(result).toBe('rendered:myCardData');
  });

  it('should test MTG Extension decklist paste detection', async () => {
    // Register the MTG extension
    manager.register(MtgExtension);

    // Mock Scryfall API response
    const mockScryfallResponse = {
      data: [
        { name: 'Black Lotus', type_line: 'Artifact', prices: { usd: '25000.00' }, mana_cost: '{0}', oracle_text: 'T, Sacrifice: Add 3 mana.' },
        { name: 'Ancestral Recall', type_line: 'Instant', prices: { usd: '5000.00' }, mana_cost: '{U}', oracle_text: 'Target player draws 3 cards.' }
      ]
    };

    global.fetch.mockResolvedValue({
      json: vi.fn().mockResolvedValue(mockScryfallResponse)
    });

    const createNewCard = vi.fn((text, x, y, opts) => ({ id: 42, text, x, y, ...opts }));
    const animateCardSpawn = vi.fn();
    const saveState = vi.fn();

    // Mock document.getElementById('hint')
    const mockHint = document.createElement('div');
    mockHint.id = 'hint';
    document.body.appendChild(mockHint);

    // Paste an MTG deck list (3+ cards is standard)
    const decklistText = `4 Black Lotus\n4 Ancestral Recall\n5 Island`;
    
    const context = {
      center: { x: 100, y: 100 },
      createNewCard,
      saveState,
      animateCardSpawn
    };

    const handled = await manager.handlePaste(decklistText, context);

    expect(handled).toBe(true);
    expect(createNewCard).toHaveBeenCalled();
    
    // Cleanup DOM
    mockHint.remove();
  });
});
