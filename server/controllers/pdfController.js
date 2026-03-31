const puppeteer = require('puppeteer');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { PDFDocument } = require('pdf-lib');
const { asyncHandler } = require('../utils/errorHandler');
const prisma = require('../prismaClient');
const axios = require('axios');

const prepareWorkspace = async (req, res) => {
    try {
        const { id } = req.params;
        const pdf = await prisma.pdfCache.findUnique({ where: { OriginalFileId: id } });

        if (!pdf) return res.status(404).json({ error: 'ไม่พบไฟล์ในฐานข้อมูล' });

        const rawSourcePath = pdf.EditedFile && pdf.EditedFilePath ? pdf.EditedFilePath : pdf.FilePath;
        if (!rawSourcePath) {
            return res.status(400).json({ error: 'ข้อมูล Path ใน Database ว่างเปล่า' });
        }
        const cleanSourcePath = rawSourcePath.replace(/^\//, '');
        const absoluteSource = path.join(__dirname, '..', cleanSourcePath);

        if (!fs.existsSync(absoluteSource)) {
            console.error(`[prepareWorkspace] File not found on disk: ${absoluteSource}`);
            return res.status(404).json({ error: 'ไม่พบไฟล์ต้นฉบับบนเซิร์ฟเวอร์' });
        }

        const tempDirPath = path.join(__dirname, '../uploads/temp');
        if (!fs.existsSync(tempDirPath)) {
            fs.mkdirSync(tempDirPath, { recursive: true });
        }

        const tempFileName = `temp_${id}.pdf`;
        const tempFilePath = `/uploads/temp/${tempFileName}`;
        const cleanTempPath = tempFilePath.replace(/^\//, '');
        const absoluteTemp = path.join(__dirname, '..', cleanTempPath);

        fs.copyFileSync(absoluteSource, absoluteTemp);

        await prisma.pdfCache.update({
            where: { OriginalFileId: id },
            data: { TempFilePath: tempFilePath }
        });

        res.json({
            message: 'เตรียม Workspace สำเร็จ',
            tempPath: tempFilePath,
            editState: pdf.editState
        });
    } catch (error) {
        console.error('[prepareWorkspace] Error:', error);
        res.status(500).json({ error: 'ไม่สามารถเตรียมไฟล์ใน Temp ได้', details: error.message });
    }
};

const resetToOriginal = async (req, res) => {
    try {
        const { id } = req.params;
        const pdf = await prisma.pdfCache.findUnique({ where: { OriginalFileId: id } });

        if (!pdf) return res.status(404).json({ error: 'ไม่พบโปรเจกต์ในระบบ' });

        const cleanSourcePath = pdf.FilePath.replace(/^\//, '');
        const absoluteOriginal = path.join(__dirname, '..', cleanSourcePath);

        if (!fs.existsSync(absoluteOriginal)) {
            await prisma.pdfCache.update({
                where: { OriginalFileId: id },
                data: { OriginalFile: false }
            });
            return res.status(404).json({
                error: 'ไม่สามารถรีเซ็ตได้เนื่องจากไฟล์ต้นฉบับสูญหาย แต่งานที่คุณแก้ไขล่าสุดยังถูกรักษาไว้อย่างปลอดภัย'
            });
        }

        if (pdf.EditedFile && pdf.EditedFilePath) {
            const cleanEditedPath = pdf.EditedFilePath.replace(/^\//, '');
            const oldEditedPath = path.join(__dirname, '..', cleanEditedPath);
            if (fs.existsSync(oldEditedPath)) {
                fs.unlinkSync(oldEditedPath);
            }
        }

        const tempDirPath = path.join(__dirname, '../uploads/temp');
        if (!fs.existsSync(tempDirPath)) fs.mkdirSync(tempDirPath, { recursive: true });

        const absoluteTemp = path.join(__dirname, '..', `uploads/temp/temp_${id}.pdf`);
        fs.copyFileSync(absoluteOriginal, absoluteTemp);

        await prisma.pdfCache.update({
            where: { OriginalFileId: id },
            data: {
                OriginalFile: true,
                EditedFile: false,
                EditedFilePath: null,
                editState: null,
                TempFilePath: `/uploads/temp/temp_${id}.pdf`
            }
        });

        res.json({
            message: 'รีเซ็ตข้อมูลสำเร็จ กลับสู่เวอร์ชันต้นฉบับแล้ว',
            tempPath: `/uploads/temp/temp_${id}.pdf`
        });

    } catch (error) {
        console.error('[resetToOriginal] Error:', error);
        res.status(500).json({ error: 'การรีเซ็ตข้อมูลล้มเหลว: ' + error.message });
    }
};

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = path.join(__dirname, '../uploads/cache');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 50 * 1024 * 1024,
        fieldSize: 50 * 1024 * 1024
    }
});

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
            const cleanPath = record.FilePath.replace(/^\//, '');
            const absPath = path.join(__dirname, '..', cleanPath);

            try {
                if (fs.existsSync(absPath)) {
                    fs.unlinkSync(absPath);
                    console.log(`[deletePdf] ลบไฟล์ต้นฉบับสำเร็จ: ${absPath}`);
                }
            } catch (e) {
                console.warn(`[deletePdf] ลบไฟล์ต้นฉบับไม่สำเร็จ ${absPath}:`, e.message);
            }
        }

        if (record.EditedFilePath) {
            const cleanEditedPath = record.EditedFilePath.replace(/^\//, '');
            const editedAbsPath = path.join(__dirname, '..', cleanEditedPath);

            try {
                if (fs.existsSync(editedAbsPath)) {
                    fs.unlinkSync(editedAbsPath);
                    console.log(`[deletePdf] ลบไฟล์ Edited สำเร็จ: ${editedAbsPath}`);
                }
            } catch (e) {
                console.warn(`[deletePdf] ลบไฟล์ Edited ไม่สำเร็จ ${editedAbsPath}:`, e.message);
            }
        }

        if (record.TempFilePath) {
            const cleanTempPath = record.TempFilePath.replace(/^\//, '');
            const tempAbsPath = path.join(__dirname, '..', cleanTempPath);
            try {
                if (fs.existsSync(tempAbsPath)) fs.unlinkSync(tempAbsPath);
            } catch (e) {
                console.warn(`[deletePdf] ลบไฟล์ Temp ไม่สำเร็จ ${tempAbsPath}:`, e.message);
            }
        }

        await prisma.pdfCache.delete({ where: { OriginalFileId: id } });

        res.json({ message: 'PDF and physical files deleted successfully', id });
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

        if (!pdf.EditedFile || !newEditedPath) {
            const editedFileName = `edited_${Date.now()}_${pdf.FileName}`;
            newEditedPath = `/uploads/cache/${editedFileName}`;
        }

        const absoluteEditedPath = path.join(__dirname, '..', newEditedPath.replace(/^\//, ''));

        if (req.file) {
            fs.copyFileSync(req.file.path, absoluteEditedPath);
            fs.unlinkSync(req.file.path);
        } else {
            const absoluteTemp = path.join(__dirname, '..', `uploads/temp/temp_${OriginalFileId}.pdf`);
            if (fs.existsSync(absoluteTemp)) {
                fs.copyFileSync(absoluteTemp, absoluteEditedPath);
            }
        }

        let parsedState = editState;
        while (typeof parsedState === 'string') {
            try { parsedState = JSON.parse(parsedState); } catch (e) { break; }
        }
        const updatedPdf = await prisma.pdfCache.update({
            where: { OriginalFileId },
            data: {
                EditedFile: true,
                EditedFilePath: newEditedPath,
                editState: parsedState
            }
        });

        res.json({
            message: 'บันทึกสถานะสำเร็จ',
            id: updatedPdf.OriginalFileId,
            filepath: updatedPdf.EditedFilePath
        });

    } catch (error) {
        console.error('Save PDF State Error:', error);
        res.status(500).json({ error: 'บันทึกข้อมูลไม่สำเร็จ' });
    }
};

const importLocalPath = async (req, res) => {
    try {
        let { localPath } = req.body;
        if (!localPath) return res.status(400).json({ error: 'File path is required' });

        localPath = localPath.replace(/^["']|["']$/g, '');

        if (!localPath.toLowerCase().endsWith('.pdf')) {
            return res.status(400).json({ error: 'Security Policy: อนุญาตให้อิมพอร์ตเฉพาะไฟล์ .pdf เท่านั้น' });
        }

        const normalizedPath = path.resolve(localPath);

        if (!fs.existsSync(normalizedPath)) {
            return res.status(404).json({ error: 'File not found: ' + normalizedPath });
        }

        const fileName = `local_${Date.now()}_${path.basename(normalizedPath)}`;
        const uploadDir = path.join(__dirname, '../uploads/cache');
        if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

        const newPhysicalPath = path.join(uploadDir, fileName);
        fs.copyFileSync(normalizedPath, newPhysicalPath);

        const cachedPdf = await prisma.pdfCache.create({
            data: {
                OriginalUrlorPath: normalizedPath,
                FileName: path.basename(normalizedPath),
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

const saveGeneratedPdfState = async (req, res) => {
    try {
        const { OriginalFileId, editState } = req.body;
        if (!req.file) return res.status(400).json({ error: 'ไม่พบไฟล์ PDF ที่ส่งมา' });
        const pdf = await prisma.pdfCache.findUnique({ where: { OriginalFileId } });
        if (!pdf) return res.status(404).json({ error: 'ไม่พบโปรเจกต์ในระบบ' });
        const fs = require('fs');
        const path = require('path');
        const newEditedPath = `/uploads/cache/${req.file.filename}`;
        if (pdf.EditedFile && pdf.EditedFilePath) {
            const oldPath = path.join(__dirname, '..', pdf.EditedFilePath);
            if (fs.existsSync(oldPath) && oldPath !== path.join(__dirname, '..', pdf.FilePath)) {
                fs.unlinkSync(oldPath);
            }
        }
        const updatedPdf = await prisma.pdfCache.update({
            where: { OriginalFileId },
            data: {
                EditedFile: true,
                EditedFilePath: newEditedPath,
                editState: editState ? JSON.parse(editState) : pdf.editState
            }
        });
        res.status(200).json(updatedPdf);
    } catch (error) {
        console.error('Save Generated PDF Error:', error);
        res.status(500).json({ error: 'บันทึกโปรเจกต์พร้อมไฟล์ PDF ไม่สำเร็จ' });
    }
};

const cleanupTempFile = async (req, res) => {
    try {
        const { id } = req.params;
        const pdf = await prisma.pdfCache.findUnique({ where: { OriginalFileId: id } });

        if (pdf && pdf.TempFilePath) {
            const cleanTempPath = pdf.TempFilePath.replace(/^\//, '');
            const absoluteTemp = path.join(__dirname, '..', cleanTempPath);

            if (fs.existsSync(absoluteTemp)) {
                fs.unlinkSync(absoluteTemp);
                console.log(`[cleanupTempFile] ลบไฟล์ Temp ทิ้งเรียบร้อย: ${absoluteTemp}`);
            }

            await prisma.pdfCache.update({
                where: { OriginalFileId: id },
                data: { TempFilePath: null }
            });
        }

        res.json({ message: 'ลบไฟล์ Temp ออกจากระบบสำเร็จ' });
    } catch (error) {
        console.error('[cleanupTempFile] Error:', error);
        res.status(500).json({ error: 'ไม่สามารถลบไฟล์ Temp ได้' });
    }
};

module.exports = {
    upload,
    checkPdfType,
    generatePDF,
    importPdfUrl,
    autoImportUniversal,
    deletePdf,
    uploadPdf,
    getPdfById,
    savePdfState,
    importLocalPath,
    saveGeneratedPdfState,
    prepareWorkspace,
    resetToOriginal,
    cleanupTempFile
};
