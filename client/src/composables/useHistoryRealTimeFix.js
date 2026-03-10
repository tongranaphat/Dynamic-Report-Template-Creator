/**
 * Production-ready fix for History & Real-time collaboration integration
 * Prevents race conditions and ensures proper state isolation
 */

import { ref } from 'vue';

export function useHistoryRealTimeFix() {
  const isHistoryLocked = ref(false);
  const isRemoteUpdating = ref(false);
  const pendingRemoteUpdate = ref(null);

  // Enhanced saveHistory with remote protection
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

        // Prevent duplicate states
        if (historyStack.value.length > 0) {
          const lastState = historyStack.value[historyStack.value.length - 1];
          if (JSON.stringify(lastState) === JSON.stringify(currentState)) {
            return;
          }
        }

        historyStack.value.push(currentState);
        
        // Limit history size with memory awareness
        if (historyStack.value.length > maxHistory) {
          historyStack.value.shift();
        }

        // Emit only local changes, not remote ones
        if (!isRemoteUpdating.value) {
          canvas.fire('canvas:changed-by-user', { json: currentState });
        }
      }, 150);

    } catch (error) {
      console.error('Error saving history:', error);
    }
  };

  // Safe loadFromSocket with history protection
  const loadFromSocketSafe = (canvas, json, historyStack, redoStack) => {
    if (!canvas) return;

    console.log('🔄 Receiving update from socket...');
    isRemoteUpdating.value = true;
    isHistoryLocked.value = true;

    canvas.loadFromJSON(json, () => {
      canvas.renderAll();
      
      // Re-render after fonts load
      document.fonts.ready.then(() => {
        if (canvas) canvas.requestRenderAll();
      });

      // CRITICAL: Do NOT push remote changes to local history
      // This prevents undoing other users' work
      isRemoteUpdating.value = false;
      isHistoryLocked.value = false;
      console.log('✅ Remote update applied (history protected)');

      canvas.fire('history:restored');
    });
  };

  // Enhanced undo with remote awareness
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
        console.log('↩️ Undo performed (remote-safe)');

        canvas.fire('canvas:changed-by-user', { json: previousState });
        canvas.fire('history:restored');
      });
    } catch (error) {
      console.error('Undo error:', error);
      isHistoryLocked.value = false;
    }
  };

  // Enhanced redo with remote awareness
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
        console.log('↪️ Redo performed (remote-safe)');

        canvas.fire('canvas:changed-by-user', { json: nextState });
        canvas.fire('history:restored');
      });
    } catch (error) {
      console.error('Redo error:', error);
      isHistoryLocked.value = false;
    }
  };

  // Cleanup function
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
