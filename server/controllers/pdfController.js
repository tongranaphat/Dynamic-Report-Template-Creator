const puppeteer = require('puppeteer');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { PDFDocument } = require('pdf-lib');
const { asyncHandler } = require('../utils/errorHandler');
const prisma = require('../prismaClient');
const axios = require('axios');

const convertGDriveUrl = (url) => {
    if (!url || typeof url !== 'string') return url;
    const fileIdMatch = url.match(/\/file\/d\/([^/]+)/)
        || url.match(/[?&]id=([^&]+)/);
    if (fileIdMatch && fileIdMatch[1]) {
        return `https://drive.google.com/uc?export=download&id=${fileIdMatch[1]}`;
    }
    return url;
};

const importPdfUrl = async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ error: 'URL is required' });

        let cachedPdf = await prisma.pdfCache.findFirst({
            where: { OriginalUrlorPath: url }
        });

        if (!cachedPdf) {
            const downloadUrl = convertGDriveUrl(url);

            const response = await axios.get(downloadUrl, { responseType: 'stream' });

            let exactName = `GDrive_Document_${Date.now()}.pdf`;
            const contentDisposition = response.headers['content-disposition'];
            if (contentDisposition) {
                const match = contentDisposition.match(/filename="?([^"]+)"?/);
                if (match && match[1]) exactName = decodeURIComponent(match[1]);
            } else {
                const urlName = path.basename(new URL(downloadUrl).pathname);
                if (urlName && urlName !== 'uc' && urlName !== 'download') exactName = urlName;
            }

            const uploadDir = path.join(__dirname, '../uploads/cache');
            if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

            const destPath = path.join(uploadDir, exactName);

            const writer = fs.createWriteStream(destPath);
            response.data.pipe(writer);

            await new Promise((resolve, reject) => {
                writer.on('finish', resolve);
                writer.on('error', reject);
            });

            cachedPdf = await prisma.pdfCache.create({
                data: {
                    FileName: exactName,
                    OriginalUrlorPath: url,
                    FilePath: `/uploads/cache/${exactName}`,
                    OriginalFile: true,
                    EditedFile: false
                }
            });
        }

        res.status(200).json({ ...cachedPdf, id: cachedPdf.OriginalFileId, fileId: cachedPdf.OriginalFileId, filepath: cachedPdf.FilePath });

    } catch (error) {
        console.error('URL Import Error:', error.message);
        res.status(500).json({ error: 'Failed to import file from URL' });
    }
};

const autoImportUniversal = async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) return res.status(400).json({ error: 'URL is required' });

        const downloadUrl = convertGDriveUrl(url);

        const response = await axios.get(downloadUrl, { responseType: 'stream' });

        let exactName = `GDrive_Document_${Date.now()}.pdf`;
        const contentDisposition = response.headers['content-disposition'];
        if (contentDisposition) {
            const match = contentDisposition.match(/filename="?([^"]+)"?/);
            if (match && match[1]) exactName = decodeURIComponent(match[1]);
        } else {
            const urlName = path.basename(new URL(downloadUrl).pathname);
            if (urlName && urlName !== 'uc' && urlName !== 'download') exactName = urlName;
        }

        const uploadDir = path.join(__dirname, '../uploads/cache');
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

        const destPath = path.join(uploadDir, exactName);

        const writer = fs.createWriteStream(destPath);
        response.data.pipe(writer);

        await new Promise((resolve, reject) => {
            writer.on('finish', resolve);
            writer.on('error', reject);
        });

        const cachedPdf = await prisma.pdfCache.create({
            data: {
                FileName: exactName,
                OriginalUrlorPath: url,
                FilePath: `/uploads/cache/${exactName}`,
                OriginalFile: true,
                EditedFile: false
            }
        });

        res.status(200).json({ ...cachedPdf, id: cachedPdf.OriginalFileId, fileId: cachedPdf.OriginalFileId, filepath: cachedPdf.FilePath });

    } catch (error) {
        console.error('Auto Import Error:', error.message);
        res.status(500).json({ error: 'Failed to auto-import file' });
    }
};

