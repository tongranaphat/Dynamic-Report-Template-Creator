<template>
  <aside class="sidebar-container" @mouseleave="handleMouseLeave">
    <!-- 1. Vertical Rail (Always Visible) -->
    <div class="sidebar-rail">
      <div class="rail-items">
        <button @click="handleTabClick('templates')" @mouseenter="handleMouseEnter('templates')"
          :class="['rail-btn', { active: activeTab === 'templates' && isOpen, pinned: isPinned && activeTab === 'templates' }]">
          <span class="rail-icon">📑</span>
          <span class="rail-label">เทมเพลต</span>
        </button>

        <button @click="handleTabClick('pages')" @mouseenter="handleMouseEnter('pages')"
          :class="['rail-btn', { active: activeTab === 'pages' && isOpen, pinned: isPinned && activeTab === 'pages' }]">
          <span class="rail-icon">📄</span>
          <span class="rail-label">จัดการหน้า</span>
        </button>

        <button @click="handleTabClick('data')" @mouseenter="handleMouseEnter('data')"
          :class="['rail-btn', { active: activeTab === 'data' && isOpen, pinned: isPinned && activeTab === 'data' }]">
          <span class="rail-icon">📊</span>
          <span class="rail-label">ข้อมูล</span>
        </button>

        <button @click="handleTabClick('assets')" @mouseenter="handleMouseEnter('assets')"
          :class="['rail-btn', { active: activeTab === 'assets' && isOpen, pinned: isPinned && activeTab === 'assets' }]">
          <span class="rail-icon">🖼️</span>
          <span class="rail-label">องค์ประกอบ</span>
        </button>

        <button @click="handleTabClick('project')" @mouseenter="handleMouseEnter('project')"
          :class="['rail-btn', { active: activeTab === 'project' && isOpen, pinned: isPinned && activeTab === 'project' }]">
          <span class="rail-icon">💾</span>
          <span class="rail-label">โปรเจกต์</span>
        </button>
      </div>
    </div>

    <!-- 2. Sliding Content Panel -->
    <div class="sidebar-panel" :class="{ collapsed: !isOpen }">
      <div class="panel-header">
        <h3 v-if="activeTab === 'templates'">📂 จัดการเทมเพลต</h3>
        <h3 v-if="activeTab === 'pages'">📄 จัดการหน้ากระดาษ</h3>
        <h3 v-if="activeTab === 'data'">📊 จัดการข้อมูล</h3>
        <h3 v-if="activeTab === 'assets'">🖼️ คลังรูปภาพ</h3>
        <h3 v-if="activeTab === 'project'">💾 จัดการโปรเจกต์</h3>
        <button class="panel-close-btn" @click="handleClose">◀</button>
      </div>

      <div class="panel-content">
        <!-- Tab 0: Pages -->
        <div v-if="activeTab === 'pages'" class="tab-pane">
          <div class="pages-list" @mouseleave="clearDragState">
            <div v-for="(page, index) in pages" :key="page.id" :class="[
              'page-item-sidebar',
              {
                active: isOpen && currentPageIndex === index,
                disabled: !isCanvasReady,
                dragging: draggedPageIndex === index,
                'drag-target-top': dragOverIndex === index && dragPosition === 'top',
                'drag-target-bottom': dragOverIndex === index && dragPosition === 'bottom'
              }
            ]" draggable="true" @dragstart="onPageDragStart($event, index)"
              @dragover.prevent="onPageDragOver($event, index)" @drop="onPageDrop($event, index)"
              @dragend="onPageDragEnd" @click="isCanvasReady ? $emit('page-click', index) : null">
              <div class="page-entry">
                <div class="page-thumb">
                  <img :src="page.background || getDefaultPageImage(index)" :alt="`Page ${index + 1}`" />
                  <div class="del-page-btn" @click.stop="isCanvasReady ? $emit('delete-page', index) : null"
                    v-if="pages.length > 1">
                    ×
                  </div>
                </div>
                <div class="page-info">
                  <span class="page-title">หน้า {{ index + 1 }}</span>
                </div>
              </div>
            </div>
          </div>

          <div class="add-page-actions-sidebar">
            <button class="add-pg-btn" @click="isCanvasReady ? $emit('add-page') : null" :disabled="!isCanvasReady">
              + เพิ่มหน้าว่างใหม่
            </button>
            <input type="file" ref="appendInput" @change="onAppendFileChange"
              accept="application/pdf, image/jpeg, image/png, image/gif, image/webp" style="display: none" />
            <button class="add-pg-btn secondary" @click="triggerAppendUpload" :disabled="!isCanvasReady">
              + นำเข้าหน้าใหม่
            </button>
          </div>
        </div>

        <!-- Tab 1: Templates -->
        <div v-if="activeTab === 'templates'" class="tab-pane">
          <button @click="$emit('open-history')" class="btn-history" style="width: 100%; margin-bottom: 20px">
            📜 ประวัติรายงาน
          </button>

          <div class="section master-templates">
            <div v-if="templates.length === 0" class="hint">ยังไม่มีเทมเพลตที่บันทึกไว้</div>
            <div v-if="!isCanvasReady" class="hint" style="color: #ff9800">กำลังเริ่มต้นระบบ...</div>
            <div class="template-list">
              <div v-for="t in templates" :key="t._id" class="template-item">
                <span @click="$emit('load-template', t)" :class="['t-name', { disabled: !isCanvasReady }]">{{
                  sanitizeTemplateName(t.name) }}</span>
                <button @click="isCanvasReady ? $emit('delete-template', t._id) : null" class="btn-del"
                  :disabled="!isCanvasReady">x</button>
              </div>
            </div>
            <hr style="margin: 10px 0; border-color: #ddd" />
            <label class="label-small">ชื่อเทมเพลต / ชื่องาน:</label>
            <input :value="templateName" @input="$emit('update:templateName', $event.target.value)"
              placeholder="ตั้งชื่อเทมเพลต..." :disabled="isPreviewMode" style="margin-bottom: 8px" />
            <button @click="$emit('save-template')" class="btn-save template-save" :disabled="isPreviewMode"
              style="width: 100%; margin-bottom: 8px">🛠 บันทึกเป็นแม่แบบ</button>
            <button v-if="currentTemplateId" @click="$emit('reset-canvas')" class="btn-new" style="margin-bottom: 0">
              + สร้างหน้ากระดาษใหม่
            </button>
          </div>
        </div>

        <!-- Tab 2: Data -->
        <div v-if="activeTab === 'data'" class="tab-pane">

          <div class="section">
            <h4 class="label-small">เลือกชุดข้อมูล:</h4>
            <div class="var-list">
              <div v-for="(group, category) in groupedVariables" :key="category">
                <h5 class="category-header">{{ category }}</h5>
                <button v-for="v in group" :key="v.key" @click="$emit('add-variable', v.key)" draggable="true"
                  @dragstart="onDragStart($event, v.key)" class="var-btn" :disabled="isPreviewMode">
                  {{ v.label }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Tab 3: Assets -->
        <div v-if="activeTab === 'assets'" class="tab-pane">
          <AssetManager :is-preview-mode="isPreviewMode" @select-asset="$emit('add-image', $event)" />
        </div>

        <!-- Tab 4: Project -->
        <div v-if="activeTab === 'project'" class="tab-pane">
          <div class="section">
            <div class="upload-container">
              <button class="btn-upload" @click="$emit('import-workspace')" :disabled="!isCanvasReady">
                📂 นำเข้าโปรเจกต์ / PDF / รูปภาพ
              </button>
            </div>
            <p class="hint">รองรับไฟล์: .json, Hybrid .pdf, รูปภาพ</p>
          </div>

          <div class="actions" style="margin-top: 20px; padding-top: 20px; border-top: 2px solid #eee">
            <button @click="$emit('save-report')" class="btn-save project-save" :disabled="isPreviewMode"
              style="width: 100%; margin-bottom: 5px">💾 บันทึกโปรเจกต์</button>
            <p class="hint" style="margin-bottom: 15px">บันทึกลงประวัติและไฟล์ Hybrid PDF</p>

            <div style="margin-bottom: 8px">
              <label class="label-small">คุณภาพ PDF:</label>
              <select :value="pdfQuality" @change="$emit('update:pdfQuality', $event.target.value)"
                style="width: 100%; padding: 6px; border-radius: 4px; border: 1px solid #ccc">
                <option value="1">ฉบับร่าง (1x)</option>
                <option value="2">มาตรฐาน (2x)</option>
                <option value="3">ละเอียด (3x)</option>
                <option value="4">สำหรับพิมพ์ (4x)</option>
              </select>
            </div>

            <button @click="$emit('generate-pdf')" class="btn-print" :disabled="isGenerating || isPreviewMode"
              style="width: 100%; font-weight: bold">
              {{ isGenerating ? '⏳ กำลังสร้าง PDF...' : '📄 ส่งออกเป็นไฟล์ PDF' }}
            </button>
            <p class="hint">แก้ไขต่อได้ทั้งในโปรแกรมนี้และ Acrobat</p>
          </div>
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup>
import { ref } from 'vue';

const activeTab = ref('templates');
const isPinned = ref(false);

const handleMouseEnter = (tabId) => {
  activeTab.value = tabId;
  emit('open');
};

const handleMouseLeave = () => {
  if (!isPinned.value) {
    emit('close');
  }
};

const handleTabClick = (tabId) => {
  if (isPinned.value && activeTab.value === tabId) {
    // Already pinned on this tab, so close it
    isPinned.value = false;
    emit('close');
  } else {
    // Pin it or switch pin
    activeTab.value = tabId;
    isPinned.value = true;
    emit('open');
  }
};

const handleClose = () => {
  isPinned.value = false;
  emit('close');
};

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: true
  },
  connectionStatus: String,
  templates: Array,
  isCanvasReady: Boolean,
  templateName: String,
  isPreviewMode: Boolean,
  currentTemplateId: String,
  groupedVariables: Object,
  isGenerating: Boolean,
  pdfQuality: [String, Number],
  // Page Props
  pages: Array,
  currentPageIndex: Number
});

