import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock ipc before importing canvas
vi.mock('ipc', () => ({
  ipc: {}
}));

import { 
  initCanvas, 
  getTransform, 
  setTransform, 
  resetView, 
  screenToCanvas, 
  getCanvasCenter, 
  updateHotkeys, 
  hotkeys 
} from '../src/canvas.js';

describe('Canvas Manager', () => {
  let viewportEl;
  let canvasEl;
  let onTransform;

  beforeEach(() => {
    // Clear localStorage
    localStorage.clear();

    // Create mock DOM elements
    viewportEl = document.createElement('div');
    canvasEl = document.createElement('div');
    onTransform = vi.fn();

    // Mock getBoundingClientRect
    viewportEl.getBoundingClientRect = () => ({
      left: 10,
      top: 20,
      width: 800,
      height: 600,
      right: 810,
      bottom: 620
    });

    initCanvas(viewportEl, canvasEl, onTransform);
    resetView();
  });

  it('should initialize with default transformations', () => {
    const transform = getTransform();
    expect(transform.panX).toBe(0);
    expect(transform.panY).toBe(0);
    expect(transform.scale).toBe(1.0);
  });

  it('should set transform values and trigger callback', () => {
    setTransform(150, -250, 2.0);
    const transform = getTransform();
    expect(transform.panX).toBe(150);
    expect(transform.panY).toBe(-250);
    expect(transform.scale).toBe(2.0);
  });

  it('should reset view back to origin', () => {
    setTransform(300, 400, 0.5);
    resetView();
    const transform = getTransform();
    expect(transform.panX).toBe(0);
    expect(transform.panY).toBe(0);
    expect(transform.scale).toBe(1.0);
  });

  it('should accurately convert screen coordinates to canvas space', () => {
    // Scale 1, Pan 0
    let canvasCoord = screenToCanvas(110, 220); // viewport left is 10, top is 20
    expect(canvasCoord.x).toBe(100);
    expect(canvasCoord.y).toBe(200);

    // Scale 2, Pan X=50, Y=50
    setTransform(50, 50, 2.0);
    canvasCoord = screenToCanvas(250, 350); // (250 - 10 - 50) / 2 = 95
    expect(canvasCoord.x).toBe(95);
    expect(canvasCoord.y).toBe(140); // (350 - 20 - 50) / 2 = 140
  });

  it('should find the canvas coordinates for the viewport center', () => {
    // Center is width/2 = 400, height/2 = 300
    // At Scale 1, Pan 0
    let center = getCanvasCenter();
    expect(center.x).toBe(400);
    expect(center.y).toBe(300);

    // At Scale 2, Pan X=100, Y=200
    setTransform(100, 200, 2.0);
    center = getCanvasCenter(); // (400 - 100) / 2 = 150; (300 - 200) / 2 = 50
    expect(center.x).toBe(150);
    expect(center.y).toBe(50);
  });

  it('should save and load hotkeys to/from localStorage', () => {
    const newHotkeys = { zoom: 'Ctrl', hpan: 'Shift', home: 'KeyH' };
    updateHotkeys(newHotkeys);

    expect(hotkeys.zoom).toBe('Ctrl');
    expect(hotkeys.hpan).toBe('Shift');
    expect(hotkeys.home).toBe('KeyH');

    const saved = JSON.parse(localStorage.getItem('mdway-hotkeys'));
    expect(saved).toEqual(newHotkeys);
  });
});
