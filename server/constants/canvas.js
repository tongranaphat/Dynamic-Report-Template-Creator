// Canvas and page dimensions constants (Server-side copy)
const CANVAS_CONSTANTS = {
    // A4 page dimensions in pixels (96 DPI)
    PAGE_WIDTH: 794,
    PAGE_HEIGHT: 1123,

    // Gap between pages
    PAGE_GAP: 40,

    // Zoom limits
    MIN_ZOOM: 0.1,
    MAX_ZOOM: 3.0,
    ZOOM_STEP: 0.1,

    // Default object positioning
    DEFAULT_LEFT: 50,
    DEFAULT_TOP: 50,
    DEFAULT_FONT_SIZE: 20,
    DEFAULT_BOTTOM_MARGIN: 20,

    // Canvas background colors
    DEFAULT_BG_COLOR: '#ffffff',
    PREVIEW_BG_COLOR: '#f9f9f9',
    WORKSPACE_BG_COLOR: '#525659',

    // Quality settings
    IMAGE_QUALITY: 0.8,
    PDF_MULTIPLIER: 2,

    // History settings
    MAX_HISTORY: 50,

    // Animation delays
    RENDER_DELAY: 100,
    ZOOM_RENDER_DELAY: 200,
    OBJECT_UNLOCK_DELAY: 50
};

module.exports = { CANVAS_CONSTANTS };
