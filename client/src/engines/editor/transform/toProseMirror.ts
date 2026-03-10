import type { Node as PMNode, Schema } from 'prosemirror-model';
import type {
    CanonicalBlock,
    TextBlock,
    ImageBlock,
    InlineRun,
    Mark as CanonicalMark,
} from '../../document/canonical';

export function canonicalBlockToPM(
    block: CanonicalBlock,
    schema: Schema
): PMNode {
    switch (block.type) {
        case 'text':
            return textBlockToPM(block, schema);
        case 'image':
            return imageBlockToPM(block, schema);
        default:
            throw new Error(`Unsupported block type: ${(block as any).type}`);
    }
}

function textBlockToPM(block: TextBlock, schema: Schema): PMNode {
    const paragraphs: PMNode[] = [];
    let currentNodes: PMNode[] = [];

    for (const run of block.content) {
        const segments = run.text.split('\n');

        for (let i = 0; i < segments.length; i++) {
            if (i > 0) {
                paragraphs.push(
                    schema.node('paragraph', null, currentNodes.length > 0 ? currentNodes : undefined)
                );
                currentNodes = [];
            }

            const text = segments[i];
            if (text.length === 0) continue;

            const marks = canonicalMarksToPM(run.marks, run.typographyRef, schema);
            currentNodes.push(schema.text(text, marks));
        }
    }

    paragraphs.push(
        schema.node('paragraph', null, currentNodes.length > 0 ? currentNodes : undefined)
    );

    return schema.node('doc', null, paragraphs);
}

function imageBlockToPM(block: ImageBlock, schema: Schema): PMNode {
    const imageNode = schema.node('image', {
        src: block.src,
        width: block.width,
        height: block.height,
    });
    return schema.node('doc', null, [imageNode]);
}

function canonicalMarksToPM(
    marks: CanonicalMark[],
    typographyRef: string | undefined,
    schema: Schema
): ReturnType<Schema['mark']>[] {
    const pmMarks: ReturnType<Schema['mark']>[] = [];
    const sorted = [...marks].sort((a, b) => a.type.localeCompare(b.type));

    for (const mark of sorted) {
        switch (mark.type) {
            case 'bold': pmMarks.push(schema.mark('bold')); break;
            case 'italic': pmMarks.push(schema.mark('italic')); break;
            case 'underline': pmMarks.push(schema.mark('underline')); break;
            case 'strikethrough': pmMarks.push(schema.mark('strikethrough')); break;
            case 'superscript': pmMarks.push(schema.mark('superscript')); break;
            case 'subscript': pmMarks.push(schema.mark('subscript')); break;
            case 'color': pmMarks.push(schema.mark('color', { colorRef: mark.colorRef })); break;
            case 'highlight': pmMarks.push(schema.mark('highlight', { colorRef: mark.colorRef })); break;
            case 'link': pmMarks.push(schema.mark('link', { href: mark.href })); break;
            case 'variable': pmMarks.push(schema.mark('variable', { key: mark.key })); break;
        }
    }

    if (typographyRef) {
        pmMarks.push(schema.mark('typographyRef', { tokenId: typographyRef }));
    }

    return pmMarks;
}
