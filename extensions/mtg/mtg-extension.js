// mtg-extension.js - Magic: The Gathering Decklist and Scryfall Integration Extension

import { ipc } from 'ipc';

// ── MTG Helper Logic ──

function parseMtgDecklist(deckText) {
  const lines = deckText.split('\n');
  const cards = [];
  
  for (const line of lines) {
    const cleanLine = line.trim();
    if (!cleanLine) continue;

    const match = cleanLine.match(/^\s*(\d+)\s*x?\s+([^(#\n]+)/i);
    if (match) {
      const qty = parseInt(match[1], 10);
      let name = match[2].trim();
      
      name = name.replace(/\s+\/\/*\s*$/, '').trim();
      
      if (name && qty > 0) {
        cards.push({ name, qty });
      }
    }
  }
  return cards;
}

function categorizeMtgCards(scryfallCards) {
  const categories = {
    'Creatures': [],
    'Planeswalkers': [],
    'Instants': [],
    'Sorceries': [],
    'Artifacts': [],
    'Enchantments': [],
    'Lands': [],
    'Other': []
  };

  scryfallCards.forEach(card => {
    const type = card.type_line ? card.type_line.toLowerCase() : '';

    if (type.includes('planeswalker')) {
      categories['Planeswalkers'].push(card);
    } else if (type.includes('creature')) {
      categories['Creatures'].push(card);
    } else if (type.includes('instant')) {
      categories['Instants'].push(card);
    } else if (type.includes('sorcery')) {
      categories['Sorceries'].push(card);
    } else if (type.includes('artifact')) {
      categories['Artifacts'].push(card);
    } else if (type.includes('enchantment')) {
      categories['Enchantments'].push(card);
    } else if (type.includes('land')) {
      categories['Lands'].push(card);
    } else {
      categories['Other'].push(card);
    }
  });

  const filtered = {};
  Object.keys(categories).forEach(key => {
    if (categories[key].length > 0) {
      filtered[key] = categories[key].sort((a, b) => a.name.localeCompare(b.name));
    }
  });

  return filtered;
}

function formatMtgCardToMarkdown(card) {
  const price = card.prices && card.prices.usd ? `$${card.prices.usd}` : 'N/A';
  const manaCost = card.mana_cost ? ` ${card.mana_cost}` : '';
  const oracleText = card.oracle_text ? card.oracle_text.split('\n').map(l => `> ${l}`).join('\n') : '*No text*';
  
  let imageUri = '';
  if (card.image_uris && card.image_uris.normal) {
    imageUri = card.image_uris.normal;
  } else if (card.card_faces && card.card_faces[0].image_uris && card.card_faces[0].image_uris.normal) {
    imageUri = card.card_faces[0].image_uris.normal;
  }

  let md = `# [${card.name}](${card.scryfall_uri || 'https://scryfall.com'}) ${manaCost}\n`;
  md += `**Type**: ${card.type_line || 'Unknown'}\n`;
  md += `**Price**: ${price}\n\n`;
  md += `${oracleText}\n\n`;
  
  if (imageUri) {
    md += `![Card Art](${imageUri})\n`;
  }
  
  return md;
}

async function fetchMtgDeckFromScryfall(cardsToFetch) {
  const results = [];
  const chunkSize = 75;

  for (let i = 0; i < cardsToFetch.length; i += chunkSize) {
    const chunk = cardsToFetch.slice(i, i + chunkSize);
    const identifiers = chunk.map(c => ({ name: c.name }));

    try {
      const response = await fetch('https://api.scryfall.com/cards/collection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'MDway/1.0 (contact@mdway.app) Scryfall-Integration/1.0'
        },
        body: JSON.stringify({ identifiers })
      });
      
      const responseData = await response.json();
      if (responseData && responseData.data) {
        responseData.data.forEach(cardData => {
          const orig = chunk.find(c => {
            const cardNameLower = cardData.name.toLowerCase();
            const queryLower = c.name.toLowerCase();
            return cardNameLower === queryLower || 
                   (cardData.name.includes('//') && 
                    cardData.name.split('//').map(p => p.trim().toLowerCase()).includes(queryLower));
          });
          cardData.qty = orig ? orig.qty : 1;
          results.push(cardData);
        });
      }
    } catch (e) {
      console.error('Scryfall API Error:', e.message);
    }

    if (i + chunkSize < cardsToFetch.length) {
      await new Promise(r => setTimeout(r, 100));
    }
  }

  return { success: true, cards: results };
}

function renderMtgDeckBody(deckData) {
  const categorized = categorizeMtgCards(deckData);
  let html = '<div class="mtg-deck-bd">';

  Object.keys(categorized).forEach(category => {
    const list = categorized[category];
    const totalQty = list.reduce((sum, c) => sum + (c.qty || 1), 0);
    html += `<div class="mtg-cat-hd">${category} (${totalQty})</div>`;
    html += '<ul class="mtg-card-list">';

    list.forEach(c => {
      let imageUri = '';
      if (c.image_uris && c.image_uris.normal) {
        imageUri = c.image_uris.normal;
      } else if (c.card_faces && c.card_faces[0].image_uris && c.card_faces[0].image_uris.normal) {
        imageUri = c.card_faces[0].image_uris.normal;
      }

      const escapedName = ipc.escapeHtml(c.name);
      const serializedCard = encodeURIComponent(JSON.stringify(c));

      html += `
        <li class="mtg-card-item" 
            data-image="${imageUri}" 
            data-card="${serializedCard}">
          <span class="mtg-qty">${c.qty || 1}x</span> 
          <span class="mtg-name">${escapedName}</span>
        </li>`;
    });

    html += '</ul>';
  });

  html += '</div>';
  return html;
}

// ── Extension Definition ──

export const MtgExtension = {
  name: 'Magic: The Gathering',
  onInit(manager) {
    // 1. Register language styles
    manager.registerLanguage({
      name: 'mtg-deck',
      label: 'DECK',
      color: '#bf80ff'
    });

    // 2. Register paste handler
    manager.registerPasteHandler(async (text, { center, createNewCard, saveState, animateCardSpawn }) => {
      const parsedMtg = parseMtgDecklist(text);
      if (parsedMtg.length < 3) return false;

      const placeholderText = `# Loading MTG Decklist...\nFetching ${parsedMtg.length} cards from Scryfall API. Please wait...`;
      const card = createNewCard(placeholderText, center.x - 200, center.y - 80, { lang: 'markdown', showMd: true });
      
      const el = document.querySelector(`.card[data-id="${card.id}"]`);
      if (el) animateCardSpawn(el);
      document.getElementById('hint').classList.add('gone');

      try {
        const res = await fetchMtgDeckFromScryfall(parsedMtg);
        if (res && res.success && res.cards && res.cards.length > 0) {
          if (el) el.remove();
          createNewCard(text, card.x, card.y, {
            id: card.id,
            lang: 'mtg-deck',
            showMd: true,
            w: 320,
            h: 460,
            deckData: res.cards
          });
        } else {
          card.text = `# MTG Decklist Import Failed\n\n*(Scryfall query returned no cards)*\n\nRaw text:\n\`\`\`\n${text}\n\`\`\``;
          if (el) {
            el.querySelector('.card-bd').innerHTML = ipc.renderCardBody(card.text, card.lang, card.showMd);
          }
        }
      } catch (err) {
        card.text = `# MTG Decklist Import Error\n\n*Error: ${err.message}*\n\nRaw text:\n\`\`\`\n${text}\n\`\`\``;
        if (el) {
          el.querySelector('.card-bd').innerHTML = ipc.renderCardBody(card.text, card.lang, card.showMd);
        }
      }
      saveState();
      return true;
    });

    // 3. Register custom renderer
    manager.registerRenderer('mtg-deck', (card) => {
      return renderMtgDeckBody(card.deckData || []);
    });

    // 4. Register post-render hook (event bindings)
    manager.registerPostRenderer((el, card, { createNewCard }) => {
      if (card.lang !== 'mtg-deck' || !card.showMd) return;

      const items = el.querySelectorAll('.mtg-card-item');
      const preview = document.getElementById('mtg-preview');

      items.forEach(item => {
        // Hover Enter
        item.addEventListener('mouseenter', () => {
          const image = item.dataset.image;
          if (image && preview) {
            preview.innerHTML = `<img src="${image}" style="max-height: 380px; width: auto; border-radius: 10px; box-shadow: 0 10px 40px rgba(0,0,0,0.85); border: 1px solid var(--border);">`;
            preview.classList.add('active');
          }
        });

        // Hover Leave
        item.addEventListener('mouseleave', () => {
          if (preview) {
            preview.classList.remove('active');
            preview.innerHTML = '';
          }
        });

        // Click
        item.addEventListener('click', e => {
          e.stopPropagation();
          try {
            const cardObj = JSON.parse(decodeURIComponent(item.dataset.card));
            const mdContent = formatMtgCardToMarkdown(cardObj);

            const spawnX = card.x + el.offsetWidth + 24;
            const spawnY = card.y;

            createNewCard(mdContent, spawnX, spawnY, { lang: 'markdown', showMd: true });
            
            if (preview) {
              preview.classList.remove('active');
              preview.innerHTML = '';
            }
          } catch (err) {
            console.error('Failed to spawn MTG card note:', err);
          }
        });
      });
    });

    // 5. Append hover preview container and mouse tracking
    if (!document.getElementById('mtg-preview')) {
      const previewEl = document.createElement('div');
      previewEl.id = 'mtg-preview';
      document.body.appendChild(previewEl);
    }

    const preview = document.getElementById('mtg-preview');
    window.addEventListener('mousemove', e => {
      if (preview && preview.classList.contains('active')) {
        const offsetX = 24;
        const offsetY = -150;
        preview.style.left = (e.clientX + offsetX) + 'px';
        preview.style.top = (e.clientY + offsetY) + 'px';
      }
    });

    // 6. Dynamically inject extension stylesheet
    if (!document.querySelector('link[href*="mtg-extension.css"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      
      // Determine stylesheet path relative to current html file
      // In both standalone and web index.html, this will resolve to the correct path
      link.href = '../extensions/mtg/mtg-extension.css';
      document.head.appendChild(link);
    }
  }
};
