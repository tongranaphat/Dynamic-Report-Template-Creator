export function useRealTime() {
  return {
    initSocket: () => {},
    disconnectSocket: () => {},
    broadcastChange: () => {},
    connect: () => {},
    emitUpdate: () => {},
    disconnect: () => {}
  };
}
