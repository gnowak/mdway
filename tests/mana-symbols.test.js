import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ipc } from '../web/ipc.js';

describe('MTG Mana Symbols Translation', () => {
  beforeEach(() => {
    // Mock window.marked and window.hljs
    global.window = {
      marked: {
        parse: vi.fn((text) => text) // simple identity parser for testing
      },
      hljs: {
        getLanguage: vi.fn(() => null),
        highlightAuto: vi.fn((text) => ({ value: text }))
      }
    };
  });

  it('should translate single and multiple mana symbols to Scryfall image tags', () => {
    const input = 'Angler Turtle {5}{U}{U}';
    const output = ipc.renderCardBody(input, 'markdown', true);
    
    expect(output).toContain('https://svgs.scryfall.io/card-symbols/5.svg');
    expect(output).toContain('https://svgs.scryfall.io/card-symbols/U.svg');
  });

  it('should translate hybrid mana symbols correctly', () => {
    const input = 'Spawns {W/U} and {2/W}';
    const output = ipc.renderCardBody(input, 'markdown', true);
    
    expect(output).toContain('https://svgs.scryfall.io/card-symbols/WU.svg');
    expect(output).toContain('https://svgs.scryfall.io/card-symbols/2W.svg');
  });

  it('should not translate symbols inside pre or code blocks', () => {
    // Simulating marked output with pre/code tags
    const input = 'Header {U}\n<pre><code>code block {U}</code></pre>\nInline <code>{U}</code>';
    
    // We mock marked.parse to just return the input HTML-like structure directly
    global.window.marked.parse = (text) => text;
    
    const output = ipc.renderCardBody(input, 'markdown', true);
    
    // Header should be translated
    expect(output).toContain('https://svgs.scryfall.io/card-symbols/U.svg');
    // Pre block should remain intact
    expect(output).toContain('<code class="hljs">code block {U}</code>');
    // Inline code block should remain intact
    expect(output).toContain('<code>{U}</code>');
  });
});
