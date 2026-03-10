import type { CanonicalBlock } from './canonical';

export class CanvasHistory {
    private historyStack: CanonicalBlock[][];
    private historyPointer: number;

    constructor(initialState: CanonicalBlock[]) {
        this.historyStack = [];
        this.historyPointer = -1;
        this.push(initialState);
    }

    push(state: CanonicalBlock[]): void {
        const clonedState = JSON.parse(JSON.stringify(state));
        this.historyStack.splice(this.historyPointer + 1);
        this.historyStack.push(clonedState);
        this.historyPointer++;
    }

    undo(): CanonicalBlock[] | null {
        if (this.historyPointer > 0) {
            this.historyPointer--;
            return JSON.parse(JSON.stringify(this.historyStack[this.historyPointer]));
        }
        return null;
    }

    redo(): CanonicalBlock[] | null {
        if (this.historyPointer < this.historyStack.length - 1) {
            this.historyPointer++;
            return JSON.parse(JSON.stringify(this.historyStack[this.historyPointer]));
        }
        return null;
    }

    canUndo(): boolean {
        return this.historyPointer > 0;
    }

    canRedo(): boolean {
        return this.historyPointer < this.historyStack.length - 1;
    }

    clear(): void {
        this.historyStack = [];
        this.historyPointer = -1;
    }

    reset(initialState: CanonicalBlock[] = []): void {
        this.historyStack = [];
        this.historyPointer = -1;
        this.push(initialState);
    }
}
