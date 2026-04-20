import { vi, beforeEach, afterEach } from 'vitest';

vi.mock('fabric', () => {
  const ITextMock = vi.fn().mockImplementation(function (text, options) {
    return {
      text,
      type: 'i-text',
      set: vi.fn(),
      get: vi.fn(),
      setControlsVisibility: vi.fn(),
      ...options
    };
  });
  ITextMock.fromObject = vi.fn(function (object, callback) {
    if (callback) callback(object);
    return object;
  });

  return {
    fabric: {
      devicePixelRatio: 1,
      Canvas: vi.fn().mockImplementation(function (canvasId, options) {
        return {
          setBackgroundColor: vi.fn((color, callback) => {
            if (callback) callback();
          }),
          renderAll: vi.fn(),
          requestRenderAll: vi.fn(),
          toJSON: vi.fn(() => ({ objects: [] })),
          loadFromJSON: vi.fn((json, callback) => {
            if (callback) callback();
          }),
          on: vi.fn(),
          off: vi.fn(),
          fire: vi.fn(),
          getObjects: vi.fn(() => []),
          add: vi.fn(),
          remove: vi.fn(),
          setActiveObject: vi.fn(),
          getActiveObject: vi.fn(),
          getActiveObjects: vi.fn(() => []),
          discardActiveObject: vi.fn(),
          requestRenderAll: vi.fn(),
          getPointer: vi.fn(() => ({ x: 100, y: 100 })),
          setBackgroundImage: vi.fn(),
          value: null
        };
      }),
      IText: ITextMock,
      Image: {
        fromURL: vi.fn((url, callback) => {
          callback({ scaleToWidth: vi.fn() });
        })
      }
    }
  };
});

if (typeof globalThis.document !== 'undefined') {
  globalThis.document.fonts = globalThis.document.fonts || { ready: Promise.resolve() };
}

Object.defineProperty(window, 'saveCurrentPageState', {
  value: vi.fn(),
  writable: true
});

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});
