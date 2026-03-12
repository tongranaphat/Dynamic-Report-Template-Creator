<template>
  <div class="app-layout">
    <header class="top-navbar">
      <div class="navbar-left">
        <h1 class="app-title">ระบบสร้างเทมเพลตรายงาน</h1>
        <div class="divider-v"></div>
        <div class="hud-controls">
          <button @click="undo" class="zoom-btn" title="ย้อนกลับ">↩ ย้อนกลับ</button>
          <button @click="redo" class="zoom-btn" title="ทำซ้ำ">↪ ทำซ้ำ</button>
          <div class="divider-v"></div>
          <button @click="zoomOut" class="zoom-btn">−</button>
          <span class="zoom-value">{{ Math.round(zoomLevel * 100) }}%</span>
          <button @click="zoomIn" class="zoom-btn">+</button>
          <button @click="fitToScreen" class="zoom-fit">รีเซ็ต</button>
        </div>
      </div>
      <div class="navbar-center">
        <!-- Center space now flexible -->
      </div>
      <div class="navbar-right">
        <button @click="togglePreviewWrapper"
          :class="['mode-toggle-btn', isPreviewMode ? 'preview-active' : 'edit-active']" :disabled="isGenerating">
          {{ isGenerating ? '⏳ กำลังสร้าง...' : (isPreviewMode ? '📝 แก้ไข' : '👁️ ดูตัวอย่าง') }}

        </button>
        <div v-if="connectionStatus"
          :class="['connection-status-pill', connectionStatus === 'connected' ? 'online' : 'offline']"
          :title="connectionStatus === 'connected' ? 'ออนไลน์' : 'ออฟไลน์'">
          {{ connectionStatus === 'connected' ? '🟢' : '🔴' }}
        </div>
      </div>
    </header>

    <Sidebar :isOpen="isSidebarOpen" :connectionStatus="connectionStatus" :templates="templates"
      :isCanvasReady="isCanvasReady" :templateName="templateName" :isPreviewMode="isPreviewMode"
      :currentTemplateId="currentTemplateId" :groupedVariables="groupedVariables" :isGenerating="isGenerating"
      :pdfQuality="pdfQuality" :pages="pages" :currentPageIndex="currentPageIndex" @toggle="toggleSidebar"
      @open="isSidebarOpen = true" @close="isSidebarOpen = false" @load-template="loadTemplateWrapper"
      @delete-template="deleteTemplate" @update:templateName="templateName = $event"
      @update:pdfQuality="pdfQuality = $event" @save-template="handleSaveTemplate" @reset-canvas="resetCanvasWrapper"
      @toggle-preview="togglePreviewWrapper" @import-workspace="handleImportWorkspaceWrapper"
      @add-variable="addVariableToCanvas" @addImage="addImageToCanvasWrapper" @save-report="handleSaveProject"
      @generate-pdf="handleExport" @open-history="openHistoryModal" @generate-editable-pdf="handleExport"
      @delete-page="deletePage" @add-page="addBlankPageWrapper" @import-page="handleAppendPageWrapper"
      @page-click="scrollToPage" @page-drop="handlePageDrop" />

    <main class="viewport" :class="{ 'full-width': !isSidebarOpen }" ref="viewportRef">
      <div class="scroll-center-helper">
        <div class="canvas-scaler" @drop="onDrop" @dragover.prevent>
          <div class="canvas-transform-layer">
            <div class="paper-shadow">
              <canvas id="c" :width="PAGE_WIDTH_CONST" :height="PAGE_HEIGHT_CONST"></canvas>
            </div>
          </div>
        </div>
      </div>
    </main>


    <PropertiesPanel v-if="canvas" :canvas="canvas" :is-preview-mode="isPreviewMode" />


    <HistoryModal v-if="showHistoryModal" :reportInstances="reportHistory" @close="showHistoryModal = false"
      @edit="openReportFromHistory" @delete="handleDeleteReport" />
  </div>
</template>

<script setup>
import { onMounted, ref, watch, nextTick } from 'vue';
import { fabric } from 'fabric';
import axios from 'axios';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

import PropertiesPanel from '../components/PropertiesPanel.vue';
import Sidebar from '../components/Sidebar.vue';
import HistoryModal from '../components/HistoryModal.vue';

import { useCanvas } from '../composables/useCanvas';
import { useTemplate } from '../composables/useTemplate';
import { useCanvasEvents } from '../composables/useCanvasEvents';
import { useRealTime } from '../composables/useRealTime';
import { useEditablePdf } from '../composables/useEditablePdf';
import { usePreviewData } from '../composables/usePreviewData';
import { useEditorStore } from '../stores/editorStore';
import { CANVAS_CONSTANTS } from '../constants/canvas';
import { showNotification } from '../utils/notifications';
import apiService from '../services/apiService';

const PAGE_WIDTH_CONST = CANVAS_CONSTANTS.PAGE_WIDTH;
const PAGE_HEIGHT_CONST = CANVAS_CONSTANTS.PAGE_HEIGHT;

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;

let isCanvasReady = ref(false);
const canvasBaseDimensions = ref({
  width: CANVAS_CONSTANTS.PAGE_WIDTH,
  height: CANVAS_CONSTANTS.PAGE_HEIGHT
});
const connectionStatus = ref('offline');
const isGenerating = ref(false);
const pdfQuality = ref(2); // Default to Standard (2x)
let isRendering = false;

// --- History State & Logic ---
const toggleSidebar = () => {
  isSidebarOpen.value = !isSidebarOpen.value;
};

const fetchReports = async () => {
  try {
    // Fetch all reports (assuming API supports list or we filter by user if needed)
    const res = await axios.get(
      `${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/reports`
    );
    // Note: The /reports route in reportInstanceRoutes.js only had GET /:id.
    // I need to ADD a list route to server/routes/reportInstanceRoutes.js as well!
    reportHistory.value = res.data;
  } catch (e) {
    console.error('Failed to fetch reports', e);
  }
};

const openHistoryModal = async () => {
  await fetchReports();
  showHistoryModal.value = true;
};

