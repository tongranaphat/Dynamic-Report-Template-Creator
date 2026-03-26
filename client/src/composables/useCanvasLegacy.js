import { ref, shallowRef, onMounted, computed } from 'vue';
import { fabric } from 'fabric';
import { v4 as uuidv4 } from 'uuid';
import { CANVAS_CONSTANTS } from '../constants/canvas';

const PAGE_H = CANVAS_CONSTANTS.PAGE_HEIGHT;
const PAGE_GAP = CANVAS_CONSTANTS.PAGE_GAP;
const PAGE_STRIDE = PAGE_H + PAGE_GAP;

const originalITextFromObject = fabric.IText.fromObject;
fabric.IText.fromObject = function (object, callback) {
    if (
        object.originY === 'alphabetical' ||
        object.originY === 'alphabetic' ||
        !['top', 'bottom', 'middle', 'center', 'baseline'].includes(object.originY)
    ) {
        object.originY = 'top';
    }
    if (object.textBaseline === 'alphabetical') {
        object.textBaseline = 'alphabetic';
    }
    return originalITextFromObject.call(this, object, callback);
};


const canvas = shallowRef(null);
const historyStack = ref([]);
const redoStack = ref([]);
const isHistoryLocked = ref(false);
const MAX_HISTORY = CANVAS_CONSTANTS.MAX_HISTORY;
let keyboardListenerAttached = false;
let saveTimeout = null;
let _clipboard = null;
let _pasteOffset = 0;

let isRemoteUpdating = false;

