import type { CanonicalBlock, InlineRun, TextBlock, ImageBlock } from '../document/canonical';

export interface ValidationResult {
    valid: boolean;
    errors: string[];
}

export function validateBlock(block: CanonicalBlock): ValidationResult {
    const errors: string[] = [];

    // Common block validation
    if (!block.id || block.id.length === 0) {
        errors.push(`Block is missing an id`);
    }

    if (block.opacity < 0 || block.opacity > 1) {
        errors.push(`Block "${block.id}": opacity must be between 0 and 1`);
    }

    switch (block.type) {
        case 'text':
            validateTextBlock(block, errors);
            break;
        case 'image':
            validateImageBlock(block, errors);
            break;
    }

    return { valid: errors.length === 0, errors };
}

function validateTextBlock(block: TextBlock, errors: string[]): void {
    if (!block.content || block.content.length === 0) {
        errors.push(`TextBlock "${block.id}": content must have at least 1 run`);
    }

    for (let i = 0; i < block.content.length; i++) {
        const run = block.content[i];
        validateInlineRun(run, i, block.id, errors);
    }
}

function validateInlineRun(
    run: InlineRun,
    index: number,
    blockId: string,
    errors: string[]
): void {
    if (run.text.length === 0) {
        errors.push(`TextBlock "${blockId}": run ${index} has empty text`);
    }

    for (let m = 1; m < run.marks.length; m++) {
        if (run.marks[m].type < run.marks[m - 1].type) {
            errors.push(`TextBlock "${blockId}": run ${index} marks not sorted`);
            break;
        }
    }

    const types = new Set(run.marks.map((m) => m.type));
    if (types.size !== run.marks.length) {
        errors.push(`TextBlock "${blockId}": run ${index} has duplicate marks`);
    }

    if (types.has('superscript') && types.has('subscript')) {
        errors.push(`TextBlock "${blockId}": run ${index} has both superscript and subscript`);
    }

    const varMark = run.marks.find((m) => m.type === 'variable');
    if (varMark && !/^\{\{[a-zA-Z_]\w*\}\}$/.test(run.text)) {
        errors.push(`TextBlock "${blockId}": run ${index} variable text malformed`);
    }
}

function validateImageBlock(block: ImageBlock, errors: string[]): void {
    if (!block.src || block.src.length === 0) {
        errors.push(`ImageBlock "${block.id}": src must not be empty`);
    }

    if (block.width <= 0) {
        errors.push(`ImageBlock "${block.id}": width must be greater than 0`);
    }

    if (block.height <= 0) {
        errors.push(`ImageBlock "${block.id}": height must be greater than 0`);
    }
}

export function validateBlocks(blocks: CanonicalBlock[]): ValidationResult {
    const allErrors: string[] = [];

    if (blocks.length === 0) {
        allErrors.push('Document must have at least 1 block');
    }

    const ids = new Set<string>();
    for (const block of blocks) {
        if (ids.has(block.id)) {
            allErrors.push(`Duplicate block id: "${block.id}"`);
        }
        ids.add(block.id);

        const result = validateBlock(block);
        allErrors.push(...result.errors);
    }

    return { valid: allErrors.length === 0, errors: allErrors };
}
