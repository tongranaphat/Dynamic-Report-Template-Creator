<template>
  <div class="history-section">
    <h3>📋 ประวัติรายงานที่สร้าง</h3>
    <div v-if="reportInstances.length === 0" class="hint">ยังไม่มีรายงานที่สร้างไว้</div>
    <div v-else class="report-list">
      <div v-for="instance in reportInstances" :key="instance.id" class="report-item">
        <div class="report-info">
          <div class="report-name">{{ getReportName(instance) }}</div>
          <div class="report-meta">
            <span class="report-date">{{ formatDate(instance.createdAt) }}</span>
            <span :class="['report-status', instance.status.toLowerCase()]">
              <span v-if="instance.status === 'completed'" class="status-icon">✅</span>
              <span v-else-if="instance.status === 'draft'" class="status-icon">📝</span>
              <span v-else-if="instance.status === 'failed'" class="status-icon">❌</span>
              {{ getStatusText(instance.status) }}
            </span>
          </div>
          <div v-if="instance.template" class="template-name">
            เทมเพลต: {{ instance.template.name }}
          </div>
        </div>
        <div class="report-actions">
          <button @click="editReport(instance)" class="btn-edit" :disabled="!isCanvasReady" title="แก้ไขข้อมูล">
            ✏️ แก้ไขข้อมูล
          </button>
          <button v-if="instance.pdfUrl" @click="downloadReport(instance)" class="btn-download" title="ดาวน์โหลด PDF">
            📥 ดาวน์โหลด
          </button>
          <button @click="deleteReport(instance)" class="btn-delete" :disabled="!isCanvasReady" title="ลบรายงาน">
            🗑️ ลบ
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>


const props = defineProps({
  reportInstances: {
    type: Array,
    default: () => []
  },
  isCanvasReady: {
    type: Boolean,
    default: true
  }
});

const emit = defineEmits(['edit-report', 'download-report', 'delete-report']);

const getReportName = (instance) => {
  if (instance.template && instance.template.name) {
    return instance.template.name;
  }
  return `รายงาน #${instance.id.slice(-8)}`;
};

const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

const getStatusText = (status) => {
  const statusMap = {
    draft: 'ฉบับร่าง',
    completed: 'เสร็จสมบูรณ์',
    failed: 'ล้มเหลว'
  };
  return statusMap[status] || status;
};

const editReport = (instance) => {
  emit('edit-report', instance);
};

const downloadReport = (instance) => {
  emit('download-report', instance);
};

const deleteReport = (instance) => {
  if (confirm(`คุณต้องการลบรายงาน "${getReportName(instance)}" ใช่หรือไม่?`)) {
    emit('delete-report', instance);
  }
};
</script>

<style scoped>
.history-section {
  background: #f8f9fa;
  padding: 15px;
  border-radius: 8px;
  border: 1px solid #e0e0e0;
  margin-bottom: 20px;
}

.history-section h3 {
  margin: 0 0 15px 0;
  color: #333;
  font-size: 16px;
  font-weight: 600;
}

.hint {
  color: #666;
  font-style: italic;
  text-align: center;
  padding: 20px 0;
}

.report-list {
  max-height: 400px;
  overflow-y: auto;
}

.report-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  margin-bottom: 8px;
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  transition: all 0.2s ease;
}

.report-item:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  border-color: #2196f3;
}

.report-info {
  flex: 1;
  min-width: 0;
}

.report-name {
  font-weight: 600;
  color: #333;
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.report-meta {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 4px;
}

.report-date {
  font-size: 12px;
  color: #666;
}

.report-status {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 12px;
  font-weight: 500;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 1px solid;
}

.status-icon {
  font-size: 10px;
}

.report-status.draft {
  background: #fff3cd;
  color: #856404;
  border-color: #ffeaa7;
}

.report-status.completed {
  background: #d4edda;
  color: #155724;
  border-color: #c3e6cb;
}

.report-status.failed {
  background: #f8d7da;
  color: #721c24;
  border-color: #f5c6cb;
}

.template-name {
  font-size: 12px;
  color: #888;
}

.report-actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.btn-edit,
.btn-download,
.btn-delete {
  padding: 6px 10px;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.btn-edit {
  background: #e3f2fd;
  color: #1976d2;
}

.btn-edit:hover:not(:disabled) {
  background: #bbdefb;
}

.btn-download {
  background: #e8f5e8;
  color: #2e7d32;
}

.btn-download:hover {
  background: #c8e6c9;
}

.btn-delete {
  background: #ffebee;
  color: #c62828;
}

.btn-delete:hover:not(:disabled) {
  background: #ffcdd2;
}

.btn-edit:disabled,
.btn-delete:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

/* Scrollbar styling */
.report-list::-webkit-scrollbar {
  width: 6px;
}

.report-list::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.report-list::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.report-list::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}
</style>
