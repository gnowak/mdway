// color-extension.js - Color picker and swatch utility extension for MDway

export const ColorExtension = {
  name: 'Color Swatch Picker',
  onInit(manager) {
    // 1. Register language styles
    manager.registerLanguage({
      name: 'color-code',
      label: 'CLR',
      color: '#10b981'
    });

    manager.registerLanguage({
      name: 'color-palette',
      label: 'PAL',
      color: '#059669'
    });

    // 2. Register paste handlers
    manager.registerPasteHandler(async (text, { center, createNewCard, saveState, animateCardSpawn }) => {
      const clean = text.trim();
      
      // Check if it's a single color code
      const isHex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(clean);
      const isRgb = /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/i.test(clean);
      const isHsl = /^hsl\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*\)$/i.test(clean);
      
      if (isHex || isRgb || isHsl) {
        const card = createNewCard(clean, center.x - 120, center.y - 120, {
          lang: 'color-code',
          showMd: true,
          w: 220,
          h: 220
        });

        const el = document.querySelector(`.card[data-id="${card.id}"]`);
        if (el) animateCardSpawn(el);
        document.getElementById('hint').classList.add('gone');
        saveState();
        return true;
      }

      // Check if it's a multi-line color palette
      const lines = clean.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.length > 1) {
        const allColors = lines.every(l => {
          return /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(l) ||
                 /^rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)$/i.test(l) ||
                 /^hsl\(\s*\d+\s*,\s*\d+%\s*,\s*\d+%\s*\)$/i.test(l);
        });

        if (allColors) {
          const card = createNewCard(clean, center.x - 120, center.y - 150, {
            lang: 'color-palette',
            showMd: true,
            w: 240,
            h: 300
          });

          const el = document.querySelector(`.card[data-id="${card.id}"]`);
          if (el) animateCardSpawn(el);
          document.getElementById('hint').classList.add('gone');
          saveState();
          return true;
        }
      }

      return false;
    });

    // 3. Register custom renderers
    manager.registerRenderer('color-code', (card) => {
      const color = card.text.trim();
      const hexVal = convertColorToHex(color);
      return `
        <div class="color-card-bd">
          <div class="color-swatch" style="background: ${color};"></div>
          <div class="color-details">
            <span class="color-value">${color}</span>
            <input type="color" class="color-picker" value="${hexVal}">
          </div>
        </div>
      `;
    });

    manager.registerRenderer('color-palette', (card) => {
      const colors = card.text.split('\n').map(c => c.trim()).filter(Boolean);
      let swatchesHtml = colors.map((color, idx) => {
        const hexVal = convertColorToHex(color);
        return `
          <div class="palette-item" data-index="${idx}">
            <div class="palette-swatch" style="background: ${color};" title="${color}"></div>
            <div class="palette-info">
              <span class="palette-color-val">${color}</span>
              <input type="color" class="palette-picker" value="${hexVal}" data-index="${idx}">
            </div>
          </div>
        `;
      }).join('');

      return `
        <div class="palette-card-bd">
          <div class="palette-grid">
            ${swatchesHtml}
          </div>
        </div>
      `;
    });

    // 4. Register post-render hooks (inputs and state syncing)
    manager.registerPostRenderer((el, card, { saveState }) => {
      if (!card.showMd) return;

      // Color Swatch single picker
      if (card.lang === 'color-code') {
        const picker = el.querySelector('.color-picker');
        const swatch = el.querySelector('.color-swatch');
        const valSpan = el.querySelector('.color-value');
        
        if (picker) {
          picker.addEventListener('input', (e) => {
            const newColor = e.target.value;
            card.text = newColor;
            if (swatch) swatch.style.background = newColor;
            if (valSpan) valSpan.textContent = newColor;
            
            if (typeof window.mdwayAutosave === 'function') {
              window.mdwayAutosave();
            } else {
              saveState();
            }
          });
        }
      }

      // Color Palette multi picker
      if (card.lang === 'color-palette') {
        const pickers = el.querySelectorAll('.palette-picker');
        pickers.forEach(picker => {
          picker.addEventListener('input', (e) => {
            const idx = parseInt(e.target.dataset.index, 10);
            const newColor = e.target.value;
            
            const colors = card.text.split('\n').map(c => c.trim()).filter(Boolean);
            colors[idx] = newColor;
            card.text = colors.join('\n');
            
            const items = el.querySelectorAll('.palette-item');
            if (items[idx]) {
              const swatch = items[idx].querySelector('.palette-swatch');
              const valSpan = items[idx].querySelector('.palette-color-val');
              if (swatch) swatch.style.background = newColor;
              if (valSpan) valSpan.textContent = newColor;
            }
            
            if (typeof window.mdwayAutosave === 'function') {
              window.mdwayAutosave();
            } else {
              saveState();
            }
          });
        });
      }
    });
  }
};

// Helper function to convert RGB/HSL/ShortHex colors to standard hex format
function convertColorToHex(str) {
  const clean = str.trim().toLowerCase();
  if (clean.startsWith('#')) {
    if (clean.length === 4) {
      return '#' + clean[1] + clean[1] + clean[2] + clean[2] + clean[3] + clean[3];
    }
    return clean;
  }
  
  const rgbMatch = clean.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1], 10);
    const g = parseInt(rgbMatch[2], 10);
    const b = parseInt(rgbMatch[3], 10);
    return '#' + [r, g, b].map(x => {
      const hex = x.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
  }
  
  const hslMatch = clean.match(/^hsl\(\s*(\d+)\s*,\s*(\d+)%\s*,\s*(\d+)%\s*\)$/);
  if (hslMatch) {
    const h = parseInt(hslMatch[1], 10) / 360;
    const s = parseInt(hslMatch[2], 10) / 100;
    const l = parseInt(hslMatch[3], 10) / 100;
    let r, g, b;
    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
      };
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1/3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1/3);
    }
    return '#' + [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)].map(x => {
      const hex = x.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    }).join('');
  }
  
  return '#8b5cf6';
}
