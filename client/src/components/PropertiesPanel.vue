<template>
  <div v-if="hasSelection" class="floating-toolbar" :key="renderKey">

    <template v-if="isText">
      <div class="toolbar-group font-picker-wrapper" ref="pickerRef">
        <button class="dropdown-btn font-btn" title="ฟอนต์" @click.stop="togglePicker"
          :style="{ fontFamily: activeObject?.fontFamily || 'Sarabun' }">
          <span class="font-btn-label">{{ activeFontLabel }}</span>
          <span class="arrow">▾</span>
        </button>

        <div v-if="showFontPicker" class="font-dropdown" @click.stop>
          <input v-model="fontSearch" class="font-search" placeholder="ค้นหาฟอนต์..." @input="filterFonts" />
          <div class="font-list" ref="fontListRef">
            <div v-if="filteredThaiFonts.length" class="font-group">
              <div class="font-group-header thai-header">🇹🇭 รองรับภาษาไทย ({{ filteredThaiFonts.length }})</div>
              <div v-for="font in filteredThaiFonts" :key="font.value" class="font-option"
                :class="{ active: (activeObject?.fontFamily || 'Sarabun') === font.value }"
                :style="{ fontFamily: font.value }" @click="selectFont(font.value)">
                <span class="font-name">{{ font.label }}</span>
                <span class="font-preview-text">กขค ABC</span>
              </div>
            </div>
            <div v-if="filteredLatinFonts.length" class="font-group">
              <div class="font-group-header latin-header">🔤 ภาษาอังกฤษ ({{ filteredLatinFonts.length }})</div>
              <div v-for="font in filteredLatinFonts" :key="font.value" class="font-option latin-font"
                :class="{ active: (activeObject?.fontFamily || 'Sarabun') === font.value }"
                :style="{ fontFamily: font.value }" @click="selectFont(font.value)">
                <span class="font-name">{{ font.label }}</span>
                <span class="font-preview-text">Aa Bb Cc</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="divider"></div>

      <div class="toolbar-group">
        <input type="number" :value="activeFontSize"
          @input="updateProp('fontSize', Math.round(parseFloat($event.target.value)), false)"
          @change="updateProp('fontSize', Math.round(parseFloat($event.target.value)), true)" class="size-input" min="1"
          step="1" title="ขนาดตัวอักษร" />
      </div>

      <div class="divider"></div>

      <div class="toolbar-group style-buttons">
        <button @click="toggleBold" :class="['icon-btn', { 'icon-btn-selected': activeObject?.fontWeight === 'bold' }]"
          title="ตัวหนา">
          <span style="font-weight: bold">B</span>
        </button>
        <button @click="toggleItalic"
          :class="['icon-btn', { 'icon-btn-selected': activeObject?.fontStyle === 'italic' }]" title="ตัวเอียง">
          <span style="font-style: italic">I</span>
        </button>
        <button @click="toggleUnderline" :class="['icon-btn', { 'icon-btn-selected': activeObject?.underline }]"
          title="ขีดเส้นใต้">
          <span style="text-decoration: underline">U</span>
        </button>
      </div>

      <div class="divider"></div>

      <div class="toolbar-group segmented-control">
        <button @click="setAlignment('left')" :class="['icon-btn', { active: activeTextAlign === 'left' }]"
          title="จัดซ้าย">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 4h18v2H3V4zm0 5h12v2H3V9zm0 5h18v2H3v-2zm0 5h12v2H3v-2z" />
          </svg>
        </button>
        <button @click="setAlignment('center')" :class="['icon-btn', { active: activeTextAlign === 'center' }]"
          title="จัดกลาง">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 4h18v2H3V4zm4 5h10v2H7V9zm-4 5h18v2H3v-2zm4 5h10v2H7v-2z" />
          </svg>
        </button>
        <button @click="setAlignment('right')" :class="['icon-btn', { active: activeTextAlign === 'right' }]"
          title="จัดขวา">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M3 4h18v2H3V4zm6 5h12v2H9V9zm-6 5h18v2H3v-2zm6 5h12v2H9v-2z" />
          </svg>
        </button>
      </div>
    </template>

    <template v-if="isText || isShape">
      <div class="divider" v-if="isText"></div>

      <div class="toolbar-group">
        <div class="color-wrapper" title="เลือกสี">
          <input type="color" :value="activeFillColor" @input="updateProp('fill', $event.target.value, false)"
            @change="updateProp('fill', $event.target.value, true)" class="color-input" />
          <span class="color-preview" :style="{ backgroundColor: activeFillColor }"></span>
        </div>
      </div>
    </template>

    <div class="divider" v-if="isText || isShape"></div>

    <div class="toolbar-group relative">
      <button @click.stop="showOpacity = !showOpacity; showSpacing = false; showLayers = false; showFontPicker = false;"
        class="dropdown-btn" title="ความทึบ">
        <span :class="showOpacity ? 'text-active' : 'text-muted'">{{ Math.round(activeOpacity * 100) }}%</span> <span
          class="arrow">▾</span>
      </button>

      <div v-if="showOpacity" class="dropdown-menu" @click.stop>
        <div class="dropdown-header">ความทึบ</div>
        <button v-for="val in [1, 0.9, 0.75, 0.5, 0.25]" :key="val" @click="setOpacity(val)"
          :class="['dropdown-item', { 'active': Math.abs(activeOpacity - val) < 0.01 }]">
          {{ val * 100 }}%
        </button>
      </div>
    </div>

    <template v-if="isText">
      <div class="divider"></div>

      <div class="toolbar-group relative">
        <button
          @click.stop="showSpacing = !showSpacing; showOpacity = false; showLayers = false; showFontPicker = false;"
          class="dropdown-btn" title="ระยะห่างตัวอักษรและบรรทัด">
          <span :class="showSpacing ? 'text-active' : 'text-muted'">ระยะห่าง</span> <span class="arrow">▾</span>
        </button>

        <div v-if="showSpacing" class="dropdown-menu spacing-menu" @click.stop>
          <div class="spacing-row">
            <span class="spacing-label">ระยะห่างระหว่างตัวอักษร</span>
            <input type="number" class="size-input" :value="activeCharSpacing"
              @input="updateProp('charSpacing', parseInt($event.target.value || 0), false)"
              @change="updateProp('charSpacing', parseInt($event.target.value || 0), true)" step="10" />
          </div>
          <div class="spacing-row">
            <span class="spacing-label">ระยะห่างระหว่างบรรทัด</span>
            <input type="number" class="size-input" :value="activeLineHeight"
              @input="updateProp('lineHeight', parseFloat($event.target.value || 1), false)"
              @change="updateProp('lineHeight', parseFloat($event.target.value || 1), true)" step="0.1" />
          </div>
        </div>
      </div>
    </template>

    <div class="divider"></div>

    <div class="toolbar-group relative">
      <button @click.stop="showLayers = !showLayers; showSpacing = false; showOpacity = false; showFontPicker = false;"
        class="dropdown-btn" title="เลเยอร์">
        <span :class="showLayers ? 'text-active' : 'text-muted'">เลเยอร์</span> <span class="arrow">▾</span>
      </button>

      <div v-if="showLayers" class="dropdown-menu layer-popup" @click.stop>
        <!-- <div class="dropdown-header">เลเยอร์</div> -->
        <button @click="bringForward" class="dropdown-item align-left">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="18 15 12 9 6 15"></polyline>
          </svg>
          ย้ายขึ้นไปหนึ่งชั้น
        </button>
        <button @click="bringToFront" class="dropdown-item align-left">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 15l-6-6-6 6" />
            <path d="M5 4h14" />
          </svg>
          ย้ายขึ้นไปบนสุด
        </button>
        <button @click="sendBackwards" class="dropdown-item align-left">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
          ย้ายลงไปหนึ่งชั้น
        </button>
        <button @click="sendToBack" class="dropdown-item align-left">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M6 9l6 6 6-6" />
            <path d="M5 20h14" />
          </svg>
          ย้ายลงไปล่างสุด
        </button>
      </div>
    </div>

    <div class="divider"></div>

    <div class="toolbar-group">
      <button @click="deleteObject" class="delete-btn" title="ลบวัตถุ">
        <svg class="delete-icon" width="16" height="16" viewBox="0 -960 960 960" fill="currentColor">
          <path
            d="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z" />
        </svg>
        <span>ลบ</span>
      </button>
    </div>

  </div>
