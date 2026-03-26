# Integration Guide: Production-Ready Fixes

## Overview
This guide shows how to integrate the production-ready fixes into your Dynamic Report Template Creator to resolve critical integration bugs and architectural vulnerabilities.

## 🚀 Quick Integration

### 1. Update EditorView.vue

Replace the existing imports and function calls:

```vue
<script setup>
import { onMounted, ref, watch, nextTick } from 'vue';
import { fabric } from 'fabric';
import axios from 'axios';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

// NEW: Import the fixes
import { usePageStateFix } from '../composables/usePageStateFix.js';
import { useHistoryRealTimeFix } from '../composables/useHistoryRealTimeFix.js';
import { usePreviewToggleFix } from '../composables/usePreviewToggleFix.js';
import { usePdfExportFix } from '../composables/usePdfExportFix.js';
import { useMemoryManagementFix } from '../composables/useMemoryManagementFix.js';

// Initialize the fixes
const { saveCurrentPageStateAtomic, syncPagesFromCanvasSafe } = usePageStateFix();
const { 
  isHistoryLocked, 
  isRemoteUpdating, 
  saveHistorySafe, 
  loadFromSocketSafe, 
  undoSafe, 
  redoSafe,
  cleanup: historyCleanup 
} = useHistoryRealTimeFix();
const { 
  togglePreviewWithRollback, 
  cleanup: previewCleanup 
} = usePreviewToggleFix();
const { 
  captureCanvasPageSafe, 
  generateHybridPdfSafe 
} = usePdfExportFix();
const { 
  cleanupCanvasObjects, 
  safeCanvasClear, 
  deletePageSafe,
  periodicCleanup,
  componentCleanup 
} = useMemoryManagementFix();

// Replace existing functions with the fixed versions
const saveCurrentPageState = () => {
  const newPages = saveCurrentPageStateAtomic(canvas.value, pages.value, zoomLevel.value);
  if (newPages) {
    pages.value = newPages;
  }
};

const togglePreviewWrapper = async () => {
  const { getMockData } = usePreviewData();
  const success = await togglePreviewWithRollback(
    canvas.value,
    isPreviewMode,
    (value) => isPreviewMode.value = value,
    getMockData(),
    renderAllPages,
    saveCurrentPageState
  );
  
  if (!success) {
    console.error('Preview toggle failed');
  }
};

const handleGenerateEditablePDF = async () => {
  // ... existing setup code ...
  
  try {
    // Use safe canvas page capture
    const canvasImages = [];
    for (let i = 0; i < pages.value.length; i++) {
      const img = await captureCanvasPageSafe(canvas.value, i, zoomLevel.value, qualityMultiplier);
      if (img) canvasImages.push(img);
    }
    
    // Use safe PDF generation
    const pdfBlob = await generateHybridPdfSafe(canvasImages, projectData, variableMap);
    
    // ... rest of the function ...
  } catch (error) {
    console.error('PDF generation failed:', error);
  }
};

const deletePage = async (index) => {
  if (!confirm(`Delete page ${index + 1}?`)) return;
  
  const success = deletePageSafe(canvas.value, pages.value, index, zoomLevel.value);
  if (success) {
    if (currentPageIndex.value >= pages.value.length) {
      currentPageIndex.value = Math.max(0, pages.value.length - 1);
    }
    await nextTick();
    await renderAllPages();
    saveHistorySafe(canvas.value, historyStack);
  }
};

// Replace mount/umount hooks
onMounted(async () => {
  await nextTick();
  initCanvas();
  isCanvasReady.value = true;
  initCanvasEvents();

  // Start periodic cleanup
  const cleanupManager = periodicCleanup(canvas.value);
  
  // ... rest of existing mount code ...
  
  // Cleanup on unmount
  onUnmounted(() => {
    componentCleanup(canvas.value, cleanupManager);
    historyCleanup();
    previewCleanup();
  });
});
</script>
```

### 2. Update useCanvas.js / useCanvasLegacy.js

Replace the history functions:

