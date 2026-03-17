import { fabric } from 'fabric';
import type { CanonicalBlock, TextBlock, ImageBlock } from '../document/canonical';
import type { CanvasHistory } from '../document/canvasHistory';

let keyboardBound = false;
const GRID_SIZE = 10;
const SNAP_THRESHOLD = 6;
let activeGuides: fabric.Line[] = [];

export function attachBlockInteraction(
    canvas: fabric.Canvas,
    getBlocks: () => CanonicalBlock[],
    history: CanvasHistory,
    rerender: () => void
): void {
    const clearGuides = () => {
        activeGuides.forEach((guide) => canvas.remove(guide));
        activeGuides = [];
    };

    canvas.on('object:moving', (e) => {
        const target = e.target;
        if (!target) return;

        clearGuides();

        // Handle both single objects and ActiveSelection
        const targets = (target as any).type === 'activeSelection' ? (target as any).getObjects() : [target];

        // 1. Array loop performance optimization: Precompute bounds before the loop
        const objects = canvas.getObjects().filter((obj) =>
            !targets.includes(obj) && (obj as any).nodeId !== undefined
        );
        const cachedBounds = objects.map(obj => obj.getBoundingRect());

        // 2. Get target bounds BEFORE any snapping
        target.setCoords();
        const targetBounds = target.getBoundingRect();

        const targetLeft = targetBounds.left;
        const targetRight = targetBounds.left + targetBounds.width;
        const targetCenterX = targetBounds.left + targetBounds.width / 2;
        const targetTop = targetBounds.top;
        const targetBottom = targetBounds.top + targetBounds.height;
        const targetCenterY = targetBounds.top + targetBounds.height / 2;

        let snappedX = false;
        let snappedY = false;

        // Get the logical coordinates of the visible canvas area
        const vpt = canvas.viewportTransform;
        let vptTl = { x: -5000, y: -5000 };
        let vptBr = { x: 5000, y: 5000 };

        if (vpt) {
            const invertedVpt = fabric.util.invertTransform(vpt);
            vptTl = fabric.util.transformPoint(new fabric.Point(0, 0), invertedVpt);
            vptBr = fabric.util.transformPoint(new fabric.Point(canvas.width || 1000, canvas.height || 1000), invertedVpt);
        }

        // Get current zoom level for manual stroke scaling
        const zoom = canvas.getZoom() || 1;

        // 3. Draw guide functions with proper viewport handling
        const drawGuide = (coords: number[], isCanvasCenter = false) => {
            const line = new fabric.Line(coords, {
                stroke: isCanvasCenter ? '#FF00FF' : '#4A90E2',
                strokeWidth: (isCanvasCenter ? 2 : 1) / zoom,
                strokeDashArray: isCanvasCenter ? undefined : [4 / zoom, 4 / zoom],
                selectable: false,
                evented: false,
                excludeFromExport: true,
                hoverCursor: 'default'
                // NO strokeUniform here
            });
            activeGuides.push(line);
            canvas.add(line);
            // Bring guides to top
            line.bringToFront();
        };

        // 4. Canvas Center Snapping (highest priority)
        const canvasCenterX = (canvas.width || 1000) / 2;
        const canvasCenterY = (canvas.height || 1000) / 2;

        // X-Axis Canvas Center Snapping
        if (!snappedX && Math.abs(targetCenterX - canvasCenterX) < SNAP_THRESHOLD) {
            target.set({ left: target.left! - (targetCenterX - canvasCenterX) });
            drawGuide([canvasCenterX, vptTl.y, canvasCenterX, vptBr.y], true);
            snappedX = true;
        }

        // Y-Axis Canvas Center Snapping
        if (!snappedY && Math.abs(targetCenterY - canvasCenterY) < SNAP_THRESHOLD) {
            target.set({ top: target.top! - (targetCenterY - canvasCenterY) });
            drawGuide([vptTl.x, canvasCenterY, vptBr.x, canvasCenterY], true);
            snappedY = true;
        }

        // 5. Smart Alignment Snapping with other objects (second priority)
        for (const objBounds of cachedBounds) {
            if (snappedX && snappedY) break;

            const objLeft = objBounds.left;
            const objRight = objBounds.left + objBounds.width;
            const objCenterX = objBounds.left + objBounds.width / 2;
            const objTop = objBounds.top;
            const objBottom = objBounds.top + objBounds.height;
            const objCenterY = objBounds.top + objBounds.height / 2;

            // X-Axis Snapping
            if (!snappedX) {
                if (Math.abs(targetLeft - objLeft) < SNAP_THRESHOLD) {
                    target.set({ left: target.left! - (targetLeft - objLeft) });
                    drawGuide([objLeft, vptTl.y, objLeft, vptBr.y]);
                    snappedX = true;
                } else if (Math.abs(targetRight - objRight) < SNAP_THRESHOLD) {
                    target.set({ left: target.left! - (targetRight - objRight) });
                    drawGuide([objRight, vptTl.y, objRight, vptBr.y]);
                    snappedX = true;
                } else if (Math.abs(targetCenterX - objCenterX) < SNAP_THRESHOLD) {
                    target.set({ left: target.left! - (targetCenterX - objCenterX) });
                    drawGuide([objCenterX, vptTl.y, objCenterX, vptBr.y]);
                    snappedX = true;
                }
            }

            // Y-Axis Snapping
            if (!snappedY) {
                if (Math.abs(targetTop - objTop) < SNAP_THRESHOLD) {
                    target.set({ top: target.top! - (targetTop - objTop) });
                    drawGuide([vptTl.x, objTop, vptBr.x, objTop]);
                    snappedY = true;
                } else if (Math.abs(targetBottom - objBottom) < SNAP_THRESHOLD) {
                    target.set({ top: target.top! - (targetBottom - objBottom) });
                    drawGuide([vptTl.x, objBottom, vptBr.x, objBottom]);
                    snappedY = true;
                } else if (Math.abs(targetCenterY - objCenterY) < SNAP_THRESHOLD) {
                    target.set({ top: target.top! - (targetCenterY - objCenterY) });
                    drawGuide([vptTl.x, objCenterY, vptBr.x, objCenterY]);
                    snappedY = true;
                }
            }
        }

        // 6. Grid Snapping (lowest priority - only if no smart snapping occurred)
        if (!snappedX && target.left !== undefined) {
            const gridSnappedX = Math.round(target.left / GRID_SIZE) * GRID_SIZE;
            if (Math.abs(target.left - gridSnappedX) < SNAP_THRESHOLD) {
                target.set({ left: gridSnappedX });
            }
        }
        if (!snappedY && target.top !== undefined) {
            const gridSnappedY = Math.round(target.top / GRID_SIZE) * GRID_SIZE;
            if (Math.abs(target.top - gridSnappedY) < SNAP_THRESHOLD) {
                target.set({ top: gridSnappedY });
            }
        }

        // 5. Instantly Sync Transform Back to Reactive Block(s)
        targets.forEach((obj: any) => {
            const nodeId = obj.nodeId;
            if (nodeId) {
                const blocks = getBlocks();
                const block = blocks.find(b => b.id === nodeId);
                if (block) {
                    if (obj.left !== undefined) block.transform.x = obj.left;
                    if (obj.top !== undefined) block.transform.y = obj.top;
                }
            }
        });
    });

    canvas.on('object:modified', (e) => {
        clearGuides();
        const target = e.target;
        if (!target) return;

        // Handle both single objects and ActiveSelection
        const targets = (target as any).type === 'activeSelection' ? (target as any).getObjects() : [target];

        if (targets.length === 0) return;

        const blocks = getBlocks();
        let hasChanges = false;

        targets.forEach((obj: any) => {
            const nodeId = obj.nodeId;
            if (!nodeId) return;

            const block = blocks.find(b => b.id === nodeId);
            if (!block) return;

            // Update position
            if (obj.left !== undefined) block.transform.x = obj.left;
            if (obj.top !== undefined) block.transform.y = obj.top;
            if (obj.angle !== undefined) block.transform.rotation = obj.angle;

            // Update scale
            if (obj.scaleX !== undefined && obj.scaleY !== undefined) {
                const newWidth = obj.getScaledWidth();
                const newHeight = obj.getScaledHeight();

                block.transform.width = newWidth;
                block.transform.height = newHeight;

                if (block.type !== 'image') {
                    obj.set({
                        width: newWidth,
                        height: newHeight,
                        scaleX: 1,
                        scaleY: 1
                    });
                }
                obj.setCoords();
            }

            // Update text properties
            if (block.type === 'text' && obj instanceof fabric.IText) {
                const textBlock = block as TextBlock;
                textBlock.content = [{ text: obj.text || '', marks: [] }];
                if (obj.fontSize !== undefined) {
                    // Safely initialize layout if the block was created without one
                    if (!textBlock.layout) {
                        textBlock.layout = {} as any;
                    }
                    textBlock.layout.fontSize = obj.fontSize;
                }
            }

            hasChanges = true;
        });

        // Save to history only once for the entire multi-object operation
        if (hasChanges) {
            // CanvasHistory internally performs a deep clone (structuredClone)
            history.push(blocks);
            rerender();
        }
    });

    // Cleanup guides on mouse up just in case modified didn't fire (e.g., clicked but didn't drag)
    canvas.on('mouse:up', () => {
        clearGuides();
    });

    // Keyboard listeners migrated to useCanvasEngine component.
}

