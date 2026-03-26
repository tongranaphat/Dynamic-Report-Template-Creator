const fs = require('fs');
const path = require('path');
const { promisify } = require('util');

const writeFileAsync = promisify(fs.writeFile);
const mkdirAsync = promisify(fs.mkdir);

const BASE_UPLOAD_DIR = path.join(__dirname, '../uploads/texts');

const saveValidTextContent = async (pages, type, id, name, globalBackground = null) => {
    try {
        if (!pages || !Array.isArray(pages)) {
            return;
        }

        const safeName = (name || 'Untitled').replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const subDir = type === 'template' ? 'templates' : 'reports';
        const targetDir = path.join(BASE_UPLOAD_DIR, subDir);

        await mkdirAsync(targetDir, { recursive: true });

        const getBackgroundType = (bgUrl) => {
            if (!bgUrl || typeof bgUrl !== 'string') return 'Unknown';

            if (bgUrl.startsWith('data:image/')) return 'Picture';
            if (bgUrl.startsWith('data:application/pdf')) return 'PDF';

            const ext = path.extname(bgUrl).toLowerCase();
            if (ext === '.pdf') return 'PDF';
            if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp'].includes(ext)) return 'Picture';

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
            let pageBgType = 'Paper';
            if (globalBgType !== 'Unknown') {
                pageBgType = globalBgType;
            }
            let pageBgUrl = globalBackground;

            if (page && page.originalBackgroundType) {
                pageBgType = page.originalBackgroundType;
            } else {
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

                    const bgLabel = pageBgType === 'Unknown' ? 'Unknown' : pageBgType;

                    if (obj.type === 'i-text' || obj.type === 'text' || obj.type === 'textbox') {
                        classification = `Text upon ${bgLabel}`;
                        content = obj.text;
                    } else if (obj.type === 'image') {
                        classification = `Element upon ${bgLabel}`;
                        content = `Image (Src: ${obj.src ? obj.src.substring(0, 50) + '...' : 'Data'})`;
                    } else {
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
    } catch (error) {
        console.error(`[TextSaver] Failed to save text file for ${type} ${id}:`, error);
    }
};

const deleteTextFile = async (type, id, name) => {
    try {
        const safeName = (name || 'Untitled').replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const subDir = type === 'template' ? 'templates' : 'reports';
        const targetDir = path.join(BASE_UPLOAD_DIR, subDir);
        const filename = `${safeName}_${id}.txt`;
        const filePath = path.join(targetDir, filename);

        if (fs.existsSync(filePath)) {
            const unlinkAsync = promisify(fs.unlink);
            await unlinkAsync(filePath);
        }
    } catch (error) {
        console.error(`[TextSaver] Failed to delete text file for ${type} ${id}:`, error);
    }
};

module.exports = { saveValidTextContent, deleteTextFile };