const openReportFromHistory = async (instance) => {
  if (!confirm('การดำเนินการนี้จะแทนที่โปรเจกต์ปัจจุบัน คุณต้องการดำเนินการต่อหรือไม่?')) return;
  try {
    // Load by ID
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
    const res = await axios.get(`${apiUrl}/reports/${instance.id}`);

    if (res.data) {
      // Use loadReportById logic manually or via store if available
      // Here we manually trigger load similar to handleImportWorkspace
      const r = res.data;
      currentReportId.value = r.id;
      currentTemplateId.value = r.templateId;
      templateName.value = r.name;

      // BUG-006 fix: use sanitizePagesData (cleanFabricObject normalization)
      // instead of raw JSON.parse/stringify which skips textBaseline normalization
      if (r.pages && Array.isArray(r.pages)) {
        pages.value = sanitizePagesData(JSON.parse(JSON.stringify(r.pages)));
        currentPageIndex.value = 0;
      }

      if (resetHistory) resetHistory();
      await nextTick();
      await renderAllPages();
    }
  } catch (e) {
    alert('โหลดรายงานล้มเหลว: ' + e.message);
  }
  showHistoryModal.value = false;
};

const handleDeleteReport = async (instance) => {
  if (!confirm(`คุณแน่ใจหรือไม่ว่าต้องการลบรายงาน "${instance.name}"?`)) return;
  try {
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
    await axios.delete(`${apiUrl}/reports/${instance.id}`);
    await fetchReports(); // Refresh list
  } catch (e) {
    alert('ลบรายงานล้มเหลว: ' + e.message);
  }
};
const showHistoryModal = ref(false);
const reportHistory = ref([]);

const {
  canvas,
  zoomLevel,
  viewportRef,
  initCanvas,
  zoomIn,
  zoomOut,
  fitToScreen,
  removeSelectedObject,
  onDrop: onDropCore,
  setHistoryLock,
  saveHistory,
  resetHistory,
  undo,
  redo,
  addImageToCanvas,
  addVariableToCanvas,
  setHistoryContext,
  isRemoteUpdating
} = useCanvas();

const canvasHelpers = { resetHistory, saveHistory, setHistoryLock };

const {
  variables,
  templates,
  templateName,
  currentTemplateId,
  currentReportId,
  currentFileHandle, // File System Access API handle
  isPreviewMode,
  pages,
  currentPageIndex,
  isSidebarOpen,
  isPagesSidebarOpen, // Keyboard shortcut state
  groupedVariables,
  fetchVariables,
  fetchTemplates,
  saveTemplate,
  saveReport,
  loadTemplate,
  deleteTemplate,
  resetCanvas,
  togglePreview,
  handleImportWorkspace,
  handleImportAppend,
  addBlankPage,
  addCustomVariable,
  getDefaultPageImage,
  cleanFabricObject,
  preparePagesForSave,
  sanitizePagesData, // BUG-006 fix: import so openReportFromHistory can use proper sanitization

  // Unified Exports
  unifiedSave,
  handleUnifiedImport,
  ensureFileHandle
} = useTemplate(canvas, zoomLevel, canvasHelpers);

if (setHistoryContext) setHistoryContext(pages, currentPageIndex);

const { initCanvasEvents } = useCanvasEvents(
  canvas,
  pages,
  currentPageIndex,
  saveHistory,
  setHistoryLock
);
const { connect, emitUpdate } = useRealTime();
const { generateHybridPdfBlob } = useEditablePdf();
const { getMockData } = usePreviewData();
const editorStore = useEditorStore();

watch(zoomLevel, (newZoom) => {
  if (canvas.value && canvasBaseDimensions.value) {
    canvas.value.setDimensions({
      width: canvasBaseDimensions.value.width * newZoom,
      height: canvasBaseDimensions.value.height * newZoom
    });
    canvas.value.setZoom(newZoom);
    canvas.value.requestRenderAll();
  }
});

// --- 3 DISTINCT HANDLERS FOR 3 DISTINCT ACTIONS ---

// 1. Save Template: ONLY saves JSON to database, refreshes sidebar
const handleSaveTemplate = async () => {
  try {
    await saveTemplate(false); // false = show notifications
    await editorStore.fetchTemplates(); // Refresh sidebar
    saveHistory();
  } catch (e) {
    console.error('Save Template failed:', e);
  }
};