</template>

<script setup>
import { ref, shallowRef, onMounted, onUnmounted, triggerRef, computed, watch, toRaw } from 'vue';
import { fabric } from 'fabric';

const props = defineProps({
  canvas: { type: Object, default: null },
  isPreviewMode: { type: Boolean, default: false }
});

const emit = defineEmits(['add-signature-block']);

const activeObject = shallowRef(null);
const hasSelection = ref(false);
const renderKey = ref(0);

const showFontPicker = ref(false);
const fontSearch = ref('');
const pickerRef = ref(null);
const fontListRef = ref(null);
const showLayerControls = ref(false);
const showOpacity = ref(false);
const showSpacing = ref(false);
const showLayers = ref(false);

const executeLayerAction = (actionName) => {
  if (!props.canvas) return;
  
  // 🌟 1. ถอด Proxy ออกจาก Canvas
  const canvas = toRaw(props.canvas);
  const rawActive = canvas.getActiveObject();
  if (!rawActive) return;
  
  // 🌟 2. ถอด Proxy ออกจาก Active Object เสมอ ป้องกัน indexOf หาไม่เจอจนเกิด Duplicate
  const active = toRaw(rawActive);

  if (active.isEditing) {
    active.exitEditing();
  }

  // สั่งย้าย Layer ด้วย Raw Object
  if (actionName === 'forward') canvas.bringForward(active);
  else if (actionName === 'front') canvas.bringToFront(active);
  else if (actionName === 'backward') canvas.sendBackwards(active);
  else if (actionName === 'back') canvas.sendToBack(active);

  // ดักบังคับให้รูปภาพ/สีพื้นหลังกระดาษจมอยู่ล่างสุดเสมอ
  const bgs = canvas.getObjects().filter(o => o.id === 'page-bg' || o.id === 'page-bg-image');
  bgs.forEach(bg => canvas.sendToBack(toRaw(bg))); // ใช้ toRaw กับ bg ด้วย

  canvas.requestRenderAll();
  canvas.fire('object:modified', { target: active });
  showLayers.value = false;
};

