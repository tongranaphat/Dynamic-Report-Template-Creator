/**
 * Production-ready fix for History & Real-time collaboration integration
 * Prevents race conditions and ensures proper state isolation
 */

import { ref } from 'vue';

export function useHistoryRealTimeFix() {
  const isHistoryLocked = ref(false);
  const isRemoteUpdating = ref(false);
  const pendingRemoteUpdate = ref(null);


  const saveHistorySafe = (canvas, historyStack, maxHistory = 50) => {
    if (!canvas || isHistoryLocked.value || isRemoteUpdating.value) return;

    try {
      // Debounce rapid saves
      if (pendingRemoteUpdate.value) {
        clearTimeout(pendingRemoteUpdate.value);
      }

      pendingRemoteUpdate.value = setTimeout(() => {
        const currentState = canvas.toJSON([
          'id', 'selectable', 'name', 'data', 'originX', 'originY', 
          'lockMovementX', 'lockMovementY', 'textBaseline'
        ]);

        // Skip duplicate states
        if (historyStack.value.length > 0) {
          const lastState = historyStack.value[historyStack.value.length - 1];
          if (JSON.stringify(lastState) === JSON.stringify(currentState)) {
            return;
          }
        }

        historyStack.value.push(currentState);
        
        // Enforce history size limit
        if (historyStack.value.length > maxHistory) {
          historyStack.value.shift();
        }

        // Broadcast only local changes
        if (!isRemoteUpdating.value) {
          canvas.fire('canvas:changed-by-user', { json: currentState });
        }
      }, 150);

    } catch (error) {
      console.error('Error saving history:', error);
    }
  };


  const loadFromSocketSafe = (canvas, json, historyStack, redoStack) => {
    if (!canvas) return;


    isRemoteUpdating.value = true;
    isHistoryLocked.value = true;

    canvas.loadFromJSON(json, () => {
      canvas.renderAll();
      
      // Re-render after fonts load
      document.fonts.ready.then(() => {
        if (canvas) canvas.requestRenderAll();
      });

      // Do NOT push remote changes to local history
      isRemoteUpdating.value = false;
      isHistoryLocked.value = false;

      canvas.fire('history:restored');
    });
  };


  const undoSafe = (canvas, historyStack, redoStack) => {
    if (!canvas || historyStack.value.length <= 1 || 
        isHistoryLocked.value || isRemoteUpdating.value) return;

    isHistoryLocked.value = true;

    try {
      const currentState = historyStack.value.pop();
      redoStack.value.push(currentState);
      
      const previousState = historyStack.value[historyStack.value.length - 1];

      canvas.loadFromJSON(previousState, () => {
        canvas.renderAll();
        
        // Font-ready re-render
        document.fonts.ready.then(() => {
          if (canvas) canvas.requestRenderAll();
        });
        
        isHistoryLocked.value = false;

        canvas.fire('canvas:changed-by-user', { json: previousState });
        canvas.fire('history:restored');
      });
    } catch (error) {
      console.error('Undo error:', error);
      isHistoryLocked.value = false;
    }
  };


  const redoSafe = (canvas, historyStack, redoStack) => {
    if (!canvas || redoStack.value.length === 0 || 
        isHistoryLocked.value || isRemoteUpdating.value) return;

    isHistoryLocked.value = true;

    try {
      const nextState = redoStack.value.pop();
      historyStack.value.push(nextState);

      canvas.loadFromJSON(nextState, () => {
        canvas.renderAll();
        
        // Font-ready re-render
        document.fonts.ready.then(() => {
          if (canvas) canvas.requestRenderAll();
        });
        
        isHistoryLocked.value = false;

        canvas.fire('canvas:changed-by-user', { json: nextState });
        canvas.fire('history:restored');
      });
    } catch (error) {
      console.error('Redo error:', error);
      isHistoryLocked.value = false;
    }
  };


  const cleanup = () => {
    if (pendingRemoteUpdate.value) {
      clearTimeout(pendingRemoteUpdate.value);
      pendingRemoteUpdate.value = null;
    }
  };

  return {
    isHistoryLocked,
    isRemoteUpdating,
    saveHistorySafe,
    loadFromSocketSafe,
    undoSafe,
    redoSafe,
    cleanup
  };
}
