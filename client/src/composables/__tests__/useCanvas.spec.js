import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref, shallowRef, markRaw, onMounted, onUnmounted, computed } from 'vue';
import { useCanvas } from '../useCanvas.js';

// Mock fabric library
vi.mock('fabric', () => ({
  fabric: {
    Canvas: vi.fn().mockImplementation((canvasId, options) => ({
      id: canvasId,
      options,
      backgroundColor: '#fff',
      objects: [],

      setBackgroundColor: vi.fn((color, callback) => {
        callback();
      }),

      renderAll: vi.fn(),
      requestRenderAll: vi.fn(),

      toJSON: vi.fn((properties) => ({
        version: '5.3.0',
        objects: [...mockCanvasObjects],
        background: '#fff'
      })),

      loadFromJSON: vi.fn((json, callback) => {
        setTimeout(callback, 0);
      }),

      setBackgroundImage: vi.fn((img, callback) => {
        callback();
      }),

      on: vi.fn(),
      off: vi.fn(),

      getPointer: vi.fn((e) => ({ x: 100, y: 100 })),

      add: vi.fn((obj) => {
        mockCanvasObjects.push(obj);
      }),

      remove: vi.fn((obj) => {
        const index = mockCanvasObjects.indexOf(obj);
        if (index > -1) {
          mockCanvasObjects.splice(index, 1);
        }
      }),

      getActiveObjects: vi.fn(() => []),
      discardActiveObject: vi.fn(),
      setActiveObject: vi.fn(),
      getActiveObject: vi.fn(() => null)
    })),

    IText: vi.fn().mockImplementation((text, options) => ({
      text,
      type: 'i-text',
      ...options
    })),

    Image: {
      fromURL: vi.fn((url, callback, options) => {
        callback({
          scaleToWidth: vi.fn()
        });
      })
    }
  }
}));

// Mock DOM element
const mockCanvasElement = {
  id: 'c',
  getContext: vi.fn()
};

// Global mock for canvas objects
let mockCanvasObjects = [];

// Mock document.getElementById
global.document = {
  getElementById: vi.fn((id) => {
    if (id === 'c') return mockCanvasElement;
    return null;
  })
};

// Mock window event listeners
global.window = {
  addEventListener: vi.fn(),
  removeEventListener: vi.fn()
};