// 2. Save Project: STRICT Overwrite ONLY (no file picker)
const handleSaveProject = async () => {
  if (!canvas.value) return;

  // STRICT: Only allow overwrite if file is already linked
  if (!currentFileHandle || !currentFileHandle.value) {
    showNotification('No local file linked. Please use Export first.', 'error');
    return;
  }

  try {
    saveCurrentPageState();
    // Collect data for PDF generation
    const pagesData = preparePagesForSave();
    const projectData = {
      name: templateName.value || 'โปรเจกต์ไม่มีชื่อ',
      pages: pagesData,
      version: '1.0',
      timestamp: new Date().toISOString(),
      type: 'hybrid-project'
    };

    const variableMap = {
      school_name: 'โรงเรียนเวทย์มนตร์',
      school_year: '2580',
      student_name: 'ด.ช. แฮรี่ พอตเตอร์',
      student_id: '80001',
      gpa: '5.00',
      class_level: 'ม.7/1',
      teacher_name: 'ครูสเนป โหด',
      comment: 'เก่งมาก',
      date: new Date().toLocaleDateString('th-TH')
    };
    if (variables.value) {
      variables.value.forEach((v) => {
        if (v.key && v.value) variableMap[v.key] = v.value;
      });
    }

    // Capture canvas images first
    const canvasImages = [];
    const P_H = CANVAS_CONSTANTS.PAGE_HEIGHT;
    const GAP = CANVAS_CONSTANTS.PAGE_GAP;
    const qualityMultiplier = 2;
    const TEXT_TYPES = ['textbox', 'text', 'i-text', 'image'];

    // Enter preview mode for capture
    const wasPreview = isPreviewMode.value;
    const originalPage = currentPageIndex.value;

    try {
      canvas.value.requestRenderAll();
      if (!wasPreview) saveCurrentPageState();
      isPreviewMode.value = true;
      await renderAllPages();
      await nextTick();
      applyPreviewDataToCanvas();
      await nextTick();

      // Capture each page as image
      for (let i = 0; i < pages.value.length; i++) {
        const allObjects = canvas.value.getObjects();
        const hiddenForCapture = [];

        // Hide overlay objects for clean background capture
        allObjects.forEach((obj) => {
          const center = obj.getCenterPoint();
          const objPageIndex = Math.floor(center.y / (P_H + GAP));
          const isWrongPage = objPageIndex !== i;
          const OVERLAY_TYPES = ['textbox', 'text', 'i-text'];

          // const isOverlay = OVERLAY_TYPES.includes(obj.type) &&
          //   obj.id !== 'page-bg-image' &&
          //   obj.id !== 'page-bg';

          const isBackground = obj.id === 'page-bg-image' || obj.id === 'page-bg';

          if ((isWrongPage || !isBackground) && obj.visible) {
            obj.visible = false;
            hiddenForCapture.push(obj);
          }
        });
        canvas.value.renderAll();

        const topOffset = i * (P_H + GAP) * zoomLevel.value;

        try {
          const canvasImage = canvas.value.toDataURL({
            format: 'jpeg',
            quality: 0.92,
            multiplier: qualityMultiplier / zoomLevel.value,
            left: 0,
            top: topOffset,
            width: CANVAS_CONSTANTS.PAGE_WIDTH * zoomLevel.value,
            height: CANVAS_CONSTANTS.PAGE_HEIGHT * zoomLevel.value
          });

          if (canvasImage && canvasImage.length > 100) {
            canvasImages.push(canvasImage);
          }
        } catch (canvasError) {
          console.warn(`Canvas taint detected on page ${i + 1}, using fallback:`, canvasError);
          // Use fallback image
          const fallbackCanvas = document.createElement('canvas');
          fallbackCanvas.width = CANVAS_CONSTANTS.PAGE_WIDTH * qualityMultiplier;
          fallbackCanvas.height = CANVAS_CONSTANTS.PAGE_HEIGHT * qualityMultiplier;
          const fallbackCtx = fallbackCanvas.getContext('2d');
          fallbackCtx.fillStyle = '#ffffff';
          fallbackCtx.fillRect(0, 0, fallbackCanvas.width, fallbackCanvas.height);
          const fallbackImage = fallbackCanvas.toDataURL('image/jpeg', 0.92);
          if (fallbackImage.length > 100) {
            canvasImages.push(fallbackImage);
          }
        }

        // Restore visibility
        hiddenForCapture.forEach((obj) => { obj.visible = true; });
      }
      canvas.value.requestRenderAll();

      if (canvasImages.length === 0) throw new Error('ไม่สามารถประมวลผลหน้ากระดาษเป็นรูปภาพได้');

      // Generate PDF blob with canvas images
      const pdfBlob = await generateHybridPdfBlob(canvasImages, projectData, variableMap);

      // STRICT: Only overwrite existing file
      const writable = await currentFileHandle.value.createWritable();
      await writable.write(pdfBlob);
      await writable.close();

      showNotification('Project saved successfully!', 'success');
      saveHistory();
    } finally {
      // Restore canvas state
      if (canvas.value) {
        canvas.value.selection = true;
        canvas.value.getObjects().forEach((obj) => {
          if (obj.id !== 'page-bg' && obj.id !== 'page-bg-image') {
            obj.set({ selectable: true, evented: true, visible: true });
            if (TEXT_TYPES.includes(obj.type)) obj.set('editable', true);
          }
        });
        canvas.value.renderAll();
      }

      if (!wasPreview) {
        isPreviewMode.value = false;
        await nextTick();
        loadPageToCanvas(originalPage);
      } else {
        loadPageToCanvas(originalPage);
      }
    }
  } catch (e) {
    console.error('Save Project failed:', e);
    showNotification('Save Project failed: ' + e.message, 'error');
  }
};

