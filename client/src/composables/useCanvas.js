import { USE_NEW_ENGINE } from '../constants/engine';
import { useCanvasLegacy } from './useCanvasLegacy';
import { useCanvasEngine } from './useCanvasEngine';

export function useCanvas(...args) {
  if (USE_NEW_ENGINE) {
    return useCanvasEngine(...args);
  }
  return useCanvasLegacy(...args);
}
