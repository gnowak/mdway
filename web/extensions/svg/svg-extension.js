// svg-extension.js - SVG rendering extension for MDway
export const SvgExtension = {
  name: 'SVG Graphics Renderer',
  onInit(manager) {
    // 1. Register language styling
    manager.registerLanguage({
      name: 'svg',
      label: 'SVG',
      color: '#f15a24'
    });

    // 2. Register paste handler
    manager.registerPasteHandler(async (text, { center, createNewCard, saveState, animateCardSpawn }) => {
      const clean = text.trim();
      if (clean.startsWith('<svg') && clean.endsWith('</svg>')) {
        const card = createNewCard(clean, center.x - 200, center.y - 120, {
          lang: 'svg',
          showMd: true,
          w: 400,
          h: 300
        });

        const el = document.querySelector(`.card[data-id="${card.id}"]`);
        if (el) animateCardSpawn(el);
        document.getElementById('hint').classList.add('gone');
        saveState();
        return true;
      }
      return false;
    });

    // 3. Register custom renderer
    manager.registerRenderer('svg', (card) => {
      return `<div class="svg-card-wrap">${card.text}</div>`;
    });
  }
};
