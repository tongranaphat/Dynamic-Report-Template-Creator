import { v4 as uuid } from 'uuid';
import type { Node as PMNode } from 'prosemirror-model';
import type {
    CanonicalBlock,
    InlineRun,
    Mark,
    ImageBlock,
    TextBlock,
} from '../../document/canonical';

export function pmToCanonicalBlocks(pmDoc: PMNode): CanonicalBlock[] {
    const blocks: CanonicalBlock[] = [];

    pmDoc.forEach((node) => {
        switch (node.type.name) {
            case 'paragraph':
            case 'heading': {
                const runs: InlineRun[] = [];
                node.forEach((textNode) => {
                    const marks = pmMarksToCanonical(textNode.marks);
                    const typographyRef = extractTypographyRef(textNode.marks);

                    const run: InlineRun = { text: textNode.text!, marks };
                    if (typographyRef) run.typographyRef = typographyRef;

                    runs.push(run);
                });
                blocks.push(createTextBlock(runs));
                break;
            }
            case 'image':
                blocks.push(imageNodeToCanonical(node));
                break;
        }
    });

    return blocks;
}

export function pmToInlineRuns(pmDoc: PMNode): InlineRun[] {
    return mergeAdjacentRuns(extractInlineRuns(pmDoc));
}

function extractInlineRuns(pmDoc: PMNode): InlineRun[] {
    const runs: InlineRun[] = [];
    let paragraphIndex = 0;

    pmDoc.forEach((node) => {
        if (node.type.name !== 'paragraph' && node.type.name !== 'heading') return;

        if (paragraphIndex > 0) {
            runs.push({ text: '\n', marks: [] });
        }

        node.forEach((textNode) => {
            const marks = pmMarksToCanonical(textNode.marks);
            const typographyRef = extractTypographyRef(textNode.marks);

            const run: InlineRun = { text: textNode.text!, marks };
            if (typographyRef) run.typographyRef = typographyRef;

            runs.push(run);
        });

        paragraphIndex++;
    });

    return runs;
}

function imageNodeToCanonical(node: PMNode): ImageBlock {
    return {
        id: uuid(),
        type: 'image',
        src: node.attrs.src as string,
        width: node.attrs.width as number,
        height: node.attrs.height as number,
        transform: { x: 0, y: 0, width: node.attrs.width, height: node.attrs.height, rotation: 0 },
        opacity: 1,
        visible: true,
        locked: false,
    };
}

function createTextBlock(runs: InlineRun[]): TextBlock {
    return {
        id: uuid(),
        type: 'text',
        content: mergeAdjacentRuns(runs),
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
}

function pmMarksToCanonical(
    pmMarks: readonly import('prosemirror-model').Mark[]
): Mark[] {
    const marks: Mark[] = [];

    for (const pm of pmMarks) {
        switch (pm.type.name) {
            case 'bold': marks.push({ type: 'bold' }); break;
            case 'italic': marks.push({ type: 'italic' }); break;
            case 'underline': marks.push({ type: 'underline' }); break;
            case 'strikethrough': marks.push({ type: 'strikethrough' }); break;
            case 'superscript': marks.push({ type: 'superscript' }); break;
            case 'subscript': marks.push({ type: 'subscript' }); break;
            case 'color': marks.push({ type: 'color', colorRef: pm.attrs.colorRef }); break;
            case 'highlight': marks.push({ type: 'highlight', colorRef: pm.attrs.colorRef }); break;
            case 'link': marks.push({ type: 'link', href: pm.attrs.href }); break;
            case 'variable': marks.push({ type: 'variable', key: pm.attrs.key }); break;
            case 'typographyRef': break; // handled separately
        }
    }

    return marks.sort((a, b) => a.type.localeCompare(b.type));
}

function extractTypographyRef(
    pmMarks: readonly import('prosemirror-model').Mark[]
): string | undefined {
    const typo = pmMarks.find((m) => m.type.name === 'typographyRef');
    return typo?.attrs.tokenId as string | undefined;
}

function mergeAdjacentRuns(runs: InlineRun[]): InlineRun[] {
    if (runs.length === 0) return runs;

    const merged: InlineRun[] = [{ ...runs[0], marks: [...runs[0].marks] }];

    for (let i = 1; i < runs.length; i++) {
        const prev = merged[merged.length - 1];
        const curr = runs[i];

        if (marksEqual(prev.marks, curr.marks) && prev.typographyRef === curr.typographyRef) {
            prev.text += curr.text;
        } else {
            merged.push({ ...curr, marks: [...curr.marks] });
        }
    }

    return merged;
}

function marksEqual(a: Mark[], b: Mark[]): boolean {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
        if (a[i].type !== b[i].type) return false;
        if ('colorRef' in a[i] && (a[i] as any).colorRef !== (b[i] as any).colorRef) return false;
        if ('key' in a[i] && (a[i] as any).key !== (b[i] as any).key) return false;
        if ('href' in a[i] && (a[i] as any).href !== (b[i] as any).href) return false;
    }
    return true;
}
