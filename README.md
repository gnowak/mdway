# MDway

> An infinite, draggable sticky-note canvas for developers — paste code, markdown, links, SVG, and more.

MDway is a lightweight Electron desktop app (with a companion web build) that lets you drop cards anywhere on an infinite canvas. Cards auto-detect their content type and render syntax-highlighted code, styled markdown, SVG graphics, MTG deck lists, and colour swatches — all on a zoomable, pannable board you can save and reopen.

---

## Features

- **Infinite canvas** — pan with click-drag, zoom with Shift+scroll, reset with Space
- **Smart card detection** — pastes auto-detect Markdown, code (40+ languages), URLs, MTG deck lists, SVG, and colour values
- **Rich card types** — Markdown preview, code with syntax highlighting, Mermaid diagrams, SVG viewer, colour swatch, colour palette extractor
- **URL scraping** — paste a web link and get a preview card with title, description, and favicon
- **MTG integration** — paste a decklist and fetch Scryfall card art and metadata automatically
- **Eyedropper** — extract colour values from any card into a Palette card
- **Duplication** — copy any card with a single click
- **Undo / Redo** — full history stack with `Ctrl+Z` / `Ctrl+Y` or titlebar arrows
- **Chainsaw mode** — toggle a destructive delete mode with a themed confirmation dialog
- **Extension system** — drop a JS file in `extensions/` to add new card types or languages
- **Four themes** — Blue Jays (default), Dark Purple, Soft Pastel, Minimalist B&W
- **Portable & installable** — runs as an NSIS installer, a portable `.exe`, or a static web app

---

## Installation

### Option 1 — Installer (recommended)
Download `MDway Setup 1.0.0.exe` from [Releases](https://github.com/gnowak/mdway/releases) and run it.  
Installs to Program Files, creates Start Menu and Desktop shortcuts, registers `.mdway` file associations.

### Option 2 — Portable
Download `MDway-1.0.0-portable.exe` from [Releases](https://github.com/gnowak/mdway/releases).  
No installation required — run it directly. Settings are stored in `%AppData%\MDway`.

### Option 3 — Web (self-hosted)
Serve the `web/` directory with any static host:

```bash
# Local preview
cd web
npx -y http-server -p 8080
# Then open http://localhost:8080
```

All canvas data is stored in the browser's `localStorage`.

---

## Building from Source

**Prerequisites:** Node.js ≥ 18, npm

```bash
git clone https://github.com/gnowak/mdway.git
cd mdway
npm install

# Run in development (Electron)
npm start

# Run tests
npm test

# Build all distribution targets (installer + portable + zip)
npm run dist

# Or build individual targets
npm run dist:installer
npm run dist:portable
npm run dist:zip
```

Output goes to `dist/`.

---

## Usage Quickstart

| Action | How |
|---|---|
| **Add a card** | `Ctrl+V` — pastes clipboard contents as a new card |
| **Move a card** | Drag the card **header** |
| **Edit a card** | Double-click the card **body** |
| **Resize a card** | Drag any **border or corner** |
| **Delete a card** | Enable 🪚 Chainsaw Mode, then click any card |
| **Duplicate a card** | Click the `⎘` button in the card header |
| **Extract colours** | Click the `🎨` eyedropper button in the card header |
| **Pan canvas** | Left-click drag the background |
| **Zoom** | Hold Shift + scroll wheel |
| **Reset view** | Press Space |
| **Undo / Redo** | `Ctrl+Z` / `Ctrl+Y`, or ↶↷ in the titlebar |
| **Save canvas** | Click the 💾 button in the titlebar |
| **Open settings** | Click ⚙ in the titlebar |

---

## Card Types

| Label | Language | Description |
|---|---|---|
| MD | `markdown` | Rendered Markdown with Mermaid diagram support |
| JS / TS / PY … | code languages | Syntax-highlighted code |
| SVG | `svg` | Inline SVG renderer |
| CLR | `color` | Colour swatch with HSL/RGB/Hex inputs |
| PAL | `color-palette` | Multi-colour palette grid |
| MTG | `mtg` | Magic: The Gathering deck list with Scryfall art |
| LINK | `link` | Scraped URL preview card |

---

## Extension System

Extensions live in the `extensions/` directory. Each extension is a subdirectory with a JS file that exports a class extending `Extension`.

```
extensions/
  my-extension/
    my-extension.js   ← export class MyExtension extends Extension { … }
```

**Key hooks:**
- `getLanguages()` — declare card types this extension handles
- `render(text, lang)` — return HTML for the card body
- `onCardCreated(card, el)` — attach DOM event listeners after render
- `onPaste(text)` — intercept paste events to detect your format

See `extensions/svg/svg-extension.js` for a minimal example.

To open the extensions folder from within the app: **Settings → Developer → Open in Explorer**.

---

## Theming

All theme variables are in `src/index.css` under `.theme-*` selectors. Copy an existing theme block, give it a new class name, and add it to the theme `<select>` in `standalone/index.html` and `web/index.html`.

---

## Contributing

Issues and PRs are welcome. Please open an issue first for significant changes.

---

## License

MIT © Geoff Nowak