const bringForward = () => executeLayerAction('forward');
const bringToFront = () => executeLayerAction('front');
const sendBackwards = () => executeLayerAction('backward');
const sendToBack = () => executeLayerAction('back');

const thaiFonts = [
  { label: 'Sarabun', value: 'Sarabun' },
  { label: 'TH Sarabun New', value: 'TH Sarabun New' },
  { label: 'Kanit', value: 'Kanit' },
  { label: 'Prompt', value: 'Prompt' },
  { label: 'Mitr', value: 'Mitr' },
  { label: 'Bai Jamjuree', value: 'Bai Jamjuree' },
  { label: 'K2D', value: 'K2D' },
  { label: 'Kodchasan', value: 'Kodchasan' },
  { label: 'Krub', value: 'Krub' },
  { label: 'Niramit', value: 'Niramit' },
  { label: 'Srisakdi', value: 'Srisakdi' },
  { label: 'Pridi', value: 'Pridi' },
  { label: 'Taviraj', value: 'Taviraj' },
  { label: 'Trirong', value: 'Trirong' },
  { label: 'Charm', value: 'Charm' },
  { label: 'Fahkwang', value: 'Fahkwang' },
  { label: 'Pattaya', value: 'Pattaya' },
  { label: 'Thasadith', value: 'Thasadith' },
  { label: 'Chonburi', value: 'Chonburi' },
  { label: 'Charmonman', value: 'Charmonman' },
  { label: 'Chakra Petch', value: 'Chakra Petch' },
  { label: 'Mali', value: 'Mali' },
  { label: 'Maitree', value: 'Maitree' },
  { label: 'Sriracha', value: 'Sriracha' },
  { label: 'Noto Sans Thai', value: 'Noto Sans Thai' },
  { label: 'Noto Serif Thai', value: 'Noto Serif Thai' },
  { label: 'Noto Sans Thai Looped', value: 'Noto Sans Thai Looped' },
  { label: 'IBM Plex Sans Thai', value: 'IBM Plex Sans Thai' },
  { label: 'IBM Plex Sans Thai Looped', value: 'IBM Plex Sans Thai Looped' },
  { label: 'Anuphan', value: 'Anuphan' },
];

