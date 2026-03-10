import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ref } from 'vue';
import { useCanvasHistory } from '../useCanvasHistory.js';

// Shared canvas ref — singleton, same instance returned every time
const mockCanvas = ref({
  toJSON: vi.fn(() => ({ objects: [] })),
  loadFromJSON: vi.fn((json, callback) => {
    if (callback) callback();
  }),
  renderAll: vi.fn()
});

// Mock useCanvasCore
vi.mock('../useCanvasCore.js', () => ({
  useCanvasCore: () => ({
    canvas: mockCanvas
  })
}));

describe('useCanvasHistory', () => {
  let history;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset mock canvas methods
    mockCanvas.value = {
      toJSON: vi.fn(() => ({ objects: [] })),
      loadFromJSON: vi.fn((json, callback) => {
        if (callback) callback();
      }),
      renderAll: vi.fn()
    };

    history = useCanvasHistory();
  });

  describe('History State Management', () => {
    it('should initialize with empty history and redo stacks', () => {
      expect(history.historyStack.value).toEqual([]);
      expect(history.redoStack.value).toEqual([]);
      expect(history.isHistoryProcessing.value).toBe(false);
    });

    it('should have correct computed properties', () => {
      expect(history.canUndo.value).toBe(false);
      expect(history.canRedo.value).toBe(false);
    });
  });

  describe('saveHistory', () => {
    it('should save state to history stack', () => {
      history.saveHistory();

      expect(history.historyStack.value).toHaveLength(1);
      expect(history.redoStack.value).toHaveLength(0);
    });

    it('should clear redo stack when new history is saved', () => {
      history.saveHistory();

      history.historyStack.value.push({ objects: [{ id: 'test' }] });
      history.redoStack.value.push({ objects: [] });

      history.saveHistory();

      expect(history.redoStack.value).toHaveLength(0);
    });

    it('should limit history size to maxHistorySize', () => {
      const maxSize = 50;

      for (let i = 0; i < maxSize + 10; i++) {
        history.saveHistory();
      }

      expect(history.historyStack.value).toHaveLength(maxSize);
    });

    it('should not save history when isHistoryProcessing is true', () => {
      history.isHistoryProcessing.value = true;

      history.saveHistory();

      expect(history.historyStack.value).toHaveLength(0);
    });

    it('should not save history when canvas is null', () => {
      mockCanvas.value = null;

      history.saveHistory();

      expect(history.historyStack.value).toHaveLength(0);
    });
  });

  describe('undo', () => {
    beforeEach(() => {
      history.saveHistory();
      history.saveHistory();
      history.saveHistory();
    });

    it('should undo to previous state', () => {
      const initialHistoryLength = history.historyStack.value.length;

      history.undo();

      expect(history.historyStack.value).toHaveLength(initialHistoryLength - 1);
      expect(history.redoStack.value).toHaveLength(1);
      expect(history.isHistoryProcessing.value).toBe(false);
    });

    it('should not undo if history has only initial state', () => {
      history.historyStack.value = [{ objects: [] }];

      history.undo();

      expect(history.historyStack.value).toHaveLength(1);
      expect(history.redoStack.value).toHaveLength(0);
    });

    it('should not undo if history is empty', () => {
      history.historyStack.value = [];

      history.undo();

      expect(history.historyStack.value).toHaveLength(0);
      expect(history.redoStack.value).toHaveLength(0);
    });

    it('should set isHistoryProcessing during undo operation', () => {
      let processingState = [];

      mockCanvas.value.loadFromJSON = vi.fn((json, callback) => {
        processingState.push(history.isHistoryProcessing.value);
        if (callback) callback();
      });

      history.undo();

      expect(processingState).toContain(true);
      expect(history.isHistoryProcessing.value).toBe(false);
    });
  });

  describe('redo', () => {
    beforeEach(() => {
      history.saveHistory();
      history.saveHistory();
      history.undo();
    });

    it('should redo to next state', () => {
      const initialRedoLength = history.redoStack.value.length;

      history.redo();

      expect(history.redoStack.value).toHaveLength(initialRedoLength - 1);
      expect(history.historyStack.value.length).toBeGreaterThan(1);
      expect(history.isHistoryProcessing.value).toBe(false);
    });

    it('should not redo if redo stack is empty', () => {
      history.redoStack.value = [];

      history.redo();

      expect(history.redoStack.value).toHaveLength(0);
      expect(history.historyStack.value.length).toBeGreaterThan(0);
    });

    it('should set isHistoryProcessing during redo operation', () => {
      let processingState = [];

      mockCanvas.value.loadFromJSON = vi.fn((json, callback) => {
        processingState.push(history.isHistoryProcessing.value);
        if (callback) callback();
      });

      history.redo();

      expect(processingState).toContain(true);
      expect(history.isHistoryProcessing.value).toBe(false);
    });
  });

  describe('canUndo and canRedo computed properties', () => {
    it('canUndo should be false when history has 0 or 1 items', () => {
      history.historyStack.value = [];
      expect(history.canUndo.value).toBe(false);

      history.historyStack.value = [{ objects: [] }];
      expect(history.canUndo.value).toBe(false);
    });

    it('canUndo should be true when history has more than 1 item', () => {
      history.historyStack.value = [{ objects: [] }, { objects: [{ id: 'test' }] }];
      expect(history.canUndo.value).toBe(true);
    });

    it('canRedo should be false when redo stack is empty', () => {
      history.redoStack.value = [];
      expect(history.canRedo.value).toBe(false);
    });

    it('canRedo should be true when redo stack has items', () => {
      history.redoStack.value = [{ objects: [] }];
      expect(history.canRedo.value).toBe(true);
    });
  });

  describe('initializeHistory', () => {
    it('should save initial state after delay', () => {
      vi.useFakeTimers();

      history.initializeHistory();

      expect(history.historyStack.value).toHaveLength(0);

      vi.advanceTimersByTime(100);

      expect(history.historyStack.value).toHaveLength(1);

      vi.useRealTimers();
    });
  });

  describe('Error Handling', () => {
    it('should handle saveHistory errors gracefully', () => {
      mockCanvas.value.toJSON = vi.fn(() => {
        throw new Error('Serialization error');
      });

      expect(() => history.saveHistory()).not.toThrow();
      expect(history.historyStack.value).toHaveLength(0);
    });

    it('should handle undo errors gracefully', () => {
      mockCanvas.value.toJSON = vi.fn(() => {
        throw new Error('Serialization error');
      });

      history.historyStack.value = [{ objects: [] }, { objects: [{ id: 'test' }] }];

      expect(() => history.undo()).not.toThrow();
      expect(history.isHistoryProcessing.value).toBe(false);
    });

    it('should handle redo errors gracefully', () => {
      mockCanvas.value.loadFromJSON = vi.fn(() => {
        throw new Error('Deserialization error');
      });

      history.historyStack.value = [{ objects: [] }];
      history.redoStack.value = [{ objects: [{ id: 'test' }] }];

      expect(() => history.redo()).not.toThrow();
      expect(history.isHistoryProcessing.value).toBe(false);
    });
  });
});
