<template>
  <div class="app-layout">
    <TopNavbar
      :zoom-level="zoomLevel"
      :is-preview-mode="isPreviewMode"
      :is-generating="isGenerating"
      @go-home="goHome"
      @undo="undo"
      @redo="redo"
      @zoom-in="zoomIn"
      @zoom-out="zoomOut"
      @toggle-preview="togglePreviewWrapper"
    />

    <Sidebar
      :isOpen="isSidebarOpen"
      :is-history-open="showHistoryModal"
      :connectionStatus="connectionStatus"
      :templates="templates"
      :isCanvasReady="isCanvasReady"
      :templateName="templateName"
      :isPreviewMode="isPreviewMode"
      :currentTemplateId="currentTemplateId"
      :groupedVariables="groupedVariables"
      :isGenerating="isGenerating"
      :pdfQuality="pdfQuality"
      :pdfMode="pdfMode"
      @update:pdfMode="pdfMode = $event"
      :pages="pages"
      :currentPageIndex="currentPageIndex"
      @toggle="toggleSidebar"
      @open="isSidebarOpen = true"
      @close="isSidebarOpen = false"
      @load-template="loadTemplateWrapper"
      @delete-template="deleteTemplate"
      @update:templateName="templateName = $event"
      @update:pdfQuality="pdfQuality = $event"
      @save-template="handleSaveTemplate"
      @reset-canvas="goHome"
      @toggle-preview="togglePreviewWrapper"
      @import-workspace="handleImportWorkspaceWrapper"
      @add-variable="handleAddVariable"
      @addImage="addImageToCanvasWrapper"
      @save-report="handleSaveProject"
      @generate-pdf="handleExport"
      @open-history="openHistoryModal"
      @delete-page="deletePage"
      @add-page="addBlankPageWrapper"
      @import-page="handleAppendPageWrapper"
      @page-click="scrollToPage"
      @page-drop="handlePageDrop"
      :layers="layers"
      @select-layer="handleSelectLayer"
      @import-url="handleUrlImport"
      @reset-project="handleReset"
      @add-signature-block="handleAddSignatureBlock"
      @add-custom-variable="addCustomVariable"
    />

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

    <div v-if="canvas" class="floating-panel-anchor" :class="{ 'sidebar-closed': !isSidebarOpen }">
      <PropertiesPanel :canvas="canvas" :is-preview-mode="isPreviewMode" />
    </div>

    <HistoryModal
      v-if="showHistoryModal"
      :reportInstances="reportHistory"
      :currentInstanceId="currentReportId"
      @close="showHistoryModal = false"
      @edit="openReportFromHistory"
      @delete="handleDeleteReport"
    />

    <ExportOverlay
      :visible="exportOverlay.visible"
      :title="exportOverlay.title"
      :current="exportOverlay.current"
      :total="exportOverlay.total"
      :stage="exportOverlay.stage"
    />
  </div>
</template>

<script setup>
import { onMounted, ref, watch, nextTick, onUnmounted, computed, toRaw } from 'vue';
import { fabric } from 'fabric';
import TopNavbar from '../components/TopNavbar.vue';
import PropertiesPanel from '../components/PropertiesPanel.vue';
import Sidebar from '../components/Sidebar.vue';
import HistoryModal from '../components/HistoryModal.vue';
import ExportOverlay from '../components/ExportOverlay.vue';

import { useCanvas } from '../composables/useCanvas';
import { useTemplate } from '../composables/useTemplate';
import { useCanvasEvents } from '../composables/useCanvasEvents';

import { useEditablePdf } from '../composables/useEditablePdf';
import { usePreviewData } from '../composables/usePreviewData';
import { useEditorStore } from '../stores/editorStore';
import { CANVAS_CONSTANTS } from '../constants/canvas';
import { showNotification } from '../utils/notifications';
import { yieldToMain } from '../utils/yieldToMain';
import apiService from '../services/apiService';
import { useLayers } from '../composables/useLayers';

const currentPdfId = computed(() => {
  const parts = window.location.pathname.split('/');
  return parts[parts.length - 1];
});
const pdfUrlToRender = ref('');

const PAGE_WIDTH_CONST = CANVAS_CONSTANTS.PAGE_WIDTH;
const PAGE_HEIGHT_CONST = CANVAS_CONSTANTS.PAGE_HEIGHT;

let isCanvasReady = ref(false);
const canvasBaseDimensions = ref({
  width: CANVAS_CONSTANTS.PAGE_WIDTH,
  height: CANVAS_CONSTANTS.PAGE_HEIGHT
});
const connectionStatus = ref('offline');
const isGenerating = ref(false);
const pdfQuality = ref(2);
const pdfMode = ref('flatten');
const pdfUrl = ref(null);
let isRendering = false;

const exportOverlay = ref({
  visible: false,
  title: '',
  current: 0,
  total: 1,
  stage: ''
});
const showExportOverlay = (title, total = 1) => {
  exportOverlay.value = { visible: true, title, current: 0, total, stage: '' };
};
const updateExportProgress = (current, stage = '') => {
  exportOverlay.value.current = current;
  if (stage) exportOverlay.value.stage = stage;
};
const hideExportOverlay = () => {
  exportOverlay.value.visible = false;
};

let _wheelHandler = null;
let _scrollHandler = null;
let _keydownHandler = null;

const toggleSidebar = () => {
  isSidebarOpen.value = !isSidebarOpen.value;
};

let activePdfId = null;

const triggerTempCleanup = () => {
  const idToClean = activePdfId || (currentPdfId.value !== 'pdf' ? currentPdfId.value : null);

  if (idToClean && idToClean !== 'pdf') {
    const cleanupUrl = `${apiService.getBackendBase()}/api/pdf/cleanup-temp/${idToClean}`;

    if (navigator.sendBeacon) {
      navigator.sendBeacon(cleanupUrl);
    } else {
      fetch(cleanupUrl, { method: 'POST', keepalive: true }).catch(() => {});
    }

    activePdfId = null;
  }
};

