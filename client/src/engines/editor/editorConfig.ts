import { Editor } from '@tiptap/vue-3';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Superscript from '@tiptap/extension-superscript';
import Subscript from '@tiptap/extension-subscript';
import Link from '@tiptap/extension-link';
import { CustomImage } from './extensions/customImage';
import type { EditorView } from 'prosemirror-view';

export interface EditorConfig {
    element: HTMLElement;
    content?: Record<string, unknown>;
    onBlur?: () => void;
    onEscape?: () => boolean;
}

export function createEditor(config: EditorConfig): Editor {
    return new Editor({
        element: config.element,
        content: config.content ?? '',
        extensions: [
            StarterKit.configure({
                heading: false,
                codeBlock: false,
            }),
            Underline,
            Superscript,
            Subscript,
            Link.configure({
                openOnClick: false,
            }),
            CustomImage,
        ],
        editorProps: {
            handleKeyDown: (_view: EditorView, event: KeyboardEvent) => {
                if (event.key === 'Escape' && config.onEscape) {
                    return config.onEscape();
                }
                return false;
            },
        },
        onBlur: () => {
            config.onBlur?.();
        },
    });
}