const latinFonts = [
  { label: 'Helvetica / Arial', value: 'Helvetica' },
  { label: 'Times New Roman', value: 'Times New Roman' },
  { label: 'Courier New', value: 'Courier New' },
  { label: 'Roboto', value: 'Roboto' },
  { label: 'Open Sans', value: 'Open Sans' },
  { label: 'Lato', value: 'Lato' },
  { label: 'Montserrat', value: 'Montserrat' },
  { label: 'Poppins', value: 'Poppins' },
  { label: 'Inter', value: 'Inter' },
  { label: 'Raleway', value: 'Raleway' },
  { label: 'Nunito', value: 'Nunito' },
  { label: 'Playfair Display', value: 'Playfair Display' },
  { label: 'Oswald', value: 'Oswald' },
  { label: 'Merriweather', value: 'Merriweather' },
  { label: 'Source Sans 3', value: 'Source Sans 3' },
  { label: 'Ubuntu', value: 'Ubuntu' },
  { label: 'PT Sans', value: 'PT Sans' },
  { label: 'Josefin Sans', value: 'Josefin Sans' },
  { label: 'Quicksand', value: 'Quicksand' },
  { label: 'Dancing Script', value: 'Dancing Script' },
  { label: 'Pacifico', value: 'Pacifico' },
];

const loadGoogleFontsForPreview = () => {
  const allFonts = [...thaiFonts, ...latinFonts];
  allFonts.forEach(font => {
    // Skip Local/System fonts
    const isSystemFont = ['Arial', 'Helvetica', 'Times New Roman', 'Courier New', 'TH Sarabun New'].includes(font.value);
    if (!isSystemFont) {
      const link = document.createElement('link');
      link.href = `https://fonts.googleapis.com/css2?family=${font.value.replace(/ /g, '+')}:wght@400;700&display=swap`;
      link.rel = 'stylesheet';
      document.head.appendChild(link);
    }
  });
};

const togglePicker = () => {
  showFontPicker.value = !showFontPicker.value;
  showOpacity.value = false;
  showSpacing.value = false;
  showLayers.value = false;

  if (showFontPicker.value) {
    showLayerControls.value = false;
    fontSearch.value = '';
    setTimeout(() => {
      const activeEl = fontListRef.value?.querySelector('.active');
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }, 50);
  }
};

const handleClickOutside = (e) => {
  if (pickerRef.value && !pickerRef.value.contains(e.target)) {
    showFontPicker.value = false;
  }
  if (!e.target.closest('.dropdown-btn') && !e.target.closest('.dropdown-menu')) {
    showLayerControls.value = false;
    showOpacity.value = false;
    showSpacing.value = false;
  }

  const layerPopup = document.querySelector('.layer-popup');
  const layerBtn = document.querySelector('button[title="เลเยอร์"]');
  if (showLayers.value && layerPopup && !layerPopup.contains(e.target) && (!layerBtn || !layerBtn.contains(e.target))) {
    showLayers.value = false;
  }
};

const filteredThaiFonts = computed(() => {
  if (!fontSearch.value) return thaiFonts;
  const s = fontSearch.value.toLowerCase();
  return thaiFonts.filter(f => f.label.toLowerCase().includes(s) || f.value.toLowerCase().includes(s));
});

const filteredLatinFonts = computed(() => {
  if (!fontSearch.value) return latinFonts;
  const s = fontSearch.value.toLowerCase();
  return latinFonts.filter(f => f.label.toLowerCase().includes(s) || f.value.toLowerCase().includes(s));
});