const fetchReports = async () => {
  try {
    reportHistory.value = await apiService.getReports();
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
    const r = await apiService.getReportById(instance.id);

    if (r) {
      currentReportId.value = r.id;
      currentTemplateId.value = r.templateId;
      templateName.value = r.name;

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
    await apiService.deleteReport(instance.id);
    await fetchReports();
  } catch (e) {
    alert('ลบรายงานล้มเหลว: ' + e.message);
  }
};

const handleUrlImport = async (url) => {
  if (!url) return;
  try {
    showNotification('กำลังดาวน์โหลดไฟล์จากลิงก์...', 'info');

    const data = await apiService.importPdfFromUrl(url);
    const newPdfId = data.OriginalFileId || data.id;

    if (!newPdfId) {
      throw new Error('ไม่ได้รับ File ID จาก Server');
    }

    const workspaceData = await apiService.prepareWorkspace(newPdfId);
    await resetCanvas();

    if (workspaceData.editState) {
      let parsedState = workspaceData.editState;
      while (typeof parsedState === 'string') parsedState = JSON.parse(parsedState);
      pages.value = parsedState;
    } else {
      const blobData = await apiService.downloadBlob(workspaceData.tempPath);
      const downloadedFile = new File([blobData], 'imported_from_url.pdf', {
        type: 'application/pdf'
      });
      const images = await processPdfToImages(downloadedFile);
      if (images.length > 0) {
        pages.value = images.map((imgObj, idx) => ({
          id: Date.now() + idx,
          background: imgObj.dataUrl,
          width: imgObj.width,
          height: imgObj.height,
          objects: [],
          originalBackgroundType: 'PDF'
        }));
      }
    }

    currentPageIndex.value = 0;
    templateName.value =
      url
        .split('/')
        .pop()
        ?.replace(/\.pdf$/i, '') || 'imported';

    window.history.pushState({}, '', `/pdf/${newPdfId}`);

    await nextTick();
    await renderAllPages();
    showNotification('นำเข้าไฟล์สำเร็จ!', 'success');
  } catch (error) {
    console.error('URL Import Error:', error);
    alert('ไม่สามารถดาวน์โหลด PDF จาก URL นี้ได้: ' + error.message);
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
  addSignatureBlockToCanvas,
  setHistoryContext,
  isRemoteUpdating,
  updateCanvasDimensions,
  relinkSignatures,
  setCallbacks: setCanvasCallbacks,
  dispose: disposeCanvas
} = useCanvas();

const canvasHelpers = { resetHistory, saveHistory, setHistoryLock };

const { layers, updateLayers } = useLayers();

const handleSelectLayer = (rawObj) => {
  if (!canvas.value) return;

  const rawCanvas = toRaw(canvas.value);
  const currentActive = rawCanvas.getActiveObject();

  if (currentActive && currentActive.isEditing) {
    currentActive.exitEditing();
  }

  const obj = toRaw(rawObj);

  if (obj) {
    if (toRaw(currentActive) === obj) return;

    rawCanvas.discardActiveObject();
    rawCanvas.setActiveObject(obj);
    rawCanvas.requestRenderAll();
    rawCanvas.fire('selection:created', { selected: [obj] });

    updateLayers(rawCanvas);
  }
};

watch(
  canvas,
  (newCanvas) => {
    if (newCanvas) {
      const updateLayersCb = () => updateLayers(newCanvas);
      newCanvas.on('object:added', updateLayersCb);
      newCanvas.on('object:removed', updateLayersCb);
      newCanvas.on('object:modified', updateLayersCb);
      newCanvas.on('selection:created', updateLayersCb);
      newCanvas.on('selection:cleared', updateLayersCb);
      newCanvas.on('selection:updated', updateLayersCb);
    }
  },
  { immediate: true }
);

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

  unifiedSave,
  handleUnifiedImport,
  ensureFileHandle,
  processPdfToImages,
  saveFileWithFallback,
  setTemplateCallbacks
} = useTemplate(canvas, zoomLevel, canvasHelpers);

if (setHistoryContext) setHistoryContext(pages, currentPageIndex);

const originalTemplateBackup = ref(null);

const { initCanvasEvents } = useCanvasEvents(
  canvas,
  pages,
  currentPageIndex,
  saveHistory,
  setHistoryLock
);
const { generateHybridPdfBlob, captureCanvasPageSafe } = useEditablePdf();

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
    await saveTemplate(false);
    await editorStore.fetchTemplates();
    saveHistory();
  } catch (e) {
    console.error('Save Template failed:', e);
  }
};

const handleReset = async () => {
  const fileIdToReset = window.location.pathname.split('/').pop();

  if (!fileIdToReset || fileIdToReset === 'pdf') {
    showNotification('ไม่พบ ID สำหรับการรีเซ็ต', 'error');
    return;
  }

  const confirmed = confirm('ข้อมูลทั้งหมดที่เคยแก้ไขจะหายไปทั้งหมด แน่ใจหรือไม่?');

  if (confirmed) {
    try {
      showNotification('กำลังรีเซ็ตข้อมูล...', 'info');
      await apiService.resetToOriginal(fileIdToReset);
      alert('รีเซ็ตสำเร็จ! ระบบกำลังโหลดไฟล์ต้นฉบับใหม่...');
      window.location.reload();
    } catch (error) {
      console.error('Reset failed:', error);
      const errorMsg = error.response?.data?.error || 'เกิดข้อผิดพลาดในการรีเซ็ตข้อมูล';
      alert(`${errorMsg}`);
      showNotification('รีเซ็ตไม่สำเร็จ', 'error');
    }
  }
};

const getWorkspaceMaxWidth = () => {
  let globalMaxWidth = 0;
  (pages.value || []).forEach((p) => {
    const w = Number(p.width) || CANVAS_CONSTANTS.PAGE_WIDTH;
    if (w > globalMaxWidth) globalMaxWidth = w;
  });
  return globalMaxWidth;
};

const getPageLeftOffset = (pWidth) => {
  return (getWorkspaceMaxWidth() - (Number(pWidth) || CANVAS_CONSTANTS.PAGE_WIDTH)) / 2;
};

const getPageTopOffset = (index) => {
  let offset = 0;
  for (let i = 0; i < index; i++) {
    const p = pages.value[i] || {};
    offset += (Number(p.height) || CANVAS_CONSTANTS.PAGE_HEIGHT) + CANVAS_CONSTANTS.PAGE_GAP;
  }
  return offset;
};

const getPageIndexFromTop = (y) => {
  let offset = 0;
  for (let i = 0; i < pages.value.length; i++) {
    const p = pages.value[i] || {};
    const h = Number(p.height) || CANVAS_CONSTANTS.PAGE_HEIGHT;
    if (y >= offset && y < offset + h + CANVAS_CONSTANTS.PAGE_GAP) return i;
    offset += h + CANVAS_CONSTANTS.PAGE_GAP;
  }
  return Math.max(0, pages.value.length - 1);
};