const emit = defineEmits([
  'load-template',
  'delete-template',
  'update:templateName',
  'update:pdfQuality',
  'save-template',
  'reset-canvas',
  'toggle-preview',
  'import-workspace',
  'add-variable',
  'add-image',
  'save-report',
  'generate-pdf',
  'open-history',
  'toggle',
  'open',
  'close',
  // Page Emits
  'delete-page',
  'add-page',
  'import-page',
  'page-click',
  'page-drop'
]);

// Removed local file handlers as they are now unified in parent

const draggedPageIndex = ref(null);
const dragOverIndex = ref(null);
const dragPosition = ref(null);
const appendInput = ref(null);

const getDefaultPageImage = (index) => {
  return `data:image/svg+xml;base64,${btoa('<svg width="79" height="112" xmlns="http://www.w3.org/2000/svg"><rect width="79" height="112" fill="white"/></svg>')}`;
};

const onPageDragStart = (e, index) => {
  draggedPageIndex.value = index;
};

const onPageDragOver = (e, index) => {
  if (draggedPageIndex.value === null || draggedPageIndex.value === index) return;
  const rect = e.currentTarget.getBoundingClientRect();
  dragOverIndex.value = index;
  dragPosition.value = e.clientY - rect.top > rect.height / 2 ? 'bottom' : 'top';
};

