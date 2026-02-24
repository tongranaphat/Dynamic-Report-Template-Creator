const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const writeFileAsync = promisify(fs.writeFile);
const mkdirAsync = promisify(fs.mkdir);

const BASE_UPLOAD_DIR = path.join(__dirname, '../uploads/texts');

/**
 * Extracts text content from Fabric.js pages data and saves it to a .txt file.
 * @param {Array} pages - Array of Fabric.js page objects (JSON).
 * @param {String} type - 'template' or 'report'.
 * @param {String} id - The ID of the entity.
 * @param {String} name - The name of the entity (for filename).
 * @param {String} globalBackground - Optional URL or path to the background file.
 */
const saveValidTextContent = async (pages, type, id, name, globalBackground = null) => {
    try {
        if (!pages || !Array.isArray(pages)) {
            console.warn(`[TextSaver] Invalid pages data for ${type} ${id}`);
            return;
        }

        const safeName = (name || 'Untitled').replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const subDir = type === 'template' ? 'templates' : 'reports';
        const targetDir = path.join(BASE_UPLOAD_DIR, subDir);

        // Ensure directory exists
        await mkdirAsync(targetDir, { recursive: true });

        // Helper to determine background type
        const getBackgroundType = (bgUrl) => {
            if (!bgUrl || typeof bgUrl !== 'string') return 'Unknown';

            // Check for Data URI
            if (bgUrl.startsWith('data:image/')) return 'Picture';
            if (bgUrl.startsWith('data:application/pdf')) return 'PDF';

            // Check extension
            const ext = path.extname(bgUrl).toLowerCase();
            if (ext === '.pdf') return 'PDF';
            if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'].includes(ext)) return 'Picture';

            // Fallback: If it has a likely image extension in the path/url even with query params
            if (/\.(png|jpg|jpeg|gif|webp|bmp)($|\?)/i.test(bgUrl)) return 'Picture';
            if (/\.pdf($|\?)/i.test(bgUrl)) return 'PDF';

            return 'Unknown';
        };

        const globalBgType = getBackgroundType(globalBackground);

        let fileContent = `ID: ${id}\nName: ${name}\nType: ${type.toUpperCase()}\nDate: ${new Date().toISOString()}\n`;
        if (globalBackground && typeof globalBackground === 'string') {
            fileContent += `Global Background: ${globalBackground.substring(0, 100)}... (${globalBgType})\n`;
        }
        fileContent += `\n========================================\n\n`;

        pages.forEach((page, index) => {
            // Determine background for this specific page if possible
            // Fabric.js page might have 'backgroundImage' property which could be an object or string
            let pageBgType = 'Paper'; // Default to Paper (Blank) if no global background
            if (globalBgType !== 'Unknown') {
                pageBgType = globalBgType;
            }
            let pageBgUrl = globalBackground;

            // 1. Check for explicit metadata from client (Fix for PDF import)
            if (page && page.originalBackgroundType) {
                pageBgType = page.originalBackgroundType;
            }
            // 2. Try to find page-specific background if it exists in the page object
            else {
                // Check both 'background' (Client App structure) and 'backgroundImage' (Fabric/Legacy)
                const bgProp = page.background || page.backgroundImage;
                if (bgProp) {
                    const bgSrc = bgProp.src || bgProp;
                    if (typeof bgSrc === 'string') {
                        pageBgUrl = bgSrc;
                        const detected = getBackgroundType(bgSrc);
                        if (detected !== 'Unknown') {
                            pageBgType = detected;
                        }
                    }
                }
            }

            fileContent += `--- Page ${index + 1} ---\n`;
            fileContent += `Background Type: ${pageBgType}\n`;

            const objects = page.objects || (Array.isArray(page) ? page : []);

            if (objects.length === 0) {
                fileContent += `(No content)\n`;
            } else {
                objects.forEach((obj) => {
                    let classification = '';
                    let content = '';

                    // Determine safe background classification label
                    const bgLabel = pageBgType === 'Unknown' ? 'Unknown' : pageBgType;

                    // Check if it's Text
                    if (obj.type === 'i-text' || obj.type === 'text' || obj.type === 'textbox') {
                        classification = `Text upon ${bgLabel}`;
                        content = obj.text;
                    }
                    // Check if it's an Image
                    else if (obj.type === 'image') {
                        classification = `Element upon ${bgLabel}`;
                        content = `Image (Src: ${obj.src ? obj.src.substring(0, 50) + '...' : 'Data'})`;
                    }
                    // Other elements (Rect, Circle, Path, etc.)
                    else {
                        classification = `Element upon ${bgLabel}`;
                        content = `${obj.type} object`;
                    }

                    fileContent += `[${classification}] ${content}\n`;
                });
            }
            fileContent += `\n`;
        });

        const filename = `${safeName}_${id}.txt`;
        const filePath = path.join(targetDir, filename);

        await writeFileAsync(filePath, fileContent, 'utf8');
        console.log(`[TextSaver] Saved text content to ${filePath}`);
    } catch (error) {
        console.error(`[TextSaver] Failed to save text file for ${type} ${id}:`, error);
    }
};

/**
 * Deletes the generated text file for a given entity.
 * @param {String} type - 'template' or 'report'.
 * @param {String} id - The ID of the entity.
 * @param {String} name - The name of the entity.
 */
const deleteTextFile = async (type, id, name) => {
    try {
        const safeName = (name || 'Untitled').replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const subDir = type === 'template' ? 'templates' : 'reports';
        const targetDir = path.join(BASE_UPLOAD_DIR, subDir);
        const filename = `${safeName}_${id}.txt`;
        const filePath = path.join(targetDir, filename);

        console.log(`[TextSaver] Attempting to delete: ${filePath}`);

        if (fs.existsSync(filePath)) {
            const unlinkAsync = promisify(fs.unlink);
            await unlinkAsync(filePath);
            console.log(`[TextSaver] Deleted text file: ${filePath}`);
        } else {
            console.log(`[TextSaver] File not found, skipping delete: ${filePath}`);
        }
    } catch (error) {
        console.error(`[TextSaver] Failed to delete text file for ${type} ${id}:`, error);
    }
};

module.exports = { saveValidTextContent, deleteTextFile };