export async function renderBlocksToCanvas(
    canvas: fabric.Canvas,
    blocks: CanonicalBlock[]
): Promise<void> {
    const existing = new Map<string, fabric.Object>();

    canvas.getObjects().forEach(obj => {
        if ((obj as any).nodeId) {
            existing.set((obj as any).nodeId, obj);
        }
    });

    const createPromises: Promise<void>[] = [];

    for (const block of blocks) {
        console.log("[RENDER BLOCK]", block.type);
        const existingObj = existing.get(block.id);

        if (existingObj) {
            const needsRecreate = updateExistingObject(canvas, existingObj, block);
            if (needsRecreate) {
                canvas.remove(existingObj);
                createPromises.push(createNewObject(canvas, block));
            }
            existing.delete(block.id);
        } else {
            createPromises.push(createNewObject(canvas, block));
        }
    }

    if (createPromises.length > 0) {
        await Promise.all(createPromises);
    }

    // Remove stale nodes
    existing.forEach((obj) => {
        canvas.remove(obj);
    });

    canvas.requestRenderAll();
}

// TODO: Custom controls functionality temporarily disabled due to stability issues
// Original implementation was causing unpredictable behavior
// export function configuredTextboxControls() {
//     // 1. Grab Fabric's built-in utility functions
//     const controlsUtils = (fabric as any).util.controlsUtils;
//
//     // 2. Create a custom action for the corners (Font Size scaling)
//     const changeFontSize = (eventData: MouseEvent, transform: fabric.Transform, x: number, y: number) => {
//         const target = transform.target as fabric.Textbox;
//         
//         // Let Fabric do its default scaling math first
//         const scaled = controlsUtils.scalingEqually(eventData, transform, x, y);
//         
//         if (scaled) {
//             // Take the new scale and apply it to the actual properties
//             const newFontSize = target.fontSize! * target.scaleX!;
//             const newWidth = target.width! * target.scaleX!;
//
//             target.set({
//                 fontSize: newFontSize,
//                 width: newWidth,
//                 scaleX: 1, // Reset scale so the object isn't "stretched"
//                 scaleY: 1
//             });
//
//             // Force Fabric to recalculate the text layout
//             target.initDimensions();
//             return true;
//         }
//         return false;
//     };
//
//     // 3. Create a custom action for Top/Bottom (Container Height)
//     const changeHeightOnly = (eventData: MouseEvent, transform: fabric.Transform, x: number, y: number) => {
//         const target = transform.target as fabric.Textbox;
//         
//         // Calculate how much the mouse moved vertically
//         const localPoint = controlsUtils.getLocalPoint(transform, transform.originX, transform.originY, x, y);
//         const strokePadding = target.strokeWidth! / (target.strokeUniform ? target.scaleX! : 1);
//         const multiplier = transform.corner === 'mt' ? -1 : 1;
//         
//         // Calculate new height
//         const newHeight = Math.abs((localPoint.y * multiplier) / target.scaleY!) - strokePadding;
//
//         // Ensure we don't shrink the box smaller than the text itself
//         const minHeight = target.calcTextHeight();
//         
//         target.set({
//             height: Math.max(newHeight, minHeight),
//             scaleY: 1 // Prevent vertical stretching
//         });
//
//         target.initDimensions();
//         return true;
//     };
//
//     // 4. Apply these custom controls to the Textbox prototype
//     const textboxControls = fabric.Textbox.prototype.controls;
//
//     // Override Corners for Font Size
//     textboxControls.tl.actionHandler = changeFontSize;
//     textboxControls.tr.actionHandler = changeFontSize;
//     textboxControls.bl.actionHandler = changeFontSize;
//     textboxControls.br.actionHandler = changeFontSize;
//
//     // Override Top/Bottom for Height Padding
//     textboxControls.mt.actionHandler = changeHeightOnly;
//     textboxControls.mb.actionHandler = changeHeightOnly;
//
//     // Left and Right (ml, mr) already use controlsUtils.changeWidth by default, 
//     // which wraps text perfectly, so we don't need to overwrite them!
// }