const selectFont = (fontFamily) => {
  updateProp('fontFamily', fontFamily);
  showFontPicker.value = false;
};

const getTarget = () => {
  renderKey.value;
  return activeObject.value;
};

const isText = computed(() => {
  const target = getTarget();
  return target && ['i-text', 'textbox', 'text'].includes(target.type);
});

const isShape = computed(() => {
  const target = getTarget();
  return target && ['rect', 'circle', 'triangle', 'path', 'line', 'polygon'].includes(target.type);
});

const activeFontLabel = computed(() => {
  const target = getTarget();
  if (!target) return 'Sarabun';
  const family = target.fontFamily || 'Sarabun';
  const found = [...thaiFonts, ...latinFonts].find(f => f.value === family);
  return found ? found.label : family;
});

const activeFontSize = computed(() => {
  const target = getTarget();
  return target ? Math.round(target.fontSize || 16) : 16;
});

const activeTextAlign = computed(() => {
  const target = getTarget();
  return target ? (target.textAlign || 'left') : 'left';
});

const activeFillColor = computed(() => {
  const target = getTarget();
  return target ? getHexColor(target.fill || '#000000') : '#000000';
});

const activeOpacity = computed(() => {
  const target = getTarget();
  return target && target.opacity !== undefined ? target.opacity : 1;
});

const activeCharSpacing = computed(() => {
  const target = getTarget();
  return target ? (target.charSpacing || 0) : 0;
});

const activeLineHeight = computed(() => {
  const target = getTarget();
  return target ? (target.lineHeight || 1.16) : 1.16;
});

const getHexColor = (color) => {
  if (!color) return '#000000';
  if (color.startsWith('#')) return color;
  const ctx = document.createElement('canvas').getContext('2d');
  ctx.fillStyle = color;
  return ctx.fillStyle;
};

const updateProp = (prop, value, triggerRender = true) => {
  if (!activeObject.value || !props.canvas) return;
  activeObject.value.set(prop, value);
  if (triggerRender) {
    props.canvas.requestRenderAll();
    renderKey.value++;
  }
};

const toggleBold = () => {
  if (!activeObject.value) return;
  const isBold = activeObject.value.fontWeight === 'bold';
  updateProp('fontWeight', isBold ? 'normal' : 'bold');
};

const toggleItalic = () => {
  if (!activeObject.value) return;
  const isItalic = activeObject.value.fontStyle === 'italic';
  updateProp('fontStyle', isItalic ? 'normal' : 'italic');
};

const toggleUnderline = () => {
  if (!activeObject.value) return;
  updateProp('underline', !activeObject.value.underline);
};

const setAlignment = (align) => {
  if (!activeObject.value) return;
  updateProp('textAlign', align);
};

const setOpacity = (val) => {
  if (!activeObject.value) return;
  updateProp('opacity', val);
  showOpacity.value = false;
};

const deleteObject = () => {
  if (!activeObject.value || !props.canvas) return;
  props.canvas.remove(activeObject.value);
  props.canvas.requestRenderAll();
  activeObject.value = null;
  hasSelection.value = false;
};

const updateSelection = () => {
  if (!props.canvas) return;
  const active = props.canvas.getActiveObject();

  if (active && (active.id === 'page-bg' || active.id === 'page-bg-image')) {
    props.canvas.discardActiveObject();
    props.canvas.requestRenderAll();
    activeObject.value = null;
    hasSelection.value = false;
    return;
  }

  if (active !== activeObject.value) {
    showSpacing.value = false;
    showOpacity.value = false;
    showFontPicker.value = false;
    showLayers.value = false;
  }

  activeObject.value = active;
  hasSelection.value = !!active;
  renderKey.value++;
  if (active) triggerRef(activeObject);
};

