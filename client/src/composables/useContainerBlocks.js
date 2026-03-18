import { ref } from 'vue';
import { fabric } from 'fabric';
import { v4 as uuidv4 } from 'uuid';

/**
 * useContainerBlocks
 *
 * Self-contained composable for the "Linked Container Blocks" feature.
 * - Creating dashed-border container Rect objects
 * - Linked movement: dragging one container moves all siblings with same groupId
 * - Add-block-below logic
 * - Selection info for floating toolbar overlay
 */
export function useContainerBlocks() {
  // Reactive state tracking the currently selected container for the floating toolbar
  const selectedContainer = ref(null);

  // ── Custom property serialization ──────────────────────────────────────────
  // Extend fabric.Rect.prototype.toObject so our custom props survive JSON round-trips.
  // This is safe to call multiple times — we guard against double-patching.
  const _origRectToObject = fabric.Rect.prototype.toObject;
  if (!fabric.Rect.prototype.__containerBlockPatched) {
    fabric.Rect.prototype.toObject = function (propertiesToInclude = []) {
      const extra = ['isContainerBlock', 'groupId'];
      const merged = [...new Set([...propertiesToInclude, ...extra])];
      return _origRectToObject.call(this, merged);
    };
    fabric.Rect.prototype.__containerBlockPatched = true;
  }

  /**
   * Create a new container block on the canvas.
   * @param {fabric.Canvas} canvasInstance - The live Fabric canvas
   * @param {number} x - Left position
   * @param {number} y - Top position
   * @param {number} width - Container width (default 300)
   * @param {number} height - Container height (default 120)
   * @param {string|null} groupId - Optional groupId to link with existing containers
   * @returns {fabric.Rect} The created container object
   */
  const addContainerBlock = (canvasInstance, x = 100, y = 100, width = 300, height = 120, groupId = null) => {
    if (!canvasInstance) return null;

    const container = new fabric.Rect({
      id: 'container_' + uuidv4(),
      left: x,
      top: y,
      width: width,
      height: height,
      fill: 'transparent',
      stroke: '#2196F3',
      strokeWidth: 1.5,
      strokeDashArray: [6, 4],
      strokeUniform: true,
      // Custom properties
      isContainerBlock: true,
      groupId: groupId || uuidv4(),
      // Interaction
      selectable: true,
      evented: true,
      hasControls: true,
      hasBorders: true,
      lockRotation: true,
      // Rendering
      objectCaching: false,
      // Origin
      originX: 'left',
      originY: 'top'
    });

    // Hide rotation control for containers
    container.setControlsVisibility({
      mtr: false,
      mt: true,
      mb: true,
      ml: true,
      mr: true,
      tl: true,
      tr: true,
      bl: true,
      br: true
    });

    canvasInstance.add(container);
    canvasInstance.setActiveObject(container);
    canvasInstance.requestRenderAll();

    return container;
  };

  /**
   * Add a new container linked below the currently selected one.
   * @param {fabric.Canvas} canvasInstance
   * @param {fabric.Object} selectedObj - The currently selected container
   * @returns {fabric.Rect|null} The new container, or null if selectedObj is invalid
   */
  const addLinkedBlockBelow = (canvasInstance, selectedObj) => {
    if (!canvasInstance || !selectedObj) return null;
    if (!selectedObj.isContainerBlock) return null;

    const newY = selectedObj.top + (selectedObj.height * (selectedObj.scaleY || 1));
    const newWidth = selectedObj.width * (selectedObj.scaleX || 1);
    const newHeight = selectedObj.height * (selectedObj.scaleY || 1);

    const newContainer = addContainerBlock(
      canvasInstance,
      selectedObj.left,
      newY,
      newWidth,
      newHeight,
      selectedObj.groupId // Same group → linked
    );

    return newContainer;
  };

  /**
   * Set up linked movement on the canvas.
   * When a container with a groupId is moved, all other objects sharing the
   * same groupId move by the exact same pixel delta.
   *
   * IMPORTANT: This APPENDS a handler — it does NOT replace existing listeners.
   *
   * @param {import('vue').ShallowRef<fabric.Canvas>} canvasRef - shallowRef holding the canvas
   */
  const setupLinkedMovement = (canvasRef) => {
    if (!canvasRef || !canvasRef.value) return;

    const cv = canvasRef.value;

    // Guard: track whether we're already applying linked movement to prevent recursion
    let isApplyingLinkedMove = false;

    cv.on('object:moving', (e) => {
      if (isApplyingLinkedMove) return;

      const target = e.target;
      if (!target || !target.groupId) return;

      // STEP 1: ONLY apply linked movement to peers IF the moved object is a container
      if (!target.isContainerBlock) return;

      // Use browser-level movementX/Y for pixel-perfect deltas
      const dx = e.e.movementX / (cv.getZoom() || 1);
      const dy = e.e.movementY / (cv.getZoom() || 1);

      if (dx === 0 && dy === 0) return;

      isApplyingLinkedMove = true;

      const siblings = cv.getObjects().filter(
        (obj) => obj.groupId === target.groupId && obj !== target
      );

      siblings.forEach((sib) => {
        sib.set({
          left: sib.left + dx,
          top: sib.top + dy
        });
        sib.setCoords();
      });

      cv.requestRenderAll();
      isApplyingLinkedMove = false;
    });
  };

  /**
   * Compute the DOM-pixel position of the selected container for the floating toolbar.
   * Accounts for canvas zoom and the canvas wrapper's position in the viewport.
   *
   * @param {fabric.Canvas} canvasInstance
   * @param {fabric.Object} obj - The selected container
   * @returns {{ top: number, left: number, width: number } | null}
   */
  const getContainerDomPosition = (canvasInstance, obj) => {
    if (!canvasInstance || !obj) return null;

    const zoom = canvasInstance.getZoom() || 1;
    const canvasEl = canvasInstance.getElement();
    if (!canvasEl) return null;

    // The Fabric canvas wrapper element that is positioned in the DOM
    const wrapperEl = canvasEl.parentElement;
    if (!wrapperEl) return null;

    const wrapperRect = wrapperEl.getBoundingClientRect();

    return {
      left: wrapperRect.left + (obj.left * zoom),
      top: wrapperRect.top + ((obj.top + obj.height * (obj.scaleY || 1)) * zoom),
      width: obj.width * (obj.scaleX || 1) * zoom
    };
  };

  /**
   * Calculate the absolute combined bounding box of all children within a given group.
   * Returns null if the container has no children.
   * 
   * @param {fabric.Canvas} canvasInstance 
   * @param {string} groupId 
   * @returns {{minX: number, minY: number, maxX: number, maxY: number} | null}
   */
  const getGroupBoundingBox = (canvasInstance, groupId) => {
    if (!canvasInstance || !groupId) return null;

    const children = canvasInstance.getObjects().filter(
      obj => obj.groupId === groupId && !obj.isContainerBlock
    );

    if (children.length === 0) return null;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    children.forEach((child) => {
      // getBoundingRect(absolute, calculate) ignores scaling/rotation nuances 
      // and returns perfectly dependable absolute screen rects
      const rect = child.getBoundingRect(true, true);
      
      if (rect.left < minX) minX = rect.left;
      if (rect.top < minY) minY = rect.top;
      if (rect.left + rect.width > maxX) maxX = rect.left + rect.width;
      if (rect.top + rect.height > maxY) maxY = rect.top + rect.height;
    });

    return { minX, minY, maxX, maxY };
  };

  /**
   * Check if a generic object intersects with any container.
   * If its center point falls inside a container, assign that container's groupId.
   * If it doesn't fall in any container, remove its linkage so it moves freely.
   * 
   * @param {fabric.Canvas} canvasInstance 
   * @param {fabric.Object} targetObj 
   * @returns {string|null} The assigned groupId, or null if unlinked.
   */
  const assignToContainerIfIntersecting = (canvasInstance, targetObj) => {
    if (!canvasInstance || !targetObj) return targetObj.groupId || null;
    
    // Rule 1: Do not re-assign containers themselves
    if (targetObj.isContainerBlock) return targetObj.groupId || null;

    // Rule 2: Get absolute center point on canvas
    const center = targetObj.getCenterPoint();

    // Rule 3: Loop and find perfectly intersecting container
    const containers = canvasInstance.getObjects().filter(o => o.isContainerBlock);
    
    let foundGroupId = null;
    let bestScore = -1; 
    const currentGroupId = targetObj.groupId;

    containers.forEach((container, index) => {
      // Calculate absolute bounds of the container
      const cLeft = container.left;
      const cTop = container.top;
      const cRight = cLeft + (container.width * (container.scaleX || 1));
      const cBottom = cTop + (container.height * (container.scaleY || 1));

      // Check strictly inside bounding box
      if (center.x >= cLeft && center.x <= cRight && center.y >= cTop && center.y <= cBottom) {
        // Scoring system:
        // +1000 points if it's a DIFFERENT container (prioritize transferring over staying stuck)
        // +index points (z-index tiebreaker for overlapping)
        let score = index;
        if (container.groupId !== currentGroupId) {
          score += 1000;
        }

        if (score > bestScore) {
          bestScore = score;
          foundGroupId = container.groupId;
        }
      }
    });

    // Rule 5 & 6: Assign or clear groupId
    if (foundGroupId) {
      targetObj.groupId = foundGroupId;
      return foundGroupId;
    } else {
      delete targetObj.groupId;
      // In JS, deleting a property is slightly slow, so explicitly setting to null helps too just in case serialization expects it
      targetObj.set('groupId', null); 
      return null;
    }
  };

  /**
   * Wire up selection listeners to track when a container block is selected/deselected.
   * Updates `selectedContainer` ref reactively.
   *
   * @param {import('vue').ShallowRef<fabric.Canvas>} canvasRef
   */
  const setupSelectionTracking = (canvasRef) => {
    if (!canvasRef || !canvasRef.value) return;

    const cv = canvasRef.value;

    const checkSelection = () => {
      const active = cv.getActiveObject();
      if (active && active.isContainerBlock) {
        selectedContainer.value = active;
      } else {
        selectedContainer.value = null;
      }
    };

    cv.on('selection:created', checkSelection);
    cv.on('selection:updated', checkSelection);
    cv.on('selection:cleared', () => {
      selectedContainer.value = null;
    });
  };

  return {
    selectedContainer,
    addContainerBlock,
    addLinkedBlockBelow,
    setupLinkedMovement,
    assignToContainerIfIntersecting,
    getContainerDomPosition,
    getGroupBoundingBox,
    setupSelectionTracking
  };
}