function updateExistingObject(canvas: fabric.Canvas, obj: fabric.Object, block: CanonicalBlock): boolean {
    if (block.type === 'image' && obj instanceof fabric.Image) {
        // Safe, deterministic tracking of what image we actually rendered
        const currentSrc = (obj as any).nodeSrc;
        if (currentSrc !== block.src) {
            return true;
        }
    }

    obj.set({
        left: block.transform.x,
        top: block.transform.y,
        angle: block.transform.rotation,
        opacity: block.opacity,
        visible: block.visible,
        selectable: !block.locked,
        evented: !block.locked,
        originX: 'left',
        originY: 'top'
    });

    if (block.type === 'text' && obj instanceof fabric.Textbox) {
        // Bug Fix: Skip updating if user is actively editing
        if ((obj as any).isEditing) {
            return false; // Don't update while user is typing
        }

        const textBlock = block as TextBlock;
        const plainText = textBlock.content.map((run) => run.text).join('');

        if (obj.text !== plainText) {
            obj.set({ text: plainText });
        }

        obj.set({
            width: block.transform.width,
            height: block.transform.height,
            fontSize: textBlock.layout?.fontSize || 20
        });
    } else if (block.type === 'image' && obj instanceof fabric.Image) {
        const img = obj as fabric.Image;
        const scaleX = block.transform.width / (img.width || 1);
        const scaleY = block.transform.height / (img.height || 1);

        img.set({
            scaleX,
            scaleY
        });
    }

    obj.setCoords();
    return false; // Does not need recreation
}

