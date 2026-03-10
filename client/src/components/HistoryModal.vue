<template>
  <div class="modal-overlay" @click="$emit('close')">
    <div class="modal-content" @click.stop>
      <div class="modal-header">
        <h2>📜 ประวัติการสร้างรายงาน</h2>
        <button class="close-btn" @click="$emit('close')">×</button>
      </div>

      <div class="modal-body">
        <div v-if="reportInstances.length === 0" class="empty-state">
          <p>ยังไม่มีรายงานที่สร้างไว้</p>
        </div>

        <div v-else class="table-container">
          <table class="history-table">
            <thead>
              <tr>
                <th>วันที่/เวลา</th>
                <th>ชื่อเทมเพลต</th>
                <th>สถานะ</th>
                <th>จัดการ</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="instance in reportInstances" :key="instance.id">
                <td class="date-cell">{{ formatDate(instance.createdAt) }}</td>
                <td class="template-cell">
                  {{ instance.template?.name || `รายงาน #${instance.id.slice(-8)}` }}
                </td>
                <td class="status-cell">
                  <span :class="['status-badge', instance.status.toLowerCase()]">
                    <span v-if="instance.status === 'completed'" class="status-icon">✅</span>
                    <span v-else-if="instance.status === 'draft'" class="status-icon">📝</span>
                    <span v-else-if="instance.status === 'failed'" class="status-icon">❌</span>
                    {{ getStatusText(instance.status) }}
                  </span>
                </td>
                <td class="actions-cell">
                  <button v-if="instance.pdfUrl" @click="downloadReport(instance)" class="btn-download"
                    title="ดาวน์โหลดไฟล์ PDF">
                    📥 ดาวน์โหลด
                  </button>
                  <button @click="editReport(instance)" class="btn-edit" title="แก้ไขรายงานนี้">
                    ✏️ แก้ไข
                  </button>
                  <button @click="$emit('delete', instance)" class="btn-delete" title="ลบข้อมูล">
                    🗑️ ลบ
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>

import axios from 'axios';

const props = defineProps({
  reportInstances: {
    type: Array,
    default: () => []
  }
});

const emit = defineEmits(['close', 'edit', 'download', 'delete']);

const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleString('th-TH', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
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

const downloadReport = async (instance) => {
  if (instance.pdfUrl) {
    try {
      // Construct the file URL correctly (remove /api from API URL)
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
      const baseUrl = apiUrl.replace('/api', '');
      const fileUrl = `${baseUrl}${instance.pdfUrl}`;

      // Generate filename based on template name
      const fileName =
        instance.template?.name && instance.template.name.trim() !== ''
          ? `${instance.template.name.trim().replace(/[^a-zA-Z0-9ก-๙\s\-_]/g, '_')}.pdf`
          : `report_${instance.id.slice(-8)}.pdf`;

      // Fetch the file content as a Blob
      const fileResponse = await axios.get(fileUrl, { responseType: 'blob' });

      // Create a local Blob URL (same-origin, so download attribute works)
      const blobUrl = window.URL.createObjectURL(new Blob([fileResponse.data]));

      // Trigger Download
      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', fileName);
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();

      // Cleanup
      setTimeout(() => {
        document.body.removeChild(link);
        window.URL.revokeObjectURL(blobUrl);
      }, 100);
    } catch (downloadError) {
      console.error('Download error:', downloadError);
      alert('ไม่สามารถดาวน์โหลด PDF ได้ โปรดลองอีกครั้ง');
    }
  } else {
    alert('ไม่พบไฟล์ PDF สำหรับรายงานนี้');
  }
};

const editReport = (instance) => {
  emit('edit', instance);
};
</script>

<style scoped>
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: 20px;
}

.modal-content {
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
  max-width: 900px;
  width: 100%;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 24px;
  border-bottom: 1px solid #e0e0e0;
  background: #f8f9fa;
}

.modal-header h2 {
  margin: 0;
  color: #333;
  font-size: 24px;
  font-weight: 600;
}

.close-btn {
  background: none;
  border: none;
  font-size: 28px;
  color: #666;
  cursor: pointer;
  padding: 0;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s ease;
}

.close-btn:hover {
  background: #e0e0e0;
  color: #333;
}

.modal-body {
  padding: 24px;
  overflow-y: auto;
  flex: 1;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: #666;
  font-style: italic;
}

.table-container {
  overflow-x: auto;
}

.history-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.history-table th {
  background: #f8f9fa;
  padding: 12px;
  text-align: left;
  font-weight: 600;
  color: #333;
  border-bottom: 2px solid #e0e0e0;
}

.history-table td {
  padding: 12px;
  border-bottom: 1px solid #e0e0e0;
  vertical-align: middle;
}

.history-table tr:hover {
  background: #f8f9fa;
}

.date-cell {
  font-size: 13px;
  color: #666;
  white-space: nowrap;
}

.template-cell {
  font-weight: 500;
  color: #333;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-cell {
  text-align: center;
}

.status-badge {
  font-size: 11px;
  padding: 4px 8px;
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

.status-badge.draft {
  background: #fff3cd;
  color: #856404;
  border-color: #ffeaa7;
}

.status-badge.completed {
  background: #d4edda;
  color: #155724;
  border-color: #c3e6cb;
}

.status-badge.failed {
  background: #f8d7da;
  color: #721c24;
  border-color: #f5c6cb;
}

.actions-cell {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.btn-download,
.btn-edit {
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  font-size: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  white-space: nowrap;
}

.btn-download {
  background: #e8f5e8;
  color: #2e7d32;
}

.btn-download:hover {
  background: #c8e6c9;
}

.btn-edit {
  background: #e3f2fd;
  color: #1976d2;
}

.btn-edit:hover {
  background: #bbdefb;
}

.btn-delete {
  background: #ffebee;
  color: #c62828;
}

.btn-delete:hover {
  background: #ffcdd2;
}

/* Responsive */
@media (max-width: 768px) {
  .modal-content {
    margin: 0;
    max-height: 100vh;
    border-radius: 0;
  }

  .modal-header {
    padding: 16px;
  }

  .modal-header h2 {
    font-size: 20px;
  }

  .modal-body {
    padding: 16px;
  }

  .history-table {
    font-size: 12px;
  }

  .history-table th,
  .history-table td {
    padding: 8px;
  }

  .actions-cell {
    flex-direction: column;
    gap: 4px;
  }

  .btn-download,
  .btn-edit {
    font-size: 11px;
    padding: 4px 8px;
  }
}
</style>
