import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      'ipc': path.resolve(__dirname, './standalone/ipc.js'),
      'canvas': path.resolve(__dirname, './src/canvas.js'),
      'card': path.resolve(__dirname, './src/card.js'),
      'extension-manager': path.resolve(__dirname, './src/extension-manager.js')
    }
  },
  test: {
    environment: 'jsdom'
  }
});
