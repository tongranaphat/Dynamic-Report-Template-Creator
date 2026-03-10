<template>
  <div class="asset-manager">
    <div class="header">
      <input type="file" ref="fileInput" @change="uploadAsset" accept="image/*" style="display: none" />
      <button class="btn-upload" @click="$refs.fileInput.click()" :disabled="isPreviewMode">+ อัปโหลดรูปภาพ</button>
    </div>

    <div v-if="loading" class="loading">กำลังโหลด...</div>

    <div class="asset-grid" v-else>
      <div v-for="(asset, index) in assets" :key="index" :class="['asset-item', { disabled: isPreviewMode }]"
        :draggable="!isPreviewMode" @dragstart="onDragStart($event, asset)" @click="selectAsset(asset)">
        <img :src="asset.url" :alt="asset.name" />
        <button class="btn-del" @click.stop="deleteAsset(asset)" v-if="!isPreviewMode">×</button>
      </div>
      <div v-if="assets.length === 0" class="empty-state">ยังไม่มีรูปภาพในคลัง</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import axios from 'axios';

const props = defineProps({
  connectionStatus: String,
  isPreviewMode: Boolean
});

const assets = ref([]);
const loading = ref(false);

const fetchAssets = async () => {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
  loading.value = true;
  try {
    const res = await axios.get(`${apiUrl}/api/assets`);
    assets.value = res.data;
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
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
    const res = await axios.post(`${apiUrl}/api/upload-asset`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });

    const newAsset = {
      url: res.data.url,
      name: file.name,
      id: res.data.id
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
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

  const targetId = asset.id || asset.url.split('/').pop();
  if (targetId) {
    try {
      await axios.delete(`${apiUrl}/api/assets/${targetId}`);
      assets.value = assets.value.filter((a) => a.id !== targetId && !a.url.endsWith(targetId));
    } catch (err) {
      console.error('Failed to delete asset', err);
      // Remove from UI anyway if it's already deleted in the database (404)
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
  // We pass the URL as 'asset' type to match the new engine drop handler
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
  padding: 0;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.header h3 {
  margin: 0;
  font-size: 14px;
  color: #444;
}

.btn-upload {
  background: #2196f3;
  color: white;
  border: none;
  padding: 4px 8px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
}

.asset-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  max-height: 200px;
  overflow-y: auto;
}

.asset-item {
  position: relative;
  aspect-ratio: 1;
  border: 1px solid #eee;
  border-radius: 4px;
  overflow: hidden;
  cursor: grab;
}

.asset-item.disabled {
  cursor: not-allowed;
  opacity: 0.8;
}

.asset-item img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.btn-del {
  position: absolute;
  top: 2px;
  right: 2px;
  background: rgba(0, 0, 0, 0.5);
  color: white;
  border: none;
  border-radius: 50%;
  width: 16px;
  height: 16px;
  font-size: 10px;
  line-height: 16px;
  cursor: pointer;
  display: none;
}

.asset-item:hover .btn-del {
  display: block;
}

.empty-state {
  grid-column: 1 / -1;
  text-align: center;
  color: #999;
  font-size: 12px;
  padding: 10px;
}

.loading {
  text-align: center;
  color: #666;
  font-size: 12px;
}
</style>