// 3. Export: Save As + DB Registration
const handleExport = async () => {
  if (!canvas.value) return;

  try {
    saveCurrentPageState();
    // Collect data for PDF generation
    const pagesData = preparePagesForSave();
    const projectData = {
      name: templateName.value || 'โปรเจกต์ไม่มีชื่อ',
      pages: pagesData,
      version: '1.0',
      timestamp: new Date().toISOString(),
      type: 'hybrid-project'
    };

    const variableMap = {
      school_name: 'โรงเรียนเวทย์มนตร์',
      school_year: '2580',
      student_name: 'ด.ช. แฮรี่ พอตเตอร์',
      student_id: '80001',
      gpa: '5.00',
      class_level: 'ม.7/1',
      teacher_name: 'ครูสเนป โหด',
      comment: 'เก่งมาก',
      date: new Date().toLocaleDateString('th-TH')
    };
    if (variables.value) {
      variables.value.forEach((v) => {
        if (v.key && v.value) variableMap[v.key] = v.value;
      });
    }

    // Capture canvas images first
    const canvasImages = [];
    const P_H = CANVAS_CONSTANTS.PAGE_HEIGHT;
    const GAP = CANVAS_CONSTANTS.PAGE_GAP;
    const qualityMultiplier = 2;
    const TEXT_TYPES = ['textbox', 'text', 'i-text', 'image'];

    // Enter preview mode for capture
    const wasPreview = isPreviewMode.value;
    const originalPage = currentPageIndex.value;

    try {
      canvas.value.requestRenderAll();
      if (!wasPreview) saveCurrentPageState();
      isPreviewMode.value = true;
      await renderAllPages();
      await nextTick();
      applyPreviewDataToCanvas();
      await nextTick();

      // Capture each page as image
      for (let i = 0; i < pages.value.length; i++) {
        const allObjects = canvas.value.getObjects();
        const hiddenForCapture = [];

        // Hide overlay objects for clean background capture
        allObjects.forEach((obj) => {
          const center = obj.getCenterPoint();
          const objPageIndex = Math.floor(center.y / (P_H + GAP));
          const isWrongPage = objPageIndex !== i;

          // const OVERLAY_TYPES = ['textbox', 'text', 'i-text'];
          // const isOverlay = OVERLAY_TYPES.includes(obj.type) &&
          //   obj.id !== 'page-bg-image' &&
          //   obj.id !== 'page-bg';

          const isBackground = obj.id === 'page-bg-image' || obj.id === 'page-bg';

          if ((isWrongPage || !isBackground) && obj.visible) {
            obj.visible = false;
            hiddenForCapture.push(obj);
          }
        });
        canvas.value.renderAll();

        const topOffset = i * (P_H + GAP) * zoomLevel.value;

        try {
          const canvasImage = canvas.value.toDataURL({
            format: 'jpeg',
            quality: 0.92,
            multiplier: qualityMultiplier / zoomLevel.value,
            left: 0,
            top: topOffset,
            width: CANVAS_CONSTANTS.PAGE_WIDTH * zoomLevel.value,
            height: CANVAS_CONSTANTS.PAGE_HEIGHT * zoomLevel.value
          });

          if (canvasImage && canvasImage.length > 100) {
            canvasImages.push(canvasImage);
          }
        } catch (canvasError) {
          console.warn(`Canvas taint detected on page ${i + 1}, using fallback:`, canvasError);
          // Use fallback image
          const fallbackCanvas = document.createElement('canvas');
          fallbackCanvas.width = CANVAS_CONSTANTS.PAGE_WIDTH * qualityMultiplier;
          fallbackCanvas.height = CANVAS_CONSTANTS.PAGE_HEIGHT * qualityMultiplier;
          const fallbackCtx = fallbackCanvas.getContext('2d');
          fallbackCtx.fillStyle = '#ffffff';
          fallbackCtx.fillRect(0, 0, fallbackCanvas.width, fallbackCanvas.height);
          const fallbackImage = fallbackCanvas.toDataURL('image/jpeg', 0.92);
          if (fallbackImage.length > 100) {
            canvasImages.push(fallbackImage);
          }
        }

        // Restore visibility
        hiddenForCapture.forEach((obj) => { obj.visible = true; });
      }
      canvas.value.requestRenderAll();

      if (canvasImages.length === 0) throw new Error('ไม่สามารถประมวลผลหน้ากระดาษเป็นรูปภาพได้');

      // Step 1: Generate PDF blob
      const pdfBlob = await generateHybridPdfBlob(canvasImages, projectData, variableMap);

      // Step 2: Use file picker for Save As
      const options = {
        suggestedName: `${templateName.value || 'report'}.pdf`
      };
      const newHandle = await window.showSaveFilePicker(options);

      // Step 3: Write PDF blob to new handle
      const writable = await newHandle.createWritable();
      await writable.write(pdfBlob);
      await writable.close();

      // Step 4: CRITICAL - Reassign handle for future saves
      currentFileHandle.value = newHandle;

      // Step 5: Register new instance in database
      try {
        const reportInstanceData = {
          name: templateName.value || 'Untitled Report',
          templateId: currentTemplateId.value || null,
          projectData: projectData,
          filePath: newHandle.name || `${templateName.value || 'report'}.pdf`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        const response = await apiService.createReportInstance(reportInstanceData);
        const responseData = response?.data || response;
        if (responseData && responseData.id) {
          currentReportId.value = responseData.id;
          showNotification('Report exported and registered successfully!', 'success');
        }
      } catch (dbError) {
        console.error('Failed to register report instance:', dbError);
        showNotification('Report exported but database registration failed', 'warning');
      }

      saveHistory();
    } finally {
      // Restore canvas state
      if (canvas.value) {
        canvas.value.selection = true;
        canvas.value.getObjects().forEach((obj) => {
          if (obj.id !== 'page-bg' && obj.id !== 'page-bg-image') {
            obj.set({ selectable: true, evented: true, visible: true });
            if (TEXT_TYPES.includes(obj.type)) obj.set('editable', true);
          }
        });
        canvas.value.renderAll();
      }

      if (!wasPreview) {
        isPreviewMode.value = false;
        await nextTick();
        loadPageToCanvas(originalPage);
      } else {
        loadPageToCanvas(originalPage);
      }
    }
  } catch (e) {
    console.error('Export failed:', e);
    showNotification('Export failed: ' + e.message, 'error');
  }
};

const loadTemplateWrapper = async (t) => {
  await loadTemplate(t);
  await nextTick();
  await renderAllPages();
  saveHistory();
};

const resetCanvasWrapper = async () => {
  await resetCanvas();
  await nextTick();
  await renderAllPages();
  saveHistory();
};


const handleImportWorkspaceWrapper = async () => {
  // Unified Import (File Picker)
  await handleUnifiedImport();
  await nextTick();
  await renderAllPages();
  saveHistory();
};

const handleAppendPageWrapper = async (e) => {
  await handleImportAppend(e);
  await nextTick();
  await renderAllPages();
  saveHistory();
};

const addBlankPageWrapper = async () => {
  addBlankPage();
  await nextTick();
  await renderAllPages();
  saveHistory();
};

// Deprecated Wrappers Removed (openLocalFileWrapper, saveToLocalFileWrapper)

// --- CORE RENDER FUNCTION ---

// เพิ่ม cleanup function เพื่อป้องกัน memory leaks
const cleanupCanvasObjects = () => {
  if (!canvas.value) return;

  const objects = canvas.value.getObjects();
  let cleanedCount = 0;

  objects.forEach(obj => {
    try {
      // Clear clipPath อย่างปลอดภัย
      if (obj.clipPath) {
        if (obj.clipPath.dispose && typeof obj.clipPath.dispose === 'function') {
          obj.clipPath.dispose();
        }
        obj.clipPath = null;
      }

      // Clear event listeners
      if (obj.off && typeof obj.off === 'function') {
        obj.off();
      }

      // Dispose custom objects
      if (obj.dispose && typeof obj.dispose === 'function') {
        obj.dispose();
      }

      cleanedCount++;
    } catch (e) {
      console.warn('Error cleaning up object:', e);
    }
  });

  if (cleanedCount > 0) {
    console.log(`Cleaned up ${cleanedCount} objects`);
  }
};

const renderAllPages = async () => {
  if (!canvas.value) return;
  if (isRendering) return;

  isRendering = true;
  setHistoryLock(true);
  try {
    // Cleanup ก่อน clear เพื่อป้องกัน memory leaks
    cleanupCanvasObjects();

    if (!pages.value || !Array.isArray(pages.value) || pages.value.length === 0) {
      pages.value = [{ id: 0, background: null, objects: [] }];
    }
    const currentPages = pages.value;

    canvas.value.discardActiveObject();
    canvas.value.clear();
    // [FIX] Transparent background so gaps are visible (Parent DIV provides gray bg)
    canvas.value.setBackgroundColor(null, () => { });

    const P_W = CANVAS_CONSTANTS.PAGE_WIDTH;
    const P_H = CANVAS_CONSTANTS.PAGE_HEIGHT;
    const P_GAP = CANVAS_CONSTANTS.PAGE_GAP;
    const totalHeight = currentPages.length * P_H + (currentPages.length - 1) * P_GAP;
    const canvasHeight = currentPages.length === 1 ? P_H : totalHeight;
    const actualZoom = zoomLevel.value || 1;

    canvasBaseDimensions.value = { width: P_W, height: totalHeight };
    canvas.value.setDimensions({ width: P_W * actualZoom, height: canvasHeight * actualZoom });
    canvas.value.setZoom(actualZoom);

    // Clip Path Group REMOVED to allow free dragging/visibility
    canvas.value.clipPath = null;

    // Draw Pages
    for (let i = 0; i < currentPages.length; i++) {
      const page = currentPages[i];
      const offsetTop = i * (P_H + P_GAP);

      // Paper Background
      const pagePaper = new fabric.Rect({
        id: 'page-bg',
        left: 0,
        top: offsetTop,
        width: P_W,
        height: P_H,
        fill: '#ffffff',
        selectable: false,
        evented: false,
        objectCaching: false,
        shadow: new fabric.Shadow({ color: 'rgba(0,0,0,0.3)', blur: 8, offsetY: 3 }),
        data: { pageId: page.id }
      });
      canvas.value.add(pagePaper);

      // Image Background
      if (page.background) {
        await new Promise((resolve) => {
          fabric.Image.fromURL(
            page.background,
            (img) => {
              img.set({
                id: 'page-bg-image',
                left: 0,
                top: offsetTop,
                selectable: false,
                evented: false,
                objectCaching: false
              });
              img.scaleToWidth(P_W);
              canvas.value.add(img);
              // Bug Fix: Explicitly render canvas after background is set
              canvas.value.requestRenderAll();
              resolve();
            },
            { crossOrigin: 'anonymous' }
          );
        });
      }

      // Objects (Variables + User Images)
      if (page.objects && page.objects.length > 0) {
        await new Promise((resolve) => {
          const rawObjects = JSON.parse(JSON.stringify(page.objects));
          const objectsToLoad = rawObjects.map((obj) => cleanFabricObject(obj));

          fabric.util.enlivenObjects(objectsToLoad, (objs) => {
            const imageReloadPromises = [];

            objs.forEach((obj) => {
              if (obj.id === 'page-bg' || obj.id === 'page-bg-image') return;
              obj.set({ top: obj.top + offsetTop, _pageIndex: i });

              // [UPDATED] Apply Clip Path immediately on load
              obj.clipPath = new fabric.Rect({
                left: 0,
                top: offsetTop,
                width: P_W,
                height: P_H,
                absolutePositioned: true
              });

              if (['text', 'i-text', 'textbox'].includes(obj.type)) obj.set('objectCaching', true);
              canvas.value.add(obj);
              forceUnlockObject(obj);

              // ASSET CORS FIX: Re-load image objects with crossOrigin:'anonymous' พร้อม error handling.
              // enlivenObjects creates img elements without CORS headers, which taints
              // the canvas and makes canvas.toDataURL() return a blank image for PDF export.
              // We replace the image source after adding to force a clean CORS-safe load.
              if (obj.type === 'image' && obj.getSrc && obj.getSrc().startsWith('http')) {
                const src = obj.getSrc();
                const p = new Promise((imgResolve) => {
                  fabric.Image.fromURL(
                    src,
                    (freshImg) => {
                      // Swap the element on the existing obj so position/scale/id are preserved
                      if (freshImg._element) {
                        obj.setElement(freshImg._element);
                        obj.dirty = true;
                      } else {
                        console.warn(`Failed to load image: ${src} - No element returned`);
                        // Fallback: ใช้ image เดิมแทน
                      }
                      imgResolve();
                    },
                    {
                      crossOrigin: 'anonymous',
                      // Add timeout and error callback
                      onError: (err) => {
                        console.error(`CORS/Network error loading image: ${src}`, err);
                        imgResolve(); // Continue without image reload
                      }
                    }
                  );
                });
                imageReloadPromises.push(p);
              }
            });

            // Wait for all image re-loads before resolving the page
            Promise.all(imageReloadPromises).catch((err) => {
              console.error('Some images failed to load:', err);
              // Continue even if some images fail
            }).then(() => {
              if (canvas.value) canvas.value.requestRenderAll();
              resolve();
            });
          });
        });
      }

    }
    canvas.value.requestRenderAll();
    // Re-render once all web fonts are loaded — prevents "default font on first open" glitch
    document.fonts.ready.then(() => { if (canvas.value) canvas.value.requestRenderAll(); });
  } finally {
    isRendering = false;
    setHistoryLock(false);
  }
};


const scrollToPage = (index) => {
  if (!viewportRef.value) return;
  const P_H = CANVAS_CONSTANTS.PAGE_HEIGHT;
  const GAP = CANVAS_CONSTANTS.PAGE_GAP;
  viewportRef.value.scrollTo({ top: index * (P_H + GAP) * zoomLevel.value, behavior: 'smooth' });
  currentPageIndex.value = index;
};

const forceUnlockObject = (obj) => {
  if (!obj) return;
  const isText = ['i-text', 'textbox', 'text'].includes(obj.type);
  const isImage = obj.type === 'image'; // เช็คว่าเป็นรูปภาพหรือไม่

  if (!obj._originalState) {
    obj._originalState = {
      selectable: obj.selectable,
      evented: obj.evented,
      editable: obj.editable,
      hasControls: obj.hasControls,
      hasBorders: obj.hasBorders
    };
  }

  obj.set({
    selectable: true,
    evented: true,
    hasControls: true,
    hasBorders: true,
    padding: 5,
    lockMovementX: false,
    lockMovementY: false,
    lockRotation: false,
    lockScalingX: false,
    lockScalingY: false,
    // ปลดล็อคให้ยืดหดได้อย่างอิสระ (สำหรับรูปภาพจะได้ยืดได้)
    lockUniScaling: false
  });

  // กำหนดว่าใครโชว์ปุ่มไหนดึงได้บ้าง
  obj.setControlsVisibility({
    mt: isImage, // รูปภาพโชว์ดึงบน / ข้อความซ่อน
    mb: isImage, // รูปภาพโชว์ดึงล่าง / ข้อความซ่อน
    ml: true,    // โชว์ทั้งคู่ (รูปไว้บีบ, ข้อความไว้ยืดกรอบ)
    mr: true,    // โชว์ทั้งคู่
    tl: true,
    tr: true,
    bl: true,
    br: true,
    mtr: true
  });

  if (isText) obj.set('editable', true);
  obj.setCoords();
};


// [ADDED] Wrapper for adding images with smart placement
const addImageToCanvasWrapper = (url) => {
  if (!url) return;
  addImageToCanvas(url);
};

// เพิ่ม state saving lock เพื่อป้องกัน race condition
let isSavingState = false;

const saveCurrentPageState = () => {
  if (isPreviewMode.value || !canvas.value || isSavingState) return;

  isSavingState = true;
  try {
    // FIX: Force ungroup to restore absolute coordinates before saving state
    if (canvas.value && canvas.value.getActiveObject() && canvas.value.getActiveObject().type === 'activeSelection') {
      canvas.value.discardActiveObject();
    }

    const allObjects = canvas.value.getObjects();
    const P_H = CANVAS_CONSTANTS.PAGE_HEIGHT;
    const GAP = CANVAS_CONSTANTS.PAGE_GAP;

    // BUG-002 fix: build page objects map first, then assign atomically.
    // The old code wiped pages.value[i].objects = [] on ALL pages upfront,
    // leaving them empty if any async interruption occurred during refill.
    const pageObjectMap = pages.value.map(() => []);

    allObjects.forEach((obj) => {
      if (!obj || obj.id === 'page-bg' || obj.id === 'page-bg-image') return;
      if (typeof obj.top !== 'number' || isNaN(obj.top)) return;

      // Zoom-independent coordinates (DO NOT divide by zoomLevel)
      const center = obj.getCenterPoint();
      const actualCenterY = center.y;
      let pageIndex = Math.floor(actualCenterY / (P_H + GAP));

      if (pageIndex < 0) pageIndex = 0;
      if (pageIndex >= pages.value.length) pageIndex = pages.value.length - 1;

      try {
        const serialized = obj.toObject(['id', 'selectable', 'name', 'data', 'textBaseline', 'angle']);
        const pageTopY = pageIndex * (P_H + GAP);

        serialized.left = Math.round(obj.left * 100) / 100;
        serialized.top = Math.round((obj.top - pageTopY) * 100) / 100;
        serialized.width = Math.round((obj.width || 0) * 100) / 100;
        serialized.height = Math.round((obj.height || 0) * 100) / 100;

        if (serialized.textBaseline === 'alphabetical') serialized.textBaseline = 'alphabetic';
        pageObjectMap[pageIndex].push(serialized);
      } catch (e) {
        console.error('Failed to serialize object:', e);
      }
    });

    // Atomic assignment: only update after all objects are processed successfully
    pages.value.forEach((p, i) => {
      if (p) p.objects = pageObjectMap[i];
    });
  } finally {
    isSavingState = false;
  }
};

const setCanvasBackground = async (dataUrl) => {
  if (!canvas.value) return;
  if (pages.value[currentPageIndex.value]) {
    pages.value[currentPageIndex.value].background = dataUrl;
  }
  await renderAllPages();
};

const applyPreviewDataToCanvas = () => {
  if (!canvas.value) return;

  // ใช้ mock data จาก composable แทน hardcoded
  const mockData = getMockData();

  canvas.value.selection = false;
  canvas.value.discardActiveObject();

  canvas.value.getObjects().forEach((obj) => {
    // 1. Resolve Text Variables
    if (['textbox', 'text', 'i-text'].includes(obj.type) && obj.text) {
      let newText = obj.text;
      Object.keys(mockData).forEach((key) => {
        newText = newText.replace(new RegExp(`{{${key}}}`, 'g'), mockData[key]);
      });
      if (newText !== obj.text) obj.set('text', newText);
      obj.set('editable', false);
    }

    // 2. Lock ALL objects (images, text, shapes) so they can't be selected/hovered/dragged
    // Only exclude background elements if they have a specific ID, but usually they are already evented=false
    if (obj.id !== 'page-bg' && obj.id !== 'page-bg-image') {
      obj.set({
        selectable: false,
        evented: false,
        hasControls: false,
        hasBorders: false
      });
    }
  });

  canvas.value.requestRenderAll();
};

// Safe toggle with template backup
const togglePreviewWrapper = async () => {
  // บันทึก state ก่อนเปลี่ยน mode เสมอ - ทั้งเข้าและออก preview
  saveCurrentPageState();

  const wasPreview = isPreviewMode.value;

  try {
    if (!wasPreview) {
      // Entering preview - backup templates first
      const textObjects = canvas.value.getObjects().filter(obj =>
        ['textbox', 'text', 'i-text'].includes(obj.type) && obj.text
      );

      // Store original templates in window for recovery
      window.__originalTemplates = textObjects.map(obj => ({
        id: obj.id || `${obj.type}_${obj.left}_${obj.top}`,
        text: obj.text,
        editable: obj.editable,
        selectable: obj.selectable,
        evented: obj.evented
      }));
    }

    togglePreview();
    await nextTick();

    if (isPreviewMode.value) {
      applyPreviewDataToCanvas();
    } else {
      // Exiting preview - restore templates
      if (canvas.value && window.__originalTemplates) {
        canvas.value.selection = true;

        canvas.value.getObjects().forEach(obj => {
          if (['textbox', 'text', 'i-text'].includes(obj.type)) {
            const objId = obj.id || `${obj.type}_${obj.left}_${obj.top}`;
            const backup = window.__originalTemplates.find(t => t.id === objId);

            if (backup) {
              try {
                obj.set('text', backup.text);
                obj.set('editable', backup.editable);
                obj.set('selectable', backup.selectable);
                obj.set('evented', backup.evented);

                if (obj.textBaseline === 'alphabetical') {
                  obj.set('textBaseline', 'alphabetic');
                }
              } catch (e) {
                console.warn('Failed to restore template:', e);
              }
            }
          }
        });

        // Clear backup
        window.__originalTemplates = null;
      }

      if (canvas.value) canvas.value.selection = true;
      await renderAllPages();
    }
  } catch (error) {
    console.error('Preview toggle failed:', error);

    // Rollback on error
    try {
      if (!wasPreview && window.__originalTemplates) {
        // Failed to enter preview, restore edit mode
        togglePreview();
        isPreviewMode.value = false;
        window.__originalTemplates = null;
      } else {
        // Failed to exit preview, stay in preview
        isPreviewMode.value = true;
      }
    } catch (rollbackError) {
      console.error('Rollback failed:', rollbackError);
    }
  }
};

const loadPageToCanvas = async (index) => {
  if (typeof index === 'number' && index >= 0) currentPageIndex.value = index;
  await renderAllPages();
};

const deletePage = async (index) => {
  if (!confirm(`Delete page ${index + 1}?`)) return;
  pages.value.splice(index, 1);
  pages.value.forEach((page, idx) => (page.id = idx));
  if (currentPageIndex.value >= pages.value.length)
    currentPageIndex.value = Math.max(0, pages.value.length - 1);
  await nextTick();
  await renderAllPages();
  saveHistory();
};

const syncPagesFromCanvas = () => {
  if (!canvas.value) return;

  nextTick(() => {
    const objs = canvas.value.getObjects();
    const bgRects = objs.filter(
      (o) =>
        o.id === 'page-bg' ||
        (o.type === 'rect' && o.fill === '#ffffff' && !o.selectable && o.width === PAGE_WIDTH_CONST)
    );

    bgRects.sort((a, b) => a.top - b.top);

    const newPages = bgRects.map((rect, index) => {
      const bgImg = objs.find(
        (o) =>
          (o.id === 'page-bg-image' || (o.type === 'image' && !o.selectable)) &&
          Math.abs(o.top - rect.top) < 10
      );

      let recoveredId = null;
      if (rect.data && rect.data.pageId) {
        recoveredId = rect.data.pageId;
      } else if (pages.value[index]) {
        recoveredId = pages.value[index].id;
      } else {
        recoveredId = Date.now() + index;
      }

      return {
        id: recoveredId,
        background: bgImg ? bgImg.getSrc() : null,
        objects: []
      };
    });

    pages.value = newPages;
    saveCurrentPageState();
  });
};

const handlePageDrop = async ({ sourceIndex, targetIndex, position }) => {
  if (!isPreviewMode.value && isCanvasReady.value) saveCurrentPageState();

  let insertionIndex = position === 'bottom' ? targetIndex + 1 : targetIndex;

  const [movedPage] = pages.value.splice(sourceIndex, 1);
  if (sourceIndex < insertionIndex) insertionIndex--;

  pages.value.splice(insertionIndex, 0, movedPage);
  pages.value.forEach((page, idx) => (page.id = idx));
  await nextTick();
  await renderAllPages();
  saveHistory();
};

const onDrop = (e) => {
  e.preventDefault();

  console.log("[DROP EVENT]", {
    variable: e.dataTransfer.getData('variable'),
    asset: e.dataTransfer.getData('asset')
  });

  const variable = e.dataTransfer.getData('variable');
  const asset = e.dataTransfer.getData('asset');

  let x = 0;
  let y = 0;

  if (canvas.value && typeof canvas.value.getPointer === 'function') {
    const pointer = canvas.value.getPointer(e);
    x = pointer.x;
    y = pointer.y;
    console.log("[DROP TRACE] calculated via getPointer:", { x, y });
  } else {
    const canvasContainer = document.querySelector('.canvas-container');
    const rect = canvasContainer ? canvasContainer.getBoundingClientRect() : (e.currentTarget ? e.currentTarget.getBoundingClientRect() : { left: 0, top: 0 });
    x = e.clientX - rect.left;
    y = e.clientY - rect.top;

    // Fallback requires applying zoomLevel manually
    if (typeof zoomLevel !== 'undefined' && zoomLevel.value) {
      x = x / zoomLevel.value;
      y = y / zoomLevel.value;
    }
    console.log("[DROP TRACE] calculated via bounding box:", { x, y });
  }

  if (variable) {
    if (typeof addVariableToCanvas !== 'undefined') {
      addVariableToCanvas(variable, x, y)
    }
  }

  if (asset) {
    if (typeof addImageToCanvas !== 'undefined') {
      addImageToCanvas(asset, x, y);
    }
  }
};

onMounted(async () => {
  await nextTick();
  initCanvas();
  isCanvasReady.value = true;
  initCanvasEvents();

  if (canvas.value) {
    canvas.value.on('history:restored', syncPagesFromCanvas);
  }

  if (typeof window !== 'undefined') {
    window.saveCurrentPageState = saveCurrentPageState;
    window.loadPageToCanvas = loadPageToCanvas;
    window.setCanvasBackground = setCanvasBackground;
    window.addVariableToCanvas = addVariableToCanvas;
    window.resetCanvas = resetCanvasWrapper;
    window.applyPreviewDataToCanvas = applyPreviewDataToCanvas;
    window.renderAllPages = renderAllPages;
    window.forceUnlockObject = forceUnlockObject;
    // Expose page state so useCanvas.js keyboard handler can paste cross-page
    window.__editorState = {
      get currentPageIndex() { return currentPageIndex.value; },
      get pageCount() { return pages.value?.length ?? 1; },
    };
  }

  await fetchVariables();
  await fetchTemplates();
  if (!pages.value || pages.value.length === 0)
    pages.value = [{ id: 0, background: null, objects: [] }];
  renderAllPages();

  const roomId = currentTemplateId.value || 'default_room';
  connect(roomId, (remoteJson) => {
    loadFromSocket(remoteJson);
  });
  connectionStatus.value = 'connected';
  if (canvas.value) {
    canvas.value.on('canvas:changed-by-user', (e) => {
      // Only emit local changes, not remote ones
      if (!isRemoteUpdating) {
        emitUpdate(roomId, e.json);
      }
    });
  }

  const handleWheel = (e) => {
    if (e.ctrlKey) {
      e.preventDefault();
      zoomLevel.value = Math.max(0.1, Math.min(3, zoomLevel.value + (e.deltaY > 0 ? -0.1 : 0.1)));
    }
  };
  const handleScroll = () => {
    if (!viewportRef.value) return;
    const P_H = CANVAS_CONSTANTS.PAGE_HEIGHT;
    const GAP = CANVAS_CONSTANTS.PAGE_GAP;
    const newIndex = Math.round(viewportRef.value.scrollTop / ((P_H + GAP) * zoomLevel.value));
    if (newIndex !== currentPageIndex.value && newIndex >= 0 && newIndex < pages.value.length)
      currentPageIndex.value = newIndex;
  };

  if (viewportRef.value) {
    viewportRef.value.addEventListener('wheel', handleWheel, { passive: false });
    viewportRef.value.addEventListener('scroll', handleScroll);
  }

  let clipboard = null;
  window.addEventListener('keydown', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    // Copy (Ctrl+C)
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
      const activeObj = canvas.value?.getActiveObject();
      if (activeObj && !activeObj.isEditing) {
        e.preventDefault();
        activeObj.clone((cloned) => { clipboard = cloned; });
      }
      return;
    }

    // Paste (Ctrl+V)
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
      if (clipboard && canvas.value) {
        e.preventDefault();
        clipboard.clone((clonedObj) => {
          canvas.value.discardActiveObject();
          clonedObj.set({ left: clonedObj.left + 20, top: clonedObj.top + 20, evented: true, selectable: true });

          if (clonedObj.type === 'activeSelection') {
            clonedObj.canvas = canvas.value;
            clonedObj.forEachObject((obj) => {
              obj.id = 'obj_' + Date.now() + Math.random();
              canvas.value.add(obj);
            });
            clonedObj.setCoords();
          } else {
            clonedObj.id = 'obj_' + Date.now() + Math.random();
            canvas.value.add(clonedObj);
          }
          clipboard.top += 20;
          clipboard.left += 20;
          canvas.value.setActiveObject(clonedObj);
          canvas.value.requestRenderAll();
          if (typeof saveHistory === 'function') saveHistory();
        });
      }
      return;
    }

    // Delete / Backspace
    if (e.key === 'Delete' || e.key === 'Backspace') {
      const activeObj = canvas.value?.getActiveObject();
      if (activeObj && !activeObj.isEditing) {
        e.preventDefault();
        if (typeof removeSelectedObject === 'function') removeSelectedObject();
        return;
      } else if (typeof isPagesSidebarOpen !== 'undefined' && isPagesSidebarOpen?.value) {
        if (typeof deletePage === 'function') deletePage(currentPageIndex.value);
      }
    }
  });

});
</script>

