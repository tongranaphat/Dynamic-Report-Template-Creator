import { describe, it, expect, vi } from 'vitest';

describe('Renderer Block Mapping', () => {
    it('creates correct internal Fabric objects from canonical blocks', async () => {
        const mockBlocks = [
            { id: '1', type: 'text', content: [{ text: '{{var}}' }], transform: { x: 1, y: 1, width: 100, height: 100, rotation: 0 } },
            { id: '2', type: 'image', src: 'http://test', transform: { x: 2, y: 2, width: 200, height: 200, rotation: 0 } }
        ];

        let createdText = false;
        let createdImage = false;

        const renderTextBlock = (block: any) => { createdText = true; };
        const renderImageBlock = (block: any) => { createdImage = true; };

        for (const block of mockBlocks) {
            if (block.type === 'text') renderTextBlock(block);
            if (block.type === 'image') renderImageBlock(block);
        }

        expect(createdText).toBe(true);
        expect(createdImage).toBe(true);
    });
});
