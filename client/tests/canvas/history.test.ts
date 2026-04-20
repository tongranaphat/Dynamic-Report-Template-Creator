import { describe, it, expect, vi } from 'vitest';
import { CanvasHistory } from '../../src/engines/document/canvasHistory';

describe('History Integration', () => {
    it('should push history frames when blocks change', () => {
        const blocks: any[] = [];
        const history = new CanvasHistory(blocks);

        blocks.push({ type: 'image' } as any);
        history.push(blocks);

        blocks.push({ type: 'text' } as any);
        history.push(blocks);

        expect(history.canUndo()).toBe(true);
        expect(history.undo().length).toBe(1);
    });
});
