<template>
  <div v-if="activeObject" class="minimal-panel">
    <template v-if="isText">
      <div class="tool-group">
        <div class="font-picker-wrapper" ref="pickerRef">
          <button class="font-display-btn" @click.stop="togglePicker"
            :style="{ fontFamily: activeObject.fontFamily || 'Sarabun' }">
            {{ activeFontLabel }}
            <span class="picker-arrow">▾</span>
          </button>

          <div v-if="showFontPicker" class="font-dropdown" @click.stop>
            <input v-model="fontSearch" class="font-search" placeholder="ค้นหาฟอนต์..." @input="filterFonts" />

            <div class="font-list" ref="fontListRef">
              <div v-if="filteredThaiFonts.length" class="font-group">
                <div class="font-group-header thai-header">
                  🇹🇭 รองรับภาษาไทย ({{ filteredThaiFonts.length }})
                </div>
                <div v-for="font in filteredThaiFonts" :key="font.value" class="font-option"
                  :class="{ active: (activeObject.fontFamily || 'Sarabun') === font.value }"
                  :style="{ fontFamily: font.value }" @click="selectFont(font.value)">
                  <span class="font-name">{{ font.label }}</span>
                  <span class="font-preview-text">กขค ABC</span>
                </div>
              </div>

              <div v-if="filteredLatinFonts.length" class="font-group">
                <div class="font-group-header latin-header">
                  🔤 ภาษาอังกฤษเท่านั้น ({{ filteredLatinFonts.length }})
                </div>
                <div v-for="font in filteredLatinFonts" :key="font.value" class="font-option latin-font"
                  :class="{ active: (activeObject.fontFamily || 'Sarabun') === font.value }"
                  :style="{ fontFamily: font.value }" @click="selectFont(font.value)">
                  <span class="font-name">{{ font.label }}</span>
                  <span class="font-preview-text">Aa Bb Cc</span>
                </div>
              </div>

              <div v-if="filteredThaiFonts.length === 0 && filteredLatinFonts.length === 0" class="no-results">
                ไม่พบฟอนต์ "{{ fontSearch }}"
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="divider"></div>
      <div class="tool-group">
        <input type="number" :value="activeFontSize"
          @input="updateProp('fontSize', Math.round(parseFloat($event.target.value)), false)"
          @change="updateProp('fontSize', Math.round(parseFloat($event.target.value)), true)" class="size-input" min="1"
          step="1" />
      </div>
      <div class="divider"></div>
      <div class="tool-group row">
        <button @click="toggleBold" :class="['icon-btn', { active: activeFontWeight === 'bold' }]" title="ตัวหนา">
          <span style="font-weight: bold">B</span>
        </button>
        <button @click="toggleItalic" :class="['icon-btn', { active: activeFontStyle === 'italic' }]" title="ตัวเอียง">
          <span style="font-style: italic">I</span>
        </button>
        <button @click="toggleUnderline" :class="['icon-btn', { active: activeUnderline }]" title="ขีดเส้นใต้">
          <span style="text-decoration: underline">U</span>
        </button>
      </div>
      <div class="divider"></div>
      <div class="tool-group">
        <button @click="cycleAlignment" class="icon-btn" :title="`การจัดวาง: ${activeTextAlign}`">
          <span v-if="activeTextAlign === 'left'">จัดซ้าย</span>
          <span v-else-if="activeTextAlign === 'center'">จัดกลาง</span>
          <span v-else-if="activeTextAlign === 'right'">จัดขวา</span>
        </button>
      </div>
    </template>

    <template v-if="isText || isShape">
      <div class="divider" v-if="isText"></div>
      <div class="tool-group">
        <div class="color-wrapper" title="สีข้อความและลายเส้น">
          <input type="color" :value="activeFillColor" @input="updateProp('fill', $event.target.value, false)"
            @change="updateProp('fill', $event.target.value, true)" class="color-input" />
          <span class="color-preview" :style="{ backgroundColor: activeFillColor }"></span>
        </div>
      </div>
    </template>

    <div class="divider"></div>
    <div class="tool-group relative">
      <button @click="showOpacity = !showOpacity; showSpacing = false;" :class="['icon-btn', { active: showOpacity }]"
        title="ความโปร่งใส">
        ความทึบ ▾
      </button>
      <div v-if="showOpacity" class="popup-menu opacity-popup">
        <div class="popup-item">
          <label>ความทึบ ({{ Math.round(activeOpacity * 100) }}%)</label>
          <input type="range" :value="activeOpacity"
            @input="updateProp('opacity', parseFloat($event.target.value), false)"
            @change="updateProp('opacity', parseFloat($event.target.value), true)" min="0" max="1" step="0.01" />
        </div>
      </div>
    </div>

    <template v-if="isText">
      <div class="divider"></div>
      <div class="tool-group relative">
        <button @click="showSpacing = !showSpacing; showOpacity = false;" :class="['icon-btn', { active: showSpacing }]"
          title="ระยะห่างตัวอักษรและบรรทัด">
          ระยะห่าง ▾
        </button>
        <div v-if="showSpacing" class="popup-menu spacing-popup">
          <div class="popup-item">
            <label>ระยะระหว่างตัวอักษร ({{ Math.round(activeCharSpacing) }})</label>
            <input type="range" :value="activeCharSpacing"
              @input="updateProp('charSpacing', parseInt($event.target.value), false)"
              @change="updateProp('charSpacing', parseInt($event.target.value), true)" min="-50" max="500" step="10" />
          </div>
          <div class="popup-item">
            <label>ระยะระหว่างบรรทัด ({{ activeLineHeight.toFixed(1) }})</label>
            <input type="range" :value="activeLineHeight"
              @input="updateProp('lineHeight', parseFloat($event.target.value), false)"
              @change="updateProp('lineHeight', parseFloat($event.target.value), true)" min="0.5" max="3" step="0.1" />
          </div>
        </div>
      </div>
    </template>

    <div class="divider" v-show="false"></div>

    <div class="tool-group" v-show="false">
      <button @click="showLayerControls = !showLayerControls" :class="['icon-btn', { active: showLayerControls }]"
        title="การจัดลำดับชั้น">
        ชั้นที่ ▾
      </button>
      <div v-if="showLayerControls" class="popup-menu layer-popup">
        <div class="popup-item">
          <button @click="bringToFront" class="layer-btn" title="นำไปอยู่ด้านหน้าสุด">
            ⬆️ นำขึ้นหน้าสุด
          </button>
        </div>
        <div class="popup-item">
          <button @click="bringForward" class="layer-btn" title="นำขึ้นหน้า">
            ↑ นำขึ้นหน้า
          </button>
        </div>
        <div class="popup-item">
          <button @click="sendBackwards" class="layer-btn" title="ส่งลับหลัง">
            ↓ ส่งลับหลัง
          </button>
        </div>
        <div class="popup-item">
          <button @click="sendToBack" class="layer-btn" title="ส่งไปอยู่ด้านหลังสุด">
            ⬇️ ส่งลับหลังสุด
          </button>
        </div>
      </div>
    </div>

    <div class="divider"></div>
    <button @click="deleteObject" class="icon-btn delete-icon" title="ลบวัตถุ">🗑 ลบ</button>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, triggerRef, computed, watch } from 'vue';
