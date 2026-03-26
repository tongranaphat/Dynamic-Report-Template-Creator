/**
 * Production-ready fix for memory management and object lifecycle
 * Prevents memory leaks and ensures proper cleanup
 */

export function useMemoryManagementFix() {

  const memoryStats = {
    objectsCreated: 0,
    objectsDestroyed: 0,
    clipPathsCreated: 0,
    clipPathsDestroyed: 0,
    eventListenersAdded: 0,
    eventListenersRemoved: 0
  };


  const cleanupCanvasObjects = (canvas, deep = true) => {
    if (!canvas) return;
    
    let cleanedCount = 0;
    let clipPathCleanupCount = 0;
    let eventCleanupCount = 0;
    
    const objects = canvas.getObjects();
    
    objects.forEach(obj => {
      try {
        if (obj.clipPath) {
          if (obj.clipPath.dispose && typeof obj.clipPath.dispose === 'function') {
            obj.clipPath.dispose();
          }
          obj.clipPath = null;
          clipPathCleanupCount++;
          memoryStats.clipPathsDestroyed++;
        }
        
        if (obj.off && typeof obj.off === 'function') {
          obj.off();
          eventCleanupCount++;
          memoryStats.eventListenersRemoved++;
        }
        
        if (obj.dispose && typeof obj.dispose === 'function') {
          obj.dispose();
        }
        
        if (deep) {
          if (obj._cacheContext) {
            obj._cacheContext = null;
          }
          if (obj._cacheCanvas) {
            obj._cacheCanvas = null;
          }
          if (obj._currentTransform) {
            obj._currentTransform = null;
          }
        }
        
        cleanedCount++;
        memoryStats.objectsDestroyed++;
        
      } catch (cleanupError) {
        console.error('Error cleaning up object:', cleanupError);
      }
    });
    
    
    return cleanedCount;
  };


  const safeCanvasClear = (canvas) => {
    if (!canvas) return;
    
    try {
      // Cleanup all objects first
      cleanupCanvasObjects(canvas, true);
      
      canvas.discardActiveObject();

      canvas.clear();

      canvas.setBackgroundColor(null, () => {});
      
      if (canvas._objects) {
        canvas._objects.length = 0;
      }
      if (canvas._activeObject) {
        canvas._activeObject = null;
      }
      
      // Hint for garbage collection
      if (window.gc) {
        window.gc();
      }
      
    } catch (clearError) {
      console.error('Error during canvas clear:', clearError);
    }
  };


  const deletePageSafe = (canvas, pages, pageIndex, zoomLevel) => {
    if (!canvas || !pages || pageIndex < 0 || pageIndex >= pages.length) return false;
    
    try {
      const P_H = CANVAS_CONSTANTS.PAGE_HEIGHT;
      const GAP = CANVAS_CONSTANTS.PAGE_GAP;
      const pageTop = pageIndex * (P_H + GAP);
      const pageBottom = pageTop + P_H;
      
      // Find and remove objects on the target page
      const objectsToRemove = [];
      canvas.getObjects().forEach(obj => {
        if (obj.id === 'page-bg' || obj.id === 'page-bg-image') {
          // Check if background belongs to this page
          if (Math.abs(obj.top - pageTop) < 5) {
            objectsToRemove.push(obj);
          }
        } else {
          // Check if object is within page bounds
          const center = obj.getCenterPoint();
          if (center.y >= pageTop && center.y <= pageBottom) {
            objectsToRemove.push(obj);
          }
        }
      });
      
      // Remove objects with proper cleanup
      objectsToRemove.forEach(obj => {
        try {
          // Cleanup before removal
          if (obj.clipPath) {
            if (obj.clipPath.dispose) obj.clipPath.dispose();
            obj.clipPath = null;
          }
          if (obj.off) obj.off();
          if (obj.dispose) obj.dispose();
          
          // Remove from canvas
          canvas.remove(obj);
          memoryStats.objectsDestroyed++;
        } catch (removeError) {
          console.error('Error removing object:', removeError);
        }
      });
      
      // Remove page from array
      pages.splice(pageIndex, 1);
      
      // Renumber remaining pages
      pages.forEach((page, idx) => {
        page.id = idx;
      });
      
      // Adjust Y positions of objects on pages below
      const pageStride = P_H + GAP;
      canvas.getObjects().forEach(obj => {
        if (obj.top > pageBottom) {
          obj.set('top', obj.top - pageStride);
          obj.setCoords();
        }
      });
      
      canvas.renderAll();
      

      return true;
      
    } catch (error) {
      console.error('Error deleting page:', error);
      return false;
    }
  };


  const getMemoryStats = () => {
    return { ...memoryStats };
  };

  const resetMemoryStats = () => {
    memoryStats.objectsCreated = 0;
    memoryStats.objectsDestroyed = 0;
    memoryStats.clipPathsCreated = 0;
    memoryStats.clipPathsDestroyed = 0;
    memoryStats.eventListenersAdded = 0;
    memoryStats.eventListenersRemoved = 0;
  };


  const trackObjectCreation = (obj) => {
    memoryStats.objectsCreated++;
    
    // Track clip paths
    if (obj.clipPath) {
      memoryStats.clipPathsCreated++;
    }
  };


  const trackEventListener = () => {
    memoryStats.eventListenersAdded++;
  };


  const periodicCleanup = (canvas, intervalMs = 30000) => {
    let cleanupInterval = null;
    
    const startCleanup = () => {
      if (cleanupInterval) return;
      
      cleanupInterval = setInterval(() => {
        if (canvas) {
          // Light cleanup - don't clear everything
          const objects = canvas.getObjects();
          let cleaned = 0;
          
          objects.forEach(obj => {
            // Clear caches only
            if (obj._cacheContext) {
              obj._cacheContext = null;
              cleaned++;
            }
            if (obj._cacheCanvas) {
              obj._cacheCanvas = null;
              cleaned++;
            }
          });
        }
      }, intervalMs);
    };
    
    const stopCleanup = () => {
      if (cleanupInterval) {
        clearInterval(cleanupInterval);
        cleanupInterval = null;
      }
    };
    
    return { startCleanup, stopCleanup };
  };


  const componentCleanup = (canvas, cleanupInterval) => {
    try {
      if (cleanupInterval && cleanupInterval.stopCleanup) {
        cleanupInterval.stopCleanup();
      }
      
      // Final canvas cleanup
      if (canvas) {
        safeCanvasClear(canvas);
      }
      
      // Clear any remaining references
      memoryStats.objectsCreated = 0;
      memoryStats.objectsDestroyed = 0;
      

    } catch (error) {
      console.error('Error during component cleanup:', error);
    }
  };

  return {
    cleanupCanvasObjects,
    safeCanvasClear,
    deletePageSafe,
    getMemoryStats,
    resetMemoryStats,
    trackObjectCreation,
    trackEventListener,
    periodicCleanup,
    componentCleanup
  };
}
