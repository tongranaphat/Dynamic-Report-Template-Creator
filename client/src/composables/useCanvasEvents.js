import { CANVAS_CONSTANTS } from '../constants/canvas';

export function useCanvasEvents(canvas, pages, currentPageIndex, saveHistory, setHistoryLock) {
  if (!canvas || !pages) return { initCanvasEvents: () => { } };


  // Store clip paths keyed by object, so we can restore them after ActiveSelection is cleared.
  // We use a WeakMap so entries are GC-able with their objects.
  const savedClipPaths = new WeakMap();

  // Compute an object's clip path rect based on its absolute canvas position.
  // IMPORTANT: call this only when the object is NOT part of an ActiveSelection,
  // because getCenterPoint() inside a group returns group-local coordinates,
  // leading to the wrong page index and making the object invisible.
  const updateObjectClipPath = (obj) => {
    if (!obj) return;
    const P_H = CANVAS_CONSTANTS.PAGE_HEIGHT;
    const P_W = CANVAS_CONSTANTS.PAGE_WIDTH;
    const GAP = CANVAS_CONSTANTS.PAGE_GAP;

    const center = obj.getCenterPoint();
    let pageIndex = Math.floor(center.y / (P_H + GAP));
    const totalPages = pages.value ? pages.value.length : 1;

    // Clamp page index to ensure visibility even if dropped in gap or slightly out of bounds
    if (pageIndex < 0) pageIndex = 0;
    if (pageIndex >= totalPages) pageIndex = totalPages - 1;

    const pageTop = pageIndex * (P_H + GAP);

    // Always create a fresh Rect — never mutate an existing clipPath in-place.
    // Mutating a shared Rect instance corrupts every other object that references it,
    // causing them to disappear (wrong clip region = invisible text).
    if (!obj.clipPath || obj.clipPath.top !== pageTop) {
      obj.clipPath = new fabric.Rect({
        left: 0,
        top: pageTop,
        width: P_W,
        height: P_H,
        absolutePositioned: true
      });
      obj.dirty = true;
      if (canvas.value) canvas.value.requestRenderAll();
    }
  };

  // ─── Multi-select clip path fix ───────────────────────────────────────────
  // When Fabric.js creates an ActiveSelection (rubber-band or shift-click),
  // it moves the child objects into the group's local coordinate space.
  // getCenterPoint() on a grouped object returns group-local coords, NOT
  // absolute canvas coords. This causes updateObjectClipPath to compute the
  // wrong page index and set a clip rect that hides all text on pages 2+.
  //
  // Fix: temporarily remove clip paths while objects are part of a selection,
  // and restore them (recomputing from absolute coords) when selection ends.

  const suppressClipPathsForSelection = (objects) => {
    if (!objects || !objects.length) return;
    objects.forEach((obj) => {
      if (!obj) return;
      // Save current clip path (may already be correct or null)
      if (obj.clipPath !== undefined) {
        savedClipPaths.set(obj, obj.clipPath);
      }
      // Remove clip path so the object renders fully visible during selection
      obj.clipPath = null;
      obj.dirty = true;
    });
    if (canvas.value) canvas.value.requestRenderAll();
  };

  const restoreClipPathsAfterSelection = (objects) => {
    if (!objects || !objects.length) return;
    objects.forEach((obj) => {
      if (!obj) return;
      // After the selection is cleared, the object is back to absolute coords.
      // Recompute the correct clip path from its actual position.
      updateObjectClipPath(obj);
    });
    if (canvas.value) canvas.value.requestRenderAll();
  };
  // ──────────────────────────────────────────────────────────────────────────

  const handleDragTransition = (obj) => {
    if (!obj || !pages.value) return;
    const center = obj.getCenterPoint();
    const P_H = CANVAS_CONSTANTS.PAGE_HEIGHT;
    const GAP = CANVAS_CONSTANTS.PAGE_GAP;

    const calculatedPageIndex = Math.floor(center.y / (P_H + GAP));

    if (calculatedPageIndex >= 0 && calculatedPageIndex < pages.value.length) {
      if (currentPageIndex.value !== calculatedPageIndex) {
        currentPageIndex.value = calculatedPageIndex;
      }
    }
  };

  const handleDropSnap = (obj) => {
    // Intentional no-op: free drag mode, no grid snapping
  };

  const handleTextScaling = (obj) => {
    if (!obj) return;
    if (obj.type === 'i-text' || obj.type === 'text' || obj.type === 'textbox') {
      if (obj.scaleX !== 1 || obj.scaleY !== 1) {
        const sx = obj.scaleX;
        const sy = obj.scaleY;
        const newFontSize = obj.fontSize * Math.max(sx, sy); // Use max to keep ratio
        obj.set({
          fontSize: Math.round(newFontSize),
          scaleX: 1,
          scaleY: 1
        });
        if (obj.type === 'textbox') obj.set('width', obj.width * sx);
        obj.setCoords();
        obj.dirty = true;
      }
    }
  };

  // BUG-014 fix: throttle clip-path recalculation using rAF so we don't
  // create a new fabric.Rect on every single pixel of mouse movement.
  let movingRafId = null;

  const initCanvasEvents = () => {
    if (!canvas.value) return;


    canvas.value.on('object:moving', (e) => {
      if (!e.target) return;
      handleDragTransition(e.target);
      if (movingRafId) return; // already scheduled
      movingRafId = requestAnimationFrame(() => {
        movingRafId = null;
        if (e.target) updateObjectClipPath(e.target);
      });
    });

    canvas.value.on('object:scaling', (e) => {
      if (e.target) updateObjectClipPath(e.target);
    });

    canvas.value.on('object:rotating', (e) => {
      if (e.target) updateObjectClipPath(e.target);
    });

    canvas.value.on('object:modified', (e) => {
      if (e.target) {
        handleTextScaling(e.target);
        updateObjectClipPath(e.target);

        canvas.value.fire('selection:updated', { target: e.target });
        if (saveHistory) saveHistory();
      }
    });

    // ── Multi-select: suppress clip paths while objects are grouped ──────────
    // When selection:created fires, the objects are already inside an
    // ActiveSelection group. Their coordinates are group-local, so we cannot
    // safely compute clip paths yet. Removing clip paths here keeps them visible.
    canvas.value.on('selection:created', (e) => {
      const allSelected = canvas.value.getActiveObjects();
      if (allSelected.length > 1) {
        // Multi-object selection: suppress clip paths to prevent transparency bug
        suppressClipPathsForSelection(allSelected);
      } else if (allSelected.length === 1) {
        // Single-object selection: safe to update normally
        updateObjectClipPath(allSelected[0]);
        handleDragTransition(allSelected[0]);
      }
    });

    canvas.value.on('selection:updated', (e) => {
      const allSelected = canvas.value.getActiveObjects();
      if (allSelected.length > 1) {
        suppressClipPathsForSelection(allSelected);
      } else if (allSelected.length === 1) {
        updateObjectClipPath(allSelected[0]);
        handleDragTransition(allSelected[0]);
      }
    });

    // When selection is cleared (click away or Escape), objects leave the group
    // and return to absolute canvas coordinates. Now it's safe to recompute.
    canvas.value.on('selection:cleared', (e) => {
      const deselected = e.deselected || [];
      restoreClipPathsAfterSelection(deselected);
    });
    // ──────────────────────────────────────────────────────────────────────────
  };

  return { initCanvasEvents };
}
