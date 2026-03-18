<template>
  <div 
    v-if="isVisible && position" 
    class="container-toolbar-overlay"
    :style="toolbarStyle"
  >
    <button class="add-below-btn" @click.stop="$emit('add-below')">
      <span class="icon-plus">+</span>
      เพิ่มบล็อกด้านล่าง
    </button>
  </div>
</template>

<script setup>
import { computed } from 'vue';

const props = defineProps({
  isVisible: {
    type: Boolean,
    default: false
  },
  position: {
    type: Object,
    default: null
  }
});

defineEmits(['add-below']);

const toolbarStyle = computed(() => {
  if (!props.position) return {};
  
  // Center horizontally relative to the container block
  // Place 8px below the bottom edge of the container block
  return {
    left: `${props.position.left + (props.position.width / 2)}px`,
    top: `${props.position.top + 8}px`,
    transform: 'translateX(-50%)' // Center exactly
  };
});
</script>

<style scoped>
.container-toolbar-overlay {
  position: fixed; /* Use fixed so it floats over exactly where the canvas DOM is */
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: auto;
  /* Add smooth transition if position changes slightly */
  transition: top 0.1s ease-out, left 0.1s ease-out;
}

.add-below-btn {
  background: #2196F3;
  color: white;
  border: none;
  border-radius: 20px;
  padding: 6px 16px;
  font: normal normal bold 16px/24px "TH Sarabun New", "Sarabun", sans-serif;
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(33, 150, 243, 0.3);
  transition: all 0.2s ease;
}

.add-below-btn:hover {
  background: #1976D2;
  transform: translateY(-1px);
  box-shadow: 0 6px 16px rgba(33, 150, 243, 0.4);
}

.add-below-btn:active {
  transform: translateY(1px);
  box-shadow: 0 2px 8px rgba(33, 150, 243, 0.3);
}

.icon-plus {
  font-weight: bold;
  font-size: 18px;
  line-height: 1;
}
</style>
