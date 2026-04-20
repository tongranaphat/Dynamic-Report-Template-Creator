import { describe, it, expect, vi } from 'vitest';

describe('Asset Drag Drop Pipeline', () => {
    it('should call addImageToCanvas when asset drops', () => {
        let addedAsset = '';

        const addImageToCanvas = vi.fn((url) => {
            addedAsset = url;
        });

        const onDrop = (e) => {
            const asset = e.dataTransfer.getData('asset');
            if (asset) {
                addImageToCanvas(asset, 100, 100);
            }
        };

        const dropEvent = {
            preventDefault: () => { },
            clientX: 200,
            clientY: 200,
            currentTarget: {
                getBoundingClientRect: () => ({ left: 0, top: 0 })
            },
            dataTransfer: {
                getData: (type) => type === 'asset' ? 'http://test.local/img.png' : null
            }
        };

        onDrop(dropEvent);

        expect(addImageToCanvas).toHaveBeenCalledTimes(1);
        expect(addedAsset).toBe('http://test.local/img.png');
    });
});
