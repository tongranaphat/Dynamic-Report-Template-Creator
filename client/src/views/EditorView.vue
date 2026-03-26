<template>
  <div class="app-layout">
    <header class="top-navbar">
      <div class="navbar-left">
        <h1 class="app-title" @click="goHome" style="cursor: pointer;" title="หน้าหลัก">สร้างเทมเพลตรายงาน</h1>
      </div>

      <div class="navbar-right">

        <div class="zoom-group">
          <button @click="zoomOut" class="btn-zoom-out" title="ซูมออก">
            <span class="zoom-out-icon"></span>
          </button>

          <div class="zoom-value-box">
            <span class="zoom-value-text">{{ Math.round(zoomLevel * 100) }}%</span>
          </div>

          <button @click="zoomIn" class="btn-zoom-in" title="ซูมเข้า">
            <span class="zoom-in-icon"></span>
          </button>
        </div>

        <div class="undo-redo-group">
          <button @click="undo" class="action-btn-text" title="ย้อนกลับ">
            <span class="icon-undo"></span>
            <span class="action-text">ย้อนกลับ</span>
          </button>
          <button @click="redo" class="action-btn-text" title="ทำซ้ำ">
            <span class="icon-redo"></span>
            <span class="action-text">ทำซ้ำ</span>
          </button>
        </div>

        <div class="divider-v"></div>

        <div class="mode-group">
          <button @click="togglePreviewWrapper" class="preview-btn" :disabled="isGenerating">
            <span :class="isPreviewMode ? 'icon-edit' : 'icon-eye'"></span>
            <span class="preview-text">
              {{ isGenerating ? 'สร้าง...' : (isPreviewMode ? 'แก้ไข' : 'ดูตัวอย่าง') }}
            </span>
          </button>
        </div>

      </div>
    </header>

    <Sidebar :isOpen="isSidebarOpen" :is-history-open="showHistoryModal" :connectionStatus="connectionStatus"
      :templates="templates" :isCanvasReady="isCanvasReady" :templateName="templateName" :isPreviewMode="isPreviewMode"
      :currentTemplateId="currentTemplateId" :groupedVariables="groupedVariables" :isGenerating="isGenerating"
      :pdfQuality="pdfQuality" :pdfMode="pdfMode" @update:pdfMode="pdfMode = $event" :pages="pages"
      :currentPageIndex="currentPageIndex" @toggle="toggleSidebar" @open="isSidebarOpen = true"
      @close="isSidebarOpen = false" @load-template="loadTemplateWrapper" @delete-template="deleteTemplate"
      @update:templateName="templateName = $event" @update:pdfQuality="pdfQuality = $event"
      @save-template="handleSaveTemplate" @reset-canvas="goHome" @toggle-preview="togglePreviewWrapper"
      @import-workspace="handleImportWorkspaceWrapper" @add-variable="addVariableToCanvas"
      @addImage="addImageToCanvasWrapper" @save-report="handleSaveProject" @generate-pdf="handleExport"
      @open-history="openHistoryModal" @delete-page="deletePage" @add-page="addBlankPageWrapper"
      @import-page="handleAppendPageWrapper" @page-click="scrollToPage" @page-drop="handlePageDrop" :layers="layers"
      @select-layer="handleSelectLayer" @import-url="handleUrlImport" />

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

    <HistoryModal v-if="showHistoryModal" :reportInstances="reportHistory" :currentInstanceId="currentReportId"
      @close="showHistoryModal = false" @edit="openReportFromHistory" @delete="handleDeleteReport" />
  </div>
</template>

<script setup>
import { onMounted, ref, watch, nextTick, onUnmounted } from 'vue';
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
import { useLayers } from '../composables/useLayers';

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
const pdfQuality = ref(2);
const pdfMode = ref('flatten');
let isRendering = false;


const toggleSidebar = () => {
  isSidebarOpen.value = !isSidebarOpen.value;
};

