<template>
  <aside class="pages-sidebar" :class="{ collapsed: !isOpen }">
    <button class="sidebar-toggle" @click="$emit('toggle')">{{ isOpen ? '◀' : '▶' }} 📄 จัดการหน้า</button>
    <div class="sidebar-content" v-show="isOpen">
      <h3>📄 หน้าตัวอย่าง (ลากเพื่อสลับลำดับ)</h3>
      <div class="pages-list" @mouseleave="clearDragState">
        <div v-for="(page, index) in pages" :key="page.id" :class="[
          'page-item',
          {
            active: isOpen && currentPageIndex === index,
            disabled: !isCanvasReady,
            dragging: draggedPageIndex === index,
            'drag-target-top': dragOverIndex === index && dragPosition === 'top',
            'drag-target-bottom': dragOverIndex === index && dragPosition === 'bottom'
          }
        ]" draggable="true" @dragstart="onPageDragStart($event, index)"
          @dragover.prevent="onPageDragOver($event, index)" @drop="onPageDrop($event, index)" @dragend="onPageDragEnd"
          @click="isCanvasReady ? $emit('page-click', index) : null">
          <div class="page-thumbnail">
            <img :src="page.background || getDefaultPageImage(index)" :alt="`Page ${index + 1}`" />
            <div class="delete-btn" @click.stop="isCanvasReady ? $emit('delete-page', index) : null"
              v-if="pages.length > 1">
              ×
            </div>
          </div>
          <span class="page-number">หน้า {{ index + 1 }}</span>
        </div>
      </div>

      <div class="add-page-actions">
        <button class="add-page-btn" @click="isCanvasReady ? $emit('add-page') : null" :disabled="!isCanvasReady">
          + เพิ่มหน้าว่างใหม่
        </button>
        <input type="file" ref="appendInput" @change="onAppendFileChange"
          accept="application/pdf, image/jpeg, image/png, image/gif, image/webp" style="display: none" />
        <button class="add-page-btn secondary" @click="triggerAppendUpload" :disabled="!isCanvasReady">
          + นำเข้าหน้าใหม่
        </button>
      </div>
    </div>
  </aside>
</template>

<script setup>
import { ref } from 'vue';

const props = defineProps({
  pages: Array,
  currentPageIndex: Number,
  isOpen: Boolean,
  isCanvasReady: Boolean
});

const emit = defineEmits([
  'toggle',
  'delete-page',
  'add-page',
  'import-page',
  'page-click',
  'page-drop'
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
</script>

<style scoped>
.pages-sidebar {
  position: fixed;
  right: 0;
  top: 60px;
  bottom: 0;
  width: 280px;
  background: white;
  border-left: 1px solid #e0e0e0;
  display: flex;
  flex-direction: column;
  z-index: 60;
  box-shadow: -2px 0 10px rgba(0, 0, 0, 0.05);
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.pages-sidebar.collapsed {
  transform: translateX(280px);
  /* ซ่อน Panel */
}

/* ปุ่ม Toggle ยื่นออกมาจาก Panel */
.sidebar-toggle {
  position: absolute;
  left: -85px;
  /* ยื่นออกมาทางซ้ายเพิ่มขึ้นเพื่อให้ข้อความไม่เบียด */
  top: 20px;
  width: 85px;
  height: 40px;
  background: white;
  border: 1px solid #e0e0e0;
  border-right: none;
  border-radius: 8px 0 0 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: bold;
  box-shadow: -2px 2px 5px rgba(0, 0, 0, 0.05);
  z-index: 61;
  color: #333;
  /* Explicit dark color */
}

.sidebar-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 20px;
  overflow: hidden;
}

.sidebar-content h3 {
  margin-top: 0;
  margin-bottom: 15px;
  font-size: 16px;
  font-weight: 700;
  color: #333;
}

.pages-list {
  flex: 1;
  overflow-y: auto;
  margin-top: 10px;
  padding-right: 5px;
}

.page-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px;
  border: 2px solid transparent;
  border-radius: 6px;
  margin-bottom: 15px;
  cursor: pointer;
  transition: all 0.2s;
  background: #f9f9f9;
}

.page-item:hover {
  background: #f0f0f0;
}

.page-item.active {
  border-color: #2196f3;
  background: #e3f2fd;
}

.page-item.dragging {
  opacity: 0.5;
  border: 2px dashed #999;
}

.page-item.drag-target-top {
  border-top: 3px solid #2196f3;
}

.page-item.drag-target-bottom {
  border-bottom: 3px solid #2196f3;
}

.page-thumbnail {
  position: relative;
  width: 80px;
  height: 113px;
  /* A4 Ratio */
  background: #fff;
  border: 1px solid #ddd;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  margin-bottom: 8px;
}

.page-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}

.page-number {
  font-size: 13px;
  font-weight: 600;
  color: #333;
  margin-top: 5px;
}

.delete-btn {
  position: absolute;
  top: -8px;
  right: -8px;
  background: red;
  color: white;
  border-radius: 50%;
  width: 20px;
  height: 20px;
  text-align: center;
  line-height: 20px;
  font-size: 14px;
  cursor: pointer;
  display: none;
}

.page-item:hover .delete-btn {
  display: block;
}

.add-page-actions {
  margin-top: 10px;
  padding-top: 15px;
  border-top: 1px solid #eee;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.add-page-btn {
  width: 100%;
  padding: 8px;
  background: #2196f3;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
}

.add-page-btn.secondary {
  background: #607d8b;
}

.add-page-btn:disabled {
  background: #ccc;
}
</style>
