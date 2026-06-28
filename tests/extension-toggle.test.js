import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExtensionManager } from '../src/extension-manager.js';

describe('ExtensionManager Toggles', () => {
  let manager;

  beforeEach(() => {
    localStorage.clear();
    manager = new ExtensionManager();
  });

  it('should register extensions and run onInit if enabled (default)', () => {
    const mockExtension = {
      name: 'Test Extension',
      onInit: vi.fn()
    };

    manager.register(mockExtension);

    expect(manager.extensions).toContain('Test Extension');
    expect(mockExtension.onInit).toHaveBeenCalledWith(manager);
    expect(manager.isExtensionEnabled('Test Extension')).toBe(true);
  });

  it('should register extension name but NOT run onInit if disabled', () => {
    const mockExtension = {
      name: 'Disabled Extension',
      onInit: vi.fn()
    };

    // Disable the extension
    manager.setExtensionEnabled('Disabled Extension', false);

    // Register it
    manager.register(mockExtension);

    expect(manager.extensions).toContain('Disabled Extension');
    expect(mockExtension.onInit).not.toHaveBeenCalled();
    expect(manager.isExtensionEnabled('Disabled Extension')).toBe(false);
  });

  it('should persist enabled/disabled status in localStorage', () => {
    manager.setExtensionEnabled('Color Swatch', false);
    expect(manager.isExtensionEnabled('Color Swatch')).toBe(false);

    manager.setExtensionEnabled('Color Swatch', true);
    expect(manager.isExtensionEnabled('Color Swatch')).toBe(true);
  });
});
