import { CANVAS_CONSTANTS } from '../constants/canvas';

export function useCanvasEvents(canvas, pages, currentPageIndex, saveHistory, setHistoryLock) {
  if (!canvas || !pages) return { initCanvasEvents: () => { } };

  const savedClipPaths = new WeakMap();

  const updateObjectClipPath = (obj) => {
    if (!obj) return;
    const P_H = CANVAS_CONSTANTS.PAGE_HEIGHT;
    const P_W = CANVAS_CONSTANTS.PAGE_WIDTH;
    const GAP = CANVAS_CONSTANTS.PAGE_GAP;

    const center = obj.getCenterPoint();
    let pageIndex = Math.floor(center.y / (P_H + GAP));
    const totalPages = pages.value ? pages.value.length : 1;

    if (pageIndex < 0) pageIndex = 0;
    if (pageIndex >= totalPages) pageIndex = totalPages - 1;

    const pageTop = pageIndex * (P_H + GAP);

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

  const suppressClipPathsForSelection = (objects) => {
    if (!objects || !objects.length) return;
    objects.forEach((obj) => {
      if (!obj) return;
      if (obj.clipPath !== undefined) {
        savedClipPaths.set(obj, obj.clipPath);
      }
      obj.clipPath = null;
      obj.dirty = true;
    });
    if (canvas.value) canvas.value.requestRenderAll();
  };

  const restoreClipPathsAfterSelection = (objects) => {
    if (!objects || !objects.length) return;
    objects.forEach((obj) => {
      if (!obj) return;
      updateObjectClipPath(obj);
    });
    if (canvas.value) canvas.value.requestRenderAll();
  };

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
  };

  const handleTextScaling = (obj) => {
    if (!obj) return;
    if (obj.type === 'i-text' || obj.type === 'text' || obj.type === 'textbox') {
      if (obj.scaleX !== 1 || obj.scaleY !== 1) {
        const sx = obj.scaleX;
        const sy = obj.scaleY;
        const newFontSize = obj.fontSize * Math.max(sx, sy);
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

  let movingRafId = null;

  const initCanvasEvents = () => {
    if (!canvas.value) return;

    canvas.value.on('object:moving', (e) => {
      if (!e.target) return;
      handleDragTransition(e.target);
      if (movingRafId) return;
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

    canvas.value.on('selection:created', (e) => {
      const allSelected = canvas.value.getActiveObjects();
      if (allSelected.length > 1) {
        suppressClipPathsForSelection(allSelected);
      } else if (allSelected.length === 1) {
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

    canvas.value.on('selection:cleared', (e) => {
      const deselected = e.deselected || [];
      restoreClipPathsAfterSelection(deselected);
    });
  };

  return { initCanvasEvents };
}
