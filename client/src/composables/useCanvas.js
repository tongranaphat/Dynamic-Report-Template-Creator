import { USE_NEW_ENGINE } from '../constants/engine';
import { useCanvasLegacy } from './useCanvasLegacy';
import { useCanvasEngine } from './useCanvasEngine';

console.log("[CANVAS ADAPTER LOADED]");

export function useCanvas(...args) {
  if (USE_NEW_ENGINE) {
    console.log("[ENGINE SELECTED]", "new");
    console.log('[ENGINE] Using NEW Canvas Engine');
    return useCanvasEngine(...args);
  }

  console.log("[ENGINE SELECTED]", "legacy");
  console.log('[ENGINE] Using LEGACY Canvas');
  return useCanvasLegacy(...args);
}
