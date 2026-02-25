const puppeteer = require('puppeteer');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { PDFDocument } = require('pdf-lib');
const { asyncHandler } = require('../utils/errorHandler');
const prisma = require('../prismaClient');

// Enhanced logging utility
const logger = {
    info: (message, ...args) => {
        console.log(`[PDF] ${new Date().toISOString()} - ${message}`, ...args);
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
        console.log(`✅ [PDF] ${new Date().toISOString()} - ${message}`, ...args);
    }
};

// Configure multer to use memory storage
const storage = multer.memoryStorage();

const upload = multer({
    storage,
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// 1. Check PDF Type & Metadata (Smart Import)
const checkPdfType = asyncHandler(async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file' });

        // Save file to database as asset
        const asset = await prisma.asset.create({
            data: {
                filename: req.file.originalname,
                mimetype: req.file.mimetype,
                data: req.file.buffer
            }
        });

        const fileUrl = `${req.protocol}://${req.get('host')}/api/assets/${asset.id}`;

        // Load PDF from buffer to check metadata
        const existingPdfBytes = req.file.buffer;
        const pdfDoc = await PDFDocument.load(existingPdfBytes);

        // --- Safe Metadata Reading ---
        // pdf-lib's getSubject() crashes on large strings due to stack overflow in recursive decoder.
        // We implement a direct Buffer-based read here.
        let subject = null;
        let keywords = null;

        try {
            const { PDFName, PDFString, PDFHexString } = require('pdf-lib');

            // Access Info Dictionary safely
            const infoDict = pdfDoc.context.lookup(pdfDoc.context.trailerInfo.Info);

            const decodePdfString = (pdfStr) => {
                if (!pdfStr) return null;
                const bytes = pdfStr.asBytes();
                if (bytes[0] === 0xFE && bytes[1] === 0xFF) {
                    // UTF-16BE
                    return Buffer.from(bytes.slice(2)).toString('utf16le')
                        .split('').map((c, i, a) => i % 2 === 0 ? a[i + 1] + c : '').join(''); // Manual swap if needed or just use proper decoding
                }
                // Fallback to UTF-8 or PDFDocEncoding (treated as Latin1/UTF-8 for most cases here)
                return Buffer.from(bytes).toString('utf-8');
            };

            // Improved UTF-16BE Decoder for Buffer
            const decodeBuffer = (buf) => {
                if (!buf || buf.length < 2) return buf?.toString('utf-8') || null;
                if (buf[0] === 0xFE && buf[1] === 0xFF) {
                    // PDF UTF-16BE strings start with FE FF
                    // We need to swap bytes for Node's utf16le or use swap16()
                    const content = Buffer.from(buf.slice(2));
                    content.swap16();
                    return content.toString('utf16le');
                }
                return buf.toString('utf-8');
            };

            if (infoDict) {
                // 1. Safe Subject Read
                const subjectEntry = infoDict.get(PDFName.of('Subject'));
                if (subjectEntry instanceof PDFString || subjectEntry instanceof PDFHexString) {
                    subject = decodeBuffer(Buffer.from(subjectEntry.asBytes()));
                }

                // 2. Safe Keywords Read
                const keywordsEntry = infoDict.get(PDFName.of('Keywords'));
                if (keywordsEntry instanceof PDFString || keywordsEntry instanceof PDFHexString) {
                    keywords = decodeBuffer(Buffer.from(keywordsEntry.asBytes()));
                }
            }
        } catch (unsafeErr) {
            logger.warn('Safe metadata read failed, falling back to standard', unsafeErr);
            // Fallback (Might crash if too large)
            subject = pdfDoc.getSubject();
            keywords = pdfDoc.getKeywords();
        }

        let foundId = null;
        let foundType = null;
        let embeddedLayout = null;

        // 1. แกะ ID และ Type จาก Keywords
        if (keywords) {
            // pdf-lib returns array for getKeywords(), but our safe read returns string. Handle both.
            const keywordString = Array.isArray(keywords) ? keywords.join(' ') : keywords;
            logger.info(`Checking PDF metadata: ${keywordString.substring(0, 100)}...`);

            const idMatch = keywordString.match(/dynamic-id:(\S+)/);
            if (idMatch) foundId = idMatch[1];

            const typeMatch = keywordString.match(/dynamic-type:(\S+)/);
            if (typeMatch) foundType = typeMatch[1];

            // Legacy Support
            if (!foundId) {
                const legacyMatch = keywordString.match(/dynamic-report-id:(\S+)/);
                if (legacyMatch) {
                    foundId = legacyMatch[1];
                    foundType = 'template';
                }
            }
        }

        // 2. แกะ Layout JSON จาก Subject (ถ้ามี)
        if (subject && subject.startsWith('layout:')) {
            try {
                // ตัดคำว่า 'layout:' ออก แล้ว Decode Base64
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
            embeddedLayout: embeddedLayout, // ส่งข้อมูลที่ฝังไว้กลับไปให้ Frontend
            url: fileUrl
        });
    } catch (error) {
        logger.error('Failed to check PDF:', error);
        res.json({ isGenerated: false, url: null });
    }
});