const fetchReports = async () => {
  try {
    const res = await axios.get(
      `${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/reports`
    );
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
      const r = res.data;
      currentReportId.value = r.id;
      currentTemplateId.value = r.templateId;
      templateName.value = r.name;

      // Sanitize pages (normalizes textBaseline etc.)
      if (r.pages && Array.isArray(r.pages)) {
        pages.value = sanitizePagesData(JSON.parse(JSON.stringify(r.pages)));
        currentPageIndex.value = 0;
      }

      if (resetHistory) resetHistory();
      await nextTick();
      await renderAllPages();

      if (typeof window !== 'undefined' && window.history) {
        window.history.pushState({}, '', `/history/${r.id}`);
      }
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

const handleUrlImport = async (url) => {
  try {
    showNotification('กำลังดาวน์โหลดไฟล์จากลิงก์...', 'info');

    const response = await apiService.importPdfFromUrl(url);
    const newPdfId = response.data.id || response.data.fileId;

    if (newPdfId) {
      window.history.pushState({}, '', `/pdf/${newPdfId}`);
      window.location.reload(); // Reload to trigger the onMounted PDF fetcher
      return;
    }

    const filepath = response.data.filepath;

    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
    const backendUrl = apiUrl.replace('/api', '');

    const fileResponse = await fetch(`${backendUrl}${filepath}`);
    const blob = await fileResponse.blob();

    const fakeFile = new File([blob], 'imported_from_url.pdf', { type: 'application/pdf' });

    fakeFile.isFromUrl = true;

    const fakeEvent = { target: { files: [fakeFile] } };

    if (typeof handleImportWorkspace === 'function') {
      await handleImportWorkspace(fakeEvent);
      currentPageIndex.value = 0;
      await renderAllPages();
    }

    showNotification('นำเข้าไฟล์สำเร็จ!', 'success');
  } catch (error) {
    console.error('URL Import Failed:', error);
    showNotification('ไม่สามารถนำเข้าจากลิงก์นี้ได้', 'error');
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

const { layers, updateLayers } = useLayers();

const handleSelectLayer = (rawObject) => {
  if (canvas.value && rawObject) {
    canvas.value.setActiveObject(rawObject);
    canvas.value.requestRenderAll();
    updateLayers(canvas.value);
  }
};

watch(canvas, (newCanvas) => {
  if (newCanvas) {
    const updateLayersCb = () => updateLayers(newCanvas);
    newCanvas.on('object:added', updateLayersCb);
    newCanvas.on('object:removed', updateLayersCb);
    newCanvas.on('object:modified', updateLayersCb);
    newCanvas.on('selection:created', updateLayersCb);
    newCanvas.on('selection:cleared', updateLayersCb);
    newCanvas.on('selection:updated', updateLayersCb);
  }
}, { immediate: true });

const {
  variables,
  templates,
  templateName,
  currentTemplateId,
  currentReportId,
  currentFileHandle,
  isPreviewMode,
  pages,
  currentPageIndex,
  isSidebarOpen,
  isPagesSidebarOpen,
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
  sanitizePagesData,

  // Unified Exports
  unifiedSave,
  handleUnifiedImport,
  ensureFileHandle,
  processPdfToImages
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




const handleSaveTemplate = async () => {
  try {
    await saveTemplate(false); // false = show notifications
    await editorStore.fetchTemplates(); // Refresh sidebar
    saveHistory();
  } catch (e) {
    console.error('Save Template failed:', e);
  }
};


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



    const variableMap = {};

    try {
      const realData = await apiService.getVariables();

      if (Array.isArray(realData)) {
        realData.forEach(item => {
          if (item.key) {
            variableMap[item.key] = item.value || '';
          }
        });
      }
    } catch (error) {
      console.warn('Failed to fetch live variables, using sidebar defaults:', error);
      // Fallback to sidebar variable values if API is unavailable
      if (variables.value) {
        variables.value.forEach((v) => {
          if (v.key) variableMap[v.key] = v.value || `{{${v.key}}}`;
        });
      }
    }

    // Capture canvas images first
    const canvasImages = [];
    const P_H = CANVAS_CONSTANTS.PAGE_HEIGHT;
    const GAP = CANVAS_CONSTANTS.PAGE_GAP;
    const qualityMultiplier = 2;
    const TEXT_TYPES = ['textbox', 'text', 'i-text'];
    // Include images in overlay types for mode-based separation
    const OVERLAY_TYPES = ['textbox', 'text', 'i-text', 'image'];

    // Enter preview mode for capture
    const wasPreview = isPreviewMode.value;
    const originalPage = currentPageIndex.value;

    try {
      canvas.value.requestRenderAll();
      if (!wasPreview) saveCurrentPageState();
      isPreviewMode.value = true;
      await renderAllPages();
      await nextTick();
      applyPreviewDataToCanvas(variableMap);
      await nextTick();

      // Capture each page as image
      for (let i = 0; i < pages.value.length; i++) {
        const allObjects = canvas.value.getObjects();
        const hiddenForCapture = [];

        // Flatten vs Vector object hiding logic
        allObjects.forEach((obj) => {
          const center = obj.getCenterPoint();
          const objPageIndex = Math.floor(center.y / (P_H + GAP));
          const isWrongPage = objPageIndex !== i;

          const isBackground = obj.id === 'page-bg-image' || obj.id === 'page-bg';
          const isOverlay = OVERLAY_TYPES.includes(obj.type) && !isBackground;

          let shouldHide = false;
          if (pdfMode.value === 'flatten') {
            // Flatten: hide only wrong-page objects (text bakes into image)
            shouldHide = isWrongPage;
          } else {
            // Vector: hide overlays from JPEG (pdf-lib renders them as AcroForm)
            shouldHide = isWrongPage || isOverlay;
          }

          if (shouldHide && obj.visible) {
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

      // ==========================================
      // 📌 เตรียมข้อมูลให้ PDF (คำนวณ \n ใหม่ โดยห้ามลบข้อมูลทิ้งเด็ดขาด!)
      // ==========================================
      const exportProjectData = JSON.parse(JSON.stringify(projectData));
      const liveObjects = canvas.value.getObjects();

      exportProjectData.pages.forEach((page, pageIndex) => {
        if (page.objects) {
          page.objects.forEach(jsonObj => {
            if (['textbox', 'text', 'i-text'].includes(jsonObj.type)) {
              const liveObj = liveObjects.find(o => {
                if (o.id && jsonObj.id && o.id === jsonObj.id) return true;
                const expectedTop = jsonObj.top + (pageIndex * (P_H + GAP));
                return Math.abs(o.left - jsonObj.left) < 5 && Math.abs(o.top - expectedTop) < 5;
              });

              if (liveObj) {
                if (liveObj.textLines && liveObj.textLines.length > 0) {
                  const cleanLines = liveObj.textLines.map(line => {
                    return (typeof line === 'string' ? line : '').replace(/\u200B/g, '').trimEnd();
                  });
                  jsonObj.text = cleanLines.join('\n');
                } else if (liveObj.text) {
                  jsonObj.text = liveObj.text.replace(/\u200B/g, '');
                }
              }
              if (jsonObj.text) jsonObj.text = jsonObj.text.replace(/\u200B/g, '');
            }
          });
        }
      });
      // ==========================================

      // Step 1: Generate PDF blob (ส่งตัวแปรที่ 4, 5, 6 ไปให้ครบเพื่อบอกโหมด)
      const pdfBlob = await generateHybridPdfBlob(canvasImages, exportProjectData, variableMap, null, 'report', pdfMode.value);

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



    const variableMap = {};

    try {
      const realData = await apiService.getVariables();

      if (Array.isArray(realData)) {
        realData.forEach(item => {
          if (item.key) {
            variableMap[item.key] = item.value || '';
          }
        });
      }
    } catch (error) {
      console.warn('Failed to fetch live variables, using sidebar defaults:', error);
      // Fallback to sidebar variable values if API is unavailable
      if (variables.value) {
        variables.value.forEach((v) => {
          if (v.key) variableMap[v.key] = v.value || `{{${v.key}}}`;
        });
      }
    }

    // Capture canvas images first
    const canvasImages = [];
    const P_H = CANVAS_CONSTANTS.PAGE_HEIGHT;
    const GAP = CANVAS_CONSTANTS.PAGE_GAP;
    const qualityMultiplier = 2;
    const TEXT_TYPES = ['textbox', 'text', 'i-text'];
    // Include images in overlay types for mode-based separation
    const OVERLAY_TYPES = ['textbox', 'text', 'i-text', 'image'];

    // Enter preview mode for capture
    const wasPreview = isPreviewMode.value;
    const originalPage = currentPageIndex.value;

    try {
      canvas.value.requestRenderAll();
      if (!wasPreview) saveCurrentPageState();
      isPreviewMode.value = true;
      await renderAllPages();
      await nextTick();
      applyPreviewDataToCanvas(variableMap);
      await nextTick();

      // Capture each page as image
      for (let i = 0; i < pages.value.length; i++) {
        const allObjects = canvas.value.getObjects();
        const hiddenForCapture = [];

        // Flatten vs Vector object hiding logic
        allObjects.forEach((obj) => {
          const center = obj.getCenterPoint();
          const objPageIndex = Math.floor(center.y / (P_H + GAP));
          const isWrongPage = objPageIndex !== i;

          const isBackground = obj.id === 'page-bg-image' || obj.id === 'page-bg';
          const isOverlay = OVERLAY_TYPES.includes(obj.type) && !isBackground;

          let shouldHide = false;
          if (pdfMode.value === 'flatten') {
            // Flatten: hide only wrong-page objects (text bakes into image)
            shouldHide = isWrongPage;
          } else {
            // Vector: hide overlays from JPEG (pdf-lib renders them as AcroForm)
            shouldHide = isWrongPage || isOverlay;
          }

          if (shouldHide && obj.visible) {
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

      // Use live textLines for accurate line-break data in the PDF
      const exportProjectData = JSON.parse(JSON.stringify(projectData));
      const liveObjects = canvas.value.getObjects();

      exportProjectData.pages.forEach((page, pageIndex) => {
        if (page.objects) {
          page.objects.forEach(jsonObj => {
            if (['textbox', 'text', 'i-text'].includes(jsonObj.type)) {
              const liveObj = liveObjects.find(o => {
                if (o.id && jsonObj.id && o.id === jsonObj.id) return true;
                const expectedTop = jsonObj.top + (pageIndex * (P_H + GAP));
                return Math.abs(o.left - jsonObj.left) < 5 && Math.abs(o.top - expectedTop) < 5;
              });

              if (liveObj) {
                if (liveObj.textLines && liveObj.textLines.length > 0) {
                  const cleanLines = liveObj.textLines.map(line => {
                    return (typeof line === 'string' ? line : '').replace(/\u200B/g, '').trimEnd();
                  });
                  jsonObj.text = cleanLines.join('\n');
                } else if (liveObj.text) {
                  jsonObj.text = liveObj.text.replace(/\u200B/g, '');
                }
              }
              if (jsonObj.text) jsonObj.text = jsonObj.text.replace(/\u200B/g, '');
            }
          });
        }
      });


      // Step 1: Generate PDF blob (ส่งตัวแปรที่ 4, 5, 6 ไปให้ครบเพื่อบอกโหมด)
      const pdfBlob = await generateHybridPdfBlob(canvasImages, exportProjectData, variableMap, null, 'report', pdfMode.value);

      const options = {
        suggestedName: `${templateName.value || 'report'}.pdf`
      };
      const newHandle = await window.showSaveFilePicker(options);

      const writable = await newHandle.createWritable();
      await writable.write(pdfBlob);
      await writable.close();

      // Reassign handle for future saves
      currentFileHandle.value = newHandle;

      // Register new report instance in database
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

const goHome = () => {
  if (typeof window !== 'undefined' && window.history) {
    window.history.pushState({}, '', '/');
  }
  resetCanvasWrapper();
};


const handleImportWorkspaceWrapper = async () => {
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





const cleanupCanvasObjects = () => {
  if (!canvas.value) return;

  const objects = canvas.value.getObjects();
  let cleanedCount = 0;

  objects.forEach(obj => {
    try {
      // Clear clipPath safely
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
  }
};

const renderAllPages = async () => {
  if (!canvas.value) return;
  if (isRendering) return;

  isRendering = true;
  setHistoryLock(true);
  try {
    // Cleanup before clear to prevent memory leaks
    cleanupCanvasObjects();

    if (!pages.value || !Array.isArray(pages.value) || pages.value.length === 0) {
      pages.value = [{ id: 0, background: null, objects: [] }];
    }
    const currentPages = pages.value;

    canvas.value.discardActiveObject();
    canvas.value.clear();
    // Transparent background so gaps are visible
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

              // Apply clip path on load
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
    updateLayers(canvas.value);
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


const addImageToCanvasWrapper = (url) => {
  if (!url) return;
  addImageToCanvas(url);
};

const addCustomTextToCanvas = (x = 50, y = 50) => {
  if (!canvas.value) return;

  const text = new fabric.Textbox('พิมพ์ข้อความที่นี่...', {
    id: 'custom_text_' + Date.now(),
    left: x, // ใช้พิกัดที่ส่งมา (ค่าเริ่มต้นคือ 50)
    top: y,  // ใช้พิกัดที่ส่งมา (ค่าเริ่มต้นคือ 50)
    width: 200,
    fontFamily: 'Sarabun',
    fontSize: 16,
    fill: '#000000',
    editable: true,
    padding: 5,
    textAlign: 'left',
    splitByGrapheme: true,
    objectCaching: false
  });

  if (typeof forceUnlockObject === 'function') {
    forceUnlockObject(text);
  }

  canvas.value.add(text);
  canvas.value.setActiveObject(text);
  canvas.value.requestRenderAll();

  if (typeof saveCurrentPageState === 'function') {
    saveCurrentPageState();
  }
};
// ==========================================

// Prevents race conditions during page state serialization
let isSavingState = false;

const saveCurrentPageState = () => {
  if (isPreviewMode.value || !canvas.value || isSavingState) return;

  isSavingState = true;
  try {
    // Ungroup active selection to restore absolute coordinates before saving
    if (canvas.value && canvas.value.getActiveObject() && canvas.value.getActiveObject().type === 'activeSelection') {
      canvas.value.discardActiveObject();
    }

    const allObjects = canvas.value.getObjects();
    const P_H = CANVAS_CONSTANTS.PAGE_HEIGHT;
    const GAP = CANVAS_CONSTANTS.PAGE_GAP;

    // Build page objects map first, then assign atomically
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

const applyPreviewDataToCanvas = (customData = null) => {
  if (!canvas.value) return;
  const dataToUse = customData || getMockData();

  canvas.value.selection = false;
  canvas.value.discardActiveObject();

  canvas.value.getObjects().forEach((obj) => {
    if (['textbox', 'text', 'i-text'].includes(obj.type) && obj.text) {
      let newText = obj.text;

      // Replace {{variables}} with live data
      Object.keys(dataToUse).forEach((key) => {
        newText = newText.replace(new RegExp(`{{${key}}}`, 'g'), dataToUse[key] || '');
      });

      if (newText !== obj.text) obj.set('text', newText);

      obj.set('splitByGrapheme', true);
      obj.set('editable', false);
    }

    if (obj.id !== 'page-bg' && obj.id !== 'page-bg-image') {
      obj.set({ selectable: false, evented: false, hasControls: false, hasBorders: false });
    }
  });

  canvas.value.requestRenderAll();
};

// Safe toggle with template backup
const togglePreviewWrapper = async () => {
  saveCurrentPageState();
  const wasPreview = isPreviewMode.value;

  try {
    if (!wasPreview) {
      // Entering preview - backup templates first
      const textObjects = canvas.value.getObjects().filter(obj =>
        ['textbox', 'text', 'i-text'].includes(obj.type) && obj.text
      );

      window.__originalTemplates = textObjects.map(obj => ({
        id: obj.id || `${obj.type}_${obj.left}_${obj.top}`,
        text: obj.text,
        editable: obj.editable,
        selectable: obj.selectable,
        evented: obj.evented
      }));

      // Fetch live preview data from DB
      const previewVariableMap = {};
      try {
        const realData = await apiService.getVariables();
        if (Array.isArray(realData)) {
          realData.forEach(item => {
            if (item.key) previewVariableMap[item.key] = item.value || '';
          });
        }
      } catch (error) {
        console.warn('Failed to fetch preview data from DB:', error);
      }

      togglePreview();
      await nextTick();
      // Apply live data to canvas preview
      applyPreviewDataToCanvas(previewVariableMap);

    } else {
      // Exiting preview - restore templates
      togglePreview();
      await nextTick();

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
        window.__originalTemplates = null;
      }

      if (canvas.value) canvas.value.selection = true;
      await renderAllPages();
    }
  } catch (error) {
    console.error('Preview toggle failed:', error);
    try {
      if (!wasPreview && window.__originalTemplates) {
        togglePreview();
        isPreviewMode.value = false;
        window.__originalTemplates = null;
      } else {
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


  const variable = e.dataTransfer.getData('variable');
  const asset = e.dataTransfer.getData('asset');

  let x = 0;
  let y = 0;

  if (canvas.value && typeof canvas.value.getPointer === 'function') {
    const pointer = canvas.value.getPointer(e);
    x = pointer.x;
    y = pointer.y;

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

  // Handle free- text box drag-and-drop
  const customText = e.dataTransfer.getData('customText');
  if (customText) {
    addCustomTextToCanvas(x, y);
  }
};

const handleRouteChange = async () => {
  const currentPath = window.location.pathname;

  const urlParams = new URLSearchParams(window.location.search);
  const originalUrlParam = urlParams.get('originalUrl');

  const openMatch = currentPath.match(/^\/path\/(.+)/i);
  let filepathParam = openMatch ? decodeURIComponent(openMatch[1]) : urlParams.get('filepath');

  if (filepathParam) {
    filepathParam = '/' + filepathParam.replace(/^\/+/, '');

    try {
      const fileUrl = `${(import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace('/api', '')}${filepathParam}`;
      const blobRes = await axios.get(fileUrl, { responseType: 'blob' });

      const filename = originalUrlParam || filepathParam.split('/').pop() || 'document.pdf';
      const downloadedFile = new File([blobRes.data], filename, { type: 'application/pdf' });

      if (typeof resetCanvasWrapper === 'function') await resetCanvasWrapper();
      else if (typeof resetCanvas === 'function') await resetCanvas();

      const images = await processPdfToImages(downloadedFile);
      if (images.length > 0) {
        pages.value = images.map((img, idx) => ({
          id: Date.now() + idx,
          background: img,
          objects: [],
          originalBackgroundType: 'PDF'
        }));
        currentPageIndex.value = 0;
        await renderAllPages();
      }
    } catch (error) {
      console.error('Failed to load PDF from filepath param:', error);
    }
    return;
  }

  // 1. Check for PDF URL
  const pdfMatch = currentPath.match(/^\/pdf\/([a-zA-Z0-9-]+)/i);
  if (pdfMatch && pdfMatch[1]) {
    const fileId = pdfMatch[1];
    try {
      // 1. Get filepath from DB
      const dbRes = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/pdf/cache/${fileId}`);
      const filepath = dbRes.data.filepath;

      // 2. Fetch the actual physical file blob
      const fileUrl = `${(import.meta.env.VITE_API_URL || 'http://localhost:3000/api').replace('/api', '')}${filepath}`;
      const blobRes = await axios.get(fileUrl, { responseType: 'blob' });

      // 3. Convert to File and load to canvas
      const downloadedFile = new File([blobRes.data], dbRes.data.originalUrl || 'document.pdf', { type: 'application/pdf' });

      // Bypass the upload redirect and directly process images
      await resetCanvasWrapper();
      const images = await processPdfToImages(downloadedFile);
      if (images.length > 0) {
        pages.value = images.map((img, idx) => ({
          id: Date.now() + idx,
          background: img,
          objects: [],
          originalBackgroundType: 'PDF'
        }));
        currentPageIndex.value = 0;
        await renderAllPages();
      }
    } catch (error) {
      console.error('Failed to load PDF from URL:', error);
      alert('Could not load the requested PDF.');
    }
    return;
  }

  // 2. Check for Template URL
  const templateMatch = currentPath.match(/^\/template\/([a-zA-Z0-9-]+)/i);
  if (templateMatch && templateMatch[1]) {
    const templateId = templateMatch[1];
    try {
      // Fetch the template data from the backend
      const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/templates/${templateId}`);

      // Load it into the canvas using your existing store/canvas functions
      await loadTemplateWrapper(res.data);
      console.log("Template loaded from URL", res.data);
    } catch (error) {
      console.error('Failed to load template from URL:', error);
    }
    return;
  }

  // 3. Check for History URL
  const historyMatch = currentPath.match(/^\/history\/([a-zA-Z0-9-]+)/i);
  if (historyMatch && historyMatch[1]) {
    const instanceId = historyMatch[1];
    try {
      const res = await axios.get(`${import.meta.env.VITE_API_URL || 'http://localhost:3000/api'}/reports/${instanceId}`);
      if (res.data) {
        const r = res.data;
        currentReportId.value = r.id;
        currentTemplateId.value = r.templateId;
        templateName.value = r.name;
        if (r.pages && Array.isArray(r.pages)) {
          pages.value = sanitizePagesData(JSON.parse(JSON.stringify(r.pages)));
          currentPageIndex.value = 0;
        }
        if (typeof resetHistory !== 'undefined' && resetHistory) resetHistory();
        await nextTick();
        await renderAllPages();
        console.log("History loaded from URL successfully");
      }
    } catch (error) {
      console.error('Failed to load history instance from URL:', error);
    }
    return;
  }

  // Fallback for Root '/' (User clicked Back to the home state)
  if (currentPath === '/' || currentPath === '') {
    console.log("Navigated to root, forcing workspace reset...");
    try {
      // 1. Force clear the canvas
      if (typeof resetCanvasWrapper === 'function') {
        await resetCanvasWrapper();
      } else if (typeof resetCanvas === 'function') {
        await resetCanvas();
      } else if (typeof pages !== 'undefined') {
        // Hard reset if wrapper functions are out of scope
        pages.value = [{ id: Date.now(), background: null, objects: [] }];
        if (typeof currentPageIndex !== 'undefined') currentPageIndex.value = 0;
      }

      // 2. Clear active store states so Sidebar un-highlights items
      if (typeof editorStore !== 'undefined') {
        if (typeof editorStore.setActiveTemplate === 'function') editorStore.setActiveTemplate(null);
        // Clear any other active states if they exist
      }
    } catch (error) {
      console.error("Error resetting workspace on back navigation:", error);
    }
  }
};

onMounted(async () => {
  await nextTick();
  initCanvas();
  isCanvasReady.value = true;
  initCanvasEvents();

  // 1. ALWAYS fetch core data first so the Sidebar is populated
  try {
    await fetchVariables();
    await fetchTemplates();
  } catch (error) {
    console.error("Failed to initialize store data:", error);
  }

  await handleRouteChange();
  window.addEventListener('popstate', handleRouteChange);

  if (canvas.value) {
    const updateLayersCb = () => updateLayers(canvas.value);
    canvas.value.on('object:added', updateLayersCb);
    canvas.value.on('object:removed', updateLayersCb);
    canvas.value.on('object:modified', updateLayersCb);
    canvas.value.on('selection:created', updateLayersCb);
    canvas.value.on('selection:updated', updateLayersCb);
    canvas.value.on('selection:cleared', updateLayersCb);
  }

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
    window.addCustomTextToCanvas = addCustomTextToCanvas;
  }

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

onUnmounted(() => {
  window.removeEventListener('popstate', handleRouteChange);
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
  height: 69px;
  background: #FFFFFF;
  border-top: 3.5px solid #2196F3;
  border-bottom: 1px solid #E3E3E3;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 46px;
  z-index: 1000;
  box-sizing: border-box;

  /* 📌 เพิ่ม 2 บรรทัดนี้เพื่อบังคับให้ตัวอักษรและไอคอนทั้งหมดในแถบนี้คมกริบ */
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.navbar-left {
  display: flex;
  align-items: center;
  height: 100%;
}

/* app-title */
.app-title {
  text-align: left;
  font: normal normal bold 26px/34px "TH Sarabun New", "Sarabun", sans-serif;
  letter-spacing: 0px;
  color: #000000;
  opacity: 1;
  margin: 0;
  white-space: nowrap;
}

.navbar-right {
  display: flex;
  align-items: center;
  height: 100%;
}

/* ── 1. กลุ่ม Zoom ── */
.zoom-group {
  display: flex;
  align-items: center;
}

.btn-zoom-out,
.btn-zoom-in {
  background: transparent;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
}

.btn-zoom-out {
  width: 23px;
  height: 23px;
  margin-right: 10px;
  /* ระยะห่างเป๊ะจาก Design */
}

/* zoom-out-icon */
.zoom-out-icon {
  width: 13px;
  height: 1px;
  background: #4D4D4D;
}

/* zoom-value-box */
.zoom-value-box {
  width: 72px;
  height: 39px;
  background: #FFFFFF;
  border: 1px solid #E3E3E3;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* zoom-value-text */
.zoom-value-text {
  width: 35px;
  height: 26px;
  text-align: center;
  /* ปรับให้ตัวเลขอยู่กลางกล่อง */
  font: normal normal normal 20px/28px "TH Sarabun New", "Sarabun", sans-serif;
  color: #000000;
  margin-top: 1px;
}

.btn-zoom-in {
  width: 23px;
  height: 23px;
  margin-left: 12px;
  /* ระยะห่างเป๊ะจาก Design */
}

/* zoom-in-icon (9x9) สร้างกากบาทให้คมเป๊ะ */
.zoom-in-icon {
  position: relative;
  width: 9px;
  height: 9px;
}

.zoom-in-icon::before,
.zoom-in-icon::after {
  content: "";
  position: absolute;
  background: #4D4D4D;
}

/* เส้นแนวนอน */
.zoom-in-icon::before {
  top: 4px;
  left: 0;
  width: 9px;
  height: 1px;
}

/* เส้นแนวตั้ง */
.zoom-in-icon::after {
  top: 0;
  left: 4px;
  width: 1px;
  height: 9px;
}

/* ── 2. กลุ่ม Undo / Redo ── */
.undo-redo-group {
  display: flex;
  align-items: center;
  margin-left: 24px;
  /* ห่างจากปุ่ม + */
  gap: 24px;
  /* ระยะห่างระหว่าง undo กับ redo */
}

.action-btn-text {
  display: flex;
  align-items: center;
  gap: 7px;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 0;
}

/* icon-undo, icon-redo */
.icon-undo,
.icon-redo {
  width: 23px;
  height: 23px;
  background-size: 100% 100%;
  background-repeat: no-repeat;
  background-position: 0% 0%;
}

.icon-undo {
  background-image: url('../assets/icons/undo.png');
}

.icon-redo {
  background-image: url('../assets/icons/redo.png');
}

/* action-text (undo/redo) */
.action-text {
  height: 26px;
  text-align: left;
  font: normal normal normal 20px/28px "TH Sarabun New", "Sarabun", sans-serif;
  color: #000000;
  white-space: nowrap;
}

/* ── เส้นคั่น ── */
.divider-v {
  width: 1px;
  height: 49px;
  background: #E3E3E3;
  /* เปลี่ยนมาใช้ bg แทน border ให้เส้นคม 1px */
  margin: 0 32px 0 46px;
  /* คำนวณระยะห่างให้สมดุลตามดีไซน์ */
}

/* ── 3. ปุ่ม Preview ── */
.mode-group {
  display: flex;
  align-items: center;
}

/* preview-btn */
.preview-btn {
  width: 105px;
  height: 39px;
  background: #F65189;
  border-radius: 6px;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  cursor: pointer;
  padding: 0;
}

.preview-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

/* icon-eye */
.icon-eye {
  width: 16px;
  height: 16px;
  background: transparent url('../assets/icons/eye.png') 0% 0% no-repeat padding-box;
  background-size: contain;
}

.icon-edit {
  width: 16px;
  height: 16px;
  background: transparent url('../assets/icons/edit.png') 0% 0% no-repeat padding-box;
  background-size: contain;
}

/* preview-text */
.preview-text {
  height: 26px;
  text-align: left;
  font: normal normal normal 20px/28px "TH Sarabun New", "Sarabun", sans-serif;
  color: #FFFFFF;
  white-space: nowrap;
}
</style>
