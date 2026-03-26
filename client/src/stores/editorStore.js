import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { apiService } from '../services/apiService';
import { CANVAS_CONSTANTS } from '../constants/canvas';

import { v4 as uuidv4, validate as validateUuid } from 'uuid';

const getMachineId = () => {
  let id = localStorage.getItem('report_machine_id');
  if (!id || !validateUuid(id)) {
    id = uuidv4();
    localStorage.setItem('report_machine_id', id);
  }
  return id;
};

export const useEditorStore = defineStore('editor', () => {
  const variables = ref([]);
  const templates = ref([]);
  const pages = ref([{ id: 0, background: null, objects: [] }]);
  const currentPageIndex = ref(0);

  const currentTemplateId = ref(null);
  const currentReportId = ref(null);
  const templateName = ref('');
  const isPreviewMode = ref(false);
  const isSidebarOpen = ref(false);

  const groupedVariables = computed(() => {
    return variables.value.reduce((acc, curr) => {
      const cat = curr.category || 'General';
      (acc[cat] = acc[cat] || []).push(curr);
      return acc;
    }, {});
  });

  const fetchVariables = async () => {
    try {
      const data = await apiService.getVariables();
      variables.value = data;
    } catch (e) {
      console.error('Failed to load vars', e);
      variables.value = [
        { key: 'school_name', label: 'ชื่อโรงเรียน', scope: 'GLOBAL', category: 'Student Info' },
        { key: 'school_year', label: 'ปีการศึกษา', scope: 'GLOBAL', category: 'Student Info' },
        { key: 'student_name', label: 'ชื่อนักเรียน', scope: 'GLOBAL', category: 'Student Info' }
      ];
    }
  };

  const fetchTemplates = async () => {
    try {
      const machineId = getMachineId();
      const data = await apiService.getTemplates(machineId);
      templates.value = data;
    } catch (e) {
      console.error('Failed to fetch templates:', e);
    }
  };

  const addBlankPage = () => {
    const insertIndex = currentPageIndex.value + 1;
    pages.value.splice(insertIndex, 0, { id: Date.now(), background: null, objects: [] });
    currentPageIndex.value = insertIndex;
  };

  const deletePage = (index) => {
    pages.value.splice(index, 1);
    if (currentPageIndex.value >= pages.value.length) {
      currentPageIndex.value = Math.max(0, pages.value.length - 1);
    }
  };

  const resetState = () => {
    currentTemplateId.value = null;
    currentReportId.value = null;
    templateName.value = '';
    isPreviewMode.value = false;
    pages.value = [{ id: Date.now(), background: null, objects: [] }];
    currentPageIndex.value = 0;
  };

  return {
    variables,
    templates,
    pages,
    currentPageIndex,
    currentTemplateId,
    currentReportId,
    templateName,
    isPreviewMode,
    isSidebarOpen,

    groupedVariables,

    fetchVariables,
    fetchTemplates,
    addBlankPage,
    deletePage,
    resetState,
    getMachineId
  };
});
