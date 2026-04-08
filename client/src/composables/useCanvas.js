import { ref, shallowRef, computed } from 'vue';
import { fabric } from 'fabric';
import { v4 as uuidv4 } from 'uuid';
import { CANVAS_CONSTANTS } from '../constants/canvas';

const memoryStats = {
  objectsCreated: 0,
  objectsDestroyed: 0,
  clipPathsCreated: 0,
  clipPathsDestroyed: 0,
  eventListenersAdded: 0,
  eventListenersRemoved: 0
};

const CUSTOM_PROPS = ['id', 'selectable', 'name', 'data', 'textBaseline', 'angle', 'isSignatureBlock', 'isSignaturePrefix', 'linkedId', 'sigData'];

export function useCanvas() {
  const canvas = shallowRef(null);
  const zoomLevel = ref(1);
  const viewportRef = ref(null);

  const historyStack = ref([]);
  const redoStack = ref([]);
  const isHistoryLocked = ref(false);

  const initCanvas = () => {
    if (canvas.value) return;
    fabric.devicePixelRatio = 1;
    canvas.value = new fabric.Canvas('c', {
      width: CANVAS_CONSTANTS.PAGE_WIDTH,
      height: CANVAS_CONSTANTS.PAGE_HEIGHT,
      backgroundColor: '#ffffff',
      preserveObjectStacking: true,
      renderOnAddRemove: true
    });

    canvas.value.on('object:scaling', (e) => {
      const obj = e.target;
      if (!obj) return;

      if (obj.type === 'i-text' || obj.type === 'text' || obj.type === 'textbox') {
        const corner = e.transform ? e.transform.corner : '';
        const sx = obj.scaleX;
        const sy = obj.scaleY;

        if (corner === 'ml' || corner === 'mr') {
          obj.set({
            width: obj.width * sx,
            scaleX: 1,
            scaleY: 1
          });
        } else {
          const newFontSize = (obj.fontSize || 16) * Math.max(sx, sy);
          obj.set({
            fontSize: Math.round(newFontSize),
            width: obj.width * sx,
            height: obj.height * sy,
            scaleX: 1,
            scaleY: 1
          });
        }
        obj.setCoords();
      }
    });
    let relinkTimeout = null;
    canvas.value.on('object:added', () => {
      if (relinkTimeout) clearTimeout(relinkTimeout);
      relinkTimeout = setTimeout(() => {
        relinkSignatures();
      }, 300);
    });
  };

  const render = async () => {
    if (canvas.value) canvas.value.requestRenderAll();
  };

  let saveHistoryTimeout = null;

  const saveHistory = () => {
    if (!canvas.value || isHistoryLocked.value) return;

    if (saveHistoryTimeout) clearTimeout(saveHistoryTimeout);

    saveHistoryTimeout = setTimeout(() => {
      if (!canvas.value || isHistoryLocked.value) return;

      const json = canvas.value.toJSON(CUSTOM_PROPS);
      const jsonString = JSON.stringify(json);

      if (historyStack.value.length > 0 && historyStack.value[historyStack.value.length - 1] === jsonString) {
        return;
      }

      historyStack.value.push(jsonString);
      redoStack.value = [];
    }, 100);
  };

  const undo = () => {
    if (historyStack.value.length > 1) {
      isHistoryLocked.value = true;
      const current = historyStack.value.pop();
      redoStack.value.push(current);

      const previous = historyStack.value[historyStack.value.length - 1];
      canvas.value.loadFromJSON(JSON.parse(previous), () => {
        canvas.value.renderAll();
        relinkSignatures();
        if (typeof window.saveCurrentPageState === 'function') window.saveCurrentPageState();

        setTimeout(() => { isHistoryLocked.value = false; }, 100);
      });
    }
  };

  const redo = () => {
    if (redoStack.value.length > 0) {
      isHistoryLocked.value = true;
      const next = redoStack.value.pop();
      historyStack.value.push(next);

      canvas.value.loadFromJSON(JSON.parse(next), () => {
        canvas.value.renderAll();
        relinkSignatures();
        if (typeof window.saveCurrentPageState === 'function') window.saveCurrentPageState();

        setTimeout(() => { isHistoryLocked.value = false; }, 100);
      });
    }
  };

  const resetHistory = () => {
    historyStack.value = [];
    redoStack.value = [];
  };

  const addVariableToCanvas = (key, x = 100, y = 100) => {
    if (!canvas.value) return;
    const textObj = new fabric.Textbox(`{{${key}}}`, {
      id: uuidv4(),
      left: x,
      top: y,
      width: 200,
      fontSize: 16,
      fontFamily: 'Sarabun',
      fill: '#000000',
      editable: true
    });

    if (typeof window.forceUnlockObject === 'function') {
      window.forceUnlockObject(textObj);
    } else {
      textObj.setControlsVisibility({ mt: true, mb: true, ml: true, mr: true });
    }

    canvas.value.add(textObj);
    canvas.value.setActiveObject(textObj);
    if (typeof window.saveCurrentPageState === 'function') window.saveCurrentPageState();
    saveHistory();
  };

  const wrapThaiText = (text, maxWidth, fontSize, fontFamily) => {
    if (!text) return '';
    if (!window.Intl || !Intl.Segmenter) return text;

    const tempCanvas = document.createElement('canvas');
    const ctx = tempCanvas.getContext('2d');
    ctx.font = `${fontSize}px ${fontFamily}`;

    const segmenter = new Intl.Segmenter('th-TH', { granularity: 'word' });
    const words = Array.from(segmenter.segment(text)).map(s => s.segment);

    let lines = [];
    let currentLine = '';

    for (let i = 0; i < words.length; i++) {
      const word = words[i];

      if (ctx.measureText(word).width <= maxWidth) {
        const testLine = currentLine + word;
        if (ctx.measureText(testLine).width > maxWidth && currentLine !== '') {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      } else {
        for (let char of word) {
          const testLineChar = currentLine + char;
          if (ctx.measureText(testLineChar).width > maxWidth && currentLine !== '') {
            lines.push(currentLine);
            currentLine = char;
          } else {
            currentLine = testLineChar;
          }
        }
      }
    }

    if (currentLine) lines.push(currentLine);

    return lines.join('\n');
  };

  if (!fabric.Object.prototype.__customExportPatched) {
    const originalToObject = fabric.Object.prototype.toObject;
    fabric.Object.prototype.toObject = function (additionalProperties) {
      return originalToObject.call(this, [
        'id', 'name', 'isSignatureBlock', 'isSignaturePrefix', 'linkedId', 'sigData'
      ].concat(additionalProperties || []));
    };
    fabric.Object.prototype.__customExportPatched = true;
  }

  const linkSignatureBlocks = (canvasObj, prefixTextbox, sigGroup, GAP) => {
    if (prefixTextbox.__isLinked) return;
    prefixTextbox.__isLinked = true;
    sigGroup.__isLinked = true;

    let isSyncing = false;

    const syncPositions = (movedObj) => {
      if (isSyncing || prefixTextbox.group || sigGroup.group) return;
      const activeObj = canvasObj.getActiveObject();
      if (activeObj && activeObj.type === 'activeSelection') return;

      isSyncing = true;
      if (movedObj === prefixTextbox && sigGroup.canvas) {
        sigGroup.set({ left: prefixTextbox.left, top: prefixTextbox.top + prefixTextbox.getScaledHeight() + GAP });
        sigGroup.setCoords();
      } else if (movedObj === sigGroup && prefixTextbox.canvas) {
        prefixTextbox.set({ left: sigGroup.left, top: sigGroup.top - prefixTextbox.getScaledHeight() - GAP });
        prefixTextbox.setCoords();
      }
      isSyncing = false;
    };

    const originalPrefixSet = prefixTextbox.set.bind(prefixTextbox);
    prefixTextbox.set = function (...args) {
      originalPrefixSet(...args);
      if (!this.group) syncPositions(prefixTextbox);
      return this;
    };

    const originalGroupSet = sigGroup.set.bind(sigGroup);
    sigGroup.set = function (...args) {
      originalGroupSet(...args);
      if (!this.group) syncPositions(sigGroup);
      return this;
    };

    prefixTextbox.on('moving', () => syncPositions(prefixTextbox));
    prefixTextbox.on('resizing', () => syncPositions(prefixTextbox));
    prefixTextbox.on('scaling', () => syncPositions(prefixTextbox));
    sigGroup.on('moving', () => syncPositions(sigGroup));
    sigGroup.on('scaling', () => syncPositions(sigGroup));

    prefixTextbox.on('changed', () => {
      syncPositions(prefixTextbox);
      canvasObj.renderAll();
    });

    const handleDeletion = (deletedObj) => {
      if (deletedObj.isDeleting) return;
      deletedObj.isDeleting = true;
      if (deletedObj === prefixTextbox && sigGroup.canvas) {
        sigGroup.isDeleting = true;
        canvasObj.remove(sigGroup);
      } else if (deletedObj === sigGroup && prefixTextbox.canvas) {
        prefixTextbox.isDeleting = true;
        canvasObj.remove(prefixTextbox);
      }
    };

    prefixTextbox.on('removed', () => handleDeletion(prefixTextbox));
    sigGroup.on('removed', () => handleDeletion(sigGroup));
  };

  const addSignatureBlockToCanvas = (sigData, dropX = 100, dropY = 100) => {
    if (!canvas.value) return;

    const maxTextWidth = 250;
    const fontSize = 16;
    const fontFamily = 'Sarabun';

    const GAP = 30;

    const sharedLinkedId = `link_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    let prefixTextbox = null;

    if (sigData.prefixText) {
      const wrappedPrefix = (typeof wrapThaiText === 'function')
        ? wrapThaiText(sigData.prefixText, maxTextWidth, fontSize, fontFamily)
        : sigData.prefixText;

      prefixTextbox = new fabric.Textbox(wrappedPrefix, {
        left: dropX,
        top: dropY,
        fontSize: fontSize,
        fontFamily: fontFamily,
        textAlign: 'center',
        width: maxTextWidth + 20,
        originX: 'center',
        originY: 'top',
        id: `prefix_${sharedLinkedId}`,
        name: `ข้อความ: ${sigData.fullName}`,
        isSignaturePrefix: true,
        linkedId: sharedLinkedId
      });
      canvas.value.add(prefixTextbox);
    }

    const buildAndLinkSignatureGroup = (imgObj = null) => {
      const objects = [];
      let currentInternalY = 0;
      const centerX = 0;

      const balancer = new fabric.Rect({
        left: centerX, top: currentInternalY, width: 250, height: 1,
        fill: 'transparent', originX: 'center', originY: 'top', selectable: false
      });
      objects.push(balancer);

      if (imgObj) {
        imgObj.scaleToHeight(45);
        imgObj.set({ originX: 'center', originY: 'top', top: currentInternalY, left: centerX });
        objects.push(imgObj);

        currentInternalY += imgObj.getScaledHeight() + 20;
      } else {
        currentInternalY += 60;
      }

      const nameText = new fabric.Text(`( ${sigData.fullName} )`, {
        fontSize: fontSize, fontFamily: fontFamily,
        originX: 'center', originY: 'top', top: currentInternalY, left: centerX
      });
      objects.push(nameText);

      currentInternalY += nameText.height + 15;

      if (sigData.position) {
        const wrappedPos = (typeof wrapThaiText === 'function')
          ? wrapThaiText(sigData.position, maxTextWidth, fontSize, fontFamily)
          : sigData.position;

        const bottomText = new fabric.Text(wrappedPos, {
          fontSize: fontSize, fontFamily: fontFamily,
          originX: 'center', originY: 'top', textAlign: 'center',
          top: currentInternalY, left: centerX
        });
        objects.push(bottomText);
      }

      let sigTopY = dropY;
      if (prefixTextbox) {
        sigTopY = prefixTextbox.top + prefixTextbox.getScaledHeight() + GAP;
      }

      const sigGroup = new fabric.Group(objects, {
        left: dropX, top: sigTopY, originX: 'center', originY: 'top',
        isSignatureBlock: true, linkedId: sharedLinkedId, sigData: sigData,
        id: `signature_${sharedLinkedId}`, name: `กลุ่มชื่อ: ${sigData.fullName}`
      });

      canvas.value.add(sigGroup);

      if (prefixTextbox) {
        linkSignatureBlocks(canvas.value, prefixTextbox, sigGroup, GAP);
        const sel = new fabric.ActiveSelection([prefixTextbox, sigGroup], { canvas: canvas.value });
        canvas.value.setActiveObject(sel);

        if (!canvas.value.__hasSmartDblClick) {
          canvas.value.on('mouse:dblclick', (e) => {
            const activeObj = canvas.value.getActiveObject();
            if (activeObj && activeObj.type === 'activeSelection') {
              const pointer = canvas.value.getPointer(e.e);
              const objectsInSelection = [...activeObj.getObjects()];
              canvas.value.discardActiveObject();

              let innerTarget = null;
              for (let i = 0; i < objectsInSelection.length; i++) {
                const obj = objectsInSelection[i];
                obj.setCoords();
                if (obj.containsPoint(pointer)) {
                  innerTarget = obj;
                  break;
                }
              }

              if (innerTarget && innerTarget.isSignaturePrefix) {
                canvas.value.setActiveObject(innerTarget);
                canvas.value.requestRenderAll();
                setTimeout(() => {
                  innerTarget.enterEditing();
                  innerTarget.selectAll();
                  canvas.value.requestRenderAll();
                }, 50);
              } else if (innerTarget) {
                canvas.value.setActiveObject(innerTarget);
                canvas.value.requestRenderAll();
              } else {
                const sel = new fabric.ActiveSelection(objectsInSelection, { canvas: canvas.value });
                canvas.value.setActiveObject(sel);
                canvas.value.requestRenderAll();
              }
            }
          });
          canvas.value.__hasSmartDblClick = true;
        }
      } else {
        canvas.value.setActiveObject(sigGroup);
      }

      canvas.value.requestRenderAll();
    };

    if (sigData.signatureImage) {
      let imageUrl = sigData.signatureImage;
      if (imageUrl.includes('uploads/')) {
        const backendPort = 4010;
        const protocol = window.location.protocol;
        const hostname = window.location.hostname;
        if (!imageUrl.startsWith('/')) imageUrl = '/' + imageUrl;
        imageUrl = `${protocol}//${hostname}:${backendPort}${imageUrl}`;
      }

      fabric.Image.fromURL(imageUrl, (img, isError) => {
        if (!isError && img) buildAndLinkSignatureGroup(img);
        else buildAndLinkSignatureGroup();
      }, { crossOrigin: 'anonymous' });
    } else {
      buildAndLinkSignatureGroup();
    }
  };

  const relinkSignatures = () => {
    if (!canvas.value) return;
    const objects = canvas.value.getObjects();
    const pairs = {};

    objects.forEach(obj => {
      if (obj.linkedId) {
        if (!pairs[obj.linkedId]) pairs[obj.linkedId] = {};
        if (obj.isSignaturePrefix) pairs[obj.linkedId].prefix = obj;
        if (obj.isSignatureBlock) pairs[obj.linkedId].group = obj;
      }
    });

    Object.values(pairs).forEach(pair => {
      if (pair.prefix && pair.group) {
        const GAP = pair.group.sigData?.signatureImage ? 10 : 30;
        linkSignatureBlocks(canvas.value, pair.prefix, pair.group, GAP);
      }
    });
  };

  const addImageToCanvas = async (url, x = 100, y = 100) => {
    if (!canvas.value) return;
    fabric.Image.fromURL(url, (img) => {
      img.set({ id: uuidv4(), left: x, top: y });
      img.scaleToWidth(200);

      if (typeof window.forceUnlockObject === 'function') {
        window.forceUnlockObject(img);
      }

      canvas.value.add(img);
      canvas.value.setActiveObject(img);
      if (typeof window.saveCurrentPageState === 'function') window.saveCurrentPageState();
      saveHistory();
    }, { crossOrigin: 'anonymous' });
  };

  const removeSelectedObject = () => {
    if (!canvas.value) return;
    const active = canvas.value.getActiveObject();
    if (active) {
      canvas.value.remove(active);
      if (typeof window.saveCurrentPageState === 'function') window.saveCurrentPageState();
      saveHistory();
    }
  };

  const onDragStart = (e, key) => { e.dataTransfer.setData('variable', key); };
  const onDrop = (e) => {
    const key = e.dataTransfer.getData('variable');
    if (key) addVariableToCanvas(key);
  };

  const saveCurrentPageStateAtomic = (canvas, pages, zoomLevel) => {
    if (!canvas || !pages) return;

    const pageObjectMap = new Map();
    pages.forEach((page, index) => { pageObjectMap.set(index, []); });

    const objects = [...canvas.getObjects()];
    objects.forEach(obj => {
      if (!obj.nodeId && obj.id !== 'page-bg' && obj.id !== 'page-bg-image') {
        canvas.remove(obj);
      }
    });

    const allObjects = canvas.getObjects();

    allObjects.forEach((obj) => {
      if (!obj || obj.id === 'page-bg' || obj.id === 'page-bg-image') return;
      if (typeof obj.top !== 'number' || isNaN(obj.top)) return;

      let exportLeft = obj.left;
      let exportTop = obj.top;
      if (obj.originX === 'center') exportLeft = obj.left - (obj.width * obj.scaleX) / 2;
      if (obj.originY === 'center') exportTop = obj.top - (obj.height * obj.scaleY) / 2;

      const center = obj.getCenterPoint();
      const P_H = CANVAS_CONSTANTS.PAGE_HEIGHT;
      const GAP = CANVAS_CONSTANTS.PAGE_GAP;
      const STRIDE = P_H + GAP;

      let pageIndex = Math.floor(center.y / STRIDE);
      pageIndex = Math.max(0, Math.min(pageIndex, pages.length - 1));

      try {
        const serialized = obj.toObject(CUSTOM_PROPS);
        const pageTopY = pageIndex * STRIDE;

        serialized.left = Math.round(exportLeft * 100) / 100;
        serialized.top = Math.round((exportTop - pageTopY) * 100) / 100;
        serialized.width = Math.round((obj.width || 0) * 100) / 100;
        serialized.height = Math.round((obj.height || 0) * 100) / 100;
        serialized.angle = obj.angle || 0;

        if (serialized.textBaseline === 'alphabetical') serialized.textBaseline = 'alphabetic';

        pageObjectMap.get(pageIndex).push(serialized);
      } catch (e) {
        console.error('Failed to serialize object:', e);
      }
    });

    return pages.map((page, index) => ({
      ...page, objects: pageObjectMap.get(index) || []
    }));
  };

  const capturePageAsImage = (pageIndex, pageHeight, pageGap, multiplier = 2) => {
    try {
      const c = canvas.value;
      if (!c) return null;

      const P_H = CANVAS_CONSTANTS.PAGE_HEIGHT;
      const GAP = CANVAS_CONSTANTS.PAGE_GAP;
      const captureWidth = CANVAS_CONSTANTS.PAGE_WIDTH * zoomLevel.value;
      const captureHeight = P_H * zoomLevel.value;
      const topOffset = pageIndex * (P_H + GAP) * zoomLevel.value;

      const TEXT_TYPES = ['textbox', 'text', 'i-text'];
      const IMAGE_TYPES = ['image'];
      const ALL_OVERLAY_TYPES = [...TEXT_TYPES, ...IMAGE_TYPES];

      const allObjects = c.getObjects();
      const hiddenForCapture = [];

      allObjects.forEach(obj => {
        const center = obj.getCenterPoint();
        const objPageIndex = Math.floor(center.y / (P_H + GAP));
        const isWrongPage = objPageIndex !== pageIndex;
        const isOverlay = ALL_OVERLAY_TYPES.includes(obj.type) &&
          obj.id !== 'page-bg-image' &&
          obj.id !== 'page-bg';

        if ((isWrongPage || isOverlay) && obj.visible) {
          hiddenForCapture.push(obj);
          obj.visible = false;
        }
      });

      c.renderAll();

      let dataUrl = null;
      try {
        dataUrl = c.toDataURL({
          format: 'jpeg',
          quality: 0.92,
          multiplier: multiplier / zoomLevel.value,
          left: 0,
          top: topOffset,
          width: captureWidth,
          height: captureHeight
        });
      } catch (canvasError) {
        console.warn(`Canvas taint detected on page ${pageIndex + 1}, using fallback:`, canvasError);

        try {
          const fallbackCanvas = document.createElement('canvas');
          fallbackCanvas.width = CANVAS_CONSTANTS.PAGE_WIDTH * multiplier;
          fallbackCanvas.height = P_H * multiplier;
          const fallbackCtx = fallbackCanvas.getContext('2d');

          fallbackCtx.fillStyle = '#ffffff';
          fallbackCtx.fillRect(0, 0, fallbackCanvas.width, fallbackCanvas.height);

          dataUrl = fallbackCanvas.toDataURL('image/jpeg', 0.92);
        } catch (fallbackError) {
          console.error(`Even fallback failed for page ${pageIndex + 1}:`, fallbackError);
          return null;
        }
      }

      hiddenForCapture.forEach(obj => { obj.visible = true; });
      c.renderAll();

      return dataUrl && dataUrl.length > 100 ? dataUrl : null;

    } catch (error) {
      console.error(`Error capturing page ${pageIndex + 1}:`, error);
      return null;
    }
  };

  const cleanupCanvasObjects = (canvas, deep = true) => {
    if (!canvas) return;

    let cleanedCount = 0;

    const objects = canvas.getObjects();

    objects.forEach(obj => {
      try {
        if (obj.clipPath) {
          if (obj.clipPath.dispose && typeof obj.clipPath.dispose === 'function') {
            obj.clipPath.dispose();
          }
          obj.clipPath = null;
          memoryStats.clipPathsDestroyed++;
        }

        if (obj.off && typeof obj.off === 'function') {
          obj.off();
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

  const updateCanvasZoom = () => {
    if (!canvas.value) return;
    canvas.value.requestRenderAll();
  };

  const loadFromSocket = (json) => {
    if (!canvas.value) return;

    canvas.value.loadFromJSON(json, () => {
      canvas.value.renderAll();
      relinkSignatures();

      document.fonts.ready.then(() => {
        if (canvas.value) canvas.value.requestRenderAll();
      });

      canvas.value.fire('history:restored');
    });
  };

  const zoomIn = () => { zoomLevel.value = Math.min(3, zoomLevel.value + 0.1); };
  const zoomOut = () => { zoomLevel.value = Math.max(0.1, zoomLevel.value - 0.1); };
  const fitToScreen = () => { zoomLevel.value = 1; };

  const bringForward = (objOrId) => {
    if (!canvas.value) return;
    const obj = typeof objOrId === 'string'
      ? canvas.value.getObjects().find(o => o.id === objOrId || o.nodeId === objOrId)
      : objOrId;
    if (obj) {
      canvas.value.bringForward(obj);
      saveHistory();
    }
  };

  const sendBackwards = (objOrId) => {
    if (!canvas.value) return;
    const obj = typeof objOrId === 'string'
      ? canvas.value.getObjects().find(o => o.id === objOrId || o.nodeId === objOrId)
      : objOrId;
    if (obj) {
      canvas.value.sendBackwards(obj);
      saveHistory();
    }
  };

  const bringToFront = (objOrId) => {
    if (!canvas.value) return;
    const obj = typeof objOrId === 'string'
      ? canvas.value.getObjects().find(o => o.id === objOrId || o.nodeId === objOrId)
      : objOrId;
    if (obj) {
      canvas.value.bringToFront(obj);
      saveHistory();
    }
  };

  const sendToBack = (objOrId) => {
    if (!canvas.value) return;
    const obj = typeof objOrId === 'string'
      ? canvas.value.getObjects().find(o => o.id === objOrId || o.nodeId === objOrId)
      : objOrId;
    if (obj) {
      canvas.value.sendToBack(obj);
      saveHistory();
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
          const objects = canvas.getObjects();

          objects.forEach(obj => {
            if (obj._cacheContext) {
              obj._cacheContext = null;
            }
            if (obj._cacheCanvas) {
              obj._cacheCanvas = null;
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

  const setHistoryLock = (status) => { isHistoryLocked.value = status; };

  const updateCanvasDimensions = () => {
    if (canvas.value) {
      canvas.value.calcOffset();
      canvas.value.requestRenderAll();
    }
  };

  return {
    canvas,
    zoomLevel,
    viewportRef,
    historyStack,
    redoStack,
    undo,
    redo,
    resetHistory,
    saveHistory,
    setHistoryLock,
    setHistoryContext: () => { },
    canUndo: computed(() => historyStack.value.length > 1),
    canRedo: computed(() => redoStack.value.length > 0),

    initCanvas,
    addVariableToCanvas,
    removeSelectedObject,
    addImageToCanvas,
    onDragStart,
    onDrop,
    capturePageAsImage,
    updateCanvasZoom,
    loadFromSocket,
    zoomIn,
    zoomOut,
    fitToScreen,

    bringForward,
    sendBackwards,
    bringToFront,
    sendToBack,

    cleanupCanvasObjects,
    getMemoryStats,
    resetMemoryStats,
    trackObjectCreation,
    trackEventListener,
    periodicCleanup,

    saveCurrentPageStateAtomic,

    render,

    addSignatureBlockToCanvas,
    updateCanvasDimensions,
    relinkSignatures
  };
}
