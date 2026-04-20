<template>
  <Transition name="overlay-fade">
    <div v-if="visible" class="export-overlay">
      <div class="overlay-card">
        <div class="spinner"></div>
        <h3 class="overlay-title">{{ title }}</h3>
        <div class="progress-bar-track">
          <div class="progress-bar-fill" :style="{ width: progress + '%' }"></div>
        </div>
        <p class="progress-text">{{ progressLabel }}</p>
      </div>
    </div>
  </Transition>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  visible: { type: Boolean, default: false },
  title: { type: String, default: 'กำลังประมวลผล...' },
  current: { type: Number, default: 0 },
  total: { type: Number, default: 1 },
  stage: { type: String, default: '' }
});

const progress = computed(() => {
  if (props.total <= 0) return 0;
  return Math.round((props.current / props.total) * 100);
});

const progressLabel = computed(() => {
  if (props.stage) return props.stage;
  if (props.total <= 1) return 'กำลังเตรียมข้อมูล...';
  return `หน้า ${props.current} / ${props.total} (${progress.value}%)`;
});
</script>

<style scoped>
.export-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}

.overlay-card {
  background: #fff;
  border-radius: 16px;
  padding: 40px 48px;
  min-width: 340px;
  max-width: 420px;
  text-align: center;
  box-shadow: 0 16px 48px rgba(0, 0, 0, 0.18);
}

.spinner {
  width: 44px;
  height: 44px;
  border: 4px solid #e3e3e3;
  border-top-color: #2196f3;
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  margin: 0 auto 20px;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.overlay-title {
  font:
    normal normal bold 24px/32px 'TH Sarabun New',
    'Sarabun',
    sans-serif;
  color: #333;
  margin: 0 0 20px;
}

.progress-bar-track {
  width: 100%;
  height: 8px;
  background: #e8e8e8;
  border-radius: 4px;
  overflow: hidden;
}

.progress-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, #2196f3, #42a5f5);
  border-radius: 4px;
  transition: width 0.3s ease;
}

.progress-text {
  font:
    normal normal normal 20px/28px 'TH Sarabun New',
    'Sarabun',
    sans-serif;
  color: #666;
  margin: 12px 0 0;
}

.overlay-fade-enter-active,
.overlay-fade-leave-active {
  transition: opacity 0.25s ease;
}
.overlay-fade-enter-from,
.overlay-fade-leave-to {
  opacity: 0;
}
</style>
