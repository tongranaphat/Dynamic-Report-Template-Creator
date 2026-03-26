<template>
  <aside class="sidebar-container" @mouseleave="handleMouseLeave">
    <div class="sidebar-rail">
      <div class="rail-items">
        <button @click="handleTabClick('templates')" @mouseenter="handleMouseEnter('templates')"
          :class="['rail-btn', { active: activeTab === 'templates' && isOpen, pinned: isPinned && activeTab === 'templates' }]">
          <span class="rail-icon icon-dashboard"></span>
          <span class="rail-label">เทมเพลต</span>
        </button>

        <button @click="handleTabClick('pages')" @mouseenter="handleMouseEnter('pages')"
          :class="['rail-btn', { active: activeTab === 'pages' && isOpen, pinned: isPinned && activeTab === 'pages' }]">
          <span class="rail-icon icon-page"></span>
          <span class="rail-label">หน้า</span>
        </button>

        <button @click="handleTabClick('data')" @mouseenter="handleMouseEnter('data')"
          :class="['rail-btn', { active: activeTab === 'data' && isOpen, pinned: isPinned && activeTab === 'data' }]">
          <span class="rail-icon icon-data"></span>
          <span class="rail-label">ข้อมูล</span>
        </button>

        <button @click="handleTabClick('layers')" @mouseenter="handleMouseEnter('layers')"
          :class="['rail-btn', { active: activeTab === 'layers' && isOpen, pinned: isPinned && activeTab === 'layers' }]">
          <span class="rail-icon icon-project"></span>
          <span class="rail-label">เลเยอร์</span>
        </button>

        <button @click="handleTabClick('assets')" @mouseenter="handleMouseEnter('assets')"
          :class="['rail-btn', { active: activeTab === 'assets' && isOpen, pinned: isPinned && activeTab === 'assets' }]">
          <span class="rail-icon icon-image"></span>
          <span class="rail-label">รูปภาพ</span>
        </button>

        <button @click="handleTabClick('project')" @mouseenter="handleMouseEnter('project')"
          :class="['rail-btn', { active: activeTab === 'project' && isOpen, pinned: isPinned && activeTab === 'project' }]">
          <span class="rail-icon icon-project"></span>
          <span class="rail-label">โปรเจกต์</span>
        </button>
      </div>
    </div>

    <div class="sidebar-panel" :class="{ collapsed: !isOpen }">
      <div class="panel-header">

        <div class="panel-header-title" v-if="activeTab === 'templates'">
          <span class="panel-header-icon icon-dashboard-active"></span>
          <h3 class="panel-header-text">จัดการเทมเพลต</h3>
        </div>

        <div class="panel-header-title" v-if="activeTab === 'pages'">
          <span class="panel-header-icon icon-pages"></span>
          <h3 class="panel-header-text">จัดการหน้ากระดาษ</h3>
        </div>

        <div class="panel-header-title" v-if="activeTab === 'data'">
          <span class="panel-header-icon icon-data-header"></span>
          <h3 class="panel-header-text">จัดการข้อมูล</h3>
        </div>

        <div class="panel-header-title" v-if="activeTab === 'layers'">
          <span class="panel-header-icon icon-project-header"></span>
          <h3 class="panel-header-text">จัดการลำดับชั้นวัตถุ</h3>
        </div>

        <div class="panel-header-title" v-if="activeTab === 'assets'">
          <span class="panel-header-icon icon-image-header"></span>
          <h3 class="panel-header-text">คลังรูปภาพ</h3>
        </div>

        <div class="panel-header-title" v-if="activeTab === 'project'">
          <span class="panel-header-icon icon-project-header"></span>
          <h3 class="panel-header-text">จัดการโปรเจกต์</h3>
        </div>
      </div>
      <div class="panel-content">
        <div v-if="activeTab === 'pages'" class="tab-pane-pages">
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
                  <button class="del-page-btn" @click.stop="isCanvasReady ? $emit('delete-page', index) : null"
                    v-if="pages.length > 1">
                    <span class="icon-delete"></span>
                  </button>
                </div>
                <div class="page-info">
                  <span class="page-title">หน้า {{ index + 1 }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div v-if="activeTab === 'templates'" class="tab-pane-templates">

          <div class="history-section">
            <div class="btn-history-header">ประวัติรายงาน</div>
            <button @click="$emit('open-history')" :class="['btn-history', { 'active': isHistoryOpen }]">
              <span class="btn-history-icon"></span>
              <span class="btn-history-text">ประวัติการสร้างรายงาน</span>
            </button>
          </div>

          <div class="template-save-pane">
            <div class="save-pane-inner">

              <div class="existing-templates-list">
                <div v-if="templates.length === 0" class="hint" style="margin-top: 0; margin-bottom: 8px;">
                  ยังไม่มีเทมเพลตที่บันทึกไว้</div>
                <div class="template-list">
                  <div v-for="t in templates" :key="t._id" class="template-item-row">
                    <span @click="$emit('load-template', t)" :class="['t-name', { disabled: !isCanvasReady }]">
                      {{ sanitizeTemplateName(t.name) }}
                    </span>
                    <button @click="isCanvasReady ? $emit('delete-template', t._id) : null" class="btn-del"
                      :disabled="!isCanvasReady"><span class="icon-delete"></span></button>
                  </div>
                </div>
              </div>

              <div class="template-label-small">ชื่อเทมเพลต / ชื่องาน:</div>

              <input :value="templateName" @input="$emit('update:templateName', $event.target.value)"
                placeholder="ตั้งชื่อเทมเพลต..." :disabled="isPreviewMode" class="template-name-input" />

              <button @click="$emit('save-template')" class="template-save-btn" :disabled="isPreviewMode">
                <span class="template-save-text">บันทึกเป็นแม่แบบ</span>
              </button>
            </div>
          </div>

          <button v-if="currentTemplateId" @click="$emit('reset-canvas')" class="btn-new">
            + สร้างหน้ากระดาษใหม่
          </button>

        </div>

        <div v-if="activeTab === 'data'" class="tab-pane-data">

          <div class="data-section">
            <h4 class="label-small">ข้อความทั่วไป:</h4>
            <button @click="handleAddCustomText" class="var-btn" :disabled="isPreviewMode" draggable="true"
              @dragstart="onCustomTextDragStart($event)">
              <div class="var-btn-icon-holder"><span class="var-btn-icon">{ }</span></div>
              <span class="var-btn-text">ข้อความอิสระ (พิมพ์เอง)</span>
            </button>
          </div>

          <div class="data-section">
            <h4 class="label-small">เลือกชุดข้อมูล:</h4>
            <div class="var-list">
              <div v-for="(group, category) in groupedVariables" :key="category" class="var-group">
                <h5 class="category-header">{{ category }}</h5>
                <button v-for="v in group" :key="v.key" @click="$emit('add-variable', v.key)" draggable="true"
                  @dragstart="onDragStart($event, v.key)" class="var-btn" :disabled="isPreviewMode">
                  <div class="var-btn-icon-holder"><span class="var-btn-icon">{ }</span></div>
                  <span class="var-btn-text">{{ v.label }}</span>
                </button>
              </div>
            </div>
          </div>

        </div>

        <!-- แท็บเลเยอร์ (ใหม่) -->
        <div v-if="activeTab === 'layers'" class="tab-pane-layers"
          style="display: flex; flex-direction: column; align-items: center; padding-top: 15px;">
          <div class="layers-section" style="width: 298px;">
            <div class="layers-list">

              <div v-if="!layers || layers.length === 0" class="hint" style="text-align: center; margin-top: 10px;">
                ไม่มีวัตถุในหน้านี้
              </div>

              <button v-for="layer in layers" :key="layer.id" :class="['layer-item-btn', { active: layer.isActive }]"
                @click="$emit('select-layer', layer.rawObject)">
                {{ layer.label }} (ชั้นที่ {{ layer.index }})
              </button>
            </div>
          </div>
        </div>

        <div v-if="activeTab === 'assets'" class="tab-pane">
          <AssetManager :is-preview-mode="isPreviewMode" @select-asset="$emit('add-image', $event)" />
        </div>

        <div v-if="activeTab === 'project'" class="tab-pane-project">

          <div class="project-section">
            <h4 class="label">นำเข้าโปรเจกต์ / PDF / รูปภาพ</h4>
            <div class="upload-container">
              <button class="btn-upload-dashed" @click.stop="$emit('import-workspace')" :disabled="!isCanvasReady">
                <span class="btn-upload-dashed-icon"></span>
                <span class="btn-upload-dashed-text">นำเข้าโปรเจกต์</span>
              </button>
              <button class="btn-upload-dashed" style="margin-top: 8px; border-color: #2196f3; background-image: none;"
                @click.stop="promptForUrl" :disabled="!isCanvasReady">
                <span class="btn-upload-dashed-text" style="color: #2196f3;">นำเข้าจาก URL</span>
              </button>
            </div>
            <p class="hint-text">รองรับไฟล์ : Json, Hybrid, PDF, รูปภาพ</p>
          </div>

          <div class="project-section">
            <button @click="$emit('save-report')" class="btn-project-save" :disabled="isPreviewMode">
              <span class="btn-project-save-text">บันทึกโปรเจกต์</span>
            </button>
            <p class="hint-text">บันทึกลงประวัติและไฟล์ Hybrid PDF</p>
          </div>
          <div class="project-section">
            <h4 class="label">คุณภาพ PDF:</h4>
            <div class="radio-group-list">
              <div :class="['radio-card', { active: pdfQuality == '1' }]" @click="$emit('update:pdfQuality', '1')">
                <div class="radio-circle">
                  <div class="radio-inner" v-if="pdfQuality == '1'"></div>
                </div>
                <div class="radio-text-content">
                  <div class="radio-title">ฉบับร่าง</div>
                  <div class="radio-subtitle">ไฟล์เล็ก เหมาะสำหรับตรวจงาน</div>
                </div>
                <div class="radio-badge">1x</div>
              </div>
              <div :class="['radio-card', { active: pdfQuality == '2' }]" @click="$emit('update:pdfQuality', '2')">
                <div class="radio-circle">
                  <div class="radio-inner" v-if="pdfQuality == '2'"></div>
                </div>
                <div class="radio-text-content">
                  <div class="radio-title">มาตรฐาน</div>
                  <div class="radio-subtitle">สมดุลระหว่างคุณภาพและขนาด</div>
                </div>
                <div class="radio-badge">2x</div>
              </div>
              <div :class="['radio-card', { active: pdfQuality == '3' }]" @click="$emit('update:pdfQuality', '3')">
                <div class="radio-circle">
                  <div class="radio-inner" v-if="pdfQuality == '3'"></div>
                </div>
                <div class="radio-text-content">
                  <div class="radio-title">ละเอียด(HD)</div>
                  <div class="radio-subtitle">คมชัดสูง สำหรับจอ Retina</div>
                </div>
                <div class="radio-badge">3x</div>
              </div>
              <div :class="['radio-card', { active: pdfQuality == '4' }]" @click="$emit('update:pdfQuality', '4')">
                <div class="radio-circle">
                  <div class="radio-inner" v-if="pdfQuality == '4'"></div>
                </div>
                <div class="radio-text-content">
                  <div class="radio-title">สำหรับพิมพ์</div>
                  <div class="radio-subtitle">ความละเอียดสูงสุด</div>
                </div>
                <div class="radio-badge">4x</div>
              </div>
            </div>
          </div>

          <div class="project-section">
            <h4 class="label">รูปแบบการส่งออก (Engine):</h4>
            <div class="radio-group-list">
              <div :class="['radio-card', { active: pdfMode == 'flatten' }]"
                @click="$emit('update:pdfMode', 'flatten')">
                <div class="radio-circle">
                  <div class="radio-inner" v-if="pdfMode == 'flatten'"></div>
                </div>
                <div class="radio-text-content">
                  <div class="radio-title">รูปภาพ</div>
                  <div class="radio-subtitle">ถูกต้อง100%</div>
                </div>
              </div>
              <div :class="['radio-card', { active: pdfMode == 'vector' }]" @click="$emit('update:pdfMode', 'vector')">
                <div class="radio-circle">
                  <div class="radio-inner" v-if="pdfMode == 'vector'"></div>
                </div>
                <div class="radio-text-content">
                  <div class="radio-title">เวคเตอร์</div>
                  <div class="radio-subtitle">แก้ไขข้อความใน Acrobat ได้</div>
                </div>
              </div>
            </div>
          </div>

          <div class="project-section" style="margin-top: 10px; margin-bottom: 30px;">
            <button @click="$emit('generate-pdf')" class="btn-print-outline" :disabled="isGenerating || isPreviewMode">
              <span class="btn-print-text">
                {{ isGenerating ? 'กำลังสร้าง PDF...' : 'ส่งออกเป็นไฟล์ PDF' }}
              </span>
            </button>
          </div>

        </div>
      </div>

      <div class="panel-footer" v-if="activeTab === 'pages'">
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

    </div>
  </aside>
</template>

<script setup>
import { ref } from 'vue';

const sanitizeTemplateName = (name) => {
  if (!name) return 'Untitled Template';
  return name.replace(/\.[^/.]+$/, "");
};

const workspaceInput = ref(null);
const onWorkspaceFileChange = (e) => {
  emit('import-workspace', e);
};

const activeTab = ref('templates');
const isPinned = ref(false);

const promptForUrl = () => {
  const url = window.prompt('กรุณาวางลิงก์ PDF ที่ต้องการนำเข้า:');
  if (url && url.trim()) {
    emit('import-url', url.trim());
  }
};

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
  isHistoryOpen: Boolean,
  connectionStatus: String,
  templates: {
    type: Array,
    default: () => []
  },
  isCanvasReady: Boolean,
  templateName: String,
  isPreviewMode: Boolean,
  currentTemplateId: String,
  groupedVariables: Object,
  isGenerating: Boolean,
  pdfQuality: [String, Number],
  layers: {
    type: Array,
    default: () => []
  },
  // Page Props
  pages: {
    type: Array,
    default: () => []
  },
  currentPageIndex: Number,
  pdfMode: String
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
  'select-layer',
  'import-url',
  // Page Emits
  'delete-page',
  'page-click',
  'page-drop',
  'update:pdfMode',
  'unified-import'
]);

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

