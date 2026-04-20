import { CANVAS_CONSTANTS } from '../constants/canvas';

export function useCanvasEvents(canvas, pages, currentPageIndex, saveHistory, setHistoryLock) {
  if (!canvas || !pages) return { initCanvasEvents: () => {} };

  const savedClipPaths = new WeakMap();

  const updateObjectClipPath = (obj) => {
    if (!obj) return;
    const GAP = CANVAS_CONSTANTS.PAGE_GAP;

    let accumulatedY = 0;
    let targetPageIndex = 0;
    let pageTop = 0;
    const center = obj.getCenterPoint();

    for (let i = 0; i < (pages.value ? pages.value.length : 1); i++) {
      const page = pages.value ? pages.value[i] : {};
      const pHeight = page.height || CANVAS_CONSTANTS.PAGE_HEIGHT;
      const pageBottom = accumulatedY + pHeight + GAP;

      if (center.y >= accumulatedY && center.y < pageBottom) {
        targetPageIndex = i;
        pageTop = accumulatedY;
        break;
      }
      if (i === (pages.value ? pages.value.length : 1) - 1 && center.y >= pageBottom) {
        targetPageIndex = i;
        pageTop = accumulatedY;
      }

      accumulatedY += pHeight + GAP;
    }

    const targetPage = pages.value ? pages.value[targetPageIndex] : {};
    const targetWidth = targetPage?.width || CANVAS_CONSTANTS.PAGE_WIDTH;
    const targetHeight = targetPage?.height || CANVAS_CONSTANTS.PAGE_HEIGHT;

    let globalMaxWidth = 0;
    (pages.value || []).forEach((p) => {
      const w = p.width || CANVAS_CONSTANTS.PAGE_WIDTH;
      if (w > globalMaxWidth) globalMaxWidth = w;
    });
    const offsetLeft = (globalMaxWidth - targetWidth) / 2;

    if (
      !obj.clipPath ||
      obj.clipPath.top !== pageTop ||
      obj.clipPath.left !== offsetLeft ||
      obj.clipPath.height !== targetHeight ||
      obj.clipPath.width !== targetWidth
    ) {
      obj.clipPath = new fabric.Rect({
        left: offsetLeft,
        top: pageTop,
        width: targetWidth,
        height: targetHeight,
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
    const GAP = CANVAS_CONSTANTS.PAGE_GAP;

    let accumulatedY = 0;
    let calculatedPageIndex = 0;

    for (let i = 0; i < pages.value.length; i++) {
      const pHeight = pages.value[i].height || CANVAS_CONSTANTS.PAGE_HEIGHT;
      const pageBottom = accumulatedY + pHeight + GAP;

      if (center.y >= accumulatedY && center.y < pageBottom) {
        calculatedPageIndex = i;
        break;
      }
      if (i === pages.value.length - 1 && center.y >= pageBottom) {
        calculatedPageIndex = i;
      }
      accumulatedY += pHeight + GAP;
    }

    if (calculatedPageIndex >= 0 && calculatedPageIndex < pages.value.length) {
      if (currentPageIndex.value !== calculatedPageIndex) {
        currentPageIndex.value = calculatedPageIndex;
      }
    }
  };

  const handleDropSnap = (obj) => {};

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

    canvas.value.on('object:added', (e) => {
      if (e.target && (e.target.id === 'page-bg' || e.target.id === 'page-bg-image')) return;
      if (saveHistory) saveHistory();
    });

    canvas.value.on('object:removed', (e) => {
      if (e.target && (e.target.id === 'page-bg' || e.target.id === 'page-bg-image')) return;
      if (saveHistory) saveHistory();
    });

    canvas.value.on('text:editing:exited', (e) => {
      if (saveHistory) saveHistory();
    });
  };

  return { initCanvasEvents };
}
