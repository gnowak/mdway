// standalone/ipc.js - Desktop Electron implementation of the IPC interface

export const ipc = {
  close: () => {
    window.api.close();
  },
  minimize: () => {
    window.api.minimize();
  },
  setPin: (pinned) => {
    window.api.setPin(pinned);
  },
  saveCanvas: async (data) => {
    return await window.api.saveCanvas(data);
  },
  loadCanvas: async () => {
    return await window.api.loadCanvas();
  },
  exportFile: async (content, defaultFilename, filters) => {
    return await window.api.exportFile(content, defaultFilename, filters);
  },
  fetchLinkMetadata: async (url) => {
    return await window.api.fetchLinkMetadata(url);
  },
  queryOllama: async (model, prompt) => {
    return await window.api.queryOllama(model, prompt);
  },
  renderCardBody: (text, lang, showMd) => {
    return window.api.renderCardBody(text, lang, showMd);
  },
  detectLanguage: (text) => {
    return window.api.detectLanguage(text);
  },
  escapeHtml: (text) => {
    return window.api.escapeHtml(text);
  }
};
