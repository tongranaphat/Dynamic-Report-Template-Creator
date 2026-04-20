<template>
  <header class="top-navbar">
    <div class="navbar-left">
      <h1 class="app-title" @click="$emit('go-home')" style="cursor: pointer" title="หน้าหลัก">
        สร้างเทมเพลตรายงาน
      </h1>
    </div>

    <div class="navbar-right">
      <div class="undo-redo-group">
        <button @click="$emit('undo')" class="action-btn-text" title="ย้อนกลับ"></button>
        <button @click="$emit('redo')" class="action-btn-text" title="ทำซ้ำ"></button>
      </div>
      <div class="zoom-group">
        <button @click="$emit('zoom-out')" class="btn-zoom-out" title="ซูมออก">
          <span class="zoom-out-icon"></span>
        </button>

        <div class="zoom-value-box">
          <span class="zoom-value-text">{{ Math.round(zoomLevel * 100) }}%</span>
        </div>

        <button @click="$emit('zoom-in')" class="btn-zoom-in" title="ซูมเข้า">
          <span class="zoom-in-icon"></span>
        </button>
      </div>

      <div class="undo-redo-group">
        <button @click="$emit('undo')" class="action-btn-text" title="ย้อนกลับ">
          <span class="icon-undo"></span>
          <span class="action-text">ย้อนกลับ</span>
        </button>
        <button @click="$emit('redo')" class="action-btn-text" title="ทำซ้ำ">
          <span class="icon-redo"></span>
          <span class="action-text">ทำซ้ำ</span>
        </button>
      </div>

      <div class="divider-v"></div>

      <div class="mode-group">
        <button @click="$emit('toggle-preview')" class="preview-btn" :disabled="isGenerating">
          <span :class="isPreviewMode ? 'icon-edit' : 'icon-eye'"></span>
          <span class="preview-text">
            {{ isGenerating ? 'สร้าง...' : isPreviewMode ? 'แก้ไข' : 'ดูตัวอย่าง' }}
          </span>
        </button>
      </div>
    </div>
  </header>
</template>

<script setup>
defineProps({
  zoomLevel: {
    type: Number,
    required: true
  },
  isPreviewMode: {
    type: Boolean,
    default: false
  },
  isGenerating: {
    type: Boolean,
    default: false
  }
});

defineEmits(['go-home', 'undo', 'redo', 'zoom-in', 'zoom-out', 'toggle-preview']);
</script>

<style scoped>
.top-navbar {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 69px;
  background: #ffffff;
  border-top: 3.5px solid #2196f3;
  border-bottom: 1px solid #e3e3e3;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 46px;
  z-index: 1000;
  box-sizing: border-box;

  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.navbar-left {
  display: flex;
  align-items: center;
  height: 100%;
}

.app-title {
  text-align: left;
  font:
    normal normal bold 26px/34px 'TH Sarabun New',
    'Sarabun',
    sans-serif;
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
}

.zoom-out-icon {
  width: 13px;
  height: 1px;
  background: #4d4d4d;
}

.zoom-value-box {
  width: 72px;
  height: 39px;
  background: #ffffff;
  border: 1px solid #e3e3e3;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.zoom-value-text {
  width: 35px;
  height: 26px;
  text-align: center;
  font:
    normal normal normal 20px/28px 'TH Sarabun New',
    'Sarabun',
    sans-serif;
  color: #000000;
  margin-top: 1px;
}

.btn-zoom-in {
  width: 23px;
  height: 23px;
  margin-left: 12px;
}

.zoom-in-icon {
  position: relative;
  width: 9px;
  height: 9px;
}

.zoom-in-icon::before,
.zoom-in-icon::after {
  content: '';
  position: absolute;
  background: #4d4d4d;
}

.zoom-in-icon::before {
  top: 4px;
  left: 0;
  width: 9px;
  height: 1px;
}

.zoom-in-icon::after {
  top: 0;
  left: 4px;
  width: 1px;
  height: 9px;
}

.undo-redo-group {
  display: flex;
  align-items: center;
  margin-left: 24px;
  gap: 24px;
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

.action-text {
  height: 26px;
  text-align: left;
  font:
    normal normal normal 20px/28px 'TH Sarabun New',
    'Sarabun',
    sans-serif;
  color: #000000;
  white-space: nowrap;
}

.divider-v {
  width: 1px;
  height: 49px;
  background: #e3e3e3;
  margin: 0 32px 0 46px;
}

.mode-group {
  display: flex;
  align-items: center;
}

.preview-btn {
  width: 105px;
  height: 39px;
  background: #f65189;
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

.preview-text {
  height: 26px;
  text-align: left;
  font:
    normal normal normal 20px/28px 'TH Sarabun New',
    'Sarabun',
    sans-serif;
  color: #ffffff;
  white-space: nowrap;
}
</style>
