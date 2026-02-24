import { ref, shallowRef, markRaw } from 'vue';
import { fabric } from 'fabric';
import { CANVAS_CONSTANTS } from '../constants/canvas';

// Global singleton canvas state - shared across the entire app
const canvas = shallowRef(null);

export function useCanvasCore() {
  // Zoom state
  const zoomLevel = ref(1);
  const viewportRef = ref(null);

  // Initialize canvas
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

  // Zoom methods
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
    // CSS transform is now handled by the :style binding on canvas-transform-wrapper
    // No need to manipulate Fabric.js zoom anymore
    if (canvas.value) {
      canvas.value.requestRenderAll();
    }
  };

  // Pro-Tool Interactions
  const handleWorkspaceWheel = (e) => {
    // 1. ZOOM: Ctrl + Wheel
    if (e.ctrlKey) {
      e.preventDefault();

      // Simple Step Approach (Canva style steps):
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
        // Scroll speed multiplier (optional)
        viewportRef.value.scrollLeft += e.deltaY;
      }
    }
  };

  // Canvas utility functions
  const setCanvasBackground = (dataUrl) => {
    if (!canvas.value) return;

    fabric.Image.fromURL(
      dataUrl,
      (img) => {
        img.scaleToWidth(CANVAS_CONSTANTS.PAGE_WIDTH); // A4_WIDTH
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

  // Apply preview data to canvas
  const applyPreviewDataToCanvas = () => {
    if (!canvas.value) return;

    const mockData = {
      school_name: 'โรงเรียนเวทย์มนตร์',
      school_year: '2580',
      student_name: 'ด.ช. แฮรี่ พอตเตอร์',
      student_id: '80001',
      gpa: '5.00',
      class_level: 'ม.7/1',
      teacher_name: 'ครูสเนป โหด',
      comment: 'เก่งมาก'
    };

    canvas.value.getObjects().forEach((obj) => {
      // Include 'textbox' — this is the main variable text type used in the editor
      if (['textbox', 'text', 'i-text'].includes(obj.type) && obj.text) {
        let newText = obj.text;

        // Replace variables with mock data
        Object.keys(mockData).forEach((key) => {
          const variablePattern = new RegExp(`{{${key}}}`, 'g');
          newText = newText.replace(variablePattern, mockData[key]);
        });

        // Update text without modifying the pages array
        if (newText !== obj.text) {
          obj.set('text', newText);
        }

        // Lock object in preview mode
        obj.set('selectable', false);
        obj.set('editable', false);
        obj.set('evented', false);
      }
    });

    canvas.value.renderAll();
    console.log('Applied preview data to canvas');
  };

  // BUG-016 fix: applyPreviewDataToCanvas removed from this file — it was a duplicate
  // of the same function in EditorView.vue. EditorView's copy is used exclusively.
  // Having two copies with slightly different mockData sets was a maintenance hazard.

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
    // BUG-018 fix: handleWorkspaceWheel removed from exports — it was never wired up
    // in EditorView.vue, making it dead exported code. The function is still available
    // internally if EditorView.vue is ever updated to use it.
    setCanvasBackground,
    addVariableToCanvas,
    removeSelectedObject
  };
}
