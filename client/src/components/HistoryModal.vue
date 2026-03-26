<template>
  <div class="modal-overlay" @click="$emit('close')">
    <div class="modal-content" @click.stop>

      <div class="modal-header">
        <h2 class="modal-header-text">ประวัติการสร้างรายงาน</h2>
        <button class="close-btn" @click="$emit('close')">×</button>
      </div>

      <div class="modal-body">
        <div v-if="reportInstances.length === 0" class="empty-state">
          <p>ยังไม่มีรายงานที่สร้างไว้</p>
        </div>

        <div v-else class="table-container">
          <table class="history-table">
            <thead>
              <tr class="table-row header-row">
                <th class="cell-center-bold" style="width: 60px;">#</th>
                <th class="cell-center-bold" style="width: 160px;">วันที่สร้าง</th>
                <th class="cell-center-bold">ชื่อเทมเพลต</th>
                <th class="cell-center-bold" style="width: 120px;">สถานะ</th>
                <th class="cell-center-bold" style="width: 180px;">จัดการ</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(instance, index) in reportInstances" :key="instance.id" class="table-row">

                <td class="cell-center">{{ index + 1 }}</td>
                <td class="cell-center">{{ formatDate(instance.createdAt) }}</td>

                <td class="cell-left template-cell">
                  {{ instance.template?.name || `รายงาน ${index + 1}` }}
                </td>

                <td class="cell-center status-cell">
                  <span :class="['status-text', getStatusDisplay(instance).cssClass]">
                    {{ getStatusDisplay(instance).text }}
                  </span>
                </td>

                <td class="cell-center">
                  <div class="action-buttons">
                    <button @click="editReport(instance)" class="btn-edit" title="แก้ไขรายงานนี้">
                      <span class="btn-edit-icon"></span>
                      <span class="btn-action-text">แก้ไข</span>
                    </button>
                    <button @click="$emit('delete', instance)" class="btn-delete" title="ลบข้อมูล">
                      <span class="btn-delete-icon"></span>
                      <span class="btn-action-text">ลบ</span>
                    </button>
                  </div>
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
  },
  currentInstanceId: {
    type: [String, Number],
    default: null
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

const getStatusDisplay = (instance) => {
  if (props.currentInstanceId && instance.id === props.currentInstanceId) {
    return { text: 'ใช้งาน', cssClass: 'inuse' };
  }

  const status = instance.status?.toLowerCase();
  if (status === 'completed') {
    return { text: 'ใช้งาน', cssClass: 'inuse' };
  }

  return { text: 'ฉบับร่าง', cssClass: 'draft' };
};

const downloadReport = async (instance) => {
  if (instance.pdfUrl) {
    try {
      const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
      const baseUrl = apiUrl.replace('/api', '');
      const fileUrl = `${baseUrl}${instance.pdfUrl}`;

      const fileName =
        instance.template?.name && instance.template.name.trim() !== ''
          ? `${instance.template.name.trim().replace(/[^a-zA-Z0-9ก-๙\s\-_]/g, '_')}.pdf`
          : `report_${instance.id.slice(-8)}.pdf`;

      const fileResponse = await axios.get(fileUrl, { responseType: 'blob' });
      const blobUrl = window.URL.createObjectURL(new Blob([fileResponse.data]));

      const link = document.createElement('a');
      link.href = blobUrl;
      link.setAttribute('download', fileName);
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();

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
* {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  z-index: 9999;
  padding-top: 3.5px;
}

.modal-content {
  position: relative;
  background: #FFFFFF 0% 0% no-repeat padding-box;
  border-radius: 0;
  margin-top: 0;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  width: max-content;
  max-width: 100vw;
  height: auto;
  max-height: 100vh;
  display: flex;
  flex-direction: column;
  opacity: 1;
}

.modal-header {
  display: flex;
  align-items: center;
  padding: 20px 30px;
  border-bottom: 1px solid #E3E3E3;
  width: 100%;
  box-sizing: border-box;
}

.modal-header h2,
.modal-header-text {
  text-align: left;
  font: normal normal bold 25px/35px "TH Sarabun New", "Sarabun", sans-serif;
  letter-spacing: 0px;
  color: #000000;
  margin: 0;
  opacity: 1;
}

.close-btn {
  position: absolute;
  top: 15px;
  right: 15px;
  width: 10px;
  height: 10px;
  background: transparent;
  border: none;
  font-size: 24px;
  color: #686868;
  cursor: pointer;
  padding: 0;
  margin: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  z-index: 10;
  opacity: 1;
}

.close-btn:hover {
  color: #E74C3C;
}

.modal-body {
  display: flex;
  flex-direction: column;
  padding: 20px 30px 40px 30px;
  overflow-y: auto;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: #666;
  font: normal normal normal 21px/28px "TH Sarabun New", "Sarabun", sans-serif;
}

.table-container {
  display: flex;
  overflow-x: auto;
}

.history-table {
  width: 1036px;
  border-collapse: collapse;
}

.history-table th,
.history-table td {
  border: 1px solid #E3E3E3;
  padding: 0 10px;
  vertical-align: middle;
}

.table-row {
  height: 53px;
  border: 1px solid #E3E3E3;
  opacity: 1;
  transition: background-color 0.2s;
}

.table-row:hover:not(.header-row) {
  background-color: #F9F9F9;
}

.cell-center-bold {
  text-align: center;
  font: normal normal bold 21px/28px "TH Sarabun New", "Sarabun", sans-serif;
  letter-spacing: 0px;
  color: #000000;
  opacity: 1;
}

.cell-center {
  text-align: center;
  font: normal normal normal 21px/28px "TH Sarabun New", "Sarabun", sans-serif;
  letter-spacing: 0px;
  color: #000000;
  opacity: 1;
}

.cell-left {
  text-align: left;
  font: normal normal normal 21px/28px "TH Sarabun New", "Sarabun", sans-serif;
  letter-spacing: 0px;
  color: #000000;
  padding-left: 15px !important;
  opacity: 1;
}

.status-text {
  font: normal normal bold 21px/28px "TH Sarabun New", "Sarabun", sans-serif;
  letter-spacing: 0px;
  opacity: 1;
}

.status-text.inuse {
  color: #349A53;
}

.status-text.draft {
  color: #F39C12;
}

.status-text.failed {
  color: #E74C3C;
}

.action-buttons {
  display: flex;
  justify-content: center;
  gap: 10px;
}

.btn-edit,
.btn-delete,
.btn-download {
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  cursor: pointer;
  transition: opacity 0.2s;
  opacity: 1;
}

.btn-edit:hover,
.btn-delete:hover,
.btn-download:hover {
  opacity: 0.85;
}

.btn-edit {
  width: 71px;
  height: 30px;
  background: #427EB1 0% 0% no-repeat padding-box;
  border-radius: 6px;
}

.btn-edit-icon {
  width: 14px;
  height: 14px;
  background: transparent url('../assets/icons/edit.png') center/contain no-repeat;
}

.btn-delete {
  width: 55px;
  height: 30px;
  background: #E74C3C 0% 0% no-repeat padding-box;
  border-radius: 6px;
}

.btn-delete-icon {
  width: 12px;
  height: 14px;
  background: transparent url('../assets/icons/delete.svg') center/contain no-repeat;
}

.btn-download {
  padding: 0 10px;
  height: 30px;
  border-radius: 6px;
  background: #2E7D32;
}

.btn-action-text {
  text-align: left;
  font: normal normal bold 18px/24px "TH Sarabun New", "Sarabun", sans-serif;
  letter-spacing: 0px;
  color: #FFFFFF;
  opacity: 1;
}

@media (max-width: 768px) {
  .modal-content {
    max-height: 100vh;
    width: 100%;
  }

  .modal-header,
  .modal-body {
    padding: 16px;
  }

  .action-buttons {
    flex-wrap: wrap;
  }
}
</style>