const logger = {
    info: (message, ...args) => {
        console.info(`[PDF] ${new Date().toISOString()} - ${message}`, ...args);
    },
    error: (message, error) => {
        console.error(`[PDF ERROR] ${new Date().toISOString()} - ${message}`);
        if (error) {
            console.error('Error details:', error.message || error);
            if (error.stack) {
                console.error('Stack trace:', error.stack);
            }
        }
    },
    warn: (message, ...args) => {
        console.warn(`[PDF WARN] ${new Date().toISOString()} - ${message}`, ...args);
    },
    success: (message, ...args) => {
        console.info(`[PDF] ${new Date().toISOString()} - ${message}`, ...args);
    }
};

const storage = multer.diskStorage({
    destination: function (req, file, cb) { cb(null, 'uploads/cache/'); },
    filename: function (req, file, cb) { cb(null, file.originalname); }
});
const upload = multer({ storage: storage, limits: { fileSize: 50 * 1024 * 1024 } });

const checkPdfType = asyncHandler(async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file' });

        const existingPdfBytes = req.file.buffer || require('fs').readFileSync(req.file.path);
        const pdfDoc = await PDFDocument.load(existingPdfBytes);

        let subject = null;
        let keywords = null;

        try {
            const { PDFName, PDFString, PDFHexString } = require('pdf-lib');

            const infoDict = pdfDoc.context.lookup(pdfDoc.context.trailerInfo.Info);

            const decodePdfString = (pdfStr) => {
                if (!pdfStr) return null;
                const bytes = pdfStr.asBytes();
                if (bytes[0] === 0xFE && bytes[1] === 0xFF) {
                    return Buffer.from(bytes.slice(2)).toString('utf16le')
                        .split('').map((c, i, a) => i % 2 === 0 ? a[i + 1] + c : '').join('');
                }
                return Buffer.from(bytes).toString('utf-8');
            };

            const decodeBuffer = (buf) => {
                if (!buf || buf.length < 2) return buf?.toString('utf-8') || null;
                if (buf[0] === 0xFE && buf[1] === 0xFF) {
                    const content = Buffer.from(buf.slice(2));
                    content.swap16();
                    return content.toString('utf16le');
                }
                return buf.toString('utf-8');
            };

            if (infoDict) {
                const subjectEntry = infoDict.get(PDFName.of('Subject'));
                if (subjectEntry instanceof PDFString || subjectEntry instanceof PDFHexString) {
                    subject = decodeBuffer(Buffer.from(subjectEntry.asBytes()));
                }

                const keywordsEntry = infoDict.get(PDFName.of('Keywords'));
                if (keywordsEntry instanceof PDFString || keywordsEntry instanceof PDFHexString) {
                    keywords = decodeBuffer(Buffer.from(keywordsEntry.asBytes()));
                }
            }
        } catch (unsafeErr) {
            logger.warn('Safe metadata read failed, falling back to standard', unsafeErr);
            subject = pdfDoc.getSubject();
            keywords = pdfDoc.getKeywords();
        }

        let foundId = null;
        let foundType = null;
        let embeddedLayout = null;

        if (keywords) {
            const keywordString = Array.isArray(keywords) ? keywords.join(' ') : keywords;
            logger.info(`Checking PDF metadata: ${keywordString.substring(0, 100)}...`);

            const idMatch = keywordString.match(/dynamic-id:(\S+)/);
            if (idMatch) foundId = idMatch[1];

            const typeMatch = keywordString.match(/dynamic-type:(\S+)/);
            if (typeMatch) foundType = typeMatch[1];

            if (!foundId) {
                const legacyMatch = keywordString.match(/dynamic-report-id:(\S+)/);
                if (legacyMatch) {
                    foundId = legacyMatch[1];
                    foundType = 'template';
                }
            }
        }

        if (subject && subject.startsWith('layout:')) {
            try {
                const base64Str = subject.substring(7);
                const jsonStr = Buffer.from(base64Str, 'base64').toString('utf-8');
                embeddedLayout = JSON.parse(jsonStr);
                logger.success('Found embedded layout data in PDF');
            } catch (e) {
                logger.error('Failed to parse embedded layout:', e);
            }
        }

        res.json({
            isGenerated: !!foundId || !!embeddedLayout,
            id: foundId,
            type: foundType,
            embeddedLayout: embeddedLayout,
            url: null
        });
    } catch (error) {
        logger.error('Failed to check PDF:', error);
        res.json({ isGenerated: false, url: null });
    }
});

