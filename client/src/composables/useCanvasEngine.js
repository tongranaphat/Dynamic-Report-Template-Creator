import { ref, shallowRef, computed, onMounted, watch } from 'vue';
import { fabric } from 'fabric';
import { v4 as uuidv4 } from 'uuid';
import { CANVAS_CONSTANTS } from '../constants/canvas';
import { renderBlocksToCanvas, attachBlockInteraction } from '../engines/rendering/fabricRenderer';
import { CanvasHistory } from '../engines/document/canvasHistory';

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

    const capturePageAsImage = (pageIndex, pageHeight, pageGap, multiplier = 2, quality = 1) => {
        // Stub
        return null;
    };

    const updateCanvasZoom = () => {
        if (!canvas.value) return;
        canvas.value.requestRenderAll();
    };

    const loadFromSocket = (json) => { };
    const zoomIn = () => { zoomLevel.value = Math.min(3, zoomLevel.value + 0.1); };
    const zoomOut = () => { zoomLevel.value = Math.max(0.1, zoomLevel.value - 0.1); };
    const fitToScreen = () => { zoomLevel.value = 1; };

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

        // Expose layout/render tools
        render
    };
}
