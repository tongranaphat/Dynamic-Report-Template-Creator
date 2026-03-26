import { Node } from '@tiptap/core';

export const CustomImage = Node.create({
    name: 'image',
    group: 'block',
    selectable: true,
    draggable: true,
    atom: true,

    addAttributes() {
        return {
            src: {
                default: null,
                parseHTML: (element: HTMLElement) => element.getAttribute('src'),
            },
            width: {
                default: 300,
                parseHTML: (element: HTMLElement) => {
                    const val = element.getAttribute('width');
                    return val ? Number(val) : 300;
                },
            },
            height: {
                default: 200,
                parseHTML: (element: HTMLElement) => {
                    const val = element.getAttribute('height');
                    return val ? Number(val) : 200;
                },
            },
        };
    },

    parseHTML() {
        return [{ tag: 'img[src]' }];
    },

    renderHTML({ HTMLAttributes }: { HTMLAttributes: Record<string, unknown> }) {
        return ['img', {
            src: HTMLAttributes.src,
            width: HTMLAttributes.width,
            height: HTMLAttributes.height,
        }];
    },
});