watch(() => props.canvas, (newCanvas, oldCanvas) => {
  if (oldCanvas) {
    oldCanvas.off('selection:created', updateSelection);
    oldCanvas.off('selection:updated', updateSelection);
    oldCanvas.off('selection:cleared', updateSelection);
    oldCanvas.off('object:modified', updateSelection);
    oldCanvas.off('object:scaling', updateSelection);
    oldCanvas.off('object:resizing', updateSelection);
  }
  if (newCanvas) {
    newCanvas.on('selection:created', updateSelection);
    newCanvas.on('selection:updated', updateSelection);
    newCanvas.on('selection:cleared', updateSelection);
    newCanvas.on('object:modified', updateSelection);
    newCanvas.on('object:scaling', updateSelection);
    newCanvas.on('object:resizing', updateSelection);
    updateSelection();
  }
}, { immediate: true });

onMounted(() => {
  loadGoogleFontsForPreview();
  window.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  if (props.canvas) {
    props.canvas.off('selection:created', updateSelection);
    props.canvas.off('selection:updated', updateSelection);
    props.canvas.off('selection:cleared', updateSelection);
    props.canvas.off('object:modified', updateSelection);
    props.canvas.off('object:scaling', updateSelection);
    props.canvas.off('object:resizing', updateSelection);
  }
  window.removeEventListener('click', handleClickOutside);
});
</script>

<style scoped>
.floating-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 24px;
  background: #FFFFFF 0% 0% no-repeat padding-box;
  box-shadow: 0px 3px 6px #DBDBDB;
  border-radius: 27px;
  opacity: 1;
  font-family: 'Sarabun', sans-serif;
  color: #333;
  white-space: nowrap;
  flex-wrap: nowrap;
}

.toolbar-group {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.divider {
  width: 1px;
  height: 24px;
  background-color: #E0E0E0;
  margin: 0 6px;
  align-self: center;
  flex-shrink: 0;
}

.font-btn {
  min-width: 130px;
  max-width: 180px;
}

.font-btn-label {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.style-buttons {
  display: flex;
  gap: 2px;
  align-items: center;
}

.icon-btn {
  display: flex;
  justify-content: center;
  align-items: center;
  width: 28px;
  height: 34px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 5px;
  cursor: pointer;
  font-family: 'TH Sarabun New', 'Sarabun', sans-serif;
  font-size: 18px;
  font-weight: bold;
  line-height: 24px;
  color: #000000;
  letter-spacing: 0px;
  text-align: center;
  padding: 0;
  transition: all 0.2s ease;
}

.icon-btn:hover {
  background: #f9f9f9;
}

.icon-btn.icon-btn-selected {
  background: #FFDFE9 0% 0% no-repeat padding-box !important;
  border: 1px solid #FFD5E3 !important;
  color: #000000 !important;
}

.dropdown-btn {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 32px;
  padding: 0 10px;
  background-color: #fff;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 13px;
  color: #333;
  cursor: pointer;
  transition: all 0.2s ease;
  box-sizing: border-box;
  gap: 6px;
}

.dropdown-btn:hover {
  border-color: #aaa;
}



.dropdown-btn .arrow {
  font-size: 14px;
  color: #888;
}

.compact-dropdown {
  min-width: 70px;
}

.segmented-control {
  display: flex !important;
  flex-direction: row;
  flex-wrap: nowrap;
  gap: 0 !important;
  background: transparent !important;
  border: none !important;
  padding: 0 !important;
  width: max-content;
  flex-shrink: 0;
}

.segmented-control .icon-btn {
  flex: 1 1 0px !important;
  min-width: 36px !important;
  height: 34px !important;
  box-sizing: border-box;
  display: flex;
  justify-content: center;
  align-items: center;
  cursor: pointer;

  background: #FFFFFF 0% 0% no-repeat padding-box !important;
  border: 1px solid #C5C5C5 !important;
  opacity: 1 !important;
  color: #555 !important;

  border-radius: 0 !important;
  margin: 0 0 0 -1px !important;
  position: relative;
  transition: all 0.2s ease;
}

.segmented-control .icon-btn:first-child {
  margin-left: 0 !important;
  border-radius: 5px 0 0 5px !important;
}

.segmented-control .icon-btn:last-child {
  border-radius: 0 5px 5px 0 !important;
}

.segmented-control .icon-btn:hover {
  background-color: #f9f9f9 !important;
}

.segmented-control .icon-btn.active {
  background: #FFFFFF 0% 0% no-repeat padding-box !important;
  border: 1px solid #C5C5C5 !important;
  color: #F65189 !important;
  z-index: 1;
}

.size-input {
  width: 50px;
  height: 32px;
  text-align: center;
  padding: 4px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 13px;
  outline: none;
  background-color: #fff;
  transition: border-color 0.2s;
  box-sizing: border-box;
}

.size-input:focus {
  border-color: #2196f3;
}

.size-input::-webkit-outer-spin-button,
.size-input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  appearance: none;
  margin: 0;
}

.size-input[type=number] {
  -moz-appearance: textfield;
  appearance: textfield;
}

.color-wrapper {
  position: relative;
  width: 26px;
  height: 26px;
  border-radius: 50%;
  overflow: hidden;
  border: 1px solid #ddd;
  cursor: pointer;
  flex-shrink: 0;
}

.color-input {
  position: absolute;
  opacity: 0;
  width: 100%;
  height: 100%;
  cursor: pointer;
}

.color-preview {
  display: block;
  width: 100%;
  height: 100%;
  pointer-events: none;
}

.relative {
  position: relative;
}

.dropdown-header {
  display: block;
  width: 100%;
  padding: 8px 10px;
  font-size: 13px;
  font-weight: 500;
  color: #333;
  text-align: left;
  background: transparent;
  border: none;
  border-radius: 4px;
  box-sizing: border-box;
  margin: 0;
}

.text-muted {
  color: #888;
}

.dropdown-menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  min-width: 100px;
  background: #fff;
  border: 1px solid #ddd;
  border-radius: 6px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
  padding: 4px;
  z-index: 200;
  box-sizing: border-box;
}

