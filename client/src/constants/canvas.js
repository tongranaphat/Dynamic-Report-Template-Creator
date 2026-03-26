// client/src/constants/canvas.js

export const CANVAS_CONSTANTS = {
  // ขนาดหน้ากระดาษ A4 (ที่ 96 DPI)
  PAGE_WIDTH: 794,
  PAGE_HEIGHT: 1123,

  // ระยะห่างระหว่างหน้า
  PAGE_GAP: 40,

  // การตั้งค่า Zoom
  MIN_ZOOM: 0.1,
  MAX_ZOOM: 3.0,
  ZOOM_STEP: 0.1,

  // ตำแหน่งและขนาดเริ่มต้นของ Objects
  DEFAULT_LEFT: 50,
  DEFAULT_TOP: 50,
  DEFAULT_FONT_SIZE: 20,
  DEFAULT_BOTTOM_MARGIN: 20,

  // สีพื้นหลังต่างๆ
  DEFAULT_BG_COLOR: '#ffffff',
  PREVIEW_BG_COLOR: '#f9f9f9',
  WORKSPACE_BG_COLOR: '#525659',

  // การตั้งค่าคุณภาพ
  IMAGE_QUALITY: 0.8,
  PDF_MULTIPLIER: 2,

  // จำนวนประวัติการ Undo สูงสุด
  MAX_HISTORY: 50,

  // Delay สำหรับ Animation หรือการรอ Render (ms)
  RENDER_DELAY: 100,
  ZOOM_RENDER_DELAY: 200,
  OBJECT_UNLOCK_DELAY: 50
};

export default CANVAS_CONSTANTS;
