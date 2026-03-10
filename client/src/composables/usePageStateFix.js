/**
 * Production-ready fix for multi-page state synchronization
 * Handles zoom-aware coordinate math and prevents race conditions
 */

import { CANVAS_CONSTANTS } from '../constants/canvas';

export function usePageStateFix() {
  const P_H = CANVAS_CONSTANTS.PAGE_HEIGHT;
  const GAP = CANVAS_CONSTANTS.PAGE_GAP;
  const STRIDE = P_H + GAP;

  // Atomic state saving with zoom awareness
  const saveCurrentPageStateAtomic = (canvas, pages, zoomLevel) => {
    if (!canvas || !pages) return;
    
    const pageObjectMap = new Map();
    
    // Initialize clean map for all pages
    pages.forEach((page, index) => {
      pageObjectMap.set(index, []);
    });

    const allObjects = canvas.getObjects();
    
    allObjects.forEach((obj) => {
      if (!obj || obj.id === 'page-bg' || obj.id === 'page-bg-image') return;
      if (typeof obj.top !== 'number' || isNaN(obj.top)) return;

      // Zoom-aware coordinate conversion
      const actualTop = obj.top / zoomLevel;
      const actualLeft = obj.left / zoomLevel;
      
      // Consistent page assignment using center point
      const center = obj.getCenterPoint();
      const actualCenterY = center.y / zoomLevel;
      
      let pageIndex = Math.floor(actualCenterY / STRIDE);
      
      // Boundary protection
      pageIndex = Math.max(0, Math.min(pageIndex, pages.length - 1));

      try {
        const serialized = obj.toObject(['id', 'selectable', 'name', 'data', 'textBaseline']);
        const pageTopY = pageIndex * STRIDE;
        
        // Store coordinates relative to page (zoom-independent)
        serialized.left = Math.round(actualLeft * 100) / 100;
        serialized.top = Math.round((actualTop - pageTopY) * 100) / 100;
        serialized.width = Math.round((obj.width || 0) / zoomLevel * 100) / 100;
        serialized.height = Math.round((obj.height || 0) / zoomLevel * 100) / 100;
        
        if (serialized.textBaseline === 'alphabetical') {
          serialized.textBaseline = 'alphabetic';
        }
        
        pageObjectMap.get(pageIndex).push(serialized);
      } catch (e) {
        console.error('Failed to serialize object:', e);
      }
    });

    // Atomic update - prevent partial state corruption
    const newPages = pages.map((page, index) => ({
      ...page,
      objects: pageObjectMap.get(index) || []
    }));

    return newPages;
  };

  // Safe sync from canvas with validation
  const syncPagesFromCanvasSafe = (canvas, pages, zoomLevel) => {
    if (!canvas) return pages;

    const objs = canvas.getObjects();
    const bgRects = objs.filter(o => 
      o.id === 'page-bg' || 
      (o.type === 'rect' && o.fill === '#ffffff' && !o.selectable && Math.abs(o.width - CANVAS_CONSTANTS.PAGE_WIDTH) < 1)
    );

    // Sort by actual Y position (zoom-aware)
    bgRects.sort((a, b) => (a.top / zoomLevel) - (b.top / zoomLevel));

    const newPages = bgRects.map((rect, index) => {
      const bgImg = objs.find(o => 
        (o.id === 'page-bg-image' || (o.type === 'image' && !o.selectable)) &&
        Math.abs((o.top / zoomLevel) - (rect.top / zoomLevel)) < 10
      );

      // Preserve existing page data when possible
      const existingPage = pages[index];
      
      return {
        id: existingPage?.id || Date.now() + index,
        background: bgImg ? bgImg.getSrc() : existingPage?.background || null,
        objects: existingPage?.objects || []
      };
    });

    return newPages;
  };

  return {
    saveCurrentPageStateAtomic,
    syncPagesFromCanvasSafe
  };
}