const clearDragState = () => {
  dragOverIndex.value = null;
  dragPosition.value = null;
};

const onPageDragEnd = () => {
  draggedPageIndex.value = null;
  clearDragState();
};

const onPageDrop = (e, targetIndex) => {
  const sourceIndex = draggedPageIndex.value;
  const position = dragPosition.value;
  clearDragState();
  if (sourceIndex === null || sourceIndex === targetIndex) return;
  emit('page-drop', { sourceIndex, targetIndex, position });
};

const triggerAppendUpload = () => {
  if (appendInput.value) appendInput.value.click();
};

const onAppendFileChange = (e) => {
  emit('import-page', e);
};

const onDragStart = (e, key) => {
  e.dataTransfer.setData('variable', key);
  e.dataTransfer.effectAllowed = 'copy';
};

const sanitizeTemplateName = (name) => {
  return (name || 'เทมเพลตไม่มีชื่อ')
    .replace(/<[^>]*>/g, '')
    .trim()
    .substring(0, 50);
};
</script>

<script>
import AssetManager from './AssetManager.vue';
export default {
  components: { AssetManager }
};
</script>

<style scoped>
.sidebar-container {
  position: fixed;
  left: 0;
  top: 60px;
  bottom: 0;
  display: flex;
  z-index: 50;
}

