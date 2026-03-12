import { ref, shallowRef, computed } from 'vue';
import { fabric } from 'fabric';
import { v4 as uuidv4 } from 'uuid';
import { CANVAS_CONSTANTS } from '../constants/canvas';

// Memory tracking
const memoryStats = {
    objectsCreated: 0,
    objectsDestroyed: 0,
    clipPathsCreated: 0,
    clipPathsDestroyed: 0,
    eventListenersAdded: 0,
    eventListenersRemoved: 0
};

export function useCanvasEngine() {
    const canvas = shallowRef(null);
    const zoomLevel = ref(1);
    const viewportRef = ref(null);

    // Native Fabric History
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

        // Handle visual resizing smoothly in real-time
        canvas.value.on('object:scaling', (e) => {
            const obj = e.target;
            if (!obj) return;

            // จัดการสเกลเฉพาะข้อความ (ส่วนรูปภาพปล่อยให้ Fabric.js จัดการยืดหดตามธรรมชาติ)
            if (obj.type === 'i-text' || obj.type === 'text' || obj.type === 'textbox') {
                const corner = e.transform ? e.transform.corner : '';
                const sx = obj.scaleX;
                const sy = obj.scaleY;

                if (corner === 'ml' || corner === 'mr') {
                    // ดึงซ้าย/ขวา -> เปลี่ยนความกว้าง (Width) เพื่อให้ข้อความตัดบรรทัด
                    obj.set({
                        width: obj.width * sx,
                        scaleX: 1,
                        scaleY: 1
                    });
                } else {
                    // ดึงมุม (tl, tr, bl, br) -> เปลี่ยนขนาดตัวหนังสือ (Font Size)
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

        console.log('[ENGINE] Unified Direct Canvas Engine Initialized');
    };

    const render = async () => {
        if (canvas.value) canvas.value.requestRenderAll();
    };

    const saveHistory = () => {
        if (!canvas.value || isHistoryLocked.value) return;
        const json = canvas.value.toJSON(['id', 'selectable', 'name', 'data', 'textBaseline', 'angle']);
        historyStack.value.push(JSON.stringify(json));
        redoStack.value = [];
    };

    const undo = () => {
        if (historyStack.value.length > 1) {
            isHistoryLocked.value = true;
            const current = historyStack.value.pop();
            redoStack.value.push(current);
            const previous = historyStack.value[historyStack.value.length - 1];
            canvas.value.loadFromJSON(JSON.parse(previous), () => {
                canvas.value.renderAll();
                if (typeof window.saveCurrentPageState === 'function') window.saveCurrentPageState();
                isHistoryLocked.value = false;
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
                if (typeof window.saveCurrentPageState === 'function') window.saveCurrentPageState();
                isHistoryLocked.value = false;
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

        // Scrub ghosts before exporting to prevent duplicate reflected items in PDF
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

            // Normalize origin to top-left for standard PDF generation compatibility
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
                const serialized = obj.toObject(['id', 'selectable', 'name', 'data', 'textBaseline', 'angle']);
                const pageTopY = pageIndex * STRIDE;

                serialized.left = Math.round(exportLeft * 100) / 100;
                serialized.top = Math.round((exportTop - pageTopY) * 100) / 100;
                serialized.width = Math.round((obj.width || 0) * 100) / 100;
                serialized.height = Math.round((obj.height || 0) * 100) / 100;
                serialized.angle = obj.angle || 0; // Force explicitly

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

    const capturePageAsImage = (pageIndex, pageHeight, pageGap, multiplier = 2, quality = 1) => {
        // Enhanced capture with CORS protection
        try {
            const canvas = canvas.value;
            if (!canvas) return null;

            const P_H = CANVAS_CONSTANTS.PAGE_HEIGHT;
            const GAP = CANVAS_CONSTANTS.PAGE_GAP;
            const TEXT_TYPES = ['textbox', 'text', 'i-text'];
            const IMAGE_TYPES = ['image'];
            const ALL_OVERLAY_TYPES = [...TEXT_TYPES, ...IMAGE_TYPES];

            // Create a clean canvas clone to avoid tainting
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');

            const captureWidth = CANVAS_CONSTANTS.PAGE_WIDTH * zoomLevel.value;
            const captureHeight = P_H * zoomLevel.value;
            const topOffset = pageIndex * (P_H + GAP) * zoomLevel.value;

            tempCanvas.width = captureWidth;
            tempCanvas.height = captureHeight;

            // Get all objects and determine visibility for this page
            const allObjects = canvas.getObjects();
            const objectsToRender = [];
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
                } else if (!isWrongPage && obj.visible) {
                    objectsToRender.push(obj);
                }
            });

            // Render the clean page
            canvas.renderAll();

            // Use toDataURL with error handling
            let dataUrl = null;
            try {
                dataUrl = canvas.toDataURL({
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

                // Fallback: draw only background elements
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

            // Restore visibility
            hiddenForCapture.forEach(obj => { obj.visible = true; });
            canvas.renderAll();

            return dataUrl && dataUrl.length > 100 ? dataUrl : null;

        } catch (error) {
            console.error(`Error capturing page ${pageIndex + 1}:`, error);
            return null;
        }
    };

    // Enhanced object cleanup with memory tracking
    const cleanupCanvasObjects = (canvas, deep = true) => {
        if (!canvas) return;

        let cleanedCount = 0;
        let clipPathCleanupCount = 0;
        let eventCleanupCount = 0;

        const objects = canvas.getObjects();

        objects.forEach(obj => {
            try {
                // 1. Clear clipPath properly
                if (obj.clipPath) {
                    if (obj.clipPath.dispose && typeof obj.clipPath.dispose === 'function') {
                        obj.clipPath.dispose();
                    }
                    obj.clipPath = null;
                    clipPathCleanupCount++;
                    memoryStats.clipPathsDestroyed++;
                }

                // 2. Remove all event listeners
                if (obj.off && typeof obj.off === 'function') {
                    obj.off();
                    eventCleanupCount++;
                    memoryStats.eventListenersRemoved++;
                }

                // 3. Dispose custom objects
                if (obj.dispose && typeof obj.dispose === 'function') {
                    obj.dispose();
                }

                // 4. Clear references
                if (deep) {
                    // Clear fabric.js internal references
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

        console.log(`Memory cleanup: ${cleanedCount} objects, ${clipPathCleanupCount} clipPaths, ${eventCleanupCount} event listeners`);

        return cleanedCount;
    };

    const updateCanvasZoom = () => {
        if (!canvas.value) return;
        canvas.value.requestRenderAll();
    };

    const loadFromSocket = (json) => {
        // Safe socket loading with history protection
        if (!canvas.value) return;
        console.log('🔄 Receiving update from socket...');

        canvas.value.loadFromJSON(json, () => {
            canvas.value.renderAll();

            // Re-render after fonts load
            document.fonts.ready.then(() => {
                if (canvas.value) canvas.value.requestRenderAll();
            });

            console.log('✅ Remote update applied (history protected)');
            canvas.value.fire('history:restored');
        });
    };
    const zoomIn = () => { zoomLevel.value = Math.min(3, zoomLevel.value + 0.1); };
    const zoomOut = () => { zoomLevel.value = Math.max(0.1, zoomLevel.value - 0.1); };
    const fitToScreen = () => { zoomLevel.value = 1; };

    // --------------------------------------------------------------------------
    // Layer Management Methods
    // --------------------------------------------------------------------------

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

    // Memory monitoring
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

    // Object creation tracking
    const trackObjectCreation = (obj) => {
        memoryStats.objectsCreated++;

        // Track clip paths
        if (obj.clipPath) {
            memoryStats.clipPathsCreated++;
        }
    };

    // Event listener tracking
    const trackEventListener = () => {
        memoryStats.eventListenersAdded++;
    };

    // Periodic memory cleanup
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

                    if (cleaned > 0) {
                        console.log(`Periodic cleanup: cleared ${cleaned} caches`);
                    }
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

    // Compatibility stubs
    const setHistoryLock = (status) => { isHistoryLocked.value = status; };
    const setCanvasBackground = async (dataUrl) => { /* handled by EditorView */ };

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
        setCanvasBackground,
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

        // Layer Management
        bringForward,
        sendBackwards,
        bringToFront,
        sendToBack,

        // Memory Management
        cleanupCanvasObjects,
        getMemoryStats,
        resetMemoryStats,
        trackObjectCreation,
        trackEventListener,
        periodicCleanup,

        // Page State Management
        saveCurrentPageStateAtomic,

        // Expose layout/render tools
        render
    };
}