const uploadBackground = asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const fileData = req.file.buffer || require('fs').readFileSync(req.file.path);

    const asset = await prisma.asset.create({
        data: {
            filename: req.file.originalname,
            mimetype: req.file.mimetype,
            data: fileData
        }
    });

    const fileUrl = `${req.protocol}://${req.get('host')}/api/assets/${asset.id}`;
    logger.success('Asset uploaded to DB:', fileUrl);
    res.json({ url: fileUrl, id: asset.id });
});

const getAssetFromDb = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const asset = await prisma.asset.findUnique({
        where: { id }
    });

    if (!asset) {
        return res.status(404).json({ error: 'Asset not found' });
    }

    res.set({
        'Content-Type': asset.mimetype,
        'Cache-Control': 'public, max-age=31536000',
        'Access-Control-Allow-Origin': '*',
        'Cross-Origin-Resource-Policy': 'cross-origin'
    });
    res.end(asset.data);
});

const getAllAssets = asyncHandler(async (req, res) => {
    const assets = await prisma.asset.findMany({
        select: {
            id: true,
            filename: true,
            createdAt: true
        },
        orderBy: {
            createdAt: 'desc'
        }
    });

    const formattedAssets = assets.map(asset => ({
        url: `${req.protocol}://${req.get('host')}/api/assets/${asset.id}`,
        name: asset.filename,
        id: asset.id
    }));

    res.json(formattedAssets);
});

const deleteAssetFromDb = asyncHandler(async (req, res) => {
    const { id } = req.params;

    const existingAsset = await prisma.asset.findUnique({ where: { id } });
    if (!existingAsset) {
        return res.status(404).json({ error: 'Asset not found' });
    }

    await prisma.asset.delete({
        where: { id }
    });

    res.json({ message: 'Asset deleted successfully' });
});