/* ── Vertical Rail ── */
.sidebar-rail {
  width: 72px;
  background: #ffffff;
  border-right: 1px solid #e0e0e0;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 15px;
  z-index: 52;
  box-shadow: 2px 0 5px rgba(0, 0, 0, 0.05);
}

.rail-items {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.rail-btn {
  width: 100%;
  border: none;
  background: transparent;
  padding: 12px 2px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #555;
  transition: all 0.2s ease;
  border-left: 3px solid transparent;
}

.rail-btn:hover {
  background: #f5f5f5;
  color: #2196f3;
}

.rail-btn.active {
  background: #f0f0f0;
  color: #2196f3;
  border-left-color: #2196f3;
}

.rail-btn.pinned {
  color: #2196f3;
  background: #e3f2fd;
}

.rail-btn.pinned .rail-label {
  font-weight: 700;
  color: #1976d2;
}

.rail-icon {
  font-size: 20px;
  margin-bottom: 4px;
}

.rail-label {
  font-size: 10px;
  font-weight: 600;
  white-space: nowrap;
}

/* ── Sliding Panel ── */
.sidebar-panel {
  width: 320px;
  background: white;
  border-right: 1px solid #e0e0e0;
  display: flex;
  flex-direction: column;
  z-index: 51;
  box-shadow: 2px 0 10px rgba(0, 0, 0, 0.05);
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  transform: translateX(0);
}

.sidebar-panel.collapsed {
  transform: translateX(-321px);
  /* Slide behind the rail */
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 15px 20px;
  border-bottom: 1px solid #eee;
  background: #fafafa;
}

.panel-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: #333;
}

.panel-close-btn {
  border: none;
  background: transparent;
  color: #999;
  cursor: pointer;
  padding: 5px;
  font-weight: bold;
  font-size: 14px;
}

.panel-close-btn:hover {
  color: #333;
}

.panel-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}

