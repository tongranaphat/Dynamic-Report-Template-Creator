import { io } from 'socket.io-client';
import { onUnmounted } from 'vue';

let socket = null;

export function useRealTime() {
  const connect = (reportId, onSyncCallback) => {
    let baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

    baseUrl = baseUrl.replace(/\/api$/, '');

    socket = io(baseUrl, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true
    });

    socket.on('connect', () => {
      socket.emit('join-report', reportId);
    });

    socket.on('connect_error', (err) => {
      console.error('Socket Connection Error:', err);
    });

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
