import { ref, computed, nextTick } from 'vue';
import { storeToRefs } from 'pinia';
import axios from 'axios';
import * as pdfjsLib from 'pdfjs-dist';
import { fabric } from 'fabric';
import { useEditorStore } from '../stores/editorStore';
import { apiService } from '../services/apiService';
import { showNotification } from '../utils/notifications';
import { CANVAS_CONSTANTS } from '../constants/canvas';

export function useTemplate(canvas, zoomLevel, canvasHelpers = {}) {
  const { resetHistory, saveHistory, setHistoryLock } = canvasHelpers;
  const SERVER_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

  const editorStore = useEditorStore();
  const {
    variables,
    templates,
    pages,
    currentPageIndex,
    currentTemplateId,
    currentReportId,
    templateName,
    isPreviewMode,
    isSidebarOpen,
    groupedVariables
  } = storeToRefs(editorStore);

  const customVarName = ref('');
  const currentBackground = ref(null);
  const originalObjectStates = ref({});
  const isPagesSidebarOpen = ref(false);


  const cleanFabricObject = (obj) => {
    if (!obj) return obj;
    if (obj.textBaseline === 'alphabetical') obj.textBaseline = 'alphabetic';
    if (obj.styles && typeof obj.styles === 'object') {
      for (const lineKey in obj.styles) {
        const line = obj.styles[lineKey];
        for (const charKey in line) {
          const charStyle = line[charKey];
          if (charStyle && charStyle.textBaseline === 'alphabetical')
            charStyle.textBaseline = 'alphabetic';
        }
      }
    }
    if ((obj.type === 'group' || obj.type === 'activeSelection') && Array.isArray(obj.objects)) {
      obj.objects = obj.objects.map(cleanFabricObject);
    }
    obj.selectable = true;
    obj.evented = true;
    if (['textbox', 'text', 'i-text'].includes(obj.type)) {
      obj.editable = true;
    }
    return obj;
  };

  const sanitizePagesData = (rawPages) => {
    if (!Array.isArray(rawPages)) return [];
    return rawPages.map((page) => ({
      ...page,
      objects: (page.objects || []).map((obj) => cleanFabricObject(JSON.parse(JSON.stringify(obj))))
    }));
  };

  const preparePagesForSave = () => {
    return pages.value.map((page) => ({
      id: page.id,
      background: page.background,
      originalBackgroundType: page.originalBackgroundType,
      width: page.width,
      height: page.height,
      objects: page.objects.map((obj) => {
        const serialized = JSON.parse(JSON.stringify(obj));
        const clean = cleanFabricObject(serialized);
        clean.left = Math.round(clean.left * 100) / 100;
        clean.top = Math.round(clean.top * 100) / 100;
        clean.width = Math.round(clean.width * 100) / 100;
        clean.height = Math.round(clean.height * 100) / 100;
        return clean;
      })
    }));
  };

  const sanitizeTemplateName = (name) => {
    return (name || 'Untitled')
      .replace(/<[^>]*>/g, '')
      .trim()
      .substring(0, 50)
      .replace(/[^a-z0-9\u0E00-\u0E7F _-]/gi, '_');
  };

  const getMachineId = editorStore.getMachineId;

  const isWorkspaceEmpty = () => {
    if (!pages.value || pages.value.length === 0) return true;
    if (pages.value.length > 1) return false;
    const p = pages.value[0];
    return !p.background && (!p.objects || p.objects.length === 0);
  };

  const checkIsGeneratedPdf = async (file) => {
    try {
      const formData = new FormData();
      formData.append('image', file);
      const res = await axios.post(`${SERVER_URL}/check-pdf-type`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      return {
        id: res.data.id,
        type: res.data.type,
        embeddedLayout: res.data.embeddedLayout
      };
    } catch (e) {
      console.warn('Server Check PDF skipped/failed. Trying Client-side...', e);
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
      const metadata = await pdf.getMetadata();

      if (metadata && metadata.info) {
        const subject = metadata.info.Subject;
        if (subject && subject.startsWith('layout:')) {
          const base64Str = subject.substring(7);
          try {
            const binaryString = atob(base64Str);
            let jsonStr;

            if (binaryString.charCodeAt(0) === 0xFE && binaryString.charCodeAt(1) === 0xFF) {
              const buf = new Uint8Array(binaryString.length - 2);
              for (let i = 2; i < binaryString.length; i++) buf[i - 2] = binaryString.charCodeAt(i);
              jsonStr = new TextDecoder('utf-16be').decode(buf);
            } else {
              try {
                jsonStr = decodeURIComponent(escape(binaryString));
              } catch {
                jsonStr = binaryString;
              }
            }

            const layout = JSON.parse(jsonStr);
            return { embeddedLayout: layout };
          } catch (parseErr) {
            console.error('Failed to parse client-side layout:', parseErr);
          }
        }
      }
    } catch (clientErr) {
      console.error('Client-side PDF check failed:', clientErr);
    }

    return null;
  };

  const processPdfToImages = async (file) => {
    const images = [];
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument(arrayBuffer).promise;
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewportForImage = page.getViewport({ scale: 2 });
        const origViewport = page.getViewport({ scale: 1 });
        const cvs = document.createElement('canvas');
        cvs.width = viewportForImage.width;
        cvs.height = viewportForImage.height;
        await page.render({ canvasContext: cvs.getContext('2d'), viewport: viewportForImage }).promise;
        images.push({
            dataUrl: cvs.toDataURL('image/jpeg', 0.8),
            width: origViewport.width,
            height: origViewport.height
        });
      }
    } catch (e) {
      console.error(e);
      throw new Error('Failed to process PDF');
    }
    return images;
  };


  const fetchVariables = editorStore.fetchVariables;
  const fetchTemplates = editorStore.fetchTemplates;

  const saveReport = async (isSilent = false) => {
    if (!canvas.value) return;
    if (typeof window !== 'undefined' && window.saveCurrentPageState) window.saveCurrentPageState();

    const pagesData = preparePagesForSave();
    const payload = {
      id: currentReportId.value,
      templateId: currentTemplateId.value,
      name: templateName.value || 'Untitled Project',
      pages: pagesData,
      pageDimensions: pages.value.map(p => ({ width: p.width, height: p.height })),
      status: 'DRAFT'
    };

    try {
      const res = await axios.post(`${SERVER_URL}/save-report`, payload);
      currentReportId.value = res.data.id;
      if (!isSilent) alert('Project Saved Successfully');
    } catch (e) {
      alert('Save Project failed: ' + (e.response?.data?.error || e.message));
      throw e;
    }
  };

  const saveTemplate = async (isSilent = false) => {
    if (!canvas.value) return;
    if (typeof window !== 'undefined' && window.saveCurrentPageState) window.saveCurrentPageState();

    const pagesData = preparePagesForSave();
    const payload = {
      name: templateName.value || 'Untitled Template',
      pages: pagesData,
      pageDimensions: pages.value.map(p => ({ width: p.width, height: p.height })),
      userId: getMachineId()
    };

    try {
      if (currentTemplateId.value) {
        await apiService.updateTemplate(currentTemplateId.value, payload);
        if (!isSilent) {

          showNotification('Template Updated successfully!', 'success');
        }
      } else {
        const response = await apiService.saveTemplate(payload);
        const templateId = response?.data?.id || response?.id || response;
        currentTemplateId.value = typeof templateId === 'string' ? templateId : String(templateId || '');
        if (!isSilent) {

          showNotification('Template Saved successfully!', 'success');
        }
      }

    } catch (e) {
      const errorMsg = 'Save Template failed: ' + (e.response?.data || e.message);
      if (!isSilent) {
        showNotification(errorMsg, 'error');
      }
      console.error(errorMsg, e);
      throw e;
    }
  };

  const loadTemplate = async (t) => {
    if (!canvas.value) return;

    currentTemplateId.value = typeof (t._id || t.id) === 'string' ? (t._id || t.id) : String(t._id || t.id || '');
    currentReportId.value = null;
    templateName.value = t.name;
    isPreviewMode.value = false;
    originalObjectStates.value = {};

    try {
      if (t.pages && Array.isArray(t.pages) && t.pages.length > 0) {
        pages.value = sanitizePagesData(JSON.parse(JSON.stringify(t.pages)));
      } else {
        pages.value = [{ id: 0, background: t.background || null, objects: t.objects || [] }];
      }
      currentPageIndex.value = 0;
      if (resetHistory) resetHistory();

      if (typeof window !== 'undefined' && window.renderAllPages) {
        window.renderAllPages();
      }

      if (typeof window !== 'undefined' && window.history) {
        window.history.pushState({}, '', `/template/${currentTemplateId.value}`);
      }
    } catch (error) {
      console.error('Error loading template:', error);
    }
  };

  const loadReportById = async (id) => {
    try {
      const res = await axios.get(`${SERVER_URL}/reports/${id}?t=${Date.now()}`);
      if (res.data) {
        const r = res.data;
        currentReportId.value = r.id;
        currentTemplateId.value = r.templateId;
        templateName.value = r.name;
        if (r.pages && Array.isArray(r.pages)) {
          pages.value = sanitizePagesData(JSON.parse(JSON.stringify(r.pages)));
          currentPageIndex.value = 0;
        }
        if (resetHistory) resetHistory();
      }
    } catch (e) {
      throw e;
    }
  };

  const resetCanvas = async () => {
    if (!canvas.value) return;
    editorStore.resetState();
    originalObjectStates.value = {};
    canvas.value.clear();
    canvas.value.setBackgroundColor(null, null);
    if (resetHistory) resetHistory();
  };

  const togglePreview = (forceMode) => {
    isPreviewMode.value = forceMode !== undefined ? forceMode : !isPreviewMode.value;
    if (!canvas.value) return;
    canvas.value.discardActiveObject();
    canvas.value.requestRenderAll();
  };


  const addBlankPage = () => {
    if (pages.value.length > 0 && typeof window !== 'undefined' && window.saveCurrentPageState) {
      window.saveCurrentPageState();
    }
    editorStore.addBlankPage();
  };


  const deleteTemplate = async (id) => {
    if (!confirm('Delete this template?')) return;
    try {
      await apiService.deleteTemplate(id);
      await fetchTemplates();
      if (currentTemplateId.value === id) await resetCanvas();
      showNotification('Template deleted successfully', 'success');
    } catch (e) {
      showNotification('Delete failed: ' + (e.response?.data || e.message), 'error');
    }
  };

  const handleImportWorkspace = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';

    if (!isWorkspaceEmpty()) {
      if (!confirm('The workspace is not empty. Replace it?')) return;
    }

    await resetCanvas();

    if (file.type === 'application/pdf') {
      const metadata = await checkIsGeneratedPdf(file);
      let loaded = false;

      if (metadata && metadata.id) {
        if (metadata.type === 'report') {
          try {
            await loadReportById(metadata.id);
            loaded = true;
          } catch (err) {
            console.error('Report not found on server');
          }
        }
        if (!loaded) {
          try {
            const tRes = await axios.get(`${SERVER_URL}/templates/${metadata.id}?t=${Date.now()}`);
            if (tRes.data) {
              await loadTemplate(tRes.data);
              loaded = true;
            }
          } catch (err) {
            console.error('Template not found on server');
          }
        }
      }

      if (!loaded && metadata && metadata.embeddedLayout) {
        try {
          pages.value = sanitizePagesData(metadata.embeddedLayout);
          currentPageIndex.value = 0;
          loaded = true;
          alert('Original template not found. Loaded from PDF metadata (Editable).');
        } catch (err) {
          console.error('Failed to load embedded layout', err);
        }
      }

      if (loaded) {
        if (resetHistory) resetHistory();
        return;
      }

      try {
        const images = await processPdfToImages(file);
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
        }
      } catch (err) {
        alert('Failed to process PDF');
      }
    } else if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (f) => {
        pages.value[0].background = f.target.result;
        pages.value[0].originalBackgroundType = 'Picture';
      };
      reader.readAsDataURL(file);
      await new Promise((r) => setTimeout(r, 100));
    }
    if (resetHistory) resetHistory();
  };

  const handleImportAppend = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    e.target.value = '';

    if (pages.value.length > 0 && typeof window !== 'undefined' && window.saveCurrentPageState) {
      window.saveCurrentPageState();
    }

    const insertIndex = currentPageIndex.value + 1;
    let newPages = [];

    if (file.type === 'application/pdf') {
      const images = await processPdfToImages(file);
      newPages = images.map((imgObj, idx) => ({
        id: Date.now() + Math.random() + idx,
        background: imgObj.dataUrl,
        width: imgObj.width,
        height: imgObj.height,
        objects: [],
        originalBackgroundType: 'PDF'
      }));
    } else if (file.type.startsWith('image/')) {
      await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (f) => {
          newPages.push({
            id: Date.now(),
            background: f.target.result,
            objects: [],
            originalBackgroundType: 'Picture'
          });
          resolve();
        };
        reader.readAsDataURL(file);
      });
    }

    if (newPages.length > 0) {
      pages.value.splice(insertIndex, 0, ...newPages);
      currentPageIndex.value = insertIndex;
    }
  };

  const addCustomVariable = () => {
    const name = prompt('Enter variable name (letters, numbers, underscores only):');
    if (!name) return;
    const trimmed = name.trim();
    if (!trimmed) return;
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmed)) {
      alert(`Invalid variable name "${trimmed}". Use letters, numbers, and underscores only. Must start with a letter or underscore.`);
      return;
    }
    const alreadyExists = variables.value.some((v) => v.key === trimmed);
    if (alreadyExists) {
      alert(`Variable "${trimmed}" already exists.`);
      return;
    }
    variables.value.push({ category: 'Custom', label: trimmed, key: trimmed });
  };

  const togglePagesSidebar = () => {
    isPagesSidebarOpen.value = !isPagesSidebarOpen.value;
  };

  const getDefaultPageImage = (index) => {
    return `data:image/svg+xml;base64,${btoa('<svg width="79" height="112" xmlns="http://www.w3.org/2000/svg"><rect width="79" height="112" fill="white"/></svg>')}`;
  };


  const currentFileHandle = ref(null);

  const getFullProjectData = () => {
    return {
      name: templateName.value || 'Untitled Project',
      pages: preparePagesForSave(),
      version: '1.0',
      timestamp: new Date().toISOString(),
      type: 'hybrid-project'
    };
  };

  const unifiedSave = async (generatePdfFn, variableMap = null, isSilent = false) => {
    if (window.showSaveFilePicker && !currentFileHandle.value) {
      try {
        const options = {
          suggestedName: `${sanitizeTemplateName(templateName.value)}.pdf`
        };

        currentFileHandle.value = await window.showSaveFilePicker(options);
        if (currentFileHandle.value) {
          await generatePdfFn(canvasImages, projectData, variableMap);
          saveHistory();
        }
      } catch (err) {
        if (err.name === 'AbortError') return false;
        console.error('File picker failed:', err);
      }
      return;
    }

    try {
      const payload = {
        name: templateName.value || 'Untitled Template',
        pages: preparePagesForSave(),
        userId: getMachineId()
      };

      if (currentTemplateId.value) {
        await apiService.updateTemplate(currentTemplateId.value, payload);
        if (!isSilent) {

          showNotification('Template Updated successfully!', 'success');
        }
      } else {
        const response = await apiService.saveTemplate(payload);
        const templateId = response?.data?.id || response?.id || response;
        currentTemplateId.value = typeof templateId === 'string' ? templateId : String(templateId || '');
        if (!isSilent) {

          showNotification('Template Saved successfully!', 'success');
        }
      }
    } catch (e) {
      console.warn('Silent DB save failed:', e);

    }
  };

  const handleUnifiedImport = async (e) => {
    try {
      const [fileHandle] = await window.showOpenFilePicker({
        types: [
          {
            description: 'All Supported Configuration',
            accept: {
              'application/pdf': ['.pdf'],
              'application/json': ['.json', '.drt'],
              'image/*': ['.png', '.jpg', '.jpeg']
            }
          }
        ],
        multiple: false
      });

      const file = await fileHandle.getFile();
      currentFileHandle.value = fileHandle;

      if (!isWorkspaceEmpty()) {
        if (!confirm('Replace current workspace?')) return;
      }

      if (
        file.type === 'application/json' ||
        file.name.endsWith('.json') ||
        file.name.endsWith('.drt')
      ) {
        const text = await file.text();
        const data = JSON.parse(text);
        await loadProjectData(data, file.name);
        return;
      }

      if (file.type === 'application/pdf') {
        const formData = new FormData();
        formData.append('file', file);
        try {
          const res = await axios.post(`${SERVER_URL}/pdf/upload`, formData);
          const savedFileId = res.data.id;

          window.history.pushState({}, '', `/pdf/${savedFileId}`);
          window.location.reload();
        } catch (error) {
          console.error('Upload failed:', error);
        }
        return;
      }

      if (file.type.startsWith('image/')) {
        await resetCanvas();
        const reader = new FileReader();
        reader.onload = (f) => {
          pages.value = [
            {
              id: Date.now(),
              background: f.target.result,
              objects: [],
              originalBackgroundType: 'Picture'
            }
          ];
          currentPageIndex.value = 0;
        };
        reader.readAsDataURL(file);
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Import Failed', err);
        alert('Import Failed: ' + err.message);
      }
    }
  };

  const loadProjectData = async (data, filename) => {
    await resetCanvas();
    templateName.value = data.name || filename.replace(/\.(json|pdf|drt)$/i, '');
    currentTemplateId.value = null;
    currentReportId.value = null;
    isPreviewMode.value = false;

    if (data.pages) {
      pages.value = sanitizePagesData(data.pages);
    }
    currentPageIndex.value = 0;
    if (resetHistory) resetHistory();
  };

  const ensureFileHandle = async () => {
    if (window.showSaveFilePicker && !currentFileHandle.value) {
      try {
        const options = {
          suggestedName: `${sanitizeTemplateName(templateName.value)}.pdf`,
          types: [
            {
              description: 'Hybrid PDF Project',
              accept: { 'application/pdf': ['.pdf'] }
            }
          ]
        };
        currentFileHandle.value = await window.showSaveFilePicker(options);
        return !!currentFileHandle.value;
      } catch (err) {
        if (err.name === 'AbortError') return false;
        console.error('File picker failed:', err);
        return false;
      }
    }
    return true;
  };

  return {
    variables,
    templates,
    customVarName,
    templateName,
    currentBackground,
    currentTemplateId,
    currentReportId,
    isPreviewMode,
    originalObjectStates,
    pages,
    currentPageIndex,
    isSidebarOpen,
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
    togglePagesSidebar,
    getDefaultPageImage,
    cleanFabricObject,
    preparePagesForSave,
    sanitizePagesData,
    currentFileHandle,
    isPagesSidebarOpen,
    unifiedSave,
    handleUnifiedImport,
    ensureFileHandle,
    processPdfToImages

  };
}
