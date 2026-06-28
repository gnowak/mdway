# MDway — Quick Start

**MDway** is an infinite sticky-note canvas. Paste anything, anywhere.

---

## Install

| Format | File | Notes |
|---|---|---|
| Installer | `MDway Setup 1.0.0.exe` | Installs to Program Files, file associations |
| Portable | `MDway-1.0.0-portable.exe` | Run anywhere, no install needed |
| Web | Serve `web/` folder | Works in any browser, saves to localStorage |

---

## Core Actions

| Action | How |
|---|---|
| **Paste a card** | `Ctrl+V` — pastes clipboard as a new card |
| **Move** | Drag the card **header bar** |
| **Edit** | Double-click the card **body** |
| **Resize** | Drag any **border or corner** |
| **Delete** | Enable 🪚 Chainsaw Mode (titlebar), then click a card |
| **Duplicate** | Click `⎘` in the card header |
| **Extract colours** | Click `🎨` (eyedropper) in the card header |
| **Pan canvas** | Left-click drag the background |
| **Zoom** | Hold **Shift** + scroll |
| **Reset view** | Press **Space** |
| **Undo / Redo** | `Ctrl+Z` / `Ctrl+Y` |
| **Save** | Click 💾 in the titlebar |
| **Settings** | Click ⚙ in the titlebar |

---

## What Can I Paste?

- **Plain text / Markdown** → rendered note card
- **Code** (JS, Python, CSS, SQL, and 40+ more) → syntax-highlighted card
- **A URL** → scraped preview card (title, description, favicon)
- **An MTG decklist** → Scryfall card art and deck breakdown
- **SVG markup** → live SVG preview card
- **A colour value** (hex, rgb, hsl) → colour swatch card
- **Multiple colour values** → colour palette grid card

---

## Card Types Reference

| Label | Triggered by |
|---|---|
| MD | Markdown patterns (`#`, `**`, `- `, etc.) |
| SVG | Content starting with `<svg` |
| CLR | Single colour value (`#fff`, `rgb(…)`, `hsl(…)`) |
| PAL | Multiple colour values pasted together |
| MTG | A deck list format (quantities + card names) |
| LINK | A bare URL |
| (code) | Any other pasted text — auto-detected language |

---

## Extending MDway

Drop a new folder + JS file in the `extensions/` directory.  
Open **Settings → Developer → Open in Explorer** to get there quickly.

See `extensions/svg/svg-extension.js` for a minimal template.

---

## Theming

Edit `src/index.css` — each theme is a `.theme-*` CSS block with custom property overrides.

---

## Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+V` | Paste new card |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` | Redo |
| `Space` | Reset view to origin |
| `Shift`+scroll | Zoom |
| `Ctrl`+scroll | Horizontal pan |
| `Ctrl+Shift+I` | Open DevTools (standalone only) |
| `Escape` | Close any open dialog / overlay |

---

> Full documentation: [github.com/gnowak/mdway](https://github.com/gnowak/mdway)
