import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useCanvasCore } from './useCanvasCore.js';

export function useCanvasHistory() {
  const { canvas } = useCanvasCore();


  const historyStack = ref([]);
  const redoStack = ref([]);
  const isHistoryProcessing = ref(false);
  const isHistoryLocked = ref(false);
  const isRemoteUpdating = ref(false);
  const pendingRemoteUpdate = ref(null);
  const maxHistorySize = 50;


  const canUndo = computed(() => historyStack.value.length > 1); // >1 because first element is initial state
  const canRedo = computed(() => redoStack.value.length > 0);


  const saveHistory = () => {
    if (!canvas.value || isHistoryProcessing.value || isHistoryLocked.value || isRemoteUpdating.value) return;

    try {
      // Debounce rapid saves
      if (pendingRemoteUpdate.value) {
        clearTimeout(pendingRemoteUpdate.value);
      }

      pendingRemoteUpdate.value = setTimeout(() => {
        const currentState = canvas.value.toJSON([
          'id', 'selectable', 'name', 'data', 'originX', 'originY', 
          'lockMovementX', 'lockMovementY', 'textBaseline'
        ]);

        // Prevent duplicate states
        if (historyStack.value.length > 0) {
          const lastState = historyStack.value[historyStack.value.length - 1];
          if (JSON.stringify(lastState) === JSON.stringify(currentState)) {
            return;
          }
        }

        historyStack.value.push(currentState);
        
        // Limit history size with memory awareness
        if (historyStack.value.length > maxHistorySize) {
          historyStack.value.shift();
        }

        // Clear redo stack when new action is performed
        redoStack.value = [];

        // Emit only local changes, not remote ones
        if (!isRemoteUpdating.value) {
          canvas.value.fire('canvas:changed-by-user', { json: currentState });
        }


      }, 150);

    } catch (error) {
      console.error('Error saving history:', error);
    }
  };


  const undo = () => {
    if (!canvas.value || historyStack.value.length <= 1 || 
        isHistoryProcessing.value || isHistoryLocked.value || isRemoteUpdating.value) return;

    isHistoryLocked.value = true;

    try {
      const currentState = historyStack.value.pop();
      redoStack.value.push(currentState);
      
      const previousState = historyStack.value[historyStack.value.length - 1];

      canvas.value.loadFromJSON(previousState, () => {
        canvas.value.renderAll();
        
        // Font-ready re-render
        document.fonts.ready.then(() => {
          if (canvas.value) canvas.value.requestRenderAll();
        });
        
        isHistoryLocked.value = false;


        canvas.value.fire('canvas:changed-by-user', { json: previousState });
        canvas.value.fire('history:restored');
      });
    } catch (error) {
      console.error('Undo error:', error);
      isHistoryLocked.value = false;
    }
  };


  const redo = () => {
    if (!canvas.value || redoStack.value.length === 0 || 
        isHistoryProcessing.value || isHistoryLocked.value || isRemoteUpdating.value) return;

    isHistoryLocked.value = true;

    try {
      const nextState = redoStack.value.pop();
      historyStack.value.push(nextState);

      canvas.value.loadFromJSON(nextState, () => {
        canvas.value.renderAll();
        
        // Font-ready re-render
        document.fonts.ready.then(() => {
          if (canvas.value) canvas.value.requestRenderAll();
        });
        
        isHistoryLocked.value = false;


        canvas.value.fire('canvas:changed-by-user', { json: nextState });
        canvas.value.fire('history:restored');
      });
    } catch (error) {
      console.error('Redo error:', error);
      isHistoryLocked.value = false;
    }
  };


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


  onMounted(() => {
    document.addEventListener('keydown', handleKeyDown);
  });

  onUnmounted(() => {
    document.removeEventListener('keydown', handleKeyDown);
  });


  const initializeHistory = () => {
    setTimeout(() => {
      saveHistory();
    }, 100);
  };


  const loadFromSocket = (json) => {
    if (!canvas.value) return;


    isRemoteUpdating.value = true;
    isHistoryLocked.value = true;

    canvas.value.loadFromJSON(json, () => {
      canvas.value.renderAll();
      
      // Re-render after fonts load
      document.fonts.ready.then(() => {
        if (canvas.value) canvas.value.requestRenderAll();
      });

      // Do NOT push remote changes to local history
      isRemoteUpdating.value = false;
      isHistoryLocked.value = false;

      canvas.value.fire('history:restored');
    });
  };


  const cleanup = () => {
    if (pendingRemoteUpdate.value) {
      clearTimeout(pendingRemoteUpdate.value);
      pendingRemoteUpdate.value = null;
    }
  };

  return {
    historyStack,
    redoStack,
    isHistoryProcessing,
    isHistoryLocked,
    isRemoteUpdating,
    canUndo,
    canRedo,

    // History methods
    saveHistory,
    undo,
    redo,
    loadFromSocket,
    cleanup
  };
}
