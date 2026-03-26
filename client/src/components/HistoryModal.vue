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
  // ถ้า ID ของแถวนี้ ตรงกับ ID ที่กำลังเปิดแก้ไขอยู่ ให้บังคับเป็น "ใช้งาน" ทันที
  if (props.currentInstanceId && instance.id === props.currentInstanceId) {
    return { text: 'ใช้งาน', cssClass: 'inuse' };
  }

  // ถ้าไม่ใช่ตัวที่กำลังเปิดอยู่ ก็เช็คตาม status ในฐานข้อมูล
  const status = instance.status?.toLowerCase();
  if (status === 'completed') {
    return { text: 'ใช้งาน', cssClass: 'inuse' };
  }

  // นอกนั้น (รวมถึง draft) ให้เป็นฉบับร่าง
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
/* ── บังคับฟอนต์ให้คมชัด ── */
* {
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* ── 1. พื้นหลัง (ดันกล่องชิดขอบบนสุด 0px) ── */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: flex-start;
  /* 📌 ดันกล่องขึ้นบนสุด */
  justify-content: center;
  z-index: 9999;
  padding-top: 3.5px;
}

/* ── 2. กล่องขาว (กรอบสี่เหลี่ยม, ชิดบน, ขนาดกางตามตารางเป๊ะ) ── */
.modal-content {
  position: relative;
  /* 📌 แกนอ้างอิงของกากบาท */
  background: #FFFFFF 0% 0% no-repeat padding-box;
  border-radius: 0;
  /* 📌 บังคับกรอบสี่เหลี่ยมมุมฉาก 100% */
  margin-top: 0;
  /* 📌 ชิดขอบบนสุด */
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);

  /* 📌 size scales with table's elements */
  width: max-content;
  max-width: 100vw;
  height: auto;
  max-height: 100vh;
  display: flex;
  flex-direction: column;
  opacity: 1;
}

/* ── 3. Header ── */
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
  /* 📌 22/30 * 1.15 */
  letter-spacing: 0px;
  color: #000000;
  margin: 0;
  opacity: 1;
}

/* ── 4. ปุ่มกากบาท (ลอยมุมขวาบนสุดของกล่องขาว) ── */
.close-btn {
  position: absolute;
  top: 15px;
  right: 15px;
  width: 10px;
  /* 📌 9px * 1.15 */
  height: 10px;
  /* 📌 9px * 1.15 */
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

/* ── 5. Body & Table Container ── */
.modal-body {
  display: flex;
  /* 📌 flex - size scales with table's elements */
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
  /* 📌 flex - size scales with table's size */
  overflow-x: auto;
}

.history-table {
  width: 1036px;
  /* 📌 901px * 1.15 = 1036px (กางตามสเปคตาราง) */
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
  /* 📌 46px * 1.15 = 53px */
  border: 1px solid #E3E3E3;
  opacity: 1;
  transition: background-color 0.2s;
}

.table-row:hover:not(.header-row) {
  background-color: #F9F9F9;
}

/* ── 6. Typography ── */
.cell-center-bold {
  text-align: center;
  font: normal normal bold 21px/28px "TH Sarabun New", "Sarabun", sans-serif;
  /* 📌 18/24 * 1.15 */
  letter-spacing: 0px;
  color: #000000;
  opacity: 1;
}

.cell-center {
  text-align: center;
  font: normal normal normal 21px/28px "TH Sarabun New", "Sarabun", sans-serif;
  /* 📌 18/24 * 1.15 */
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

/* ── 7. ปุ่มจัดการ ── */
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

/* ปุ่มแก้ไข */
.btn-edit {
  width: 71px;
  /* 📌 62px * 1.15 */
  height: 30px;
  /* 📌 26px * 1.15 */
  background: #427EB1 0% 0% no-repeat padding-box;
  border-radius: 6px;
  /* 📌 5px * 1.15 */
}

.btn-edit-icon {
  width: 14px;
  /* 📌 12px * 1.15 */
  height: 14px;
  /* 📌 12px * 1.15 */
  background: transparent url('../assets/icons/edit.png') center/contain no-repeat;
}

/* ปุ่มลบ */
.btn-delete {
  width: 55px;
  /* 📌 48px * 1.15 */
  height: 30px;
  /* 📌 26px * 1.15 */
  background: #E74C3C 0% 0% no-repeat padding-box;
  border-radius: 6px;
  /* 📌 5px * 1.15 */
}

.btn-delete-icon {
  width: 12px;
  /* 📌 10px * 1.15 = 11.5 ปัดเป็น 12px */
  height: 14px;
  /* 📌 12px * 1.15 = 13.8 ปัดเป็น 14px */
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
  /* 📌 16/21 * 1.15 */
  letter-spacing: 0px;
  color: #FFFFFF;
  opacity: 1;
}

/* ── 8. Responsive ── */
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