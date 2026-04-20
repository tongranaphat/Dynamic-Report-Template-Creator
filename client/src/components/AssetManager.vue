<template>
  <div class="asset-manager">
    <div class="upload-section">
      <input type="file" ref="fileInput" @change="uploadAsset" accept="image/jpeg, image/png" style="display: none" />
      <button class="btn-upload" @click="$refs.fileInput.click()" :disabled="isPreviewMode">
        <span class="btn-upload-text">อัปโหลดรูปภาพ</span>
      </button>
      <div class="btn-upload-hint">รองรับ JPG, PNG</div>
    </div>

    <div class="asset-list-header">
      <h4 class="label-small">รูปภาพที่อัปโหลด:</h4>
    </div>

    <div v-if="loading" class="loading">กำลังโหลด...</div>

    <div class="asset-grid" v-else>
      <div v-for="(asset, index) in assets" :key="index" :class="['asset-item', { disabled: isPreviewMode }]"
        :draggable="!isPreviewMode" @dragstart="onDragStart($event, asset)" @click="selectAsset(asset)">
        <img :src="asset.url" :alt="asset.name" />

        <button class="btn-del" @click.stop="deleteAsset(asset)" v-if="!isPreviewMode">
          <span class="icon-delete"></span>
        </button>
      </div>

      <div v-if="assets.length === 0" class="empty-state">ยังไม่มีรูปภาพในคลัง</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import apiService from '../services/apiService';

const props = defineProps({
  connectionStatus: String,
  isPreviewMode: Boolean
});

const assets = ref([]);
const loading = ref(false);

const fetchAssets = async () => {
  loading.value = true;
  try {
    assets.value = await apiService.getAssets();
  } catch (err) {
    console.error('Failed to load assets', err);
  } finally {
    loading.value = false;
  }
};

const uploadAsset = async (event) => {
  const file = event.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append('file', file);

  loading.value = true;
  try {
    const res = await apiService.uploadAsset(formData);

    const newAsset = {
      url: res.url,
      name: file.name,
      id: res.id
    };

    assets.value.unshift(newAsset);
  } catch (err) {
    console.error('Upload failed', err);
    alert('อัปโหลดล้มเหลว');
  } finally {
    loading.value = false;
  }
};

const deleteAsset = async (asset) => {
  if (!confirm('ยืนยันระบบกำจัดการลบรูปภาพนี้?')) return;

  const targetId = asset.id || asset.url.split('/').pop();
  if (targetId) {
    try {
      await apiService.deleteAsset(targetId);
      assets.value = assets.value.filter((a) => a.id !== targetId && !a.url.endsWith(targetId));
    } catch (err) {
      console.error('Failed to delete asset', err);
      if (err.response && err.response.status === 404) {
        assets.value = assets.value.filter((a) => a.id !== targetId && !a.url.endsWith(targetId));
      } else {
        alert('ลบรูปภาพล้มเหลว');
      }
    }
  }
};

const emit = defineEmits(['select-asset']);

const onDragStart = (e, asset) => {
  e.dataTransfer.setData('type', 'image');
  e.dataTransfer.setData('asset', asset.url);
};

const selectAsset = (asset) => {
  if (props.isPreviewMode) return;
  emit('select-asset', asset.url);
};

onMounted(() => {
  fetchAssets();
});
</script>

<style scoped>
.asset-manager {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 15px;
}

.upload-section {
  width: 298px;
  display: flex;
  flex-direction: column;
  margin-bottom: 15px;
}

.btn-upload {
  width: 298px;
  height: 46px;
  background: #F65189 0% 0% no-repeat padding-box;
  border-radius: 6px;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: opacity 0.2s, transform 0.2s;
}

.btn-upload:hover:not(:disabled) {
  opacity: 0.85;
  transform: translateY(-1px);
}

.btn-upload:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.btn-upload-text {
  text-align: center;
  font: normal normal bold 18px/24px "TH Sarabun New", "Sarabun", sans-serif;
  color: #FFFFFF;
}

.btn-upload-hint {
  text-align: left;
  font: normal normal normal 18px/24px "TH Sarabun New", "Sarabun", sans-serif;
  color: #A4A4A4;
  margin-top: 6px;
}

.asset-list-header {
  width: 298px;
  text-align: left;
  margin-bottom: 10px;
}

.label-small {
  font: normal normal bold 18px/24px "TH Sarabun New", "Sarabun", sans-serif;
  color: #000000;
  margin: 0;
}

.asset-grid {
  width: 298px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  max-height: 450px;
  overflow-y: auto;
  padding: 5px;
}

.asset-item {
  position: relative;
  aspect-ratio: 1;
  background: #FFFFFF 0% 0% no-repeat padding-box;
  border: 1px solid #F6F6F6;
  border-radius: 6px;
  cursor: grab;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.asset-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.05);
}

.asset-item.disabled {
  cursor: not-allowed;
  opacity: 0.8;
}

.asset-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  border-radius: 5px;
}

.btn-del {
  position: absolute;
  top: -8px;
  right: -8px;
  background: #E74C3C;
  border: none;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.15);

  opacity: 0;
  pointer-events: none;
  transition: all 0.2s ease;
  z-index: 10;
}

.asset-item:hover .btn-del {
  opacity: 1;
  pointer-events: auto;
}

.btn-del:hover {
  background: #C0392B;
}

.icon-delete {
  width: 14px;
  height: 14px;
  background: transparent url('../assets/icons/delete.svg') center/contain no-repeat;
}

.empty-state {
  grid-column: 1 / -1;
  text-align: center;
  color: #999;
  font: normal normal normal 18px/24px "TH Sarabun New", "Sarabun", sans-serif;
  padding: 20px;
}

.loading {
  text-align: center;
  color: #666;
  font: normal normal normal 18px/24px "TH Sarabun New", "Sarabun", sans-serif;
  margin-top: 20px;
}
</style>