```javascript
// In useCanvas.js or useCanvasLegacy.js
import { useHistoryRealTimeFix } from './useHistoryRealTimeFix.js';

export function useCanvas() {
  const { 
    saveHistorySafe, 
    loadFromSocketSafe, 
    undoSafe, 
    redoSafe,
    isHistoryLocked,
    isRemoteUpdating 
  } = useHistoryRealTimeFix();
  
  // Replace existing history functions
  const saveHistory = () => saveHistorySafe(canvas.value, historyStack);
  const undo = () => undoSafe(canvas.value, historyStack, redoStack);
  const redo = () => redoSafe(canvas.value, historyStack, redoStack);
  const loadFromSocket = (json) => loadFromSocketSafe(canvas.value, json, historyStack, redoStack);
  
  return {
    // ... existing exports ...
    saveHistory,
    undo,
    redo,
    loadFromSocket,
    isHistoryLocked,
    isRemoteUpdating
  };
}
```

### 3. Update useRealTime.js

Add history lock protection:

```javascript
// In useRealTime.js
import { useHistoryRealTimeFix } from './useHistoryRealTimeFix.js';

export function useRealTime() {
  const { isHistoryLocked, isRemoteUpdating } = useHistoryRealTimeFix();
  
  const connect = (reportId, onSyncCallback) => {
    // ... existing connection code ...
    
    socket.on('canvas-sync', (data) => {
      // Don't process if history is locked (prevents conflicts)
      if (!isHistoryLocked.value) {
        if (onSyncCallback) onSyncCallback(data);
      }
    });
  };
  
  return { connect, emitUpdate, disconnect };
}
```

## 🔧 Key Benefits of These Fixes

### 1. **State Synchronization**
- ✅ Zoom-aware coordinate calculations
- ✅ Atomic state updates prevent corruption
- ✅ Consistent page assignment logic

### 2. **History & Real-time**
- ✅ Remote changes don't pollute local history
- ✅ Proper locking prevents race conditions
- ✅ Debounced saves improve performance

### 3. **Preview/Edit Toggle**
- ✅ Template data always preserved
- ✅ Rollback on errors
- ✅ Safe variable resolution

### 4. **PDF Export**
- ✅ CORS-safe canvas capture
- ✅ Font loading with timeout protection
- ✅ Graceful fallbacks for errors

### 5. **Memory Management**
- ✅ Proper object disposal
- ✅ ClipPath cleanup
- ✅ Event listener removal
- ✅ Periodic memory cleanup

## 🧪 Testing Recommendations

### 1. Multi-Page State Testing
```javascript
// Test zoom-level changes
zoomLevel.value = 1.5;
addVariableToCanvas('test');
saveCurrentPageState();
// Verify object is on correct page

// Test page reordering
const page1 = pages[0];
const page2 = pages[1];
handlePageDrop({ sourceIndex: 0, targetIndex: 1, position: 'bottom' });
// Verify objects move with pages
```

### 2. History & Real-time Testing
```javascript
// Test undo doesn't affect remote changes
socket.emit('canvas-update', testData);
undo();
// Verify remote change remains

// Test concurrent editing
// User A: edit page 1
// User B: edit page 2
// Verify no conflicts
```

### 3. Preview Toggle Testing
```javascript
// Test template preservation
const originalText = canvas.getObjects()[0].text;
togglePreviewWrapper();
togglePreviewWrapper();
// Verify text is restored to original
```

### 4. PDF Export Testing
```javascript
// Test CORS handling
addImageToCanvas('https://cross-origin-image.com/image.jpg');
handleGenerateEditablePDF();
// Verify PDF generates without taint errors
```

## 📊 Performance Monitoring

Use the built-in memory stats:

```javascript
import { useMemoryManagementFix } from './useMemoryManagementFix.js';

const { getMemoryStats, resetMemoryStats } = useMemoryManagementFix();

// Monitor memory usage
console.log('Memory stats:', getMemoryStats());

// Reset counters for testing
resetMemoryStats();
```

## 🚨 Important Notes

1. **Gradual Rollout**: Apply fixes one at a time and test thoroughly
2. **Backward Compatibility**: All fixes maintain existing API compatibility
3. **Error Handling**: All fixes include comprehensive error handling and fallbacks
4. **Memory Usage**: Monitor memory usage after deployment to verify improvements

## 🔍 Debug Mode

Enable debug logging:

```javascript
// In main.js or EditorView.vue
window.DEBUG_FIXES = true;
```

This will enable detailed console logging for all fix operations.

## 📞 Support

If you encounter issues:
1. Check browser console for error messages
2. Verify all imports are correct
3. Test with a fresh browser session
4. Check that all dependencies are up to date

These fixes are designed to be production-ready and should resolve the critical integration issues identified in the audit.