<style scoped>
/* Scoped styles specific to the editor */

/* VIEWPORT */
.viewport {
  position: fixed;
  left: 392px;
  /* Rail (72px) + Panel (320px) */
  right: 0;
  top: 60px;
  bottom: 0;
  overflow: auto;
  background-color: #edeff0;
  display: flex;
  flex-direction: column;
  z-index: 10;
  transition: left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.viewport.full-width {
  left: 72px;
  /* Rail (72px) only */
}

.scroll-center-helper {
  min-width: 100%;
  min-height: 100%;
  display: flex;
  flex-direction: row;
  padding: 60px;
  box-sizing: border-box;
}

.canvas-scaler {
  margin: auto;
  position: relative;
  flex-shrink: 0;
}

.canvas-transform-layer {
  background-color: transparent;
  padding: 0;
  margin: 0;
  border-radius: 4px;
}

.paper-shadow {
  background: transparent;
  box-shadow: none;
  display: block;
}

.paper-shadow canvas {
  border-radius: 8px;
  display: block;
}

/* ── Top Navbar ── */
.top-navbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 60px;
  background: white;
  border-bottom: 1px solid #e0e0e0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  z-index: 1000;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
}

.navbar-left {
  display: flex;
  align-items: center;
  gap: 15px;
}

.app-title {
  font-size: 18px;
  font-weight: 700;
  color: #333;
  margin: 0;
  white-space: nowrap;
}

