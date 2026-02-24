import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ref } from 'vue';
import { useCanvasHistory } from '../useCanvasHistory.js';

// Mock useCanvasCore
vi.mock('../useCanvasCore.js', () => ({
  useCanvasCore: () => ({
    canvas: ref({
      toJSON: vi.fn(() => ({ objects: [] })),
      loadFromJSON: vi.fn((json, callback) => {
        if (callback) callback();
      }),
      renderAll: vi.fn()
    })
  })
}));

describe('useCanvasHistory', () => {
  let history;

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();
    history = useCanvasHistory();
  });

  describe('History State Management', () => {
    it('should initialize with empty history and redo stacks', () => {
      expect(history.historyStack.value).toEqual([]);
      expect(history.redoStack.value).toEqual([]);
      expect(history.isHistoryProcessing.value).toBe(false);
    });

    it('should have correct computed properties', () => {
      expect(history.canUndo.value).toBe(false); // No history yet
      expect(history.canRedo.value).toBe(false); // No redo states yet
    });
  });

  describe('saveHistory', () => {
    it('should save state to history stack', () => {
      history.saveHistory();

      expect(history.historyStack.value).toHaveLength(1);
      expect(history.redoStack.value).toHaveLength(0);
    });

    it('should clear redo stack when new history is saved', () => {
      // First save some history
      history.saveHistory();

      // Simulate undo to populate redo stack
      history.historyStack.value.push({ objects: [{ id: 'test' }] });
      history.redoStack.value.push({ objects: [] });

      // Save new history
      history.saveHistory();

      expect(history.redoStack.value).toHaveLength(0);
    });

    it('should limit history size to maxHistorySize', () => {
      const maxSize = 50;

      // Add more than max size
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
      const { canvas } = useCanvasHistory();
      canvas.value = null;

      history.saveHistory();

      expect(history.historyStack.value).toHaveLength(0);
    });
  });

  describe('undo', () => {
    beforeEach(() => {
      // Setup initial history
      history.saveHistory(); // Initial state
      history.saveHistory(); // First action
      history.saveHistory(); // Second action
    });

    it('should undo to previous state', () => {
      const initialHistoryLength = history.historyStack.value.length;

      history.undo();

      expect(history.historyStack.value).toHaveLength(initialHistoryLength - 1);
      expect(history.redoStack.value).toHaveLength(1);
      expect(history.isHistoryProcessing.value).toBe(false);
    });

    it('should not undo if history has only initial state', () => {
      // Reset to only initial state
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

      // Override loadFromJSON to check processing state
      const { canvas } = useCanvasHistory();
      canvas.value.loadFromJSON = vi.fn((json, callback) => {
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
      // Setup history with undo operation
      history.saveHistory(); // Initial state
      history.saveHistory(); // First action
      history.undo(); // Creates redo state
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

      // Override loadFromJSON to check processing state
      const { canvas } = useCanvasHistory();
      canvas.value.loadFromJSON = vi.fn((json, callback) => {
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

      // Should not save immediately
      expect(history.historyStack.value).toHaveLength(0);

      // After 100ms delay
      vi.advanceTimersByTime(100);

      expect(history.historyStack.value).toHaveLength(1);

      vi.useRealTimers();
    });
  });

  describe('Error Handling', () => {
    it('should handle saveHistory errors gracefully', () => {
      const { canvas } = useCanvasHistory();
      canvas.value.toJSON = vi.fn(() => {
        throw new Error('Serialization error');
      });

      expect(() => history.saveHistory()).not.toThrow();
      expect(history.historyStack.value).toHaveLength(0);
    });

    it('should handle undo errors gracefully', () => {
      const { canvas } = useCanvasHistory();
      canvas.value.toJSON = vi.fn(() => {
        throw new Error('Serialization error');
      });

      // Setup history first
      history.saveHistory();
      history.saveHistory();

      expect(() => history.undo()).not.toThrow();
      expect(history.isHistoryProcessing.value).toBe(false);
    });

    it('should handle redo errors gracefully', () => {
      const { canvas } = useCanvasHistory();
      canvas.value.loadFromJSON = vi.fn(() => {
        throw new Error('Deserialization error');
      });

      // Setup redo state
      history.saveHistory();
      history.saveHistory();
      history.undo();

      expect(() => history.redo()).not.toThrow();
      expect(history.isHistoryProcessing.value).toBe(false);
    });
  });
});