export function useCanvasLegacy() {
    const zoomLevel = ref(1);
    const viewportRef = ref(null);
    let isRendering = false;

    const convertUrlToBase64 = async (url) => {
        if (!url || url.startsWith('data:')) return url;
        try {
            const res = await fetch(url);
            const blob = await res.blob();
            return await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (error) {
            console.error('Failed to convert image to base64', error);
            return url;
        }
    };

    let _pagesRef = null;
    let _pageIndexRef = null;

    const setHistoryContext = (pRef, cRef) => {
        _pagesRef = pRef;
        _pageIndexRef = cRef;
    };

    const setHistoryLock = (status) => {
        isHistoryLocked.value = status;
    };

    const resetHistory = () => {

        historyStack.value = [];
        redoStack.value = [];
    };

    const cleanCanvasJSON = (json) => {
        if (!json || !json.objects) return json;
        json.objects = json.objects.map((obj) => {
            if (obj.type === 'text' || obj.type === 'i-text') {
                if (obj.originY === 'alphabetical' || obj.originY === 'alphabetic') obj.originY = 'top';
                if (obj.textBaseline === 'alphabetical') obj.textBaseline = 'alphabetic';
            }
            return obj;
        });
        return json;
    };

    const saveHistory = () => {
        if (!canvas.value || isHistoryLocked.value || isRemoteUpdating) return;

        if (saveTimeout) clearTimeout(saveTimeout);

        saveTimeout = setTimeout(() => {
            try {
                const json = canvas.value.toJSON([
                    'id',
                    'selectable',
                    'name',
                    'data',
                    'originX',
                    'originY',
                    'lockMovementX',
                    'lockMovementY',
                    'textBaseline'
                ]);
                const cleanedJson = cleanCanvasJSON(json);

                const currentStateBlock = {
                    canvasState: cleanedJson,
                    pagesState: _pagesRef && _pagesRef.value ? JSON.stringify(_pagesRef.value) : null,
                    pageIndex: _pageIndexRef ? _pageIndexRef.value : 0
                };

                if (historyStack.value.length > 0) {
                    const lastState = historyStack.value[historyStack.value.length - 1];
                    if (JSON.stringify(lastState.canvasState) === JSON.stringify(cleanedJson) &&
                        lastState.pagesState === currentStateBlock.pagesState) return;
                }

                historyStack.value.push(currentStateBlock);
                if (historyStack.value.length > MAX_HISTORY) historyStack.value.shift();
                redoStack.value = [];



                canvas.value.fire('canvas:changed-by-user', { json: cleanedJson });
            } catch (error) {
                console.error('Error saving history:', error);
            }
        }, 100);
    };

    const loadFromSocket = (json) => {
        if (!canvas.value) return;


        isRemoteUpdating = true;
        setHistoryLock(true);

        canvas.value.loadFromJSON(json, () => {
            canvas.value.renderAll();

            isRemoteUpdating = false;
            setHistoryLock(false);

            canvas.value.fire('history:restored');
        });
    };

    const undo = () => {
        if (
            !canvas.value ||
            historyStack.value.length <= 1 ||
            isHistoryLocked.value ||
            isRemoteUpdating
        )
            return;
        setHistoryLock(true);
        try {
            const currentState = historyStack.value.pop();
            redoStack.value.push(currentState);
            const previousState = historyStack.value[historyStack.value.length - 1];

            if (previousState && previousState.pagesState !== null && _pagesRef) {
                _pagesRef.value = JSON.parse(previousState.pagesState);
                if (_pageIndexRef && previousState.pageIndex !== undefined) {
                    _pageIndexRef.value = previousState.pageIndex;
                }
            }

            canvas.value.loadFromJSON(previousState.canvasState, () => {
                canvas.value.renderAll();
                document.fonts.ready.then(() => { if (canvas.value) canvas.value.requestRenderAll(); });
                setHistoryLock(false);


                canvas.value.fire('canvas:changed-by-user', { json: previousState.canvasState });
                canvas.value.fire('history:restored');
            });
        } catch (error) {
            console.error('Undo error:', error);
            setHistoryLock(false);
        }
    };

    const redo = () => {
        if (!canvas.value || redoStack.value.length === 0 || isHistoryLocked.value || isRemoteUpdating)
            return;
        setHistoryLock(true);
        try {
            const nextState = redoStack.value.pop();
            historyStack.value.push(nextState);

            if (nextState && nextState.pagesState !== null && _pagesRef) {
                _pagesRef.value = JSON.parse(nextState.pagesState);
                if (_pageIndexRef && nextState.pageIndex !== undefined) {
                    _pageIndexRef.value = nextState.pageIndex;
                }
            }

            canvas.value.loadFromJSON(nextState.canvasState, () => {
                canvas.value.renderAll();
                document.fonts.ready.then(() => { if (canvas.value) canvas.value.requestRenderAll(); });
                setHistoryLock(false);


                canvas.value.fire('canvas:changed-by-user', { json: nextState.canvasState });
                canvas.value.fire('history:restored');
            });
        } catch (error) {
            console.error('Redo error:', error);
            setHistoryLock(false);
        }
    };

    const initCanvas = () => {
        if (canvas.value) return;

        fabric.devicePixelRatio = 1;
        canvas.value = new fabric.Canvas('c', {
            width: CANVAS_CONSTANTS.PAGE_WIDTH,
            height: CANVAS_CONSTANTS.PAGE_HEIGHT,
            backgroundColor: '#ffffff',
            preserveObjectStacking: true,
            renderOnAddRemove: false,
            stateful: false
        });
    };

    const updateCanvasZoom = () => {
        if (!canvas.value) return;
        if (!isRendering) {
            isRendering = true;
            try {
                window.requestAnimationFrame(() => {
                    canvas.value.requestRenderAll();
                    isRendering = false;
                });
            } catch (error) {
                isRendering = false;
            }
        }
    };

    const setCanvasBackground = async (dataUrl) => {
        if (!canvas.value) return;
        const base64Url = await convertUrlToBase64(dataUrl);
        fabric.Image.fromURL(
            base64Url,
            (img) => {
                img.scaleToWidth(CANVAS_CONSTANTS.PAGE_WIDTH);
                canvas.value.setBackgroundImage(img, () => {
                    canvas.value.renderAll();
                    saveHistory();
                });
            },
            { crossOrigin: 'anonymous' }
        );
    };

    const addVariableToCanvas = (key, x, y) => {
        if (!canvas.value) return;
        const text = new fabric.IText(`{{${key}}}`, {
            id: uuidv4(),
            left: x !== undefined ? x : CANVAS_CONSTANTS.DEFAULT_LEFT,
            top: y !== undefined ? y : CANVAS_CONSTANTS.DEFAULT_TOP,
            fontSize: CANVAS_CONSTANTS.DEFAULT_FONT_SIZE,
            fill: 'black',
            fontFamily: 'Sarabun',
            originX: 'left',
            originY: 'top',
            textBaseline: 'alphabetic',
            editable: true,
            lockUniScaling: false,
            objectCaching: false
        });

        text.setControlsVisibility({
            mt: false, mb: false, ml: false, mr: false,
            tl: true, tr: true, bl: true, br: true, mtr: true
        });

        canvas.value.add(text);
        canvas.value.setActiveObject(text);
        canvas.value.requestRenderAll();
        saveHistory();
    };

    const removeSelectedObject = () => {
        if (!canvas.value) return;
        const activeObjects = canvas.value.getActiveObjects();
        if (activeObjects.length) {
            canvas.value.discardActiveObject();
            activeObjects.forEach((obj) => canvas.value.remove(obj));
            canvas.value.requestRenderAll();
            saveHistory();
        }
    };

    const addImageToCanvas = async (url, xOrOptions, yArg) => {
        if (!canvas.value) return;

        let left = CANVAS_CONSTANTS.DEFAULT_LEFT;
        let top = CANVAS_CONSTANTS.DEFAULT_TOP;
        if (typeof xOrOptions === 'object' && xOrOptions !== null) {
            if (xOrOptions.left !== undefined) left = xOrOptions.left;
            if (xOrOptions.top !== undefined) top = xOrOptions.top;
        } else if (xOrOptions !== undefined && xOrOptions !== null) {
            left = xOrOptions;
            if (yArg !== undefined) top = yArg;
        }

        const base64Url = await convertUrlToBase64(url);
        fabric.Image.fromURL(
            base64Url,
            (img) => {
                img.set({
                    id: uuidv4(),
                    left: left,
                    top: top,
                    originX: 'center',
                    originY: 'center'
                });
                img.setControlsVisibility({ mt: false, mb: false, ml: false, mr: false });


                if (img.width > 300) img.scaleToWidth(300);

                canvas.value.add(img);
                canvas.value.setActiveObject(img);
                canvas.value.requestRenderAll();
                saveHistory();

                canvas.value.fire('selection:created', { selected: [img] });
            },
            { crossOrigin: 'anonymous' }
        );
    };

    const onDragStart = (e, key) => {
        e.dataTransfer.setData('text/plain', key);
    };

    const onDrop = (e) => {
        if (!canvas.value) return;
        e.preventDefault();
        const pointer = canvas.value.getPointer(e);


        const type = e.dataTransfer.getData('type');
        const imageUrl = e.dataTransfer.getData('image-url');

        if (type === 'image' && imageUrl) {
            convertUrlToBase64(imageUrl).then((base64Url) => {
                fabric.Image.fromURL(
                    base64Url,
                    (img) => {
                        img.set({
                            id: uuidv4(),
                            left: pointer.x,
                            top: pointer.y,
                            originX: 'center',
                            originY: 'center'
                        });
                        if (img.width > 300) img.scaleToWidth(300);
                        img.setControlsVisibility({ mt: false, mb: false, ml: false, mr: false });

                        canvas.value.add(img);
                        canvas.value.setActiveObject(img);
                        canvas.value.requestRenderAll();
                        saveHistory();
                    },
                    { crossOrigin: 'anonymous' }
                );
            });
            return;
        }


        const key = e.dataTransfer.getData('text/plain');
        if (key) {
            const text = new fabric.IText(`{{${key}}}`, {
                id: uuidv4(),
                left: pointer.x,
                top: pointer.y,
                fontSize: CANVAS_CONSTANTS.DEFAULT_FONT_SIZE,
                fontFamily: 'Sarabun',
                fill: 'black',
                originX: 'left',
                originY: 'top',
                textBaseline: 'alphabetic',
                objectCaching: false
            });
            text.setControlsVisibility({ mt: false, mb: false, ml: false, mr: false });
            canvas.value.add(text);
            canvas.value.setActiveObject(text);
            canvas.value.requestRenderAll();
            saveHistory();
        }
    };

    const capturePageAsImage = (pageIndex, pageHeight, pageGap, multiplier = 2, quality = 1) => {
        if (!canvas.value) return null;
        const offsetTop = pageIndex * (pageHeight + pageGap);
        try {
            return canvas.value.toDataURL({
                format: 'png',
                multiplier,
                quality,
                left: 0,
                top: offsetTop,
                width: CANVAS_CONSTANTS.PAGE_WIDTH,
                height: pageHeight
            });
        } catch (error) {
            console.error(`Error capturing page ${pageIndex}:`, error);
            return null;
        }
    };

    const handleKeyboard = (e) => {
        if (e.target.matches('input, textarea')) return;
        if (e.ctrlKey || e.metaKey) {
            const key = e.key.toLowerCase();
            if (key === 'z' && !e.shiftKey) {
                e.preventDefault();
                undo();
            } else if (key === 'y' || (key === 'z' && e.shiftKey)) {
                e.preventDefault();
                redo();
            } else if (key === 'c') {

                if (!canvas.value) return;
                const active = canvas.value.getActiveObject();
                if (!active) return;
                e.preventDefault();
                active.clone((cloned) => {
                    const clonedObj = JSON.parse(JSON.stringify(active));
                    Object.assign(cloned, clonedObj);
                    cloned.id = uuidv4();
                    cloned.clipPath = null;
                    _clipboard = cloned;
                    _pasteOffset = 0;
                });
            } else if (key === 'v') {

                if (!canvas.value || !_clipboard) return;
                e.preventDefault();
                _pasteOffset += 20;
                _clipboard.clone((cloned) => {
                    canvas.value.discardActiveObject();

                    const srcPageIndex = Math.floor(cloned.top / PAGE_STRIDE);
                    const localTop = cloned.top - srcPageIndex * PAGE_STRIDE;
                    const tgtPageIndex = window.__editorState?.currentPageIndex ?? 0;
                    const tgtOffsetY = tgtPageIndex * PAGE_STRIDE;

                    cloned.set({
                        left: cloned.left + _pasteOffset,
                        top: tgtOffsetY + localTop + _pasteOffset,
                        evented: true,
                    });

                    if (cloned.type === 'activeSelection') {
                        cloned.canvas = canvas.value;
                        cloned.forEachObject((obj) => {
                            obj.id = uuidv4();
                            obj.clipPath = null;
                            canvas.value.add(obj);
                        });
                        cloned.setCoords();
                    } else {
                        cloned.id = uuidv4();
                        cloned.clipPath = null;
                        canvas.value.add(cloned);
                    }
                    canvas.value.setActiveObject(cloned);
                    canvas.value.requestRenderAll();
                    saveHistory();

                });
            } else if (key === 'd') {

                if (!canvas.value) return;
                const active = canvas.value.getActiveObject();
                if (!active) return;
                e.preventDefault();
                active.clone((cloned) => {
                    const clonedObj = JSON.parse(JSON.stringify(active));
                    Object.assign(cloned, clonedObj);
                    cloned.id = uuidv4();
                    cloned.clipPath = null;
                    cloned.set({
                        left: active.left + 20,
                        top: active.top + 20,
                        evented: true
                    });
                    _clipboard = cloned;
                    _pasteOffset = 0;
                });
            }
        }
    };

    const zoomIn = () => {
        let newZoom = Math.round((zoomLevel.value + 0.1) * 10) / 10;
        zoomLevel.value = Math.min(3, newZoom);
    };

    const zoomOut = () => {
        let newZoom = Math.round((zoomLevel.value - 0.1) * 10) / 10;
        zoomLevel.value = Math.max(0.1, newZoom);
    };

    const fitToScreen = () => {
        zoomLevel.value = 1;
    };

    onMounted(() => {
        if (!keyboardListenerAttached) {
            window.addEventListener('keydown', handleKeyboard);
            keyboardListenerAttached = true;
        }
    });

    return {
        canvas,
        zoomLevel,
        viewportRef,
        historyStack,
        redoStack,
        undo,
        redo,
        setHistoryContext,
        resetHistory,
        saveHistory,
        setHistoryLock,
        isRemoteUpdating,
        canUndo: computed(
            () => historyStack.value.length > 1 && !isHistoryLocked.value && !isRemoteUpdating
        ),
        canRedo: computed(
            () => redoStack.value.length > 0 && !isHistoryLocked.value && !isRemoteUpdating
        ),

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
        fitToScreen
    };
}

