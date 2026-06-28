// web/renderer.js - Web Distribution Entry Point

import { extensionManager } from 'extension-manager';
import { MtgExtension } from '../extensions/mtg/mtg-extension.js';

// Register the Magic: The Gathering extension
extensionManager.register(MtgExtension);

// Run the core shared application logic
import '../src/renderer.js';