.navbar-center {
  flex: 1;
  display: flex;
  justify-content: center;
}

.navbar-right {
  display: flex;
  align-items: center;
  gap: 15px;
}

.hud-controls {
  display: flex;
  align-items: center;
  gap: 10px;
  background: #f8f9fa;
  padding: 4px 12px;
  border-radius: 20px;
  border: 1px solid #eee;
}

.connection-status-pill {
  font-size: 13px;
  font-weight: 600;
  padding: 6px 14px;
  border-radius: 20px;
  white-space: nowrap;
}

.mode-toggle-btn {
  padding: 6px 16px;
  border-radius: 20px;
  font-weight: 600;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;
}

.mode-toggle-btn.edit-active {
  background: #e3f2fd;
  color: #1565c0;
  border-color: #bbdefb;
}

.mode-toggle-btn.edit-active:hover {
  background: #bbdefb;
}

.mode-toggle-btn.preview-active {
  background: #fff3e0;
  color: #e65100;
  border-color: #ffe0b2;
}

.mode-toggle-btn.preview-active:hover {
  background: #ffe0b2;
}

.mode-toggle-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
  filter: grayscale(0.5);
}


.connection-status-pill.online {
  background: #e8f5e9;
  color: #2e7d32;
  border: 1px solid #c8e6c9;
}

.connection-status-pill.offline {
  background: #ffebee;
  color: #c62828;
  border: 1px solid #ffcdd2;
}

.zoom-btn {
  background: #f5f5f5;
  border: 1px solid #ddd;
  padding: 6px 12px;
  min-width: 36px;
  height: 32px;
  border-radius: 16px;
  cursor: pointer;
  font-weight: bold;
  font-size: 13px;
  color: #333;
  display: flex;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
}

.zoom-btn:hover {
  background: #e0e0e0;
  border-color: #ccc;
}

.zoom-value {
  font-size: 14px;
  font-weight: 700;
  min-width: 45px;
  text-align: center;
  color: #222;
}

.zoom-fit {
  background: #fff;
  border: 1px solid #ccc;
  padding: 6px 10px;
  border-radius: 16px;
  cursor: pointer;
  font-size: 12px;
  color: #333;
  font-weight: 600;
}

.zoom-fit:hover {
  background: #f0f0f0;
}

.divider-v {
  width: 1px;
  height: 24px;
  background: #ddd;
  margin: 0 5px;
}
</style>
