import { ref, shallowRef, markRaw } from 'vue';
import { fabric } from 'fabric';
import { CANVAS_CONSTANTS } from '../constants/canvas';


const canvas = shallowRef(null);

export function useCanvasCore() {

  const zoomLevel = ref(1);
  const viewportRef = ref(null);

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
      return url; // Fallback to original url
    }
  };


  const initCanvas = () => {
    const canvasElement = document.getElementById('c');
    if (!canvasElement) {
      console.error('initCanvas: Canvas element with id "c" not found!');
      return;
    }

    const fabricCanvas = new fabric.Canvas('c');
    fabricCanvas.setBackgroundColor('#ffffff', fabricCanvas.renderAll.bind(fabricCanvas));
    // markRaw prevents Vue reactivity from wrapping the Fabric.js instance (which would break it)
    canvas.value = markRaw(fabricCanvas);
    return canvas.value;
  };


  const zoomIn = () => {
    if (zoomLevel.value < CANVAS_CONSTANTS.MAX_ZOOM) {
      zoomLevel.value += CANVAS_CONSTANTS.ZOOM_STEP;
      updateCanvasZoom();
    }
  };

  const zoomOut = () => {
    if (zoomLevel.value > CANVAS_CONSTANTS.MIN_ZOOM) {
      zoomLevel.value -= CANVAS_CONSTANTS.ZOOM_STEP;
      updateCanvasZoom();
    }
  };

  const fitToScreen = () => {
    zoomLevel.value = 1;
    updateCanvasZoom();
  };

  const updateCanvasZoom = () => {
    if (canvas.value) {
      canvas.value.requestRenderAll();
    }
  };


  const handleWorkspaceWheel = (e) => {
    // 1. ZOOM: Ctrl + Wheel
    if (e.ctrlKey) {
      e.preventDefault();

      // Canva-style step zoom
      const direction = e.deltaY > 0 ? -1 : 1;
      const step = 0.1;
      let newZoom = zoomLevel.value + direction * step;

      // Clamp limits
      newZoom = Math.max(CANVAS_CONSTANTS.MIN_ZOOM, Math.min(newZoom, CANVAS_CONSTANTS.MAX_ZOOM));

      zoomLevel.value = Number(newZoom.toFixed(2)); // Avoid float precision issues
      updateCanvasZoom();
    }

    // 2. HORIZONTAL PAN: Shift + Wheel
    else if (e.shiftKey) {
      e.preventDefault();
      if (viewportRef.value) {

        viewportRef.value.scrollLeft += e.deltaY;
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
        canvas.value.setBackgroundImage(img, canvas.value.renderAll.bind(canvas.value));
      },
      { crossOrigin: 'anonymous' }
    );
  };

  const addVariableToCanvas = (key) => {
    if (!canvas.value) return;

    const text = new fabric.IText(`{{${key}}}`, {
      left: CANVAS_CONSTANTS.DEFAULT_LEFT,
      top: CANVAS_CONSTANTS.DEFAULT_TOP,
      fontSize: CANVAS_CONSTANTS.DEFAULT_FONT_SIZE,
      fill: 'blue',
      fontFamily: 'Sarabun',
      lineHeight: 1.4,
      // [เพิ่ม] บังคับจุดอ้างอิงเป็นมุมซ้ายบน เพื่อให้ตรงกับ CSS
      originX: 'left',
      originY: 'top',
      // Disable object caching to prevent visual artifacts during smart resizing
      objectCaching: false,
      noScaleCache: false
    });
    canvas.value.add(text);
    canvas.value.setActiveObject(text);
  };

  const removeSelectedObject = () => {
    if (!canvas.value) return;

    const activeObj = canvas.value.getActiveObject();

    if (activeObj && activeObj.isEditing) {
      return;
    }

    const activeObjects = canvas.value.getActiveObjects();

    if (activeObjects.length) {
      canvas.value.discardActiveObject(); // Deselect first
      activeObjects.forEach((obj) => {
        canvas.value.remove(obj); // Remove from canvas
      });
      canvas.value.requestRenderAll(); // Refresh canvas
    } else {
      alert('Please select an item to delete first.');
    }
  };

  return {
    // Canvas instance
    canvas,

    // Reactive state
    zoomLevel,
    viewportRef,

    // Methods
    initCanvas,
    zoomIn,
    zoomOut,
    fitToScreen,
    updateCanvasZoom,
    // handleWorkspaceWheel is available internally but not exported.
    setCanvasBackground,
    addVariableToCanvas,
    removeSelectedObject
  };
}
