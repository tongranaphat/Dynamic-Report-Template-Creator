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
  // In a real app, fetch from API.
  // For this prototype, we might just store links in localStorage or use a simple API if we build one.
  // Let's assume we just show what we upload for now in session/local storage or mock it.
  // Wait, the plan said "create upload route". So let's use that.

  // For now, since we don't have a 'list assets' API in the plan (oops),
  // I will mock the list with what we upload in this session or localStorage.
  const stored = localStorage.getItem('user_assets');
  if (stored) assets.value = JSON.parse(stored);
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
      name: file.name
    };

    assets.value.unshift(newAsset);
    saveAssets();
  } catch (err) {
    console.error('Upload failed', err);
    alert('อัปโหลดล้มเหลว');
  } finally {
    loading.value = false;
  }
};

const deleteAsset = (asset) => {
  if (!confirm('ยืนยันระบบกำจัดการลบรูปภาพนี้?')) return;
  assets.value = assets.value.filter((a) => a !== asset);
  saveAssets();
};

const saveAssets = () => {
  localStorage.setItem('user_assets', JSON.stringify(assets.value));
};

const emit = defineEmits(['select-asset']);

const onDragStart = (e, asset) => {
  // We pass the URL as 'image-url' type or just plain text
  e.dataTransfer.setData('type', 'image');
  e.dataTransfer.setData('image-url', asset.url);
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