describe('useCanvas', () => {
  let canvasComposable;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    mockCanvasObjects = [];

    // Reset DOM mock
    global.document.getElementById.mockReturnValue(mockCanvasElement);

    // Get fresh composable instance
    canvasComposable = useCanvas();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('History Tracking', () => {
    it('should increase historyStack when an object is added to canvas', async () => {
      // Initialize canvas
      const canvasInstance = canvasComposable.initCanvas();
      expect(canvasInstance).toBeDefined();

      // Initial state should have one history entry
      expect(canvasComposable.historyStack.value).toHaveLength(1);

      // Add an object to canvas
      canvasComposable.addVariableToCanvas('testKey');

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 0));

      // History should have increased
      expect(canvasComposable.historyStack.value.length).toBeGreaterThan(1);
    });

    it('should not add duplicate states to history', () => {
      canvasComposable.initCanvas();

      const initialLength = canvasComposable.historyStack.value.length;

      // Simulate adding the same state
      const currentState = canvasComposable.historyStack.value[0];
      canvasComposable.historyStack.value.push(currentState);

      // saveHistory should prevent duplicates
      canvasComposable.saveHistory();

      expect(canvasComposable.historyStack.value).toHaveLength(initialLength);
    });
  });

  describe('Undo Logic', () => {
    it('should remove last state from history and call loadFromJSON', async () => {
      canvasComposable.initCanvas();

      // Add some history
      canvasComposable.addVariableToCanvas('test1');
      canvasComposable.addVariableToCanvas('test2');

      await new Promise((resolve) => setTimeout(resolve, 0));

      const initialHistoryLength = canvasComposable.historyStack.value.length;
      const fabricCanvas = canvasComposable.canvas.value;

      // Call undo
      canvasComposable.undo();

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 0));

      // History should decrease by 1
      expect(canvasComposable.historyStack.value).toHaveLength(initialHistoryLength - 1);

      // loadFromJSON should be called
      expect(fabricCanvas.loadFromJSON).toHaveBeenCalled();

      // Redo stack should have the previous state
      expect(canvasComposable.redoStack.value).toHaveLength(1);
    });

    it('should not undo when history is empty', () => {
      canvasComposable.initCanvas();

      const fabricCanvas = canvasComposable.canvas.value;

      // Clear history
      canvasComposable.historyStack.value = [];

      canvasComposable.undo();

      // loadFromJSON should not be called
      expect(fabricCanvas.loadFromJSON).not.toHaveBeenCalled();
    });

    it('should not undo when canvas is null', () => {
      canvasComposable.undo();

      expect(canvasComposable.historyStack.value).toHaveLength(0);
    });
  });

  describe('Redo Logic', () => {
    it('should restore state from redo stack', async () => {
      canvasComposable.initCanvas();

      // Add some history and then undo to populate redo stack
      canvasComposable.addVariableToCanvas('test1');
      await new Promise((resolve) => setTimeout(resolve, 0));

      const initialHistoryLength = canvasComposable.historyStack.value.length;

      // Undo first
      canvasComposable.undo();
      await new Promise((resolve) => setTimeout(resolve, 0));

      const fabricCanvas = canvasComposable.canvas.value;

      // Now redo
      canvasComposable.redo();

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 0));

      // History should be restored
      expect(canvasComposable.historyStack.value).toHaveLength(initialHistoryLength);

      // loadFromJSON should be called
      expect(fabricCanvas.loadFromJSON).toHaveBeenCalled();

      // Redo stack should be empty
      expect(canvasComposable.redoStack.value).toHaveLength(0);
    });

    it('should not redo when redo stack is empty', () => {
      canvasComposable.initCanvas();

      const fabricCanvas = canvasComposable.canvas.value;

      canvasComposable.redo();

      // loadFromJSON should not be called
      expect(fabricCanvas.loadFromJSON).not.toHaveBeenCalled();
    });

    it('should not redo when canvas is null', () => {
      canvasComposable.redo();

      expect(canvasComposable.redoStack.value).toHaveLength(0);
    });
  });

  describe('History Limits', () => {
    it('should respect MAX_HISTORY limit of 50', () => {
      canvasComposable.initCanvas();

      // Add more than MAX_HISTORY entries
      for (let i = 0; i < 60; i++) {
        canvasComposable.saveHistory();
      }

      // History should not exceed MAX_HISTORY
      expect(canvasComposable.historyStack.value.length).toBeLessThanOrEqual(50);
    });

    it('should remove oldest entries when limit is exceeded', () => {
      canvasComposable.initCanvas();

      // Fill history to limit
      for (let i = 0; i < 50; i++) {
        canvasComposable.saveHistory();
      }

      const firstState = canvasComposable.historyStack.value[0];

      // Add one more to trigger removal
      canvasComposable.saveHistory();

      // First state should be removed
      expect(canvasComposable.historyStack.value[0]).not.toBe(firstState);
      expect(canvasComposable.historyStack.value.length).toBe(50);
    });
  });

  describe('Computed Properties', () => {
    it('canUndo should be false when history is empty', () => {
      expect(canvasComposable.canUndo.value).toBe(false);
    });

    it('canUndo should be true when history has items', () => {
      canvasComposable.initCanvas();
      canvasComposable.saveHistory();

      expect(canvasComposable.canUndo.value).toBe(true);
    });

    it('canRedo should be false when redo stack is empty', () => {
      expect(canvasComposable.canRedo.value).toBe(false);
    });

    it('canRedo should be true when redo stack has items', async () => {
      canvasComposable.initCanvas();
      canvasComposable.addVariableToCanvas('test1');

      await new Promise((resolve) => setTimeout(resolve, 0));

      canvasComposable.undo();
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(canvasComposable.canRedo.value).toBe(true);
    });
  });

  describe('History Processing Flag', () => {
    it('should prevent history operations during processing', async () => {
      canvasComposable.initCanvas();

      // Set processing flag
      canvasComposable.isHistoryProcessing.value = true;

      const initialHistoryLength = canvasComposable.historyStack.value.length;

      // Try to save history
      canvasComposable.saveHistory();

      // History should not change
      expect(canvasComposable.historyStack.value).toHaveLength(initialHistoryLength);
    });

    it('should reset isHistoryProcessing flag after successful undo', async () => {
      canvasComposable.initCanvas();
      canvasComposable.addVariableToCanvas('test1');

      await new Promise((resolve) => setTimeout(resolve, 0));

      canvasComposable.undo();

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(canvasComposable.isHistoryProcessing.value).toBe(false);
    });

    it('should reset isHistoryProcessing flag after undo error', async () => {
      canvasComposable.initCanvas();

      // Mock loadFromJSON to throw error
      const fabricCanvas = canvasComposable.canvas.value;
      fabricCanvas.loadFromJSON.mockImplementation(() => {
        throw new Error('Test error');
      });

      canvasComposable.undo();

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(canvasComposable.isHistoryProcessing.value).toBe(false);
    });
  });

  describe('Canvas Initialization', () => {
    it('should return null when canvas element is not found', () => {
      global.document.getElementById.mockReturnValue(null);

      const result = canvasComposable.initCanvas();

      expect(result).toBeUndefined();
    });

    it('should initialize canvas with correct options', () => {
      canvasComposable.initCanvas();

      const { fabric } = require('fabric');
      expect(fabric.Canvas).toHaveBeenCalledWith('c', { preserveObjectStacking: true });
    });

    it('should set up event listeners', () => {
      canvasComposable.initCanvas();

      const { fabric } = require('fabric');
      const mockCanvas = fabric.Canvas.mock.results[0].value;

      expect(mockCanvas.on).toHaveBeenCalledWith('object:modified', expect.any(Function));
      expect(mockCanvas.on).toHaveBeenCalledWith('object:added', expect.any(Function));
      expect(mockCanvas.on).toHaveBeenCalledWith('object:removed', expect.any(Function));
      expect(mockCanvas.on).toHaveBeenCalledWith('text:changed', expect.any(Function));
    });
  });
});
