import { describe, it, expect } from 'vitest';
import equal from 'fast-deep-equal';
import { Schema } from 'prosemirror-model';
import { canonicalBlockToPM } from '../toProseMirror';
import { pmToCanonicalBlocks } from '../toCanonical';
import type { CanonicalBlock, TextBlock, ImageBlock } from '../../../document/canonical';

// ── Schema (mirrors editor schema) ──────────────────────

const schema = new Schema({
    nodes: {
        doc: { content: 'block+' },
        paragraph: { content: 'inline*', group: 'block', toDOM: () => ['p', 0] },
        image: {
            group: 'block',
            atom: true,
            attrs: {
                src: { default: null },
                width: { default: 300 },
                height: { default: 200 },
            },
            toDOM: (node) => ['img', node.attrs],
        },
        text: { group: 'inline', inline: true },
    },
    marks: {
        bold: { toDOM: () => ['strong', 0] },
        italic: { toDOM: () => ['em', 0] },
        underline: { toDOM: () => ['u', 0] },
        strikethrough: { toDOM: () => ['s', 0] },
        superscript: { toDOM: () => ['sup', 0] },
        subscript: { toDOM: () => ['sub', 0] },
        color: { attrs: { colorRef: {} }, toDOM: (m) => ['span', { 'data-color': m.attrs.colorRef }, 0] },
        highlight: { attrs: { colorRef: {} }, toDOM: (m) => ['span', { 'data-hl': m.attrs.colorRef }, 0] },
        link: { attrs: { href: {} }, toDOM: (m) => ['a', { href: m.attrs.href }, 0] },
        variable: { attrs: { key: {} }, toDOM: (m) => ['span', { 'data-var': m.attrs.key }, 0] },
        typographyRef: { attrs: { tokenId: {} }, toDOM: (m) => ['span', { 'data-typo': m.attrs.tokenId }, 0] },
    },
});

// ── Helpers ──────────────────────────────────────────────

function stripIds(obj: unknown): unknown {
    if (Array.isArray(obj)) return obj.map(stripIds);
    if (obj !== null && typeof obj === 'object') {
        const copy: Record<string, unknown> = {};
        for (const [key, val] of Object.entries(obj as Record<string, unknown>)) {
            if (key === 'id') continue;
            copy[key] = stripIds(val);
        }
        return copy;
    }
    return obj;
}

function assertRoundTrip(original: CanonicalBlock): void {
    const pmNode = canonicalBlockToPM(original, schema);
    const restored = pmToCanonicalBlocks(pmNode);

    const originalStripped = stripIds(original);
    const restoredBlock = restored.find((b) => b.type === original.type);
    if (!restoredBlock) {
        throw new Error(`Round-trip failed: block type "${original.type}" not found in result`);
    }
    const restoredStripped = stripIds(restoredBlock);

    if (!equal(originalStripped, restoredStripped)) {
        throw new Error(
            `Round-trip transform is NOT deterministic for block type "${original.type}".\n` +
            `Original: ${JSON.stringify(originalStripped, null, 2)}\n` +
            `Restored: ${JSON.stringify(restoredStripped, null, 2)}`
        );
    }
}

// ── Tests ────────────────────────────────────────────────

describe('Canonical ↔ ProseMirror round-trip transform', () => {
    it('paragraph with bold text survives round-trip', () => {
        const block: TextBlock = {
            id: 'txt-001',
            type: 'text',
            content: [
                { text: 'Hello ', marks: [] },
                { text: 'world', marks: [{ type: 'bold' }] },
            ],
            transform: { x: 0, y: 0, width: 600, height: 200, rotation: 0 },
            opacity: 1,
            visible: true,
            locked: false,
            layout: {
                align: 'start',
                verticalAlign: 'top',
                lineHeightRatio: 1.6,
                trackingStep: 'normal',
                paragraphSpacingStep: 'none',
                overflow: 'wrap',
            },
            locale: {
                languageHint: 'th',
                lineBreakStrategy: { mode: 'mixed', primaryScript: 'thai' },
                textDirection: 'ltr',
            },
        };

        assertRoundTrip(block);
    });

    it('heading level 2 text survives round-trip', () => {
        const block: TextBlock = {
            id: 'heading-001',
            type: 'text',
            content: [
                { text: 'Section Title', marks: [{ type: 'bold' }] },
            ],
            transform: { x: 0, y: 0, width: 600, height: 200, rotation: 0 },
            opacity: 1,
            visible: true,
            locked: false,
            layout: {
                align: 'start',
                verticalAlign: 'top',
                lineHeightRatio: 1.6,
                trackingStep: 'normal',
                paragraphSpacingStep: 'none',
                overflow: 'wrap',
            },
            locale: {
                languageHint: 'th',
                lineBreakStrategy: { mode: 'mixed', primaryScript: 'thai' },
                textDirection: 'ltr',
            },
        };

        assertRoundTrip(block);
    });

    it('image block survives round-trip', () => {
        const block: ImageBlock = {
            id: 'img-001',
            type: 'image',
            src: 'https://example.com/photo.jpg',
            width: 400,
            height: 300,
            transform: { x: 0, y: 0, width: 400, height: 300, rotation: 0 },
            opacity: 1,
            visible: true,
            locked: false,
        };

        const pmNode = canonicalBlockToPM(block, schema);
        const restored = pmToCanonicalBlocks(pmNode);
        const restoredImage = restored.find((b) => b.type === 'image') as ImageBlock | undefined;

        expect(restoredImage).toBeDefined();
        expect(restoredImage!.src).toBe(block.src);
        expect(restoredImage!.width).toBe(block.width);
        expect(restoredImage!.height).toBe(block.height);
        expect(restoredImage!.type).toBe('image');
    });

    it('transform is deterministic across multiple runs', () => {
        const block: TextBlock = {
            id: 'det-001',
            type: 'text',
            content: [
                { text: 'Thai ', marks: [] },
                { text: 'bold', marks: [{ type: 'bold' }] },
                { text: ' end', marks: [] },
            ],
            transform: { x: 0, y: 0, width: 600, height: 200, rotation: 0 },
            opacity: 1,
            visible: true,
            locked: false,
            layout: {
                align: 'start',
                verticalAlign: 'top',
                lineHeightRatio: 1.6,
                trackingStep: 'normal',
                paragraphSpacingStep: 'none',
                overflow: 'wrap',
            },
            locale: {
                languageHint: 'th',
                lineBreakStrategy: { mode: 'mixed', primaryScript: 'thai' },
                textDirection: 'ltr',
            },
        };

        const results: string[] = [];
        for (let i = 0; i < 10; i++) {
            const pmNode = canonicalBlockToPM(block, schema);
            const restored = pmToCanonicalBlocks(pmNode);
            const text = restored.find((b) => b.type === 'text') as TextBlock;
            results.push(JSON.stringify(stripIds(text)));
        }

        const allSame = results.every((r) => r === results[0]);
        expect(allSame).toBe(true);
    });
});
