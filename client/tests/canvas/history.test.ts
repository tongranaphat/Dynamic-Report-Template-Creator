import { describe, it, expect, vi } from 'vitest';
import { CanvasHistory } from '../../src/engines/document/canvasHistory';

describe('History Integration', () => {
    it('should push history frames when blocks change', () => {
        const blocks: any[] = [];
        const history = new CanvasHistory(blocks);

        // Simulate addImageToCanvas pushing the block and saving
        blocks.push({ type: 'image' } as any);
        history.push(blocks);

        // Simulate addVariableToCanvas pushing the block and saving
        blocks.push({ type: 'text' } as any);
        history.push(blocks);

        // Verify history stack size increased (initial + 2 actions)
        expect(history.canUndo()).toBe(true);
        expect(history.undo().length).toBe(1); // 1 block from first action
    });
});
