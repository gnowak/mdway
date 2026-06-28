// standalone/renderer.js - Standalone/Electron Entry Point

import { extensionManager } from 'extension-manager';
import { MtgExtension } from '../extensions/mtg/mtg-extension.js';
import { SvgExtension } from '../extensions/svg/svg-extension.js';
import { ColorExtension } from '../extensions/color/color-extension.js';

// Register extensions
extensionManager.register(MtgExtension);
extensionManager.register(SvgExtension);
extensionManager.register(ColorExtension);

// Run the core shared application logic
import '../src/renderer.js';
