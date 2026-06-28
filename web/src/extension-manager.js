export class ExtensionManager {
  constructor() {
    this.languages = new Map();
    this.pasteHandlers = [];
    this.renderers = new Map();
    this.postRenderers = [];
    this.extensions = []; // Tracks registered extension names
  }

  register(extension) {
    if (!extension) return;
    const name = extension.name || 'Unnamed Extension';
    if (!this.extensions.includes(name)) {
      this.extensions.push(name);
    }

    let enabled = true;
    try {
      const saved = localStorage.getItem(`mdway-ext-${name}`);
      if (saved !== null) {
        enabled = JSON.parse(saved);
      }
    } catch (e) {}

    if (enabled && typeof extension.onInit === 'function') {
      extension.onInit(this);
    }
  }

  isExtensionEnabled(name) {
    try {
      const saved = localStorage.getItem(`mdway-ext-${name}`);
      if (saved !== null) return JSON.parse(saved);
    } catch (e) {}
    return true; // Default to enabled
  }

  setExtensionEnabled(name, enabled) {
    try {
      localStorage.setItem(`mdway-ext-${name}`, JSON.stringify(enabled));
    } catch (e) {}
  }

  registerLanguage(lang) {
    this.languages.set(lang.name, lang);
  }

  getLanguageStyle(langName) {
    return this.languages.get(langName);
  }

  registerPasteHandler(handler) {
    this.pasteHandlers.push(handler);
  }

  async handlePaste(text, context) {
    for (const handler of this.pasteHandlers) {
      try {
        const handled = await handler(text, context);
        if (handled) return true;
      } catch (err) {
        console.error('Error in extension paste handler:', err);
      }
    }
    return false;
  }

  registerRenderer(langName, renderFn) {
    this.renderers.set(langName, renderFn);
  }

  hasRenderer(langName) {
    return this.renderers.has(langName);
  }

  render(langName, card) {
    const renderFn = this.renderers.get(langName);
    return renderFn ? renderFn(card) : '';
  }

  registerPostRenderer(handler) {
    this.postRenderers.push(handler);
  }

  runPostRender(el, card, context) {
    for (const handler of this.postRenderers) {
      try {
        handler(el, card, context);
      } catch (err) {
        console.error('Error in extension post-render hook:', err);
      }
    }
  }
}

export const extensionManager = new ExtensionManager();
