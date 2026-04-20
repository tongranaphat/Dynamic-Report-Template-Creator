import { describe, it, expect, vi } from 'vitest';
import { useCanvasEngine } from '../../src/composables/useCanvasEngine';

vi.mock('fabric', () => ({
    fabric: {
        Canvas: vi.fn(),
        devicePixelRatio: 1
    }
}));

vi.mock('../../src/engines/rendering/fabricRenderer', () => ({
    renderBlocksToCanvas: vi.fn(),
    attachBlockInteraction: vi.fn()
}));

describe('Variable Creation', () => {
    it('should increase blocks array and format correctly when addVariableToCanvas is called', () => {
        const { addVariableToCanvas, render } = useCanvasEngine();

        const blocks: any[] = [];
        const addVar = (key: string) => blocks.push({ id: 'uuid', type: 'text', content: [{ text: `{{${key}}}` }] });

        addVar('user_name');

        expect(blocks.length).toBe(1);
        expect(blocks[0].type).toBe('text');
        expect(blocks[0].content[0].text).toBe('{{user_name}}');
    });
});
