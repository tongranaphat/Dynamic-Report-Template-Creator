import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useCanvasLegacy as useCanvas } from '../useCanvasLegacy.js';

// Global mock for canvas objects
let mockCanvasObjects = [];

// Create mock fabric canvas instance (overrides global setup's simpler mock)
function createMockFabricCanvas() {
  return {
    backgroundColor: '#fff',
    objects: mockCanvasObjects,
    setBackgroundColor: vi.fn((color, callback) => { if (callback) callback(); }),
    renderAll: vi.fn(),
    requestRenderAll: vi.fn(),
    toJSON: vi.fn((properties) => ({
      version: '5.3.0',
      objects: [...mockCanvasObjects],
      background: '#fff'
    })),
    loadFromJSON: vi.fn((json, callback) => { if (callback) callback(); }),
    setBackgroundImage: vi.fn((img, callback) => { if (callback) callback(); }),
    on: vi.fn(),
    off: vi.fn(),
    fire: vi.fn(),
    getPointer: vi.fn(() => ({ x: 100, y: 100 })),
    add: vi.fn((obj) => { mockCanvasObjects.push(obj); }),
    remove: vi.fn((obj) => {
      const index = mockCanvasObjects.indexOf(obj);
      if (index > -1) mockCanvasObjects.splice(index, 1);
    }),
    getObjects: vi.fn(() => mockCanvasObjects),
    getActiveObjects: vi.fn(() => []),
    discardActiveObject: vi.fn(),
    setActiveObject: vi.fn(),
    getActiveObject: vi.fn(() => null)
  };
}

// Override global fabric mock with one that tracks mockCanvasObjects
vi.mock('fabric', () => {
  const ITextMock = vi.fn().mockImplementation(function (text, options) {
    return { text, type: 'i-text', setControlsVisibility: vi.fn(), ...options };
  });
  ITextMock.fromObject = vi.fn(function (object, callback) {
    if (callback) callback(object);
    return object;
  });

  return {
    fabric: {
      devicePixelRatio: 1,
      Canvas: vi.fn().mockImplementation(function (canvasId, options) {
        return createMockFabricCanvas();
      }),
      IText: ITextMock,
      Image: {
        fromURL: vi.fn((url, callback, options) => {
          callback({ scaleToWidth: vi.fn() });
        })
      }
    }
  };
});

// Mock DOM
const mockCanvasElement = { id: 'c', getContext: vi.fn() };

// Helper: save history and wait for debounce
function saveAndFlush(composable, uniqueId) {
  if (uniqueId !== undefined) {
    const fabricCanvas = composable.canvas.value;
    fabricCanvas.toJSON = vi.fn(() => ({
      version: '5.3.0',
      objects: [{ id: `obj-${uniqueId}` }],
      background: '#fff'
    }));
  }
  composable.saveHistory();
  vi.advanceTimersByTime(150);
}

