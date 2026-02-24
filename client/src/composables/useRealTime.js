import { io } from 'socket.io-client';
import { onUnmounted } from 'vue';

let socket = null;

export function useRealTime() {
  const connect = (reportId, onSyncCallback) => {
    // 1. ดึง URL มา
    let baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

    // 2. ✂️ ตัดคำว่า '/api' ออก (ถ้ามี) เพื่อให้ได้ Root Domain
    // ผลลัพธ์จะเป็น https://...onrender.com เฉยๆ (ซึ่ง Socket ชอบ)
    baseUrl = baseUrl.replace(/\/api$/, '');

    // 3. เชื่อมต่อด้วย URL ที่ถูกต้อง
    socket = io(baseUrl, {
      path: '/socket.io', // ระบุ path มาตรฐานของ Socket.IO
      transports: ['websocket', 'polling'], // บังคับใช้ทั้งคู่เพื่อความชัวร์
      reconnection: true // ให้พยายามต่อใหม่ถ้าหลุด
    });

    socket.on('connect', () => {
      console.log('🟢 Socket Connected:', socket.id);
      socket.emit('join-report', reportId);
    });

    socket.on('connect_error', (err) => {
      console.error('🔴 Socket Connection Error:', err);
    });

    // รับข้อมูลจาก Server -> ส่งไปให้ useCanvas วาด
    socket.on('canvas-sync', (data) => {
      if (onSyncCallback) onSyncCallback(data);
    });
  };

  const emitUpdate = (reportId, canvasJson) => {
    if (socket) {
      socket.emit('canvas-update', { reportId, data: canvasJson });
    }
  };

  const disconnect = () => {
    if (socket) {
      socket.disconnect();
      socket = null;
    }
  };

  onUnmounted(() => {
    disconnect();
  });

  return {
    connect,
    emitUpdate,
    disconnect
  };
}
