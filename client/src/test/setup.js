import { vi } from 'vitest';

// Mock fabric.js
vi.mock('fabric', () => ({
  fabric: {
    Canvas: vi.fn().mockImplementation(() => ({
      setBackgroundColor: vi.fn(),
      renderAll: vi.fn(),
      toJSON: vi.fn(() => ({ objects: [] })),
      loadFromJSON: vi.fn((json, callback) => {
        if (callback) callback();
      }),
      on: vi.fn(),
      getObjects: vi.fn(() => []),
      add: vi.fn(),
      setActiveObject: vi.fn(),
      getActiveObject: vi.fn(),
      getActiveObjects: vi.fn(() => []),
      discardActiveObject: vi.fn(),
      remove: vi.fn(),
      requestRenderAll: vi.fn(),
      getPointer: vi.fn(() => ({ x: 100, y: 100 })),
      setBackgroundImage: vi.fn(),
      value: null
    })),
    IText: vi.fn().mockImplementation(() => ({
      set: vi.fn(),
      get: vi.fn()
    })),
    Image: {
      fromURL: vi.fn((url, callback) => {
        callback({ scaleToWidth: vi.fn() });
      })
    }
  }
}));

// Mock window functions
Object.defineProperty(window, 'saveCurrentPageState', {
  value: vi.fn(),
  writable: true
});
