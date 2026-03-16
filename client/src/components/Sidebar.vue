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
          <span class="rail-icon icon-placeholder">📄</span>
          <span class="rail-label">จัดการหน้า</span>
        </button>

        <button @click="handleTabClick('data')" @mouseenter="handleMouseEnter('data')"
          :class="['rail-btn', { active: activeTab === 'data' && isOpen, pinned: isPinned && activeTab === 'data' }]">
          <span class="rail-icon icon-placeholder">📊</span>
          <span class="rail-label">ข้อมูล</span>
        </button>

        <button @click="handleTabClick('assets')" @mouseenter="handleMouseEnter('assets')"
          :class="['rail-btn', { active: activeTab === 'assets' && isOpen, pinned: isPinned && activeTab === 'assets' }]">
          <span class="rail-icon icon-placeholder">🖼️</span>
          <span class="rail-label">องค์ประกอบ</span>
        </button>

        <button @click="handleTabClick('project')" @mouseenter="handleMouseEnter('project')"
          :class="['rail-btn', { active: activeTab === 'project' && isOpen, pinned: isPinned && activeTab === 'project' }]">
          <span class="rail-icon icon-placeholder">💾</span>
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
        <h3 class="panel-header-text" v-if="activeTab === 'pages'">📄 จัดการหน้ากระดาษ</h3>
        <h3 class="panel-header-text" v-if="activeTab === 'data'">📊 จัดการข้อมูล</h3>
        <h3 class="panel-header-text" v-if="activeTab === 'assets'">🖼️ คลังรูปภาพ</h3>
        <h3 class="panel-header-text" v-if="activeTab === 'project'">💾 จัดการโปรเจกต์</h3>
      </div>

      <div class="panel-content">
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

        <div v-if="activeTab === 'data'" class="tab-pane">
          <div class="section" style="padding-bottom: 10px; border-bottom: 1px solid #eee; margin-bottom: 15px;">
            <h4 class="label-small">ข้อความทั่วไป:</h4>
            <button @click="handleAddCustomText" class="var-btn" :disabled="isPreviewMode" draggable="true"
              @dragstart="onCustomTextDragStart($event)">
              📝 ข้อความอิสระ (พิมพ์เอง)
            </button>
          </div>
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

        <div v-if="activeTab === 'assets'" class="tab-pane">
          <AssetManager :is-preview-mode="isPreviewMode" @select-asset="$emit('add-image', $event)" />
        </div>

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

            <div style="margin-bottom: 15px">
              <label class="label-small">รูปแบบการส่งออก (Engine):</label>
              <select :value="pdfMode" @change="$emit('update:pdfMode', $event.target.value)"
                style="width: 100%; padding: 6px; border-radius: 4px; border: 1px solid #ccc; background: #fff;">
                <option value="flatten">🌟 รูปภาพ (ถูกต้อง100%)</option>
                <option value="vector">📝 เวคเตอร์ (แก้ไขข้อความใน Acrobat ได้)</option>
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
  isHistoryOpen: Boolean,
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
  // Page Emits
  'delete-page',
  'add-page',
  'import-page',
  'page-click',
  'page-drop',
  'update:pdfMode'
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

const sanitizeTemplateName = (name) => {
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

  /* 📌 เพิ่ม 2 บรรทัดนี้เพื่อบังคับให้ตัวอักษรใน Sidebar ทั้งหมดคมกริบ */
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* ── 1. Vertical Rail (ดีไซน์ใหม่ 74px) ── */
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

/* ไอคอน Rail และการเรียกใช้รูป */
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

/* ── 2. Sliding Panel (ปรับความกว้างเป็น 286px ตาม Design) ── */
.sidebar-panel {
  width: 329px;
  /* 📌 ปรับความกว้างให้เป๊ะตาม Design */
  height: 100%;
  /* ใช้ 100% แทน 797px เพื่อให้ยืดหยุ่นตามหน้าจอ */
  background: #FFFFFF;
  border: 1px solid #F3F3F3;
  /* 📌 เพิ่มเส้นขอบตาม Design */
  display: flex;
  flex-direction: column;
  z-index: 51;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-sizing: border-box;
}

/* 📌 ปรับระยะตอนพับเก็บให้พอดีกับความกว้างใหม่ (ซ่อนไป 330px รวมขอบ) */
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
  /* 📌 ลด Padding ซ้ายขวาลงนิดหน่อยเพื่อให้พอดีกับกล่องที่แคบลง */
  border-bottom: 1px solid #F3F3F3;
}

