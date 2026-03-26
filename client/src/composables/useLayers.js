import { ref } from 'vue';

export const useLayers = () => {
  const layers = ref([]);

  const updateLayers = (canvas) => {
    if (!canvas) {
      layers.value = [];
      return;
    }

    const objects = canvas.getObjects();
    const activeObject = canvas.getActiveObject();

    // Map ข้อมูลวัตถุทั้งหมดบน Canvas ก่อน
    const mappedLayers = objects.map((obj, index) => {
      // ข้ามพวกพื้นหลังหน้ากระดาษ ไม่ต้องเอามาแสดงในเลเยอร์
      if (obj.id === 'page-bg' || obj.id === 'page-bg-image') return null;

      let label = 'วัตถุ';
      if (obj.type === 'image') label = 'รูปภาพ';
      else if (['textbox', 'text', 'i-text'].includes(obj.type)) label = 'ข้อความ';
      else if (['rect', 'circle', 'polygon', 'path', 'line'].includes(obj.type)) label = 'รูปทรง';
      else if (obj.type === 'group') label = 'กลุ่มวัตถุ';

      return {
        id: obj.id || `layer-${index}`,
        label,
        index, // ได้ค่า Z-index ที่แท้จริง
        isActive: activeObject === obj,
        rawObject: obj
      };
    }).filter(Boolean); // กรองพวกพื้นหลัง (null) ทิ้งไป

    // กลับด้าน Array ให้ชั้นที่อยู่บนสุด (index สูงสุด) แสดงเป็นอันดับแรก
    layers.value = mappedLayers.reverse();

    // เช็คว่าหาวัตถุเจอไหม (ดูได้ใน Console กด F12)
    // console.log("อัปเดตเลเยอร์แล้ว เจอวัตถุจำนวน:", layers.value.length);
  };

  return {
    layers,
    updateLayers
  };
};