.tab-pane {
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* ── Pages Rail/Panel Styles ── */
.pages-list {
  flex: 1;
  overflow-y: auto;
  padding-right: 5px;
}

.page-item-sidebar {
  padding: 8px;
  border: 2px solid transparent;
  border-radius: 8px;
  margin-bottom: 12px;
  cursor: pointer;
  transition: all 0.2s;
  background: #f9f9f9;
}

.page-item-sidebar:hover {
  background: #f0f0f0;
}

.page-item-sidebar.active {
  border-color: #2196f3;
  background: #e3f2fd;
}

.page-item-sidebar.dragging {
  opacity: 0.5;
  border: 2px dashed #999;
}

.page-item-sidebar.drag-target-top {
  border-top: 3px solid #2196f3;
}

.page-item-sidebar.drag-target-bottom {
  border-bottom: 3px solid #2196f3;
}

.page-entry {
  display: flex;
  align-items: center;
  gap: 15px;
}

.page-thumb {
  position: relative;
  width: 60px;
  height: 85px;
  background: #fff;
  border: 1px solid #ddd;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  flex-shrink: 0;
}

.page-thumb img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.del-page-btn {
  position: absolute;
  top: -6px;
  right: -6px;
  background: #f44336;
  color: white;
  border-radius: 50%;
  width: 18px;
  height: 18px;
  line-height: 18px;
  text-align: center;
  font-size: 12px;
  display: none;
}

.page-item-sidebar:hover .del-page-btn {
  display: block;
}

.page-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.page-title {
  font-size: 14px;
  font-weight: 700;
  color: #333;
}

.add-page-actions-sidebar {
  margin-top: 15px;
  padding-top: 15px;
  border-top: 1px solid #eee;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.add-pg-btn {
  width: 100%;
  padding: 10px;
  background: #2196f3;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
  transition: background 0.2s;
}

.add-pg-btn:hover:not(:disabled) {
  background: #1976d2;
}

.add-pg-btn.secondary {
  background: #607d8b;
}

.add-pg-btn.secondary:hover:not(:disabled) {
  background: #455a64;
}

.add-pg-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.sidebar-toggle {
  position: absolute;
  right: -40px;
  top: 20px;
  width: 40px;
  height: 40px;
  background: white;
  border: 1px solid #e0e0e0;
  border-left: none;
  border-radius: 0 8px 8px 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: bold;
  box-shadow: 2px 2px 5px rgba(0, 0, 0, 0.05);
  z-index: 51;
  color: #333;
}

/* Old sidebar headers removed */

.connection-status.online {
  background: #e8f5e9;
  color: #2e7d32;
  border: 1px solid #c8e6c9;
}

.connection-status.offline {
  background: #ffebee;
  color: #c62828;
  border: 1px solid #ffcdd2;
}

.section {
  margin-bottom: 20px;
}

.section h3 {
  margin-top: 0;
  margin-bottom: 10px;
  font-size: 14px;
  color: #666;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.section.master-templates {
  background: #f8f9fa;
  padding: 12px;
  border-radius: 6px;
  border: 1px solid #eee;
}

.section.mode-selector {
  background: #fff;
  padding: 12px;
  border-radius: 6px;
  border: 1px solid #2196f3;
}

.t-name {
  cursor: pointer;
  color: #2196f3;
  flex-grow: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin-right: 10px;
}

.t-name:hover {
  text-decoration: underline;
}

.t-name.disabled {
  color: #aaa;
  pointer-events: none;
}

.template-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 0;
  border-bottom: 1px solid #eee;
}

.btn-del {
  background: #ffcdd2;
  color: #c62828;
  border: none;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  cursor: pointer;
  font-size: 14px;
  line-height: 24px;
  padding: 0;
  flex-shrink: 0;
}

.btn-save,
.btn-new,
.btn-mode-toggle,
.btn-upload,
.btn-print,
.var-btn {
  padding: 8px 12px;
  border: 1px solid transparent;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
  font-family: inherit;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-save.template-save {
  background: #4caf50;
  color: white;
}

.btn-save.project-save {
  background: #2196f3;
  color: white;
  font-weight: bold;
}

.btn-save:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.btn-new {
  background: #fff;
  border: 1px solid #ddd;
  color: #333;
  width: 100%;
}

.btn-new:hover {
  background: #f5f5f5;
}

.btn-mode-toggle {
  width: 100%;
  font-weight: bold;
}

.btn-mode-toggle.edit-mode {
  background: #e3f2fd;
  color: #1565c0;
  border: 1px solid #bbdefb;
}

.btn-mode-toggle.preview-mode {
  background: #fff3e0;
  color: #e65100;
  border: 1px solid #ffe0b2;
}

.btn-upload {
  background: #607d8b;
  color: white;
  width: 100%;
}

.btn-print {
  background: #673ab7;
  color: white;
  width: 100%;
  font-weight: bold;
}

.var-list {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.var-btn {
  background: #fff;
  border: 1px solid #ccc !important;
  color: #333 !important;
  text-align: left;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
  justify-content: flex-start;
  width: 100%;
}

.var-btn:hover:not(:disabled) {
  background: #f5f5f5;
  border-color: #bbb !important;
  transform: translateX(2px);
}

.hint {
  font-size: 12px;
  color: #666;
  margin-top: 5px;
  font-style: italic;
}

.label-small {
  font-size: 12px;
  font-weight: 700;
  color: #444;
  margin-bottom: 4px;
  display: block;
}

.category-header {
  font-size: 13px;
  color: #444;
  margin: 10px 0 5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

input[type='text'],
input:not([type]) {
  width: 100%;
  padding: 8px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-family: inherit;
  color: #333;
  background: #fff;
}
</style>