// 2. Upload Normal Background / Asset
const uploadBackground = asyncHandler(async (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const asset = await prisma.asset.create({
        data: {
            filename: req.file.originalname,
            mimetype: req.file.mimetype,
            data: req.file.buffer
        }
    });

    const fileUrl = `${req.protocol}://${req.get('host')}/api/assets/${asset.id}`;
    logger.success('Asset uploaded to DB:', fileUrl);
    res.json({ url: fileUrl, id: asset.id });
});

// GET Asset from DB
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
    res.end(asset.data); // Use res.end for raw binary buffer
});

// GET All Assets Metadata
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

// DELETE Asset from DB
const deleteAssetFromDb = asyncHandler(async (req, res) => {
    const { id } = req.params;

    // Check if it exists
    const existingAsset = await prisma.asset.findUnique({ where: { id } });
    if (!existingAsset) {
        return res.status(404).json({ error: 'Asset not found' });
    }

    await prisma.asset.delete({
        where: { id }
    });

    res.json({ message: 'Asset deleted successfully' });
});

// 3. Generate PDF (Embed ID, Type & Layout Data)
const generatePDF = asyncHandler(async (req, res) => {
    logger.info('Starting PDF generation...');
    const startTime = Date.now();
    let browser = null;

    try {
        // [UPDATED] รับ pagesData มาด้วย
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
                    /* FONT CONSISTENCY FIX: Use Sarabun as default fallback — same as the Hybrid PDF
                       client path (useEditablePdf.js). This ensures both export buttons produce the
                       same visual result when the user-selected font cannot be loaded. */
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

        // [UPDATED] Embed Metadata logic
        try {
            const pdfDoc = await PDFDocument.load(pdfBuffer);

            // 1. Set ID & Type in Keywords
            const typeToEmbed = recordType || 'report';
            const keywords = [];
            if (recordId) keywords.push(`dynamic-id:${recordId}`);
            keywords.push(`dynamic-type:${typeToEmbed}`);

            pdfDoc.setKeywords(keywords);

            // 2. Set Layout Data in Subject (Encode to Base64)
            // BUG-020 fix: guard against large projects exceeding PDF Subject field limits.
            // If the JSON is too big (> 50KB), embedding will produce a corrupt/truncated
            // Subject field in some readers. Skip embedding and log a warning.
            if (pagesData) {
                const jsonStr = JSON.stringify(pagesData);
                const MAX_METADATA_BYTES = 50 * 1024; // 50 KB
                if (Buffer.byteLength(jsonStr, 'utf-8') > MAX_METADATA_BYTES) {
                    logger.warn(`Layout data too large to embed (${Math.round(Buffer.byteLength(jsonStr, 'utf-8') / 1024)}KB > 50KB). Metadata will be omitted.`);
                } else {
                    // แปลงเป็น Base64 เพื่อรองรับภาษาไทยและอักขระพิเศษ
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
        logger.error(`❌ PDF FAILED (${duration}ms):`, error);
        throw error; // Rethrow to let global handler catch it
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

module.exports = {
    upload,
    uploadBackground,
    checkPdfType,
    generatePDF,
    getAssetFromDb,
    getAllAssets,
    deleteAssetFromDb
};