import { fabric } from 'fabric';

const props = defineProps({
  canvas: Object,
  isPreviewMode: Boolean
});




const THAI_FONTS = [
  { label: 'Sarabun', value: 'Sarabun' },
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
  { label: 'IBM Plex Thai', value: 'IBM Plex Thai' },
  { label: 'IBM Plex Thai Looped', value: 'IBM Plex Thai Looped' },
  { label: 'Anuphan', value: 'Anuphan' },
];


const LATIN_FONTS = [
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
  if (document.getElementById('gf-thai-fonts')) return;


  const allGoogleFonts = [
    ...THAI_FONTS,
    ...LATIN_FONTS.filter(f => !['Helvetica', 'Times New Roman', 'Courier New'].includes(f.value))
  ];


  const families = allGoogleFonts.map(f => {
    const name = f.value.replace(/\s+/g, '+');
    return `family=${name}:wght@400;700`;
  }).join('&');

  const link = document.createElement('link');
  link.id = 'gf-thai-fonts';
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?${families}&display=swap`;
  document.head.appendChild(link);
};


const activeObject = ref(null);
const showSpacing = ref(false);
const showOpacity = ref(false);
const showFontPicker = ref(false);
const showLayerControls = ref(false);
const fontSearch = ref('');
const pickerRef = ref(null);

const filteredThaiFonts = ref([...THAI_FONTS]);
const filteredLatinFonts = ref([...LATIN_FONTS]);

const filterFonts = () => {
  const q = fontSearch.value.toLowerCase();
  filteredThaiFonts.value = THAI_FONTS.filter(f => f.label.toLowerCase().includes(q));
  filteredLatinFonts.value = LATIN_FONTS.filter(f => f.label.toLowerCase().includes(q));
};

const activeFontLabel = computed(() => {
  if (!activeObject.value) return 'Sarabun';

  if (activeObject.value.type === 'activeSelection') {
    const fonts = new Set(activeObject.value.getObjects().filter(o => ['i-text', 'text', 'textbox'].includes(o.type)).map(o => o.fontFamily));
    if (fonts.size > 1) return '(Mixed Fonts)';
    if (fonts.size === 1) {
      const v = [...fonts][0];
      const found = [...THAI_FONTS, ...LATIN_FONTS].find(f => f.value === v);
      return found ? found.label : v;
    }
    return 'Sarabun';
  }

  const v = activeObject.value.fontFamily || 'Sarabun';
  const found = [...THAI_FONTS, ...LATIN_FONTS].find(f => f.value === v);
  return found ? found.label : v;
});

const togglePicker = () => {
  showFontPicker.value = !showFontPicker.value;
  if (showFontPicker.value) {
    fontSearch.value = '';
    filteredThaiFonts.value = [...THAI_FONTS];
    filteredLatinFonts.value = [...LATIN_FONTS];
  }
};

const selectFont = (fontValue) => {
  if (!activeObject.value || !props.canvas) return;
  const objs = activeObject.value.type === 'activeSelection' ? activeObject.value.getObjects() : [activeObject.value];
  objs.forEach(obj => {
    if (['i-text', 'text', 'textbox'].includes(obj.type)) {
      obj.set('fontFamily', fontValue);
    }
  });
  props.canvas.renderAll();
  props.canvas.fire('object:modified');
  showFontPicker.value = false;
};

const isText = computed(() => {
  if (!activeObject.value) return false;
  if (activeObject.value.type === 'activeSelection') {
    return activeObject.value.getObjects().some(obj => ['i-text', 'text', 'textbox'].includes(obj.type));
  }
  const t = activeObject.value.type;
  return t === 'i-text' || t === 'text' || t === 'textbox';
});

const isShape = computed(() => {
  if (!activeObject.value) return false;
  if (activeObject.value.type === 'activeSelection') {
    return activeObject.value.getObjects().some(obj => ['rect', 'circle', 'triangle', 'polygon'].includes(obj.type));
  }
  const t = activeObject.value.type;
  return t === 'rect' || t === 'circle' || t === 'triangle' || t === 'polygon';
});

const isImage = computed(() => {
  if (!activeObject.value) return false;
  if (activeObject.value.type === 'activeSelection') {
    return activeObject.value.getObjects().some(obj => obj.type === 'image');
  }
  return activeObject.value.type === 'image';
});

const getTarget = () => {
  if (!activeObject.value) return null;
  return activeObject.value.type === 'activeSelection' ? activeObject.value.getObjects()[0] : activeObject.value;
};

const activeFontSize = computed(() => {
  const target = getTarget();
  if (!target) return 12;
  return Math.round((target.fontSize || 12) * (target.scaleY || 1));
});

const activeFillColor = computed(() => {
  const target = getTarget();
  if (!target) return '#000000';
  return getHexColor(target.fill);
});

const activeOpacity = computed(() => {
  const target = getTarget();
  return target ? (target.opacity ?? 1) : 1;
});

const activeCharSpacing = computed(() => {
  const target = getTarget();
  return target ? (target.charSpacing || 0) : 0;
});

const activeLineHeight = computed(() => {
  const target = getTarget();
  return target ? (target.lineHeight || 1.16) : 1.16;
});

const activeTextAlign = computed(() => {
  const target = getTarget();
  return target ? (target.textAlign || 'left') : 'left';
});

const activeFontWeight = computed(() => {
  const target = getTarget();
  return target ? target.fontWeight : 'normal';
});

const activeFontStyle = computed(() => {
  const target = getTarget();
  return target ? target.fontStyle : 'normal';
});

const activeUnderline = computed(() => {
  const target = getTarget();
  return target ? !!target.underline : false;
});


const getHexColor = (color) => {
  if (!color) return '#000000';
  try {
    const c = new fabric.Color(color);
    return '#' + c.toHex();
  } catch (e) {
    return '#000000';
  }
};

const updateProp = (key, value, saveHistory = true) => {
  if (!activeObject.value || !props.canvas) return;



  if (key === 'fontSize' && (isNaN(value) || value <= 0 || value > 1000)) return;
  if (key === 'opacity' && (isNaN(value) || value < 0 || value > 1)) return;
  if (key === 'lineHeight' && (isNaN(value) || value <= 0 || value > 10)) return;
  if (key === 'charSpacing' && isNaN(value)) return;

  const objs = activeObject.value.type === 'activeSelection' ? activeObject.value.getObjects() : [activeObject.value];

  objs.forEach(obj => {
    obj.set(key, value);
    if (key === 'fontSize' && ['i-text', 'text', 'textbox'].includes(obj.type)) {
      obj.set({ scaleX: 1, scaleY: 1 });
    }
  });

  props.canvas.renderAll();
  if (saveHistory) {
    props.canvas.fire('object:modified');
  }
};

const toggleBold = () => {
  if (!activeObject.value) return;
  const isBold = activeFontWeight.value === 'bold';
  updateProp('fontWeight', isBold ? 'normal' : 'bold');
};

const toggleItalic = () => {
  if (!activeObject.value) return;
  const isItalic = activeFontStyle.value === 'italic';
  updateProp('fontStyle', isItalic ? 'normal' : 'italic');
};

const toggleUnderline = () => {
  if (!activeObject.value) return;
  updateProp('underline', !activeUnderline.value);
};

const cycleAlignment = () => {
  if (!activeObject.value) return;
  const aligns = ['left', 'center', 'right'];
  const current = activeTextAlign.value;
  const nextIndex = (aligns.indexOf(current) + 1) % aligns.length;
  updateProp('textAlign', aligns[nextIndex]);
};

const deleteObject = () => {
  if (!props.canvas) return;
  const active = props.canvas.getActiveObjects();
  if (active.length) {
    props.canvas.discardActiveObject();
    active.forEach((obj) => props.canvas.remove(obj));
    props.canvas.requestRenderAll();
    props.canvas.fire('object:modified');
  }
};

const bringToFront = () => {
  if (!props.canvas || !activeObject.value) return;
  const targets = activeObject.value.type === 'activeSelection' ? activeObject.value.getObjects() : [activeObject.value];
  targets.forEach(obj => {
    props.canvas.bringToFront(obj);
  });


  props.canvas.requestRenderAll();
  props.canvas.fire('object:modified');
  showLayerControls.value = false;
};

const bringForward = () => {
  if (!props.canvas || !activeObject.value) return;
  const targets = activeObject.value.type === 'activeSelection' ? activeObject.value.getObjects() : [activeObject.value];
  targets.forEach(obj => {
    props.canvas.bringForward(obj);
  });

  props.canvas.requestRenderAll();
  props.canvas.fire('object:modified');
  showLayerControls.value = false;
};

const sendBackwards = () => {
  if (!props.canvas || !activeObject.value) return;
  const targets = activeObject.value.type === 'activeSelection' ? activeObject.value.getObjects() : [activeObject.value];
  targets.forEach(obj => {
    const objects = props.canvas.getObjects();
    const currentIndex = objects.indexOf(obj);

    if (currentIndex > 0) {
      const objBelow = objects[currentIndex - 1];
      if (objBelow.id !== 'page-bg' && objBelow.id !== 'page-bg-image') {
        props.canvas.sendBackwards(obj);
      }
    }
  });

  props.canvas.requestRenderAll();
  props.canvas.fire('object:modified');
  showLayerControls.value = false;
};

const sendToBack = () => {
  if (!props.canvas || !activeObject.value) return;
  const targets = activeObject.value.type === 'activeSelection' ? activeObject.value.getObjects() : [activeObject.value];

  targets.forEach(obj => {
    const objects = props.canvas.getObjects();
    const currentIndex = objects.indexOf(obj);
    if (currentIndex <= 0) return;

    let targetIndex = currentIndex;
    for (let i = currentIndex - 1; i >= 0; i--) {
      if (objects[i].id === 'page-bg' || objects[i].id === 'page-bg-image') {
        targetIndex = i + 1;
        break;
      } else if (i === 0) {
        targetIndex = 0;
      }
    }

    if (targetIndex !== currentIndex) {
      obj.moveTo(targetIndex);
    }
  });

  props.canvas.requestRenderAll();
  props.canvas.fire('object:modified');
  showLayerControls.value = false;
};

const updateSelection = () => {
  if (!props.canvas) return;
  const active = props.canvas.getActiveObject();
  if (active && (active.id === 'page-bg' || active.id === 'page-bg-image')) {
    props.canvas.discardActiveObject();
    props.canvas.requestRenderAll();
    activeObject.value = null;
    return;
  }
  if (active !== activeObject.value) {
    showSpacing.value = false;
    showOpacity.value = false;
  }
  activeObject.value = active;
  if (active) triggerRef(activeObject);
};

const handleClickOutside = (e) => {
  if (showFontPicker.value && pickerRef.value && !pickerRef.value.contains(e.target)) {
    showFontPicker.value = false;
  }
  const spacingPopup = document.querySelector('.spacing-popup');
  const spacingBtn = document.querySelector('button[title="ระยะห่างตัวอักษรและบรรทัด"]');
  if (e.target.type === 'range') return;
  if (showSpacing.value && spacingPopup && !spacingPopup.contains(e.target) && (!spacingBtn || !spacingBtn.contains(e.target))) {
    showSpacing.value = false;
  }
  const opacityPopup = document.querySelector('.opacity-popup');
  const opacityBtn = document.querySelector('button[title="ความโปร่งใส"]');
  if (showOpacity.value && opacityPopup && !opacityPopup.contains(e.target) && (!opacityBtn || !opacityBtn.contains(e.target))) {
    showOpacity.value = false;
  }
  const layerPopup = document.querySelector('.layer-popup');
  const layerBtn = document.querySelector('button[title="การจัดลำดับชั้น"]');
  if (showLayerControls.value && layerPopup && !layerPopup.contains(e.target) && (!layerBtn || !layerBtn.contains(e.target))) {
    showLayerControls.value = false;
  }
};

onMounted(() => {
  loadGoogleFontsForPreview();
  if (props.canvas) {
    props.canvas.on('selection:created', updateSelection);
    props.canvas.on('selection:updated', updateSelection);
    props.canvas.on('selection:cleared', updateSelection);
    props.canvas.on('object:modified', updateSelection);
    props.canvas.on('object:scaling', updateSelection);
    props.canvas.on('object:resizing', updateSelection);
    window.addEventListener('click', handleClickOutside);
  }
});

onUnmounted(() => {
  if (props.canvas) {
    props.canvas.off('selection:created', updateSelection);
    window.removeEventListener('click', handleClickOutside);
  }
});
</script>

<style scoped>
.minimal-panel {
  position: fixed;
  top: 80px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  background: white;
  padding: 8px 16px;
  border-radius: 50px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
  border: 1px solid #e0e0e0;
  display: flex;
  align-items: center;
  gap: 8px;
  transition: all 0.2s ease;
  color: #333;
}

.tool-group {
  display: flex;
  align-items: center;
  gap: 5px;
}

.divider {
  width: 1px;
  height: 20px;
  background: #e0e0e0;
  margin: 0 5px;
}

.font-picker-wrapper {
  position: relative;
}

.font-display-btn {
  border: none;
  background: transparent;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  outline: none;
  color: #333;
  padding: 6px 4px;
  line-height: 1.2;
  display: flex;
  align-items: center;
  gap: 4px;
  max-width: 130px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  border-radius: 4px;
  transition: background 0.15s;
}

.font-display-btn:hover {
  background: #f0f0f0;
}

.picker-arrow {
  font-size: 10px;
  color: #999;
  flex-shrink: 0;
}

.font-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  left: 50%;
  transform: translateX(-50%);
  background: white;
  border-radius: 12px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.18);
  border: 1px solid #eee;
  width: 240px;
  z-index: 2000;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.font-search {
  padding: 10px 14px;
  border: none;
  border-bottom: 1px solid #f0f0f0;
  font-size: 13px;
  outline: none;
  background: #fafafa;
  color: #333;
}

.font-list {
  max-height: 320px;
  overflow-y: auto;
  scroll-behavior: smooth;
}

.font-list::-webkit-scrollbar {
  width: 4px;
}

.font-list::-webkit-scrollbar-track {
  background: #f9f9f9;
}

.font-list::-webkit-scrollbar-thumb {
  background: #ddd;
  border-radius: 4px;
}

.font-group {
  padding-bottom: 4px;
}

.font-group-header {
  padding: 8px 14px 4px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  position: sticky;
  top: 0;
  z-index: 1;
}

.thai-header {
  background: #fff8e1;
  color: #f57f17;
}

.latin-header {
  background: #e8f5e9;
  color: #2e7d32;
}

.font-option {
  padding: 8px 14px;
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  transition: background 0.1s;
  font-size: 15px;
  color: #333;
}

.font-option:hover {
  background: #f5f5f5;
}

.font-option.active {
  background: #e3f2fd;
  color: #1565c0;
}

.font-name {
  font-weight: 500;
}

.font-preview-text {
  font-size: 11px;
  color: #aaa;
  font-weight: 400;
}

.latin-font .font-preview-text {
  font-family: inherit;
}

.no-results {
  padding: 20px;
  text-align: center;
  color: #aaa;
  font-size: 13px;
}

.size-input {
  width: 70px;
  border: 1px solid transparent;
  background: #f5f5f5;
  border-radius: 4px;
  padding: 4px;
  text-align: center;
  font-size: 14px;
  color: #333 !important;
}

.color-wrapper {
  position: relative;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  overflow: hidden;
  border: 2px solid #fff;
  box-shadow: 0 0 0 1px #e0e0e0;
  cursor: pointer;
}

.color-input {
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  opacity: 0;
  cursor: pointer;
}

.color-preview {
  display: block;
  width: 100%;
  height: 100%;
}

.icon-btn {
  background: transparent;
  border: none;
  border-radius: 4px;
  padding: 6px 10px;
  cursor: pointer;
  font-size: 14px;
  transition: all 0.2s;
  color: #555 !important;
}

.icon-btn:hover {
  background: #f0f0f0;
  color: #000 !important;
}

.icon-btn.active {
  background: #e3f2fd;
  color: #2196f3 !important;
  font-weight: 600;
}

.delete-icon {
  color: #d32f2f !important;
}

.delete-icon:hover {
  background: #ffebee;
}

.relative {
  position: relative;
}

.popup-menu {
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  margin-top: 10px;
  background: white;
  padding: 15px;
  border-radius: 8px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);
  border: 1px solid #eee;
  width: 220px;
  z-index: 1001;
  color: #333;
}

.popup-item {
  margin-bottom: 10px;
}

.popup-item:last-child {
  margin-bottom: 0;
}

.popup-item label {
  display: block;
  font-size: 12px;
  color: #666;
  margin-bottom: 4px;
}

.popup-item input[type='range'] {
  display: block;
  width: 100%;
  margin: 0;
  padding: 0;
  cursor: pointer;
  box-sizing: border-box;
}

.layer-btn {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #e0e0e0;
  border-radius: 6px;
  background: white;
  cursor: pointer;
  font-size: 13px;
  color: #333;
  text-align: left;
  transition: all 0.2s;
}

.layer-btn:hover {
  background: #f5f5f5;
  border-color: #d0d0d0;
}

.layer-popup {
  width: 160px;
  padding: 8px;
}
</style>