const generatePDF = asyncHandler(async (req, res) => {
    logger.info('Starting PDF generation...');
    const startTime = Date.now();
    let browser = null;

    try {
        const { canvasImages, recordId, recordType, pagesData } = req.body;

        if (!canvasImages || !Array.isArray(canvasImages) || canvasImages.length === 0) {
            res.status(400);
            throw new Error('No pages data received');
        }

        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });

        const page = await browser.newPage();

        const A4_WIDTH_PX = 794;
        const A4_HEIGHT_PX = 1123;
        const totalHeight = canvasImages.length * A4_HEIGHT_PX;

        const htmlContent = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <link rel="preconnect" href="https://fonts.googleapis.com">
                <link href="https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap" rel="stylesheet">
                <style>
                    @import url('https://fonts.googleapis.com/css2?family=Sarabun:wght@400;700&display=swap');
                    body, html {
                        margin: 0;
                        padding: 0;
                        width: ${A4_WIDTH_PX}px;
                        font-family: 'Sarabun', sans-serif;
                    }
                    img {
                        display: block;
                        width: 100%;
                        height: ${A4_HEIGHT_PX}px;
                        page-break-after: always;
                    }
                    img:last-child { page-break-after: avoid; }
                </style>
            </head>
            <body>
                ${canvasImages.map((img) => `<img src="${img}" />`).join('')}
            </body>
            </html>
        `;

        await page.setContent(htmlContent);
        await page.setViewport({ width: A4_WIDTH_PX, height: totalHeight });

        let pdfBuffer = await page.pdf({
            printBackground: true,
            width: `${A4_WIDTH_PX}px`,
            height: `${A4_HEIGHT_PX}px`
        });

        try {
            const pdfDoc = await PDFDocument.load(pdfBuffer);

            const typeToEmbed = recordType || 'report';
            const keywords = [];
            if (recordId) keywords.push(`dynamic-id:${recordId}`);
            keywords.push(`dynamic-type:${typeToEmbed}`);

            pdfDoc.setKeywords(keywords);

            if (pagesData) {
                const jsonStr = JSON.stringify(pagesData);
                const MAX_METADATA_BYTES = 50 * 1024;
                if (Buffer.byteLength(jsonStr, 'utf-8') > MAX_METADATA_BYTES) {
                    logger.warn(`Layout data too large to embed (${Math.round(Buffer.byteLength(jsonStr, 'utf-8') / 1024)}KB > 50KB). Metadata will be omitted.`);
                } else {
                    const base64Str = Buffer.from(jsonStr, 'utf-8').toString('base64');
                    pdfDoc.setSubject(`layout:${base64Str}`);
                    logger.info('Embedded full layout data into PDF metadata');
                }
            }

            pdfDoc.setProducer('Dynamic Report Creator');
            pdfDoc.setCreator('Dynamic Report Creator System');

            const modifiedPdfBytes = await pdfDoc.save();
            pdfBuffer = Buffer.from(modifiedPdfBytes);

            logger.info(`Embedded Metadata -> ID: ${recordId}, Type: ${typeToEmbed}`);
        } catch (e) {
            logger.warn('Failed to embed metadata, sending original PDF', e);
        }

        const duration = Date.now() - startTime;
        logger.success(`PDF Generated in ${duration}ms`);

        res.set({
            'Content-Type': 'application/pdf',
            'Content-Length': pdfBuffer.length
        });
        res.send(pdfBuffer);
    } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`PDF FAILED (${duration}ms):`, error);
        throw error;
    } finally {
        if (browser) {
            try {
                await browser.close();
                logger.info('Browser closed');
            } catch (e) {
                console.error('Error closing browser:', e);
            }
        }
    }
});

const uploadPdf = async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        const filepath = `/uploads/cache/${req.file.filename}`;

        const savedPdf = await prisma.pdfCache.create({
            data: {
                FileName: req.file.originalname,
                OriginalUrlorPath: req.file.originalname,
                FilePath: filepath,
                OriginalFile: true,
                EditedFile: false
            }
        });
        res.status(201).json({ ...savedPdf, id: savedPdf.OriginalFileId, filepath: savedPdf.FilePath });
    } catch (error) {
        console.error("Upload DB Error:", error);
        res.status(500).json({ error: 'Failed to upload PDF' });
    }
};

const getPdfById = async (req, res) => {
    const { id } = req.params;
    const pdf = await prisma.pdfCache.findUnique({ where: { OriginalFileId: id } });
    if (!pdf) return res.status(404).json({ error: 'PDF not found' });
    res.json({ ...pdf, id: pdf.OriginalFileId, filepath: pdf.FilePath, originalUrl: pdf.OriginalUrlorPath });
};

const deletePdf = async (req, res) => {
    try {
        const { id } = req.params;
        const record = await prisma.pdfCache.findUnique({ where: { OriginalFileId: id } });
        if (!record) return res.status(404).json({ error: 'PDF not found' });

        if (record.FilePath) {
            const absPath = path.join(__dirname, '..', record.FilePath);
            try { fs.unlinkSync(absPath); } catch (e) {
                console.warn(`[deletePdf] Could not unlink FilePath ${absPath}:`, e.message);
            }
        }
        if (record.EditedFilePath) {
            const editedAbsPath = path.join(__dirname, '..', record.EditedFilePath);
            try { fs.unlinkSync(editedAbsPath); } catch (e) {
                console.warn(`[deletePdf] Could not unlink EditedFilePath ${editedAbsPath}:`, e.message);
            }
        }

        await prisma.pdfCache.delete({ where: { OriginalFileId: id } });
        res.json({ message: 'PDF deleted successfully', id });
    } catch (error) {
        console.error('Delete PDF Error:', error.message);
        res.status(500).json({ error: 'Failed to delete PDF' });
    }
};

const savePdfState = async (req, res) => {
    try {
        const { OriginalFileId, editState } = req.body;
        if (!OriginalFileId || !editState) {
            return res.status(400).json({ error: 'Missing OriginalFileId or editState' });
        }

        const pdf = await prisma.pdfCache.findUnique({ where: { OriginalFileId } });
        if (!pdf) return res.status(404).json({ error: 'PDF not found' });

        let newEditedPath = pdf.EditedFilePath;

        if (!pdf.EditedFile) {
            const originalAbsPath = path.join(__dirname, '..', pdf.FilePath);
            const editedFileName = `edited_${Date.now()}_${pdf.FileName}`;
            newEditedPath = `/uploads/cache/${editedFileName}`;
            const newAbsPath = path.join(__dirname, '..', newEditedPath);

            try {
                fs.copyFileSync(originalAbsPath, newAbsPath);
            } catch (e) {
                console.error('Failed to copy physical file:', e);
                return res.status(500).json({ error: 'Failed to create physical copy' });
            }
        }

        let parsedState = editState;
        while (typeof parsedState === 'string') {
            try {
                parsedState = JSON.parse(parsedState);
            } catch (e) {
                break;
            }
        }

        const updatedPdf = await prisma.pdfCache.update({
            where: { OriginalFileId },
            data: {
                EditedFile: true,
                EditedFilePath: newEditedPath,
                editState: parsedState
            }
        });

        res.json({ message: 'State saved successfully', id: updatedPdf.OriginalFileId, filepath: updatedPdf.EditedFilePath });

    } catch (error) {
        console.error('Save PDF State Error:', error);
        res.status(500).json({ error: 'Failed to save PDF state' });
    }
};

const importLocalPath = async (req, res) => {
    try {
        let { localPath } = req.body;
        if (!localPath) return res.status(400).json({ error: 'File path is required' });

        localPath = localPath.replace(/^["']|["']$/g, '');

        if (!fs.existsSync(localPath)) {
            return res.status(404).json({ error: 'File not found: ' + localPath });
        }

        const fileName = `local_${Date.now()}_${path.basename(localPath)}`;
        const uploadDir = path.join(__dirname, '../uploads/cache');
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

        const newPhysicalPath = path.join(uploadDir, fileName);
        fs.copyFileSync(localPath, newPhysicalPath);

        const cachedPdf = await prisma.pdfCache.create({
            data: {
                OriginalUrlorPath: localPath,
                FileName: path.basename(localPath),
                FilePath: `/uploads/cache/${fileName}`,
                OriginalFile: true,
                EditedFile: false
            }
        });

        res.status(200).json({
            ...cachedPdf,
            filepath: cachedPdf.FilePath,
            id: cachedPdf.OriginalFileId
        });
    } catch (error) {
        console.error('Local Import Error:', error);
        res.status(500).json({ error: 'Failed to import local file' });
    }
};

module.exports = {
    upload,
    uploadBackground,
    checkPdfType,
    generatePDF,
    getAssetFromDb,
    getAllAssets,
    deleteAssetFromDb,
    importPdfUrl,
    autoImportUniversal,
    deletePdf,
    uploadPdf,
    getPdfById,
    savePdfState,
    importLocalPath
};