async function createNewObject(canvas: fabric.Canvas, block: CanonicalBlock): Promise<void> {
    switch (block.type) {
        case 'text':
            renderTextBlock(canvas, block as TextBlock);
            break;
        case 'image':
            await renderImageBlock(canvas, block as ImageBlock);
            break;
    }
}

function renderTextBlock(canvas: fabric.Canvas, block: TextBlock): void {
    const textBlock = block as TextBlock;
    const plainText = textBlock.content.map((run) => run.text).join('');

    const textObj = new fabric.Textbox(plainText, {
        left: block.transform.x,
        top: block.transform.y,
        width: block.transform.width,
        height: block.transform.height,
        angle: block.transform.rotation,
        fontSize: textBlock.layout?.fontSize || 20,
        fontFamily: 'Sarabun',
        fill: '#212121',
        selectable: !block.locked,
        evented: !block.locked,
        originX: 'left',
        originY: 'top',
        opacity: block.opacity,
        visible: block.visible
    });

    (textObj as any).nodeId = block.id;
    canvas.add(textObj);
}

async function renderImageBlock(
    canvas: fabric.Canvas,
    block: ImageBlock
): Promise<void> {
    return new Promise((resolve) => {
        fabric.Image.fromURL(block.src, (img: fabric.Image) => {
            const naturalWidth = img.width || 1;
            const naturalHeight = img.height || 1;
            const frameWidth = block.transform.width;
            const frameHeight = block.transform.height;

            img.set({
                left: block.transform.x,
                top: block.transform.y,
                scaleX: frameWidth / naturalWidth,
                scaleY: frameHeight / naturalHeight,
                angle: block.transform.rotation,
                selectable: !block.locked,
                evented: !block.locked,
                originX: 'left',
                originY: 'top',
                opacity: block.opacity,
                visible: block.visible
            });

            (img as any).nodeId = block.id;
            (img as any).nodeSrc = block.src;
            canvas.add(img);
            resolve();
        });
    });
}
console.log("ts version");