.dropdown-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 8px 10px;
  background: transparent;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  color: #333;
  cursor: pointer;
  transition: background 0.1s;
  white-space: nowrap;
}

.dropdown-item:hover {
  background-color: #f5f5f5;
}

.dropdown-item.active {
  background-color: #FFDFE9;
  color: #F65189;
  font-weight: 500;
}

.spacing-menu {
  min-width: 220px;
  padding: 12px;
}

.spacing-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-bottom: 8px;
}

.spacing-row:last-child {
  margin-bottom: 0;
}

.spacing-label {
  font-size: 13px;
  color: #555;
}

.delete-btn {
  display: flex;
  align-items: center;
  gap: 4px;
  background: transparent;
  border: none;
  color: #e53935;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  padding: 6px 8px;
  border-radius: 4px;
  transition: background 0.2s;
  white-space: nowrap;
}

.delete-btn:hover {
  background: #ffebee;
}

.font-picker-wrapper {
  position: relative;
}

.font-dropdown {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  width: 240px;
  background: white;
  border: 1px solid #ddd;
  border-radius: 6px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.12);
  z-index: 1000;
  display: flex;
  flex-direction: column;
}

.font-search {
  margin: 8px;
  padding: 6px 10px;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 13px;
  outline: none;
}

.font-search:focus {
  border-color: #2196f3;
}

.font-list {
  max-height: 250px;
  overflow-y: auto;
  padding-bottom: 8px;
}

.font-group-header {
  padding: 4px 12px;
  font-size: 11px;
  font-weight: bold;
  background: #f9f9f9;
  color: #666;
}

.font-option {
  padding: 8px 12px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.font-option:hover {
  background: #f5f5f5;
}

.font-option.active {
  background: #FFDFE9;
  color: #F65189;
}

.font-name {
  font-size: 13px;
}

.font-preview-text {
  font-size: 16px;
  color: #888;
}

.font-option.active .font-preview-text {
  color: #F65189;
}

.layer-popup {
  width: 170px;
}

.dropdown-item.align-left {
  display: flex;
  align-items: center;
  justify-content: flex-start;
  gap: 8px;
  text-align: left;
}

.text-muted {
  color: #888;
  transition: color 0.2s ease;
}

.text-active {
  color: #333;
  transition: color 0.2s ease;
}
</style>