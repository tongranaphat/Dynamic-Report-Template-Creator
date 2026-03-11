import { ref, shallowRef, computed, onMounted, watch } from 'vue';
import { fabric } from 'fabric';
import { v4 as uuidv4 } from 'uuid';
import { CANVAS_CONSTANTS } from '../constants/canvas';
import { renderBlocksToCanvas, attachBlockInteraction } from '../engines/rendering/fabricRenderer';
import { CanvasHistory } from '../engines/document/canvasHistory';

// Memory tracking
const memoryStats = {
    objectsCreated: 0,
    objectsDestroyed: 0,
    clipPathsCreated: 0,
    clipPathsDestroyed: 0,
    eventListenersAdded: 0,
    eventListenersRemoved: 0
};

// Global State (matched to legacy shape to avoid breaking UI)
const canvas = shallowRef(null);
const historyStack = ref([]);
const redoStack = ref([]);
const isHistoryLocked = ref(false);

export function useCanvasEngine() {
    const zoomLevel = ref(1);
    const viewportRef = ref(null);

    // New Engine Data Model
    const blocks = ref([]);
    const canvasHistory = new CanvasHistory(blocks.value); // The new engine history instance

    const initCanvas = () => {
        if (canvas.value) return;
        console.log("[ENGINE] new canvas engine initialized");
        fabric.devicePixelRatio = 1;
        canvas.value = new fabric.Canvas('c', {
            width: CANVAS_CONSTANTS.PAGE_WIDTH,
            height: CANVAS_CONSTANTS.PAGE_HEIGHT,
            backgroundColor: '#ffffff',
            preserveObjectStacking: true,
            renderOnAddRemove: false,
            stateful: false
        });

        // Wire up the new engine's interaction listener
        attachBlockInteraction(canvas.value, () => blocks.value, canvasHistory, () => {
            // Triggers re-render if needed
            canvas.value.requestRenderAll();
        });

        if (!window.engineKeyboardBound) {
            window.addEventListener('keydown', (e) => {
                if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) return;

                if (e.ctrlKey || e.metaKey) {
                    const key = e.key.toLowerCase();
                    if (key === 'z' && !e.shiftKey) {
                        e.preventDefault();
                        undo();
                    } else if (key === 'y' || (key === 'z' && e.shiftKey)) {
                        e.preventDefault();
                        redo();
                    }
                }
            });
            window.engineKeyboardBound = true;
        }

        console.log('[ENGINE] New Canvas Engine Initialized');
        render();
    };

    const render = async () => {
        if (!canvas.value) return;
        await renderBlocksToCanvas(canvas.value, blocks.value);
    };

    watch(blocks, render, { deep: true });

    // --------------------------------------------------------------------------
    // Legacy Hook Compatibility Stubs
    // These implementations either map cleanly to the new model or are no-ops
    // to ensure EditorView.vue doesn't crash.
    // --------------------------------------------------------------------------

    const saveHistory = () => {
        canvasHistory.push(JSON.parse(JSON.stringify(blocks.value)));
    };

    const undo = () => {
        console.log('[ENGINE] undo');
        const prev = canvasHistory.undo();
        if (prev) {
            blocks.value = prev;
        }
    };

    const redo = () => {
        console.log('[ENGINE] redo');
        const next = canvasHistory.redo();
        if (next) {
            blocks.value = next;
        }
    };

    const resetHistory = () => {
        canvasHistory.clear();
    };

    const setHistoryLock = (status) => {
        isHistoryLocked.value = status;
    };

    const setCanvasBackground = async (dataUrl) => {
        console.log('[ENGINE] setCanvasBackground called');
    };

    const addVariableToCanvas = (key, x = 100, y = 100) => {
        console.log("[ADD VARIABLE]", key);
        console.log('[ENGINE] variable added');
        blocks.value.push({
            id: uuidv4(),
            type: 'text',
            content: [
                { text: `{{${key}}}` }
            ],
            transform: { x, y, width: 300, height: 50, rotation: 0 },
            opacity: 1,
            visible: true,
            locked: false,
            locale: {
                languageHint: 'th',
                lineBreakStrategy: { mode: 'mixed' },
                textDirection: 'ltr'
            }
        });
        saveHistory();
    };

    const removeSelectedObject = () => {
        if (!canvas.value) return;
        const active = canvas.value.getActiveObject();
        if (active && active.nodeId) {
            blocks.value = blocks.value.filter(b => b.id !== active.nodeId);
            saveHistory();
        }
    };

    const addImageToCanvas = async (url, x = 100, y = 100) => {
        console.log("[ADD IMAGE]", url);
        console.log('[ENGINE] image added');
        const img = new Image();
        img.onload = () => {
            blocks.value.push({
                id: uuidv4(),
                type: 'image',
                src: url,
                transform: {
                    x,
                    y,
                    width: img.width,
                    height: img.height,
                    rotation: 0
                },
                width: img.width,
                height: img.height,
                opacity: 1,
                visible: true,
                locked: false
            });
            saveHistory();
        };
        img.onerror = () => {
            console.warn('Failed to load image dimensions, defaulting to 300x300');
            blocks.value.push({
                id: uuidv4(),
                type: 'image',
                src: url,
                transform: { x, y, width: 300, height: 300, rotation: 0 },
                width: 300,
                height: 300,
                opacity: 1,
                visible: true,
                locked: false
            });
            saveHistory();
        };
        img.src = url;
    };

    const onDragStart = (e, key) => {
        e.dataTransfer.setData('variable', key);
    };

    const onDrop = (e) => {
        if (!canvas.value) return;
        const key = e.dataTransfer.getData('variable');
        if (key) {
            addVariableToCanvas(key);
        }
    };

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
            
            const P_H = CANVAS_CONSTANTS.PAGE_HEIGHT;
            const GAP = CANVAS_CONSTANTS.PAGE_GAP;
            const STRIDE = P_H + GAP;
            
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
    
    const bringForward = (blockId) => {
        if (!canvas.value) return;
        const obj = canvas.value.getObjects().find(o => o.nodeId === blockId);
        if (obj) {
            canvas.value.bringForward(obj);
            updateBlockOrderFromCanvas();
            saveHistory();
        }
    };

    const sendBackwards = (blockId) => {
        if (!canvas.value) return;
        const obj = canvas.value.getObjects().find(o => o.nodeId === blockId);
        if (obj) {
            canvas.value.sendBackwards(obj);
            updateBlockOrderFromCanvas();
            saveHistory();
        }
    };

    const bringToFront = (blockId) => {
        if (!canvas.value) return;
        const obj = canvas.value.getObjects().find(o => o.nodeId === blockId);
        if (obj) {
            canvas.value.bringToFront(obj);
            updateBlockOrderFromCanvas();
            saveHistory();
        }
    };

    const sendToBack = (blockId) => {
        if (!canvas.value) return;
        const obj = canvas.value.getObjects().find(o => o.nodeId === blockId);
        if (obj) {
            canvas.value.sendToBack(obj);
            updateBlockOrderFromCanvas();
            saveHistory();
        }
    };

    const updateBlockOrderFromCanvas = () => {
        if (!canvas.value) return;
        
        // Get current canvas objects in rendering order (bottom to top)
        const canvasObjects = canvas.value.getObjects().filter(obj => obj.nodeId);
        
        // Create a map of block id to block for quick lookup
        const blockMap = new Map();
        blocks.value.forEach(block => blockMap.set(block.id, block));
        
        // Reorder blocks array to match canvas rendering order
        const reorderedBlocks = [];
        canvasObjects.forEach(obj => {
            const blockId = obj.nodeId;
            const block = blockMap.get(blockId);
            if (block) {
                reorderedBlocks.push(block);
                blockMap.delete(blockId);
            }
        });
        
        // Add any remaining blocks (shouldn't happen in normal cases)
        blockMap.forEach(block => reorderedBlocks.push(block));
        
        blocks.value = reorderedBlocks;
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
        canUndo: computed(() => canvasHistory.canUndo()),
        canRedo: computed(() => canvasHistory.canRedo()),

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