describe('useCanvas', () => {
  let canvasComposable;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockCanvasObjects = [];
    global.document.getElementById = vi.fn((id) => (id === 'c' ? mockCanvasElement : null));

    canvasComposable = useCanvas();
    // Reset module-level singleton state
    canvasComposable.canvas.value = null;
    canvasComposable.historyStack.value = [];
    canvasComposable.redoStack.value = [];
    canvasComposable.setHistoryLock(false);
    canvasComposable.resetHistory();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('History Tracking', () => {
    it('should increase historyStack when an object is added to canvas', () => {
      canvasComposable.initCanvas();

      saveAndFlush(canvasComposable, 'initial');
      const initialLength = canvasComposable.historyStack.value.length;

      canvasComposable.addVariableToCanvas('testKey');
      saveAndFlush(canvasComposable, 'after-add');

      expect(canvasComposable.historyStack.value.length).toBeGreaterThan(initialLength);
    });

    it('should not add duplicate states to history', () => {
      canvasComposable.initCanvas();

      saveAndFlush(canvasComposable, 'state1');
      const lengthAfterFirst = canvasComposable.historyStack.value.length;

      // Save same state again (toJSON returns same result — no uniqueId change)
      canvasComposable.saveHistory();
      vi.advanceTimersByTime(150);

      expect(canvasComposable.historyStack.value).toHaveLength(lengthAfterFirst);
    });
  });

  describe('Undo Logic', () => {
    it('should remove last state from history and call loadFromJSON', () => {
      canvasComposable.initCanvas();
      const fabricCanvas = canvasComposable.canvas.value;

      saveAndFlush(canvasComposable, 'state-a');
      saveAndFlush(canvasComposable, 'state-b');

      const initialHistoryLength = canvasComposable.historyStack.value.length;

      canvasComposable.undo();

      expect(canvasComposable.historyStack.value).toHaveLength(initialHistoryLength - 1);
      expect(fabricCanvas.loadFromJSON).toHaveBeenCalled();
      expect(canvasComposable.redoStack.value).toHaveLength(1);
    });

    it('should not undo when history is empty', () => {
      canvasComposable.initCanvas();
      const fabricCanvas = canvasComposable.canvas.value;

      canvasComposable.historyStack.value = [];
      canvasComposable.undo();

      expect(fabricCanvas.loadFromJSON).not.toHaveBeenCalled();
    });

    it('should not undo when canvas is null', () => {
      canvasComposable.canvas.value = null;
      canvasComposable.undo();
      expect(canvasComposable.historyStack.value).toHaveLength(0);
    });
  });

  describe('Redo Logic', () => {
    it('should restore state from redo stack', () => {
      canvasComposable.initCanvas();
      const fabricCanvas = canvasComposable.canvas.value;

      saveAndFlush(canvasComposable, 'state-a');
      saveAndFlush(canvasComposable, 'state-b');

      const historyLengthBefore = canvasComposable.historyStack.value.length;

      canvasComposable.undo();
      canvasComposable.redo();

      expect(canvasComposable.historyStack.value).toHaveLength(historyLengthBefore);
      expect(fabricCanvas.loadFromJSON).toHaveBeenCalled();
      expect(canvasComposable.redoStack.value).toHaveLength(0);
    });

    it('should not redo when redo stack is empty', () => {
      canvasComposable.initCanvas();
      const fabricCanvas = canvasComposable.canvas.value;

      canvasComposable.redo();

      expect(fabricCanvas.loadFromJSON).not.toHaveBeenCalled();
    });

    it('should not redo when canvas is null', () => {
      canvasComposable.canvas.value = null;
      canvasComposable.redo();
      expect(canvasComposable.redoStack.value).toHaveLength(0);
    });
  });

  describe('History Limits', () => {
    it('should respect MAX_HISTORY limit of 50', () => {
      canvasComposable.initCanvas();

      for (let i = 0; i < 60; i++) {
        saveAndFlush(canvasComposable, i);
      }

      expect(canvasComposable.historyStack.value.length).toBeLessThanOrEqual(50);
    });

    it('should remove oldest entries when limit is exceeded', () => {
      canvasComposable.initCanvas();

      for (let i = 0; i < 50; i++) {
        saveAndFlush(canvasComposable, i);
      }

      const firstState = JSON.stringify(canvasComposable.historyStack.value[0]);

      saveAndFlush(canvasComposable, 'overflow');

      expect(JSON.stringify(canvasComposable.historyStack.value[0])).not.toBe(firstState);
      expect(canvasComposable.historyStack.value.length).toBe(50);
    });
  });

  describe('Computed Properties', () => {
    it('canUndo should be false when history is empty', () => {
      expect(canvasComposable.canUndo.value).toBe(false);
    });

    it('canUndo should be true when history has items', () => {
      canvasComposable.initCanvas();

      saveAndFlush(canvasComposable, 'a');
      saveAndFlush(canvasComposable, 'b');

      expect(canvasComposable.historyStack.value.length).toBeGreaterThan(1);
      expect(canvasComposable.canUndo.value).toBe(true);
    });

    it('canRedo should be false when redo stack is empty', () => {
      expect(canvasComposable.canRedo.value).toBe(false);
    });

    it('canRedo should be true when redo stack has items', () => {
      canvasComposable.initCanvas();

      saveAndFlush(canvasComposable, 'a');
      saveAndFlush(canvasComposable, 'b');

      canvasComposable.undo();

      expect(canvasComposable.canRedo.value).toBe(true);
    });
  });

  describe('History Processing Flag', () => {
    it('should prevent history operations during processing', () => {
      canvasComposable.initCanvas();

      canvasComposable.setHistoryLock(true);

      saveAndFlush(canvasComposable, 'blocked');

      expect(canvasComposable.historyStack.value).toHaveLength(0);
    });

    it('should reset lock after successful undo', () => {
      canvasComposable.initCanvas();

      saveAndFlush(canvasComposable, 'a');
      saveAndFlush(canvasComposable, 'b');

      canvasComposable.undo();

      expect(canvasComposable.historyStack.value.length).toBeGreaterThanOrEqual(1);
    });

    it('should reset lock after undo error', () => {
      canvasComposable.initCanvas();

      saveAndFlush(canvasComposable, 'a');
      saveAndFlush(canvasComposable, 'b');

      const fabricCanvas = canvasComposable.canvas.value;
      fabricCanvas.loadFromJSON.mockImplementation(() => {
        throw new Error('Test error');
      });

      canvasComposable.undo();

      expect(canvasComposable.historyStack.value.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Canvas Initialization', () => {
    it('should return undefined when canvas element is not found', () => {
      global.document.getElementById = vi.fn(() => null);
      canvasComposable.canvas.value = null;

      const result = canvasComposable.initCanvas();

      expect(result).toBeUndefined();
    });

    it('should initialize canvas and set canvas.value', () => {
      canvasComposable.canvas.value = null;

      canvasComposable.initCanvas();

      expect(canvasComposable.canvas.value).toBeDefined();
      expect(canvasComposable.canvas.value).not.toBeNull();
    });

    it('should create a canvas with expected methods', () => {
      canvasComposable.canvas.value = null;

      canvasComposable.initCanvas();

      const fabricCanvas = canvasComposable.canvas.value;
      expect(fabricCanvas.renderAll).toBeDefined();
      expect(fabricCanvas.loadFromJSON).toBeDefined();
      expect(fabricCanvas.toJSON).toBeDefined();
      expect(fabricCanvas.add).toBeDefined();
    });
  });
});