.panel-header-title {
  display: flex;
  align-items: center;
  gap: 9px;
}

.panel-header-icon {
  width: 18px;
  height: 18px;
  background: transparent url('../assets/icons/dashboard-active.png') center/contain no-repeat;
}

.panel-header-text {
  font: normal normal bold 20px/28px "TH Sarabun New", "Sarabun", sans-serif;
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

/* 📌 ส่วนเนื้อหาด้านใน */
.panel-content {
  flex: 1;
  width: 100%;
  overflow-y: auto;
  padding: 28px 0;
}

/* ── 3. Templates Tab Content (ดีไซน์ใหม่) ── */
.tab-pane-templates {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.history-section {
  width: 298px;
}

.btn-history-header {
  width: 81px;
  height: 26px;
  text-align: left;
  font: normal normal normal 20px/28px "TH Sarabun New", "Sarabun", sans-serif;
  letter-spacing: 0px;
  color: #000000;
  opacity: 1;
  margin-bottom: 9px;
  /* ระยะห่างจากปุ่ม */
  white-space: nowrap;
  /* 📌 ป้องกันตกบรรทัด */
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

/* กล่องเทา (Save Pane) */
.template-save-pane {
  width: 298px;
  min-height: 192px;
  /* ใช้ min-height เผื่อรายชื่อเทมเพลตยาวขึ้น */
  background: #F9F9F9 0% 0% no-repeat padding-box;
  border: 1px solid #E8E8E8;
  border-radius: 5px;
  opacity: 1;
  margin-top: 18px;
  /* ระยะห่างจากปุ่มประวัติ */
  display: flex;
  flex-direction: column;
  align-items: center;
  /* จัดให้ inner อยู่ตรงกลาง */
  padding: 12px 0 20px 0;
  /* กะขอบบนล่างให้พอดี */
  box-sizing: border-box;
}

.save-pane-inner {
  width: 268px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  /* บังคับให้ทุกอย่างในนี้ชิดซ้ายเป๊ะๆ */
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

/* ── Label & Input ── */
.template-label-small {
  width: 105px;
  height: 24px;
  text-align: left;
  font: normal normal normal 18px/24px "TH Sarabun New", "Sarabun", sans-serif;
  letter-spacing: 0px;
  color: #000000;
  opacity: 1;
  margin-top: 0px;
  /* ระยะห่างระหว่าง t-name กับ label */
}

.template-name-input {
  width: 268px;
  height: 46px;
  background: #FFFFFF 0% 0% no-repeat padding-box;
  border: 1px solid #E3E3E3;
  border-radius: 5px;
  opacity: 1;
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

/* ── ปุ่ม Save ── */
.template-save-btn {
  width: 268px;
  height: 46px;
  background: #F65189 0% 0% no-repeat padding-box;
  border-radius: 5px;
  opacity: 1;
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
  letter-spacing: 0px;
  color: #FFFFFF;
  opacity: 1;
}

.t-name {
  text-align: left;
  font: normal normal bold 20px/28px "TH Sarabun New", "Sarabun", sans-serif;
  letter-spacing: 0px;
  color: #000000;
  opacity: 1;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 219px;
  /* เว้นที่ให้ปุ่ม x */
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
}

.icon-delete {
  width: 16px;
  height: 16px;
  background: transparent url('../assets/icons/delete.svg') 0% 0% no-repeat padding-box;
  background-size: contain;
}

/* ========================================================================= */
/* ── CSS ของเดิมสำหรับ Tab Pages, Data, Assets, Project (เก็บไว้ครบ 100%) ── */
/* ========================================================================= */
.tab-pane {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 0 23px;
}

/* ── Pages Rail/Panel Styles ── */
.pages-list {
  flex: 1;
  overflow-y: auto;
  padding-right: 6px;
}

.page-item-sidebar {
  padding: 9px;
  border: 2px solid transparent;
  border-radius: 9px;
  margin-bottom: 14px;
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
  gap: 17px;
}

.page-thumb {
  position: relative;
  width: 69px;
  height: 98px;
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
  top: -7px;
  right: -7px;
  background: #f44336;
  color: white;
  border-radius: 50%;
  width: 21px;
  height: 21px;
  line-height: 21px;
  text-align: center;
  font-size: 14px;
  display: none;
}

.page-item-sidebar:hover .del-page-btn {
  display: block;
}

.page-info {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.page-title {
  font-size: 16px;
  font-weight: 700;
  color: #333;
}

.add-page-actions-sidebar {
  margin-top: 17px;
  padding-top: 17px;
  border-top: 1px solid #eee;
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.add-pg-btn {
  width: 100%;
  padding: 12px;
  background: #2196f3;
  color: white;
  border: none;
  border-radius: 7px;
  cursor: pointer;
  font-size: 15px;
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

.section.master-templates {
  background: #f8f9fa;
  padding: 14px;
  border-radius: 7px;
  border: 1px solid #eee;
}

.section.mode-selector {
  background: #fff;
  padding: 14px;
  border-radius: 7px;
  border: 1px solid #2196f3;
}

.template-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 7px 0;
  border-bottom: 1px solid #eee;
}

.btn-save,
.btn-new,
.btn-mode-toggle,
.btn-upload,
.btn-print,
.var-btn {
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
  width: 298px;
  /* กว้างเท่ากล่อง template-save-pane เป๊ะ */
  height: 46px;
  margin-top: 17px;
  /* ระยะห่างปรับอิงตามขอบล่างของกล่องเทา (dynamic) */
  background: #FFFFFF 0% 0% no-repeat padding-box;
  border: 1px dashed #F65189;
  /* ใช้เส้นประสีชมพูให้ดูเป็นปุ่ม 'สร้างใหม่' */
  border-radius: 5px;
  opacity: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;

  /* จัดฟอนต์ให้อยู่กึ่งกลาง */
  text-align: center;
  font: normal normal bold 20px/28px "TH Sarabun New", "Sarabun", sans-serif;
  letter-spacing: 0px;
  color: #F65189;
  /* ใช้สีชมพูให้เข้ากับธีม */
  transition: all 0.2s ease;
}

.btn-new:hover {
  background: #FFF5F8;
  /* เอฟเฟกต์ตอนเอาเมาส์ชี้ */
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
  gap: 6px;
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
  font-size: 14px;
  color: #666;
  margin-top: 6px;
  font-style: italic;
}

.label-small {
  font-size: 14px;
  font-weight: 700;
  color: #444;
  margin-bottom: 5px;
  display: block;
}

.category-header {
  font-size: 15px;
  color: #444;
  margin: 12px 0 6px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

input[type='text'],
input:not([type]) {
  width: 100%;
  padding: 9px;
  border: 1px solid #ccc;
  border-radius: 5px;
  font-family: inherit;
  color: #333;
  background: #fff;
}

/* ========================================== */
/* 5. เก็บตก Hover Effects & Scrollbar */
/* ========================================== */

/* เอฟเฟกต์ตอนเอาเมาส์ชี้ปุ่มบันทึก */
.template-save-btn:hover:not(:disabled) {
  opacity: 0.9;
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(246, 81, 137, 0.2);
}

/* เอฟเฟกต์ตอนชี้ปุ่มประวัติรายงาน */
.btn-history:hover {
  background: #FFF5F8;
}

.btn-history.active {
  background: #F65189;
}

.btn-history.active .btn-history-icon {
  /* 📌 สลับเป็นไอคอนสีขาว */
  background: transparent url('../assets/icons/history.png') center/contain no-repeat;
}

.btn-history.active .btn-history-text {
  /* 📌 สลับเป็นตัวอักษรสีขาว */
  color: #FFFFFF;
}

/* ทำให้รายชื่อเทมเพลตดูเป็นปุ่มกดได้ชัดเจนขึ้น */
.template-item-row:hover .t-name {
  color: #F65189;
  /* เปลี่ยนสีเป็นสีชมพูตอนเมาส์ชี้ */
  text-decoration: underline;
}

.btn-del:hover {
  background: #f44336;
  color: white;
}
</style>