const handleSaveProject = async () => {
  if (!canvas.value) return;

  const pathSegments = window.location.pathname.split('/');
  const fileIdToSave = pathSegments[pathSegments.length - 1];

  if (!fileIdToSave || fileIdToSave === 'undefined' || fileIdToSave === 'pdf') {
    showNotification('ไม่พบ ID ของไฟล์ในระบบ (Cannot find OriginalFileId)', 'error');
    return;
  }

  try {
    showExportOverlay('กำลังบันทึกโปรเจกต์...', pages.value.length + 2);
    updateExportProgress(0, 'กำลังเตรียมข้อมูล...');
    saveCurrentPageState();

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
        realData.forEach((item) => {
          if (item.key) variableMap[item.key] = item.value || '';
        });
      }
    } catch (error) {
      if (variables.value) {
        variables.value.forEach((v) => {
          if (v.key) variableMap[v.key] = v.value || `{{${v.key}}}`;
        });
      }
    }

    const canvasImages = [];
    const P_H = CANVAS_CONSTANTS.PAGE_HEIGHT;
    const GAP = CANVAS_CONSTANTS.PAGE_GAP;
    const qualityMultiplier = 2;
    const TEXT_TYPES = ['textbox', 'text', 'i-text'];
    const OVERLAY_TYPES = ['textbox', 'text', 'i-text', 'image'];

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

      for (let i = 0; i < pages.value.length; i++) {
        const allObjects = canvas.value.getObjects();
        const hiddenForCapture = [];

        allObjects.forEach((obj) => {
          const center = obj.getCenterPoint();
          const objPageIndex = getPageIndexFromTop(center.y);
          const isWrongPage = objPageIndex !== i;
          const isBackground = obj.id === 'page-bg-image' || obj.id === 'page-bg';
          const isOverlay = OVERLAY_TYPES.includes(obj.type) && !isBackground;

          let shouldHide = false;
          if (pdfMode.value === 'flatten') shouldHide = isWrongPage;
          else shouldHide = isWrongPage || isOverlay;

          if (shouldHide && obj.visible) {
            obj.visible = false;
            hiddenForCapture.push(obj);
          }
        });

        canvas.value.renderAll();
        const topOffset = getPageTopOffset(i);
        const pageData = pages.value[i] || {};
        const pWidth = Number(pageData.width) || CANVAS_CONSTANTS.PAGE_WIDTH;
        const pHeight = Number(pageData.height) || CANVAS_CONSTANTS.PAGE_HEIGHT;
        const offsetLeftCanvas = getPageLeftOffset(pWidth);

        const imgDataUrl = await captureCanvasPageSafe(
          canvas.value,
          offsetLeftCanvas,
          topOffset,
          pWidth,
          pHeight,
          qualityMultiplier
        );

        if (imgDataUrl) {
          canvasImages.push(imgDataUrl);
        } else {
          console.warn(`Fallback for bounding page ${i + 1}`);
          const fallbackCanvas = document.createElement('canvas');
          fallbackCanvas.width = pWidth * qualityMultiplier;
          fallbackCanvas.height = pHeight * qualityMultiplier;
          const fallbackCtx = fallbackCanvas.getContext('2d');
          fallbackCtx.fillStyle = '#ffffff';
          fallbackCtx.fillRect(0, 0, fallbackCanvas.width, fallbackCanvas.height);
          canvasImages.push(fallbackCanvas.toDataURL('image/jpeg', 0.92));
        }
        hiddenForCapture.forEach((obj) => {
          obj.visible = true;
        });

        updateExportProgress(i + 1, `กำลังประมวลผลหน้า ${i + 1} / ${pages.value.length}`);
        await yieldToMain();
      }
      canvas.value.requestRenderAll();

      if (canvasImages.length === 0) throw new Error('ไม่สามารถประมวลผลหน้ากระดาษเป็นรูปภาพได้');

      const exportProjectData = JSON.parse(JSON.stringify(projectData));
      const liveObjects = canvas.value.getObjects();

      exportProjectData.pages.forEach((page, pageIndex) => {
        if (page.objects) {
          page.objects.forEach((jsonObj) => {
            if (['textbox', 'text', 'i-text'].includes(jsonObj.type)) {
              const liveObj = liveObjects.find((o) => {
                if (o.id && jsonObj.id && o.id === jsonObj.id) return true;
                const expectedTop = jsonObj.top + getPageTopOffset(pageIndex);
                return Math.abs(o.left - jsonObj.left) < 5 && Math.abs(o.top - expectedTop) < 5;
              });
              if (liveObj) {
                if (liveObj.textLines && liveObj.textLines.length > 0) {
                  const cleanLines = liveObj.textLines.map((line) =>
                    (typeof line === 'string' ? line : '').replace(/\u200B/g, '').trimEnd()
                  );
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

      updateExportProgress(pages.value.length + 1, 'กำลังสร้าง PDF...');
      await yieldToMain();

      const pdfBlob = await generateHybridPdfBlob(
        canvasImages,
        exportProjectData,
        variableMap,
        null,
        'report',
        pdfMode.value
      );

      updateExportProgress(pages.value.length + 2, 'กำลังบันทึกไปยังเซิร์ฟเวอร์...');
      await yieldToMain();

      const formData = new FormData();
      formData.append('OriginalFileId', fileIdToSave);
      formData.append('editState', JSON.stringify(pages.value));
      formData.append('pdfFile', pdfBlob, `edited_${fileIdToSave}.pdf`);

      const savedData = await apiService.savePdfState(formData);

      if (savedData) {
        showNotification('บันทึกโปรเจกต์ลง Database พร้อมฝัง PDF เรียบร้อย!', 'success');
        console.log('Database state saved/updated successfully!');

        try {
          const historyPayload = {
            name: templateName.value || 'โปรเจกต์ที่บันทึกแล้ว',
            pages: pages.value,
            data: JSON.stringify(pages.value),
            pdfUrl: savedData.filepath || null,
            templateId: currentTemplateId.value || null
          };
          await apiService.createReport(historyPayload);

          if (typeof fetchReports === 'function') fetchReports();
        } catch (err) {
          console.error('Failed to log database save to history', err);
        }
      }

      saveHistory();
    } finally {
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
    showNotification('เกิดข้อผิดพลาดในการบันทึกโปรเจกต์: ' + e.message, 'error');
  } finally {
    hideExportOverlay();
  }
};

const handleExport = async () => {
  if (!canvas.value) return;

  try {
    saveCurrentPageState();
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
        realData.forEach((item) => {
          if (item.key) {
            variableMap[item.key] = item.value || '';
          }
        });
      }
    } catch (error) {
      console.warn('Failed to fetch live variables, using sidebar defaults:', error);
      if (variables.value) {
        variables.value.forEach((v) => {
          if (v.key) variableMap[v.key] = v.value || `{{${v.key}}}`;
        });
      }
    }

    const canvasImages = [];
    const P_H = CANVAS_CONSTANTS.PAGE_HEIGHT;
    const GAP = CANVAS_CONSTANTS.PAGE_GAP;
    const qualityMultiplier = 2;
    const TEXT_TYPES = ['textbox', 'text', 'i-text'];
    const OVERLAY_TYPES = ['textbox', 'text', 'i-text', 'image'];

    const wasPreview = isPreviewMode.value;
    const originalPage = currentPageIndex.value;

    try {
      showExportOverlay('กำลังส่งออก PDF...', pages.value.length + 2);
      updateExportProgress(0, 'กำลังเตรียมข้อมูล...');
      canvas.value.requestRenderAll();
      if (!wasPreview) saveCurrentPageState();
      isPreviewMode.value = true;
      await renderAllPages();
      await nextTick();
      applyPreviewDataToCanvas(variableMap);
      await nextTick();

      for (let i = 0; i < pages.value.length; i++) {
        const allObjects = canvas.value.getObjects();
        const hiddenForCapture = [];

        allObjects.forEach((obj) => {
          const center = obj.getCenterPoint();
          const objPageIndex = getPageIndexFromTop(center.y);
          const isWrongPage = objPageIndex !== i;

          const isBackground = obj.id === 'page-bg-image' || obj.id === 'page-bg';
          const isOverlay = OVERLAY_TYPES.includes(obj.type) && !isBackground;

          let shouldHide = false;
          if (pdfMode.value === 'flatten') {
            shouldHide = isWrongPage;
          } else {
            shouldHide = isWrongPage || isOverlay;
          }

          if (shouldHide && obj.visible) {
            obj.visible = false;
            hiddenForCapture.push(obj);
          }
        });

        canvas.value.renderAll();

        const topOffset = getPageTopOffset(i);
        const pageData = pages.value[i] || {};
        const pWidth = Number(pageData.width) || CANVAS_CONSTANTS.PAGE_WIDTH;
        const pHeight = Number(pageData.height) || CANVAS_CONSTANTS.PAGE_HEIGHT;
        const offsetLeftCanvas = getPageLeftOffset(pWidth);

        const imgDataUrl = await captureCanvasPageSafe(
          canvas.value,
          offsetLeftCanvas,
          topOffset,
          pWidth,
          pHeight,
          qualityMultiplier
        );

        if (imgDataUrl) {
          canvasImages.push(imgDataUrl);
        } else {
          console.warn(`Canvas taint/capture failure on page ${i + 1}, pushing fallback.`);
          const fallbackCanvas = document.createElement('canvas');
          fallbackCanvas.width = pWidth * qualityMultiplier;
          fallbackCanvas.height = pHeight * qualityMultiplier;
          const fallbackCtx = fallbackCanvas.getContext('2d');
          fallbackCtx.fillStyle = '#ffffff';
          fallbackCtx.fillRect(0, 0, fallbackCanvas.width, fallbackCanvas.height);
          canvasImages.push(fallbackCanvas.toDataURL('image/jpeg', 0.92));
        }

        hiddenForCapture.forEach((obj) => {
          obj.visible = true;
        });

        updateExportProgress(i + 1, `กำลังประมวลผลหน้า ${i + 1} / ${pages.value.length}`);
        await yieldToMain();
      }
      canvas.value.requestRenderAll();

      if (canvasImages.length === 0) throw new Error('ไม่สามารถประมวลผลหน้ากระดาษเป็นรูปภาพได้');

      const exportProjectData = JSON.parse(JSON.stringify(projectData));
      const liveObjects = canvas.value.getObjects();

      exportProjectData.pages.forEach((page, pageIndex) => {
        if (page.objects) {
          page.objects.forEach((jsonObj) => {
            if (['textbox', 'text', 'i-text'].includes(jsonObj.type)) {
              const liveObj = liveObjects.find((o) => {
                if (o.id && jsonObj.id && o.id === jsonObj.id) return true;
                const expectedTop = jsonObj.top + getPageTopOffset(pageIndex);
                return Math.abs(o.left - jsonObj.left) < 5 && Math.abs(o.top - expectedTop) < 5;
              });

              if (liveObj) {
                if (liveObj.textLines && liveObj.textLines.length > 0) {
                  const cleanLines = liveObj.textLines.map((line) => {
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

      updateExportProgress(pages.value.length + 1, 'กำลังสร้าง PDF...');
      await yieldToMain();

      const pdfBlob = await generateHybridPdfBlob(
        canvasImages,
        exportProjectData,
        variableMap,
        null,
        'report',
        pdfMode.value
      );

      updateExportProgress(pages.value.length + 2, 'กำลังบันทึกไฟล์...');
      await yieldToMain();

      const defaultFileName = `${templateName.value || 'report'}.pdf`;
      const saveResult = await saveFileWithFallback(pdfBlob, defaultFileName);

      if (!saveResult.success) {
        if (saveResult.aborted) {
          return;
        }
        throw new Error('Save failed');
      }

      const newHandle = saveResult.handle;
      if (newHandle) {
        currentFileHandle.value = newHandle;
      }

      try {
        const finalName = templateName.value || 'Untitled Report';

        const historyPayload = {
          name: finalName,
          pages: pages.value,
          data: JSON.stringify(pages.value),
          pdfUrl: newHandle ? newHandle.name : defaultFileName,
          templateId: currentTemplateId.value || null
        };

        const result = await apiService.createReport(historyPayload);

        if (result && result.id) {
          currentReportId.value = result.id;
        }

        showNotification('ส่งออก PDF และบันทึกประวัติสำเร็จ!', 'success');
        if (typeof fetchReports === 'function') fetchReports();
      } catch (e) {
        console.error('Failed to log export history:', e);
        showNotification('ส่งออก PDF สำเร็จ แต่บันทึกประวัติลง Database ล้มเหลว', 'warning');
      }

      saveHistory();
    } finally {
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
  } finally {
    hideExportOverlay();
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
  triggerTempCleanup();

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

const handleAddSignatureBlock = (sigData) => {
  if (!canvas.value) return;
  const targetTop = getPageTopOffset(currentPageIndex.value) + 100;
  const targetLeft = getWorkspaceMaxWidth() / 2;

  addSignatureBlockToCanvas(sigData, targetLeft, targetTop);
};

const handleAddVariable = (key) => {
  if (!canvas.value) return;
  const targetTop = getPageTopOffset(currentPageIndex.value) + 100;
  const targetLeft = getWorkspaceMaxWidth() / 2;

  addVariableToCanvas(key, targetLeft - 100, targetTop);
};

const addImageToCanvasWrapper = (url) => {
  if (!url) return;
  const targetTop = getPageTopOffset(currentPageIndex.value) + 100;
  const targetLeft = getWorkspaceMaxWidth() / 2;

  addImageToCanvas(url, targetLeft - 100, targetTop);
};

const cleanupCanvasObjects = () => {
  if (!canvas.value) return;

  const objects = canvas.value.getObjects();
  let cleanedCount = 0;

  objects.forEach((obj) => {
    try {
      if (obj.clipPath) {
        if (obj.clipPath.dispose && typeof obj.clipPath.dispose === 'function') {
          obj.clipPath.dispose();
        }
        obj.clipPath = null;
      }

      if (obj.off && typeof obj.off === 'function') {
        obj.off();
      }

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
    cleanupCanvasObjects();

    if (!pages.value || !Array.isArray(pages.value) || pages.value.length === 0) {
      pages.value = [{ id: 0, background: null, objects: [] }];
    }
    const currentPages = pages.value;

    canvas.value.discardActiveObject();
    canvas.value.clear();
    canvas.value.setBackgroundColor(null, () => {});

    const actualZoom = zoomLevel.value || 1;

    let currentY = 0;
    let maxWidth = 0;

    for (let i = 0; i < currentPages.length; i++) {
      const p = currentPages[i];
      const w = Number(p.width) || CANVAS_CONSTANTS.PAGE_WIDTH;
      if (w > maxWidth) maxWidth = w;
    }

    const objects = canvas.value.getObjects();
    const oldBgs = objects.filter(
      (o) => o.id === 'page-bg' || o.id === 'page-bg-image' || o.id === 'page-divider'
    );
    oldBgs.forEach((bg) => canvas.value.remove(bg));

    for (let i = 0; i < currentPages.length; i++) {
      const page = currentPages[i];
      const pWidth = Number(page.width) || CANVAS_CONSTANTS.PAGE_WIDTH;
      const pHeight = Number(page.height) || CANVAS_CONSTANTS.PAGE_HEIGHT;
      const offsetTop = currentY;
      const offsetLeft = getPageLeftOffset(pWidth);

      const bgRect = new fabric.Rect({
        id: 'page-bg',
        left: offsetLeft,
        top: offsetTop,
        width: pWidth,
        height: pHeight,
        fill: '#ffffff',
        selectable: false,
        evented: false,
        excludeFromExport: true
      });
      canvas.value.add(bgRect);
      canvas.value.sendToBack(bgRect);

      if (page.dataUrl || page.background) {
        const urlToLoad = page.dataUrl || page.background;
        await new Promise((resolve) => {
          fabric.Image.fromURL(
            urlToLoad,
            (img) => {
              img.set({
                id: 'page-bg-image',
                left: offsetLeft,
                top: offsetTop,
                scaleX: pWidth / img.width,
                scaleY: pHeight / img.height,
                selectable: false,
                evented: false
              });
              canvas.value.add(img);
              canvas.value.moveTo(img, 1);
              resolve();
            },
            { crossOrigin: 'anonymous' }
          );
        });
      }

      currentY += pHeight + CANVAS_CONSTANTS.PAGE_GAP;

      if (page.objects && page.objects.length > 0) {
        await new Promise((resolve) => {
          const rawObjects = JSON.parse(JSON.stringify(page.objects));
          const objectsToLoad = rawObjects.map((obj) => cleanFabricObject(obj));

          fabric.util.enlivenObjects(objectsToLoad, (objs) => {
            const imageReloadPromises = [];

            objs.forEach((obj) => {
              if (obj.id === 'page-bg' || obj.id === 'page-bg-image') return;
              obj.set({ top: obj.top + offsetTop, left: obj.left + offsetLeft, _pageIndex: i });

              obj.clipPath = new fabric.Rect({
                left: offsetLeft,
                top: offsetTop,
                width: pWidth,
                height: pHeight,
                absolutePositioned: true
              });

              if (['text', 'i-text', 'textbox'].includes(obj.type)) obj.set('objectCaching', true);
              canvas.value.add(obj);
              forceUnlockObject(obj);

              if (obj.type === 'image' && obj.getSrc && obj.getSrc().startsWith('http')) {
                const src = obj.getSrc();
                const p = new Promise((imgResolve) => {
                  fabric.Image.fromURL(
                    src,
                    (freshImg) => {
                      if (freshImg._element) {
                        obj.setElement(freshImg._element);
                        obj.dirty = true;
                      } else {
                        console.warn(`Failed to load image: ${src} - No element returned`);
                      }
                      imgResolve();
                    },
                    {
                      crossOrigin: 'anonymous',
                      onError: (err) => {
                        console.error(`CORS/Network error loading image: ${src}`, err);
                        imgResolve();
                      }
                    }
                  );
                });
                imageReloadPromises.push(p);
              }
            });

            Promise.all(imageReloadPromises)
              .catch((err) => {
                console.error('Some images failed to load:', err);
              })
              .then(() => {
                if (canvas.value) canvas.value.requestRenderAll();
                resolve();
              });
          });
        });
      }
    }

    canvas.value.setWidth(maxWidth * actualZoom);
    canvas.value.setHeight(currentY * actualZoom);
    canvasBaseDimensions.value = { width: maxWidth, height: currentY };
    canvas.value.setZoom(actualZoom);

    canvas.value.requestRenderAll();
    document.fonts.ready.then(() => {
      if (canvas.value) canvas.value.requestRenderAll();
    });
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
  viewportRef.value.scrollTo({
    top: getPageTopOffset(index) * zoomLevel.value,
    behavior: 'smooth'
  });
  currentPageIndex.value = index;
};

const forceUnlockObject = (obj) => {
  if (!obj) return;
  const isText = ['i-text', 'textbox', 'text'].includes(obj.type);
  const isImage = obj.type === 'image';

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
    lockUniScaling: false
  });

  obj.setControlsVisibility({
    mt: isImage,
    mb: isImage,
    ml: true,
    mr: true,
    tl: true,
    tr: true,
    bl: true,
    br: true,
    mtr: true
  });

  if (isText) obj.set('editable', true);
  obj.setCoords();
};

const addCustomTextToCanvas = (x, y) => {
  if (!canvas.value) return;

  if (x === undefined || y === undefined) {
    let accumulatedTop = 0;
    for (let i = 0; i < currentPageIndex.value; i++) {
      accumulatedTop +=
        (pages.value[i].height || CANVAS_CONSTANTS.PAGE_HEIGHT) + CANVAS_CONSTANTS.PAGE_GAP;
    }
    if (y === undefined) y = accumulatedTop + 100;
    if (x === undefined)
      x = (pages.value[currentPageIndex.value]?.width || CANVAS_CONSTANTS.PAGE_WIDTH) / 2;
  }

  const text = new fabric.Textbox('พิมพ์ข้อความที่นี่...', {
    id: 'custom_text_' + Date.now(),
    left: x,
    top: y,
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

window.addCustomTextToCanvas = addCustomTextToCanvas;

let isSavingState = false;

const saveCurrentPageState = () => {
  if (isPreviewMode.value || !canvas.value || isSavingState) return;

  isSavingState = true;
  try {
    if (
      canvas.value &&
      canvas.value.getActiveObject() &&
      canvas.value.getActiveObject().type === 'activeSelection'
    ) {
      canvas.value.discardActiveObject();
    }

    const allObjects = canvas.value.getObjects();
    const GAP = CANVAS_CONSTANTS.PAGE_GAP;

    const pageObjectMap = pages.value.map(() => []);

    const pageBounds = [];
    let currentY = 0;
    for (let i = 0; i < pages.value.length; i++) {
      const pHeight = Number(pages.value[i].height) || CANVAS_CONSTANTS.PAGE_HEIGHT;
      pageBounds.push({
        top: currentY,
        bottom: currentY + pHeight + GAP
      });
      currentY += pHeight + GAP;
    }

    allObjects.forEach((obj) => {
      if (!obj || obj.id === 'page-bg' || obj.id === 'page-bg-image') return;
      if (typeof obj.top !== 'number' || isNaN(obj.top)) return;

      const center = obj.getCenterPoint();
      const actualCenterY = center.y;

      let pageIndex = 0;
      for (let i = 0; i < pageBounds.length; i++) {
        if (actualCenterY >= pageBounds[i].top && actualCenterY < pageBounds[i].bottom) {
          pageIndex = i;
          break;
        }
        if (i === pageBounds.length - 1 && actualCenterY >= pageBounds[i].bottom) {
          pageIndex = i;
        }
      }

      if (pageIndex < 0) pageIndex = 0;
      if (pageIndex >= pages.value.length) pageIndex = pages.value.length - 1;

      try {
        const serialized = obj.toObject([
          'id',
          'selectable',
          'name',
          'data',
          'textBaseline',
          'angle'
        ]);
        const pageTopY = pageBounds[pageIndex].top;

        const targetPageWidth =
          Number(pages.value[pageIndex]?.width) || CANVAS_CONSTANTS.PAGE_WIDTH;
        const pageOffsetLeft = (getWorkspaceMaxWidth() - targetPageWidth) / 2;

        serialized.left = Math.round((obj.left - pageOffsetLeft) * 100) / 100;
        serialized.top = Math.round((obj.top - pageTopY) * 100) / 100;
        serialized.width = Math.round((obj.width || 0) * 100) / 100;
        serialized.height = Math.round((obj.height || 0) * 100) / 100;

        if (serialized.textBaseline === 'alphabetical') serialized.textBaseline = 'alphabetic';
        pageObjectMap[pageIndex].push(serialized);
      } catch (e) {
        console.error('Failed to serialize object:', e);
      }
    });

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

const togglePreviewWrapper = async () => {
  saveCurrentPageState();
  const wasPreview = isPreviewMode.value;

  try {
    if (!wasPreview) {
      const textObjects = canvas.value
        .getObjects()
        .filter((obj) => ['textbox', 'text', 'i-text'].includes(obj.type) && obj.text);

      originalTemplateBackup.value = textObjects.map((obj) => ({
        id: obj.id || `${obj.type}_${obj.left}_${obj.top}`,
        text: obj.text,
        editable: obj.editable,
        selectable: obj.selectable,
        evented: obj.evented
      }));

      const previewVariableMap = {};
      try {
        const realData = await apiService.getVariables();
        if (Array.isArray(realData)) {
          realData.forEach((item) => {
            if (item.key) previewVariableMap[item.key] = item.value || '';
          });
        }
      } catch (error) {
        console.warn('Failed to fetch preview data from DB:', error);
      }

      togglePreview();
      await nextTick();
      applyPreviewDataToCanvas(previewVariableMap);
    } else {
      togglePreview();
      await nextTick();

      if (canvas.value && originalTemplateBackup.value) {
        canvas.value.selection = true;
        canvas.value.getObjects().forEach((obj) => {
          if (['textbox', 'text', 'i-text'].includes(obj.type)) {
            const objId = obj.id || `${obj.type}_${obj.left}_${obj.top}`;
            const backup = originalTemplateBackup.value.find((t) => t.id === objId);

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
        originalTemplateBackup.value = null;
      }

      if (canvas.value) canvas.value.selection = true;
      await renderAllPages();
    }
  } catch (error) {
    console.error('Preview toggle failed:', error);
    try {
      if (!wasPreview && originalTemplateBackup.value) {
        togglePreview();
        isPreviewMode.value = false;
        originalTemplateBackup.value = null;
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
        (o.type === 'rect' && o.fill === '#ffffff' && !o.selectable && o.width > 300)
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

      const existingPage = pages.value[index] || {};

      return {
        id: recoveredId,
        background: bgImg ? bgImg.getSrc() : null,
        width: rect.width || existingPage.width || CANVAS_CONSTANTS.PAGE_WIDTH,
        height: rect.height || existingPage.height || CANVAS_CONSTANTS.PAGE_HEIGHT,
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
    const rect = canvasContainer
      ? canvasContainer.getBoundingClientRect()
      : e.currentTarget
        ? e.currentTarget.getBoundingClientRect()
        : { left: 0, top: 0 };
    x = e.clientX - rect.left;
    y = e.clientY - rect.top;
    if (typeof zoomLevel !== 'undefined' && zoomLevel.value) {
      x = x / zoomLevel.value;
      y = y / zoomLevel.value;
    }
  }

  if (variable && typeof addVariableToCanvas !== 'undefined') addVariableToCanvas(variable, x, y);
  if (asset && typeof addImageToCanvas !== 'undefined') addImageToCanvas(asset, x, y);
  const customText = e.dataTransfer.getData('customText');
  if (customText) addCustomTextToCanvas(x, y);

  const type = e.dataTransfer.getData('type');

  if (type === 'SIGNATURE_BLOCK') {
    const sigDataStr = e.dataTransfer.getData('sigData');
    console.log('[EditorView] ข้อมูลที่รับมาตอน Drop:', sigDataStr);

    if (sigDataStr) {
      try {
        const sigData = JSON.parse(sigDataStr);

        if (typeof addSignatureBlockToCanvas === 'function') {
          addSignatureBlockToCanvas(sigData, x, y);
        } else if (window.addSignatureBlockToCanvas) {
          window.addSignatureBlockToCanvas(sigData, x, y);
        } else {
          console.error(
            'หาฟังก์ชัน addSignatureBlockToCanvas ไม่เจอ! ลืม Return ออกมาจาก useCanvas.js หรือเปล่า?'
          );
        }
      } catch (error) {
        console.error('เกิดข้อผิดพลาดตอนประกอบข้อมูล:', error);
      }
    }
  }
};

const handleRouteChange = async () => {
  const fullHref = window.location.href;
  const directUrlMatch = fullHref.match(/\/(https?:\/\/.+)/i) || fullHref.match(/\/(https?:\/.+)/i);

  if (directUrlMatch && directUrlMatch[1]) {
    let externalUrl = directUrlMatch[1];
    if (externalUrl.startsWith('https:/') && !externalUrl.startsWith('https://'))
      externalUrl = externalUrl.replace('https:/', 'https://');
    if (externalUrl.startsWith('http:/') && !externalUrl.startsWith('http://'))
      externalUrl = externalUrl.replace('http:/', 'http://');

    try {
      const data = await apiService.importPdfFromUrl(externalUrl);

      const newPdfId = data.OriginalFileId || data.id || data.fileId;

      if (newPdfId) {
        window.history.replaceState({}, '', `/pdf/${newPdfId}`);
        window.location.reload();
        return;
      }
    } catch (error) {
      console.error('Direct URL Import Failed:', error);
      alert('ไม่สามารถดึงไฟล์จากลิงก์ที่ระบุได้ (นำเข้าไม่สำเร็จ)');
    }
  }

  const decodedPath = decodeURIComponent(window.location.pathname);
  const localPathMatch = decodedPath.match(/^\/(["']?[A-Za-z]:[\\/].+)/);

  if (localPathMatch && localPathMatch[1]) {
    const localPath = localPathMatch[1];
    try {
      const data = await apiService.importPdfLocal(localPath);

      const newPdfId = data.OriginalFileId || data.id;
      if (newPdfId) {
        window.history.replaceState({}, '', `/pdf/${newPdfId}`);
        window.location.reload();
        return;
      }
    } catch (error) {
      console.error('Local Import Failed:', error);
      alert('ไม่สามารถดึงไฟล์จากเครื่องได้ (ตรวจสอบว่าไฟล์มีอยู่จริง)');
    }
  }

  const currentPath = window.location.pathname;

  const urlParams = new URLSearchParams(window.location.search);
  const originalUrlParam = urlParams.get('originalUrl');

  const openMatch = currentPath.match(/^\/path\/(.+)/i);
  let filepathParam = openMatch ? decodeURIComponent(openMatch[1]) : urlParams.get('filepath');

  if (filepathParam) {
    filepathParam = '/' + filepathParam.replace(/^\/+/, '');

    try {
      const blobData = await apiService.downloadBlob(filepathParam);

      const filename = originalUrlParam || filepathParam.split('/').pop() || 'document.pdf';
      const downloadedFile = new File([blobData], filename, { type: 'application/pdf' });

      if (typeof resetCanvasWrapper === 'function') await resetCanvasWrapper();
      else if (typeof resetCanvas === 'function') await resetCanvas();

      const images = await processPdfToImages(downloadedFile);
      if (images.length > 0) {
        pages.value = images.map((imgObj, idx) => ({
          id: Date.now() + idx,
          background: imgObj.dataUrl,
          width: imgObj.width,
          height: imgObj.height,
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

  const pdfMatch = currentPath.match(/^\/pdf\/([a-zA-Z0-9-]+)/i);
  if (pdfMatch && pdfMatch[1]) {
    const fileId = pdfMatch[1];

    activePdfId = fileId;

    try {
      const backendUrl = apiService.getBackendBase();

      const workspaceData = await apiService.prepareWorkspace(fileId);
      const tempUrl = `${backendUrl}${workspaceData.tempPath}`;

      if (workspaceData.editState) {
        try {
          pdfUrl.value = tempUrl;
          let parsedState = workspaceData.editState;
          while (typeof parsedState === 'string') {
            parsedState = JSON.parse(parsedState);
          }
          pages.value = parsedState;
          currentPageIndex.value = 0;
          await nextTick();
          setTimeout(async () => {
            if (typeof renderAllPages === 'function') await renderAllPages();
          }, 500);
        } catch (e) {
          console.error('Restoration Error', e);
        }
      } else {
        const blobData = await apiService.downloadBlob(workspaceData.tempPath);
        const downloadedFile = new File([blobData], 'workspace_document.pdf', {
          type: 'application/pdf'
        });

        await resetCanvasWrapper();
        const images = await processPdfToImages(downloadedFile);
        if (images.length > 0) {
          pages.value = images.map((imgObj, idx) => ({
            id: Date.now() + idx,
            background: imgObj.dataUrl,
            width: imgObj.width,
            height: imgObj.height,
            objects: [],
            originalBackgroundType: 'PDF'
          }));
          currentPageIndex.value = 0;
          await renderAllPages();
        }
      }
    } catch (error) {
      console.error('Failed to load PDF into workspace:', error);
      alert('Could not load the requested PDF.');
    }
    return;
  }

  const templateMatch = currentPath.match(/^\/template\/([a-zA-Z0-9-]+)/i);
  if (templateMatch && templateMatch[1]) {
    const templateId = templateMatch[1];
    try {
      const templateData = await apiService.getTemplateById(templateId);

      await loadTemplateWrapper(templateData);
    } catch (error) {
      console.error('Failed to load template from URL:', error);
    }
    return;
  }

  const historyMatch = currentPath.match(/^\/history\/([a-zA-Z0-9-]+)/i);
  if (historyMatch && historyMatch[1]) {
    const instanceId = historyMatch[1];
    try {
      const r = await apiService.getReportById(instanceId);
      if (r) {
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
      }
    } catch (error) {
      console.error('Failed to load history instance from URL:', error);
    }
    return;
  }

  if (currentPath === '/' || currentPath === '') {
    try {
      if (typeof resetCanvasWrapper === 'function') {
        await resetCanvasWrapper();
      } else if (typeof resetCanvas === 'function') {
        await resetCanvas();
      } else if (typeof pages !== 'undefined') {
        pages.value = [{ id: Date.now(), background: null, objects: [] }];
        if (typeof currentPageIndex !== 'undefined') currentPageIndex.value = 0;
      }

      if (typeof editorStore !== 'undefined') {
        if (typeof editorStore.setActiveTemplate === 'function')
          editorStore.setActiveTemplate(null);
      }
    } catch (error) {
      console.error('Error resetting workspace on back navigation:', error);
    }
  }
};

const selectAllObjects = () => {
  if (!canvas.value) return;

  const objects = canvas.value
    .getObjects()
    .filter(
      (obj) => obj.id !== 'page-bg' && obj.id !== 'page-bg-image' && obj.selectable !== false
    );

  if (objects.length === 0) return;

  canvas.value.discardActiveObject();

  const selection = new fabric.ActiveSelection(objects, {
    canvas: canvas.value
  });

  canvas.value.setActiveObject(selection);
  canvas.value.requestRenderAll();
};

onMounted(async () => {
  await nextTick();
  initCanvas();
  isCanvasReady.value = true;
  initCanvasEvents();

  try {
    await fetchVariables();
    await fetchTemplates();
  } catch (error) {
    console.error('Failed to initialize store data:', error);
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

  setCanvasCallbacks({
    saveCurrentPageState,
    forceUnlockObject
  });
  setTemplateCallbacks({
    saveCurrentPageState,
    renderAllPages
  });

  if (!pages.value || pages.value.length === 0)
    pages.value = [{ id: 0, background: null, objects: [] }];
  renderAllPages();

  connectionStatus.value = 'connected';

  _wheelHandler = (e) => {
    if (e.ctrlKey) {
      e.preventDefault();
      zoomLevel.value = Math.max(0.1, Math.min(3, zoomLevel.value + (e.deltaY > 0 ? -0.1 : 0.1)));
    }
  };
  _scrollHandler = () => {
    if (!viewportRef.value) return;
    const newIndex = getPageIndexFromTop(viewportRef.value.scrollTop / zoomLevel.value);
    if (newIndex !== currentPageIndex.value && newIndex >= 0 && newIndex < pages.value.length)
      currentPageIndex.value = newIndex;
  };

  if (viewportRef.value) {
    viewportRef.value.addEventListener('wheel', _wheelHandler, { passive: false });
    viewportRef.value.addEventListener('scroll', _scrollHandler);
  }

  let clipboard = null;
  _keydownHandler = (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    const activeObj = canvas.value?.getActiveObject();

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') {
      if (activeObj && activeObj.isEditing) return;
      e.preventDefault();
      const objects = canvas.value
        .getObjects()
        .filter(
          (obj) => obj.id !== 'page-bg' && obj.id !== 'page-bg-image' && obj.selectable !== false
        );
      if (objects.length > 0) {
        canvas.value.discardActiveObject();
        const selection = new fabric.ActiveSelection(objects, { canvas: canvas.value });
        canvas.value.setActiveObject(selection);
        canvas.value.requestRenderAll();
      }
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      if (activeObj && activeObj.isEditing) return;
      e.preventDefault();
      if (e.shiftKey) {
        if (typeof redo === 'function') redo();
      } else {
        if (typeof undo === 'function') undo();
      }
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
      if (activeObj && activeObj.isEditing) return;
      e.preventDefault();
      if (typeof redo === 'function') redo();
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c') {
      if (activeObj && !activeObj.isEditing) {
        e.preventDefault();
        activeObj.clone((cloned) => {
          clipboard = cloned;
        });
      }
      return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') {
      if (clipboard && canvas.value) {
        e.preventDefault();
        clipboard.clone((clonedObj) => {
          canvas.value.discardActiveObject();
          clonedObj.set({
            left: clonedObj.left + 20,
            top: clonedObj.top + 20,
            evented: true,
            selectable: true
          });

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
  };
  window.addEventListener('keydown', _keydownHandler);
  window.addEventListener('beforeunload', triggerTempCleanup);
  window.addEventListener('popstate', () => {
    triggerTempCleanup();
  });
});

onUnmounted(() => {
  window.removeEventListener('popstate', handleRouteChange);
  window.removeEventListener('beforeunload', triggerTempCleanup);
  if (_keydownHandler) window.removeEventListener('keydown', _keydownHandler);
  triggerTempCleanup();

  if (typeof disposeCanvas === 'function') {
    disposeCanvas();
  }

  if (viewportRef.value) {
    if (_wheelHandler) viewportRef.value.removeEventListener('wheel', _wheelHandler);
    if (_scrollHandler) viewportRef.value.removeEventListener('scroll', _scrollHandler);
  }
});
</script>

<style scoped>
.viewport {
  position: fixed;
  left: 392px;
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
}

.floating-panel-anchor {
  position: fixed;
  top: 72px;
  left: 392px;
  right: 0;
  display: flex;
  justify-content: center;
  z-index: 50;
  pointer-events: none;
  transition: left 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.floating-panel-anchor > * {
  pointer-events: auto;
}

.floating-panel-anchor.sidebar-closed {
  left: 72px;
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
</style>