const onContainerDragStart = (e, block) => {
  e.dataTransfer.setData('containerBlock', JSON.stringify(block));
  e.dataTransfer.effectAllowed = 'copy';
  return (name || 'เทมเพลตไม่มีชื่อ')
    .replace(/<[^>]*>/g, '')
    .trim()
    .substring(0, 50);
};

// 📌 เมื่อกดปุ่มเฉยๆ (คลิก) ให้ไปเกิดที่พิกัดซ้ายบน (50, 50)
const handleAddCustomText = () => {
  if (window.addCustomTextToCanvas) {
    window.addCustomTextToCanvas(50, 50);
  }
};

// 📌 เมื่อผู้ใช้ "ลาก" ปุ่ม (Drag & Drop)
const onCustomTextDragStart = (e) => {
  e.dataTransfer.setData('customText', 'true');
  e.dataTransfer.effectAllowed = 'copy';
};

</script>

<script>
import AssetManager from './AssetManager.vue';
export default {
  components: { AssetManager }
};
</script>

<style scoped>
/* ── Layout หลัก ── */
.sidebar-container {
  position: absolute;
  left: 0;
  top: 69px;
  bottom: 0;
  display: flex;
  z-index: 50;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* ── 1. Vertical Rail ── */
.sidebar-rail {
  width: 85px;
  height: 100%;
  background: #FFFFFF;
  border-right: 1px solid #F3F3F3;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 18px;
  z-index: 52;
  box-sizing: border-box;
}

.rail-items {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  width: 100%;
}

.rail-btn {
  width: 67px;
  height: 66px;
  background: transparent;
  border: none;
  border-radius: 5px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  transition: all 0.2s ease;
}

.rail-btn.active,
.rail-btn.pinned {
  background: #FFF5F8;
}

.rail-icon {
  width: 22px;
  height: 22px;
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
  margin-bottom: 2px;
}

.icon-dashboard {
  background-image: url('../assets/icons/dashboard.png');
}

.rail-btn.active .icon-dashboard {
  background-image: url('../assets/icons/dashboard-active.png');
}

.icon-page {
  background-image: url('../assets/icons/page.png');
}

.rail-btn.active .icon-page {
  background-image: url('../assets/icons/page-active.png');
}

.icon-data {
  background-image: url('../assets/icons/folder.png');
}

.rail-btn.active .icon-data {
  background-image: url('../assets/icons/folder-active.png');
}

.icon-placeholder {
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.rail-label {
  font: normal normal normal 18px/24px "TH Sarabun New", "Sarabun", sans-serif;
  color: #000000;
  margin-top: 2px;
}

.rail-btn.active .rail-label {
  font: normal normal bold 18px/24px "TH Sarabun New", "Sarabun", sans-serif;
  color: #F65189;
}

/* ── 2. Sliding Panel ── */
.sidebar-panel {
  width: 329px;
  height: 100%;
  background: #FFFFFF;
  border: 1px solid #F3F3F3;
  display: flex;
  flex-direction: column;
  z-index: 51;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-sizing: border-box;
}

.sidebar-panel.collapsed {
  transform: translateX(-330px);
}

.panel-header {
  height: 69px;
  min-height: 69px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 17px;
  border-bottom: 1px solid #F3F3F3;
}

.panel-header-title {
  display: flex;
  align-items: center;
  gap: 9px;
}

.panel-header-icon {
  width: 20px;
  height: 20px;
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
}

.icon-dashboard-active {
  background-image: url('../assets/icons/dashboard-active.png');
}

.icon-pages {
  background-image: url('../assets/icons/page-active.png');
}

.icon-data-header {
  background-image: url('../assets/icons/folder-active.png');
}

.panel-header-text {
  font: normal normal bold 21px/28px "TH Sarabun New", "Sarabun", sans-serif;
  color: #000000;
  margin: 0;
}

.panel-close-btn {
  background: none;
  border: none;
  cursor: pointer;
  color: #999;
  font-weight: bold;
}

.panel-content {
  flex: 1;
  width: 100%;
  overflow-y: auto;
  padding: 0px 0;
}

/* ── ส่วนกล่อง Footer ด้านล่างสุด ── */
.panel-footer {
  width: 100%;
  background: #FFFFFF;
  padding: 15px 0 25px 0;
  display: flex;
  justify-content: center;
  z-index: 10;
}

/* ========================================================================= */
/* ── ส่วนของแท็บ "จัดการหน้ากระดาษ" ── */
/* ========================================================================= */
.tab-pane-pages {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.pages-list {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  overflow-y: auto;
  padding-right: 5px;
  padding-top: 15px;
}

.page-item-sidebar {
  width: 298px;
  height: 108px;
  background: #F9F9F9 0% 0% no-repeat padding-box;
  border: 1px solid #F3F3F3;
  border-radius: 6px;
  margin-bottom: 14px;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  padding: 0 16px;
  box-sizing: border-box;
}

.page-item-sidebar.active {
  background: #F651891A 0% 0% no-repeat padding-box;
  border: 1px solid #FFD5E3;
}

.page-entry {
  display: flex;
  align-items: center;
  gap: 15px;
  width: 100%;
}

.page-thumb {
  position: relative;
  width: 70px;
  height: 92px;
  background: #FFFFFF 0% 0% no-repeat padding-box;
  border: 1px solid #F6F6F6;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
}

.page-thumb img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.del-page-btn {
  position: absolute;
  top: -8px;
  right: -8px;
  background: #E74C3C;
  border: none;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  display: none;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);
  z-index: 10;
  transition: background 0.2s;
}

.page-item-sidebar:hover .del-page-btn {
  display: flex;
}

.del-page-btn:hover {
  background: #C0392B;
}

.page-title {
  text-align: left;
  font: normal normal normal 18px/24px "TH Sarabun New", "Sarabun", sans-serif;
  letter-spacing: 0px;
  color: #000000;
}

.add-page-actions-sidebar {
  width: 298px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.add-pg-btn {
  width: 298px;
  height: 46px;
  background: #F65189 0% 0% no-repeat padding-box;
  border-radius: 6px;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: left;
  font: normal normal bold 18px/24px "TH Sarabun New", "Sarabun", sans-serif;
  color: #FFFFFF;
  cursor: pointer;
  transition: opacity 0.2s;
}

.add-pg-btn:hover:not(:disabled) {
  opacity: 0.85;
}

.add-pg-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.add-pg-btn.secondary {
  background: #FFFFFF 0% 0% no-repeat padding-box;
  border: 1px solid #F65189;
  color: #F65189;
}

.add-pg-btn.secondary:hover:not(:disabled) {
  background: #FFF5F8;
  opacity: 1;
}

.page-item-sidebar.dragging {
  opacity: 0.5;
  border: 2px dashed #999;
}

.page-item-sidebar.drag-target-top {
  border-top: 3px solid #F65189;
}

.page-item-sidebar.drag-target-bottom {
  border-bottom: 3px solid #F65189;
}

/* ========================================================================= */
/* ── ส่วนของแท็บ "เทมเพลต" ── */
/* ========================================================================= */
.tab-pane-templates {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.history-section {
  width: 298px;
  padding-top: 15px;
}

.btn-history-header {
  width: 81px;
  height: 26px;
  text-align: left;
  font: normal normal normal 20px/28px "TH Sarabun New", "Sarabun", sans-serif;
  color: #000000;
  margin-bottom: 9px;
  white-space: nowrap;
}

.btn-history {
  width: 259px;
  height: 40px;
  background: #FFFFFF;
  border: 1px solid #F65189;
  border-radius: 5px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  padding: 0;
  transition: all 0.2s ease;
}

.btn-history-icon {
  width: 16px;
  height: 16px;
  background: transparent url('../assets/icons/history.png') center/contain no-repeat;
}

.btn-history-text {
  font: normal normal bold 18px/24px "TH Sarabun New", "Sarabun", sans-serif;
  color: #F65189;
}

.template-save-pane {
  width: 298px;
  min-height: 192px;
  background: #F9F9F9 0% 0% no-repeat padding-box;
  border: 1px solid #E8E8E8;
  border-radius: 5px;
  margin-top: 18px;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 12px 0 20px 0;
  box-sizing: border-box;
}

.save-pane-inner {
  width: 268px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}

.existing-templates-list {
  width: 100%;
}

.template-list {
  width: 100%;
  display: flex;
  flex-direction: column;
}

.template-item-title {
  font: normal normal bold 20px/28px "TH Sarabun New", "Sarabun", sans-serif;
  color: #000000;
  margin-bottom: 5px;
}

.template-label-small {
  width: 120px;
  height: 24px;
  text-align: left;
  font: normal normal normal 18px/24px "TH Sarabun New", "Sarabun", sans-serif;
  color: #000000;
  margin-top: 0px;
}

.label-small {
  width: 70px;
  height: 20px;
  text-align: left;
  font: normal normal normal 18px/24px "TH Sarabun New", "Sarabun", sans-serif;
  color: #000000;
  margin-top: 0px;
  margin-bottom: 15px;
}

.template-name-input {
  width: 268px;
  height: 46px;
  background: #FFFFFF 0% 0% no-repeat padding-box;
  border: 1px solid #E3E3E3;
  border-radius: 5px;
  margin-top: 6px;
  padding: 0 13px;
  text-align: left;
  font: normal normal normal 14px/18px "TH Sarabun New", "Sarabun", sans-serif;
  color: #000000;
  box-sizing: border-box;
}

.template-name-input::placeholder {
  color: #BEBEBE;
}

.template-save-btn {
  width: 268px;
  height: 46px;
  background: #F65189 0% 0% no-repeat padding-box;
  border-radius: 5px;
  border: none;
  margin-top: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.template-save-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.template-save-text {
  height: 24px;
  text-align: left;
  font: normal normal bold 18px/24px "TH Sarabun New", "Sarabun", sans-serif;
  color: #FFFFFF;
}

.t-name {
  text-align: left;
  font: normal normal bold 20px/28px "TH Sarabun New", "Sarabun", sans-serif;
  color: #000000;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 219px;
}

.t-name.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.template-item-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
  padding-bottom: 6px;
}

.btn-del {
  background: #E74C3C;
  border: none;
  border-radius: 50%;
  width: 23px;
  height: 23px;
  cursor: pointer;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0;
  pointer-events: none;
  transition: all 0.2s ease;
}

.template-item-row:hover .btn-del {
  opacity: 1;
  pointer-events: auto;
}

.icon-delete {
  width: 16px;
  height: 16px;
  background: transparent url('../assets/icons/delete.svg') 0% 0% no-repeat padding-box;
  background-size: contain;
}

/* ========================================================================= */
/* ── ส่วนของแท็บ "ข้อมูล" (ดีไซน์ใหม่) ── */
/* ========================================================================= */

.tab-pane-data {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 15px;
  /* 📌 ตั้งระยะห่างจากขอบบนสุดให้เท่ากัน */
}

.data-section {
  width: 298px;
}

/* 📌 1. และ 2. จัดการระยะห่างและเส้นคั่นของหมวดหมู่แรก */
.data-section:first-child {
  padding-bottom: 18px;
  /* เพิ่มระยะระหว่างปุ่มข้อความอิสระ กับเส้นคั่นล่าง */
  margin-bottom: 15px;
  /* ให้คำว่า "เลือกชุดข้อมูล" ห่างจากเส้นเท่ากับ padding-top ด้านบนสุด */
  border-bottom: 1px solid #F3F3F3;
}

.label {
  text-align: left;
  font: "TH Sarabun New", "Sarabun", sans-serif;
  font: normal normal normal 21px/28px "TH Sarabun New", "Sarabun", sans-serif;
  color: #000000;
  margin: 0 0 10px 0;
  display: block;
}

.category-header {
  text-align: left;
  font: normal normal bold 21px/28px "TH Sarabun New", "Sarabun", sans-serif;
  color: #000000;
  opacity: 1;
  margin: 10px 0 10px 0;
  text-transform: none;
  letter-spacing: 0px;
}

.var-list {
  display: flex;
  flex-direction: column;
}

.var-group {
  display: flex;
  flex-direction: column;
}

.var-btn {
  width: 298px;
  height: 46px;
  background: #FFF9FB 0% 0% no-repeat padding-box;
  border: 1px solid #FFD5E3;
  border-radius: 6px;
  display: flex;
  align-items: center;
  padding: 0 8px;
  margin-bottom: 8px;
  cursor: pointer;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

/* 📌 4. Hover ปุ่ม ให้สีเป็นเหมือนเดิม แต่ลอยขึ้นนิดหน่อย + มีเงาให้ดูมีมิติ */
.var-btn:hover:not(:disabled) {
  background: #FFF9FB 0% 0% no-repeat padding-box;
  /* ล็อคสีเดิม */
  border: 1px solid #FFD5E3;
  /* ล็อคสีขอบเดิม */
  transform: translateY(-2px);
  /* ลอยขึ้น 2px */
  box-shadow: 0 4px 6px rgba(246, 81, 137, 0.06);
  /* เพิ่มเงาสีชมพูอ่อนๆ ให้ดูเหมือนลอยอยู่จริงๆ */
}

.var-btn-icon-holder {
  width: 35px;
  height: 35px;
  background: #FFDFE9 0% 0% no-repeat padding-box;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-right: 12px;
}

.var-btn-icon {
  font: normal normal bold 21px/28px "TH Sarabun New", "Sarabun", sans-serif;
  color: #F65189;
}

.var-btn-text {
  font: normal normal normal 18px/24px "TH Sarabun New", "Sarabun", sans-serif;
  color: #000000;
  text-align: left;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ========================================================================= */
/* ── CSS ของเดิมสำหรับ Tab Assets และ Project ── */
/* ========================================================================= */
.tab-pane {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 0 23px;
}

.sidebar-toggle {
  position: absolute;
  right: -46px;
  top: 23px;
  width: 46px;
  height: 46px;
  background: white;
  border: 1px solid #e0e0e0;
  border-left: none;
  border-radius: 0 9px 9px 0;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: bold;
  box-shadow: 2px 2px 5px rgba(0, 0, 0, 0.05);
  z-index: 51;
  color: #333;
}

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
  margin-bottom: 23px;
}

.section h3 {
  margin-top: 0;
  margin-bottom: 12px;
  font-size: 16px;
  color: #666;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.btn-save,
.btn-new,
.btn-upload,
.btn-print {
  padding: 9px 14px;
  border: 1px solid transparent;
  border-radius: 5px;
  cursor: pointer;
  font-size: 16px;
  transition: all 0.2s;
  font-family: inherit;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-height: 41px;
  display: flex;
  align-items: center;
  justify-content: center;
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
  width: 298px;
  height: 46px;
  margin-top: 17px;
  background: #FFFFFF 0% 0% no-repeat padding-box;
  border: 1px dashed #F65189;
  border-radius: 5px;
  opacity: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  text-align: center;
  font: normal normal bold 20px/28px "TH Sarabun New", "Sarabun", sans-serif;
  color: #F65189;
  transition: all 0.2s ease;
}

.btn-new:hover {
  background: #FFF5F8;
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

.hint {
  font-size: 14px;
  color: #666;
  margin-top: 6px;
  font-style: italic;
}

input[type='text'],
input:not([type]),
select {
  width: 100%;
  padding: 9px;
  border: 1px solid #ccc;
  border-radius: 5px;
  font-family: inherit;
  color: #333;
  background: #fff;
}

/* ── Hover Effects ── */
.template-save-btn:hover:not(:disabled) {
  opacity: 0.9;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(246, 81, 137, 0.2);
}

.btn-history:hover {
  background: #FFF5F8;
}

.btn-history.active {
  background: #F65189;
}

.btn-history.active .btn-history-icon {
  background: transparent url('../assets/icons/history_white.png') center/contain no-repeat;
}

.btn-history.active .btn-history-text {
  color: #FFFFFF;
}

.template-item-row:hover .t-name {
  color: #F65189;
  text-decoration: underline;
}

.btn-del:hover {
  background: #f44336;
  color: white;
}

/* ── ไอคอนสำหรับแท็บรูปภาพ (Assets) ── */
.icon-image {
  background-image: url('../assets/icons/image.png');
}

.rail-btn.active .icon-image {
  background-image: url('../assets/icons/image-active.png');
}

.icon-image-header {
  background-image: url('../assets/icons/image-active.png');
}

/* ========================================================================= */
/* ── ส่วนของแท็บ "จัดการโปรเจกต์" (ดีไซน์ใหม่) ── */
/* ========================================================================= */

.tab-pane-project {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 15px;
  width: 100%;
}

.project-section {
  width: 298px;
  display: flex;
  flex-direction: column;
  margin-bottom: 20px;
}

/* ── 1. ปุ่มนำเข้าโปรเจกต์ (เส้นประปรับแต่งเอง) ── */
.btn-upload-dashed {
  width: 298px;
  height: 46px;
  background-color: #F8F9FA;
  background-image: url("data:image/svg+xml,%3csvg width='100%25' height='100%25' xmlns='http://www.w3.org/2000/svg'%3e%3crect width='100%25' height='100%25' fill='none' rx='5' ry='5' stroke='%23DEE2E6' stroke-width='2.5' stroke-dasharray='5, 12' stroke-dashoffset='0' stroke-linecap='square'/%3e%3c/svg%3e");
  border-radius: 6px;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.btn-upload-dashed:hover:not(:disabled) {
  background-color: #F1F3F5;
}

.btn-upload-dashed-icon {
  width: 20px;
  height: 20px;
  background: transparent url('../assets/icons/upload.svg') center/contain no-repeat;
}

.upload-icon-wrapper {
  position: relative;
  width: 14px;
  height: 13px;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.upload-icon-top {
  width: 6px;
  height: 10px;
  background: #546267;
  clip-path: polygon(50% 0%, 100% 35%, 75% 35%, 75% 100%, 25% 100%, 25% 35%, 0% 35%);
}

.upload-icon-bottom {
  position: absolute;
  bottom: 0;
  width: 14px;
  height: 4px;
  background: #546267;
}

.btn-upload-dashed-text {
  font: normal normal bold 21px/28px "TH Sarabun New", "Sarabun", sans-serif;
  color: #546267;
}

.hint-text {
  text-align: left;
  font: normal normal normal 18px/24px "TH Sarabun New", "Sarabun", sans-serif;
  color: #A4A4A4;
  margin: 6px 0 0 0;
}

/* ── 2. ปุ่มบันทึกโปรเจกต์ (สีชมพู) ── */
.btn-project-save {
  width: 298px;
  height: 46px;
  background: #F65189 0% 0% no-repeat padding-box;
  border-radius: 6px;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.btn-project-save:hover:not(:disabled) {
  opacity: 0.85;
  transform: translateY(-1px);
}

.btn-project-save-text {
  font: normal normal bold 18px/24px "TH Sarabun New", "Sarabun", sans-serif;
  /* 📌 16/21 * 1.15 */
  color: #FFFFFF;
}

/* ── เส้นคั่นบางๆ ── */
.divider-line {
  width: 298px;
  height: 1px;
  background: #F3F3F3;
  margin-bottom: 25px;
}

/* ── 3. กลุ่มตัวเลือก (Radio Cards) สำหรับ Quality และ Engine ── */
.radio-group-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  /* ระยะห่างระหว่างแต่ละกล่อง */
}

.radio-card {
  width: 298px;
  /* 📌 259 * 1.15 */
  height: 62px;
  /* 📌 54 * 1.15 */
  background: #FFFFFF 0% 0% no-repeat padding-box;
  border: 1px solid #E3E3E3;
  border-radius: 6px;
  display: flex;
  align-items: center;
  padding: 0 15px;
  cursor: pointer;
  transition: all 0.2s ease;
  box-sizing: border-box;
}

/* 📌 เพิ่ม Hover และอนิเมชันให้การ์ด */
.radio-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.05);
}

.radio-card:hover:not(.active) {
  border-color: #FFD5E3;
  /* ตอน hover ให้ขอบแอบเป็นสีชมพูอ่อนๆ */
}

/* 📌 สถานะเมื่อถูกเลือก (Active) */
.radio-card.active {
  background: #FFF9FB 0% 0% no-repeat padding-box;
  border: 1px solid #FFD5E3;
}

/* วงกลม Radio ด้านซ้าย */
.radio-circle {
  width: 20px;
  /* 📌 17 * 1.15 */
  height: 20px;
  /* 📌 17 * 1.15 */
  background: #FFFFFF 0% 0% no-repeat padding-box;
  border: 1px solid #E3E3E3;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: 12px;
  flex-shrink: 0;
}

.radio-card.active .radio-circle {
  border: 1px solid #F65189;
}

/* จุดสีชมพูตรงกลางเมื่อถูกเลือก */
.radio-inner {
  width: 12px;
  /* 📌 11 * 1.15 */
  height: 12px;
  background: #F65189 0% 0% no-repeat padding-box;
  border-radius: 50%;
}

/* พื้นที่ตัวหนังสือ 2 บรรทัด */
.radio-text-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.radio-title {
  text-align: left;
  font: normal normal bold 21px/28px "TH Sarabun New", "Sarabun", sans-serif;
  /* 📌 18/24 * 1.15 */
  color: #000000;
  line-height: 1;
  margin-bottom: 2px;
}

.radio-subtitle {
  text-align: left;
  font: normal normal normal 18px/24px "TH Sarabun New", "Sarabun", sans-serif;
  /* 📌 16/21 * 1.15 */
  color: #4D4D4D;
  line-height: 1;
}

/* 📌 ป้ายบอกตัวคูณ (1x, 2x, etc.) */
.radio-badge {
  width: 48px;
  /* 📌 42 * 1.15 */
  height: 24px;
  /* 📌 21 * 1.15 */
  background: #ECECEC 0% 0% no-repeat padding-box;
  border-radius: 12px;
  /* 📌 11 * 1.15 */
  display: flex;
  align-items: center;
  justify-content: center;

  font: normal normal bold 18px/24px "TH Sarabun New", "Sarabun", sans-serif;
  /* 📌 16/21 * 1.15 */
  color: #4D4D4D;
}

.radio-card.active .radio-badge {
  background: #FFD5E3 0% 0% no-repeat padding-box;
  color: #F65189;
}

/* ── 4. ปุ่มส่งออก PDF (กรอบชมพู พื้นขาว) ── */
.btn-print-outline {
  width: 298px;
  height: 46px;
  /* 📌 40 * 1.15 */
  background: #FFFFFF 0% 0% no-repeat padding-box;
  border: 1px solid #F65189;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-print-outline:hover:not(:disabled) {
  background: #FFF5F8;
}

.btn-print-outline:disabled {
  border-color: #ccc;
  color: #ccc;
  cursor: not-allowed;
}

.btn-print-text {
  font: normal normal bold 18px/24px "TH Sarabun New", "Sarabun", sans-serif;
  color: #F65189;
}

.btn-print-outline:disabled .btn-print-text {
  color: #ccc;
}

.icon-project {
  background-image: url('../assets/icons/project.png');
}

.rail-btn.active .icon-project {
  background-image: url('../assets/icons/project-active.png');
}

.icon-project-header {
  background-image: url('../assets/icons/project-active.png');
}

/* ── CSS สำหรับแท็บเลเยอร์ ── */
.tab-pane-layers {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 15px;
  width: 100%;
}

.layers-section {
  width: 298px;
  display: flex;
  flex-direction: column;
}

.layers-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  /* ระยะห่างระหว่างปุ่ม */
  width: 100%;
}

.layer-item-btn {
  width: 100%;
  height: 46px;
  padding: 0 15px;
  background: #F9F9F9;
  border: 1px solid #E3E3E3;
  border-radius: 6px;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s ease;
  font: normal normal normal 18px/24px "TH Sarabun New", "Sarabun", sans-serif;
  color: #333;
  display: flex;
  align-items: center;
}

.layer-item-btn:hover {
  background: #F0F0F0;
}

.layer-item-btn.active {
  background: #FFF5F8;
  border-color: #F65189;
  color: #F65189;
  font-weight: bold;
}
</style>