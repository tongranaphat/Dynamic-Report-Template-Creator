import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useCanvasCore } from './useCanvasCore.js';

export function useCanvasHistory() {
  const { canvas } = useCanvasCore();

  // History management state
  const historyStack = ref([]);
  const redoStack = ref([]);
  const isHistoryProcessing = ref(false);
  const maxHistorySize = 50; // Limit history size to prevent memory issues

  // Computed properties for UI state
  const canUndo = computed(() => historyStack.value.length > 1); // >1 because first element is initial state
  const canRedo = computed(() => redoStack.value.length > 0);

  // History management functions
  const saveHistory = () => {
    if (!canvas.value || isHistoryProcessing.value) return;

    try {
      const currentState = canvas.value.toJSON(['id', 'selectable', 'name']);
      historyStack.value.push(currentState);

      // Limit history size
      if (historyStack.value.length > maxHistorySize) {
        historyStack.value.shift();
      }

      // Clear redo stack when new action is performed
      redoStack.value = [];

      console.log('History saved. Stack size:', historyStack.value.length);
    } catch (error) {
      console.error('Error saving history:', error);
    }
  };

  const undo = () => {
    if (!canvas.value || historyStack.value.length <= 1) return;

    isHistoryProcessing.value = true;

    try {
      // Save current state to redo stack
      const currentState = canvas.value.toJSON(['id', 'selectable', 'name']);
      redoStack.value.push(currentState);

      // Remove current state from history stack
      historyStack.value.pop();

      // Get previous state
      const previousState = historyStack.value[historyStack.value.length - 1];

      // Load previous state
      canvas.value.loadFromJSON(previousState, () => {
        canvas.value.renderAll();
        isHistoryProcessing.value = false;
        console.log(
          'Undo performed. History stack:',
          historyStack.value.length,
          'Redo stack:',
          redoStack.value.length
        );
      });
    } catch (error) {
      console.error('Error during undo:', error);
      isHistoryProcessing.value = false;
    }
  };

  const redo = () => {
    if (!canvas.value || redoStack.value.length === 0) return;

    isHistoryProcessing.value = true;

    try {
      // Get state to redo
      const stateToRedo = redoStack.value.pop();

      // Save current state to history stack
      const currentState = canvas.value.toJSON(['id', 'selectable', 'name']);
      historyStack.value.push(currentState);

      // Load redo state
      canvas.value.loadFromJSON(stateToRedo, () => {
        canvas.value.renderAll();
        isHistoryProcessing.value = false;
        console.log(
          'Redo performed. History stack:',
          historyStack.value.length,
          'Redo stack:',
          redoStack.value.length
        );
      });
    } catch (error) {
      console.error('Error during redo:', error);
      isHistoryProcessing.value = false;
    }
  };

  // Keyboard shortcuts for undo/redo
  const handleKeyDown = (e) => {
    // Only handle shortcuts when not in input fields
    if ((e.ctrlKey || e.metaKey) && !e.target.matches('input, textarea')) {
      if (e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          redo();
        } else {
          undo();
        }
      } else if (e.key.toLowerCase() === 'y') {
        e.preventDefault();
        redo();
      }
    }
  };

  // Add keyboard event listeners
  onMounted(() => {
    document.addEventListener('keydown', handleKeyDown);
  });

  onUnmounted(() => {
    document.removeEventListener('keydown', handleKeyDown);
  });

  // Initialize history system
  const initializeHistory = () => {
    // Save initial state after canvas is ready
    setTimeout(() => {
      saveHistory();
      console.log('Initial canvas state saved to history');
    }, 100);
  };

  return {
    // History state
    historyStack,
    redoStack,
    isHistoryProcessing,
    canUndo,
    canRedo,

    // History methods
    saveHistory,
    undo,
    redo,
    initializeHistory
  };
}
